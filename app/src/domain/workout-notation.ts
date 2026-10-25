import type { PlanSession, PlannedEnergyIntent } from "@impl/plan-generator/types"
import type { PrescriptionSequence, PrescriptionSequenceNode, SequenceRecovery, SequenceTarget } from "@impl/prescription/sequence"
import type { PrescriptionSequenceV3, SequenceNodeV3, RecoveryStepV3 } from "@impl/prescription/sequence-v3"
import type { AdjustedSegmentTarget } from "./adjusted-method-resolution"
import { ALL_WORKOUT_CATALOG, calculatedWorkoutSequence, calculateCatalogWorkout } from "../../../impl/src/prescription/all-workout-calculator"
import { roundedPaceSeconds } from "@impl/prescription/record-pace"
import { catalogDeliveryProfile } from "@impl/prescription/catalog-delivery"

type Sequence = PrescriptionSequence | PrescriptionSequenceV3
export type WorkoutNotationStyle = "COACH" | "PLAIN"
type PacePrescription = Extract<PlanSession["prescription"], { kind: "PACE_TARGET" }>
type RpePrescription = Extract<PlanSession["prescription"], { kind: "RPE_TIME_RANGE" }>
type DisplayPrescription = PlanSession["prescription"]
  | { readonly kind: "ADJUSTED_METHOD_V3"; readonly projection: { readonly sequence: PrescriptionSequenceV3; readonly segmentTargets: readonly AdjustedSegmentTarget[] } }
  | { readonly kind: "ADJUSTED_METHOD"; readonly snapshot: { readonly projection: { readonly sequence: PrescriptionSequence; readonly segmentTargets: readonly AdjustedSegmentTarget[] } } }
export type WorkoutDisplaySession = {
  readonly role: string
  readonly plannedEnergyIntent: PlannedEnergyIntent
  readonly prescription?: DisplayPrescription
}

export function notationNumber(value: number): string {
  const rounded = Number(value.toFixed(3))
  return `${rounded === value ? "" : "≈"}${rounded}`
}
export function notationTime(seconds: number, style: WorkoutNotationStyle = "COACH"): string {
  return seconds >= 60 && seconds % 60 === 0 ? `${seconds / 60}${style === "PLAIN" ? "분" : "min"}`
    : `${notationNumber(seconds)}${style === "PLAIN" ? "초" : "s"}`
}
export function notationDistance(metres: number): string {
  return metres >= 1000 && metres % 1000 === 0 ? `${metres / 1000}km` : `${notationNumber(metres)}m`
}
export function notationEvent(metres: number): string {
  return metres >= 1000 && metres % 1000 === 0 ? `${metres / 1000}K` : `${metres}m`
}
export function notationPace(secondsPerKm: number): string {
  const rounded = Math.round(secondsPerKm)
  return `${rounded === secondsPerKm ? "" : "≈"}${Math.floor(rounded / 60)}:${String(rounded % 60).padStart(2, "0")}/km`
}
const recoveryModes: Record<RecoveryStepV3["mode"], string> = {
  WALK: "Walk", JOG: "Jog", STAND: "Stand", WALK_OR_JOG: "Walk/Jog", WALK_OR_STAND: "Walk/Stand",
  FULL_RECOVERY: "상태에 맞춰 회복", COACH_DEFINED: "지도자 지정", ACTIVE_ROLL_ON: "Roll-on",
}
const plainRecoveryModes: Record<RecoveryStepV3["mode"], string> = {
  WALK: "걷기", JOG: "조깅", STAND: "서서 쉬기", WALK_OR_JOG: "걷기/조깅", WALK_OR_STAND: "걷기/서서 쉬기",
  FULL_RECOVERY: "상태에 맞춰 회복", COACH_DEFINED: "지도자가 정한 회복", ACTIVE_ROLL_ON: "달리며 회복",
}
export function notationRecovery(step: RecoveryStepV3, style: WorkoutNotationStyle = "COACH"): string {
  const amount = "distanceM" in step ? notationDistance(step.distanceM)
    : step.seconds === null ? "시간 미지정" : step.seconds <= 90 ? `${notationNumber(step.seconds)}${style === "PLAIN" ? "초" : "s"}` : notationTime(step.seconds, style)
  return `${amount} ${style === "PLAIN" ? plainRecoveryModes[step.mode] : recoveryModes[step.mode]}`
}

