import type { AthleteRecord } from "./athlete-records"
import { athleteRecordAuthorityCopy, elapsedSinceAchieved, formatRecordTime } from "./athlete-record-display"
import { isValidIsoDate } from "./dates"
import { buildEnergySystemLedger, energyLedgerWindow } from "./energy-system-ledger"
import { ENERGY_SYSTEM_META } from "./energy-system-taxonomy"
import { projectStructuredJournalObservations } from "./journal-observation"
import type { JournalEntry } from "./journal-schema"
import type { PlanBetaState } from "./plan-beta-schema"
import { derivePlanCycleResponse } from "./plan-cycle-response"
import { bucketByMonth, type TrendBucket, type TrendMetric } from "./trend-analysis"
import type { OracleTopicId } from "./oracle-exploration"
export type { OracleTopicId } from "./oracle-exploration"

export type OraclePersonalResultRow = {
  readonly label: string
  readonly value: number
  readonly valueLabel: string
}

export type OraclePersonalResult = {
  readonly status: "ready" | "partial" | "missing"
  readonly headline: string
  readonly summary: string
  readonly source: string
  readonly rows: readonly OraclePersonalResultRow[]
  readonly unit: string
  readonly detail: string
  readonly action: "records" | "journal" | "trends" | "plan" | "log"
  readonly actionLabel: string
  readonly requiredInput?: string
  readonly notice?: string
  readonly metric?: "DISTANCE_KM" | "RPE"
  readonly section?: "summary" | "distance" | "mix" | "monthly" | "files"
  readonly fingerprint: string | null
}

export type OraclePersonalResultInput = {
  readonly topicId: OracleTopicId
  readonly entries: readonly JournalEntry[]
  readonly planState: PlanBetaState | null
  readonly athleteRecords?: readonly AthleteRecord[]
  readonly metric?: "DISTANCE_KM" | "RPE"
  readonly today: string
}

function fingerprint(value: unknown): string {
  const text = JSON.stringify(value)
  let hash = 2166136261
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(16).padStart(8, "0")
}

function observations(entries: readonly JournalEntry[]) {
  // An explicit empty confirmation scope keeps this pure builder out of account
  // storage and prevents device-preview file data from becoming analysis data.
  return projectStructuredJournalObservations(entries, { confirmedFileEntries: [] })
}

function missingResult(
  headline: string,
  summary: string,
  source: string,
  detail: string,
  action: OraclePersonalResult["action"],
  actionLabel: string,
  requiredInput: string,
  section: OraclePersonalResult["section"] = "summary",
  notice?: string,
): OraclePersonalResult {
  return {
    status: "missing",
    headline,
    summary,
    source,
    rows: [],
    unit: "표시 가능한 값 없음",
    detail,
    action,
    actionLabel,
    requiredInput,
    ...(notice === undefined ? {} : { notice }),
    section,
    fingerprint: null,
  }
}

function invalidDateResult(): OraclePersonalResult {
  return missingResult(
    "분석 날짜를 확인해 주세요",
    "달력에 있는 기준 날짜가 있어야 개인 기록을 읽을 수 있어요.",
    "분석 기준 날짜 없음",
    "유효한 YYYY-MM-DD 기준 날짜만 사용합니다. 기록이나 계획을 바꾸지 않습니다.",
    "log",
    "기록 남기기",
    "YYYY-MM-DD 형식의 유효한 분석 기준 날짜",
  )
}

