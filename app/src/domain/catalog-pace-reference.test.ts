import { afterEach, describe, expect, it, vi } from "vitest"
import { createElement } from "react"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { calculateCatalogWorkout, calculatedWorkoutSequence, verifyCalculatedWorkout } from "@impl/prescription/all-workout-calculator"
import type { WorkoutCalculationInputs } from "@impl/prescription/all-workout-calculator"
import { isSegmentPaceReference, predictRaceFromActual } from "@impl/prescription/record-pace"
import type { SegmentPaceReference } from "@impl/prescription/record-pace"
import type { AthleteRecord } from "./athlete-records"
import { createSegmentRecordReference, recordPaceSegments, replaceSegmentReference } from "./catalog-pace-reference"
import { CatalogPaceReferences } from "../screens/plan-beta/CatalogPaceReferences"
import * as journalStore from "./journal-store"

function input(overrides: Partial<WorkoutCalculationInputs> = {}): WorkoutCalculationInputs {
  return { eventDistanceM: 5000, experience: "EXPERIENCED", availableSeconds: null,
    confirmedRequirements: [], fiveK: null, segmentPaces: [], ...overrides }
}
function actual(overrides: Partial<Extract<AthleteRecord, { purpose: "PERSONAL_BEST" | "RECENT_RESULT" }>> = {}): AthleteRecord {
  return { schemaVersion: 1, id: "actual-5k", purpose: "RECENT_RESULT", eventDistanceM: 5000,
    performanceSeconds: 1000, achievedOn: "2026-10-01", seasonId: null, enteredBy: "ATHLETE",
    verificationState: "SELF_REPORTED", sourceRef: "athlete-record:actual-5k", savedAt: "2026-10-02T00:00:00.000Z", ...overrides }
}
function required<T>(value: T | null | undefined): T {
  if (value === null || value === undefined) throw Error("Expected a real catalog calculation/segment")
  return value
}
const ref = (segmentId = "part-0") => createSegmentRecordReference(segmentId, actual(), "2026-10-02")
const VO2_ID = "X-VO2-01"
const VO2_SEGMENT = "X-VO2-01-1-1"

