import { z } from "zod"
import { canonicalJsonFingerprint } from "@impl/plan-generator/candidate-identity"
import type { PaceTargetPlanPrescription } from "@impl/plan-generator/session-types"
import type { LinkablePlanSession, PlannedSessionLink } from "./planned-session-link"

const positive = z.number().finite().positive().max(86400)
export const plannedRepetitionEvidenceSchema = z.object({
  version: z.literal(1), source: z.literal("SELF_REPORTED"),
  plannedSessionId: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  sessionContentFingerprint: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  results: z.array(z.object({
    set: z.number().int().min(1).max(100), repetition: z.number().int().min(1).max(100),
    distanceM: positive.optional(), seconds: positive.optional(),
    recoverySeconds: z.number().finite().min(0).max(86400).optional(),
    recoveryMode: z.enum(["WALK", "JOG", "STAND"]).optional(),
  }).strict().refine(row => row.distanceM !== undefined || row.seconds !== undefined || row.recoverySeconds !== undefined || row.recoveryMode !== undefined))
    .min(1).max(100),
}).strict().refine(value => new Set(value.results.map(row => `${row.set}:${row.repetition}`)).size === value.results.length)
export type PlannedRepetitionEvidence = z.infer<typeof plannedRepetitionEvidenceSchema>

export function repetitionPrescription(link: PlannedSessionLink, session: LinkablePlanSession): PaceTargetPlanPrescription | null {
  if (canonicalJsonFingerprint("trainoracle.planned-session-content.v1", session) !== link.sessionContentFingerprint) return null
  const p = session.prescription as PaceTargetPlanPrescription
  return p?.kind === "PACE_TARGET" && Number.isFinite(p.targetRepSeconds) && p.targetRepSeconds > 0
    && Number.isInteger(p.setCount) && p.setCount > 0 && Number.isInteger(p.repetitionsPerSet) && p.repetitionsPerSet > 0
    && Number.isFinite(p.repetitionDistanceM) && p.repetitionDistanceM > 0
    && p.setCount * p.repetitionsPerSet <= 100 ? p : null
}

export function plannedRepeatRecovery(p: PaceTargetPlanPrescription, set: number, repetition: number) {
  if (repetition < p.repetitionsPerSet) return { seconds: p.repetitionRecoverySeconds, mode: p.repetitionRecoveryMode }
  if (set < p.setCount) return { seconds: p.setRecoverySeconds, mode: p.setRecoveryMode }
  return null
}

export type RepetitionComparison = {
  readonly kind: "compared" | "unavailable"
  readonly facts: readonly string[]
  readonly unknowns: readonly string[]
  readonly interpretation: string
  readonly completeDistanceCount: number
  readonly timedCount: number
  readonly changed: boolean
}
const n = (value: number) => Number(value.toFixed(2)).toString()