function levelResult(
  records: readonly AthleteRecord[] | undefined,
  today: string,
): OraclePersonalResult {
  type UsableAthleteRecord = Exclude<AthleteRecord, { purpose: "RACE_GOAL" }>
  const usable = (value: unknown): value is UsableAthleteRecord => {
    if (typeof value !== "object" || value === null) return false
    const candidate = value as Partial<UsableAthleteRecord>
    return candidate.purpose !== undefined
      && typeof candidate.achievedOn === "string"
      && isValidIsoDate(candidate.achievedOn)
      && candidate.achievedOn <= today
      && typeof candidate.eventDistanceM === "number"
      && Number.isFinite(candidate.eventDistanceM)
      && candidate.eventDistanceM >= 60
      && typeof candidate.performanceSeconds === "number"
      && Number.isFinite(candidate.performanceSeconds)
      && candidate.performanceSeconds > 0
  }
  const actual = (Array.isArray(records) ? records : [])
    .filter((record): record is UsableAthleteRecord => usable(record))
    .sort((left, right) => right.achievedOn.localeCompare(left.achievedOn))
  const recent = actual[0]
  if (recent === undefined) {
    return missingResult(
      "경기 기록이 아직 없어요",
      "종목과 달성일이 있는 개인 기록을 남기면 현재 기록을 나란히 볼 수 있어요.",
      "경기 기록 필요",
      "자유 메모나 경기 목표는 현재 기록으로 바꾸지 않습니다. 기록의 입력자·검증 상태도 함께 보존합니다.",
      "records",
      "기록 관리 열기",
      "종목 거리·기록·실제 달성일",
    )
  }
  const previous = actual.find((record) => (
    record.eventDistanceM === recent.eventDistanceM
    && record.achievedOn < recent.achievedOn
  ))
  const shown = previous === undefined ? [recent] : [previous, recent]
  const rows = shown.map((record) => ({
    label: record.achievedOn,
    value: record.performanceSeconds,
    valueLabel: formatRecordTime(record.performanceSeconds),
  }))
  const elapsedLines = shown.map((record) => {
    const elapsed = elapsedSinceAchieved(record, new Date(`${today}T12:00:00`))
    return `${record.achievedOn} · ${elapsed?.label ?? "달성일 확인 필요"} · ${athleteRecordAuthorityCopy(record)}`
  })
  const status = previous === undefined ? "partial" : "ready"
  const recentElapsed = elapsedSinceAchieved(recent, new Date(`${today}T12:00:00`))
  return {
    status,
    headline: `${recent.eventDistanceM}m · ${formatRecordTime(recent.performanceSeconds)}`,
    summary: previous === undefined
      ? "같은 종목의 이전 기록을 더하면 비교할 수 있어요."
      : "같은 종목의 이전 기록과 비교했어요.",
    source: `최근 달성 ${recent.achievedOn} · ${recentElapsed?.label ?? "달성일 확인 필요"} · ${athleteRecordAuthorityCopy(recent)}`,
    rows,
    unit: "초",
    detail: `등급이나 현재 경기력 판정은 하지 않습니다. ${elapsedLines.join(" / ")}`,
    action: "records",
    actionLabel: "기록 관리 열기",
    section: "summary",
    fingerprint: fingerprint({
      period: [shown[0]?.achievedOn ?? null, recent.achievedOn],
      sourceCount: shown.length,
      distanceM: recent.eventDistanceM,
      rows: rows.map((row) => ({ label: row.label, value: row.value })),
    }),
  }
}

