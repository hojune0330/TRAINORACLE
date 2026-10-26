import { ALL_WORKOUT_CATALOG, calculatedWorkoutSequence } from "@impl/prescription/all-workout-calculator"
import { resolveCatalogBinding } from "@impl/prescription/catalog-session-binding"
import { formatPaceSeconds, roundedPaceSeconds } from "@impl/prescription/record-pace"
import { matchesPacePrescriptionSequence } from "@impl/prescription/pace-sequence"
import { parsePrescriptionSequence } from "@impl/prescription/sequence"
import { deriveSequenceV3Totals, parsePrescriptionSequenceV3 } from "@impl/prescription/sequence-v3"
import { paceClock } from "./pace-tools"
import { notationDistance, notationEffort, notationNumber, notationPace, notationRecovery, notationTime,
  sequencePhaseNotation, sessionWorkoutName, type WorkoutDisplaySession, type WorkoutNotationStyle } from "./workout-notation"
import { TRAINING_EXPLANATION_PROFILES } from "./training-explanation-profiles"
import { catalogExecutionReading, catalogWorkoutReader } from "./catalog-workout-reader"
import { catalogPrescriptionBasis, sessionPrescriptionBasis, sessionPrimaryBasis } from "./prescription-basis"
import type { ResolvedAdjustedExplanation } from "./adjusted-method-snapshot"
import type { ReviewedAdjustedExplanationV3 } from "./adjusted-method-snapshot-v3"
import { canonicalJsonFingerprint } from "@impl/plan-generator/candidate-identity"
import { templateExplanation } from "./training-template-explanations"

export type WorkoutMemoContext = {
  readonly date?: string
  readonly state?: "PLAN" | "PREVIEW" | "HISTORICAL"
  readonly reviewedExplanation?: ResolvedAdjustedExplanation | ReviewedAdjustedExplanationV3
}
export type WorkoutMemoSession = WorkoutDisplaySession & { readonly day: number; readonly slot: "AM" | "PM" }
export type WorkoutMemoLine = { readonly label: string; readonly text: string; readonly emphasis?: boolean }
export type WorkoutMemoExplanation = {
  readonly scope: string
  readonly version: string
  readonly sections: readonly WorkoutMemoLine[]
  readonly sourceRefs: readonly string[]
}
export type WorkoutMemo = {
  readonly date: string | null
  readonly dateLabel: string
  readonly slotLabel: string
  readonly stateLabel: string
  readonly title: string
  readonly lines: readonly WorkoutMemoLine[]
  readonly basis: string | null
  readonly basisSummary: string | null
  readonly totalDuration: string | null
  readonly warnings: readonly string[]
  readonly wording: WorkoutNotationStyle
  readonly explanation: WorkoutMemoExplanation
}

