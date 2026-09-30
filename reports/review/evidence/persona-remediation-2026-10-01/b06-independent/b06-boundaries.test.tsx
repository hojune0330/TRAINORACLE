import React from "react"
import { act, cleanup, render, screen, fireEvent, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { generatePlanCandidates } from "@impl/plan-generator/generator"
import { evaluatePlanSafety } from "../../app/src/domain/plan-beta-flow"
import { createPlanFormation } from "../../app/src/domain/plan-beta-formation"
import { savePlanBetaState } from "../../app/src/domain/plan-beta-store"
import type { PlanBetaStateV3 } from "../../app/src/domain/plan-beta-schema"
import { inspectNextFrameAdaptation } from "../../app/src/domain/plan-adaptation-availability"
import {
  acceptPreparedNextFrameAdaptation, evaluateActivePlanAdaptationSafety,
  loadMatchingPendingSuccessor, prepareNextFrameAdaptation,
} from "../../app/src/domain/plan-adaptation-ui"
import type { PrepareNextFrameResult } from "../../app/src/domain/plan-adaptation-ui"
import { savePlanAdaptationContext, PLAN_ADAPTATION_CONTEXT_STORAGE_KEY } from "../../app/src/domain/plan-adaptation-ui-context"
import { setActiveLocalAccount } from "../../app/src/domain/account/local-journal-ownership"
import { createPlannedSessionLogDraft } from "../../app/src/domain/planned-session-link"
import { derivePlanCycleResponse } from "../../app/src/domain/plan-cycle-response"
import { PlanAdaptationFlow } from "../../app/src/screens/plan-beta/PlanAdaptationFlow"
import { createSelfReportedAthleteRecord } from "../../app/src/domain/athlete-records"

vi.mock("../../app/src/domain/account/account-plan-service", () => ({
  accountPlansEnabled: () => false,
  accountPlanService: () => null,
}))

const NOW = new Date("2026-08-18T12:00:00.000Z")
const LABEL = {
  entry: "\uB2E4\uC74C \uACC4\uD68D \uC870\uC815\uD558\uAE30",
  cycle: "\uC774\uBC88 \uC8FC\uAE30 \uAE30\uB85D \uD655\uC778",
  request: /\uB2E4\uC74C \uACC4\uD68D\uC744 \uC870\uC815\uD558\uACE0 \uC2F6\uC5B4\uC694/u,
  safe: /\uD1B5\uC99D\uC740 \uC5C6\uACE0 \uBAB8 \uC0C1\uD0DC\uB294 \uD3C9\uC18C\uC640 \uAC19\uC544\uC694/u,
  reduce: /\uD6C8\uB828\uB7C9\uC744 \uC870\uAE08 \uC904\uC778 \uB2E4\uC74C \uACC4\uD68D/u,
  back: "\uC774\uC804 \uB2E8\uACC4",
  accept: "\uC774 \uB2E4\uC74C \uACC4\uD68D \uC120\uD0DD\uD558\uAE30",
  close: "\uD604\uC7AC \uACC4\uD68D\uC73C\uB85C \uB3CC\uC544\uAC00\uAE30",
}
const empty = () => []

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(NOW)
  setActiveLocalAccount(null)
  localStorage.clear()
  sessionStorage.clear()
})
afterEach(() => {
  cleanup()
  setActiveLocalAccount(null)
  expect(fetch).not.toHaveBeenCalled()
  vi.useRealTimers()
})

