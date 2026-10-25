import { deriveCandidateId, derivePairId } from "@impl/plan-generator/candidate-identity"
import { parseAthleteRecord, type AthleteRecord } from "./athlete-records"
import { isoShift } from "./dates"
import { parseJournalEntryForWrite, type JournalEntry, type PostSessionEntry } from "./journal-schema"
import { ORACLE_EXAMPLE_TODAY, oracleReportPeriod, type OracleReportMonths } from "./oracle-report"
import { buildOraclePersonalResult, type OraclePersonalResult, type OracleTopicId } from "./oracle-personal-result"
import { planBetaStateV3Schema, type PlanBetaState } from "./plan-beta-schema"
import type { PlanJournalHistory } from "./plan-journal-evidence"
import { createPlannedSessionLogDraft } from "./planned-session-link"

export type OracleDemoScenario = {
  readonly id: "fictional-runner-2026-apr-sep-v1"
  readonly label: string
  readonly today: string
  readonly startDate: string
  readonly endDate: string
  readonly entries: readonly JournalEntry[]
  readonly athleteRecords: readonly AthleteRecord[]
  readonly planState: PlanBetaState
  readonly planHistory: PlanJournalHistory
}
const explicit = { provenance: "EXPLICIT" } as const
const missing = { provenance: "MISSING" } as const

function demoPlan(): PlanBetaState {
  const candidateBaseId = "beta:balanced:five_k:event-5000:developing:lt_intent:single_session_only:varies:projection-9:local-civil-9-5:fixture-main-1-fixture-main-2:1-5-9:no_usable_journal:no-continuity:template-rpe-only"
  const pairBaseId = "plan-pair:v3:5000:rpe-only:lt_intent:fixture-main-1-fixture-main-2:1-5-9:no-continuity"
  const frame = { formationKind: "LOCAL_CIVIL_9_5", lengthDays: 9.5, slotCount: 19, projectionLengthDays: 9, continuity: { kind: "STANDARD_FRAME" } } as const
  const sessions = [1, 3, 6, 9].map(day => ({
    day, slot: "AM", role: "EASY", plannedEnergyIntent: "BASE_INTENT",
    prescription: { kind: "RPE_TIME_RANGE", rpe: { minimum: 2, maximum: 4 }, durationMinutes: { minimum: 20, maximum: 30 } },
  } as const))
  const projection = { kind: "BALANCED", eventDistanceM: 5000, selectedDetailedTemplateRef: null, selectedEnergyIntent: "LT_INTENT", sourceMode: "PROFILE_ONLY", selectionAuthority: "SELF", frame, sessions } as const
  const candidateId = deriveCandidateId(candidateBaseId, projection)
  const conservativeId = deriveCandidateId(candidateBaseId.replace("beta:balanced:", "beta:conservative:"), { ...projection, kind: "CONSERVATIVE" })
  return planBetaStateV3Schema.parse({
    version: 3,
    intake: { eventGroup: "FIVE_K", eventDistanceM: 5000, competitionDivision: "OPEN", experienceBand: "DEVELOPING", availableDayCount: 4, requestedFrameLength: 9, trainingFocus: "LT_INTENT", secondSessionMode: "SINGLE_SESSION_ONLY", trainingTimePreference: "VARIES", selectedDetailedTemplateRef: null, startDate: "2026-09-22" },
    activePlan: { kind: "BETA_ACTIVE_PLAN_SNAPSHOT", activationState: "SELECTED_BETA_SNAPSHOT", candidateId, pairId: derivePairId(pairBaseId, candidateId, conservativeId), candidateKind: "BALANCED", eventDistanceM: 5000, selectedDetailedTemplateRef: null, selectionActor: "SELF", sourceMode: "PROFILE_ONLY", selectedEnergyIntent: "LT_INTENT", frame, sessions },
    progress: [], generatedAt: "2026-09-21T09:00:00.000Z",
  })
}

function session(date: string, system: string, distance: number | null, minutes: number | null, rpe: number): PostSessionEntry {
  return {
    id: `oracle-demo-session-${date}`, kind: "post-session", date, savedAt: `${date}T09:00:00.000Z`, syncState: "local",
    captureDepth: "DETAILED", activityOutcome: "COMPLETED", activitySlot: "AM", painCheckStatus: "NO_SIGNAL_REPORTED",
    system, title: "가상 예시 훈련", distanceKm: distance === null ? "" : String(distance), durationMin: minutes === null ? "" : String(minutes), avgPace: "", rpe, memo: "",
    fieldProvenance: { system: explicit, distanceKm: distance === null ? missing : explicit, durationMin: minutes === null ? missing : explicit, avgPace: missing, rpe: rpe > 0 ? explicit : missing, activityOutcome: explicit, activitySlot: explicit, painCheckStatus: explicit },
  }
}

/** A single fictional history, generated deterministically without clocks, random
 * values or storage. The 3-month view slices this same April–September history. */
