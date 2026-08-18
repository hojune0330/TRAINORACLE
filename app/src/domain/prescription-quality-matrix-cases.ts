export type MatrixCase = {
  readonly caseId: string
  readonly eventDistanceM: 800 | 1500 | 3000 | 5000
  readonly eventGroup: "MIDDLE_DISTANCE" | "FIVE_K"
  readonly performanceSeconds: number
  readonly targetRepSeconds: number
  readonly competitionDivision: "HIGH_SCHOOL" | "COLLEGE" | "OPEN"
  readonly reportedSex: "MALE" | "FEMALE"
  readonly performanceTier: "HIGH" | "MID" | "LOW"
  readonly requestedFrameLength: 7 | 9 | 10
  readonly availableDayCount: 3 | 4 | 6 | "EVERY_DAY"
  readonly secondSessionMode: "SINGLE_SESSION_ONLY" | "RECOVERY_PM_ALLOWED"
  readonly trainingTimePreference: "MORNING" | "EVENING" | "VARIES"
  readonly withRecentJournal: boolean
}

export const SUPPORTED_CASES = [
  { caseId: "800-hs-male-high-7d", eventDistanceM: 800, eventGroup: "MIDDLE_DISTANCE", performanceSeconds: 122, targetRepSeconds: 30.5, competitionDivision: "HIGH_SCHOOL", reportedSex: "MALE", performanceTier: "HIGH", requestedFrameLength: 7, availableDayCount: 3, secondSessionMode: "SINGLE_SESSION_ONLY", trainingTimePreference: "MORNING", withRecentJournal: false },
  { caseId: "1500-hs-female-mid-9d-double", eventDistanceM: 1500, eventGroup: "MIDDLE_DISTANCE", performanceSeconds: 245, targetRepSeconds: 245 * 500 / 1500, competitionDivision: "HIGH_SCHOOL", reportedSex: "FEMALE", performanceTier: "MID", requestedFrameLength: 9, availableDayCount: 4, secondSessionMode: "RECOVERY_PM_ALLOWED", trainingTimePreference: "EVENING", withRecentJournal: false },
  { caseId: "3000-college-male-low-10d", eventDistanceM: 3000, eventGroup: "MIDDLE_DISTANCE", performanceSeconds: 611, targetRepSeconds: 611 * 800 / 3000, competitionDivision: "COLLEGE", reportedSex: "MALE", performanceTier: "LOW", requestedFrameLength: 10, availableDayCount: 6, secondSessionMode: "SINGLE_SESSION_ONLY", trainingTimePreference: "VARIES", withRecentJournal: false },
  { caseId: "5000-open-female-high-10d-daily-double-morning", eventDistanceM: 5000, eventGroup: "FIVE_K", performanceSeconds: 1110, targetRepSeconds: 222, competitionDivision: "OPEN", reportedSex: "FEMALE", performanceTier: "HIGH", requestedFrameLength: 10, availableDayCount: "EVERY_DAY", secondSessionMode: "RECOVERY_PM_ALLOWED", trainingTimePreference: "MORNING", withRecentJournal: false },
  { caseId: "5000-open-female-high-10d-daily-double", eventDistanceM: 5000, eventGroup: "FIVE_K", performanceSeconds: 1110, targetRepSeconds: 222, competitionDivision: "OPEN", reportedSex: "FEMALE", performanceTier: "HIGH", requestedFrameLength: 10, availableDayCount: "EVERY_DAY", secondSessionMode: "RECOVERY_PM_ALLOWED", trainingTimePreference: "EVENING", withRecentJournal: true },
] as const satisfies readonly MatrixCase[]

export const PERSONA_COVERAGE = [
  ...(["MALE", "FEMALE"] as const).flatMap((reportedSex) =>
    (["HIGH", "MID", "LOW"] as const).map((performanceTier) => ({ competitionDivision: "HIGH_SCHOOL" as const, reportedSex, performanceTier })),
  ),
  { competitionDivision: "COLLEGE" as const, reportedSex: null, performanceTier: null },
  { competitionDivision: "OPEN" as const, reportedSex: null, performanceTier: null },
]

export const EVIDENCE_COVERAGE = [
  { state: "NONE", caseId: "no-record", runtimeMeaning: "No stored record and no selected anchor." },
  { state: "SPARSE", caseId: "stored-unselected", runtimeMeaning: "A stored record without an explicitly selected CURRENT same-event anchor." },
  { state: "CURRENT_SAME_EVENT_WITH_SUFFICIENT_JOURNAL", caseId: "5000-open-female-high-10d-daily-double", runtimeMeaning: "A selected CURRENT same-event anchor plus two usable recent journal sessions." },
] as const
