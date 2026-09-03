import type { PlanSession } from "@impl/plan-generator/types"
import { GLOSSARY } from "./glossary"
import { EXPLANATION_VERSION, TRAINING_EXPLANATION_PROFILES } from "./training-explanation-profiles"
import type { ExplanationPlan, ExplanationReceipt } from "./training-explanation-receipt"
import { templateExplanation } from "./training-template-explanations"

export type SessionExplanationContext = {
  readonly plan: ExplanationPlan
  readonly kind: "CANDIDATE" | "SAVED"
  readonly generatedAt?: string
  readonly receipt?: ExplanationReceipt
  readonly frameOrdinal?: number
}

export type ExplainedComponent = {
  readonly id: string
  readonly label: string
  readonly method: string
  readonly purpose: string
  readonly rationale: string
  readonly recovery: string
  readonly expectation: string
  readonly limitations: readonly string[]
  readonly observation: string
}

export function explanationProfile(session: PlanSession) {
  return TRAINING_EXPLANATION_PROFILES[session.role === "REST" ? "REST" : session.plannedEnergyIntent]
}

export function secondsText(seconds: number): string {
  return `${new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 4 }).format(seconds)}초`
}

function range(min: number, max: number): string {
  return min === max ? String(min) : `${min}~${max}`
}

function recoveryMode(mode: string): string {
  if (mode === "WALK") return "걷기"
  if (mode === "JOG") return "가벼운 조깅"
  if (mode === "STAND") return "서서 쉬기"
  return "별도 회복 없음"
}