function memoDate(value: string | undefined): string | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/u.test(value)) return null
  const date = new Date(`${value}T12:00:00Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? value : null
}
const range = (min: number, max: number) => min === max ? notationNumber(min) : `${notationNumber(min)}–${notationNumber(max)}`

/** Export only this prescription snapshot. Never read current PBs, diary text or account data. */
export function buildWorkoutMemo(session: WorkoutMemoSession, context: WorkoutMemoContext = {}, wording: WorkoutNotationStyle = "PLAIN"): WorkoutMemo | null {
  try { return projectMemo(session, context, wording) } catch { return null }
}

function projectMemo(session: WorkoutMemoSession, context: WorkoutMemoContext, wording: WorkoutNotationStyle): WorkoutMemo | null {
  const p = session.prescription
  if (!p) return null
  const lines: WorkoutMemoLine[] = [], warnings: string[] = []
  let basis: string | null = null
  let totalDuration: string | null = null
  const date = memoDate(context.date)
  if (context.date !== undefined && date === null) warnings.push("날짜가 정확하지 않아요. 날짜 없이 표시해요.")
  if (p.kind === "REST") lines.push({ label: "일정", text: "휴식", emphasis: true })
  else if (p.kind === "PACE_TARGET") {
    if (p.sequence !== undefined && !matchesPacePrescriptionSequence(p, p.sequence)) return null
    if (![p.setCount, p.repetitionsPerSet, p.repetitionDistanceM, p.targetRepSeconds].every(value => Number.isFinite(value) && value > 0)) return null
    if (![p.setCount, p.repetitionsPerSet].every(Number.isInteger)) return null
    if (!Number.isFinite(p.targetEventDistanceM) || p.targetEventDistanceM <= 0) return null
    if (![p.repetitionRecoverySeconds, p.setRecoverySeconds].every(value => value === null || Number.isFinite(value) && value >= 0)) return null
    const distance = `${notationNumber(p.repetitionDistanceM)}m`
    const work = `${p.repetitionsPerSet} × ${distance}`
    lines.push({ label: "본운동", text: p.setCount > 1 ? `${p.setCount} ${wording === "PLAIN" ? "세트" : "sets"} × (${work})` : work, emphasis: true })
    lines.push({ label: "목표", text: wording === "PLAIN" ? `${distance}마다 ${notationTime(roundedPaceSeconds(p.targetRepSeconds), wording)}`
      : p.repetitionDistanceM >= 1000 ? `@ ${notationPace(p.targetRepSeconds * 1000 / p.repetitionDistanceM)}`
        : `@ ${notationNumber(roundedPaceSeconds(p.targetRepSeconds))}s/${distance}`, emphasis: true })
    if (p.repetitionDistanceM >= 1000) lines.push({ label: "1회 목표", text: `${distance} = ${paceClock(p.targetRepSeconds)} (${notationNumber(roundedPaceSeconds(p.targetRepSeconds))}초)` })
    if (p.repetitionsPerSet > 1) lines.push({ label: "반복 사이", text: p.repetitionRecoveryMode === "NOT_APPLICABLE" ? "따로 쉬지 않음"
      : notationRecovery({ mode: p.repetitionRecoveryMode, seconds: p.repetitionRecoverySeconds }, wording) })
    if (p.setCount > 1) lines.push({ label: "세트 사이", text: p.setRecoveryMode === "NOT_APPLICABLE" ? "따로 쉬지 않음"
      : notationRecovery({ mode: p.setRecoveryMode, seconds: p.setRecoverySeconds }, wording) })
    const { warmup, cooldown } = p.operationalComponents
    if (![warmup.easyDurationMinutes, warmup.rpeMin, warmup.rpeMax, warmup.strides.repetitions,
      warmup.strides.durationSeconds, warmup.strides.recoverySeconds, cooldown.easyDurationMinutes,
      cooldown.rpeMin, cooldown.rpeMax].every(value => Number.isFinite(value) && value >= 0)) return null
    if (!Number.isInteger(warmup.strides.repetitions) || warmup.rpeMin > warmup.rpeMax || cooldown.rpeMin > cooldown.rpeMax
      || warmup.rpeMax > 10 || cooldown.rpeMax > 10) return null
    lines.push({ label: "준비", text: `${notationTime(warmup.easyDurationMinutes * 60, wording)} · ${notationEffort(`RPE ${range(warmup.rpeMin, warmup.rpeMax)}`, wording)}`
      + (warmup.strides.repetitions > 0 ? ` → ${warmup.strides.repetitions} × ${notationTime(warmup.strides.durationSeconds, wording)} ${notationEffort("PROGRESSIVE_NOT_ALL_OUT", wording)} · 반복 사이 ${notationTime(warmup.strides.recoverySeconds, wording)} ${wording === "PLAIN" ? "걷기/조깅" : "Walk/Jog"}` : "") })
    lines.push({ label: "정리", text: `${notationTime(cooldown.easyDurationMinutes * 60, wording)} · ${notationEffort(`RPE ${range(cooldown.rpeMin, cooldown.rpeMax)}`, wording)}` })
    basis = sessionPrescriptionBasis(session)
    if (p.stopCodes.includes("STOP_NEW_OR_WORSENING_PAIN")) warnings.push("새 통증이나 심해지는 통증이 생기면 중단")
    if (p.stopCodes.includes("STOP_DIZZINESS_OR_FAINTNESS")) warnings.push("어지럽거나 쓰러질 것 같으면 중단")
    if (p.stopCodes.includes("STOP_CHEST_PAIN_OR_UNUSUAL_BREATHING")) warnings.push("가슴 통증이나 평소와 다른 호흡 곤란이 생기면 중단")
    if (p.stopCodes.includes("STOP_LOSS_OF_CONTROLLED_FORM")) warnings.push("자세를 유지하기 어려우면 중단")
  } else {
    const catalog = p.kind === "RPE_TIME_RANGE" && p.catalogWorkout ? resolveCatalogBinding(p.catalogWorkout) : null
    const sequence = p.kind === "ADJUSTED_METHOD_V3" ? p.projection.sequence
      : p.kind === "ADJUSTED_METHOD" ? p.snapshot.projection.sequence : catalog ? calculatedWorkoutSequence(catalog) : null
    const targets = p.kind === "ADJUSTED_METHOD_V3" ? p.projection.segmentTargets
      : p.kind === "ADJUSTED_METHOD" ? p.snapshot.projection.segmentTargets : []
    if (sequence) {
      const parsed = sequence.version === 3 ? parsePrescriptionSequenceV3(sequence) : parsePrescriptionSequence(sequence)
      if (parsed.kind !== "parsed" || !targets.every(target => Number.isFinite(target.secondsPerKm) && target.secondsPerKm > 0
        && [target.targetRepSeconds, target.fixedWorkSeconds, target.distanceM].every(value => value === null || Number.isFinite(value) && value > 0))) return null
      if (sequence.version === 3) {
        const phases = Object.values(deriveSequenceV3Totals(sequence))
        totalDuration = phases.every(phase => phase.totalSeconds !== null)
          ? `${formatPaceSeconds(phases.reduce((sum, phase) => sum + phase.totalSeconds!, 0))} · 준비·회복·정리 포함`
          : "전체 시간 미산출 · 시간이 정해지지 않은 구간이 있어요."
      }
      const reading = catalog && wording === "PLAIN" ? catalogWorkoutReader(session) ?? catalogExecutionReading(catalog) : null
      lines.push({ label: "본운동", text: reading?.phases.main ?? sequencePhaseNotation(sequence, "main", targets, wording), emphasis: true })
      for (const [phase, label] of [["warmup", "준비"], ["cooldown", "정리"]] as const) {
        const text = reading?.phases[phase] ?? sequencePhaseNotation(sequence, phase, targets, wording)
        if (text) lines.push({ label, text })
      }
      basis = targets.length ? "저장 당시 실제 경기 기록 · 구간별 평균 페이스 환산" : "구간에 적힌 힘든 정도"
      if (catalog) {
        const total = catalog.totals.seconds
        if (total) totalDuration = `${formatPaceSeconds(total.minimum)}${total.minimum === total.maximum ? "" : `–${formatPaceSeconds(total.maximum)}`} · 준비·회복·정리 포함`
        const uniqueSteps = catalog.steps.filter((step, index, all) => all.findIndex(other => other.segmentId === step.segmentId) === index)
        for (const step of uniqueSteps) {
          if (!reading && step.kind === "RECOVERY" && step.distanceM !== null && step.seconds !== null) {
            lines.push({ label: "거리 회복", text: step.instruction })
          }
          if (!reading && step.phase === "main" && step.kind !== "RECOVERY" && (step.terrain !== "FLAT" || step.modality !== "RUN")) {
            const terrain: Record<string, string> = { HILL: "언덕", UPHILL: "오르막", FLAT: "평지", MIXED: "혼합 지형" }
            const modality: Record<string, string> = { RUN: "달리기", WALK: "걷기", CYCLE: "자전거", PLYO: "플라이오", STRENGTH: "근력" }
            lines.push({ label: step.distanceM === null ? "운동 방식" : `${notationDistance(step.distanceM)} 방식`,
              text: `${modality[step.modality] ?? step.modality} · ${terrain[step.terrain] ?? step.terrain}` })
          }
        }
        basis = catalogPrescriptionBasis(catalog)
      }
    } else if (p.kind === "RPE_TIME_RANGE") {
      if (![p.durationMinutes.minimum, p.durationMinutes.maximum, p.rpe.minimum, p.rpe.maximum].every(value => Number.isFinite(value) && value >= 0)
        || p.durationMinutes.minimum > p.durationMinutes.maximum || p.rpe.minimum > p.rpe.maximum || p.rpe.maximum > 10) return null
      lines.push({ label: "전체 운동", text: `${range(p.durationMinutes.minimum, p.durationMinutes.maximum)}${wording === "PLAIN" ? "분" : "min"} · ${notationEffort(`RPE ${range(p.rpe.minimum, p.rpe.maximum)}`, wording)}`, emphasis: true })
      basis = "힘든 정도로 맞추는 훈련 · 목표 페이스는 따로 없음"
      if (p.catalogWorkout) warnings.push("세부 구성을 불러오지 못했어요. 저장된 전체 시간과 힘든 정도만 보여요.")
      else if (session.role === "QUALITY") warnings.push("상세 구성 미정 · 전체 시간을 본운동 시간으로 사용하지 마세요.")
    } else return null
    warnings.push("통증·어지럼·자세 무너짐이 생기면 시간을 채우지 말고 중단하세요.")
  }
  return { date, dateLabel: date ? `${date.replaceAll("-", ".")} (${new Intl.DateTimeFormat("ko-KR", { weekday: "short", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`))})` : `${session.day}일차 · 날짜 미지정`,
    slotLabel: session.slot === "AM" ? "오전" : "오후",
    stateLabel: context.state === "PLAN" ? "" : context.state === "HISTORICAL" ? "당시 계획" : "적용 전 계획안",
    title: p.kind === "REST" ? "휴식" : p.kind === "RPE_TIME_RANGE" && p.catalogWorkout && !resolveCatalogBinding(p.catalogWorkout)
      ? "저장된 훈련" : sessionWorkoutName(session, wording === "COACH"), lines, basis,
    basisSummary: p.kind === "ADJUSTED_METHOD" || p.kind === "ADJUSTED_METHOD_V3"
      ? basis === "구간에 적힌 힘든 정도" ? null : basis : sessionPrimaryBasis(session),
    totalDuration, warnings, wording,
    explanation: memoExplanation(session, context) }
}

function memoExplanation(session: WorkoutMemoSession, context: WorkoutMemoContext): WorkoutMemoExplanation {
  const p = session.prescription!
  const unavailable = { scope: "연결된 설명을 확인하지 못했어요. 저장된 훈련 내용은 그대로 표시해요.", version: "확인 불가", sections: [], sourceRefs: [] }
  if (p.kind === "ADJUSTED_METHOD" || p.kind === "ADJUSTED_METHOD_V3") {
    const e = context.reviewedExplanation
    const binding = p.snapshot?.explanation
    // Anchored V3 reviews MAIN; its displayed sequence also contains inherited support.
    // Match the retained explanation fingerprint, not that expanded display sequence.
    if (!e || !binding || binding.contentFingerprint !== canonicalJsonFingerprint(
      p.kind === "ADJUSTED_METHOD_V3" ? "trainoracle.adjusted-method-explanation.v3" : "trainoracle.adjusted-method-explanation.v1", e)) return unavailable
    return { scope: context.state === "HISTORICAL" ? "당시 처방에 연결된 검토 설명이에요." : "이 훈련 구성에 연결된 검토 설명이에요.",
      version: e.version, sourceRefs: e.evidenceRefs,
      sections: [
        { label: "목적", text: e.purpose }, { label: "에너지 공급", text: e.energySupply },
        { label: "운동 구성", text: e.workRationale }, { label: "회복", text: e.recoveryRationale },
        { label: "주기 역할", text: e.cycleRole }, { label: "기대하는 변화", text: e.expectedAdaptation },
        { label: "한계", text: e.limitations }, { label: "확인할 것", text: e.observation },
      ] }
  }
  const profile = TRAINING_EXPLANATION_PROFILES[p.kind === "REST" ? "REST" : session.plannedEnergyIntent]
  const template = p.kind === "PACE_TARGET" ? templateExplanation(p) : null
  const binding = p.kind === "RPE_TIME_RANGE" ? p.catalogWorkout : undefined
  const catalog = binding && resolveCatalogBinding(binding)
    ? ALL_WORKOUT_CATALOG.find(row => row.id === binding.catalogId && row.fingerprint === binding.catalogFingerprint) : undefined
  const content = catalog?.explanation
  if (binding && !catalog) return unavailable
  return {
    scope: context.state === "HISTORICAL" ? "저장된 처방을 읽는 현재 설명이에요. 당시 선택 이유를 복원한 것은 아니에요."
      : catalog || template ? "저장된 훈련 구성에 연결된 설명이에요." : "훈련 목적의 공통 설명이에요. 개인의 효과나 이 구성의 최적성을 보장하지 않아요.",
    version: catalog?.version ?? template?.version ?? profile.version,
    sections: [
      { label: "목적", text: content?.purpose ?? profile.purpose },
      { label: "에너지 공급", text: content?.energySupply ?? profile.energyContext },
      { label: "운동 구성", text: content?.work ?? template?.work ?? profile.workRationale },
      { label: "회복", text: content?.recovery ?? template?.recovery ?? profile.recoveryRationale },
      { label: "기대와 한계", text: [content?.expected ?? profile.expectedAdaptation, ...(content ? [content.tradeoff, ...content.limitations] : profile.limitations), ...(template ? [template.limitation] : [])].join(" ") },
      { label: "확인할 것", text: content?.observation ?? profile.observationGuide },
    ],
    sourceRefs: catalog?.sourceRefs ?? [...profile.sourceIds, ...(template ? [...new Set([template.sourceRecordPath, template.decisionPath])].map(path => `https://github.com/hojune0330/TRAINORACLE/blob/main/${path}`) : [])],
  }
}

export function workoutMemoText(memo: WorkoutMemo): string {
  return ["TRAINORACLE", `${memo.dateLabel} · ${memo.slotLabel}`, memo.stateLabel, memo.title,
    ...(memo.totalDuration ? [`총 시간: ${memo.totalDuration}`] : []),
    ...memo.lines.map(line => `${line.label}: ${line.text}`), ...(memo.basis ? [`기준: ${memo.basis}`] : []), ...memo.warnings].filter(Boolean).join("\n")
}
