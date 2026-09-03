import type { PlanCandidate, PlanSession } from "@impl/plan-generator/types"
import { compareMainMethods, deriveSequenceTotals } from "@impl/prescription/sequence"
import { sessionPrescriptionSequence } from "./session-prescription-sequence"
import { secondsText } from "./session-explanation-content"

type ComparisonPlan = Pick<PlanCandidate, "eventDistanceM" | "eventGroup" | "selectedEnergyIntent" | "frame" | "sessions">
type QualitySession = Extract<PlanSession, { role: "QUALITY" }>
export type MainMethodRelation = "SAME" | "DIFFERENT_REQUIRES_REVIEW" | "UNSPECIFIED" | "CONTEXT_MISMATCH"
export type MainPrescriptionView = {
  readonly kind: "PACE_TARGET" | "RPE_TIME_RANGE"
  readonly work: string
  readonly recovery: string
  readonly intensity: string
  readonly time: string
  readonly limitation: string
}
export type MainComparisonRow = {
  readonly key: string
  readonly day: number
  readonly slot: "AM" | "PM"
  readonly a: MainPrescriptionView | null
  readonly b: MainPrescriptionView | null
  readonly samePrescribedValues: boolean
  readonly methodRelation: MainMethodRelation
}

const slotKey = (session: PlanSession) => `${session.day}:${session.slot}`
const range = (minimum: number, maximum: number) => minimum === maximum ? `${minimum}` : `${minimum}~${maximum}`
const recoveryModes = { WALK: "걷기", JOG: "가벼운 조깅", STAND: "서서 쉬기", NOT_APPLICABLE: "별도 회복 없음" } as const

function prescribedValues(session: PlanSession) {
  const p = session.prescription
  if (p.kind === "REST") return [p.kind]
  if (p.kind === "RPE_TIME_RANGE") return [p.kind, p.rpe.minimum, p.rpe.maximum, p.durationMinutes.minimum, p.durationMinutes.maximum]
  return [p.kind, p.setCount, p.repetitionsPerSet, p.repetitionDistanceM, p.targetEventDistanceM,
    p.targetRepSeconds, p.repetitionRecoverySeconds, p.repetitionRecoveryMode, p.setRecoverySeconds, p.setRecoveryMode]
}

function sameContext(a: PlanSession, b: PlanSession) {
  return a.day === b.day && a.slot === b.slot && a.role === b.role && a.plannedEnergyIntent === b.plannedEnergyIntent
}

function isUnique(sessions: readonly PlanSession[]) {
  return new Set(sessions.map(slotKey)).size === sessions.length
}

function mainView(session: QualitySession): MainPrescriptionView | null {
  const p = session.prescription
  if (p.kind === "RPE_TIME_RANGE") return {
    kind: p.kind,
    work: "반복 거리·운동 구간·횟수 미지정",
    recovery: "반복·세트 사이 회복 시간 미지정",
    intensity: `RPE ${range(p.rpe.minimum, p.rpe.maximum)}`,
    time: `세션 전체 ${range(p.durationMinutes.minimum, p.durationMinutes.maximum)}분 (준비·회복·정리 포함)`,
    limitation: "구간별 방법을 비교할 수 없어요. 표시된 시간 내내 이 강도로 달리라는 뜻은 아니에요.",
  }
  const sequence = sessionPrescriptionSequence(session)
  if (sequence === null) return null
  const totals = deriveSequenceTotals(sequence)
  const rep = totals.repetitionRecoveryOccurrences === 0 ? "반복 사이 회복 해당 없음"
    : `반복 사이 ${p.repetitionRecoverySeconds === null ? "시간 미지정" : secondsText(p.repetitionRecoverySeconds)} ${recoveryModes[p.repetitionRecoveryMode]} · 총 ${totals.repetitionRecoveryOccurrences}번`
  const set = totals.setRecoveryOccurrences === 0 ? "세트 사이 회복 해당 없음"
    : `세트 사이 ${p.setRecoverySeconds === null ? "시간 미지정" : secondsText(p.setRecoverySeconds)} ${recoveryModes[p.setRecoveryMode]} · 총 ${totals.setRecoveryOccurrences}번`
  return {
    kind: p.kind,
    work: `${p.setCount}세트 × (${p.repetitionsPerSet}회 × ${p.repetitionDistanceM}m) · 총 ${totals.totalRepetitions}회`,
    recovery: `${rep}. ${set}.`,
    intensity: `${p.targetEventDistanceM}m 기록 기준 · ${p.repetitionDistanceM}m마다 목표 ${secondsText(p.targetRepSeconds)}`,
    time: "전체 수행시간 미산정. 목표 반복 시간은 실제 소요시간을 보장하지 않아요.",
    limitation: "구성과 목표를 구체적으로 확인할 수 있어요. 같은 방법도 개인 반응은 다르며, 효과나 부담이 같다는 뜻은 아니에요.",
  }
}

