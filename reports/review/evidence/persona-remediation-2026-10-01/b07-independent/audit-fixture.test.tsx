import React from "react"
import { writeFileSync } from "node:fs"
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { stateFixture } from "../../app/src/domain/plan-beta-store.test-fixture"
import {
  activePlanBetaStorageKey, archiveAndClearActivePlan, archiveAndClearActivePlanWithLock,
  loadPreviousIntake, readArchivedOriginalPlans, readPlanBetaStateFromStorage, savePlanBetaState,
} from "../../app/src/domain/plan-beta-store"
import { planBetaStateV3Schema, planHistoryListSchema } from "../../app/src/domain/plan-beta-schema"
import { generatePlanFromDraft, selectPlanForActivation } from "../../app/src/domain/plan-beta-flow"
import { advancePeriodizationContext, createInitialPeriodizationContext } from "../../app/src/domain/periodization-lineage"
import { saveSelectedPlanCandidate } from "../../app/src/screens/plan-beta/plan-selection"
import { PlanBeta } from "../../app/src/screens/PlanBeta"
import { runDraftSafeNavigation } from "../../app/src/domain/unsaved-draft-navigation"
import { setActiveLocalAccount } from "../../app/src/domain/account/local-journal-ownership"
import { planHistorySnapshotContent } from "../../app/src/domain/plan-history-snapshot-content"

// Disable external effects; all domain reads below see only this jsdom's synthetic storage.
vi.mock("../../app/src/domain/account/plan-cloud-backup", () => ({
  planCloudBackupEnabled: () => false,
  archivePlanOnServer: async () => {},
  backupActivePlanToServer: async () => ({ kind: "unavailable" }),
  loadLatestPlanFromServer: async () => ({ kind: "unavailable" }),
}))
vi.mock("../../app/src/domain/account/supabase-client", () => ({ supabase: async () => null }))

const HISTORY = "trainoracle.plan-beta.history.v1"
const NOW = "2026-10-01T03:00:00.000Z"
const evidence: Record<string, unknown> = {}

function completed(ordinal = 6) {
  const base = stateFixture()
  if (base.version !== 3) throw new Error("Expected synthetic V3")
  let periodization = createInitialPeriodizationContext(base.activePlan.candidateId, base.generatedAt)!
  for (let i = 1; i < ordinal; i++) {
    periodization = advancePeriodizationContext(periodization, new Date(Date.UTC(2026, 7, i)).toISOString())!
  }
  return planBetaStateV3Schema.parse({ ...base, periodization,
    progress: [{ sessionDay: 1, sessionSlot: "AM", state: "COMPLETED" }] })
}

function history() {
  return planHistoryListSchema.parse(JSON.parse(localStorage.getItem(HISTORY) ?? "[]"))
}

function seedHistory(count: number) {
  const rows = Array.from({ length: count }, (_, i) => {
    const state = planBetaStateV3Schema.parse({ ...completed(i + 1),
      progress: [{ sessionDay: 1, sessionSlot: "AM", state: "RESTED" }] })
    return planHistorySnapshotContent(state, new Date(Date.UTC(2026, 8, 20 - i)).toISOString(), "MANUAL")
  })
  const raw = JSON.stringify(planHistoryListSchema.parse(rows))
  localStorage.setItem(HISTORY, raw)
  return rows
}

function generate(intake = completed().intake) {
  const result = generatePlanFromDraft(intake, "NO_KNOWN_RISK")
  expect(result.kind).toBe("generated")
  if (result.kind !== "generated") throw new Error(`Generation returned ${result.kind}`)
  return result
}

async function nextFromUI() {
  const button = screen.getByRole("button", { name: "현재 기준으로 다음 계획안 만들기" })
  expect(button).toBeEnabled()
  await userEvent.setup().click(button)
  await screen.findByRole("button", { name: /통증은 없고 몸 상태는 평소와 같아요/ })
  expect(readPlanBetaStateFromStorage().kind).toBe("missing")
}

beforeEach(() => {
  localStorage.clear(); sessionStorage.clear(); setActiveLocalAccount(null)
  vi.spyOn(Date, "now").mockReturnValue(Date.parse(NOW))
  vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date(NOW))
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("B07 forbids network access") }))
})
afterEach(() => {
  cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); setActiveLocalAccount(null)
})
afterAll(() => {
  writeFileSync(process.env.B07_EVIDENCE_PATH!, JSON.stringify({
    syntheticOnly: true, scope: "B07 ordinary V3 device-local path", clock: NOW,
    timezone: process.env.TZ, evidence,
  }, null, 2))
})

