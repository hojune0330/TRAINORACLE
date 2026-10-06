import { ALL_WORKOUT_CATALOG, calculatedWorkoutSequence } from "@impl/prescription/all-workout-calculator"
import { resolveCatalogBinding } from "@impl/prescription/catalog-session-binding"
import { roundedPaceSeconds } from "@impl/prescription/record-pace"
import { parsePrescriptionSequence } from "@impl/prescription/sequence"
import { parsePrescriptionSequenceV3 } from "@impl/prescription/sequence-v3"
import { paceClock } from "./pace-tools"
import { notationDistance, notationEffort, notationEvent, notationNumber, notationPace, notationRecovery, notationTime,
  sequencePhaseNotation, sessionWorkoutName, type WorkoutDisplaySession, type WorkoutNotationStyle } from "./workout-notation"
import { TRAINING_EXPLANATION_PROFILES } from "./training-explanation-profiles"

export type WorkoutMemoContext = { readonly date?: string; readonly state?: "PLAN" | "PREVIEW" | "HISTORICAL" }
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
  const date = memoDate(context.date)
  if (context.date !== undefined && date === null) warnings.push("날짜가 정확하지 않아요. 날짜 없이 표시해요.")
  if (p.kind === "REST") lines.push({ label: "일정", text: "휴식", emphasis: true })
  else if (p.kind === "PACE_TARGET") {
    if (![p.setCount, p.repetitionsPerSet, p.repetitionDistanceM, p.targetRepSeconds].every(value => Number.isFinite(value) && value > 0)) return null
    if (![p.setCount, p.repetitionsPerSet].every(Number.isInteger)) return null
    if (!Number.isFinite(p.targetEventDistanceM) || p.targetEventDistanceM <= 0) return null
    if (![p.repetitionRecoverySeconds, p.setRecoverySeconds].every(value => value === null || Number.isFinite(value) && value >= 0)) return null
    const distance = `${notationNumber(p.repetitionDistanceM)}m`
    const work = `${p.repetitionsPerSet} × ${distance}`
    lines.push({ label: "본운동", text: p.setCount > 1 ? `${p.setCount} ${wording === "PLAIN" ? "세트" : "sets"} × (${work})` : work, emphasis: true })
    lines.push({ label: "목표", text: p.repetitionDistanceM >= 1000 ? `@ ${notationPace(p.targetRepSeconds * 1000 / p.repetitionDistanceM)}`
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
    basis = `${notationEvent(p.targetEventDistanceM)} ${wording === "PLAIN" ? "경기 평균 페이스" : "RP"} · ${p.selectedAnchor.kind === "GOAL" ? "목표 기준 (현재 실력 아님)" : "계획에 저장된 기준 기록"}`
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
      lines.push({ label: "본운동", text: sequencePhaseNotation(sequence, "main", targets, wording), emphasis: true })
      for (const [phase, label] of [["warmup", "준비"], ["cooldown", "정리"]] as const) {
        const text = sequencePhaseNotation(sequence, phase, targets, wording)
        if (text) lines.push({ label, text })
      }
      basis = targets.length ? "구간별 경기 페이스 · 기록/목표 구분은 훈련 상세에서 확인" : "구간에 적힌 힘든 정도"
      if (catalog) {
        const uniqueSteps = catalog.steps.filter((step, index, all) => all.findIndex(other => other.segmentId === step.segmentId) === index)
        for (const step of uniqueSteps) {
          if (step.kind === "RECOVERY" && step.distanceM !== null && step.seconds !== null) {
            lines.push({ label: "거리 회복", text: step.instruction })
          }
          if (step.phase === "main" && step.kind !== "RECOVERY" && (step.terrain !== "FLAT" || step.modality !== "RUN")) {
            const terrain: Record<string, string> = { HILL: "언덕", UPHILL: "오르막", FLAT: "평지", MIXED: "혼합 지형" }
            const modality: Record<string, string> = { RUN: "달리기", WALK: "걷기", CYCLE: "자전거", PLYO: "플라이오", STRENGTH: "근력" }
            lines.push({ label: step.distanceM === null ? "운동 방식" : `${notationDistance(step.distanceM)} 방식`,
              text: `${modality[step.modality] ?? step.modality} · ${terrain[step.terrain] ?? step.terrain}` })
          }
        }
        if (catalog.inputs.paceReferences?.length) basis = [...new Set(catalog.inputs.paceReferences.map(reference =>
          `${notationEvent(reference.eventDistanceM)} · ${reference.kind === "GOAL" ? "목표 기준 (현재 실력 아님)" : "저장된 기록 기준"}${reference.model === "FIVE_K_THRESHOLD_V1" ? " · 역치 추정, 측정값 아님" : " 경기 평균 페이스"}`))].join(" / ")
        else if (catalog.steps.some(step => step.referenceRecordId)) basis = "5K 기록 기반 참고 · 계획에 저장된 값"
      }
    } else if (p.kind === "RPE_TIME_RANGE") {
      if (![p.durationMinutes.minimum, p.durationMinutes.maximum, p.rpe.minimum, p.rpe.maximum].every(value => Number.isFinite(value) && value >= 0)
        || p.durationMinutes.minimum > p.durationMinutes.maximum || p.rpe.minimum > p.rpe.maximum || p.rpe.maximum > 10) return null
      lines.push({ label: "전체 운동", text: `${range(p.durationMinutes.minimum, p.durationMinutes.maximum)}${wording === "PLAIN" ? "분" : "min"} · ${notationEffort(`RPE ${range(p.rpe.minimum, p.rpe.maximum)}`, wording)}`, emphasis: true })
      basis = "힘든 정도로 맞추는 훈련 · 목표 페이스는 따로 없음"
      if (p.catalogWorkout) warnings.push("세부 구성을 불러오지 못했어요. 저장된 전체 시간과 힘든 정도만 보여요.")
    } else return null
    warnings.push("언제 멈춰야 하는지는 훈련 상세에서 확인하세요.")
  }
  return { date, dateLabel: date ? `${date.replaceAll("-", ".")} (${new Intl.DateTimeFormat("ko-KR", { weekday: "short", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`))})` : `${session.day}일차 · 날짜 미지정`,
    slotLabel: session.slot === "AM" ? "오전" : "오후",
    stateLabel: context.state === "PREVIEW" ? "계획안 · 아직 적용 전" : context.state === "HISTORICAL" ? "당시 계획 · 실제 수행 기록 아님" : "계획한 훈련 · 실제 수행 아님",
    title: p.kind === "REST" ? "휴식" : p.kind === "RPE_TIME_RANGE" && p.catalogWorkout && !resolveCatalogBinding(p.catalogWorkout)
      ? "저장된 훈련" : sessionWorkoutName(session), lines, basis, warnings, wording,
    explanation: memoExplanation(session, context) }
}

function memoExplanation(session: WorkoutMemoSession, context: WorkoutMemoContext): WorkoutMemoExplanation {
  const p = session.prescription!
  const profile = TRAINING_EXPLANATION_PROFILES[p.kind === "REST" ? "REST" : session.plannedEnergyIntent]
  const binding = p.kind === "RPE_TIME_RANGE" ? p.catalogWorkout : undefined
  const catalog = binding && resolveCatalogBinding(binding)
    ? ALL_WORKOUT_CATALOG.find(row => row.id === binding.catalogId && row.fingerprint === binding.catalogFingerprint) : undefined
  const content = catalog?.explanation
  return {
    scope: context.state === "HISTORICAL" ? "저장된 처방을 읽는 현재 설명이에요. 당시 선택 이유를 복원한 것은 아니에요."
      : catalog ? "저장된 훈련 구성에 연결된 설명이에요." : "훈련 목적의 공통 설명이에요. 개인의 효과나 이 구성의 최적성을 보장하지 않아요.",
    version: catalog?.version ?? profile.version,
    sections: [
      { label: "목적", text: content?.purpose ?? profile.purpose },
      { label: "에너지 공급", text: content?.energySupply ?? profile.energyContext },
      { label: "운동 구성", text: content?.work ?? profile.workRationale },
      { label: "회복", text: content?.recovery ?? profile.recoveryRationale },
      { label: "기대와 한계", text: [content?.expected ?? profile.expectedAdaptation, ...(content ? [content.tradeoff, ...content.limitations] : profile.limitations)].join(" ") },
      { label: "확인할 것", text: content?.observation ?? profile.observationGuide },
    ],
    sourceRefs: catalog?.sourceRefs ?? profile.sourceIds,
  }
}

export function workoutMemoText(memo: WorkoutMemo): string {
  return ["TRAINORACLE", `${memo.dateLabel} · ${memo.slotLabel}`, memo.stateLabel, memo.title,
    ...memo.lines.map(line => `${line.label}: ${line.text}`), ...(memo.basis ? [`기준: ${memo.basis}`] : []), ...memo.warnings].join("\n")
}
