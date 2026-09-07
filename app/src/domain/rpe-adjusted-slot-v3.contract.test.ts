import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { createAdjustmentDraftV3, applyAdjustmentDraftV3 } from "@impl/prescription/prescription-adjustment-v3"
import { sequenceV3ContentIdentity } from "@impl/prescription/sequence-v3-comparison"
import { generatePlanFromDraft, selectPlanForActivation, generateMultiAdjustedNextFrameV3FromDraft } from "./plan-beta-flow"
import { prepareMultiAdjustedNextFrameV3 } from "./adjusted-plan-continuity"
import { draftFor, RUNTIME_CASES, TODAY } from "./prescription-quality-matrix.test-fixtures"
import { setActiveLocalAccount } from "./account/local-journal-ownership"
import { unanchoredAdjustmentFixtureV3 } from "./unanchored-adjustment-v3.test-fixtures"
import { prepareUnanchoredAdjustmentOfferV3 } from "./unanchored-adjustment-offer-v3"
import { createAdjustedMethodSnapshotV3 } from "./adjusted-method-snapshot-v3"
import { resolveQualityCandidateScope } from "./adjusted-plan-candidate"
import { prepareRpeAdjustedSlotV3, rpeSourceBindingScopeV3, type RpeAdjustedSlotInputV3 } from "./rpe-adjusted-slot-v3"
import { prepareMultiAdjustedPlanCandidateV3 } from "./adjusted-plan-multi-candidate-v3"
import { multiAdjustedPlanReviewScopeV3, checkMultiAdjustedPlanReviewV3 } from "./adjusted-plan-multi-review-v3"
import { selectMultiAdjustedPlanV3, readSelectedMultiAdjustedPlanV3, selectMultiAdjustedPlanSuccessorV3 } from "./selected-multi-adjusted-plan-v3"
import { canonicalJsonFingerprint } from "@impl/plan-generator/candidate-identity"
import { saveSelectedMultiAdjustedPlanV6, readStoredMultiAdjustedPlanV6 } from "./adjusted-plan-storage-v6"
import { activePlanBetaStorageKey, savePlanBetaState, readPlanBetaStateFromStorage } from "./plan-beta-store"
import { saveMultiAdjustedPlanProgressV3 } from "./adjusted-plan-progress"
import type { PlanMutationLockManager } from "./plan-mutation-lock"
import { retainMultiAdjustedOriginalPlanV3, readMultiAdjustedOriginalPlansV3 } from "./multi-adjusted-plan-archive-v3"
import { createPlannedSessionLogDraft } from "./planned-session-link"
import { readJournalOriginalPlan } from "./journal-original-plan"
import { saveEntry, loadEntries } from "./journal-store"
import { MEMO_PURPOSE, type PostSessionEntry } from "./journal-schema"
import React from "react"
import { render, screen, cleanup, act, fireEvent, within } from "@testing-library/react"
import { AdjustedPrescriptionV3 } from "../screens/plan-beta/AdjustedPrescriptionV3"
import { PlanBeta } from "../screens/PlanBeta"
import * as mutationLocks from "./plan-mutation-lock"
import { exportMultiAdjustedPlanBackupV3, readMultiAdjustedPlanBackupV3, importMultiAdjustedPlanHistoryV3 } from "./multi-adjusted-plan-backup-v3"
import { AdjustedPlanImport } from "../screens/plan-beta/AdjustedPlanImport"
import { saveSelectedMultiAdjustedSuccessorV3 } from "./multi-adjusted-plan-successor-v3"
import { MultiAdjustedPlanApplyReviewV3 } from "../screens/plan-beta/MultiAdjustedPlanApplyReviewV3"
import { MultiAdjustedPlanEditFlowV3 } from "../screens/plan-beta/MultiAdjustedPlanEditFlowV3"
import { stageMultiAdjustmentV3 } from "./stage-multi-adjustment-v3"
import { matchingMultiAdjustmentEntryV3 } from "../screens/plan-beta/multi-adjustment-entry-v3"
import { backupMultiPlanSnapshotV3, loadLatestMultiPlanSnapshotV3, restoreMultiPlanServerHistoryV3 } from "./account/multi-plan-cloud-backup-v3"

const dialogShow = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "showModal")
const dialogClose = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "close")
beforeEach(() => {
  localStorage.clear(); sessionStorage.clear(); setActiveLocalAccount(null); vi.useFakeTimers(); vi.setSystemTime(TODAY)
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true, value() { this.setAttribute("open", "") } })
  Object.defineProperty(HTMLDialogElement.prototype, "close", { configurable: true, value() { this.removeAttribute("open") } })
})
afterEach(() => {
  cleanup(); vi.restoreAllMocks(); vi.useRealTimers()
  for (const [key, descriptor] of [["showModal", dialogShow], ["close", dialogClose]] as const) {
    if (descriptor) Object.defineProperty(HTMLDialogElement.prototype, key, descriptor)
    else Reflect.deleteProperty(HTMLDialogElement.prototype, key)
  }
})
function fixture(supplied?: Extract<ReturnType<typeof generatePlanFromDraft>, { kind: "generated" }>, at = TODAY, startDate = "2026-09-08", includeSets = false) {
  const intake = { ...draftFor(RUNTIME_CASES[3]), selectedDetailedTemplateRef: null }
  const generated = supplied ?? generatePlanFromDraft(intake, "NO_KNOWN_RISK", {})
  if (generated.kind !== "generated") throw Error("No generated candidate")
  const candidate = generated.generated.candidates[0], source = unanchoredAdjustmentFixtureV3(false, at.getTime(), includeSets)
  const offer = prepareUnanchoredAdjustmentOfferV3(source)
  if (offer.kind !== "available") throw Error(offer.code)
  const draft = createAdjustmentDraftV3({ authority: offer.authority, current: offer.current, policy: offer.policy,
    target: offer.targets[0]!, contextKey: offer.contextKey, nowMs: source.nowMs })
  if (draft.kind !== "draft") throw Error(draft.code)
  const applied = applyAdjustmentDraftV3({ authority: offer.authority, current: offer.current, draft: draft.draft,
    contextKey: offer.contextKey, nowMs: source.nowMs, action: "USER_EXPLICIT" })
  if (applied.kind !== "applied") throw Error(applied.code)
  const explanation = { configuration: applied.prescription.configuration, resolutionContextKey: offer.contextKey,
    version: "1", reviewRef: "TEST_NOT_APPROVAL", purpose: "test", energySupply: "test", workRationale: "test",
    recoveryRationale: "test", cycleRole: "test", expectedAdaptation: "test", limitations: "test", observation: "test",
    evidenceRefs: ["TEST"], sequenceContentIdentity: sequenceV3ContentIdentity(applied.prescription.sequence), nodeIds: ["work"] }
  const inputs: RpeAdjustedSlotInputV3[] = candidate.sessions.filter(s => s.role === "QUALITY").map(session => {
    const address = { day: session.day, slot: session.slot }
    const scope = resolveQualityCandidateScope(candidate, address, startDate)!
    const snapshot = createAdjustedMethodSnapshotV3({ authority: offer.authority, current: offer.current, receipt: applied.receipt,
      contextKey: offer.contextKey, nowMs: source.nowMs, scope, explanation })
    if (snapshot.kind !== "prepared") throw Error(snapshot.code)
    return { candidate, address, startDate, source, explanation, rawSnapshot: JSON.stringify(snapshot.snapshot), experienceBand: intake.experienceBand }
  })
  const scopes = inputs.map(input => {
    const result = rpeSourceBindingScopeV3(input)
    if (result.kind !== "scope") throw Error(result.code)
    return result.scopeFingerprint
  })
  const bindings = [...new Set(scopes)].map((scopeFingerprint, i) => ({ bindingId: `TEST-${i}`, version: "1",
    scopeFingerprint, reviewRef: "TEST_NOT_APPROVAL", validFromMs: source.nowMs - 50, expiresAtMs: source.nowMs + 50, revokedAtMs: null }))
  return { inputs, bindings, generated }
}