describe("B07 boundary 1 - ordinary next-frame lineage", () => {
  it("CONTROL: a genuinely new plan starts at 1; the lineage helper advances 6 to 7 and 18 to next macrocycle", () => {
    const draft = generate()
    const selected = selectPlanForActivation(draft.generated.candidates[0]!.candidateId,
      draft.generated, draft.gate, draft.intake, draft.athleteEvidence, new Date(NOW))
    expect(selected.kind).toBe("selected")
    if (selected.kind !== "selected") throw new Error("Expected selected")
    expect(selected.state.periodization).toMatchObject({ macrocycleOrdinal: 1, frameOrdinal: 1, source: "NEW_PLAN" })
    const p6 = completed(6).periodization!
    const p18 = completed(18).periodization!
    expect(advancePeriodizationContext(p6, NOW)).toMatchObject({
      programLineageId: p6.programLineageId, macrocycleOrdinal: 1, frameOrdinal: 7, source: "ROLLED_FORWARD" })
    expect(advancePeriodizationContext(p18, NOW)).toMatchObject({
      programLineageId: p18.programLineageId, macrocycleOrdinal: 2, frameOrdinal: 1, source: "ROLLED_FORWARD" })
    evidence.lineageControl = { initial: selected.state.periodization,
      sixToSeven: advancePeriodizationContext(p6, NOW), eighteenRollover: advancePeriodizationContext(p18, NOW) }
  })

  it.each([6, 18])("REPRO: ordinary next-frame click and actual new selection resets predecessor frame %i", async ordinal => {
    const original = completed(ordinal)
    expect(savePlanBetaState(original)).toEqual({ ok: true })
    const before = localStorage.getItem(activePlanBetaStorageKey())!
    render(<PlanBeta />)
    await nextFromUI()
    expect(history()[0]).toMatchObject({ archiveReason: "MANUAL", originalPlan: original, periodization: original.periodization })
    expect(loadPreviousIntake()).toEqual(original.intake)
    const draft = generate(loadPreviousIntake()!)
    const saved = await saveSelectedPlanCandidate({ candidateId: draft.generated.candidates[0]!.candidateId,
      startDate: "2026-10-01" }, draft.generated, draft.gate, draft.intake, draft.athleteEvidence)
    expect(saved.kind).toBe("saved")
    if (saved.kind !== "saved" || saved.state.version !== 3) throw new Error("Expected saved V3")
    expect(saved.state.periodization).toMatchObject({ macrocycleOrdinal: 1, frameOrdinal: 1, source: "NEW_PLAN" })
    expect(saved.state.periodization!.programLineageId).not.toBe(original.periodization!.programLineageId)
    expect(readPlanBetaStateFromStorage()).toEqual({ kind: "loaded", state: saved.state })
    expect(history()[0]!.originalPlan).toEqual(JSON.parse(before))
    evidence[`ordinaryLineageFrom${ordinal}`] = { result: saved.kind, predecessor: original.periodization,
      expected: advancePeriodizationContext(original.periodization!, NOW), actual: saved.state.periodization,
      expectedInvariantHolds: false, archivedOriginalPreserved: true }
  })
})