export function notationEffort(cue: string | null, style: WorkoutNotationStyle = "COACH"): string {
  if (cue === null) return "강도 미지정"
  const shortCues: Readonly<Record<string, string>> = {
    "문장으로 대화할 수 있는 노력 본운동 체감 노력 제안 RPE 3~4": "대화할 수 있는 강도 · RPE 3~4",
    "힘들지만 정해진 구간 동안 고르게 유지하는 노력 본운동 체감 노력 제안 RPE 6~7": "고르게 유지 · RPE 6~7",
    "빠른 구간에서 유지 가능한 강한 리듬, 느린 구간에서 분명한 속도 감소 본운동 체감 노력 제안 RPE 6~7": "빠른 구간은 고르게, 느린 구간은 확실히 천천히 · RPE 6~7",
    "숨이 많이 차지만 다음 반복을 남겨 두는 강한 노력 본운동 체감 노력 제안 RPE 7~8": "다음 반복을 할 여력을 남기기 · RPE 7~8",
  }
  if (style === "PLAIN") cue = shortCues[cue] ?? cue
  if (/s\/\d+m/.test(cue)) return cue
  const matches = [...cue.matchAll(/\bRPE\s*(\d+(?:\.\d+)?)(?:\s*[~–-]\s*(\d+(?:\.\d+)?))?/gu)]
  if (matches.length === 1) {
    const min = Number(matches[0]![1]), max = Number(matches[0]![2] ?? min)
    if (Number.isInteger(min) && Number.isInteger(max) && min >= 1 && max <= 10 && min <= max) {
      const value = `${min}${min === max ? "" : `–${max}`}`
      return style === "PLAIN" ? cue.replace(matches[0]![0], `힘든 정도 ${value}/10`) : `RPE ${value}`
    }
  }
  if (cue === "PROGRESSIVE_NOT_ALL_OUT" || cue === "점진적으로 속도를 올리되 전력질주하지 않기") return style === "PLAIN" ? "가속 달리기 (전력질주 아님)" : "Build-up (전력질주 아님)"
  return cue
}
function targetText(target: SequenceTarget, id: string, distance: number | null, targets: readonly AdjustedSegmentTarget[], style: WorkoutNotationStyle): string {
  if (target.kind === "EFFORT_GUIDANCE") return notationEffort(target.cue, style)
  if (target.kind === "SPRINT_REFERENCE") return "단거리 기준 · 목표 속도 별도 확인"
  const rp = target.eventDistanceM === null ? "기준 페이스 미지정" : `${notationEvent(target.eventDistanceM)} ${style === "PLAIN" ? "경기 평균 페이스" : "RP"}`
  const calculated = targets.find(item => item.segmentId === id && item.distanceM === distance)
  if (calculated?.targetRepSeconds != null && distance !== null) return `${notationNumber(roundedPaceSeconds(calculated.targetRepSeconds))}${style === "PLAIN" ? "초" : "s"}/${notationDistance(distance)} · ${rp}`
  if (calculated?.fixedWorkSeconds != null) return `${notationPace(calculated.secondsPerKm)} · ${rp}`
  return rp
}

function v3NodesText(nodes: readonly SequenceNodeV3[], targets: readonly AdjustedSegmentTarget[], style: WorkoutNotationStyle = "COACH"): string {
  return nodes.map(node => {
    let body: string
    if (node.kind === "segment") {
      const work = node.work.kind === "distance" ? node.work.distanceM === null ? "거리 미지정" : notationDistance(node.work.distanceM)
        : node.work.durationSeconds === null ? "시간 미지정" : notationTime(node.work.durationSeconds, style)
      body = `${node.repeatCount > 1 ? `${node.repeatCount} × ` : ""}${work}${style === "PLAIN" ? " · " : " @ "}${targetText(node.target, node.id, node.work.distanceM, targets, style)}`
    } else {
      const inner = v3NodesText(node.children, targets, style)
      const simple = node.children.length === 1 && node.children[0]!.kind === "segment"
        && node.children[0]!.repeatCount === 1 && !node.children[0]!.recoveryAfter.length
      body = node.repeatCount === 1 ? inner : node.repeatUnit === "SET"
        ? `${node.repeatCount} ${style === "PLAIN" ? "세트" : "sets"} × (${inner})`
        : `${node.repeatCount} × ${simple ? inner : `(${inner})`}`
    }
    if (node.repeatCount > 1 && node.recoveryBetweenRepeats.length) {
      const isSet = node.kind === "group" && node.repeatUnit === "SET"
      const mark = style === "PLAIN" ? isSet ? "세트 사이 " : "반복 사이 " : isSet ? "R" : "r"
      body += ` · ${mark}${node.recoveryBetweenRepeats.map(step => notationRecovery(step, style)).join(" + ")}`
    }
    if (node.recoveryAfter.length) body += ` → 종료 뒤 ${node.recoveryAfter.map(step => notationRecovery(step, style)).join(" + ")}`
    return body
  }).join(" → ")
}