it("connects every real generated RPE MAIN to independently scoped detailed content without any athlete record", () => {
  const { inputs, bindings } = fixture()
  expect(inputs.length).toBeGreaterThanOrEqual(2)
  const result = prepareMultiAdjustedPlanCandidateV3(inputs, bindings)
  if (result.kind !== "prepared") throw Error(result.code)
  expect(result.candidate.changedSlots).toHaveLength(inputs.length)
  expect(result.candidate.sessions.filter(s => s.prescription.kind === "ADJUSTED_METHOD_V3")).toHaveLength(inputs.length)
  expect(prepareMultiAdjustedPlanCandidateV3([...inputs].reverse(), bindings)).toEqual(result)
  for (const session of result.candidate.sessions) {
    if (session.prescription.kind !== "ADJUSTED_METHOD_V3") continue
    expect(session.prescription.projection).toMatchObject({ recordBasis: "NOT_USED", segmentTargets: [],
      originalPrescription: { kind: "RPE_TIME_RANGE" }, structuralTotals: { main: { workSeconds: 120, recoverySeconds: 120 } } })
  }
  expect(result.candidate.selectionAuthority).toBe("NONE")
})

function storageFixture(supplied?: Extract<ReturnType<typeof generatePlanFromDraft>, { kind: "generated" }>, at = TODAY, startDate = "2026-09-08", includeSets = false) {
  const { inputs, bindings, generated } = fixture(supplied, at, startDate, includeSets)
  const scope = multiAdjustedPlanReviewScopeV3(inputs, inputs[0]!.experienceBand, bindings)
  if (scope.kind !== "scope") throw Error(scope.code)
  const policy = { scopeVersion: "MULTI_STRUCTURAL_V3" as const, policyId: "TEST", version: "1", scopeFingerprint: scope.scopeFingerprint,
    configurationReviewRef: "TEST-C", exposureReviewRef: "TEST-E", interactionReviewRef: "TEST-I", safetyReviewRef: "TEST-S",
    validFromMs: at.getTime() - 50, expiresAtMs: at.getTime() + 50, revokedAtMs: null }
  const request = { action: "USER_EXPLICIT" as const, preparations: inputs, generated: generated.generated, gate: generated.gate,
    intake: generated.intake, athleteEvidence: generated.athleteEvidence, currentCheck: "NO_KNOWN_RISK" as const,
    expectedCandidateFingerprint: scope.candidate.contentFingerprint }
  const retained = [{ slots: inputs.map(i => ({ address: i.address, authority: i.source.authority, explanation: i.explanation })),
    rpeBindings: bindings, policies: [policy] }]
  const locks: PlanMutationLockManager = { request: async (_n, _o, callback) => callback({}) }
  return { request, locks, isCurrentDraft: () => true,
    readReview: () => ({ preparations: inputs, rpeBindings: bindings, policies: [policy], retained }) }
}

it("routes only the exact generated candidate and every matching MAIN into the multi editor", () => {
  const input = storageFixture()
  const entry = { seed: input.request, readReview: input.readReview, locks: input.locks, readReviewForEdits: input.readReview }
  const context = { generated: input.request.generated, gate: input.request.gate, intake: input.request.intake,
    athleteEvidence: input.request.athleteEvidence, currentCheck: input.request.currentCheck,
    candidateId: input.request.preparations[0]!.candidate.candidateId, startDate: "2026-09-08" }
  const match = (value = entry, requested = context) => matchingMultiAdjustmentEntryV3(() => value, requested)
  expect(match()).toBe(entry)
  expect(match(entry, { ...context, candidateId: "UNKNOWN" })).toBeNull()
  expect(match(entry, { ...context, startDate: "2026-09-09" })).toBeNull()
  expect(match({ ...entry, seed: { ...entry.seed, preparations: [] } })).toBeNull()
  expect(match({ ...entry, seed: { ...entry.seed, preparations: entry.seed.preparations.map((p, i) =>
    i === 1 ? { ...p, startDate: "2026-09-09" } : p) } })).toBeNull()
  const altered = { ...entry.seed, preparations: entry.seed.preparations.map((p, i) =>
    i === 1 ? { ...p, candidate: { ...p.candidate, candidateId: "OTHER" } } : p) }
  expect(match({ ...entry, seed: altered })).toBeNull()
  expect(matchingMultiAdjustmentEntryV3(() => { throw Error("UNAVAILABLE") }, context)).toBeNull()
  expect(matchingMultiAdjustmentEntryV3(undefined, context)).toBeNull()
  expect(localStorage.getItem(activePlanBetaStorageKey())).toBeNull()
})

it.each(["saved", "wrong-session", "account-during-auth", "account-after-send", "write-error", "missing-evidence"])("backs up only the owned validated multi snapshot: %s", async scenario => {
  setActiveLocalAccount("cloud-owner")
  const input = storageFixture(), saved = await saveSelectedMultiAdjustedPlanV6(input)
  if (saved.kind !== "saved") throw Error("Missing saved plan")
  const sent = vi.fn(async () => {
    if (scenario === "account-after-send") setActiveLocalAccount("other-owner")
    return { error: scenario === "write-error" ? { message: "test" } : null }
  })
  type Client = NonNullable<Awaited<ReturnType<NonNullable<Parameters<typeof backupMultiPlanSnapshotV3>[2]>["client"]>>>
  const client = { auth: { getSession: async () => {
    if (scenario === "account-during-auth") setActiveLocalAccount("other-owner")
    return { data: { session: { user: { id: scenario === "wrong-session" ? "other-owner" : "cloud-owner" } } }, error: null }
  } }, from: () => ({ upsert: sent }) } as unknown as Client
  const result = await backupMultiPlanSnapshotV3(saved.state.contentFingerprint,
    () => scenario === "missing-evidence" ? [] : input.readReview().retained,
    { enabled: () => true, client: async () => client })
  if (["wrong-session", "account-during-auth", "missing-evidence"].includes(scenario)) {
    expect(result.kind).toBe("unavailable"); expect(sent).not.toHaveBeenCalled()
  } else {
    expect(sent).toHaveBeenCalledOnce()
    expect(result.kind).toBe(scenario === "saved" ? "saved" : scenario === "write-error" ? "failed" : "stale_response")
    expect(sent).toHaveBeenCalledWith({ user_id: "cloud-owner", plan_id: `multi-v6:${saved.state.contentFingerprint}`,
      schema_version: 6, plan_payload: saved.state, saved_at: saved.state.updatedAt },
    { onConflict: "user_id,plan_id", ignoreDuplicates: true })
  }
})

