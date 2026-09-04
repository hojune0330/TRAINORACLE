import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { generatePlanFromDraft, selectPlanForActivation } from "../plan-beta-flow"
import { planBetaStateV3Schema } from "../plan-beta-schema"
import { RUNTIME_CASES, TODAY, draftFor, saveCurrentRecord } from "../prescription-quality-matrix.test-fixtures"

const OWNER_A = "00000000-0000-4000-8000-000000000001"
const OWNER_B = "00000000-0000-4000-8000-000000000002"

const runtime = vi.hoisted(() => ({
  publicProfileEnabled: true,
  profileIsPublic: true,
  currentUserId: "00000000-0000-4000-8000-000000000001",
  shareCardCalls: [] as Array<{ method: string, args: unknown[] }>,
  savedCards: [] as Array<Record<string, unknown>>,
}))

vi.mock("../product-features", () => ({
  productFeatures: () => ({
    sync: true,
    sharing: true,
    planProposals: true,
    planBackup: true,
    publicProfile: runtime.publicProfileEnabled,
    experimentalFatigue: false,
    decorationShop: true,
    productAnalytics: false,
    feedbackBoard: false,
  }),
}))

vi.mock("./supabase-client", () => ({
  supabase: () => Promise.resolve({
    auth: {
      getSession: () => Promise.resolve({
        data: { session: { user: { id: runtime.currentUserId } } },
        error: null,
      }),
    },
    from: (table: string) => {
      if (table === "public_athlete_profiles") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () => Promise.resolve({
                data: {
                  user_id: runtime.currentUserId,
                  handle: "runner-one",
                  display_name: "Runner One",
                  profile_tag: "TRAINING_CONSISTENTLY",
                  is_public: runtime.profileIsPublic,
                },
                error: null,
              }),
            }),
          }),
        }
      }
      if (table !== "public_plan_share_cards") throw new TypeError(`Unexpected table: ${table}`)
      return publicPlanShareCardsTable()
    },
  }),
  __resetSupabaseForTest: () => {},
}))

import { publicPlanCardFromState, publishActivePlanCard } from "./public-profile"

function publicPlanShareCardsTable() {
  return {
    select: (...args: unknown[]) => {
      runtime.shareCardCalls.push({ method: "select", args })
      let userId: unknown
      return {
        eq: (field: unknown, value: unknown) => {
          runtime.shareCardCalls.push({ method: "eq", args: [field, value] })
          if (field === "user_id") userId = value
          return {
            eq: (nextField: unknown, nextValue: unknown) => {
              runtime.shareCardCalls.push({ method: "eq", args: [nextField, nextValue] })
              const existing = runtime.savedCards.find((card) => (
                card.user_id === userId && card.plan_id === nextValue
              ))
              return {
                maybeSingle: () => Promise.resolve({
                  data: existing === undefined ? null : { share_slug: existing.share_slug },
                  error: null,
                }),
              }
            },
          }
        },
      }
    },
    upsert: (...args: unknown[]) => {
      runtime.shareCardCalls.push({ method: "upsert", args })
      const row = args[0] as Record<string, unknown>
      const index = runtime.savedCards.findIndex((card) => (
        card.user_id === row.user_id && card.plan_id === row.plan_id
      ))
      if (index < 0) runtime.savedCards.push({ ...row })
      else runtime.savedCards[index] = { ...runtime.savedCards[index], ...row }
      return Promise.resolve({ data: null, error: null })
    },
  }
}

function detailedStoredPlan(caseIndex: number) {
  vi.useFakeTimers()
  vi.setSystemTime(TODAY)
  try {
    const fixture = RUNTIME_CASES[caseIndex]
    if (fixture === undefined) throw new RangeError("Missing detailed-plan fixture")
    const selectedRecordId = saveCurrentRecord(fixture.eventDistanceM, fixture.performanceSeconds)
    const generated = generatePlanFromDraft(draftFor(fixture), "NO_KNOWN_RISK", { selectedRecordId })
    if (generated.kind !== "generated") throw new TypeError("Expected detailed plan generation")
    const selected = selectPlanForActivation(
      generated.generated.candidates[0].candidateId,
      generated.generated,
      generated.gate,
      generated.intake,
    )
    if (selected.kind !== "selected" || selected.state.version !== 3) throw new TypeError("Expected stored V3 plan")
    const state = planBetaStateV3Schema.parse(selected.state)
    const detailedSession = state.activePlan.sessions.find((session) => session.prescription.kind === "PACE_TARGET")
    if (detailedSession?.prescription.kind !== "PACE_TARGET" || detailedSession.prescription.sequence === undefined) {
      throw new TypeError("Expected stored detailed prescription sequence")
    }
    return { state, prescription: detailedSession.prescription }
  } finally {
    vi.useRealTimers()
  }
}

function upsertPlanIds(): string[] {
  return runtime.shareCardCalls
    .filter((call) => call.method === "upsert")
    .map((call) => (call.args[0] as Record<string, unknown>).plan_id)
    .filter((value): value is string => typeof value === "string")
}

function upsertShareSlugs(): string[] {
  return runtime.shareCardCalls
    .filter((call) => call.method === "upsert")
    .map((call) => (call.args[0] as Record<string, unknown>).share_slug)
    .filter((value): value is string => typeof value === "string")
}

