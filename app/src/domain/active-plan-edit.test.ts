import { deriveCandidateId } from "@impl/plan-generator/candidate-identity"
import { describe, expect, it } from "vitest"
import { prepareActivePlanEdit, type ActivePlanEditAddress } from "./active-plan-edit"
import { activePlanEditDurationConsentRequired } from "./active-plan-edit-policy"
import { planBetaStateV3Schema, type PlanBetaStateV3 } from "./plan-beta-schema"
import type { JournalEntry } from "./journal-schema"
import type { VersionedStoredPlanSession } from "./plan-session-schema"
import { createPlannedSessionLogDraft } from "./planned-session-link"
import { stateFixture } from "./plan-beta-store.test-fixture"
import { ALL_WORKOUT_CATALOG, catalogMethodIdentity } from "@impl/prescription/all-workout-calculator"
import { bindCatalogSession, catalogFamilyForIntent } from "@impl/prescription/catalog-session-binding"
import { generatePlanFromDraft, selectPlanForActivation } from "./plan-beta-flow"

function fixture() {
  const state = stateFixture() as PlanBetaStateV3
  state.intake.startDate = "2026-10-01"
  state.intake.secondSessionMode = "RECOVERY_PM_ALLOWED"
  const easy = { role: "EASY" as const, plannedEnergyIntent: "BASE_INTENT" as const,
    prescription: { kind: "RPE_TIME_RANGE" as const, rpe: { minimum: 3, maximum: 4 },
      durationMinutes: { minimum: 10, maximum: 20 } } }
  const sessions: VersionedStoredPlanSession[] = [
    { ...easy, day: 1, slot: "AM" },
    { ...easy, day: 3, slot: "AM" },
    { day: 5, slot: "AM", role: "REST", plannedEnergyIntent: "RECOVERY_INTENT", prescription: { kind: "REST" } },
    { ...easy, day: 5, slot: "PM" },
    { ...easy, day: 7, slot: "AM" },
  ]
  state.activePlan.sessions = sessions
  const plan = state.activePlan
  if (!("formationKind" in plan.frame)) throw Error("V3 frame required")
  plan.candidateId = deriveCandidateId(plan.candidateId, {
    kind: plan.candidateKind, eventDistanceM: plan.eventDistanceM,
    selectedDetailedTemplateRef: plan.selectedDetailedTemplateRef, selectedEnergyIntent: plan.selectedEnergyIntent,
    sourceMode: plan.sourceMode, selectionAuthority: "SELF", frame: plan.frame, sessions,
  })
  expect(planBetaStateV3Schema.safeParse(state).success).toBe(true)
  return { state, entries: [] as JournalEntry[], today: "2026-10-01", now: "2026-10-01T03:00:00.000Z",
    timeZone: "Asia/Seoul", journalGuard: null, unstartedConfirmed: true, noFixedFutureCommitments: true }
}

const source: ActivePlanEditAddress = { day: 3, slot: "AM" }