it.each(["read", "wrong-owner", "wrong-id", "changed-payload", "changed-time", "changed-account", "missing-evidence"])("validates private cloud reads without restoring: %s", async scenario => {
  setActiveLocalAccount("cloud-owner")
  const input = storageFixture(), saved = await saveSelectedMultiAdjustedPlanV6(input)
  if (saved.kind !== "saved") throw Error("Missing saved plan")
  const before = localStorage.getItem(activePlanBetaStorageKey())
  const payload = structuredClone(saved.state)
  if (scenario === "changed-payload") payload.progress.push({ sessionDay: 999, sessionSlot: "AM", state: "COMPLETED" })
  const row = { user_id: scenario === "wrong-owner" ? "other" : "cloud-owner", schema_version: 6,
    plan_id: scenario === "wrong-id" ? "multi-v6:wrong" : `multi-v6:${saved.state.contentFingerprint}`,
    plan_payload: payload, saved_at: scenario === "changed-time" ? "2020-01-01T00:00:00Z" : saved.state.updatedAt }
  const eq = vi.fn(() => query), order = vi.fn(() => query)
  const query = { select: () => query, eq, is: () => query, order, limit: () => query,
    maybeSingle: async () => {
      if (scenario === "changed-account") setActiveLocalAccount("other")
      return { data: row, error: null }
    } }
  type Client = NonNullable<Awaited<ReturnType<NonNullable<Parameters<typeof loadLatestMultiPlanSnapshotV3>[1]>["client"]>>>
  const client = { auth: { getSession: async () => ({ data: { session: { user: { id: "cloud-owner" } } }, error: null }) },
    from: () => query } as unknown as Client
  const result = await loadLatestMultiPlanSnapshotV3(() => scenario === "missing-evidence" ? [] : input.readReview().retained,
    { enabled: () => true, client: async () => client })
  expect(result.kind).toBe(scenario === "read" ? "read_only" : scenario === "changed-account" ? "stale_response" : "invalid")
  expect(eq).toHaveBeenCalledWith("user_id", "cloud-owner")
  expect(eq).toHaveBeenCalledWith("schema_version", 6)
  if (result.kind === "read_only") expect(result).toMatchObject({ state: saved.state, executionAuthority: "NONE", storageState: "NOT_RESTORED" })
  setActiveLocalAccount("cloud-owner")
  expect(localStorage.getItem(activePlanBetaStorageKey())).toBe(before)
})

it("requires confirmation and the same owner to restore server history without replacing the active schedule", async () => {
  setActiveLocalAccount("cloud-owner")
  const f = storageFixture(), saved = await saveSelectedMultiAdjustedPlanV6(f)
  if (saved.kind !== "saved") throw Error("Missing initial plan")
  const before = localStorage.getItem(activePlanBetaStorageKey())
  const snapshot = { kind: "read_only" as const, ownerId: "cloud-owner", state: saved.state,
    executionAuthority: "NONE" as const, storageState: "NOT_RESTORED" as const }
  const input = { snapshot, confirmsRestore: false, isCurrentRequest: () => true,
    readEvidence: () => f.readReview().retained, locks: f.locks }
  expect(await restoreMultiPlanServerHistoryV3(input)).toMatchObject({ code: "OWNER_RESTORE_CONFIRMATION_REQUIRED" })
  expect(await restoreMultiPlanServerHistoryV3({ ...input, confirmsRestore: true })).toMatchObject({ kind: "restored_history", added: 1, activePlanChanged: false })
  expect(localStorage.getItem(activePlanBetaStorageKey())).toBe(before)
  expect(readMultiAdjustedOriginalPlansV3(f.readReview().retained)).toMatchObject({ kind: "loaded", entries: [{ state: saved.state }] })
  expect(await restoreMultiPlanServerHistoryV3({ ...input, confirmsRestore: true })).toMatchObject({ kind: "restored_history", added: 0 })
  setActiveLocalAccount("other-owner")
  expect(await restoreMultiPlanServerHistoryV3({ ...input, confirmsRestore: true })).toMatchObject({ code: "OWNER_RESTORE_CONFIRMATION_REQUIRED" })
})

it("writes and independently reads a real multi-slot V6 plan, replaying the same unprogressed selection", async () => {
  const input = storageFixture(), result = await saveSelectedMultiAdjustedPlanV6(input)
  expect(result).toMatchObject({ kind: "saved", replayed: false })
  const raw = localStorage.getItem(activePlanBetaStorageKey())!
  expect(readStoredMultiAdjustedPlanV6(JSON.parse(raw), input.readReview().retained, TODAY)).toMatchObject({ kind: "loaded", executionAuthority: "NONE" })
  expect(readStoredMultiAdjustedPlanV6(JSON.parse(raw), [], TODAY).kind).toBe("invalid")
  expect(await saveSelectedMultiAdjustedPlanV6(input)).toMatchObject({ kind: "saved", replayed: true })
  expect(localStorage.getItem(activePlanBetaStorageKey())).toBe(raw)
  const original = selectPlanForActivation(input.request.preparations[0]!.candidate.candidateId, input.request.generated,
    input.request.gate, { ...input.request.intake, startDate: input.request.preparations[0]!.startDate }, input.request.athleteEvidence, TODAY)
  if (original.kind !== "selected") throw Error("Original selection failed")
  expect(savePlanBetaState(original.state).ok).toBe(false)
  expect(localStorage.getItem(activePlanBetaStorageKey())).toBe(raw)
})

it("reads through the shared account store and records each adjusted MAIN independently without changing the prescription", async () => {
  const input = storageFixture(), saved = await saveSelectedMultiAdjustedPlanV6(input)
  if (saved.kind !== "saved") throw Error("Initial save failed")
  const retained = input.readReview().retained
  const read = () => readPlanBetaStateFromStorage([], [], retained)
  expect(read()).toMatchObject({ kind: "multi_adjusted_v3_loaded", state: saved.state })
  expect(readPlanBetaStateFromStorage().kind).toBe("invalid")
  const slots = saved.state.selection.activePlan.sessions.filter(s => s.prescription.kind === "ADJUSTED_METHOD_V3")
  expect(slots.length).toBeGreaterThan(1)
  let fingerprint = saved.state.contentFingerprint
  for (const [index, slot] of slots.entries()) {
    const result = await saveMultiAdjustedPlanProgressV3({ expectedFingerprint: fingerprint, retained, locks: input.locks,
      progress: { sessionDay: slot.day, sessionSlot: slot.slot, state: index === 0 ? "COMPLETED" : "PAIN_CHECKIN" } })
    if (result.kind !== "saved") throw Error(result.code)
    expect(result.state.selection).toEqual(saved.state.selection)
    expect(result.state.progress).toHaveLength(index + 1)
    fingerprint = result.state.contentFingerprint
  }
  const pain = slots[1]!
  expect(await saveMultiAdjustedPlanProgressV3({ expectedFingerprint: fingerprint, retained, locks: input.locks,
    progress: { sessionDay: pain.day, sessionSlot: pain.slot, state: "RESTED" } })).toMatchObject({ code: "PAIN_REVIEW_REQUIRED" })
  expect(await saveMultiAdjustedPlanProgressV3({ expectedFingerprint: saved.state.contentFingerprint, retained, locks: input.locks,
    progress: { sessionDay: slots[0]!.day, sessionSlot: slots[0]!.slot, state: "SKIPPED" } })).toMatchObject({ code: "STALE_BASE" })
  expect(read()).toMatchObject({ kind: "multi_adjusted_v3_loaded", state: { contentFingerprint: fingerprint } })
  setActiveLocalAccount("another-account")
  expect(read().kind).toBe("missing")
})

