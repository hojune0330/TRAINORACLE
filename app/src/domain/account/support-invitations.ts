import { z } from "zod"
import { supabase } from "./supabase-client"

const normalizedInvitationCodeSchema = z.string().regex(/^[A-Z0-9]{12}$/u)
const INVITATION_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"

export type InvitationActionResult = {
  readonly ok: boolean
  readonly message: string
  readonly code?: string
}

export function createSupportInvitationCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(12))
  const raw = [...bytes]
    .map((value) => INVITATION_ALPHABET[value % INVITATION_ALPHABET.length])
    .join("")
  return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}`
}

export async function hashSupportInvitationCode(code: string): Promise<string> {
  const normalized = code.replace(/[\s-]/gu, "").toUpperCase()
  const parsed = normalizedInvitationCodeSchema.safeParse(normalized)
  if (!parsed.success) throw new RangeError("초대 코드 형식이 올바르지 않아요.")
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(parsed.data))
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("")
}

export async function createSupportInvitation(
  athleteId: string,
  seasonEndsOn: string,
): Promise<InvitationActionResult> {
  const client = await supabase()
  if (client === null) return { ok: false, message: "연결 기능이 꺼져 있어요." }
  const code = createSupportInvitationCode()
  const codeHash = await hashSupportInvitationCode(code)
  const expiresAt = new Date(Date.now() + 7 * 86_400_000).toISOString()
  const { error } = await client.from("support_invitations").insert({
    athlete_id: athleteId,
    code_hash: codeHash,
    season_ends_on: seasonEndsOn,
    expires_at: expiresAt,
  })
  return error === null
    ? { ok: true, message: "초대 코드를 만들었어요. 7일 안에 전달해 주세요.", code }
    : { ok: false, message: "초대 코드를 만들지 못했어요." }
}

export async function acceptSupportInvitation(code: string): Promise<InvitationActionResult> {
  const client = await supabase()
  if (client === null) return { ok: false, message: "연결 기능이 꺼져 있어요." }
  let codeHash: string
  try {
    codeHash = await hashSupportInvitationCode(code)
  } catch (error) {
    if (error instanceof RangeError) return { ok: false, message: error.message }
    throw error
  }
  const { error } = await client.rpc("accept_support_invitation", { invitation_code_hash: codeHash })
  return error === null
    ? { ok: true, message: "코치·지원자로 연결했어요. 자격 미확인 연결로 표시돼요." }
    : { ok: false, message: "초대 코드가 잘못됐거나 만료됐어요." }
}
