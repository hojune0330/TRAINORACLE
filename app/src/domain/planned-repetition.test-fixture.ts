import { createSelfReportedAthleteRecord, saveAthleteRecord } from "./athlete-records"
import { DETAILED_PRESCRIPTION_APPROVALS } from "./detailed-prescription-approvals"
import { generatePlanFromDraft } from "./plan-beta-flow"
import { createPlannedSessionLogDraft } from "./planned-session-link"
import type { PostSessionEntry } from "./journal-schema"
import type { OriginalPlanLookup } from "./plan-execution-review"
import type { PlannedRepetitionEvidence } from "./planned-repetition-evidence"

export const REPETITION_TEST_NOW = new Date("2026-09-30T03:00:00.000Z")
export function repetitionFixture(templateId = "V2-SEED-05", recordSeconds = 1111.5) {
  const record = createSelfReportedAthleteRecord({ id: "rep-record", purpose: "RECENT_RESULT", eventDistanceM: 5000,
    performanceSeconds: recordSeconds, achievedOn: "2026-09-25", seasonId: null }, REPETITION_TEST_NOW)!
  if (!saveAthleteRecord(record, REPETITION_TEST_NOW).ok) throw Error("Fixture record did not save")
  const approval = DETAILED_PRESCRIPTION_APPROVALS.find(item => item.templateId === templateId)
  if (!approval) throw Error(`Fixture approval missing: ${templateId}`)
  const result = generatePlanFromDraft({ eventGroup: "FIVE_K", eventDistanceM: 5000, competitionDivision: "OPEN",
    experienceBand: "EXPERIENCED", availableDayCount: 5, requestedFrameLength: 9,
    trainingFocus: "VO2_INTENT", secondSessionMode: "SINGLE_SESSION_ONLY", trainingTimePreference: "VARIES",
    selectedDetailedTemplateRef: { templateId, version: approval.templateVersion, fingerprint: approval.templateContentFingerprint },
  }, "NO_KNOWN_RISK", { selectedRecordId: record.id })
  if (result.kind !== "generated" || result.prescriptionBinding.kind !== "bound") throw Error(`Fixture did not bind: ${JSON.stringify(result)}`)
  const candidate = result.generated.candidates[0]
  const session = candidate.sessions.find(item => item.prescription.kind === "PACE_TARGET")!
  if (session.prescription.kind !== "PACE_TARGET") throw Error("Missing numeric prescription")
  const state = { intake: { ...result.intake, startDate: "2026-09-30" }, generatedAt: REPETITION_TEST_NOW.toISOString(), activePlan: candidate }
  const link = createPlannedSessionLogDraft(state, session, REPETITION_TEST_NOW.toISOString())!.link
  const evidence: PlannedRepetitionEvidence = { version: 1, source: "SELF_REPORTED", plannedSessionId: link.plannedSessionId,
    sessionContentFingerprint: link.sessionContentFingerprint, results: [{ set: 1, repetition: 1, distanceM: 1000, seconds: 222.3 }] }
  const entry: PostSessionEntry = { id: "repetition-entry", date: link.plannedDate, kind: "post-session",
    savedAt: REPETITION_TEST_NOW.toISOString(), syncState: "local", activityOutcome: "PARTIAL", activitySlot: session.slot,
    planExecutionRelation: "MODIFIED", title: "PRIVATE-TITLE", memo: "PRIVATE-MEMO", memoPurpose: "PRIVATE_SELF_ONLY",
    distanceKm: "", durationMin: "", avgPace: "", rpe: 0, system: "", plannedSessionLink: link,
    exerciseLog: { version: 1, source: "SELF_REPORTED", components: [], plannedRepetitions: evidence } }
  const original = { kind: "matched", session, source: "ACTIVE", state } as unknown as OriginalPlanLookup
  return { session, prescription: session.prescription, link, evidence, entry, original, record, result }
}