it("retains a multi-plan journal original and reads the exact slot after the active plan is gone without reading memo", async () => {
  setActiveLocalAccount("journal-owner")
  const input = storageFixture(), saved = await saveSelectedMultiAdjustedPlanV6(input)
  if (saved.kind !== "saved") throw Error("Initial save failed")
  const retained = input.readReview().retained
  const slot = saved.state.selection.activePlan.sessions.find(s => s.prescription.kind === "ADJUSTED_METHOD_V3")!
  const draft = createPlannedSessionLogDraft(saved.state.selection, slot, TODAY.toISOString())!
  expect(await retainMultiAdjustedOriginalPlanV3(saved.state.contentFingerprint, { retained, locks: input.locks })).toEqual({ kind: "retained" })
  expect(await retainMultiAdjustedOriginalPlanV3(saved.state.contentFingerprint, { retained, locks: input.locks })).toEqual({ kind: "retained" })
  expect(readMultiAdjustedOriginalPlansV3(retained, TODAY)).toMatchObject({ kind: "loaded", entries: [{ state: saved.state }] })
  const entry: PostSessionEntry = { id: "synthetic-multi-journal", kind: "post-session", date: draft.date,
    savedAt: TODAY.toISOString(), syncState: "local", activitySlot: slot.slot, plannedSessionLink: draft.link,
    system: "", title: "", memo: "PRIVATE-NOTE", memoPurpose: MEMO_PURPOSE.analyzableTrainingNote,
    distanceKm: "", durationMin: "", avgPace: "", rpe: 0 }
  expect(saveEntry(entry).ok).toBe(true)
  const loaded = loadEntries().find(e => e.id === entry.id)!
  if (loaded.kind !== "post-session") throw Error("Wrong journal kind")
  const getter = vi.fn(() => "PRIVATE-NOTE")
  Object.defineProperty(loaded, "memo", { enumerable: true, get: getter })
  expect(readJournalOriginalPlan(loaded, [], [], retained)).toMatchObject({ kind: "matched_multi_adjusted_v3", source: "ACTIVE", session: slot })
  localStorage.removeItem(activePlanBetaStorageKey())
  const original = readJournalOriginalPlan(loaded, [], [], retained)
  expect(original).toMatchObject({ kind: "matched_multi_adjusted_v3", source: "ARCHIVED", session: slot })
  expect(getter).not.toHaveBeenCalled()
  if (original.kind !== "matched_multi_adjusted_v3") throw Error("Original missing")
  expect(original.explanation).toEqual(retained[0]!.slots.find(s => s.address.day === slot.day && s.address.slot === slot.slot)!.explanation)
  render(React.createElement(AdjustedPrescriptionV3, { session: original.session, explanation: original.explanation }))
  expect(screen.queryByText("저장 당시 기록으로 계산한 참고 시간")).toBeNull()
  expect(screen.getByText("이 훈련을 하는 이유")).toBeTruthy()
  expect(loaded.distanceKm).toBe("")
  setActiveLocalAccount("another-account")
  expect(readJournalOriginalPlan(loaded, [], [], retained).kind).toBe("unavailable")
})

it("opens the actual multi-plan schedule, records a slot and archives its original before handing off to the journal", async () => {
  const input = storageFixture(), saved = await saveSelectedMultiAdjustedPlanV6(input)
  if (saved.kind !== "saved") throw Error("Initial save failed")
  const retained = input.readReview().retained
  const slot = saved.state.selection.activePlan.sessions.find(s => s.prescription.kind === "ADJUSTED_METHOD_V3")!
  const draft = createPlannedSessionLogDraft(saved.state.selection, slot, TODAY.toISOString())!
  vi.spyOn(mutationLocks, "getPlanMutationLockManager").mockReturnValue(input.locks)
  const onWrite = vi.fn()
  render(React.createElement(PlanBeta, { readMultiAdjustedEvidenceV3: () => retained, returnToSession: draft.link,
    onWritePlannedSessionLog: onWrite }))
  expect(screen.getByRole("heading", { name: "내 훈련 일정" })).toBeTruthy()
  const region = () => within(screen.getByRole("region", { name: `${slot.slot === "AM" ? "오전" : "오후"} 훈련` }))
  await act(async () => { fireEvent.click(region().getByRole("button", { name: "완료" })) })
  const current = readPlanBetaStateFromStorage([], [], retained)
  expect(current).toMatchObject({ kind: "multi_adjusted_v3_loaded", state: { progress: [{ sessionDay: slot.day, sessionSlot: slot.slot, state: "COMPLETED" }] } })
  await act(async () => { fireEvent.click(region().getByRole("button", { name: "이 훈련 일지 쓰기" })) })
  expect(onWrite).toHaveBeenCalledWith(draft)
  expect(readMultiAdjustedOriginalPlansV3(retained, TODAY)).toMatchObject({ kind: "loaded", entries: [{ state: current.kind === "multi_adjusted_v3_loaded" ? current.state : null }] })
})

it("roundtrips a multi-plan backup into history only with explicit confirmation and retains an existing active plan", async () => {
  const input = storageFixture(), saved = await saveSelectedMultiAdjustedPlanV6(input)
  if (saved.kind !== "saved") throw Error("Initial save failed")
  const retained = input.readReview().retained
  const exported = exportMultiAdjustedPlanBackupV3(saved.state.contentFingerprint, retained, TODAY)
  if (exported.kind !== "exported") throw Error("Export failed")
  expect(readMultiAdjustedPlanBackupV3(exported.raw, retained, TODAY)).toMatchObject({ kind: "read_only", active: saved.state, executionAuthority: "NONE" })
  expect(readMultiAdjustedPlanBackupV3(exported.raw, [], TODAY).kind).toBe("invalid")
  const changed = JSON.parse(exported.raw)
  changed.active.selection.activePlan.sessions[0].day = 999
  expect(readMultiAdjustedPlanBackupV3(JSON.stringify(changed), retained, TODAY).kind).toBe("invalid")
  const before = localStorage.getItem(activePlanBetaStorageKey())
  const request = { raw: exported.raw, confirmsOwnFile: false, isCurrentRequest: () => true, readEvidence: () => retained, locks: input.locks }
  expect(await importMultiAdjustedPlanHistoryV3(request)).toMatchObject({ code: "OWN_FILE_CONFIRMATION_REQUIRED" })
  expect(await importMultiAdjustedPlanHistoryV3({ ...request, confirmsOwnFile: true })).toMatchObject({ kind: "restored_history", added: 1, activePlanChanged: false })
  expect(await importMultiAdjustedPlanHistoryV3({ ...request, confirmsOwnFile: true })).toMatchObject({ kind: "restored_history", added: 0, keptExisting: 1 })
  expect(localStorage.getItem(activePlanBetaStorageKey())).toBe(before)
  expect(readMultiAdjustedOriginalPlansV3(retained, TODAY)).toMatchObject({ kind: "loaded", entries: [{ state: saved.state }] })
  render(React.createElement(AdjustedPlanImport, { readMultiEvidenceV3: () => retained, locks: input.locks, onBack: vi.fn() }))
  await act(async () => { fireEvent.change(screen.getByLabelText("개인 보관용 계획 파일"), {
    target: { files: [{ size: exported.raw.length, text: async () => exported.raw }] },
  }) })
  expect(screen.getByRole("button", { name: "과거 원본 보관함에 추가" })).toBeDisabled()
  fireEvent.click(screen.getByRole("checkbox"))
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "과거 원본 보관함에 추가" })) })
  expect(screen.getByRole("status").textContent).toContain("훈련 일정은 바뀌지 않았어요.")
  expect(localStorage.getItem(activePlanBetaStorageKey())).toBe(before)
})