function fixture(kind: "BALANCED" | "CONSERVATIVE" = "BALANCED") {
  const gate = evaluatePlanSafety("NO_KNOWN_RISK", NOW)
  if (gate.kind !== "passed") throw Error("positive gate failed")
  const availableTrainingDays = [1, 3, 5, 7, 9] as const
  const generated = generatePlanCandidates({
    kind: "PLAN_BETA_GENERATION_REQUEST", safetyGate: gate.gate,
    profile: { eventGroup: "FIVE_K", eventDistanceM: 5000, experienceBand: "EXPERIENCED",
      availableTrainingDays, secondSessionMode: "SINGLE_SESSION_ONLY", trainingTimePreference: "MORNING" },
    formation: createPlanFormation("2026-08-18", availableTrainingDays, "EXPERIENCED"),
    requestedFrameLength: 9, selectedEnergyIntent: "VO2_INTENT",
    journalSource: { kind: "NO_USABLE_JOURNAL" }, selectionAuthority: "SELF",
  })
  if (generated.kind !== "generated") throw Error(`positive generation failed: ${generated.kind}`)
  const candidate = generated.candidates.find(item => item.kind === kind)!
  const state: PlanBetaStateV3 = {
    version: 3,
    intake: { eventGroup: "FIVE_K", eventDistanceM: 5000, competitionDivision: "OPEN", experienceBand: "EXPERIENCED",
      availableDayCount: 5, requestedFrameLength: 9, trainingFocus: "VO2_INTENT", secondSessionMode: "SINGLE_SESSION_ONLY",
      trainingTimePreference: "MORNING", startDate: "2026-08-18", selectedDetailedTemplateRef: null },
    activePlan: { kind: "BETA_ACTIVE_PLAN_SNAPSHOT", activationState: "SELECTED_BETA_SNAPSHOT",
      candidateId: candidate.candidateId, pairId: candidate.pairId, candidateKind: candidate.kind,
      eventDistanceM: candidate.eventDistanceM, selectedDetailedTemplateRef: candidate.selectedDetailedTemplateRef,
      selectionActor: "SELF", sourceMode: candidate.sourceMode, selectedEnergyIntent: candidate.selectedEnergyIntent,
      frame: candidate.frame, sessions: candidate.sessions },
    progress: [], generatedAt: "2026-08-10T12:00:00.000Z",
    adaptationScope: { athleteId: "local-athlete", eventDistanceM: 5000, pairId: candidate.pairId,
      selectedDetailedTemplateRef: candidate.selectedDetailedTemplateRef },
  }
  expect(savePlanBetaState(state)).toEqual({ ok: true })
  expect(savePlanAdaptationContext(generated.candidates, candidate.candidateId)).toEqual({ ok: true })
  return state
}
function prepare(state: PlanBetaStateV3) {
  return prepareNextFrameAdaptation({ state, reason: "EXPLICIT_REQUEST", record: null,
    safety: evaluateActivePlanAdaptationSafety(state, "NO_KNOWN_RISK", NOW), operationAt: NOW.toISOString() })
}
function storageBytes() {
  return JSON.stringify(Object.keys(localStorage).sort().map(key => [key, localStorage.getItem(key)]))
}
function mount(state: PlanBetaStateV3, extra: Partial<React.ComponentProps<typeof PlanAdaptationFlow>> = {}) {
  return render(<PlanAdaptationFlow state={state} onLoadRecords={empty} onLoadEntries={empty} {...extra} />)
}
async function open() {
  const entry = screen.getByRole("button", { name: /^(?:\uB2E4\uC74C \uACC4\uD68D \uC870\uC815\uD558\uAE30|\uC774\uBC88 \uC8FC\uAE30 \uAE30\uB85D \uD655\uC778)$/u })
  await waitFor(() => expect(entry).toBeEnabled())
  fireEvent.click(entry)
}
function request() {
  fireEvent.click(screen.getByRole("button", { name: LABEL.request }))
  fireEvent.click(screen.getByRole("button", { name: LABEL.safe }))
  fireEvent.click(screen.getByRole("button", { name: LABEL.reduce }))
}

it("T01_POSITIVE_registered_edges_prepare_real_successors_without_writes", async () => {
  for (const kind of ["BALANCED", "CONSERVATIVE"] as const) {
    const state = fixture(kind)
    const bytes = storageBytes()
    expect(inspectNextFrameAdaptation(state)).toMatchObject({ kind: "available", explicitRequest: true, pbSb: kind === "CONSERVATIVE" })
    const result = await prepare(state)
    expect(result.kind).toBe("ready")
    if (result.kind === "ready") expect(result.prepared.changedSessions.length).toBeGreaterThan(0)
    if (kind === "CONSERVATIVE") {
      const record = createSelfReportedAthleteRecord({ id: "00000000-0000-4000-8000-000000001009",
        purpose: "PERSONAL_BEST", eventDistanceM: 5000, performanceSeconds: 1020,
        achievedOn: "2026-08-17", seasonId: null }, NOW)
      expect(record).not.toBeNull()
      expect(await prepareNextFrameAdaptation({ state, reason: "PB_SB", record,
        safety: evaluateActivePlanAdaptationSafety(state, "NO_KNOWN_RISK", NOW), operationAt: NOW.toISOString(),
      })).toMatchObject({ kind: "ready" })
    }
    expect(storageBytes()).toBe(bytes)
  }
})