/** Compare explicitly aligned numbers only. No free text, capability score or causal diagnosis. */
export function comparePlannedRepetitions(value: unknown, link: PlannedSessionLink, session: LinkablePlanSession): RepetitionComparison {
  const unavailable = (reason: string): RepetitionComparison => ({ kind: "unavailable", facts: [], unknowns: [reason], interpretation: "",
    completeDistanceCount: 0, timedCount: 0, changed: false })
  const parsed = plannedRepetitionEvidenceSchema.safeParse(value)
  const p = repetitionPrescription(link, session)
  if (!parsed.success || !p || parsed.data.plannedSessionId !== link.plannedSessionId
    || parsed.data.sessionContentFingerprint !== link.sessionContentFingerprint) {
    return unavailable("반복 기록과 당시 처방의 연결을 확인하지 못했어요.")
  }
  const rows = [...parsed.data.results].sort((a, b) => a.set - b.set || a.repetition - b.repetition)
  if (rows.some(row => row.set > p.setCount || row.repetition > p.repetitionsPerSet)) {
    return unavailable("계획에 없는 세트·반복 번호가 있어, 먼저 기록 확인이 필요해요.")
  }
  const total = p.setCount * p.repetitionsPerSet
  const fullDistance = rows.filter(row => row.distanceM === p.repetitionDistanceM)
  const timed = fullDistance.filter(row => row.seconds !== undefined)
  const differentDistances = rows.filter(row => row.distanceM !== undefined && row.distanceM !== p.repetitionDistanceM)
  const facts = [`본인이 입력한 반복 기록이에요. ${p.repetitionDistanceM}m를 달렸다고 기록한 구간은 ${fullDistance.length}/${total}회예요.`]
  const unknowns: string[] = []
  if (differentDistances.length) facts.push(`계획과 다른 거리를 기록한 구간은 ${differentDistances.length}회예요. 해당 구간은 목표 초와 비교하지 않았어요.`)
  if (fullDistance.length < total) unknowns.push(`같은 거리의 완료가 확인되지 않은 ${total - fullDistance.length}회는 미기록 또는 다른 거리예요. 자동으로 실패 처리하지 않아요.`)
  if (timed.length) {
    const differences = timed.map(row => row.seconds! - p.targetRepSeconds)
    const min = Math.min(...differences), max = Math.max(...differences)
    facts.push(`${timed.length}회 시간 비교 · 목표 ${n(p.targetRepSeconds)}초 · 실제 ${n(Math.min(...timed.map(row => row.seconds!)))}~${n(Math.max(...timed.map(row => row.seconds!)))}초.`)
    facts.push(`목표 대비 차이 ${min > 0 ? "+" : ""}${n(min)}~${max > 0 ? "+" : ""}${n(max)}초. +는 더 오래 걸림, -는 더 짧게 걸림이에요.`)
  }
  if (timed.length < total) unknowns.push("모든 반복의 거리와 시간이 갖춰지지 않아 전체 훈련의 페이스 유지 여부는 판단하지 않아요.")
  let pacingObservation: string | null = null
  if (timed.length === total && total >= 4) {
    const half = Math.floor(total / 2)
    const mean = (values: typeof timed) => values.reduce((sum, row) => sum + row.seconds!, 0) / values.length
    const first = mean(timed.slice(0, half)), last = mean(timed.slice(-half))
    facts.push(`앞 ${half}회 평균 ${n(first)}초 · 뒤 ${half}회 평균 ${n(last)}초. 뒤 구간은 ${n(Math.abs(last - first))}초 ${last > first ? "길어졌어요" : last < first ? "짧아졌어요" : "차이예요"}.`)
    if (first < p.targetRepSeconds && last > first) {
      pacingObservation = "앞 구간은 목표보다 빨랐고, 뒤 구간은 앞보다 오래 걸렸어요. 다음에는 첫 반복부터 목표 속도를 맞춰 비교해요."
    } else if (last > first) {
      pacingObservation = "뒤 구간이 앞보다 오래 걸렸어요. 회복 조건과 당일 피로·날씨·코스를 함께 확인해야, 반복 속도를 유지하기 어려웠던 이유를 좁힐 수 있어요."
    } else {
      pacingObservation = "뒤 구간의 평균 시간이 앞 구간보다 늘지는 않았어요. 이번 훈련의 속도 유지 관찰이며, 특정 에너지 능력이 뛰어나다는 판정은 아니에요."
    }
  }
  let comparedRest = 0, changedRest = 0
  for (const row of rows) {
    const rest = plannedRepeatRecovery(p, row.set, row.repetition)
    const nextSet = row.repetition === p.repetitionsPerSet ? row.set + 1 : row.set
    const nextRep = row.repetition === p.repetitionsPerSet ? 1 : row.repetition + 1
    const next = rows.find(item => item.set === nextSet && item.repetition === nextRep)
    if (row.recoverySeconds === undefined && row.recoveryMode === undefined) continue
    if (!rest || !next || next.distanceM === undefined) {
      unknowns.push(`${row.set}세트 ${row.repetition}회 뒤 회복은 다음 반복의 거리 기록이 없어 비교하지 않았어요.`)
      continue
    }
    if (row.recoverySeconds === undefined || row.recoveryMode === undefined) {
      unknowns.push(`${row.set}세트 ${row.repetition}회 뒤에는 회복 시간과 방식이 모두 필요해요.`)
      continue
    }
    comparedRest++
    if (row.recoverySeconds !== rest.seconds || row.recoveryMode !== rest.mode) changedRest++
    const label = { JOG: "조깅", WALK: "걷기", STAND: "서서 쉬기", NOT_APPLICABLE: "없음" }
    facts.push(`${row.set}세트 ${row.repetition}회 뒤 · 계획 ${rest.seconds ?? "미지정"}초 ${label[rest.mode]} / 실제 ${n(row.recoverySeconds)}초 ${label[row.recoveryMode]}.`)
  }
  if (comparedRest < total - 1) unknowns.push("회복이 빠진 구간은 0초로 계산하지 않아요. 같은 회복 조건에서 반복했는지는 아직 일부 미확인이에요.")
  const interpretation = changedRest
    ? "회복 조건이 계획과 달랐어요. 페이스 차이를 능력 부족이나 향상만으로 설명할 수 없어요. 다음에는 속도뿐 아니라 회복 뒤 다시 시작할 수 있었는지도 함께 확인해요."
    : timed.length === total
      ? `${pacingObservation ?? "입력한 반복별 시간과 목표 시간을 비교했어요."} ${comparedRest === total - 1 ? "입력한 회복은 계획과 같았어요." : "회복 기록이 일부 없어 같은 조건에서 달렸는지는 아직 확인되지 않았어요."} 빠르게 마쳤다고 다음 훈련을 늘리지는 않아요.`
      : "남긴 구간의 수행은 확인할 수 있지만, 어려웠던 원인은 아직 구분할 수 없어요. 목표 속도·초반 페이스·회복·당일 상태가 영향을 줄 수 있으며, 특정 에너지 능력의 부족으로 단정하지 않아요."
  return { kind: "compared", facts, unknowns, interpretation, completeDistanceCount: fullDistance.length,
    timedCount: timed.length, changed: differentDistances.length > 0 || changedRest > 0 }
}