function relation(a: QualitySession, b: QualitySession): MainMethodRelation {
  if (!sameContext(a, b)) return "CONTEXT_MISMATCH"
  const aSequence = sessionPrescriptionSequence(a)
  const bSequence = sessionPrescriptionSequence(b)
  if (aSequence === null || bSequence === null) return "UNSPECIFIED"
  return compareMainMethods(aSequence, bSequence).kind === "same" ? "SAME" : "DIFFERENT_REQUIRES_REVIEW"
}

/** Read-only comparison. No IDs, athlete records, notes, new dose or activation authority. */
export function comparePlanMainWork(a: ComparisonPlan, b: ComparisonPlan) {
  const contextMatches = a.eventDistanceM === b.eventDistanceM && a.eventGroup === b.eventGroup
    && a.selectedEnergyIntent === b.selectedEnergyIntent
    && a.frame.lengthDays === b.frame.lengthDays && a.frame.projectionLengthDays === b.frame.projectionLengthDays
    && isUnique(a.sessions) && isUnique(b.sessions)
  const aMain = a.sessions.filter((session): session is QualitySession => session.role === "QUALITY")
  const bMain = b.sessions.filter((session): session is QualitySession => session.role === "QUALITY")
  const aMap = new Map(aMain.map((session) => [slotKey(session), session]))
  const bMap = new Map(bMain.map((session) => [slotKey(session), session]))
  const positions = [...new Map([...aMain, ...bMain].map((session) => [slotKey(session), session])).values()]
    .sort((left, right) => left.day - right.day || left.slot.localeCompare(right.slot))
  const rows: MainComparisonRow[] = positions.map((position) => {
    const key = slotKey(position)
    const left = aMap.get(key)
    const right = bMap.get(key)
    const aView = left === undefined ? null : mainView(left)
    const bView = right === undefined ? null : mainView(right)
    const comparable = contextMatches && left !== undefined && right !== undefined && aView !== null && bView !== null && sameContext(left, right)
    return {
      key, day: position.day, slot: position.slot, a: aView, b: bView,
      samePrescribedValues: comparable && JSON.stringify(prescribedValues(left)) === JSON.stringify(prescribedValues(right)),
      methodRelation: !comparable ? "CONTEXT_MISMATCH" : relation(left, right),
    }
  })
  // The global easy-time-only sentence also requires identical support and operational components.
  const bSessions = new Map(b.sessions.map((session) => [slotKey(session), session]))
  const onlyEasyDurationCanDiffer = contextMatches && a.sessions.length === b.sessions.length && a.sessions.every((left) => {
    const right = bSessions.get(slotKey(left))
    if (right === undefined || !sameContext(left, right)) return false
    const p = left.prescription
    const q = right.prescription
    if (left.role === "EASY" && p.kind === "RPE_TIME_RANGE" && q.kind === "RPE_TIME_RANGE") {
      return p.rpe.minimum === q.rpe.minimum && p.rpe.maximum === q.rpe.maximum
        && p.durationMinutes.minimum === q.durationMinutes.minimum
        && (p.durationMinutes.maximum === q.durationMinutes.maximum || q.durationMinutes.maximum === p.durationMinutes.minimum)
    }
    if (p.kind === "PACE_TARGET" && q.kind === "PACE_TARGET") {
      const ps = sessionPrescriptionSequence(left)
      const qs = sessionPrescriptionSequence(right)
      if (ps === null || qs === null || JSON.stringify(ps.warmup) !== JSON.stringify(qs.warmup)
        || JSON.stringify(ps.cooldown) !== JSON.stringify(qs.cooldown)
        || JSON.stringify(p.stopCodes) !== JSON.stringify(q.stopCodes) || p.fallbackCode !== q.fallbackCode) return false
    }
    return JSON.stringify(prescribedValues(left)) === JSON.stringify(prescribedValues(right))
  })
  const easyDurationOnly = onlyEasyDurationCanDiffer && a.sessions.some((left) => {
    const right = bSessions.get(slotKey(left))
    return left.role === "EASY" && right?.role === "EASY"
      && left.prescription.durationMinutes.maximum !== right.prescription.durationMinutes.maximum
  })
  return {
    contextMatches, rows, easyDurationOnly,
    sameMainValues: contextMatches && rows.length > 0 && rows.every((row) => row.samePrescribedValues),
    sameMainPrescription: contextMatches && rows.length > 0 && rows.every((row) => row.samePrescribedValues && row.methodRelation === "SAME"),
    hasDetailed: rows.some((row) => row.a?.kind === "PACE_TARGET" || row.b?.kind === "PACE_TARGET"),
    hasUnspecified: rows.some((row) => row.methodRelation === "UNSPECIFIED"),
  }
}
