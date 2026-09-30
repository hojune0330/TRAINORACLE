import { z } from "zod"
import { canonicalJsonFingerprint } from "@impl/plan-generator/candidate-identity"
import { resolveCatalogBinding, type CatalogSessionBinding } from "@impl/prescription/catalog-session-binding"
import { compareCatalogPerformance } from "@impl/prescription/all-workout-calculator"
import type { LinkablePlanSession, PlannedSessionLink } from "./planned-session-link"
import type { RepetitionComparison } from "./planned-repetition-evidence"

export const plannedSegmentEvidenceSchema = z.object({ version: z.literal(1), source: z.literal("SELF_REPORTED"),
  plannedSessionId: z.string().regex(/^sha256:[a-f0-9]{64}$/), sessionContentFingerprint: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  calculationFingerprint: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  results: z.array(z.object({ key: z.string().max(300).regex(/^(warmup|main|cooldown):[A-Za-z0-9:_-]+:(WORK|BUILDUP|PREPARATION|RECOVERY):[1-9]\d*$/), distanceM: z.number().finite().positive().max(86400).optional(),
    seconds: z.number().finite().min(0).max(86400).optional(), rpe: z.number().int().min(1).max(10).optional(),
  }).strict().refine(r => r.distanceM !== undefined || r.seconds !== undefined || r.rpe !== undefined)
    .refine(r => r.seconds !== 0 || /:RECOVERY:\d+$/.test(r.key))).min(1).max(1000),
}).strict().refine(v => new Set(v.results.map(r => r.key)).size === v.results.length)
export type PlannedSegmentEvidence = z.infer<typeof plannedSegmentEvidenceSchema>
export function linkedCatalogWorkout(link: PlannedSessionLink, session: LinkablePlanSession) {
  if (canonicalJsonFingerprint("trainoracle.planned-session-content.v1", session) !== link.sessionContentFingerprint) return null
  const p = session.prescription as { kind: string; catalogWorkout?: CatalogSessionBinding }
  return p?.kind === "RPE_TIME_RANGE" && p.catalogWorkout ? resolveCatalogBinding(p.catalogWorkout) : null
}
export function comparePlannedSegments(value: unknown, link: PlannedSessionLink, session: LinkablePlanSession): RepetitionComparison {
  const empty: RepetitionComparison = { kind: "unavailable", facts: [], unknowns: ["구간 기록과 당시 훈련의 연결을 먼저 확인해 주세요."], interpretation: "", completeDistanceCount: 0, timedCount: 0, changed: false }
  const parsed = plannedSegmentEvidenceSchema.safeParse(value), plan = linkedCatalogWorkout(link, session)
  if (!parsed.success || !plan || parsed.data.plannedSessionId !== link.plannedSessionId
    || parsed.data.sessionContentFingerprint !== link.sessionContentFingerprint || parsed.data.calculationFingerprint !== plan.fingerprint) return empty
  const comparison = compareCatalogPerformance(plan, parsed.data.results)
  if (!comparison) return empty
  const n = (v: number) => Number(v.toFixed(2))
  const facts = comparison.rows.map(row => {
    const step = plan.steps.find(s => s.key === row.key)!
    const label = `${step.set ? `${step.set}세트 · ` : ""}${step.kind === "RECOVERY" ? "회복" : "운동"} ${step.occurrence}번째 구간`
    if (row.distanceStatus === "missing") return `${label}: 실제 거리가 미기록이라 목표 초와 비교하지 않았어요.`
    if (row.distanceStatus === "different") return `${label}: 계획과 다른 거리예요. 목표 초와 비교하지 않았어요.`
    if (row.timeDifference) return `${label}: 계획 대비 ${n(row.timeDifference.minimum)}${row.timeDifference.minimum === row.timeDifference.maximum ? "" : `~${n(row.timeDifference.maximum)}`}초 차이예요. +는 더 오래, -는 더 짧게예요.`
    return `${label}: 일부 값만 기록되어 시간 비교는 하지 않았어요.`
  })
  const distanceGroups = new Map<string, number[]>()
  for (const step of plan.steps.filter(s => s.phase === "main" && s.kind === "WORK" && s.distanceM !== null)) {
    const actual = parsed.data.results.find(r => r.key === step.key)
    if (actual?.distanceM !== step.distanceM || actual.seconds === undefined) continue
    const times = distanceGroups.get(step.segmentId) ?? []
    times.push(actual.seconds)
    distanceGroups.set(step.segmentId, times)
  }
  for (const [id, times] of distanceGroups) {
    const planned = plan.steps.filter(s => s.phase === "main" && s.kind === "WORK" && s.segmentId === id)
    if (times.length < 4 || times.length !== planned.length) continue
    const half = Math.floor(times.length / 2), mean = (values: number[]) => values.reduce((sum, v) => sum + v, 0) / values.length
    facts.push(`${planned[0]!.distanceM}m 반복: 앞 ${half}회 평균 ${n(mean(times.slice(0, half)))}초 · 뒤 ${half}회 평균 ${n(mean(times.slice(-half)))}초예요. 같은 구간의 기록 변화이며 능력의 원인 판정은 아니에요.`)
  }
  return { kind: "compared", facts,
    unknowns: [`미기록 ${comparison.unrecordedSteps}개 구간은 실패나 0초가 아니에요.`, "코스·회복 방식·당일 상태가 같았는지 별도 확인이 필요해요."],
    interpretation: comparison.interpretation, completeDistanceCount: comparison.rows.filter(r => r.sameDistance && plan.steps.find(s => s.key === r.key)?.distanceM !== null).length,
    timedCount: comparison.rows.filter(r => r.timeDifference !== null).length,
    changed: comparison.rows.some(r => r.distanceStatus === "different" || r.kind === "RECOVERY" && r.timeDifference && (r.timeDifference.minimum > 0 || r.timeDifference.maximum < 0)) }
}