it("T02_EXACT_CONTENT_rejects_same_ID_changed_sessions_and_unsupported_entry", async () => {
  const state = fixture()
  const copy = structuredClone(state)
  const session = copy.activePlan.sessions.find(item => item.role === "EASY")!
  if (session.prescription.kind !== "RPE_TIME_RANGE") throw Error("support missing")
  session.prescription.durationMinutes.maximum -= 1
  const bytes = storageBytes()
  expect(inspectNextFrameAdaptation(copy)).toEqual({ kind: "unavailable", code: "ADAPTATION_CONTEXT_MISMATCH" })
  expect(await prepare(copy)).toEqual({ kind: "unavailable", code: "ADAPTATION_CONTEXT_MISMATCH" })
  expect(inspectNextFrameAdaptation(state).kind).toBe("available")
  const catalog = structuredClone(state)
  const catalogSession = catalog.activePlan.sessions.find(item => item.prescription.kind === "RPE_TIME_RANGE")!
  Object.assign(catalogSession.prescription, { catalogWorkout: { synthetic: true } })
  expect(inspectNextFrameAdaptation(catalog)).toEqual({ kind: "unavailable", code: "CATALOG_TRANSFORM_UNAVAILABLE" })
  const onPrepare = vi.fn()
  mount(catalog, { onPrepare })
  await open()
  expect(screen.queryByRole("button", { name: LABEL.request })).not.toBeInTheDocument()
  expect(screen.queryByRole("button", { name: /PB/u })).not.toBeInTheDocument()
  expect(onPrepare).not.toHaveBeenCalled()
  expect(storageBytes()).toBe(bytes)
})

it("T03_SCOPE_PRIVACY_isolates_account_context_and_does_not_read_synthetic_memo", () => {
  const state = fixture()
  expect(inspectNextFrameAdaptation(state).kind).toBe("available")
  setActiveLocalAccount("synthetic-account-b")
  expect(inspectNextFrameAdaptation(state)).toEqual({ kind: "unavailable", code: "ADAPTATION_CONTEXT_UNAVAILABLE" })
  setActiveLocalAccount(null)
  expect(inspectNextFrameAdaptation(state).kind).toBe("available")
  const session = state.activePlan.sessions.find(item => item.role === "EASY")!
  const draft = createPlannedSessionLogDraft(state, session, NOW.toISOString())!
  const memoRead = vi.fn(() => { throw Error("SYNTHETIC_PRIVATE_MEMO_READ") })
  const entry = { id: "synthetic-entry", kind: "post-session", date: draft.date,
    rpe: 5, fieldProvenance: { rpe: { provenance: "EXPLICIT" } }, plannedSessionLink: draft.link }
  Object.defineProperty(entry, "memo", { enumerable: true, get: memoRead })
  const response = derivePlanCycleResponse([entry as never], state)
  expect(response.linkedResultCount).toBe(1)
  expect(response.comparableRpeCount).toBe(1)
  expect(memoRead).not.toHaveBeenCalled()
})

it("T04_SAFETY_accept_rechecks_hold_and_matching_pending_uses_whole_state_hash", async () => {
  const state = fixture()
  const result = await prepare(state)
  expect(result.kind).toBe("ready")
  if (result.kind !== "ready") throw Error("positive prepare failed")
  const bytes = storageBytes()
  const held = { ...state, progress: [{ sessionDay: 1, sessionSlot: "AM" as const, state: "PAIN_CHECKIN" as const }] }
  expect(await acceptPreparedNextFrameAdaptation({ prepared: result.prepared, predecessorState: state,
    safety: evaluateActivePlanAdaptationSafety(held, "NO_KNOWN_RISK", NOW), operationAt: NOW.toISOString(),
  })).toMatchObject({ kind: "blocked" })
  expect(storageBytes()).toBe(bytes)
  expect(await acceptPreparedNextFrameAdaptation({ prepared: result.prepared, predecessorState: state,
    safety: evaluateActivePlanAdaptationSafety(state, "NO_KNOWN_RISK", NOW), operationAt: NOW.toISOString(),
  })).toMatchObject({ kind: "accepted" })
  expect(await loadMatchingPendingSuccessor(state)).not.toBeNull()
  expect(await loadMatchingPendingSuccessor({ ...state, generatedAt: NOW.toISOString() })).toBeNull()
})

it("T05_STALE_PREPARE_double_tap_one_request_and_back_ignores_late_result", async () => {
  const state = fixture()
  let done!: (result: PrepareNextFrameResult) => void
  const onPrepare = vi.fn(() => new Promise<PrepareNextFrameResult>(resolve => { done = resolve }))
  mount(state, { onPrepare })
  await open()
  request()
  fireEvent.click(screen.getByRole("button", { name: LABEL.reduce }))
  expect(onPrepare).toHaveBeenCalledTimes(1)
  fireEvent.click(screen.getByRole("button", { name: LABEL.back }))
  const heading = screen.getByRole("heading").textContent
  await act(async () => done({ kind: "unavailable", code: "LATE_SYNTHETIC_RESPONSE" }))
  expect(screen.getByRole("heading").textContent).toBe(heading)
  expect(screen.getByRole("button", { name: LABEL.entry })).toBeEnabled()
})

