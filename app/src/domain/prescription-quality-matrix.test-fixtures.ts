import { writeFileSync } from "node:fs"
import { expect } from "vitest"
import type { PlanBetaIntake } from "./plan-beta-schema"
import { createSelfReportedAthleteRecord, saveAthleteRecord } from "./athlete-records"
import { MEMO_PURPOSE } from "./journal-schema"
import { saveEntry } from "./journal-store"

export const TODAY = new Date("2026-08-17T03:00:00.000Z")
export const RAW_MARKER = "MATRIX_RAW_FREE_TEXT_9f86d081"

export type MatrixCase = {
  readonly caseId: string
  readonly eventDistanceM: 800 | 1500 | 3000 | 5000
  readonly eventGroup: "MIDDLE_DISTANCE" | "FIVE_K"
  readonly performanceSeconds: number
  readonly targetRepSeconds: number
  readonly requestedFrameLength: 7 | 9 | 10
  readonly availableDayCount: 3 | 4 | 6 | "EVERY_DAY"
  readonly secondSessionMode: "SINGLE_SESSION_ONLY" | "RECOVERY_PM_ALLOWED"
  readonly trainingTimePreference: "MORNING" | "EVENING" | "VARIES"
  readonly withRecentJournal: boolean
}

export const RUNTIME_CASES = [
  { caseId: "800-current-7d", eventDistanceM: 800, eventGroup: "MIDDLE_DISTANCE", performanceSeconds: 122, targetRepSeconds: 30.5, requestedFrameLength: 7, availableDayCount: 3, secondSessionMode: "SINGLE_SESSION_ONLY", trainingTimePreference: "MORNING", withRecentJournal: false },
  { caseId: "1500-current-9d-double", eventDistanceM: 1500, eventGroup: "MIDDLE_DISTANCE", performanceSeconds: 245, targetRepSeconds: 245 * 500 / 1500, requestedFrameLength: 9, availableDayCount: 4, secondSessionMode: "RECOVERY_PM_ALLOWED", trainingTimePreference: "EVENING", withRecentJournal: false },
  { caseId: "3000-current-10d", eventDistanceM: 3000, eventGroup: "MIDDLE_DISTANCE", performanceSeconds: 611, targetRepSeconds: 611 * 800 / 3000, requestedFrameLength: 10, availableDayCount: 6, secondSessionMode: "SINGLE_SESSION_ONLY", trainingTimePreference: "VARIES", withRecentJournal: false },
  { caseId: "5000-current-10d-daily-double-morning", eventDistanceM: 5000, eventGroup: "FIVE_K", performanceSeconds: 1110, targetRepSeconds: 222, requestedFrameLength: 10, availableDayCount: "EVERY_DAY", secondSessionMode: "RECOVERY_PM_ALLOWED", trainingTimePreference: "MORNING", withRecentJournal: false },
  { caseId: "5000-current-10d-daily-double-evening", eventDistanceM: 5000, eventGroup: "FIVE_K", performanceSeconds: 1110, targetRepSeconds: 222, requestedFrameLength: 10, availableDayCount: "EVERY_DAY", secondSessionMode: "RECOVERY_PM_ALLOWED", trainingTimePreference: "EVENING", withRecentJournal: true },
] as const satisfies readonly MatrixCase[]

export const SAMPLED_REVIEW_METADATA = [
  ...(["MALE", "FEMALE"] as const).flatMap((reportedSex) =>
    (["HIGH", "MID", "LOW"] as const).map((performanceTier) => ({ divisionLabel: "HIGH_SCHOOL" as const, reportedSex, performanceTier })),
  ),
  { divisionLabel: "COLLEGE" as const, reportedSex: null, performanceTier: null },
  { divisionLabel: "OPEN" as const, reportedSex: null, performanceTier: null },
] as const

export const EVIDENCE_SAMPLES = [
  { state: "NONE", caseId: "no-record", runtimeMeaning: "No stored record and no selected anchor." },
  { state: "SPARSE", caseId: "stored-unselected", runtimeMeaning: "A stored record without an explicitly selected CURRENT same-event anchor." },
  { state: "CURRENT_SAME_EVENT_WITH_SUFFICIENT_JOURNAL", caseId: "5000-current-10d-daily-double-evening", runtimeMeaning: "A selected CURRENT same-event anchor plus two usable recent journal sessions." },
] as const

export const EXTERNAL_POPULATION_REVIEW_LABELS = ["YOUTH_REVIEW", "ADULT_REVIEW"] as const

