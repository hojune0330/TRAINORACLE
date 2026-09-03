import { z } from "zod"
import { planBetaStateV3Schema } from "../plan-beta-schema"
import type { PlanBetaStateV3 } from "../plan-beta-schema"
import { oracleComparisonSnapshotSchema } from "../friend-running-oracle"
import type { OracleComparisonSnapshot } from "../friend-running-oracle"
import { productFeatures } from "../product-features"
import { supabase } from "./supabase-client"

const handleSchema = z.string().trim().toLowerCase().regex(/^[a-z0-9][a-z0-9_-]{2,23}$/u)
const profileRowSchema = z.object({
  user_id: z.string().uuid(),
  handle: handleSchema,
  display_name: z.string().min(1).max(40),
  profile_tag: z.enum(["TRAINING_CONSISTENTLY", "PREPARING_FOR_RACE", "ENJOYING_RUNNING", "BUILDING_BASE"]),
  is_public: z.boolean(),
})
const cardPayloadSchema = z.object({
  title: z.string().min(1).max(80),
  eventLabel: z.string().min(1).max(40),
  frameLengthDays: z.number().positive(),
  qualitySessionCount: z.number().int().nonnegative(),
  completedSessionCount: z.number().int().nonnegative(),
  totalSessionCount: z.number().int().nonnegative(),
  badgeLabel: z.string().min(1).max(30),
}).strict()
const cardRowSchema = z.object({
  share_slug: z.string(),
  card_payload: cardPayloadSchema,
  updated_at: z.string(),
})
const PUBLIC_PLAN_CARD_ID_DOMAIN = "trainoracle.public-plan-card-id.v1"

export type PublicAthleteProfile = {
  readonly userId: string
  readonly handle: string
  readonly displayName: string
  readonly profileTag: PublicProfileTag
  readonly isPublic: boolean
}

export type PublicPlanCard = z.infer<typeof cardPayloadSchema> & {
  readonly shareSlug: string
  readonly updatedAt: string
}

export type PublicProfilePageData = {
  readonly profile: PublicAthleteProfile
  readonly cards: readonly PublicPlanCard[]
  readonly oracleSnapshot: OracleComparisonSnapshot | null
}

export type PublicProfileSaveInput = {
  readonly handle: string
  readonly displayName: string
  readonly profileTag: PublicProfileTag
  readonly isPublic: boolean
}

export type PublicProfileTag = "TRAINING_CONSISTENTLY" | "PREPARING_FOR_RACE" | "ENJOYING_RUNNING" | "BUILDING_BASE"

export const PUBLIC_PROFILE_TAG_LABELS: Readonly<Record<PublicProfileTag, string>> = {
  TRAINING_CONSISTENTLY: "꾸준히 훈련하고 있어요",
  PREPARING_FOR_RACE: "다음 경기를 준비하고 있어요",
  ENJOYING_RUNNING: "달리기를 즐기고 있어요",
  BUILDING_BASE: "기초 체력을 만들고 있어요",
}

export type PublicProfileActionResult = {
  readonly ok: boolean
  readonly message: string
  readonly url?: string
}

export async function loadOwnPublicProfile(userId: string): Promise<PublicAthleteProfile | null> {
  const client = await supabase()
  if (client === null) return null
  const { data, error } = await client
    .from("public_athlete_profiles")
    .select("user_id, handle, display_name, profile_tag, is_public")
    .eq("user_id", userId)
    .maybeSingle()
  return error === null ? parseProfile(data) : null
}

