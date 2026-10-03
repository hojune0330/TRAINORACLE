import { calculateCatalogWorkout, type WorkoutCalculationInputs } from "@impl/prescription/all-workout-calculator"
import { canonicalPaceDistance, type SegmentPaceReference } from "@impl/prescription/record-pace"
import type { AthleteRecord } from "./athlete-records"

export function createSegmentRecordReference(segmentId: string, record: AthleteRecord, evaluatedOn: string,
  model: SegmentPaceReference["model"] = "RACE_AVERAGE_V1"): SegmentPaceReference {
  return { segmentId, kind: record.purpose === "RACE_GOAL" ? "GOAL" : "ACTUAL", recordId: record.id,
    recordVersion: record.savedAt, eventDistanceM: canonicalPaceDistance(record.eventDistanceM),
    performanceSeconds: record.performanceSeconds, achievedOn: record.achievedOn, evaluatedOn, confirmed: true, model }
}

export function recordPaceSegments(catalogId: string, inputs: WorkoutCalculationInputs) {
  const calculation = calculateCatalogWorkout(catalogId, { ...inputs, paceReferences: [], segmentPaces: [], segmentSeconds: [] })
  return calculation?.steps.filter(s => s.phase === "main" && s.kind === "WORK" && s.modality === "RUN" && s.terrain === "FLAT"
    && (s.distanceM === null || s.distanceM >= 60) && ["LT", "VO2", "RACE_PACE"].includes(s.intent))
    .filter((s, i, rows) => rows.findIndex(r => r.segmentId === s.segmentId) === i) ?? []
}

export function replaceSegmentReference(inputs: WorkoutCalculationInputs, segmentId: string, reference: SegmentPaceReference | null): WorkoutCalculationInputs {
  return { ...inputs, paceReferences: [...(inputs.paceReferences ?? []).filter(r => r.segmentId !== segmentId), ...(reference ? [reference] : [])],
    segmentPaces: inputs.segmentPaces.filter(r => r.segmentId !== segmentId),
    ...(inputs.segmentSeconds === undefined ? {} : { segmentSeconds: inputs.segmentSeconds.filter(r => r.segmentId !== segmentId) }) }
}