export function buildSessionExplanationContent(session: PlanSession, context?: SessionExplanationContext) {
  const profile = explanationProfile(session)
  const p = session.prescription
  const templateContent = p.kind === "PACE_TARGET" ? templateExplanation(p) : null
  const contextMatchesSession = context?.plan.sessions.some((entry) => (
    entry.day === session.day && entry.slot === session.slot && JSON.stringify(entry) === JSON.stringify(session)
  )) ?? false
  const usableContext = contextMatchesSession ? context : undefined
  const components: ExplainedComponent[] = []
  const limitations: string[] = [...profile.limitations]
  const inputs: string[] = []
  let work: string
  let recovery: string

  if (p.kind === "REST") {
    work = "이 시간대에는 운동을 배치하지 않았어요. 운동 시간·반복·목표 강도는 적용하지 않아요."
    recovery = "휴식 자체가 이번 일정이에요. 회복이 끝났다는 판정이나 다음 날 강도를 올리라는 뜻은 아니에요."
    components.push({ id: "rest", label: "휴식", method: "배치된 운동 없음", purpose: profile.purpose, rationale: work, recovery, expectation: profile.expectedAdaptation, limitations: profile.limitations, observation: profile.observationGuide })
  } else if (p.kind === "RPE_TIME_RANGE") {
    const total = `${range(p.durationMinutes.minimum, p.durationMinutes.maximum)}분`
    const intensity = `RPE ${range(p.rpe.minimum, p.rpe.maximum)}`
    work = `${total}, ${intensity} 범위를 저장한 계획이에요. ${profile.workRationale}`
    recovery = session.role === "EASY"
      ? "별도 반복 사이 회복 시간은 정하지 않았어요. 표시된 시간 안에서 강도를 낮추거나 멈출 수 있어요."
      : `반복 길이·횟수와 회복 초수는 이 계획에 저장되지 않았어요. ${profile.recoveryRationale} 구체적인 회복 시간이 승인된 상세 처방인 것처럼 해석하지 마세요.`
    components.push({ id: "main", label: session.role === "QUALITY" ? "세션 시간 안내 (구간 미지정)" : "본운동", method: `${total} · ${intensity}`, purpose: profile.purpose, rationale: work, recovery, expectation: profile.expectedAdaptation, limitations: profile.limitations, observation: profile.observationGuide })
    if (session.role === "QUALITY") {
      limitations.push("총 시간은 준비·본운동·회복·정리를 포함해요. 이 시간 전체를 높은 강도로 계속 달리는 뜻이 아니에요.")
      limitations.push("구간별 숫자가 없는 RPE 안내예요. 반복과 회복의 구체적인 구성을 확인할 수 없어요. 상세 수치가 있더라도 개인의 반응이나 효과를 보장하지는 않아요.")
      if (session.plannedEnergyIntent === "MIXED_INTENT") limitations.push("서로 다른 목적의 구간과 순서가 저장되지 않아, 구간별 에너지 목적은 설명할 수 없어요.")
      components.unshift(genericComponent("warmup", "준비", "WARMUP"))
      components.push(genericComponent("cooldown", "정리", "COOLDOWN"))
    }
    inputs.push("선택한 훈련 목적과 저장된 시간·RPE 범위를 사용했어요. 개인 경기 기록으로 시간·RPE·페이스를 계산한 처방은 아니에요.")
  } else {
    work = `${p.repetitionDistanceM}m를 목표 ${secondsText(p.targetRepSeconds)}에 달리는 구간을 세트마다 ${p.repetitionsPerSet}회, ${p.setCount}세트로 나눴어요. 총 ${p.totals.totalRepetitions}회, 본운동 거리 ${p.totals.qualityDistanceM}m예요. ${profile.workRationale} 반복 수와 거리는 채택된 템플릿의 구성이고, 개인 기록으로 계산한 값은 목표 반복 시간이에요.`
    const repetition = p.repetitionRecoverySeconds === null || p.totals.repetitionRecoveryOccurrences === 0
      ? "반복 사이 회복은 적용하지 않아요."
      : `반복 사이 ${secondsText(p.repetitionRecoverySeconds)} ${recoveryMode(p.repetitionRecoveryMode)}를 ${p.totals.repetitionRecoveryOccurrences}번 넣었어요.`
    const set = p.setRecoverySeconds === null || p.totals.setRecoveryOccurrences === 0
      ? "세트 사이 별도 회복은 적용하지 않아요."
      : `세트 사이에는 ${secondsText(p.setRecoverySeconds)} ${recoveryMode(p.setRecoveryMode)}를 ${p.totals.setRecoveryOccurrences}번 넣었어요.`
    recovery = `${repetition} ${set} 마지막 반복 뒤에 반복 회복을 한 번 더 더하지 않아요. ${profile.recoveryRationale} 이 회복 방식은 채택된 구성의 일부이며, 걷기·조깅·정지를 바꾸면 다음 반복에 들어가는 상태도 달라질 수 있어요. 같은 효과라고 간주하지 않아요.`
    if (templateContent !== null) {
      work += ` ${templateContent.work}`
      recovery += ` ${templateContent.recovery}`
      limitations.push(templateContent.limitation)
    } else limitations.push("이 구성과 버전이 일치하는 템플릿별 설명을 찾지 못했어요. 공통 원리와 저장된 수치만 설명하며 별도의 채택 이유를 추정하지 않아요.")
    const warmup = p.operationalComponents.warmup
    const cooldown = p.operationalComponents.cooldown
    components.push({
      ...genericComponent("warmup", "준비", "WARMUP"),
      method: `${warmup.easyDurationMinutes}분 · RPE ${range(warmup.rpeMin, warmup.rpeMax)}`,
    }, {
      ...genericComponent("strides", "준비 중 점진 가속", "TECHNICAL"),
      method: `${secondsText(warmup.strides.durationSeconds)} × ${warmup.strides.repetitions}회`,
      recovery: `사이에 ${secondsText(warmup.strides.recoverySeconds)} 걷기 또는 조깅. 다음 가속에 들어가기 전 강도를 낮추는 구간이며, PCr이 완전히 회복됐다는 판정은 아니에요.`,
    }, { id: "main", label: "본운동", method: `${p.setCount} × (${p.repetitionsPerSet} × ${p.repetitionDistanceM}m)`, purpose: profile.purpose, rationale: work, recovery, expectation: profile.expectedAdaptation, limitations, observation: profile.observationGuide }, {
      ...genericComponent("cooldown", "정리", "COOLDOWN"),
      method: `${cooldown.easyDurationMinutes}분 · RPE ${range(cooldown.rpeMin, cooldown.rpeMax)}`,
    })
    inputs.push(`실제로 사용한 기준 기록: ${p.selectedAnchor.eventDistanceM}m ${secondsText(p.selectedAnchor.performanceSeconds)} (${p.selectedAnchor.achievedAt}).`)
    inputs.push(`기록 종류: ${p.selectedAnchor.kind === "PB" ? "개인 최고기록" : p.selectedAnchor.kind === "SB" ? "시즌 최고기록" : "최근 경기 기록"}. 확인 상태: ${p.selectedAnchor.verificationState === "VERIFIED" ? "검증된 기록" : p.selectedAnchor.verificationState === "SELF_REPORTED" ? "직접 입력한 기록" : "검증되지 않은 기록"}.`)
    inputs.push(`기준 기록에서 ${p.repetitionDistanceM}m 구간의 목표 시간을 계산했어요. 목표기록 달성 가능성이나 생리학적 역치를 측정한 결과는 아니에요.`)
    limitations.push("목표 시간은 계산값이며 실제 수행시간은 아니에요. 이 처방이 개인에게 최적인지, 같은 구성의 반복만으로 얼마나 향상될지는 아직 알 수 없어요.")
  }

  const ordered = usableContext?.plan.sessions.slice().sort((a, b) => a.day - b.day || (a.slot === b.slot ? 0 : a.slot === "AM" ? -1 : 1)) ?? []
  const index = ordered.findIndex((entry) => entry.day === session.day && entry.slot === session.slot)
  const cycle = [`${session.day}일차 ${session.slot === "AM" ? "오전" : "오후"}에 배치된 ${session.role === "QUALITY" ? "주요 훈련" : session.role === "REST" ? "휴식" : "쉬운 훈련"}이에요.`]
  if (usableContext !== undefined) {
    const goal = TRAINING_EXPLANATION_PROFILES[usableContext.plan.selectedEnergyIntent]
    cycle.push(`선택한 주기 목표는 ${GLOSSARY[goal.termId].label}예요. ${usableContext.plan.eventDistanceM == null ? "종목 정보는 저장되지 않았어요." : `대상 종목은 ${usableContext.plan.eventDistanceM}m예요.`}`)
    if (ordered[index - 1] !== undefined) cycle.push(`앞 일정: ${neighborLabel(ordered[index - 1]!)}`)
    if (ordered[index + 1] !== undefined) cycle.push(`다음 일정: ${neighborLabel(ordered[index + 1]!)}`)
    inputs.push(usableContext.plan.sourceMode === "JOURNAL_CONTEXT_ONLY"
      ? "최근 일지의 존재와 안전 조건을 확인한 계획이에요. 일지 횟수로 부족한 에너지 능력을 진단하거나 처방 수치를 자동으로 올리지 않았어요."
      : "일지의 누적 결과를 개인별 처방 계산 근거로 사용하지 않은 계획이에요.")
  } else cycle.push("연결된 주기 정보가 없어 종목·앞뒤 일정과 개인별 배치 이유는 확인할 수 없어요.")
  cycle.push(session.role === "QUALITY"
    ? "선택한 목적의 자극을 담당하는 날이에요. 다른 날의 누락 훈련을 더하거나 다음 주기의 양·강도·횟수를 자동으로 늘리지 않아요."
    : "주요 훈련 외 시간의 부담을 조절하는 역할이에요. 쉬운 날의 기록만으로 회복 완료를 판정하지 않아요.")

  const sourceIds = [...new Set([ ...profile.sourceIds, ...components.flatMap((component) => {
    if (component.id === "warmup") return TRAINING_EXPLANATION_PROFILES.WARMUP.sourceIds
    if (component.id === "cooldown") return TRAINING_EXPLANATION_PROFILES.COOLDOWN.sourceIds
    if (component.id === "strides") return TRAINING_EXPLANATION_PROFILES.TECHNICAL.sourceIds
    return []
  }) ])]
  return {
    version: EXPLANATION_VERSION, profile, contextMatchesSession,
    work, recovery, cycle, components, inputs, limitations, sourceIds,
    template: p.kind === "PACE_TARGET" ? { id: p.templateId, version: p.templateVersion, decision: p.approvalDecisionId } : null,
    templateContent,
  }
}

function genericComponent(id: string, label: string, kind: "WARMUP" | "COOLDOWN" | "TECHNICAL"): ExplainedComponent {
  const profile = TRAINING_EXPLANATION_PROFILES[kind]
  return { id, label, method: "개별 시간 미지정", purpose: profile.purpose, rationale: profile.workRationale, recovery: profile.recoveryRationale, expectation: profile.expectedAdaptation, limitations: profile.limitations, observation: profile.observationGuide }
}

function neighborLabel(session: PlanSession): string {
  return `${session.day}일차 ${session.slot === "AM" ? "오전" : "오후"} · ${GLOSSARY[explanationProfile(session).termId].label}`
}