// Display adapter only: V1/V2 recoveryAfter is conditional on the next sibling.
// Do not reuse this as a storage migration or change V3's unconditional recovery.
function legacyDisplayNodes(nodes: readonly PrescriptionSequenceNode[]): readonly SequenceNodeV3[] {
  const recovery = (r: SequenceRecovery): readonly RecoveryStepV3[] => r.mode === "NOT_APPLICABLE" ? [] : [r]
  return nodes.map((node, index): SequenceNodeV3 => {
    const rests = { recoveryBetweenRepeats: recovery(node.recoveryBetweenRepeats),
      recoveryAfter: index < nodes.length - 1 ? recovery(node.recoveryAfter) : [] }
    return node.kind === "group"
      ? { ...node, ...rests, repeatUnit: "SET", children: legacyDisplayNodes(node.children) }
      : { ...node, ...rests, role: "WORK" }
  })
}
export function sequenceNotation(sequence: Sequence, targets: readonly AdjustedSegmentTarget[] = [], style: WorkoutNotationStyle = "COACH"): string {
  if (sequence.version === 3) return v3NodesText(sequence.main, targets, style)
  const text = v3NodesText(legacyDisplayNodes(sequence.main), targets, style)
  return sequence.version === 2 && sequence.terminalRecovery && sequence.terminalRecovery.mode !== "NOT_APPLICABLE"
    ? `${text} → 마지막 본운동 뒤 ${notationRecovery(sequence.terminalRecovery, style)}` : text
}

/** Read-only phase display; terminal recovery belongs to MAIN, not warmup/cooldown. */
export function sequencePhaseNotation(sequence: Sequence, phase: "warmup" | "main" | "cooldown", targets: readonly AdjustedSegmentTarget[] = [], style: WorkoutNotationStyle = "COACH"): string {
  if (phase === "main") return sequenceNotation(sequence, targets, style)
  return sequence.version === 3 ? v3NodesText(sequence[phase], targets, style) : v3NodesText(legacyDisplayNodes(sequence[phase]), targets, style)
}