it("prepares the next frame from actual multi-plan history without inventing missing outcomes or writing a successor", async () => {
  const input = storageFixture(), saved = await saveSelectedMultiAdjustedPlanV6(input)
  if (saved.kind !== "saved") throw Error("Initial save failed")
  const retained = input.readReview().retained
  const base = { previous: saved.state, expectedFingerprint: saved.state.contentFingerprint,
    nextStartDate: "2026-09-30", currentCheck: "NO_KNOWN_RISK" as const }
  expect(prepareMultiAdjustedNextFrameV3(base, retained, TODAY)).toMatchObject({ code: "FRAME_NOT_STARTED" })
  expect(prepareMultiAdjustedNextFrameV3(base, retained,
    new Date(`${saved.state.selection.intake.startDate}T12:00:00+09:00`))).toMatchObject({ code: "INCOMPLETE_FRAME" })
  const later = new Date("2026-09-30T12:00:00+09:00")
  vi.setSystemTime(later)
  const prepared = prepareMultiAdjustedNextFrameV3(base, retained, later)
  if (prepared.kind !== "prepared") throw Error(prepared.code)
  expect(prepared.context.missingRequiredOutcomes).toBeGreaterThan(0)
  expect(prepared.context.completionBasis).toBe("DISPLAYED_FRAME_ELAPSED")
  expect(prepared.context.continuity.progressStateCounts.every(c => c.count === 0)).toBe(true)
  expect(prepared.context.periodization.frameOrdinal).toBe(saved.state.selection.periodization.frameOrdinal + 1)
  const before = localStorage.getItem(activePlanBetaStorageKey())
  const next = generateMultiAdjustedNextFrameV3FromDraft({ draft: { ...input.request.intake, startDate: base.nextStartDate },
    currentCheck: "NO_KNOWN_RISK", expectedPredecessorFingerprint: saved.state.contentFingerprint }, retained)
  expect(next).toMatchObject({ kind: "multi_adjusted_next_frame_v3_draft", requiredNextGate: "REVIEWED_MULTI_SUCCESSOR_V3_TRANSACTION" })
  expect(localStorage.getItem(activePlanBetaStorageKey())).toBe(before)
  if (next.kind !== "multi_adjusted_next_frame_v3_draft") throw Error("No next draft")
  const successorInput = storageFixture(next.draft, later, base.nextStartDate), review = successorInput.readReview()
  expect(selectMultiAdjustedPlanV3(successorInput.request, review.rpeBindings, review.policies, later)).toMatchObject({ code: "ADJUSTED_SUCCESSOR_REQUIRES_CONTINUITY_TRANSACTION" })
  const selected = selectMultiAdjustedPlanSuccessorV3(successorInput.request, saved.state, saved.state.contentFingerprint,
    retained, review.rpeBindings, review.policies, later)
  if (selected.kind !== "selected_multi_adjusted") throw Error(selected.code)
  expect(selected.state.continuation?.predecessorFingerprint).toBe(saved.state.contentFingerprint)
  expect(selected.state.periodization.frameOrdinal).toBe(saved.state.selection.periodization.frameOrdinal + 1)
  expect(readSelectedMultiAdjustedPlanV3(selected.state, review.retained[0]!, later)).toMatchObject({ kind: "read_only", state: selected.state })
  expect(selectMultiAdjustedPlanSuccessorV3(successorInput.request, saved.state, "wrong", retained,
    review.rpeBindings, review.policies, later)).toMatchObject({ code: "STALE_BASE" })
  expect(localStorage.getItem(activePlanBetaStorageKey())).toBe(before)
  const slot = saved.state.selection.activePlan.sessions.find(s => s.role === "QUALITY")!
  const pain = await saveMultiAdjustedPlanProgressV3({ expectedFingerprint: saved.state.contentFingerprint,
    progress: { sessionDay: slot.day, sessionSlot: slot.slot, state: "PAIN_CHECKIN" }, retained, locks: input.locks })
  if (pain.kind !== "saved") throw Error(pain.code)
  expect(prepareMultiAdjustedNextFrameV3({ ...base, previous: pain.state, expectedFingerprint: pain.state.contentFingerprint }, retained, later)).toMatchObject({ code: "ACTIVE_HOLD" })
})

async function successorStorageFixture() {
  const first = storageFixture(), previous = await saveSelectedMultiAdjustedPlanV6(first)
  if (previous.kind !== "saved") throw Error("Initial save failed")
  const later = new Date("2026-09-30T12:00:00+09:00")
  vi.setSystemTime(later)
  const generated = generateMultiAdjustedNextFrameV3FromDraft({ draft: { ...first.request.intake, startDate: "2026-09-30" },
    currentCheck: "NO_KNOWN_RISK", expectedPredecessorFingerprint: previous.state.contentFingerprint }, first.readReview().retained)
  if (generated.kind !== "multi_adjusted_next_frame_v3_draft") throw Error("Next generation failed")
  const next = storageFixture(generated.draft, later, "2026-09-30")
  const review = next.readReview(), retained = [...first.readReview().retained, ...review.retained]
  return { previous: previous.state, input: { ...next, expectedPredecessorFingerprint: previous.state.contentFingerprint,
    readReview: () => ({ ...review, retained }) }, retained, later }
}