beforeEach(() => {
  runtime.publicProfileEnabled = true
  runtime.profileIsPublic = true
  runtime.currentUserId = OWNER_A
  runtime.shareCardCalls = []
  runtime.savedCards = []
  window.localStorage.clear()
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe("public plan-card publication privacy boundary", () => {
  it("counts visible training only and never equates completed exercise with cycle completion", () => {
    const { state } = detailedStoredPlan(1)
    const frame = state.activePlan.frame
    const days = "projectionLengthDays" in frame ? frame.projectionLengthDays ?? frame.lengthDays : frame.lengthDays
    const visible = state.activePlan.sessions.filter(session => session.day <= Math.ceil(days) && session.role !== "REST")
    const allMarked = { ...state, progress: state.activePlan.sessions.map(session => ({
      sessionDay: session.day, sessionSlot: session.slot, state: "COMPLETED" as const,
    })) }
    expect(publicPlanCardFromState(allMarked)).toMatchObject({
      frameLengthDays: days, totalSessionCount: visible.length,
      completedSessionCount: visible.length, badgeLabel: `훈련 ${visible.length}회 완료`,
    })
    expect(publicPlanCardFromState({ ...state, progress: [] }).badgeLabel).toBe("계획 공유")
    const skipped = { ...allMarked, progress: allMarked.progress.map(item => ({ ...item, state: "SKIPPED" as const })) }
    const pain = { ...allMarked, progress: allMarked.progress.map(item => ({ ...item, state: "PAIN_CHECKIN" as const })) }
    expect(publicPlanCardFromState(pain)).toEqual(publicPlanCardFromState(skipped))
    expect(publicPlanCardFromState(allMarked).badgeLabel).not.toContain("주기 완료")
  })
  it("uses an opaque public id for every share-card query and write from a detailed stored plan", async () => {
    const { state, prescription } = detailedStoredPlan(1)
    const forbidden = [
      state.activePlan.candidateId,
      JSON.stringify(prescription.sequence),
      prescription.selectedAnchor.anchorId,
      prescription.selectedAnchor.sourceRef,
    ]

    await expect(publishActivePlanCard(OWNER_A, state)).resolves.toMatchObject({ ok: true })

    const outgoingShareCardArguments = JSON.stringify(runtime.shareCardCalls)
    for (const value of forbidden) expect(outgoingShareCardArguments).not.toContain(value)
    expect(upsertPlanIds()).toHaveLength(1)
    expect(upsertPlanIds()[0]).toMatch(/^public-plan-card:v1:sha256:[a-f0-9]{64}$/u)
  })

  it("publishes for the authenticated owner and reuses the same opaque id and share slug", async () => {
    const { state } = detailedStoredPlan(1)

    await expect(publishActivePlanCard(OWNER_A, state)).resolves.toMatchObject({ ok: true })
    await expect(publishActivePlanCard(OWNER_A, state)).resolves.toMatchObject({ ok: true })

    expect(upsertPlanIds()).toHaveLength(2)
    expect(upsertPlanIds()[0]).toBe(upsertPlanIds()[1])
    expect(upsertShareSlugs()[0]).toBe(upsertShareSlugs()[1])
    expect(runtime.savedCards).toHaveLength(1)
  })

  it("separates public ids for a different authenticated owner or detailed plan", async () => {
    const first = detailedStoredPlan(1)
    window.localStorage.clear()
    const second = detailedStoredPlan(2)

    await publishActivePlanCard(OWNER_A, first.state)
    runtime.currentUserId = OWNER_B
    await publishActivePlanCard(OWNER_B, first.state)
    runtime.currentUserId = OWNER_A
    await publishActivePlanCard(OWNER_A, second.state)

    expect(new Set(upsertPlanIds()).size).toBe(3)
  })

  it("does not contact the public card table while the feature is disabled", async () => {
    const { state } = detailedStoredPlan(1)
    runtime.publicProfileEnabled = false

    await expect(publishActivePlanCard(OWNER_A, state)).resolves.toMatchObject({ ok: false })
    expect(runtime.shareCardCalls).toEqual([])
  })

  it("does not publish for an account other than the authenticated owner", async () => {
    const { state } = detailedStoredPlan(1)
    await expect(publishActivePlanCard(OWNER_B, state)).resolves.toMatchObject({ ok: false })
    expect(runtime.shareCardCalls).toEqual([])
  })

  it("does not publish when the owner has made the profile private", async () => {
    const { state } = detailedStoredPlan(1)
    runtime.profileIsPublic = false
    await expect(publishActivePlanCard(OWNER_A, state)).resolves.toMatchObject({ ok: false })
    expect(runtime.shareCardCalls).toEqual([])
  })

  it("does not fall back to a raw identifier when WebCrypto is absent", async () => {
    const { state } = detailedStoredPlan(1)
    vi.stubGlobal("crypto", undefined)
    await expect(publishActivePlanCard(OWNER_A, state)).resolves.toMatchObject({ ok: false })
    expect(runtime.shareCardCalls).toEqual([])
  })

  it("does not query or write a card when WebCrypto cannot derive a public id", async () => {
    const { state } = detailedStoredPlan(1)
    vi.stubGlobal("crypto", {
      getRandomValues: (bytes: Uint8Array) => bytes,
      subtle: { digest: vi.fn().mockRejectedValue(new Error("digest unavailable")) },
    })

    await expect(publishActivePlanCard(OWNER_A, state)).resolves.toMatchObject({ ok: false })
    expect(runtime.shareCardCalls).toEqual([])
  })
})