describe("catalog record reference adapters", () => {
  it.each(["ACTUAL", "GOAL"] as const)("retains %s provenance and shared precision in the displayed structure", kind => {
    const source: AthleteRecord = kind === "GOAL"
      ? { ...actual({ performanceSeconds: 1011.7 }), purpose: "RACE_GOAL", achievedOn: null, seasonId: null }
      : actual({ performanceSeconds: 1011.7 })
    const workout = required(calculateCatalogWorkout(VO2_ID, input({
      paceReferences: [createSegmentRecordReference(VO2_SEGMENT, source, "2026-10-02")],
    })))
    const raw = required(workout.steps.find(step => step.segmentId === VO2_SEGMENT)?.seconds).minimum
    expect(raw).toBeCloseTo(80.936, 10)
    const sequence = JSON.stringify(required(calculatedWorkoutSequence(workout)))
    expect(sequence).toContain(`≈80.9s/400m · ${kind === "GOAL" ? "목표기록" : "실제 기록"} 기준 · RP`)
    expect(sequence).not.toContain("직접 정한 목표")
    expect(workout.steps.find(step => step.segmentId === VO2_SEGMENT)?.seconds?.minimum).toBe(raw)
  })

  it("snapshots actual identity, savedAt version, date, and canonical half distance", () => {
    const source = actual({ eventDistanceM: 21097, performanceSeconds: 4219.5 })
    const reference = createSegmentRecordReference("part-0", source, "2026-10-02")
    expect(reference).toEqual({ segmentId: "part-0", kind: "ACTUAL", recordId: source.id,
      recordVersion: source.savedAt, eventDistanceM: 21097.5, performanceSeconds: 4219.5,
      achievedOn: "2026-10-01", evaluatedOn: "2026-10-02", confirmed: true, model: "RACE_AVERAGE_V1" })
    expect(isSegmentPaceReference(reference)).toBe(true)
    expect(source.eventDistanceM).toBe(21097)
  })

  it("keeps goal provenance separate from actual at adapter and calculator boundaries", () => {
    const goal: AthleteRecord = { ...actual(), purpose: "RACE_GOAL", achievedOn: null, seasonId: null }
    const goalReference = createSegmentRecordReference(VO2_SEGMENT, goal, "2026-10-02")
    expect(goalReference.kind).toBe("GOAL")
    expect(goalReference.achievedOn).toBeNull()
    const actualResult = required(calculateCatalogWorkout(VO2_ID, input({ paceReferences: [ref(VO2_SEGMENT)] })))
    const goalResult = required(calculateCatalogWorkout(VO2_ID, input({ paceReferences: [goalReference] })))
    const actualWork = actualResult.steps.filter(s => s.phase === "main" && s.kind === "WORK")
    const goalWork = goalResult.steps.filter(s => s.phase === "main" && s.kind === "WORK")
    expect(actualWork).toHaveLength(8)
    expect(goalWork).toHaveLength(8)
    expect(actualWork.every(s => s.targetModel === "ACTUAL_RACE_REFERENCE")).toBe(true)
    expect(goalWork.every(s => s.targetModel === "GOAL_RACE_REFERENCE")).toBe(true)
    expect(goalWork.map(s => s.seconds)).toEqual(actualWork.map(s => s.seconds))
    expect(goalResult.fingerprint).not.toBe(actualResult.fingerprint)
  })

  it("replaces only the selected segment reference and competing numeric inputs", () => {
    const original = input({ paceReferences: [ref("part-0"), ref("part-1")],
      segmentPaces: [{ segmentId: "part-0", secondsPerKm: 200 }, { segmentId: "part-1", secondsPerKm: 220 }],
      segmentSeconds: [{ segmentId: "part-0", seconds: 30 }, { segmentId: "part-1", seconds: 35 }],
      recoverySeconds: [{ segmentId: "rest", seconds: 120 }] })
    const before = JSON.stringify(original)
    const replacement = { ...ref(), recordId: "replacement" }
    const next = replaceSegmentReference(original, "part-0", replacement)
    expect(next.paceReferences).toEqual([ref("part-1"), replacement])
    expect(next.segmentPaces).toEqual([{ segmentId: "part-1", secondsPerKm: 220 }])
    expect(next.segmentSeconds).toEqual([{ segmentId: "part-1", seconds: 35 }])
    expect(next.recoverySeconds).toEqual(original.recoverySeconds)
    expect(next.fiveK).toBe(original.fiveK)
    expect(JSON.stringify(original)).toBe(before)
    expect(replaceSegmentReference(next, "part-0", null).paceReferences).toEqual([ref("part-1")])
    expect(replaceSegmentReference(input(), "part-0", ref())).not.toHaveProperty("segmentSeconds")
  })

  it("deduplicates eligible repeated segments and clears competing inputs for picker discovery", () => {
    const clean = recordPaceSegments(VO2_ID, input())
    expect(clean.map(s => s.segmentId)).toEqual([VO2_SEGMENT])
    const pending = input({ paceReferences: [ref(VO2_SEGMENT)], segmentPaces: [{ segmentId: VO2_SEGMENT, secondsPerKm: 200 }],
      segmentSeconds: [{ segmentId: VO2_SEGMENT, seconds: 30 }] })
    const before = JSON.stringify(pending)
    expect(recordPaceSegments(VO2_ID, pending)).toEqual(clean)
    expect(JSON.stringify(pending)).toBe(before)
    expect(recordPaceSegments("X-MIX-09", input({ confirmedRequirements: ["COMPOUND_TRAINING_EXPERIENCE"] })).map(s => s.segmentId))
      .toEqual(["X-MIX-09-1-1", "X-MIX-09-1-2"])
    expect(recordPaceSegments("P-GLY-S", input())).toEqual([])
    expect(recordPaceSegments("P-RHYTHM-300", input())).toEqual([])
    expect(recordPaceSegments("not-a-catalog-id", input())).toEqual([])
  })
})