function repeated(nodes: Sequence["main"]): boolean {
  return nodes.some(node => node.repeatCount > 1 || (node.kind === "group" && repeated(node.children)))
}
export function sequenceWorkoutName(sequence: Sequence, intent?: PlannedEnergyIntent): string {
  if (intent === "LT_INTENT") return repeated(sequence.main) ? "크루즈 인터벌 · Cruise Intervals" : "템포런 · Tempo Run"
  if (intent === "RECOVERY_INTENT") return "회복 운동 · Recovery"
  if (intent === "BASE_INTENT") return "저강도 달리기 · Easy Run"
  if (intent === "MIXED_INTENT") return "혼합 훈련 · Mixed Session"
  if (intent === "ATP_PC_INTENT") return "짧은 고출력 훈련 · ATP-PC"
  return repeated(sequence.main) ? "인터벌 · Intervals" : "달리기 · Run"
}
export function pacePrescriptionNotation(p: PacePrescription, style: WorkoutNotationStyle = "COACH"): string {
  const work = `${p.repetitionsPerSet} × ${notationDistance(p.repetitionDistanceM)}`
  const sets = p.setCount > 1 ? `${p.setCount} ${style === "PLAIN" ? "세트" : "sets"} × (${work})` : work
  const recovery = (value: number | null, mode: PacePrescription["repetitionRecoveryMode"], mark: string) =>
    value !== null && mode !== "NOT_APPLICABLE" ? ` · ${mark}${notationRecovery({ mode, seconds: value }, style)}` : ""
  return `${sets}${style === "PLAIN" ? " · " : " @ "}${notationNumber(roundedPaceSeconds(p.targetRepSeconds))}${style === "PLAIN" ? "초" : "s"}/${notationDistance(p.repetitionDistanceM)} · ${notationEvent(p.targetEventDistanceM)} ${style === "PLAIN" ? "경기 평균 페이스" : "RP"}`
    + (p.repetitionsPerSet > 1 ? recovery(p.repetitionRecoverySeconds, p.repetitionRecoveryMode, style === "PLAIN" ? "반복 사이 " : "r") : "")
    + (p.setCount > 1 ? recovery(p.setRecoverySeconds, p.setRecoveryMode, style === "PLAIN" ? "세트 사이 " : "R") : "")
}
export function rpePrescriptionNotation(p: RpePrescription, style: WorkoutNotationStyle = "COACH"): string {
  const calculated = p.catalogWorkout ? calculateCatalogWorkout(p.catalogWorkout.catalogId, p.catalogWorkout.inputs) : null
  const sequence = calculated && calculated.fingerprint === p.catalogWorkout?.calculationFingerprint ? calculatedWorkoutSequence(calculated) : null
  if (sequence) return sequenceNotation(sequence, [], style)
  const range = (min: number, max: number) => min === max ? `${min}` : `${min}–${max}`
  return style === "PLAIN"
    ? `전체 ${range(p.durationMinutes.minimum, p.durationMinutes.maximum)}분 · 힘든 정도 ${range(p.rpe.minimum, p.rpe.maximum)}/10`
    : `전체 ${range(p.durationMinutes.minimum, p.durationMinutes.maximum)}min @ RPE ${range(p.rpe.minimum, p.rpe.maximum)}`
}
export function sessionWorkoutName(session: WorkoutDisplaySession, original = false): string {
  const p = session.prescription
  if (session.role === "REST") return "휴식 · Rest"
  if (p?.kind === "RPE_TIME_RANGE" && p.catalogWorkout) {
    const catalog = ALL_WORKOUT_CATALOG.find(e => e.id === p.catalogWorkout!.catalogId && e.fingerprint === p.catalogWorkout!.catalogFingerprint)
    if (catalog) return original ? catalog.name : catalogDeliveryProfile(catalog).name
  }
  if (p?.kind === "ADJUSTED_METHOD_V3") return sequenceWorkoutName(p.projection.sequence, session.plannedEnergyIntent)
  if (p?.kind === "ADJUSTED_METHOD") return sequenceWorkoutName(p.snapshot.projection.sequence, session.plannedEnergyIntent)
  if (p?.kind === "PACE_TARGET") return original ? "인터벌 · Intervals" : `${notationDistance(p.repetitionDistanceM)} 반복 달리기`
  if (session.role === "EASY") return session.plannedEnergyIntent === "RECOVERY_INTENT" ? "회복 운동 · Recovery" : "저강도 달리기 · Easy Run"
  const names: Record<PlannedEnergyIntent, string> = {
    BASE_INTENT: "지구력 훈련 · Endurance", LT_INTENT: "템포 훈련 · LT", VO2_INTENT: "유산소 반복 훈련 · VO₂",
    GLY_INTENT: "고강도 반복 훈련 · GLY", ATP_PC_INTENT: "짧은 고출력 훈련 · ATP-PC",
    MIXED_INTENT: "혼합 훈련 · Mixed Session", RECOVERY_INTENT: "회복 운동 · Recovery",
  }
  return names[session.plannedEnergyIntent]
}
export function sessionWorkoutNotation(session: WorkoutDisplaySession, style: WorkoutNotationStyle = "COACH"): string {
  const p = session.prescription
  if (!p) return ""
  switch (p.kind) {
    case "REST": return "훈련 없음"
    case "RPE_TIME_RANGE": return rpePrescriptionNotation(p, style)
    case "PACE_TARGET": return pacePrescriptionNotation(p, style)
    case "ADJUSTED_METHOD_V3": return sequenceNotation(p.projection.sequence, p.projection.segmentTargets, style)
    case "ADJUSTED_METHOD": return sequenceNotation(p.snapshot.projection.sequence, p.snapshot.projection.segmentTargets, style)
  }
}
