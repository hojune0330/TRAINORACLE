import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { generatePlanFromDraft, selectPlanForActivation } from "./plan-beta-flow"
import { replaceCandidateCatalogWorkout } from "./catalog-plan-binding"
import { planBetaStateV3Schema } from "./plan-beta-schema"
import { savePlanBetaState, readPlanBetaStateFromStorage, readArchivedOriginalPlans } from "./plan-beta-store"
import { createPlannedSessionLogDraft } from "./planned-session-link"
import type { PostSessionEntry } from "./journal-schema"
import { FIELD_PROVENANCE } from "./field-provenance"
import { JOURNAL_STORAGE_KEY } from "./journal-storage-keys"
import { readCatalogCycleDraftSource, catalogCycleDraftSourceStillCurrent } from "./catalog-cycle-draft"
import { saveSelectedPlanCandidate } from "../screens/plan-beta/plan-selection"
import { setActiveLocalAccount } from "./account/local-journal-ownership"
import * as mutationLock from "./plan-mutation-lock"

const intake = { eventGroup: "FIVE_K" as const, eventDistanceM: 5000 as const, competitionDivision: "OPEN" as const,
  experienceBand: "EXPERIENCED" as const, availableDayCount: "EVERY_DAY" as const, requestedFrameLength: 9 as const,
  trainingFocus: "LT_INTENT" as const, secondSessionMode: "RECOVERY_PM_ALLOWED" as const,
  trainingTimePreference: "MORNING" as const, selectedDetailedTemplateRef: null, startDate: "2026-09-20" }

function setup() {
  const first = generatePlanFromDraft(intake, "NO_KNOWN_RISK")
  if (first.kind !== "generated") throw Error(first.kind)
  let generated = first.generated
  for (const session of generated.candidates[0].sessions.filter(s => s.role === "QUALITY")) {
    const changed = replaceCandidateCatalogWorkout(generated, session, "P-LT-B", {
      eventDistanceM: 5000, experience: "EXPERIENCED", availableSeconds: null,
      confirmedRequirements: [], fiveK: null, segmentPaces: [],
    }, true)
    if (!changed) throw Error("fixture binding failed")
    generated = changed
  }
  const selected = selectPlanForActivation(generated.candidates[0].candidateId, generated, first.gate,
    first.intake, first.athleteEvidence, new Date("2026-09-20T00:00:00Z"))
  if (selected.kind !== "selected") throw Error(selected.code)
  const predecessor = planBetaStateV3Schema.parse({ ...selected.state, progress: selected.state.activePlan.sessions.map(s => ({
    sessionDay: s.day, sessionSlot: s.slot, state: "COMPLETED",
  })) })
  expect(savePlanBetaState(predecessor).ok).toBe(true)
  const entries: PostSessionEntry[] = predecessor.activePlan.sessions.filter(s => s.role === "QUALITY").map(s => {
    const draft = createPlannedSessionLogDraft(predecessor, s, "2026-09-29T00:00:00Z")!
    return { id: `cycle-${s.day}-${s.slot}`, kind: "post-session", date: draft.date, savedAt: "2026-09-29T00:00:00Z",
      syncState: "local", system: "lt", title: "", distanceKm: "", durationMin: "", avgPace: "", rpe: 9,
      memo: "", activityOutcome: "COMPLETED", planExecutionRelation: "AS_PLANNED", activitySlot: s.slot,
      fieldProvenance: { rpe: { provenance: FIELD_PROVENANCE.explicit },
        activityOutcome: { provenance: FIELD_PROVENANCE.explicit }, activitySlot: { provenance: FIELD_PROVENANCE.explicit },
        plannedSessionLink: { provenance: FIELD_PROVENANCE.explicit },
        planExecutionRelation: { provenance: FIELD_PROVENANCE.derived,
          derivationRuleId: "QUICK_PLAN_EXECUTION_RELATION_V2", derivedFrom: ["activityOutcome", "activitySlot", "plannedSessionLink"] } },
      plannedSessionLink: draft.link }
  })
  expect(entries.length).toBeGreaterThanOrEqual(2)
  localStorage.setItem(JOURNAL_STORAGE_KEY, JSON.stringify(entries))
  const next = () => generatePlanFromDraft({ ...intake, startDate: "2026-10-01" }, "NO_KNOWN_RISK", undefined, undefined, undefined, predecessor)
  return { predecessor, entries, next }
}

beforeEach(() => {
  localStorage.clear(); sessionStorage.clear(); setActiveLocalAccount(null)
  vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-10-01T03:00:00Z"))
})
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); setActiveLocalAccount(null) })