type SyntheticPacePersona = {
  readonly id: string
  readonly label: string
  readonly records: readonly AthleteRecord[]
  readonly optionIds: readonly string[]
  readonly recommendedId?: string
  readonly catalogId?: string
  readonly selected?: SegmentPaceReference
  readonly disabled?: boolean
  readonly hidden?: boolean
  readonly ambiguous?: boolean
  readonly check?: "GOAL_COPY" | "UNDATED_COPY" | "THRESHOLD_COPY"
}

function personaRecord(id: string, overrides: Parameters<typeof actual>[0] = {}): AthleteRecord {
  return actual({ id, sourceRef: `athlete-record:${id}`, ...overrides })
}
const recentPersonaRecord = personaRecord("recent")
const goalPersonaRecord: AthleteRecord = { ...personaRecord("goal"), purpose: "RACE_GOAL", achievedOn: null, seasonId: null }
const undatedPersonaRecord = personaRecord("undated", { achievedOn: null })
const syntheticPacePersonas: readonly SyntheticPacePersona[] = [
  { id: "P01", label: "first-time runner without records", records: [], optionIds: [] },
  { id: "P02", label: "one recent 5K result", records: [recentPersonaRecord], optionIds: ["recent"], recommendedId: "recent" },
  { id: "P03", label: "latest slower than rolling best", records: [recentPersonaRecord, personaRecord("fast", { achievedOn: "2026-09-01", performanceSeconds: 950 })], optionIds: ["recent", "fast"], recommendedId: "recent" },
  { id: "P04", label: "one result owns all three actual badges", records: [recentPersonaRecord], optionIds: ["recent"], recommendedId: "recent" },
  { id: "P05", label: "old lifetime best and recent actual", records: [recentPersonaRecord, personaRecord("old", { achievedOn: "2024-01-01", performanceSeconds: 950 })], optionIds: ["recent", "old"], recommendedId: "recent" },
  { id: "P06", label: "undated actual only", records: [undatedPersonaRecord], optionIds: ["undated"] },
  { id: "P07", label: "goal only", records: [goalPersonaRecord], optionIds: ["goal"] },
  { id: "P08", label: "goal plus actual keeps actual recommendation", records: [goalPersonaRecord, recentPersonaRecord], optionIds: ["goal", "recent"], recommendedId: "recent" },
  { id: "P09", label: "same-date conflicting 5K times", records: [recentPersonaRecord, personaRecord("conflict", { performanceSeconds: 950 })], optionIds: ["recent", "conflict"], ambiguous: true },
  { id: "P10", label: "same-date equivalent 5K performances", records: [recentPersonaRecord, personaRecord("same")], optionIds: ["recent", "same"], recommendedId: "recent" },
  { id: "P11", label: "unverified record excluded", records: [personaRecord("unverified", { verificationState: "UNVERIFIED" })], optionIds: [] },
  { id: "P12", label: "self-reported record remains available", records: [recentPersonaRecord], optionIds: ["recent"], recommendedId: "recent" },
  { id: "P13", label: "800m-only runner cannot set generic catalog pace", records: [personaRecord("800", { eventDistanceM: 800, performanceSeconds: 121.5 })], optionIds: [] },
  { id: "P14", label: "legacy half record does not authorize catalog pace", records: [personaRecord("half", { eventDistanceM: 21097, performanceSeconds: 5000 })], optionIds: [] },
  { id: "P15", label: "marathon-only runner cannot set generic catalog pace", records: [personaRecord("marathon", { eventDistanceM: 42195, performanceSeconds: 10000 })], optionIds: [] },
  { id: "P16", label: "5K runner explicitly chooses LT threshold model", catalogId: "P-LT-S", records: [recentPersonaRecord], optionIds: ["recent"], recommendedId: "recent" },
  { id: "P17", label: "locked editor does not emit selection", records: [recentPersonaRecord], optionIds: ["recent"], recommendedId: "recent", disabled: true },
  { id: "P18", label: "selected goal is not described as current capability", records: [goalPersonaRecord], optionIds: ["goal"], selected: createSegmentRecordReference(VO2_SEGMENT, goalPersonaRecord, "2026-10-02"), check: "GOAL_COPY" },
  { id: "P19", label: "selected undated actual warns about missing date", records: [undatedPersonaRecord], optionIds: ["undated"], selected: createSegmentRecordReference(VO2_SEGMENT, undatedPersonaRecord, "2026-10-02"), check: "UNDATED_COPY" },
  { id: "P20", label: "missing saved source preserves visible stored selection", records: [], optionIds: ["missing"], selected: createSegmentRecordReference(VO2_SEGMENT, personaRecord("missing"), "2026-10-02") },
  { id: "P21", label: "GLY athlete sees no generic reference picker", catalogId: "P-GLY-D", records: [recentPersonaRecord], optionIds: [], hidden: true },
  { id: "P22", label: "uphill VO2 athlete sees no flat reference picker", catalogId: "X-HILL-05", records: [recentPersonaRecord], optionIds: [], hidden: true },
  { id: "P23", label: "unrelated 800m conflict does not warn for unambiguous 5K selection", records: [recentPersonaRecord, personaRecord("800-a", { eventDistanceM: 800, performanceSeconds: 121.5 }), personaRecord("800-b", { eventDistanceM: 800, performanceSeconds: 122 })], optionIds: ["recent"], recommendedId: "recent" },
  { id: "P24", label: "selected LT threshold is not called race-average speed", catalogId: "P-LT-S", records: [recentPersonaRecord], optionIds: ["recent"], selected: createSegmentRecordReference("part-0", recentPersonaRecord, "2026-10-02", "FIVE_K_THRESHOLD_V1"), check: "THRESHOLD_COPY" },
]

