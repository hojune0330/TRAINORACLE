/** Owner-approved arithmetic. A race average is not a physiological measurement. */
export const RECORD_PACE_VERSION = "record-pace-v1" as const
export const PACE_EVENT_METERS = [800, 1500, 3000, 5000, 10000, 21097.5, 42195] as const
export const canonicalPaceDistance = (meters: number) => meters === 21097 ? 21097.5 : meters
/** Existing catalog models only. The exact middle-distance RP templates use their separate adapter. */
export function catalogRecordPaceModel(intent: string, eventDistanceM: number, declaredEventDistanceM?: number): SegmentPaceReference["model"] | null {
  if (intent === "RACE_PACE") return declaredEventDistanceM !== undefined
    && [10000, 21097.5, 42195].includes(canonicalPaceDistance(declaredEventDistanceM))
    && canonicalPaceDistance(eventDistanceM) === canonicalPaceDistance(declaredEventDistanceM) ? "RACE_AVERAGE_V1" : null
  if (eventDistanceM !== 5000) return null
  return intent === "LT" ? "FIVE_K_THRESHOLD_V1" : intent === "VO2" ? "RACE_AVERAGE_V1" : null
}
export type SegmentPaceReference = {
  readonly segmentId: string
  readonly kind: "ACTUAL" | "GOAL"
  readonly recordId: string
  readonly recordVersion: string
  readonly eventDistanceM: number
  readonly performanceSeconds: number
  readonly achievedOn: string | null
  readonly evaluatedOn: string
  readonly confirmed: true
  readonly model: "RACE_AVERAGE_V1" | "FIVE_K_THRESHOLD_V1"
}
export function validPaceDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && Number.isFinite(Date.parse(`${value}T00:00:00Z`))
    && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value
}
export function isSegmentPaceReference(value: unknown): value is SegmentPaceReference {
  if (!value || typeof value !== "object") return false
  const r = value as SegmentPaceReference
  return Object.keys(r).sort().join() === "achievedOn,confirmed,evaluatedOn,eventDistanceM,kind,model,performanceSeconds,recordId,recordVersion,segmentId"
    && typeof r.segmentId === "string" && r.segmentId.length > 0 && r.segmentId.length <= 128
    && ["ACTUAL", "GOAL"].includes(r.kind) && r.confirmed === true
    && typeof r.recordId === "string" && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(r.recordId)
    && typeof r.recordVersion === "string" && Number.isFinite(Date.parse(r.recordVersion))
    && PACE_EVENT_METERS.some(d => d === canonicalPaceDistance(r.eventDistanceM))
    && Number.isFinite(r.performanceSeconds) && r.performanceSeconds > 0 && r.performanceSeconds <= 86400
    && validPaceDate(r.evaluatedOn)
    && (r.achievedOn === null || validPaceDate(r.achievedOn) && r.achievedOn <= r.evaluatedOn)
    && (r.kind !== "GOAL" || r.achievedOn === null)
    && (r.model === "RACE_AVERAGE_V1" || r.model === "FIVE_K_THRESHOLD_V1" && r.eventDistanceM === 5000)
}
export function raceAverageSeconds(recordSeconds: number, eventMeters: number, segmentMeters: number): number | null {
  const meters = canonicalPaceDistance(eventMeters)
  if (!PACE_EVENT_METERS.some(d => d === meters) || !Number.isFinite(recordSeconds) || recordSeconds <= 0
    || !Number.isFinite(segmentMeters) || segmentMeters < 60) return null
  const result = recordSeconds * segmentMeters / meters
  return Number.isFinite(result) ? result : null
}
export function paceReferenceRange(reference: SegmentPaceReference) {
  if (!isSegmentPaceReference(reference)) return null
  const pace = raceAverageSeconds(reference.performanceSeconds, reference.eventDistanceM, 1000)
  if (pace === null) return null
  return reference.model === "FIVE_K_THRESHOLD_V1"
    ? { minimum: pace + 24 * 1000 / 1609.344, maximum: pace + 30 * 1000 / 1609.344 }
    : { minimum: pace, maximum: pace }
}
export function roundedPaceSeconds(seconds: number, decimals: 0 | 1 = 1): number {
  const factor = 10 ** decimals
  return Math.round(seconds * factor) / factor
}
export function formatPaceSeconds(seconds: number, decimals: 0 | 1 = 1): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "확인 필요"
  const factor = 10 ** decimals, ticks = Math.round(roundedPaceSeconds(seconds, decimals) * factor)
  const minutes = Math.floor(ticks / (60 * factor)), remainder = (ticks % (60 * factor)) / factor
  return minutes ? `${minutes}분 ${remainder.toFixed(decimals).replace(/\.0$/, "")}초` : `${remainder.toFixed(decimals).replace(/\.0$/, "")}초`
}
/** Comparison only. No prediction result can be passed back as an actual source. */
export function predictRaceFromActual(source: { kind: "ACTUAL"; recordId: string; eventDistanceM: number; performanceSeconds: number }, targetMeters: number) {
  if (source.kind !== "ACTUAL" || !source.recordId) return null
  const from = canonicalPaceDistance(source.eventDistanceM), to = canonicalPaceDistance(targetMeters)
  if (!PACE_EVENT_METERS.some(d => d === from) || !PACE_EVENT_METERS.some(d => d === to)
    || from === to || !Number.isFinite(source.performanceSeconds) || source.performanceSeconds <= 0 || source.performanceSeconds > 86400) return null
  return { kind: "PREDICTION" as const, model: "RIEGEL_1_06_V1" as const, sourceRecordId: source.recordId,
    sourceDistanceM: from, targetDistanceM: to, seconds: source.performanceSeconds * (to / from) ** 1.06,
    prescriptionEligible: false as const,
    limitation: from === 800 || to === 800 ? "중거리와 장거리의 특성 차이를 반영하지 못하는 비교값이에요."
      : from === 42195 || to === 42195 ? "마라톤 준비량과 보급을 반영하지 않아 실제보다 빠르게 예상할 수 있어요."
        : "종목별 준비와 경기 조건을 반영하지 않은 공식의 비교값이에요." }
}