describe("B07 boundary 2 - archive18 saturation", () => {
  it("CONTROL: adding the eighteenth archive preserves all seventeen previous originals", async () => {
    const previous = seedHistory(17)
    const current = completed(18)
    expect(savePlanBetaState(current).ok).toBe(true)
    expect(await archiveAndClearActivePlanWithLock(current.activePlan.candidateId)).toMatchObject({ kind: "archived" })
    expect(history()).toHaveLength(18)
    expect(history().slice(1)).toEqual(previous)
    evidence.archive17Control = { before: 17, after: 18, previousOriginalsPreserved: true }
  })

  it("REPRO: adding the nineteenth archive removes the oldest full original and lineage, not only a display row", async () => {
    const previous = seedHistory(18)
    const oldest = previous.at(-1)!
    const current = completed(18)
    expect(savePlanBetaState(current).ok).toBe(true)
    expect(await archiveAndClearActivePlanWithLock(current.activePlan.candidateId)).toMatchObject({ kind: "archived" })
    const after = history()
    expect(after).toHaveLength(18)
    expect(after.slice(1)).toEqual(previous.slice(0, 17))
    expect(after.some(row => "originalPlanFingerprint" in row && row.originalPlanFingerprint === oldest.originalPlanFingerprint)).toBe(false)
    expect(readArchivedOriginalPlans()).toMatchObject({ kind: "loaded", retainedPlans: 18, missingOriginals: 0 })
    evidence.archive18Saturation = { before: 18, after: 18, result: "archived",
      evictedOriginalFingerprint: oldest.originalPlanFingerprint, evictedPeriodization: oldest.periodization,
      oldestOriginalRetained: false, missingOriginalsReported: 0, activeAfterArchive: readPlanBetaStateFromStorage().kind }
  })
})

describe("B07 boundary 3 - cancellation and preservation", () => {
  it("CONTROL: leaving before the next-frame click preserves the active original byte-for-byte", () => {
    const state = completed()
    expect(savePlanBetaState(state).ok).toBe(true)
    const before = localStorage.getItem(activePlanBetaStorageKey())
    const view = render(<PlanBeta />)
    expect(screen.getByRole("button", { name: "현재 기준으로 다음 계획안 만들기" })).toBeEnabled()
    view.unmount()
    expect(localStorage.getItem(activePlanBetaStorageKey())).toBe(before)
    expect(history()).toEqual([])
    evidence.cancelBeforeStartControl = { activeBytePreserved: true, historyCount: 0 }
  })

  it("REPRO: declining draft discard preserves the draft; confirmed cancellation after click does not restore the active original", async () => {
    const original = completed()
    expect(savePlanBetaState(original).ok).toBe(true)
    const view = render(<PlanBeta />)
    await nextFromUI()
    await userEvent.setup().click(screen.getByRole("button", { name: /통증은 없고 몸 상태는 평소와 같아요/ }))
    await screen.findByRole("button", { name: "이 일정으로 시작" })
    const archiveBytes = localStorage.getItem(HISTORY)
    const navigate = vi.fn()
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false)
    expect(runDraftSafeNavigation(navigate)).toBe(false)
    expect(navigate).not.toHaveBeenCalled()
    expect(localStorage.getItem(HISTORY)).toBe(archiveBytes)
    confirm.mockReturnValue(true)
    expect(runDraftSafeNavigation(() => { navigate(); view.unmount() })).toBe(true)
    expect(navigate).toHaveBeenCalledOnce()
    expect(readPlanBetaStateFromStorage()).toEqual({ kind: "missing" })
    expect(readArchivedOriginalPlans()).toMatchObject({ kind: "loaded", retainedPlans: 1, plans: [original] })
    render(<PlanBeta />)
    expect(readPlanBetaStateFromStorage()).toEqual({ kind: "missing" })
    expect(screen.queryByRole("button", { name: "현재 기준으로 다음 계획안 만들기" })).toBeNull()
    evidence.cancelAfterStart = { discardDeclinedBlocksNavigation: true, confirmedDiscardNavigates: true,
      activeOriginalRestored: false, archivedOriginalPreserved: true, activeAfterReopen: "missing",
      expectedActivePreservationInvariantHolds: false }
  })

  it("REPRO: at archive18, abandoning the new intake has already evicted an older original without any new plan activation", async () => {
    const previous = seedHistory(18)
    const oldest = previous.at(-1)!
    const current = completed(18)
    expect(savePlanBetaState(current).ok).toBe(true)
    const view = render(<PlanBeta />)
    await nextFromUI()
    view.unmount()
    expect(readPlanBetaStateFromStorage().kind).toBe("missing")
    expect(history()).toHaveLength(18)
    expect(history()[0]!.originalPlan).toEqual(current)
    expect(history().some(row => "originalPlanFingerprint" in row && row.originalPlanFingerprint === oldest.originalPlanFingerprint)).toBe(false)
    evidence.cancelAtSaturation = { successorActivated: false, historyCount: 18,
      predecessorArchivedIntact: true, oldOriginalEvicted: true,
      evictedOriginalFingerprint: oldest.originalPlanFingerprint, activeAfterAbandon: "missing" }
  })
})
