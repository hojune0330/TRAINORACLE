import { parseAthleteRecord, type AthleteRecord } from "./athlete-records"
import { athleteRecordAuthorityCopy, formatRecordTime } from "./athlete-record-display"
import { ENERGY_SYSTEM_META } from "./energy-system-taxonomy"
import { derivePlanCycleResponse } from "./plan-cycle-response"
import type { OracleReportEvidence, OracleReportInput, OracleReportMonth, OracleReportPeriod } from "./oracle-report"

export type OracleReportInsight = {
  readonly ruleId: "PLAN_REPEATED_HIGHER_EFFORT" | "SAME_EVENT_RACE_CHANGE" | "MONTH_PURPOSE_CHANGE" | "MONTH_DISTANCE_CHANGE" | "ACTIVE_WEEKS" | "NEUTRAL" | "PLAN_REPEATED_MATCH"
  readonly kind: "strength" | "attention" | "observation"
  readonly headline: string
  readonly observation: string
  readonly evidenceRefs: readonly string[]
  readonly coverage: string
  readonly limitations: readonly string[]
  readonly action: "records" | "journal" | "trends" | "plan" | "log"
}
export type OracleRaceChange = {
  readonly eventDistanceM: number
  readonly previous: AthleteRecord
  readonly recent: AthleteRecord
  /** Recent minus previous seconds; a negative value is a shorter recorded time. */
  readonly deltaSeconds: number
}
export type OracleReportInsights = {
  readonly hero: OracleReportInsight
  readonly strengths: readonly OracleReportInsight[]
  readonly attention: readonly OracleReportInsight[]
}

/** Closed display copy shared by on-screen and export projections. Unknown rules
 * or arbitrary user text never become a share headline. */
export function safeOracleReportHeadline(insight: Pick<OracleReportInsight, "ruleId" | "headline">): string | null {
  const patterns: Record<OracleReportInsight["ruleId"], RegExp> = {
    PLAN_REPEATED_HIGHER_EFFORT: /^계획보다 높게 느낀 기록이 반복됐어요$/u,
    PLAN_REPEATED_MATCH: /^계획과 실제 느낌이 반복해서 맞았어요$/u,
    SAME_EVENT_RACE_CHANGE: /^(?:\d+(?:\.\d+)?(?:e\+?\d+)?m 기록이 \d+(?:\.\d+)?(?:e[+-]?\d+)?초 (?:짧아졌어요|길어졌어요)|\d+(?:\.\d+)?(?:e\+?\d+)?m 두 기록이 같아요)$/u,
    MONTH_PURPOSE_CHANGE: /^월별로 기록한 훈련 목적 구성이 달라졌어요$/u,
    MONTH_DISTANCE_CHANGE: /^월별 기록 거리가 \d{1,7}(?:\.\d)?km (?:늘었어요|줄었어요)$/u,
    ACTIVE_WEEKS: /^완료된 \d{1,2}주 중 \d{1,2}주에 운동을 기록했어요$/u,
    NEUTRAL: /^이 기간에 남긴 훈련$/u,
  }
  return patterns[insight.ruleId]?.test(insight.headline) ? insight.headline : null
}
type Input = OracleReportInput & {
  readonly period: OracleReportPeriod
  readonly monthly: readonly OracleReportMonth[]
  readonly evidence: readonly OracleReportEvidence[]
  readonly workoutDayCount: number
  readonly activeWeekCount: number
  readonly completedWeekCount: number
}

/** Uses the existing actual-record policy: dated, valid, >=60m, non-goal,
 * same-event comparison. Preserves self-report authority; makes no ability grade. */
export function oracleReportRaceChange(input: Pick<Input, "athleteRecords" | "today" | "period" | "raceReadState">): OracleRaceChange | null {
  if (input.raceReadState === "error") return null
  const parsed = (input.athleteRecords ?? []).flatMap(value => {
    const record = parseAthleteRecord(value, new Date(`${input.today}T12:00:00`))
    return record !== null && record.purpose !== "RACE_GOAL" && record.achievedOn !== null
      && record.achievedOn >= input.period.startDate && record.achievedOn <= input.period.endDate ? [record] : []
  })
  // Identical copies collapse; conflicting versions of one opaque ID are withheld.
  const actual = parsed.filter(record => new Set(parsed.filter(other => other.id === record.id).map(other => JSON.stringify(other))).size === 1)
    .filter((record, index, records) => records.findIndex(other => other.id === record.id) === index)
    .sort((a, b) => b.achievedOn!.localeCompare(a.achievedOn!) || a.id.localeCompare(b.id))
  const recent = actual[0]
  const previous = recent && actual.find(record => record.eventDistanceM === recent.eventDistanceM && record.achievedOn! < recent.achievedOn!)
  // Match the existing record display's hundredth-of-a-second precision and
  // avoid exposing binary subtraction tails (e.g. 6.980000000000018 seconds).
  return recent && previous ? { eventDistanceM: recent.eventDistanceM, previous, recent, deltaSeconds: Number((recent.performanceSeconds - previous.performanceSeconds).toFixed(2)) } : null
}