it("T06_REPRO_new_plan_remains_disabled_until_obsolete_prepare_resolves", async () => {
  const state = fixture()
  let done!: (result: PrepareNextFrameResult) => void
  const onPrepare = vi.fn(() => new Promise<PrepareNextFrameResult>(resolve => { done = resolve }))
  const view = mount(state, { onPrepare })
  await open()
  request()
  localStorage.removeItem(PLAN_ADAPTATION_CONTEXT_STORAGE_KEY)
  const next = { ...state, generatedAt: NOW.toISOString() }
  view.rerender(<PlanAdaptationFlow state={next} onPrepare={onPrepare} onLoadRecords={empty} onLoadEntries={empty} />)
  await act(async () => {})
  const newEntry = screen.getByRole("button", { name: LABEL.cycle })
  expect(newEntry).toBeDisabled()
  fireEvent.click(newEntry)
  expect(screen.queryByRole("heading")).not.toBeInTheDocument()
  await act(async () => done({ kind: "unavailable", code: "OLD_PREPARE_FINISHED" }))
  expect(newEntry).toBeEnabled()
  fireEvent.click(newEntry)
  expect(screen.getByRole("heading")).toBeVisible()
})

it("T07_REPRO_committed_pending_then_unknown_ack_reopen_does_not_reload", async () => {
  const state = fixture()
  const onLoadPending = vi.fn(loadMatchingPendingSuccessor)
  const onAccept = vi.fn(async (input: Parameters<typeof acceptPreparedNextFrameAdaptation>[0]) => {
    expect(await acceptPreparedNextFrameAdaptation(input)).toMatchObject({ kind: "accepted" })
    throw Error("SYNTHETIC_ACK_LOSS_AFTER_LOCAL_COMMIT")
  })
  mount(state, { onAccept, onLoadPending })
  await open()
  request()
  fireEvent.click(await screen.findByRole("button", { name: LABEL.accept }))
  await screen.findByRole("status")
  expect(await loadMatchingPendingSuccessor(state)).not.toBeNull()
  fireEvent.click(screen.getByRole("button", { name: LABEL.close }))
  await open()
  expect(onLoadPending).toHaveBeenCalledTimes(1)
  expect(screen.getByRole("button", { name: LABEL.request })).toBeVisible()
  cleanup()
  mount(state)
  await open()
  expect(screen.queryByRole("button", { name: LABEL.request })).not.toBeInTheDocument()
  expect(screen.getByRole("status")).toBeVisible()
})

it("T08_EXCEPTION_prepare_throw_recovers_without_fake_success_or_writes", async () => {
  const state = fixture()
  const bytes = storageBytes()
  mount(state, { onPrepare: async () => { throw Error("SYNTHETIC_PREPARE_ERROR") } })
  await open()
  request()
  await screen.findByRole("status")
  expect(screen.queryByRole("button", { name: LABEL.accept })).not.toBeInTheDocument()
  expect(screen.getByRole("button", { name: LABEL.entry })).toBeEnabled()
  expect(storageBytes()).toBe(bytes)
})

it("T09_REPRO_real_saved_pending_read_error_reopen_never_retries_until_remount", async () => {
  const state = fixture()
  const ready = await prepare(state)
  if (ready.kind !== "ready") throw Error("positive prepare failed")
  expect(await acceptPreparedNextFrameAdaptation({ prepared: ready.prepared, predecessorState: state,
    safety: evaluateActivePlanAdaptationSafety(state, "NO_KNOWN_RISK", NOW), operationAt: NOW.toISOString(),
  })).toMatchObject({ kind: "accepted" })
  expect(await loadMatchingPendingSuccessor(state)).not.toBeNull()
  const before = storageBytes()
  const nativeRead = Storage.prototype.getItem
  let blocked = true
  let failures = 0
  const read = vi.spyOn(Storage.prototype, "getItem").mockImplementation(function (key: string) {
    if (key === "trainoracle.plan-beta.adaptation.v1" && blocked) {
      failures += 1
      throw Error("SYNTHETIC_TRANSIENT_STORAGE_READ_FAILURE")
    }
    return nativeRead.call(this, key)
  })
  mount(state)
  await open()
  expect(failures).toBe(1)
  expect(screen.getByRole("button", { name: LABEL.request })).toBeVisible()
  blocked = false
  const adaptationReadsBefore = read.mock.calls.filter(([key]) => key === "trainoracle.plan-beta.adaptation.v1").length
  fireEvent.click(screen.getByRole("button", { name: LABEL.entry }))
  await open()
  expect(read.mock.calls.filter(([key]) => key === "trainoracle.plan-beta.adaptation.v1")).toHaveLength(adaptationReadsBefore)
  expect(screen.getByRole("button", { name: LABEL.request })).toBeVisible()
  expect(storageBytes()).toBe(before)
  cleanup()
  mount(state)
  await open()
  expect(screen.queryByRole("button", { name: LABEL.request })).not.toBeInTheDocument()
  expect(screen.getByRole("status")).toBeVisible()
})