function mixResult(
  entries: readonly JournalEntry[],
  today: string,
): OraclePersonalResult {
  const ledger = buildEnergySystemLedger(observations(entries), energyLedgerWindow("RECENT_8_WEEKS", today))
  const used = ledger.rows.filter((row) => row.journalSessionCount > 0)
  if (used.length === 0) {
    return missingResult(
      ledger.excludedSourceCount > 0 ? "훈련 목적을 확인할 기록이 더 필요해요" : "훈련 목적 기록이 아직 없어요",
      "훈련 후 목적을 선택한 기록이 있으면 최근 8주 구성을 보여드려요.",
      `최근 8주 · 반영 ${ledger.includedSourceCount}건`,
      `분석에서 제외된 기록 ${ledger.excludedSourceCount}건. 유형이 많거나 적다는 판정은 하지 않습니다.`,
      "log",
      "훈련 기록 남기기",
      "훈련 목적이 선택된 세션 기록 1건 이상",
      "mix",
      ledger.excludedSourceCount > 0
        ? `제외된 기록 ${ledger.excludedSourceCount}건이 있어요.`
        : undefined,
    )
  }
  const rows = used.map((row) => ({
    label: `${ENERGY_SYSTEM_META[row.key].code} ${ENERGY_SYSTEM_META[row.key].shortLabel}`,
    value: row.journalSessionCount,
    valueLabel: `${row.journalSessionCount}회`,
  }))
  const partial = ledger.excludedSourceCount > 0 || ledger.conflictingSourceCount > 0
  const maxCount = Math.max(...used.map((row) => row.journalSessionCount))
  const mostFrequent = used
    .filter((row) => row.journalSessionCount === maxCount)
    .map((row) => `${ENERGY_SYSTEM_META[row.key].code} ${ENERGY_SYSTEM_META[row.key].shortLabel}`)
  return {
    status: partial ? "partial" : "ready",
    headline: `${mostFrequent.join(" · ")} 기록이 ${maxCount}회로 가장 많아요.`,
    summary: "최근 8주에 기록한 훈련 목적을 유형별로 모았어요.",
    source: `최근 8주 ${ledger.window.startDate}~${ledger.window.endDate} · ${ledger.includedSourceCount}건`,
    rows,
    unit: "회",
    detail: `분석에 포함 ${ledger.includedSourceCount}건 · 제외 ${ledger.excludedSourceCount}건 · 중복 ${ledger.duplicateSourceCount}개 · 충돌 ${ledger.conflictingSourceCount}건. 이 수치는 강점·약점·부족이나 처방을 뜻하지 않습니다.`,
    action: "trends",
    actionLabel: "훈련 분석 열기",
    ...(partial ? { notice: `제외 ${ledger.excludedSourceCount}건 · 출처 충돌 ${ledger.conflictingSourceCount}건` } : {}),
    section: "mix",
    fingerprint: fingerprint({
      sourceCount: ledger.includedSourceCount,
      excludedSourceCount: ledger.excludedSourceCount,
      rows: rows.map((row) => ({ label: row.label, value: row.value })),
    }),
  }
}