describe("actual journal -> successor draft -> stored detail", () => {
  it("uses real linked RPE in normal next-frame generation and saves the exact lower configuration", async () => {
    const { predecessor, entries, next } = setup(), result = next()
    if (result.kind !== "generated") throw Error(result.kind)
    expect(result.cycleSummary?.reducedCount).toBeGreaterThanOrEqual(2)
    expect(result.generated.candidates[0].sessions.filter(s => s.role === "QUALITY").every(s =>
      s.prescription.kind === "RPE_TIME_RANGE" && s.prescription.catalogWorkout?.catalogId === "P-LT-B-480")).toBe(true)
    expect(readPlanBetaStateFromStorage()).toEqual({ kind: "loaded", state: predecessor })
    const saved = await saveSelectedPlanCandidate({ candidateId: result.generated.candidates[0].candidateId, startDate: "2026-10-01" },
      result.generated, result.gate, result.intake, result.athleteEvidence, () => true, predecessor, result.cycleDraft)
    expect(saved.kind).toBe("saved")
    if (saved.kind !== "saved") throw Error(saved.code)
    if (saved.state.version !== 3) throw Error("expected current stored plan")
    expect(readPlanBetaStateFromStorage()).toEqual({ kind: "loaded", state: saved.state })
    const history = readArchivedOriginalPlans()
    expect(history.kind === "loaded" && history.plans).toContainEqual(predecessor)
    expect(saved.state.activePlan.sessions).toEqual(result.generated.candidates[0].sessions)
    expect(saved.state.periodization?.frameOrdinal).toBe(predecessor.periodization!.frameOrdinal + 1)
    localStorage.setItem(JOURNAL_STORAGE_KEY, JSON.stringify(entries.map(e => ({ ...e, rpe: 6 }))))
    const beforeReplay = Object.fromEntries(Object.entries(localStorage))
    expect(await saveSelectedPlanCandidate({ candidateId: result.generated.candidates[0].candidateId, startDate: "2026-10-01" },
      result.generated, result.gate, result.intake, result.athleteEvidence, () => true, predecessor, result.cycleDraft)).toEqual(saved)
    expect(Object.fromEntries(Object.entries(localStorage))).toEqual(beforeReplay)
  })
  it("requires the original preview evidence context for every new successor write", async () => {
    const { predecessor, entries, next } = setup(), result = next()
    if (result.kind !== "generated") throw Error(result.kind)
    localStorage.setItem(JOURNAL_STORAGE_KEY, JSON.stringify(entries.map(e => ({ ...e, rpe: 6 }))))
    const before = Object.fromEntries(Object.entries(localStorage))
    expect(await saveSelectedPlanCandidate({ candidateId: result.generated.candidates[0].candidateId, startDate: "2026-10-01" },
      result.generated, result.gate, result.intake, result.athleteEvidence, () => true, predecessor))
      .toEqual({ kind: "rejected", code: "CYCLE_EVIDENCE_CHANGED" })
    expect(Object.fromEntries(Object.entries(localStorage))).toEqual(before)
  })
  it("invalidates the draft when RPE changes while waiting for the save lock, without any plan write", async () => {
    const { predecessor, entries, next } = setup(), result = next()
    if (result.kind !== "generated") throw Error(result.kind)
    let release: (() => void) | undefined
    vi.spyOn(mutationLock, "getPlanMutationLockManager").mockReturnValue({ request: <T,>(_name: string, _options: unknown, callback: (lock: object | null) => T | Promise<T>) =>
      new Promise<T>(resolve => { release = () => resolve(callback({})) }) })
    const saving = saveSelectedPlanCandidate({ candidateId: result.generated.candidates[0].candidateId, startDate: "2026-10-01" },
      result.generated, result.gate, result.intake, result.athleteEvidence, () => true, predecessor, result.cycleDraft)
    localStorage.setItem(JOURNAL_STORAGE_KEY, JSON.stringify(entries.map(e => ({ ...e, rpe: 6 }))))
    const before = Object.fromEntries(Object.entries(localStorage))
    release!()
    expect(await saving).toEqual({ kind: "rejected", code: "CYCLE_EVIDENCE_CHANGED" })
    expect(Object.fromEntries(Object.entries(localStorage))).toEqual(before)
  })
  it("keeps private prose out of the response key and detects missing records without interpreting them as zero", () => {
    const { predecessor, entries } = setup()
    const source = readCatalogCycleDraftSource(predecessor)!
    expect(source.response.higherThanRangeCount).toBeGreaterThanOrEqual(2)
    localStorage.setItem(JOURNAL_STORAGE_KEY, JSON.stringify(entries.map(e => ({ ...e, memo: "synthetic private prose" }))))
    expect(catalogCycleDraftSourceStillCurrent(predecessor, source.context)).toBe(true)
    localStorage.setItem(JOURNAL_STORAGE_KEY, "[]")
    expect(catalogCycleDraftSourceStillCurrent(predecessor, source.context)).toBe(false)
    expect(readCatalogCycleDraftSource(predecessor)?.response.signal).toBe("NO_LINKED_RESULTS")
  })
})