it("opens the next cycle from the schedule and saves through candidate, multi edit, and final confirmation", async () => {
  const f = await successorStorageFixture(), before = localStorage.getItem(activePlanBetaStorageKey())
  const resolver = vi.fn(() => ({ seed: f.input.request, readReview: f.input.readReview, locks: f.input.locks,
    readReviewForEdits: f.input.readReview }))
  render(React.createElement(PlanBeta, { readMultiAdjustedEvidenceV3: () => f.retained, multiAdjustmentResolverV3: resolver }))
  fireEvent.click(screen.getByRole("button", { name: "다음 훈련 주기 준비" }))
  expect(screen.getByRole("button", { name: "다음 계획 비교하기" })).toBeDisabled()
  fireEvent.click(screen.getByRole("radio", { name: "알고 있는 통증이나 이상이 없어요" }))
  fireEvent.click(screen.getByRole("button", { name: "다음 계획 비교하기" }))
  expect(screen.getByRole("heading", { name: "다음 계획을 비교해 주세요" })).toBeTruthy()
  expect(localStorage.getItem(activePlanBetaStorageKey())).toBe(before)
  fireEvent.click(screen.getAllByRole("button", { name: /구성 확인$/ })[0]!)
  expect(resolver).toHaveBeenCalledOnce()
  expect(screen.getByRole("heading", { name: "주요 훈련을 하나씩 확인해 주세요" })).toBeTruthy()
  fireEvent.click(screen.getByRole("button", { name: "전체 확인으로" }))
  expect(localStorage.getItem(activePlanBetaStorageKey())).toBe(before)
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "이 구성으로 계획 저장" })) })
  expect(screen.getByRole("heading", { name: "내 훈련 일정" })).toBeTruthy()
  const current = readPlanBetaStateFromStorage([], [], f.retained)
  expect(current).toMatchObject({ kind: "multi_adjusted_v3_loaded", state: { selection: {
    continuation: { predecessorFingerprint: f.previous.contentFingerprint } } } })
  expect(localStorage.getItem(activePlanBetaStorageKey())).not.toBe(before)
  expect(readMultiAdjustedOriginalPlansV3(f.retained)).toMatchObject({ kind: "loaded", entries: [{ state: f.previous }] })
})

it.each(["missing-provider", "invalid-provider", "review-required"])("preserves the current schedule when the next UI has %s", async scenario => {
  const f = await successorStorageFixture(), before = localStorage.getItem(activePlanBetaStorageKey())
  render(React.createElement(PlanBeta, { readMultiAdjustedEvidenceV3: () => f.retained,
    multiAdjustmentResolverV3: scenario === "missing-provider" ? undefined : () => null }))
  fireEvent.click(screen.getByRole("button", { name: "다음 훈련 주기 준비" }))
  fireEvent.click(screen.getByRole("radio", { name: scenario === "review-required"
    ? "통증·이상이 있거나 잘 모르겠어요" : "알고 있는 통증이나 이상이 없어요" }))
  fireEvent.click(screen.getByRole("button", { name: "다음 계획 비교하기" }))
  if (scenario === "missing-provider") {
    for (const button of screen.getAllByRole("button", { name: /구성 확인$/ })) expect(button).toBeDisabled()
  } else if (scenario === "invalid-provider") {
    fireEvent.click(screen.getAllByRole("button", { name: /구성 확인$/ })[0]!)
    expect(screen.getByRole("alert")).toHaveTextContent("훈련 구성과 근거를 확인하지 못했어요")
  } else {
    expect(screen.queryByRole("heading", { name: "다음 계획을 비교해 주세요" })).toBeNull()
    expect(screen.getByRole("alert")).toBeTruthy()
  }
  expect(localStorage.getItem(activePlanBetaStorageKey())).toBe(before)
  fireEvent.click(screen.getByRole("button", { name: "현재 일정으로" }))
  expect(screen.getByRole("heading", { name: "내 훈련 일정" })).toBeTruthy()
})

it("archives the actual predecessor before saving a multi-plan successor and preserves both readable originals", async () => {
  const f = await successorStorageFixture()
  const saved = await saveSelectedMultiAdjustedSuccessorV3(f.input)
  if (saved.kind !== "saved") throw Error(saved.code)
  expect(saved.state.selection.continuation?.predecessorFingerprint).toBe(f.previous.contentFingerprint)
  expect(readPlanBetaStateFromStorage([], [], f.retained)).toMatchObject({ kind: "multi_adjusted_v3_loaded", state: saved.state })
  expect(readMultiAdjustedOriginalPlansV3(f.retained)).toMatchObject({ kind: "loaded", entries: [{ state: f.previous }] })
  expect(saved.state.progress).toEqual([])
  expect(await saveSelectedMultiAdjustedSuccessorV3(f.input)).toMatchObject({ code: "STALE_BASE" })
})

it.each(["initial", "successor"])("requires explicit final confirmation in the %s multi-plan review screen", async mode => {
  const successor = mode === "successor" ? await successorStorageFixture() : null
  const input = successor?.input ?? storageFixture()
  const before = localStorage.getItem(activePlanBetaStorageKey()), onSaved = vi.fn(), onCancel = vi.fn()
  const props = { seed: input.request, readReview: input.readReview, locks: input.locks,
    isCurrentDraft: input.isCurrentDraft, onSaved, onCancel,
    expectedPredecessorFingerprint: successor?.previous.contentFingerprint }
  render(React.createElement(MultiAdjustedPlanApplyReviewV3, props))
  expect(screen.getAllByRole("region", { name: "적용할 훈련" })).toHaveLength(input.request.preparations.length)
  expect(localStorage.getItem(activePlanBetaStorageKey())).toBe(before)
  fireEvent.click(screen.getByRole("button", { name: "후보로 돌아가기" }))
  expect(onCancel).toHaveBeenCalledOnce()
  expect(onSaved).not.toHaveBeenCalled()
  expect(localStorage.getItem(activePlanBetaStorageKey())).toBe(before)
  cleanup()
  render(React.createElement(MultiAdjustedPlanApplyReviewV3, props))
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "이 구성으로 계획 저장" })) })
  expect(onSaved).toHaveBeenCalledOnce()
  expect(readPlanBetaStateFromStorage([], [], input.readReview().retained)).toMatchObject({ kind: "multi_adjusted_v3_loaded", state: onSaved.mock.calls[0]![0] })
})