describe("24 synthetic persona DOM/core flows (not real users or browser E2E)", () => {
  afterEach(() => { cleanup(); vi.restoreAllMocks() })

  it.each(syntheticPacePersonas)("$id: $label", (persona) => {
    vi.spyOn(journalStore, "todayISO").mockReturnValue("2026-10-02")
    const onChange = vi.fn()
    const catalogId = persona.catalogId ?? VO2_ID
    const inputs = input({ ...(persona.selected ? { paceReferences: [persona.selected] } : {}) })
    const { container } = render(createElement(CatalogPaceReferences, {
      catalogId, inputs, records: persona.records, disabled: persona.disabled ?? false, onChange,
    }))
    expect(onChange).not.toHaveBeenCalled()
    if (persona.hidden) {
      expect(container).toBeEmptyDOMElement()
      return
    }
    const select = screen.getByRole<HTMLSelectElement>("combobox", { hidden: true })
    expect([...select.options].map(option => option.value).filter(Boolean).sort()).toEqual([...persona.optionIds].sort())
    expect(select.value).toBe(persona.selected?.recordId ?? "")
    expect(select.disabled).toBe(persona.disabled ?? false)
    const buttons = screen.queryAllByRole<HTMLButtonElement>("button", { hidden: true })
    expect(buttons).toHaveLength(persona.recommendedId && !persona.selected ? 1 : 0)
    const recommended = buttons[0]
    if (recommended) {
      expect(recommended.disabled).toBe(persona.disabled ?? false)
      if (!persona.disabled) {
        fireEvent.click(recommended)
        expect(onChange).toHaveBeenLastCalledWith(catalogId === "P-LT-S" ? "part-0" : VO2_SEGMENT,
          expect.objectContaining({ recordId: persona.recommendedId, kind: "ACTUAL", eventDistanceM: 5000,
            model: catalogId === "P-LT-S" ? "FIVE_K_THRESHOLD_V1" : "RACE_AVERAGE_V1" }))
      } else {
        fireEvent.click(recommended)
        expect(onChange).not.toHaveBeenCalled()
      }
    }
    if (!persona.disabled && !persona.selected && persona.optionIds.length > 0) {
      const chosenId = required(persona.optionIds[0])
      fireEvent.change(select, { target: { value: chosenId } })
      const source = required(persona.records.find(record => record.id === chosenId))
      const expectedModel = catalogId === "P-LT-S" ? "FIVE_K_THRESHOLD_V1" : "RACE_AVERAGE_V1"
      expect(onChange).toHaveBeenLastCalledWith(catalogId === "P-LT-S" ? "part-0" : VO2_SEGMENT,
        expect.objectContaining({ recordId: chosenId, kind: source.purpose === "RACE_GOAL" ? "GOAL" : "ACTUAL",
          achievedOn: source.achievedOn, model: expectedModel }))
    }
    expect(container.textContent?.includes("\uAC19\uC740 \uB0A0 \uC11C\uB85C \uB2E4\uB978 \uAE30\uB85D"))
      .toBe(persona.ambiguous ?? false)
    if (persona.check) {
      const status = screen.getByRole("status", { hidden: true })
      if (persona.check === "GOAL_COPY") expect(status).toHaveTextContent("\uD604\uC7AC \uACBD\uAE30\uB825\uC744 \uB73B\uD558\uC9C0 \uC54A\uC544\uC694")
      if (persona.check === "UNDATED_COPY") expect(status).toHaveTextContent("\uB0A0\uC9DC \uBBF8\uC785\uB825")
      if (persona.check === "THRESHOLD_COPY") expect(status).not.toHaveTextContent("\uACBD\uAE30\uC758 \uD3C9\uADE0 \uC18D\uB3C4")
    }
  })
})