function planResult(
  topicId: "focus" | "priority",
  entries: readonly JournalEntry[],
  planState: PlanBetaState | null,
): OraclePersonalResult {
  if (planState === null) {
    return missingResult(
      "진행 중인 계획이 아직 없어요",
      "현재 계획이 있으면 계획 RPE와 연결된 실제 RPE를 나란히 확인할 수 있어요.",
      "현재 계획 없음",
      "계획이 없을 때는 훈련 우선순위나 적응을 만들지 않습니다. 먼저 계획을 직접 선택하거나 만드세요.",
      "plan",
      "계획 만들기",
      "현재 계획 1개",
    )
  }
  const response = derivePlanCycleResponse(entries, planState)
  const rows = response.rows
    .filter((row) => row.actualRpe !== null)
    .slice(0, 8)
    .map((row) => ({
      label: `${row.date} · ${row.slot}`,
      value: row.actualRpe!,
      valueLabel: row.plannedRpe === null
        ? `실제 RPE ${row.actualRpe}/10`
        : `실제 ${row.actualRpe}/10 · 계획 ${row.plannedRpe.minimum}~${row.plannedRpe.maximum}`,
    }))
  const missingComparison = response.signal === "NO_LINKED_RESULTS" || response.signal === "NO_COMPARABLE_RESULTS"
  const status = response.signal === "NO_LINKED_RESULTS" ? "missing" : response.comparableRpeCount < 2 ? "partial" : "ready"
  const action = response.signal === "NO_LINKED_RESULTS" ? "plan" : topicId === "priority" ? "plan" : "journal"
  const conciseHeadline: Record<typeof response.signal, string> = {
    NO_LINKED_RESULTS: "이번 계획의 훈련 기록이 아직 없어요",
    NO_COMPARABLE_RESULTS: "계획 강도 비교 불가",
    ONE_SIGNAL: "계획과 실제 느낌을 1건 비교했어요",
    REPEATED_MATCH: "계획과 실제 느낌이 반복해서 맞았어요",
    REPEATED_HIGHER_EFFORT: "계획보다 높게 느낀 기록이 반복됐어요",
    MIXED_SIGNAL: "계획과 실제 느낌이 섞여 있어요",
  }
  const summary = topicId === "priority"
    ? response.recommendation === "REDUCE_OR_REVIEW"
      ? "다음 계획에서 훈련량을 줄일지 검토해요."
      : response.recommendation === "MAINTAIN_OR_VARY_METHOD"
        ? "같은 강도로 이어갈지 계획에서 확인해요."
        : response.recommendation === "MAINTAIN_AND_REVIEW"
          ? "차이가 난 훈련을 보고 다음 계획을 검토해요."
          : "기록을 더 살펴보고 다음 훈련을 정해요."
    : response.signal === "NO_COMPARABLE_RESULTS"
      ? "연결된 일지는 있지만 계획 강도 비교 불가예요."
      : response.signal === "REPEATED_HIGHER_EFFORT"
        ? "계획보다 높게 느낀 기록이 반복됐어요."
        : response.signal === "REPEATED_MATCH"
          ? "계획과 실제 느낌이 반복해서 맞았어요."
          : "계획과 실제 느낌을 연결된 일지에서 확인했어요."
  return {
    status,
    headline: conciseHeadline[response.signal],
    summary,
    source: `현재 계획 · 연결 ${response.linkedResultCount}건 · 비교 ${response.comparableRpeCount}건`,
    rows,
    unit: "RPE",
    detail: `${response.evidence.join(" / ")} 계획과 실제의 비교 설명만 제공하며, 같은 조건·향상 원인·자동 처방은 주장하지 않습니다.`,
    action,
    actionLabel: response.signal === "NO_LINKED_RESULTS"
      ? "계획에서 훈련 기록하기"
      : action === "plan" ? "현재 계획 검토" : missingComparison ? "훈련 일지 보기" : "훈련 일지 보기",
    ...(response.unknownCount > 0 || response.rejectedLinkCount > 0 || response.conflictCount > 0
      ? { notice: `강도 비교 불가 ${response.unknownCount}건 · 연결 불일치 ${response.rejectedLinkCount}건 · 기록 충돌 ${response.conflictCount}건` }
      : {}),
    requiredInput: status === "missing"
      ? response.signal === "NO_LINKED_RESULTS" ? "현재 계획에 연결된 훈련 일지 1건" : "계획 RPE가 있는 연결 일지 1건"
      : undefined,
    section: "summary",
    fingerprint: status === "missing" ? null : fingerprint({
      period: "current-plan",
      sourceCount: response.comparableRpeCount,
      rows: response.rows
        .filter((row) => row.actualRpe !== null)
        .slice(0, 8)
        .map((row) => ({
          label: `${row.date} · ${row.slot}`,
          value: row.actualRpe,
          planned: row.plannedRpe,
          comparison: row.comparison,
        })),
      counts: [response.withinRangeCount, response.higherThanRangeCount, response.lowerThanRangeCount],
    }),
  }
}

