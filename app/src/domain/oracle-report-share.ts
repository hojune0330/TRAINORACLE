import type { OracleReport } from "./oracle-report"
import { safeOracleReportHeadline } from "./oracle-report-insights"

export type OracleShareTemplate = "summary" | "moment"
export type OracleShareSnapshot = {
  readonly template: OracleShareTemplate
  readonly headline: string
  readonly source: string
  readonly period: string
  readonly metrics: readonly { readonly label: string; readonly text: string }[]
  readonly months: readonly { readonly label: string; readonly km: number | null }[]
  readonly limitations: readonly string[]
}
export const shareKm = (value: number | null): string => value === null ? "미기록" : `${value.toLocaleString("ko-KR", { maximumFractionDigits: 1 })} km`
const validNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0
const date = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : "날짜 미확인"

/** Export boundary: reconstruct from named fields, never copy report/evidence objects. */
export function oracleShareMoments(report: OracleReport) {
  return report.evidence.flatMap((item, index) => {
    if (item.kind !== "post-session" || item.activityOutcome === "RESTED" || item.activityOutcome === "SKIPPED") return []
    const km = item.distanceIncluded && validNumber(item.metrics.DISTANCE_KM) ? item.metrics.DISTANCE_KM : null
    const duration = validNumber(item.durationMin) ? item.durationMin : null
    const method = item.methodLabel === "반복 달리기" ? "반복 달리기" : null
    if (km === null && duration === null && method === null) return []
    return [{ index, date: date(item.date), km, duration, method }]
  })
}

export function projectOracleShare(report: OracleReport, template: OracleShareTemplate, momentIndex?: number): OracleShareSnapshot | null {
  const months = report.monthly.map(month => ({ label: /^\d{4}-\d{2}$/.test(month.label) ? month.label : "월 미확인", km: validNumber(month.distance.totalKm) ? month.distance.totalKm : null }))
  const common = {
    template, source: report.source === "example" ? "예시 · 가상 기록 · 내 기록 분석이 아니에요" : "내 기록 · 확인된 구조화 기록",
    period: `${date(report.period.startDate)} – ${date(report.period.endDate)}`,
    limitations: ["기록한 운동만 반영 · 미기록은 0으로 채우지 않음",
      ...(report.period.currentMonthPartial ? ["이번 달은 오늘까지의 부분 기간이에요."] : []),
      `집계 제외 · 거리 ${report.distance.excludedSourceCount}건 · 훈련 종류 ${report.energy.excludedSourceCount}건`,
      "기록의 차이는 훈련 효과·현재 능력의 판정이 아니에요."],
  }
  if (template === "moment") {
    const moment = oracleShareMoments(report).find(item => item.index === momentIndex)
    if (!moment) return null
    return { ...common, headline: `${moment.date} · 기억할 운동`, metrics: [
      ...(moment.km === null ? [] : [{ label: "기록한 거리", text: shareKm(moment.km) }]),
      ...(moment.duration === null ? [] : [{ label: "기록한 시간", text: `${moment.duration.toLocaleString("ko-KR", { maximumFractionDigits: 1 })}분` }]),
      ...(moment.method === null ? [] : [{ label: "확인된 운동 방법", text: moment.method }])], months: [] }
  }
  const headline = safeOracleReportHeadline(report.insights.hero)
  if (headline === null || (report.distance.totalKm === null && report.workoutDayCount === 0 && report.raceChange === null)) return null
  return { ...common, headline,
    metrics: [...(validNumber(report.distance.totalKm) ? [{ label: "누적 거리", text: shareKm(report.distance.totalKm) }] : []),
      ...(report.workoutDayCount > 0 ? [{ label: "운동을 기록한 날", text: `${report.workoutDayCount}일` }] : []),
      ...(report.raceChange && Number.isFinite(report.raceChange.deltaSeconds) ? [{ label: "같은 종목 경기 기록 변화", text: `${report.raceChange.deltaSeconds > 0 ? "+" : ""}${report.raceChange.deltaSeconds}초` }] : [])], months }
}