export function buildOracleDemoScenario(): OracleDemoScenario {
  const entries: JournalEntry[] = []
  const baseDistances = [6, 7, 7, 8, 7, 8]
  for (let day = 0; day < 183; day += 1) {
    const date = isoShift("2026-04-01", day)
    const weekday = new Date(`${date}T12:00:00`).getDay()
    const monthIndex = Number(date.slice(5, 7)) - 4
    const cutback = Math.floor(day / 7) % 4 === 3
    const gap = date >= "2026-06-15" && date <= "2026-06-21"
    if (gap) continue // no observations: never manufactured rest or zero distance
    if ([1, 3, 6].includes(weekday) && date < "2026-09-22") {
      const distance = (baseDistances[monthIndex] ?? 6) + (weekday === 6 ? 3 : 0) - (cutback ? 2 : 0)
      const system = weekday === 3 ? (monthIndex % 2 === 0 ? "lt" : "vo2") : "base"
      entries.push(session(date, system, date === "2026-08-12" ? null : distance, date === "2026-07-08" ? null : distance * (weekday === 3 ? 5 : 6), date === "2026-05-09" ? 0 : weekday === 3 ? 7 : 4))
    }
    if (weekday === 0) {
      entries.push({
        id: `oracle-demo-rest-${date}`, kind: "post-session", date, savedAt: `${date}T09:00:00.000Z`, syncState: "local",
        title: "가상 예시 휴식", system: "", distanceKm: "", durationMin: "", avgPace: "", rpe: 0, memo: "",
        activityOutcome: "RESTED", objectiveDataState: "NONE",
        fieldProvenance: { system: missing, distanceKm: missing, durationMin: missing, avgPace: missing, rpe: missing, activityOutcome: explicit },
      })
    }
    if ([1, 3, 6].includes(weekday)) {
      const pain = date === "2026-07-11" || date === "2026-07-13" ? 1 : 0
      entries.push({
        id: `oracle-demo-condition-${date}`, kind: "evening", date, savedAt: `${date}T13:00:00.000Z`, syncState: "local",
        sleepH: weekday === 3 ? 7 : 8, sleepQuality: weekday === 3 ? 3 : 4, weightKg: "", restingHr: "", mood: cutback ? 3 : 4,
        painParts: { left_calf: pain }, note: "", fieldProvenance: { sleepH: explicit, sleepQuality: explicit, weightKg: missing, restingHr: missing, mood: explicit, painParts: explicit },
      })
    }
  }
  const planState = demoPlan()
  for (const planned of planState.activePlan.sessions) {
    const draft = createPlannedSessionLogDraft(planState, planned, planState.generatedAt)
    if (draft === null) throw new Error("Fictional plan link must validate")
    const entry = session(draft.date, "base", 5, 30, planned.day === 6 ? 5 : 4)
    entries.push({ ...entry, plannedSessionLink: draft.link, planExecutionRelation: "AS_PLANNED", fieldProvenance: { ...entry.fieldProvenance, plannedSessionLink: explicit, planExecutionRelation: { provenance: "DERIVED", derivedFrom: ["activityOutcome", "activitySlot", "plannedSessionLink"], derivationRuleId: "QUICK_PLAN_EXECUTION_RELATION_V2" } } })
  }
  const athleteRecords: AthleteRecord[] = [
    ["2026-04-26", 1350], ["2026-06-28", 1326], ["2026-09-13", 1305],
  ].map(([date, seconds]) => ({
    schemaVersion: 1, id: `oracle-demo-race-${date}`, purpose: "RECENT_RESULT", eventDistanceM: 5000, performanceSeconds: Number(seconds), achievedOn: String(date), seasonId: null,
    enteredBy: "ATHLETE", verificationState: "SELF_REPORTED", sourceRef: `athlete-record:oracle-demo-race-${date}`, savedAt: `${date}T09:00:00.000Z`,
  }))
  return {
    id: "fictional-runner-2026-apr-sep-v1", label: "가상 러너의 2026년 4~9월 예시", today: ORACLE_EXAMPLE_TODAY,
    startDate: "2026-04-01", endDate: ORACLE_EXAMPLE_TODAY,
    entries: entries.map(entry => {
      const parsed = parseJournalEntryForWrite(entry)
      if (parsed === null) throw new Error(`Invalid fictional journal schema: ${entry.id}`)
      return parsed
    }).sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id)),
    athleteRecords: athleteRecords.map(record => {
      const parsed = parseAthleteRecord(record, new Date("2026-09-30T12:00:00"))
      if (parsed === null) throw new Error("Invalid fictional athlete record")
      return parsed
    }), planState, planHistory: { kind: "loaded", plans: [] },
  }
}

/** Legacy topic/detail routes use this same fictional history. Their reducers own
 * narrower windows (current plan, recent races, eight weeks or two months), so
 * selecting a report period does not relabel them as a six-month comparison. */
export function buildOracleDemoTopicResult(topicId: OracleTopicId, months: OracleReportMonths = 6): OraclePersonalResult {
  const scenario = buildOracleDemoScenario()
  const period = oracleReportPeriod(months, scenario.today)
  const entries = scenario.entries.filter(entry => entry.date >= period.startDate && entry.date <= period.endDate)
  const athleteRecords = scenario.athleteRecords.filter(record => record.achievedOn !== null
    && record.achievedOn >= period.startDate && record.achievedOn <= period.endDate)
  const result = buildOraclePersonalResult({ topicId, entries, athleteRecords, planState: scenario.planState, planHistory: scenario.planHistory, today: scenario.today })
  const plannedDates = entries.flatMap(entry => entry.kind === "post-session" && entry.plannedSessionLink !== undefined
    ? [entry.plannedSessionLink.plannedDate] : []).sort()
  const planDates = (topicId === "focus" || topicId === "priority") && plannedDates.length > 0
    ? ` · ${plannedDates[0]}~${plannedDates.at(-1)}` : ""
  return {
    ...result,
    source: `가상 예시 · ${result.source}${planDates}`,
    detail: `동일한 가상 러너의 기록을 읽은 예시입니다. ${result.detail}`,
  }
}