function trendResult(
  topicId: "compare" | "change",
  entries: readonly JournalEntry[],
  today: string,
  requestedMetric: OraclePersonalResultInput["metric"],
): OraclePersonalResult {
  const projected = observations(entries)
  const date = new Date(`${today}T12:00:00`)
  const primaryMetric: TrendMetric = requestedMetric ?? (topicId === "compare" ? "DISTANCE_KM" : "RPE")
  const primary = bucketByMonth(projected, date, 2, primaryMetric).filter((bucket): bucket is Extract<TrendBucket, { kind: "DATA" }> => bucket.kind === "DATA")
  const fallback = primaryMetric === "RPE"
    ? bucketByMonth(projected, date, 2, "DISTANCE_KM").filter((bucket): bucket is Extract<TrendBucket, { kind: "DATA" }> => bucket.kind === "DATA")
    : []
  const data = primary.length > 0 ? primary : fallback
  if (data.length === 0) {
    return {
      ...missingResult(
      "월별로 비교할 기록이 아직 없어요",
      "거리 또는 RPE 기록이 있으면 월별로 보여드려요.",
      "월별 훈련 기록",
      "월별 기록의 차이만 표시하며, 조건이 같았는지·훈련 효과·향상 원인은 판단하지 않습니다.",
      "log",
      "훈련 기록 남기기",
      "거리 또는 RPE가 있는 훈련 일지 1건 이상",
      "monthly",
      ),
      metric: primaryMetric,
    }
  }
  const metric = primary.length > 0 ? primaryMetric : "DISTANCE_KM"
  const isTwoMonth = data.length === 2
  const unit = metric === "RPE" ? "RPE" : "km"
  const rows = data.map((bucket) => ({
    label: bucket.label,
    value: bucket.median,
    valueLabel: `${bucket.median}${unit === "km" ? " km" : ""}`,
  }))
  const status = data.length < 2 ? "partial" : "ready"
  const notices = [
    ...(data.length < 2 ? ["비교할 월별 기록이 1개월뿐이에요."] : []),
    ...(data.some(bucket => bucket.displayStatus === "STALE") ? ["오래된 출처가 포함돼 있어요."] : []),
    ...(data.some(bucket => bucket.displayStatus === "CONFLICTING") ? ["출처가 서로 달라 확인이 필요해요."] : []),
  ]
  return {
    status,
    headline: metric === "RPE"
      ? isTwoMonth ? "최근 두 달 월별 RPE를 비교했어요" : "최근 월별 RPE를 확인했어요"
      : isTwoMonth ? "최근 두 달 월별 거리 기록을 비교했어요" : "최근 월별 거리 기록을 확인했어요",
    summary: metric === "RPE" ? "월별 훈련 한 번의 중간 RPE예요." : "월별 훈련 한 번의 중간 거리예요.",
    source: `월별 훈련 기록 · ${data.reduce((sum, bucket) => sum + bucket.n, 0)}개 기록 · ${data[0]?.label}~${data[data.length - 1]?.label}`,
    rows,
    unit,
    detail: "평균이 아닌 월별 중앙값입니다. 기록의 차이만 보여주며, 같은 조건이었는지·향상인지·원인이 무엇인지는 이 결과만으로 주장하지 않습니다.",
    action: metric === "RPE" ? "journal" : "trends",
    actionLabel: metric === "RPE" ? "RPE 기록 보기" : "내 훈련 분석 열기",
    ...(notices.length > 0 ? { notice: notices.join(" ") } : {}),
    metric,
    requiredInput: undefined,
    section: "monthly",
    fingerprint: fingerprint({
      period: data.map((bucket) => bucket.label),
      metric,
      sourceCount: data.reduce((sum, bucket) => sum + bucket.n, 0),
      rows: rows.map((row) => ({ label: row.label, value: row.value })),
    }),
  }
}

export function buildOraclePersonalResult(input: OraclePersonalResultInput): OraclePersonalResult {
  if (!isValidIsoDate(input.today)) return invalidDateResult()
  switch (input.topicId) {
    case "level": return levelResult(input.athleteRecords, input.today)
    case "focus": return planResult("focus", input.entries, input.planState)
    case "priority": return planResult("priority", input.entries, input.planState)
    case "mix": return mixResult(input.entries, input.today)
    case "compare": return trendResult("compare", input.entries, input.today, input.metric)
    case "change": return trendResult("change", input.entries, input.today, input.metric)
  }
}