export function buildOracleReportInsights(input: Input): { readonly insights: OracleReportInsights; readonly raceChange: OracleRaceChange | null } {
  const candidates: OracleReportInsight[] = []
  const refs = (items: readonly OracleReportEvidence[]) => [...new Set(items.map(item => item.id))]
  const limitation = "기록의 차이는 훈련 효과나 원인, 현재 능력의 판정이 아니에요."
  if (input.planState && input.planReadState !== "error") {
    const response = derivePlanCycleResponse(input.entries.filter(entry => entry.date >= input.period.startDate && entry.date <= input.period.endDate), input.planState, input.planHistory)
    if (!response.historyReadIncomplete && (response.signal === "REPEATED_HIGHER_EFFORT" || response.signal === "REPEATED_MATCH")) {
      const higher = response.signal === "REPEATED_HIGHER_EFFORT"
      candidates.push({ ruleId: higher ? "PLAN_REPEATED_HIGHER_EFFORT" : "PLAN_REPEATED_MATCH", kind: higher ? "attention" : "strength",
        headline: higher ? "계획보다 높게 느낀 기록이 반복됐어요" : "계획과 실제 느낌이 반복해서 맞았어요",
        observation: `연결된 실제 RPE ${response.comparableRpeCount}건 중 계획 범위보다 높음 ${response.higherThanRangeCount}건, 범위 안 ${response.withinRangeCount}건이에요.`,
        evidenceRefs: refs(input.evidence.filter(item => input.entries.some(entry => entry.kind === "post-session" && entry.id === item.id && entry.plannedSessionLink && response.rows.some(row => row.plannedSessionId === entry.plannedSessionLink!.plannedSessionId && row.actualRpe !== null)))),
        coverage: `현재 계획 연결 ${response.linkedResultCount}건 · RPE 비교 ${response.comparableRpeCount}건`, limitations: ["연결이 확인된 계획과 수행만 비교했어요.", "같은 강도의 이어가기나 감량 여부는 현재 계획에서 직접 검토해요."], action: "plan" })
    }
  }
  const raceChange = oracleReportRaceChange(input)
  if (raceChange) candidates.push({ ruleId: "SAME_EVENT_RACE_CHANGE", kind: raceChange.deltaSeconds < 0 ? "strength" : "observation",
    headline: raceChange.deltaSeconds === 0 ? `${raceChange.eventDistanceM}m 두 기록이 같아요` : `${raceChange.eventDistanceM}m 기록이 ${Math.abs(raceChange.deltaSeconds)}초 ${raceChange.deltaSeconds < 0 ? "짧아졌어요" : "길어졌어요"}`,
    observation: `${raceChange.previous.achievedOn} ${formatRecordTime(raceChange.previous.performanceSeconds)} → ${raceChange.recent.achievedOn} ${formatRecordTime(raceChange.recent.performanceSeconds)}`,
    evidenceRefs: [raceChange.previous.sourceRef, raceChange.recent.sourceRef], coverage: "선택 기간의 같은 종목 실제 기록 2건", limitations: [`이전: ${athleteRecordAuthorityCopy(raceChange.previous)} / 최근: ${athleteRecordAuthorityCopy(raceChange.recent)}`, limitation], action: "records" })
  const complete = input.monthly.filter(month => !month.partialMonth)
  const previous = complete.at(-2)
  const recent = complete.at(-1)
  if (previous && recent) {
    const leading = (month: OracleReportMonth) => Object.entries(month.purposeCounts).sort((a, b) => b[1]! - a[1]! || a[0].localeCompare(b[0]))
    const left = leading(previous), right = leading(recent)
    const leftTotal = left.reduce((sum, item) => sum + item[1]!, 0)
    const rightTotal = right.reduce((sum, item) => sum + item[1]!, 0)
    const keys = [...new Set([...left, ...right].map(item => item[0]))]
    const purposeMixChanged = leftTotal > 0 && rightTotal > 0 && keys.some(key => (previous.purposeCounts[key as keyof typeof previous.purposeCounts] ?? 0) * rightTotal !== (recent.purposeCounts[key as keyof typeof recent.purposeCounts] ?? 0) * leftTotal)
    if (purposeMixChanged) {
      const label = (key: string) => ENERGY_SYSTEM_META[key as keyof typeof ENERGY_SYSTEM_META].shortLabel
      const count = (month: OracleReportMonth, key: string) => month.purposeCounts[key as keyof typeof month.purposeCounts] ?? 0
      const changed = [...keys].sort((a, b) => Math.abs(count(recent, b) / rightTotal - count(previous, b) / leftTotal) - Math.abs(count(recent, a) / rightTotal - count(previous, a) / leftTotal) || a.localeCompare(b))[0]!
      candidates.push({ ruleId: "MONTH_PURPOSE_CHANGE", kind: "observation", headline: "월별로 기록한 훈련 목적 구성이 달라졌어요",
        observation: `기록 비중 차이가 가장 큰 목적은 ${label(changed)}예요. ${previous.label} ${leftTotal}회 중 ${count(previous, changed)}회 → ${recent.label} ${rightTotal}회 중 ${count(recent, changed)}회.`,
        evidenceRefs: refs(input.evidence.filter(item => item.energyIncluded && item.date >= previous.startDate && item.date <= recent.endDate)), coverage: "완료된 최근 두 달 · 직접 선택한 목적", limitations: ["기초·역치·스피드는 선택한 목적이에요. 훈련 방법이나 생리적 능력을 추정하지 않았어요.", "적정 비율이나 부족 판정은 하지 않아요."], action: "trends" })
    }
    if (previous.distance.totalKm !== null && recent.distance.totalKm !== null && previous.distance.totalKm !== recent.distance.totalKm) {
      const delta = Math.round((recent.distance.totalKm - previous.distance.totalKm) * 10) / 10
      candidates.push({ ruleId: "MONTH_DISTANCE_CHANGE", kind: "observation", headline: `월별 기록 거리가 ${Math.abs(delta)}km ${delta > 0 ? "늘었어요" : "줄었어요"}`,
        observation: `${previous.label} ${previous.distance.totalKm}km → ${recent.label} ${recent.distance.totalKm}km`, evidenceRefs: refs(input.evidence.filter(item => item.distanceIncluded && item.date >= previous.startDate && item.date <= recent.endDate)), coverage: "완료된 최근 두 달 · 인정된 거리 합계", limitations: ["미기록일은 휴식이나 0km로 바꾸지 않았어요.", limitation], action: "trends" })
    }
  }
  if (input.activeWeekCount > 0) candidates.push({ ruleId: "ACTIVE_WEEKS", kind: "strength", headline: `완료된 ${input.completedWeekCount}주 중 ${input.activeWeekCount}주에 운동을 기록했어요`,
    observation: `선택 기간에 인정된 수행 기록이 있는 날은 ${input.workoutDayCount}일이에요.`, evidenceRefs: refs(input.evidence.filter(item => item.kind === "post-session")), coverage: "선택 기간 안 월요일~일요일이 모두 지난 주만 계산", limitations: ["주당 횟수의 적정성이나 건강 상태를 판정하지 않아요.", "기록이 없는 주의 실제 활동 여부는 알 수 없어요."], action: "journal" })
  const priority = ["PLAN_REPEATED_HIGHER_EFFORT", "SAME_EVENT_RACE_CHANGE", "MONTH_PURPOSE_CHANGE", "MONTH_DISTANCE_CHANGE", "ACTIVE_WEEKS", "PLAN_REPEATED_MATCH"]
  candidates.sort((a, b) => priority.indexOf(a.ruleId) - priority.indexOf(b.ruleId))
  for (const candidate of candidates) if (safeOracleReportHeadline(candidate) === null) throw new Error("Unrecognized Oracle rule headline")
  const hero = candidates[0] ?? { ruleId: "NEUTRAL" as const, kind: "observation" as const, headline: "이 기간에 남긴 훈련", observation: input.workoutDayCount > 0 ? `${input.workoutDayCount}일의 수행 기록을 확인했어요.` : "선택 기간에 분석 가능한 수행 기록이 아직 없어요.", evidenceRefs: refs(input.evidence), coverage: "현재 확인한 구조화 기록", limitations: ["자료가 없는 항목을 0이나 약점으로 바꾸지 않아요."], action: "log" as const }
  return { raceChange, insights: { hero, strengths: candidates.filter(item => item !== hero && item.kind === "strength").slice(0, 2), attention: candidates.filter(item => item !== hero && item.kind === "attention").slice(0, 2) } }
}