describe("record references through real catalog calculations", () => {
  it("preserves raw 30.375 seconds for a 200m VO2 segment from a 5K source", () => {
    const base = required(calculateCatalogWorkout("X-VO2-04", input()))
    const reference = createSegmentRecordReference("X-VO2-04-1", actual({ performanceSeconds: 759.375 }), "2026-10-02")
    const changed = required(calculateCatalogWorkout("X-VO2-04", input({ paceReferences: [reference] })))
    expect(changed.unavailable).toEqual([])
    expect(required(changed.steps.find(s => s.segmentId === "X-VO2-04-1")))
      .toMatchObject({ distanceM: 200, seconds: { minimum: 30.375, maximum: 30.375 }, targetModel: "ACTUAL_RACE_REFERENCE" })
    expect(changed.steps.filter(s => s.segmentId !== "X-VO2-04-1"))
      .toEqual(base.steps.filter(s => s.segmentId !== "X-VO2-04-1"))
  })

  it("preserves repetitions, sets, support, and exact recovery structure under valid 5K VO2 references", () => {
    const base = required(calculateCatalogWorkout("X-VO2-05", input()))
    const changed = required(calculateCatalogWorkout("X-VO2-05", input({ paceReferences: [ref("X-VO2-05-1-1"), ref("X-VO2-05-1-2")] })))
    const work = changed.steps.filter(s => s.phase === "main" && s.kind === "WORK")
    expect(work).toHaveLength(6)
    expect(work.map(s => s.set)).toEqual([1, 1, 2, 2, 3, 3])
    expect(work.map(s => s.distanceM)).toEqual([400, 600, 400, 600, 400, 600])
    expect(work.map(s => s.seconds)).toEqual([80, 120, 80, 120, 80, 120].map(seconds => ({ minimum: seconds, maximum: seconds })))
    expect(work.reduce((sum, s) => sum + required(s.seconds).minimum, 0)).toBe(600)
    expect(changed.steps.filter(s => s.kind === "RECOVERY")).toEqual(base.steps.filter(s => s.kind === "RECOVERY"))
    expect(changed.steps.filter(s => s.phase !== "main")).toEqual(base.steps.filter(s => s.phase !== "main"))
    expect(changed.steps.filter(s => s.phase === "main" && s.kind === "RECOVERY").map(s => s.seconds?.minimum))
      .toEqual([90, 180, 90, 180, 90])
    expect(changed.totals.workOccurrences).toBe(base.totals.workOccurrences)
    expect(changed.totals.recoveryOccurrences).toBe(base.totals.recoveryOccurrences)
    expect(changed.totals.mainDistanceM).toBe(3000)
    expect(changed.unavailable).toEqual([])
    expect(verifyCalculatedWorkout(changed)).toBe(true)
  })

  it.each([800, 1500, 3000, 5000, 10000, 21097.5, 42195])("supports plan event %s using only the 5K source model", (eventDistanceM) => {
    const changed = required(calculateCatalogWorkout(VO2_ID, input({ eventDistanceM, paceReferences: [ref(VO2_SEGMENT)] })))
    expect(changed.unavailable).toEqual([])
    const work = changed.steps.filter(s => s.phase === "main" && s.kind === "WORK")
    expect(work).toHaveLength(8)
    expect(work.every(s => s.seconds?.minimum === 80 && s.seconds.maximum === 80)).toBe(true)
    expect(changed.inputs.paceReferences?.[0]?.eventDistanceM).toBe(5000)
    expect(changed.steps.filter(s => s.phase === "main" && s.kind === "RECOVERY").map(s => s.seconds?.minimum))
      .toEqual([90, 90, 90, 90, 90, 90, 90])
  })

  it.each([21097, 21097.5])("accepts half input %s against legacy catalog event scopes", (eventDistanceM) => {
    const result = required(calculateCatalogWorkout(VO2_ID, input({ eventDistanceM, paceReferences: [ref(VO2_SEGMENT)] })))
    expect(result.unavailable).not.toContain("EVENT_SCOPE")
    expect(result.steps.filter(s => s.phase === "main" && s.kind === "WORK").map(s => s.seconds?.minimum))
      .toEqual([80, 80, 80, 80, 80, 80, 80, 80])
  })

  it("rejects a MIX reference without changing its unknown or final roll-on recovery", () => {
    const base = required(calculateCatalogWorkout("P-RHYTHM-300", input()))
    expect(calculateCatalogWorkout("P-RHYTHM-300", input({ paceReferences: [ref()] }))).toBeNull()
    const changed = required(calculateCatalogWorkout("P-RHYTHM-300", input()))
    const recovery = changed.steps.filter(s => s.phase === "main" && s.kind === "RECOVERY")
    expect(recovery).toEqual(base.steps.filter(s => s.phase === "main" && s.kind === "RECOVERY"))
    expect(recovery.filter(s => s.distanceM === 100)).toHaveLength(6)
    expect(recovery.filter(s => s.distanceM === 100).every(s => s.seconds === null)).toBe(true)
    expect(changed.unresolved).toContain("RECOVERY_DISTANCE_WITHOUT_PACE")
    expect(changed.totals.seconds).toBeNull()
    const main = changed.steps.filter(s => s.phase === "main")
    expect(main.at(-1)).toMatchObject({ kind: "RECOVERY", distanceM: 100, seconds: null })
  })

  it("keeps duration-based termination fixed and limits the threshold model to LT", () => {
    const reference = createSegmentRecordReference("part-0", actual({ eventDistanceM: 5000, performanceSeconds: 1000 }), "2026-10-02", "FIVE_K_THRESHOLD_V1")
    const base = required(calculateCatalogWorkout("P-LT-S", input()))
    const changed = required(calculateCatalogWorkout("P-LT-S", input({ paceReferences: [reference] })))
    const work = changed.steps.filter(s => s.phase === "main" && s.kind === "WORK")
    expect(work).toHaveLength(3)
    expect(work.map(s => s.seconds)).toEqual(Array.from({ length: 3 }, () => ({ minimum: 420, maximum: 420 })))
    expect(work.every(s => s.distanceM === null)).toBe(true)
    expect(required(work[0]).paceSecondsPerKm?.minimum).toBeCloseTo(214.912908613696, 9)
    expect(changed.steps.filter(s => s.kind === "RECOVERY")).toEqual(base.steps.filter(s => s.kind === "RECOVERY"))
    expect(calculateCatalogWorkout("P-GLY-D", input({ paceReferences: [reference] }))).toBeNull()
  })

  it("applies a reference only to the selected purpose in a compound workout", () => {
    const inputs = input({ confirmedRequirements: ["COMPOUND_TRAINING_EXPERIENCE"] })
    const base = required(calculateCatalogWorkout("X-MIX-09", inputs))
    const changed = required(calculateCatalogWorkout("X-MIX-09", { ...inputs, paceReferences: [ref("X-MIX-09-1-2")] }))
    expect(changed.steps.filter(s => s.segmentId !== "X-MIX-09-1-2"))
      .toEqual(base.steps.filter(s => s.segmentId !== "X-MIX-09-1-2"))
    const selected = changed.steps.filter(s => s.segmentId === "X-MIX-09-1-2")
    expect(selected).toHaveLength(3)
    expect(selected.every(s => s.targetModel === "ACTUAL_RACE_REFERENCE" && s.seconds?.minimum === 120)).toBe(true)
  })

  it.each([
    ["X-HILL-05", "X-HILL-05-1-1", "UPHILL"],
    ["P-ATP-T", "part-0", "ATP-PC"],
    ["P-ATP-F", "part-0", "BUILDUP"],
    ["P-ATP-F", "part-1", "UNDER_60M"],
    ["X-VO2-01", "warmup-0", "PREPARATION"],
    ["X-VO2-01", "X-VO2-01-1:between:recovery-0", "RECOVERY"],
  ])("rejects %s/%s record reference (%s), not the catalog itself", (catalogId, segmentId, reason) => {
    const inputs = input({ confirmedRequirements: ["HILL_SURFACE_GRADE_RETURN", "ACCELERATION_AND_DECELERATION_SPACE"] })
    const base = required(calculateCatalogWorkout(catalogId, inputs))
    const step = required(base.steps.find(s => s.segmentId === segmentId))
    if (reason === "UPHILL") expect(step.terrain).toBe("UPHILL")
    else if (reason === "ATP-PC") { expect(step.intent).toBe("ATP-PC"); expect(step.distanceM).toBeNull() }
    else if (reason === "UNDER_60M") expect(step.distanceM).toBe(10)
    else expect(step.kind).toBe(reason)
    expect(recordPaceSegments(catalogId, inputs).map(s => s.segmentId)).not.toContain(segmentId)
    expect(calculateCatalogWorkout(catalogId, { ...inputs, paceReferences: [ref(segmentId)] })).toBeNull()
  })

  it("rejects duplicate, conflicting, unknown, and prediction references atomically", () => {
    const reference = ref(VO2_SEGMENT)
    expect(calculateCatalogWorkout(VO2_ID, input({ paceReferences: [reference] }))).not.toBeNull()
    expect(calculateCatalogWorkout(VO2_ID, input({ paceReferences: [reference, reference] }))).toBeNull()
    expect(calculateCatalogWorkout(VO2_ID, input({ paceReferences: [ref("unknown")] }))).toBeNull()
    expect(calculateCatalogWorkout(VO2_ID, input({ paceReferences: [reference], segmentPaces: [{ segmentId: VO2_SEGMENT, secondsPerKm: 200 }] }))).toBeNull()
    expect(calculateCatalogWorkout(VO2_ID, input({ paceReferences: [reference], segmentSeconds: [{ segmentId: VO2_SEGMENT, seconds: 30 }] }))).toBeNull()
    const prediction = required(predictRaceFromActual({ kind: "ACTUAL", recordId: "source", eventDistanceM: 800, performanceSeconds: 121.5 }, 1500))
    const invalid = { ...input(), paceReferences: [{ ...reference, ...prediction }] }
    // @ts-expect-error Prediction provenance is never a segment record reference.
    expect(calculateCatalogWorkout(VO2_ID, invalid)).toBeNull()
  })

  it.each(["ACTUAL", "GOAL"] as const)("rejects the 800m RP to 20-minute LT regression for %s", (kind) => {
    const valid = { ...ref(), kind, achievedOn: kind === "GOAL" ? null : "2026-10-01", model: "FIVE_K_THRESHOLD_V1" as const }
    const control = required(calculateCatalogWorkout("P-LT-C", input({ paceReferences: [valid] })))
    expect(control.unavailable).toEqual([])
    expect(control.steps.find(s => s.phase === "main" && s.kind === "WORK")?.seconds).toEqual({ minimum: 1200, maximum: 1200 })
    const wrong = { ...valid, eventDistanceM: 800, performanceSeconds: 121.5, model: "RACE_AVERAGE_V1" as const }
    expect(isSegmentPaceReference(wrong)).toBe(true)
    expect(calculateCatalogWorkout("P-LT-C", input({ paceReferences: [wrong] }))).toBeNull()
  })

  it.each([800, 1500, 3000, 10000, 21097, 21097.5, 42195])("rejects wrong source-event mutation %s in both LT and VO2", (eventDistanceM) => {
    for (const kind of ["ACTUAL", "GOAL"] as const) {
      for (const [catalogId, segmentId, model] of [["P-LT-C", "part-0", "FIVE_K_THRESHOLD_V1"], [VO2_ID, VO2_SEGMENT, "RACE_AVERAGE_V1"]] as const) {
        const valid = { ...ref(segmentId), kind, achievedOn: kind === "GOAL" ? null : "2026-10-01", model }
        expect(calculateCatalogWorkout(catalogId, input({ paceReferences: [valid] }))).not.toBeNull()
        expect(calculateCatalogWorkout(catalogId, input({ paceReferences: [{ ...valid, eventDistanceM }] }))).toBeNull()
      }
    }
  })

  it.each([
    ["P-LT-C", "part-0", "FIVE_K_THRESHOLD_V1", "RACE_AVERAGE_V1"],
    ["X-VO2-01", "X-VO2-01-1-1", "RACE_AVERAGE_V1", "FIVE_K_THRESHOLD_V1"],
  ] as const)("rejects model-only mutation on %s from %s", (catalogId, segmentId, model, wrongModel) => {
    for (const kind of ["ACTUAL", "GOAL"] as const) {
      const valid = { ...ref(segmentId), kind, achievedOn: kind === "GOAL" ? null : "2026-10-01", model }
      expect(calculateCatalogWorkout(catalogId, input({ paceReferences: [valid] }))).not.toBeNull()
      const mutated = { ...valid, model: wrongModel }
      expect(isSegmentPaceReference(mutated)).toBe(true)
      expect(calculateCatalogWorkout(catalogId, input({ paceReferences: [mutated] }))).toBeNull()
    }
  })

  it.each([["P-GLY-D", "GLY"], ["P-RHYTHM-300", "MIX"]])("rejects both 5K models for unsupported %s intent %s", (catalogId, intent) => {
    const base = required(calculateCatalogWorkout(catalogId, input()))
    expect(base.steps.find(s => s.phase === "main" && s.kind === "WORK")?.intent).toBe(intent)
    expect(recordPaceSegments(catalogId, input())).toEqual([])
    for (const model of ["RACE_AVERAGE_V1", "FIVE_K_THRESHOLD_V1"] as const) {
      expect(calculateCatalogWorkout(catalogId, input({ paceReferences: [{ ...ref(), model }] }))).toBeNull()
    }
  })
})