export type MatrixObservation = {
  readonly caseId: string
  readonly outcome: "DETAILED" | "RPE_FALLBACK" | "BLOCKED"
  readonly code: string
  readonly candidateCount: number
  readonly selfSelectionAllowed: boolean
  readonly rawFreeTextRetained: boolean
}

export type PopulationContractObservation = {
  readonly reviewLabels: readonly string[]
  readonly labelsPassedToRuntime: boolean
  readonly runtimeInputsIdentical: boolean
  readonly prescriptionsEqual: boolean
  readonly populationScopes: readonly string[]
}

export function draftFor(fixture: MatrixCase): PlanBetaIntake {
  return {
    eventGroup: fixture.eventGroup,
    competitionDivision: "OPEN",
    experienceBand: "EXPERIENCED",
    availableDayCount: fixture.availableDayCount,
    requestedFrameLength: fixture.requestedFrameLength,
    trainingFocus: "VO2_INTENT",
    secondSessionMode: fixture.secondSessionMode,
    trainingTimePreference: fixture.trainingTimePreference,
  }
}

export function saveCurrentRecord(eventDistanceM: number, performanceSeconds: number): string {
  const id = `matrix-current-${eventDistanceM}`
  const record = createSelfReportedAthleteRecord({
    id,
    purpose: "RECENT_RESULT",
    eventDistanceM,
    performanceSeconds,
    achievedOn: "2026-08-10",
    seasonId: null,
  }, TODAY)
  if (record === null) throw new TypeError("Matrix record fixture is invalid")
  expect(saveAthleteRecord(record, TODAY)).toEqual({ ok: true, total: 1 })
  return id
}

export function saveRecentJournalContext(): void {
  for (const [index, date] of ["2026-08-15", "2026-08-16"].entries()) {
    const saved = saveEntry({
      id: `matrix-session-${index}`,
      kind: "post-session",
      date,
      savedAt: `${date}T10:00:00.000Z`,
      syncState: "local",
      system: "base",
      title: "Matrix context",
      distanceKm: "8",
      durationMin: "45",
      avgPace: "5:30",
      rpe: 4,
      memo: RAW_MARKER,
      memoPurpose: MEMO_PURPOSE.analyzableTrainingNote,
    })
    if (!saved.ok) throw new TypeError("Matrix journal fixture is invalid")
  }
}

export function writeMatrixReport(
  observations: readonly MatrixObservation[],
  populationContractObservations: readonly PopulationContractObservation[],
): void {
  const reportPath = process.env.PRESCRIPTION_MATRIX_REPORT
  if (reportPath === undefined) return
  writeFileSync(reportPath, `${JSON.stringify({
    schemaVersion: 2,
    reviewBaseCommit: "e18f09998f9f4619a375909e338848c3c9310864",
    sourceCommit: "PARENT_TO_FILL_AFTER_CODE_TEST_COMMIT",
    evaluatedAt: TODAY.toISOString(),
    executedRuntimeInputs: ["event", "experienceBand", "recordEvidence", "frameLength", "trainingDays", "secondSessionMode", "trainingTimePreference", "D9"],
    sampledReviewMetadataFields: ["divisionLabel", "reportedSex", "performanceTier"],
    sampledReviewMetadataNotice: "These labels are not passed as dose inputs and are not Cartesian executable coverage.",
    sampledReviewMetadata: SAMPLED_REVIEW_METADATA,
    evidenceSamples: EVIDENCE_SAMPLES,
    executedGenerationCases: RUNTIME_CASES,
    populationContractObservations,
    observations,
    unsupportedCombinations: [
      { combination: "age- or sex-specific prescription", status: "NOT_A_RUNTIME_DOSE_AXIS", reason: "Age and sex are not passed as runtime dose inputs." },
      { combination: "high/mid/low performance-tier prescription", status: "SAMPLED_REVIEW_METADATA_ONLY", reason: "No approved performance-tier runtime mapping exists." },
      { combination: "division-specific prescription", status: "SAMPLED_REVIEW_METADATA_ONLY", reason: "Division labels are not evaluated as a dose axis." },
      { combination: "100-400m detailed prescription", status: "DEFERRED_RPE_FALLBACK", reason: "No approved detailed template is active in this scope." },
      { combination: "DEVELOPING or NEW_TO_RUNNING detailed prescription", status: "RPE_FALLBACK", reason: "Active detailed approvals are scoped to EXPERIENCED." },
      { combination: "missing or unselected record evidence", status: "RPE_FALLBACK", reason: "An explicit CURRENT same-event anchor is required." },
    ],
  }, null, 2)}\n`)
}