export async function savePublicProfile(
  userId: string,
  input: PublicProfileSaveInput,
): Promise<PublicProfileActionResult> {
  if (!productFeatures().publicProfile) return { ok: false, message: "현재 공개 프로필을 사용할 수 없어요." }
  const parsed = z.object({
    handle: handleSchema,
    displayName: z.string().trim().min(1).max(40),
    profileTag: z.enum(["TRAINING_CONSISTENTLY", "PREPARING_FOR_RACE", "ENJOYING_RUNNING", "BUILDING_BASE"]),
    isPublic: z.boolean(),
  }).safeParse(input)
  if (!parsed.success) {
    return { ok: false, message: "별칭은 영문 소문자·숫자·밑줄로 3~24자, 이름은 40자 이내로 적어 주세요." }
  }
  const client = await supabase()
  if (client === null) return { ok: false, message: "계정 기능을 사용할 수 없어요." }
  const { data: sessionData } = await client.auth.getSession()
  if (sessionData.session?.user.id !== userId) return { ok: false, message: "로그인 정보를 다시 확인해 주세요." }
  const { error } = await client.from("public_athlete_profiles").upsert({
    user_id: userId,
    handle: parsed.data.handle,
    display_name: parsed.data.displayName,
    profile_tag: parsed.data.profileTag,
    is_public: parsed.data.isPublic,
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id" })
  if (error !== null) {
    return { ok: false, message: error.code === "23505" ? "이미 사용 중인 별칭이에요." : "프로필을 저장하지 못했어요." }
  }
  return {
    ok: true,
    message: parsed.data.isPublic ? "공개 프로필을 저장했어요." : "프로필을 나만 볼 수 있게 저장했어요.",
    url: parsed.data.isPublic ? publicProfileUrl(parsed.data.handle) : undefined,
  }
}

export async function publishActivePlanCard(
  userId: string,
  state: unknown,
): Promise<PublicProfileActionResult> {
  if (!productFeatures().publicProfile) return { ok: false, message: "현재 친구 공유를 사용할 수 없어요." }
  const parsed = planBetaStateV3Schema.safeParse(state)
  if (!parsed.success) return { ok: false, message: "공유할 수 있는 현재 계획이 없어요." }
  const client = await supabase()
  if (client === null) return { ok: false, message: "계정 기능을 사용할 수 없어요." }
  const { data: sessionData } = await client.auth.getSession()
  if (sessionData.session?.user.id !== userId) return { ok: false, message: "로그인 정보를 다시 확인해 주세요." }
  const publicPlanId = await publicPlanCardId(userId, parsed.data.activePlan.candidateId)
  if (publicPlanId === null) return { ok: false, message: "계획 공유 카드를 안전하게 준비하지 못했어요." }
  const profile = await loadOwnPublicProfile(userId)
  if (profile === null || !profile.isPublic) {
    return { ok: false, message: "먼저 공개 프로필을 켜 주세요." }
  }
  const existing = await client
    .from("public_plan_share_cards")
    .select("share_slug")
    .eq("user_id", userId)
    .eq("plan_id", publicPlanId)
    .maybeSingle()
  const shareSlug = typeof existing.data?.share_slug === "string"
    ? existing.data.share_slug
    : randomShareSlug()
  const card = publicPlanCardFromState(parsed.data)
  const { error } = await client.from("public_plan_share_cards").upsert({
    user_id: userId,
    plan_id: publicPlanId,
    share_slug: shareSlug,
    card_payload: card,
    is_public: true,
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id,plan_id" })
  return error === null
    ? { ok: true, message: "현재 계획 요약을 친구에게 보여줄 수 있어요.", url: publicProfileUrl(profile.handle) }
    : { ok: false, message: "계획 공유 카드를 저장하지 못했어요." }
}

export async function loadPublicProfile(handle: string): Promise<PublicProfilePageData | null> {
  const parsedHandle = handleSchema.safeParse(handle)
  if (!parsedHandle.success) return null
  const client = await supabase()
  if (client === null) return null
  const { data, error } = await client
    .from("public_athlete_profiles")
    .select("user_id, handle, display_name, profile_tag, is_public")
    .eq("handle", parsedHandle.data)
    .eq("is_public", true)
    .maybeSingle()
  const profile = error === null ? parseProfile(data) : null
  if (profile === null) return null
  const cardsResult = await client
    .from("public_plan_share_cards")
    .select("share_slug, card_payload, updated_at")
    .eq("user_id", profile.userId)
    .eq("is_public", true)
    .order("updated_at", { ascending: false })
    .limit(6)
  const cards = (cardsResult.data ?? []).flatMap((candidate: unknown) => {
    const parsed = cardRowSchema.safeParse(candidate)
    return parsed.success ? [{ ...parsed.data.card_payload, shareSlug: parsed.data.share_slug, updatedAt: parsed.data.updated_at }] : []
  })
  const snapshotResult = await client
    .from("public_oracle_comparison_snapshots")
    .select("snapshot_payload, is_enabled")
    .eq("user_id", profile.userId)
    .eq("is_enabled", true)
    .maybeSingle()
  const parsedSnapshot = snapshotResult.error === null && snapshotResult.data?.is_enabled === true
    ? oracleComparisonSnapshotSchema.safeParse(snapshotResult.data.snapshot_payload)
    : null
  return {
    profile,
    cards,
    oracleSnapshot: parsedSnapshot !== null && parsedSnapshot.success ? parsedSnapshot.data : null,
  }
}

export function publicProfileUrl(handle: string): string {
  if (typeof window === "undefined") return `?profile=${encodeURIComponent(handle)}`
  const url = new URL(window.location.href)
  url.search = ""
  url.searchParams.set("profile", handle)
  return url.toString()
}

function parseProfile(value: unknown): PublicAthleteProfile | null {
  const parsed = profileRowSchema.safeParse(value)
  return parsed.success ? {
    userId: parsed.data.user_id,
    handle: parsed.data.handle,
    displayName: parsed.data.display_name,
    profileTag: parsed.data.profile_tag,
    isPublic: parsed.data.is_public,
  } : null
}

export function publicPlanCardFromState(state: PlanBetaStateV3): z.infer<typeof cardPayloadSchema> {
  const completed = state.progress.filter(item => item.state === "COMPLETED").length
  const total = state.activePlan.sessions.length
  return {
    title: `${state.activePlan.eventDistanceM}m ${state.activePlan.frame.lengthDays}일 훈련 계획`,
    eventLabel: `${state.activePlan.eventDistanceM}m`,
    frameLengthDays: state.activePlan.frame.lengthDays,
    qualitySessionCount: state.activePlan.sessions.filter(session => session.role === "QUALITY").length,
    completedSessionCount: completed,
    totalSessionCount: total,
    badgeLabel: completed === 0 ? "계획 시작" : completed >= total ? "주기 완료" : `${completed}회 완료`,
  }
}

function randomShareSlug(): string {
  const bytes = new Uint8Array(10)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, value => value.toString(16).padStart(2, "0")).join("")
}

async function publicPlanCardId(userId: string, candidateId: string): Promise<string | null> {
  if (typeof crypto === "undefined" || crypto.subtle === undefined) return null
  try {
    const source = new TextEncoder().encode(`${PUBLIC_PLAN_CARD_ID_DOMAIN}\0${userId}\0${candidateId}`)
    const digest = await crypto.subtle.digest("SHA-256", source)
    const hash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("")
    return `public-plan-card:v1:sha256:${hash}`
  } catch {
    return null
  }
}
