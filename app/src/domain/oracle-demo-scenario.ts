import { deriveCandidateId, derivePairId } from "@impl/plan-generator/candidate-identity"
import { parseAthleteRecord, type AthleteRecord } from "./athlete-records"
import { parseJournalEntryForWrite, type JournalEntry, type PostSessionEntry } from "./journal-schema"
import { ORACLE_EXAMPLE_TODAY, oracleReportPeriod, type OracleReportMonths } from "./oracle-report"
import { buildOraclePersonalResult, type OraclePersonalResult, type OracleTopicId } from "./oracle-personal-result"
import { planBetaStateV3Schema, type PlanBetaState } from "./plan-beta-schema"
import type { PlanJournalHistory } from "./plan-journal-evidence"
import { createPlannedSessionLogDraft } from "./planned-session-link"

export const ORACLE_DEMO_SCENARIOS = [
  { id: "first-5k", label: "첫 5km를 준비하는 러너", description: "걷기와 달리기를 섞다가 첫 5km를 기록한 가상 예시" },
  { id: "ten-k", label: "10km 기록에 도전하는 러너", description: "기초 달리기와 역치 훈련, 줄어든 달과 다시 이어간 달이 있는 가상 예시" },
  { id: "track-1500", label: "1500m 트랙 러너", description: "짧은 반복과 가속주를 구조화해서 남긴 가상 예시" },
  { id: "restart", label: "다시 달리기를 시작한 러너", description: "기록 공백 뒤 짧은 달리기를 다시 이어간 가상 예시" },
] as const
export type OracleDemoScenarioId = typeof ORACLE_DEMO_SCENARIOS[number]["id"]
export type OracleDemoScenario = {
  readonly id: OracleDemoScenarioId
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

function demoPlan(eventDistanceM: 1500 | 5000 | 10000): PlanBetaState {
  const eventGroup = eventDistanceM === 1500 ? "MIDDLE_DISTANCE" : eventDistanceM === 10000 ? "TEN_K" : "FIVE_K"
  const candidateBaseId = `beta:balanced:${eventGroup.toLowerCase()}:event-${eventDistanceM}:developing:lt_intent:single_session_only:varies:projection-9:local-civil-9-5:fixture-main-1-fixture-main-2:1-5-9:no_usable_journal:no-continuity:template-rpe-only`
  const pairBaseId = `plan-pair:v3:${eventDistanceM}:rpe-only:lt_intent:fixture-main-1-fixture-main-2:1-5-9:no-continuity`
  const frame = { formationKind: "LOCAL_CIVIL_9_5", lengthDays: 9.5, slotCount: 19, projectionLengthDays: 9, continuity: { kind: "STANDARD_FRAME" } } as const
  const sessions = [1, 3, 6, 9].map(day => ({
    day, slot: "AM", role: "EASY", plannedEnergyIntent: "BASE_INTENT",
    prescription: { kind: "RPE_TIME_RANGE", rpe: { minimum: 2, maximum: 4 }, durationMinutes: { minimum: 20, maximum: 30 } },
  } as const))
  const projection = { kind: "BALANCED", eventDistanceM, selectedDetailedTemplateRef: null, selectedEnergyIntent: "LT_INTENT", sourceMode: "PROFILE_ONLY", selectionAuthority: "SELF", frame, sessions } as const
  const candidateId = deriveCandidateId(candidateBaseId, projection)
  const conservativeId = deriveCandidateId(candidateBaseId.replace("beta:balanced:", "beta:conservative:"), { ...projection, kind: "CONSERVATIVE" })
  return planBetaStateV3Schema.parse({
    version: 3,
    intake: { eventGroup, eventDistanceM, competitionDivision: "OPEN", experienceBand: "DEVELOPING", availableDayCount: 4, requestedFrameLength: 9, trainingFocus: "LT_INTENT", secondSessionMode: "SINGLE_SESSION_ONLY", trainingTimePreference: "VARIES", selectedDetailedTemplateRef: null, startDate: "2026-09-22" },
    activePlan: { kind: "BETA_ACTIVE_PLAN_SNAPSHOT", activationState: "SELECTED_BETA_SNAPSHOT", candidateId, pairId: derivePairId(pairBaseId, candidateId, conservativeId), candidateKind: "BALANCED", eventDistanceM, selectedDetailedTemplateRef: null, selectionActor: "SELF", sourceMode: "PROFILE_ONLY", selectedEnergyIntent: "LT_INTENT", frame, sessions },
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

// Each row is an authored observation: day/km/minutes/RPE/selected purpose/method.
// These irregular dates are fictional history, never a training prescription or
// a recurrence algorithm. A dash is absent data, not a manufactured zero.
const FICTIONAL_MONTHS: Readonly<Record<OracleDemoScenarioId, readonly string[]>> = {
  "first-5k": [
    "2/1.8/22/3/base/w 6/2/24/4/base/w 11/1.5/20/3/rest/w 17/2.4/28/4/base/w 23/2/25/3/base/w 28/2.6/30/4/base/w",
    "3/2.5/29/4/base/w 8/3/32/4/base/w 12/2/25/3/rest/w 18/3.2/34/5/base/w 24/2.8/31/4/base/w 29/3.5/36/4/base/w",
    "2/3/31/4/base/w 7/3.6/35/5/base/w 12/2.4/28/3/rest/w 29/2.8/30/4/base/w",
    "3/3.5/34/4/base 8/4/36/5/base 12/3/30/3/rest 18/4.2/39/5/base 23/3.2/31/4/base 29/4.5/41/5/base",
    "2/3.5/33/4/base 7/4.8/43/5/base 13/3/29/3/rest 19/4/36/4/base 24/3.2/30/4/base 30/4.5/41/5/base",
    "3/4/36/4/base 8/2.5/25/3/rest 13/5/33.6/8/base 18/2/22/3/rest 21/3.5/32/4/base",
  ],
  "ten-k": [
    "1/6/37/3/base 4/8/44/6/lt/t 8/5/32/3/rest 12/11/67/5/base 16/7/38/7/vo2/r 21/6/36/4/base 25/3/21/2/rest 26/10/48/8/mixed 29/4/28/3/rest",
    "2/6/37/4/base 6/9/48/6/lt/t 10/12/72/5/base 15/7/39/7/vo2/r 19/5/33/3/rest 23/8/47/4/base 28/10/58/5/base",
    "3/7/42/4/base 7/10/54/6/lt/t 11/6/37/3/rest 14/12/73/5/base 24/5/32/3/base 28/8/42/7/vo2/r",
    "2/7/42/4/base 5/12/71/5/base 9/8/43/7/vo2/r 13/5/34/3/rest 17/9/48/6/lt/t 22/6/37/4/base 25/3/21/2/rest 26/10/47.1/8/mixed 29/4/27/3/rest",
    "1/6/38/4/base 5/8/44/6/lt/t 9/10/61/5/base 12/-/36/3/rest 16/7/38/7/vo2/r 21/5/33/3/rest 25/9/52/5/base 30/6/36/4/base",
    "2/7/41/4/base 6/8/43/6/lt/t 10/4/27/3/rest 13/10/46.75/8/mixed 16/4/29/3/rest 20/6/37/4/base",
  ],
  "track-1500": [
    "2/5/32/3/base 5/6/35/7/vo2/r 9/4/28/4/atp/s 13/7/43/4/base 18/5/30/7/gly/r 22/3/24/3/rest 26/1.5/5/9/mixed 29/4/27/3/base",
    "3/6/37/4/base 7/5/31/6/lt/t 11/4/28/4/atp/s 16/7/40/7/vo2/r 20/4/27/3/rest 24/6/38/4/base 29/5/31/7/gly/r",
    "2/5/32/3/base 6/7/40/7/vo2/r 10/4/27/4/atp/s 15/6/36/6/lt/t 19/3/23/3/rest 23/5/31/7/gly/r 28/7/44/4/base",
    "1/5/32/3/base 5/6/36/7/vo2/r 10/4/27/4/atp/s 21/4/28/3/base 25/3/22/2/rest 26/1.5/5.07/9/mixed 29/4/29/3/rest",
    "2/5/32/4/base 6/6/36/6/lt/t 11/4/27/4/atp/s 15/7/41/7/vo2/r 20/3/23/3/rest 24/5/31/7/gly/r 29/6/38/4/base",
    "2/5/32/3/base 6/4/27/4/atp/s 10/3/23/2/rest 13/1.5/4.95/9/mixed 17/4/29/3/rest 21/5/33/4/base",
  ],
  "restart": [
    "2/5/33/4/base 7/6/38/5/base 12/3/25/3/rest 18/7/45/5/base 23/4/29/4/base 26/5/27/8/mixed 29/3/24/3/rest",
    "3/4/29/4/base 9/5/34/5/base 14/2/20/3/rest",
    "",
    "14/1.5/18/3/base/w 19/2/22/4/base/w 24/2.5/25/4/base/w 30/2/23/3/rest/w",
    "3/3/29/4/base/w 8/2.5/26/4/base/w 14/3.5/32/5/base 19/2/23/3/rest 25/4/35/5/base 29/3/30/4/base",
    "2/3.5/32/4/base 7/2/22/3/rest 13/5/27.67/8/mixed 18/2/23/3/rest 21/3/29/4/base",
  ],
}

/** Fixed fictional observations without clocks, randomness or storage. */
export function buildOracleDemoScenario(id: OracleDemoScenarioId = "ten-k"): OracleDemoScenario {
  const entries: JournalEntry[] = []
  const eventDistanceM = id === "ten-k" ? 10000 : id === "track-1500" ? 1500 : 5000
  for (const [monthIndex, month] of FICTIONAL_MONTHS[id].entries()) {
    for (const row of month.split(" ").filter(Boolean)) {
      const [day, km, minutes, effort, system, method] = row.split("/")
      const date = `2026-${String(monthIndex + 4).padStart(2, "0")}-${day!.padStart(2, "0")}`
      const entry = session(date, system!, km === "-" ? null : Number(km), minutes === "-" ? null : Number(minutes), Number(effort))
      entries.push(method === undefined ? entry : { ...entry, exerciseLog: { version: 1, source: "SELF_REPORTED", components: [
        { id: "warmup", kind: "RUNNING", name: "준비 달리기", rows: [{ id: "warmup-1", durationSeconds: 600 }] },
        { id: "main", kind: method === "w" || method === "t" ? "RUNNING" : "INTERVALS", name: method === "w" ? "달리기와 걷기" : method === "s" ? "가속주" : method === "t" ? "지속 달리기" : "거리 반복", rows: method === "w" ? [{ id: "run", durationSeconds: 120, repetitions: 5 }, { id: "walk", durationSeconds: 60, repetitions: 5 }] : method === "t" ? [{ id: "continuous", durationSeconds: 1200 }] : [{ id: "repeat", distanceM: method === "s" ? 80 : 400, repetitions: method === "s" ? 4 : 5, recovery: { kind: "TIMED", seconds: method === "s" ? 90 : 120 } }] },
        { id: "cooldown", kind: "RUNNING", name: "정리 달리기", rows: [{ id: "cooldown-1", durationSeconds: 300 }] },
      ] } })
      entries.push({
        id: `oracle-demo-condition-${date}`, kind: "evening", date, savedAt: `${date}T13:00:00.000Z`, syncState: "local",
        sleepH: 7, sleepQuality: 3, weightKg: "", restingHr: "", mood: Number(effort) > 6 ? 3 : 4,
        painParts: { left_calf: 0 }, note: "", fieldProvenance: { sleepH: explicit, sleepQuality: explicit, weightKg: missing, restingHr: missing, mood: explicit, painParts: explicit },
      })
    }
  }
  const planState = demoPlan(eventDistanceM)
  for (const planned of planState.activePlan.sessions) {
    const draft = createPlannedSessionLogDraft(planState, planned, planState.generatedAt)
    if (draft === null) throw new Error("Fictional plan link must validate")
    const entry = session(draft.date, "base", id === "first-5k" || id === "restart" ? 3 : 5, 30, id === "restart" && planned.day >= 6 ? 6 : planned.day === 6 ? 5 : 4)
    entries.push({ ...entry, plannedSessionLink: draft.link, planExecutionRelation: "AS_PLANNED", fieldProvenance: { ...entry.fieldProvenance, plannedSessionLink: explicit, planExecutionRelation: { provenance: "DERIVED", derivedFrom: ["activityOutcome", "activitySlot", "plannedSessionLink"], derivationRuleId: "QUICK_PLAN_EXECUTION_RELATION_V2" } } })
  }
  const races = id === "first-5k" ? [["2026-09-13", 2015]] : id === "restart" ? [["2026-04-26", 1620], ["2026-09-13", 1660]] : id === "track-1500" ? [["2026-04-26", 300], ["2026-07-26", 304], ["2026-09-13", 297]] : [["2026-04-26", 2880], ["2026-07-26", 2826], ["2026-09-13", 2805]]
  const athleteRecords: AthleteRecord[] = races.map(([date, seconds]) => ({
    schemaVersion: 1, id: `oracle-demo-race-${date}`, purpose: "RECENT_RESULT", eventDistanceM, performanceSeconds: Number(seconds), achievedOn: String(date), seasonId: null,
    enteredBy: "ATHLETE", verificationState: "SELF_REPORTED", sourceRef: `athlete-record:oracle-demo-race-${date}`, savedAt: `${date}T09:00:00.000Z`,
  }))
  return {
    id, label: ORACLE_DEMO_SCENARIOS.find(item => item.id === id)!.label, today: ORACLE_EXAMPLE_TODAY,
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