it("changes one MAIN to a structurally different set method and preserves its exact recovery explanation through save", async () => {
  const input = storageFixture(undefined, TODAY, "2026-09-08", true), initialReview = input.readReview()
  let latestReview = initialReview
  const onSaved = vi.fn()
  render(React.createElement(MultiAdjustedPlanEditFlowV3, { seed: input.request, readReview: input.readReview, locks: input.locks,
    readReviewForEdits: (request, changes) => {
      const preparations = request.preparations.map(p => {
        const change = changes.find(c => c.address.day === p.address.day && c.address.slot === p.address.slot)
        if (!change) return p as RpeAdjustedSlotInputV3
        const source = p.source as RpeAdjustedSlotInputV3["source"]
        const offer = prepareUnanchoredAdjustmentOfferV3(source)
        if (offer.kind !== "available") throw Error(offer.code)
        const explanation = { ...p.explanation, configuration: change.receipt.after.configuration,
          version: "TEST-SET-2", recoveryRationale: "시험: 반복 사이 걷기 30초, 세트 사이 정지 120초",
          sequenceContentIdentity: sequenceV3ContentIdentity(change.receipt.after.sequence), nodeIds: ["sets", "work"] }
        const snapshot = createAdjustedMethodSnapshotV3({ authority: offer.authority, current: offer.current,
          receipt: change.receipt, contextKey: offer.contextKey, nowMs: TODAY.getTime(),
          scope: resolveQualityCandidateScope(p.candidate, p.address, p.startDate)!, explanation })
        if (snapshot.kind !== "prepared") throw Error(snapshot.code)
        return { ...p, source, explanation, rawSnapshot: JSON.stringify(snapshot.snapshot) } as RpeAdjustedSlotInputV3
      })
      const rpeBindings = preparations.map((p, i) => {
        const scope = rpeSourceBindingScopeV3(p)
        if (scope.kind !== "scope") throw Error(scope.code)
        return { ...initialReview.rpeBindings[0]!, bindingId: `SET-TEST-${i}`, scopeFingerprint: scope.scopeFingerprint }
      }).filter((binding, i, all) => all.findIndex(b => b.scopeFingerprint === binding.scopeFingerprint) === i)
      const scope = multiAdjustedPlanReviewScopeV3(preparations, preparations[0]!.experienceBand, rpeBindings)
      if (scope.kind !== "scope") throw Error(scope.code)
      const policies = [{ ...initialReview.policies[0]!, scopeFingerprint: scope.scopeFingerprint }]
      latestReview = { preparations, rpeBindings, policies, retained: [{ rpeBindings, policies,
        slots: preparations.map(p => ({ address: p.address, authority: p.source.authority, explanation: p.explanation })) }] }
      return latestReview
    }, isCurrentDraft: () => true, onSaved, onCancel: vi.fn() }))
  fireEvent.click(screen.getAllByRole("button", { name: "이 훈련 구성 바꾸기" })[0]!)
  fireEvent.click(screen.getByRole("radio", { name: "시험용 세트 구성" }))
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "변경안 적용" })) })
  expect(localStorage.getItem(activePlanBetaStorageKey())).toBeNull()
  fireEvent.click(screen.getByRole("button", { name: "전체 확인으로" }))
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "이 구성으로 계획 저장" })) })
  expect(onSaved).toHaveBeenCalledOnce()
  const read = readPlanBetaStateFromStorage([], [], latestReview.retained)
  if (read.kind !== "multi_adjusted_v3_loaded") throw Error("Saved set plan is unreadable")
  const adjusted = read.state.selection.activePlan.sessions.filter(s => s.prescription.kind === "ADJUSTED_METHOD_V3")
  const first = adjusted[0]!.prescription
  if (first.kind !== "ADJUSTED_METHOD_V3") throw Error("Missing first MAIN")
  expect(first.projection.structuralTotals.main).toMatchObject({ workSeconds: 120, recoverySeconds: 180 })
  expect(first.snapshot.receipt.after.configuration.configurationId).toBe("C2")
  for (const other of adjusted.slice(1)) {
    if (other.prescription.kind !== "ADJUSTED_METHOD_V3") throw Error("Missing other MAIN")
    expect(other.prescription.snapshot.receipt.after.configuration.configurationId).toBe("C1")
    expect(other.prescription.projection.structuralTotals.main).toMatchObject({ workSeconds: 120, recoverySeconds: 120 })
  }
  expect(read.explanations[0]!.explanation.recoveryRationale).toBe("시험: 반복 사이 걷기 30초, 세트 사이 정지 120초")
})

it("stages one addressed editor receipt without replacing the other MAIN and saves only after the final screen", async () => {
  const input = storageFixture(), first = input.request.preparations[0]!, snapshot = JSON.parse(first.rawSnapshot)
  const staged = stageMultiAdjustmentV3(input.request, { address: first.address, receipt: snapshot.receipt }, snapshot.receipt.after, input.readReview(), TODAY)
  if (staged.kind !== "staged") throw Error(staged.code)
  expect(staged.request.preparations.slice(1)).toEqual(input.request.preparations.slice(1))
  expect(stageMultiAdjustmentV3(input.request, { address: { day: 999, slot: "AM" }, receipt: snapshot.receipt }, snapshot.receipt.after, input.readReview(), TODAY)).toMatchObject({ code: "INVALID_MULTI_EDIT_ADDRESS" })
  const onSaved = vi.fn()
  render(React.createElement(MultiAdjustedPlanEditFlowV3, { seed: input.request, readReview: input.readReview, locks: input.locks,
    readReviewForEdits: request => ({ ...input.readReview(), preparations: request.preparations }),
    isCurrentDraft: () => true, onSaved, onCancel: vi.fn() }))
  expect(screen.getAllByRole("region", { name: "고른 주요 훈련" })).toHaveLength(input.request.preparations.length)
  fireEvent.click(screen.getAllByRole("button", { name: "이 훈련 구성 바꾸기" })[0]!)
  expect(screen.getByRole("radio", { name: "검토된 다른 구성" })).toBeChecked()
  fireEvent.click(screen.getByRole("radio", { name: "검토된 다른 구성" }))
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "변경안 적용" })) })
  fireEvent.click(screen.getAllByRole("button", { name: "이 훈련 구성 바꾸기" })[0]!)
  expect(screen.getByRole("radio", { name: "검토된 다른 구성" })).toBeChecked()
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "변경안 적용" })) })
  expect(localStorage.getItem(activePlanBetaStorageKey())).toBeNull()
  fireEvent.click(screen.getByRole("button", { name: "전체 확인으로" }))
  expect(onSaved).not.toHaveBeenCalled()
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "이 구성으로 계획 저장" })) })
  expect(onSaved).toHaveBeenCalledOnce()
})

it.each(["archive-expiry", "active-expiry", "active-other-writer"])("rolls back own successor writes for %s", async scenario => {
  const f = await successorStorageFixture(), key = activePlanBetaStorageKey(), before = localStorage.getItem(key)
  const original = Storage.prototype.setItem
  let injected = false
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(function(this: Storage, name, value) {
    original.call(this, name, value)
    const target = scenario === "archive-expiry" ? name.includes("multi-adjusted-plan-originals") : name === key
    if (target && !injected) {
      injected = true
      if (scenario === "active-other-writer") original.call(this, key, "OTHER_WRITER")
      else vi.setSystemTime(new Date(f.later.getTime() + 100))
    }
  })
  expect(await saveSelectedMultiAdjustedSuccessorV3(f.input)).toMatchObject({ code: scenario === "active-other-writer" ? "PLAN_STORAGE_STATE_UNCERTAIN" : "SUCCESSOR_STORAGE_WRITE_FAILED" })
  expect(injected).toBe(true)
  expect(localStorage.getItem(key)).toBe(scenario === "active-other-writer" ? "OTHER_WRITER" : before)
  expect(readMultiAdjustedOriginalPlansV3(f.retained)).toMatchObject({ kind: "loaded", entries: [] })
})

it.each(["expiry", "other-writer"])("handles %s during a real multi-plan write without overwriting another writer", async change => {
  const input = storageFixture(), original = Storage.prototype.setItem, key = activePlanBetaStorageKey()
  let injected = false
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(function(this: Storage, name, value) {
    original.call(this, name, value)
    if (name === key && !injected) {
      injected = true
      if (change === "expiry") vi.setSystemTime(new Date(TODAY.getTime() + 100))
      else original.call(this, key, "OTHER_WRITER")
    }
  })
  const result = await saveSelectedMultiAdjustedPlanV6(input)
  expect(injected).toBe(true)
  expect(result).toMatchObject({ code: change === "expiry" ? "PLAN_STORAGE_WRITE_FAILED" : "PLAN_STORAGE_STATE_UNCERTAIN" })
  expect(localStorage.getItem(key)).toBe(change === "expiry" ? null : "OTHER_WRITER")
})