describe("manual active plan edit proposal", () => {
  it("narrows only the stored non-catalog duration maximum and returns a new plan revision", () => {
    const input = fixture()
    const before = structuredClone(input.state)
    const result = prepareActivePlanEdit({ ...input, action: "DURATION", source, maximumMinutes: 15 })
    expect(result.kind).toBe("ready")
    if (result.kind !== "ready") return
    const changed = result.proposal.after.activePlan.sessions.find(s => s.day === 3 && s.slot === "AM")!
    expect(changed).toMatchObject({ role: "EASY", prescription: { kind: "RPE_TIME_RANGE", rpe: { minimum: 3, maximum: 4 },
      durationMinutes: { minimum: 10, maximum: 15 } } })
    expect(result.proposal.newPlanId).not.toBe(result.proposal.originalPlanId)
    expect(result.proposal.after.activePlanEdit?.trigger).toBe("EXPLICIT_PLAN_EDIT")
    expect(result.proposal.after.progress).toEqual(before.progress)
    expect(input.state).toEqual(before)
  })

  it("swaps complete slot contents only with an existing same-half REST/EASY position", () => {
    const input = fixture()
    const result = prepareActivePlanEdit({ ...input, action: "SWAP", source, target: { day: 5, slot: "AM" } })
    expect(result.kind).toBe("ready")
    if (result.kind !== "ready") return
    expect(result.proposal.after.activePlan.sessions.find(s => s.day === 3 && s.slot === "AM")?.role).toBe("REST")
    expect(result.proposal.after.activePlan.sessions.find(s => s.day === 5 && s.slot === "AM")?.role).toBe("EASY")
    expect(result.proposal.source).toEqual(source)
    expect(result.proposal.target).toEqual({ day: 5, slot: "AM" })
  })

  it("requires confirmation and protects progress, linked, and ambiguous unlinked same-date logs", () => {
    const input = fixture()
    expect(prepareActivePlanEdit({ ...input, unstartedConfirmed: false, action: "DURATION", source, maximumMinutes: 15 }))
      .toMatchObject({ kind: "blocked", reasonCode: "UNSTARTED_CONFIRMATION_REQUIRED" })
    input.state.progress = [{ sessionDay: 3, sessionSlot: "AM", state: "SKIPPED" }]
    expect(prepareActivePlanEdit({ ...input, action: "DURATION", source, maximumMinutes: 15 }))
      .toMatchObject({ kind: "blocked", reasonCode: "TARGET_PROTECTED" })
    input.state.progress = []
    const linkedPlan = input.state.activePlan.sessions.find(s => s.day === 3 && s.slot === "AM")!
    const link = createPlannedSessionLogDraft(input.state, linkedPlan, "2026-10-02T12:00:00.000Z")!.link
    input.entries = [{ id: "linked", kind: "post-session", date: "2026-10-04", savedAt: "2026-10-04T01:00:00.000Z",
      syncState: "local", title: "", memo: "", system: "base", distanceKm: "", durationMin: "", avgPace: "", rpe: 0,
      activityOutcome: "COMPLETED", activitySlot: "AM", painCheckStatus: "NO_SIGNAL_REPORTED", plannedSessionLink: link } as JournalEntry]
    expect(prepareActivePlanEdit({ ...input, action: "DURATION", source, maximumMinutes: 15 }))
      .toMatchObject({ kind: "blocked", reasonCode: "TARGET_PROTECTED" })
    input.entries = [{ id: "unlinked-today", kind: "post-session", date: "2026-10-03", savedAt: "2026-10-03T01:00:00.000Z",
      syncState: "local", title: "", memo: "", system: "base", distanceKm: "", durationMin: "", avgPace: "", rpe: 0,
      activityOutcome: "COMPLETED", activitySlot: "UNSPECIFIED", painCheckStatus: "NO_SIGNAL_REPORTED" } as JournalEntry]
    expect(prepareActivePlanEdit({ ...input, action: "DURATION", source, maximumMinutes: 15 }))
      .toMatchObject({ kind: "blocked", reasonCode: "TARGET_PROTECTED" })
  })

  it("uses the supplied local date and keeps timezone in the receipt and proposal fingerprint", () => {
    const input = fixture()
    const now = "2026-10-02T15:00:00.000Z"
    const kst = prepareActivePlanEdit({ ...input, now, action: "DURATION", source: { day: 3, slot: "AM" }, maximumMinutes: 15,
      today: "2026-10-03", timeZone: "Asia/Seoul" })
    const utc = prepareActivePlanEdit({ ...input, now, action: "DURATION", source: { day: 3, slot: "AM" }, maximumMinutes: 15,
      today: "2026-10-02", timeZone: "UTC" })
    expect(kst.kind).toBe("ready")
    expect(utc.kind).toBe("ready")
    if (kst.kind === "ready" && utc.kind === "ready") {
      expect(kst.proposal.after.activePlanEdit?.timeZone).toBe("Asia/Seoul")
      expect(utc.proposal.after.activePlanEdit?.timeZone).toBe("UTC")
      expect(kst.proposal.after.activePlanEdit?.protectedSlots).toContainEqual({ day: 1, slot: "AM" })
      expect(utc.proposal.after.activePlanEdit?.protectedSlots).toContainEqual({ day: 1, slot: "AM" })
      expect(kst.proposal.after.activePlanEdit?.protectedSlots).not.toContainEqual(source)
      expect(kst.proposal.after.activePlan.sessions[0]).toEqual(input.state.activePlan.sessions[0])
      expect(kst.proposal.baseStateFingerprint).not.toBe(utc.proposal.baseStateFingerprint)
    }
  })

  it("protects an actual-date workout even when its plan link points to another date", () => {
    const input = fixture()
    const linked = input.state.activePlan.sessions.find(session => session.day === 7)!
    const link = createPlannedSessionLogDraft(input.state, linked, input.now)!.link
    input.entries = [{ id: "different-linked-day", kind: "post-session", date: "2026-10-03", savedAt: input.now,
      syncState: "local", title: "", memo: "", system: "base", distanceKm: "", durationMin: "", avgPace: "", rpe: 0,
      activityOutcome: "COMPLETED", activitySlot: "AM", painCheckStatus: "NO_SIGNAL_REPORTED", plannedSessionLink: link } as JournalEntry]
    expect(prepareActivePlanEdit({ ...input, action: "DURATION", source, maximumMinutes: 15 }))
      .toMatchObject({ kind: "blocked", reasonCode: "TARGET_PROTECTED" })
  })

  it("rebinds an actual generated catalog workout and rejects a changed calculation receipt", () => {
    const generated = generatePlanFromDraft({ eventGroup: "FIVE_K", eventDistanceM: 5000, competitionDivision: "OPEN",
      experienceBand: "EXPERIENCED", availableDayCount: 5, requestedFrameLength: 9, trainingFocus: "LT_INTENT",
      secondSessionMode: "SINGLE_SESSION_ONLY", trainingTimePreference: "VARIES", selectedDetailedTemplateRef: null,
      startDate: "2026-10-01" }, "NO_KNOWN_RISK")
    expect(generated.kind).toBe("generated")
    if (generated.kind !== "generated") throw Error(generated.kind)
    const selected = selectPlanForActivation(generated.generated.candidates[0].candidateId, generated.generated,
      generated.gate, { ...generated.intake, startDate: "2026-10-01" }, generated.athleteEvidence)
    if (selected.kind !== "selected" || selected.state.version !== 3) throw Error("V3 required")
    const state = selected.state
    const old = state.activePlan.sessions.find(session => session.role === "QUALITY")!
    if (old.prescription.kind !== "RPE_TIME_RANGE" || !old.prescription.catalogWorkout) throw Error("Catalog RPE required")
    const currentCatalogId = old.prescription.catalogWorkout.catalogId
    const current = ALL_WORKOUT_CATALOG.find(entry => entry.id === currentCatalogId)!
    const inputs = { eventDistanceM: 5000, experience: "EXPERIENCED" as const,
      availableSeconds: null, confirmedRequirements: [], fiveK: null, segmentPaces: [] }
    const replacement = ALL_WORKOUT_CATALOG
      .filter(entry => entry.family === catalogFamilyForIntent(old.plannedEnergyIntent)
        && entry.id !== current.id && catalogMethodIdentity(entry) !== catalogMethodIdentity(current))
      .map(entry => bindCatalogSession(old, entry.id, inputs, true))
      .find(candidate => candidate?.prescription.kind === "RPE_TIME_RANGE") ?? null
    expect(replacement).not.toBeNull()
    if (!replacement || replacement.prescription.kind !== "RPE_TIME_RANGE") throw Error("RPE required")
    expect(replacement.prescription.catalogWorkout?.catalogId).not.toBe(current.id)
    const acceptedRpeMaximum = replacement.prescription.rpe.maximum > old.prescription.rpe.maximum ? replacement.prescription.rpe.maximum : null
    const result = prepareActivePlanEdit({ ...fixture(), state, action: "CATALOG", source: { day: old.day, slot: old.slot },
      replacement, acceptedRpeMaximum, acceptedLongerDuration: activePlanEditDurationConsentRequired(old, replacement) })
    expect(result.kind, result.kind === "blocked" ? result.reasonCode : "").toBe("ready")
    if (result.kind !== "ready") throw Error(result.reasonCode)
    expect(result.proposal.after.activePlan.sessions.find(session => session.day === old.day && session.slot === old.slot)).toEqual(replacement)
    expect(planBetaStateV3Schema.safeParse(result.proposal.after).success).toBe(true)
    const forged = structuredClone(result.proposal.after)
    const receiptSession = forged.activePlanEdit!.replacement!
    if (receiptSession.prescription.kind !== "RPE_TIME_RANGE") throw Error("RPE required")
    receiptSession.prescription.durationMinutes.maximum += 1
    expect(planBetaStateV3Schema.safeParse(forged).success).toBe(false)
  })
})