it("rejects account changes while waiting for the multi-plan lock", async () => {
  const input = storageFixture(), key = activePlanBetaStorageKey()
  expect(await saveSelectedMultiAdjustedPlanV6({ ...input, locks: { request: async (_n, _o, callback) => {
    setActiveLocalAccount("other"); return callback({})
  } } })).toMatchObject({ code: "STALE_CANDIDATE_SELECTION" })
  expect(localStorage.getItem(key)).toBeNull()
  expect(localStorage.getItem(activePlanBetaStorageKey())).toBeNull()
})
it("requires a matching binding review and rejects expiration, relocation and changed experience", () => {
  const { inputs, bindings } = fixture(), input = inputs[0]!
  expect(prepareRpeAdjustedSlotV3(input)).toMatchObject({ kind: "unavailable", code: "RPE_SOURCE_BINDING_REVIEW_REQUIRED" })
  expect(prepareRpeAdjustedSlotV3(input, bindings.map(b => ({ ...b, expiresAtMs: 149 }))).kind).toBe("unavailable")
  expect(prepareRpeAdjustedSlotV3({ ...input, rawSnapshot: inputs[1]!.rawSnapshot }, bindings).kind).toBe("unavailable")
  expect(prepareRpeAdjustedSlotV3({ ...input, experienceBand: "NEW_TO_RUNNING" }, bindings).kind).toBe("unavailable")
  expect(prepareMultiAdjustedPlanCandidateV3([input, input], bindings)).toMatchObject({ code: "DUPLICATE_ADJUSTED_SLOT" })
})

it("requires a separate exact whole-plan review even when all individual bindings are accepted", () => {
  const { inputs, bindings } = fixture(), experience = inputs[0]!.experienceBand
  const scope = multiAdjustedPlanReviewScopeV3(inputs, experience, bindings)
  if (scope.kind !== "scope") throw Error(scope.code)
  expect(checkMultiAdjustedPlanReviewV3(inputs, experience, bindings)).toMatchObject({ code: "MULTI_PLAN_CONFIGURATION_REVIEW_REQUIRED" })
  const policy = { scopeVersion: "MULTI_STRUCTURAL_V3" as const, policyId: "TEST", version: "1", scopeFingerprint: scope.scopeFingerprint,
    configurationReviewRef: "TEST-C", exposureReviewRef: "TEST-E", interactionReviewRef: "TEST-I", safetyReviewRef: "TEST-S",
    validFromMs: TODAY.getTime() - 50, expiresAtMs: TODAY.getTime() + 50, revokedAtMs: null }
  const result = checkMultiAdjustedPlanReviewV3(inputs, experience, bindings, [policy])
  expect(result).toMatchObject({ kind: "reviewed_scope", executionAuthority: "NONE" })
  expect(checkMultiAdjustedPlanReviewV3([...inputs].reverse(), experience, bindings, [policy])).toEqual(result)
  expect(checkMultiAdjustedPlanReviewV3(inputs.slice(0, 1), experience, bindings, [policy]).kind).toBe("unavailable")
  expect(checkMultiAdjustedPlanReviewV3(inputs, experience, bindings, [{ ...policy, revokedAtMs: 140 }]).kind).toBe("unavailable")
  expect(checkMultiAdjustedPlanReviewV3(inputs, experience, bindings, [policy, policy])).toMatchObject({ code: "AMBIGUOUS_MULTI_PLAN_REVIEW" })
  expect(checkMultiAdjustedPlanReviewV3(inputs, "NEW_TO_RUNNING", bindings, [policy])).toMatchObject({ code: "SOURCE_EXPERIENCE_MISMATCH" })
})

it("selects a real multi-slot candidate only after explicit action and current whole-plan review, without writing", () => {
  const { inputs, bindings, generated } = fixture()
  const scope = multiAdjustedPlanReviewScopeV3(inputs, inputs[0]!.experienceBand, bindings)
  if (scope.kind !== "scope") throw Error(scope.code)
  const policy = { scopeVersion: "MULTI_STRUCTURAL_V3" as const, policyId: "TEST", version: "1", scopeFingerprint: scope.scopeFingerprint,
    configurationReviewRef: "TEST-C", exposureReviewRef: "TEST-E", interactionReviewRef: "TEST-I", safetyReviewRef: "TEST-S",
    validFromMs: TODAY.getTime() - 50, expiresAtMs: TODAY.getTime() + 50, revokedAtMs: null }
  const request = { action: "USER_EXPLICIT" as const, preparations: inputs, generated: generated.generated, gate: generated.gate,
    intake: generated.intake, athleteEvidence: generated.athleteEvidence, currentCheck: "NO_KNOWN_RISK" as const,
    expectedCandidateFingerprint: scope.candidate.contentFingerprint }
  const write = vi.spyOn(Storage.prototype, "setItem")
  const before = { ...localStorage }
  const result = selectMultiAdjustedPlanV3(request, bindings, [policy], TODAY)
  expect(result).toMatchObject({ kind: "selected_multi_adjusted", storageState: "NOT_SAVED" })
  expect(write.mock.calls.every(([key]) => key === "__to_probe__")).toBe(true)
  expect({ ...localStorage }).toEqual(before)
  expect(selectMultiAdjustedPlanV3({ ...request, currentCheck: "REVIEW_REQUIRED" }, bindings, [policy], TODAY).kind).not.toBe("selected_multi_adjusted")
  expect(selectMultiAdjustedPlanV3({ ...request, expectedCandidateFingerprint: "changed" }, bindings, [policy], TODAY)).toMatchObject({ code: "ADJUSTED_SELECTION_CHANGED" })
  expect(selectMultiAdjustedPlanV3(request, bindings, [policy], new Date(TODAY.getTime() + 100)).kind).not.toBe("selected_multi_adjusted")
  if (result.kind !== "selected_multi_adjusted") throw Error(result.code)
  const evidence = { slots: inputs.map(i => ({ address: i.address, authority: i.source.authority, explanation: i.explanation })),
    rpeBindings: bindings, policies: [policy] }
  const future = new Date(TODAY.getTime() + 1000)
  expect(readSelectedMultiAdjustedPlanV3(result.state, evidence, future)).toMatchObject({ kind: "read_only", executionAuthority: "NONE", state: result.state })
  expect(readSelectedMultiAdjustedPlanV3(result.state, { ...evidence, slots: evidence.slots.slice(1) }, future).kind).not.toBe("read_only")
  const tampered = structuredClone(result.state)
  const changed = tampered.activePlan.sessions.find(s => s.prescription.kind === "ADJUSTED_METHOD_V3")!
  if (changed.prescription.kind !== "ADJUSTED_METHOD_V3") throw Error("No adjusted slot")
  const altered = { ...tampered, activePlan: { ...tampered.activePlan, sessions: tampered.activePlan.sessions.map(s => s === changed
    ? { ...s, prescription: { ...changed.prescription, projectionFingerprint: "changed" } } : s) } }
  const { contentFingerprint: _fingerprint, ...content } = altered
  const forged = { ...content, contentFingerprint: canonicalJsonFingerprint("trainoracle.multi-plan-selection.v3", content) }
  expect(readSelectedMultiAdjustedPlanV3(forged, evidence, future)).toMatchObject({ code: "MULTI_PLAN_CONTENT_MISMATCH" })
  const read = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw Error("No live storage in historical read") })
  expect(readSelectedMultiAdjustedPlanV3(result.state, evidence, future).kind).toBe("read_only")
  expect(read).not.toHaveBeenCalled()
})
