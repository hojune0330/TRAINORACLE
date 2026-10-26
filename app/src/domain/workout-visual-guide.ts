import { resolveCatalogBinding } from "@impl/prescription/catalog-session-binding"
import type { WorkoutCalculatedStep } from "@impl/prescription/all-workout-calculator"
import { matchesPacePrescriptionSequence, projectPacePrescriptionSequence } from "@impl/prescription/pace-sequence"
import { roundedPaceSeconds } from "@impl/prescription/record-pace"
import { parsePrescriptionSequence, type PrescriptionSequence, type PrescriptionSequenceNode, type SequenceRecovery, type SequenceTarget, type SequenceWork } from "@impl/prescription/sequence"
import { parsePrescriptionSequenceV3, type PrescriptionSequenceV3, type SequenceNodeV3, type RecoveryStepV3 } from "@impl/prescription/sequence-v3"
import type { AdjustedSegmentTarget } from "./adjusted-method-resolution"
import { buildWorkoutMemo, type WorkoutMemoContext, type WorkoutMemoSession } from "./workout-memo"
import { memoExplanationSources, presentWorkoutMemo } from "./workout-memo-presentation"
import { notationDistance, notationEffort, notationPace, notationTime, type WorkoutNotationStyle } from "./workout-notation"
import type { VisualTrainingGuideData, VisualTrainingStep } from "./visual-training-guide"

type Phase = "warmup" | "main" | "cooldown"
type Sequence = PrescriptionSequence | PrescriptionSequenceV3
type Segment = Extract<PrescriptionSequenceNode | SequenceNodeV3, { kind: "segment" }>
const phases = ["warmup", "main", "cooldown"] as const
const phaseLabels = { warmup: "준비", main: "본운동", cooldown: "정리" }
const recoveryLabels: Record<RecoveryStepV3["mode"], string> = {
  WALK: "걷기", JOG: "조깅", STAND: "서서 쉬기", WALK_OR_JOG: "걷기 또는 조깅", WALK_OR_STAND: "걷거나 서서 쉬기",
  FULL_RECOVERY: "회복 상태에 맞춰 쉬기", COACH_DEFINED: "지도자가 정한 회복", ACTIVE_ROLL_ON: "달리며 회복",
}
// Rendering bound only. Never truncate or change a prescription to fit the guide.
const MAX_VISUAL_STEPS = 1024
const positive = (value: number | null): boolean => value === null || Number.isFinite(value) && value > 0
const range = (value: { minimum: number; maximum: number } | null, wording: WorkoutNotationStyle): string => value === null
  ? "시간 미지정" : notationTime(value.minimum, wording) + (value.minimum === value.maximum ? "" : `–${notationTime(value.maximum, wording)}`)

/** A read-only projection of an already resolved prescription. It never reads records or derives new doses. */
export function buildWorkoutVisualGuide(session: WorkoutMemoSession, context: WorkoutMemoContext = {},
  { detail = false, wording = "PLAIN" }: { readonly detail?: boolean; readonly wording?: WorkoutNotationStyle } = {}): VisualTrainingGuideData | null {
  try { return projectGuide(session, context, detail, wording) } catch { return null }
}

function projectGuide(session: WorkoutMemoSession, context: WorkoutMemoContext, detail: boolean, wording: WorkoutNotationStyle): VisualTrainingGuideData | null {
  const p = session.prescription
  if (!p || p.kind === "REST") return null
  const memo = buildWorkoutMemo(session, context, wording)
  if (!memo) return null
  const steps: VisualTrainingStep[] = []
  const explanation = (recovery: boolean) => memo.explanation.sections.find(section => section.label === (recovery ? "회복" : "운동 구성"))?.text
  const push = (step: Omit<VisualTrainingStep, "id">, isRecovery = false) => {
    if (steps.length >= MAX_VISUAL_STEPS) throw Error("VISUAL_SEQUENCE_TOO_LONG")
    steps.push({ ...step, id: `step-${steps.length + 1}`, explanation: step.phase === "main" ? explanation(isRecovery) : undefined })
  }
  if (p.kind === "RPE_TIME_RANGE") {
    if (!p.catalogWorkout) return null
    const calculation = resolveCatalogBinding(p.catalogWorkout)
    if (!calculation || !calculation.steps.length) return null
    for (const step of calculation.steps) {
      const isRecovery = step.kind === "RECOVERY"
      const label = catalogStepLabel(step)
      const instruction = wording === "PLAIN" ? notationEffort(step.instruction, wording) : step.instruction
      const duplicateRecovery = isRecovery && step.distanceM === null && step.seconds?.minimum === step.seconds?.maximum
        && instruction === `${label} ${step.seconds?.minimum}초`
      const pace = step.paceSecondsPerKm
      push({ phase: step.phase, kind: step.modality === "WALK" ? "walk" : isRecovery ? "recovery"
        : step.kind === "BUILDUP" ? "buildup" : step.phase === "cooldown" ? "cooldown" : step.phase === "warmup" ? "preparation" : "work",
        label, amount: [step.seconds ? range(step.seconds, wording) : null, step.distanceM !== null ? notationDistance(step.distanceM) : null].filter(Boolean).join(" · ") || "시간·거리 미지정",
        instruction: duplicateRecovery ? "" : instruction,
        group: step.set === null ? phaseLabels[step.phase] : `${step.set}세트 · ${phaseLabels[step.phase]}`,
        details: pace ? [`${step.targetModel === "GOAL_RACE_REFERENCE" ? "목표 기록 기준" : step.targetModel === "ACTUAL_RACE_REFERENCE" ? "실제 기록 기준" : "구간 속도"} · ${notationPace(pace.minimum)}${pace.minimum === pace.maximum ? "" : `–${notationPace(pace.maximum)}`}`] : [],
      }, isRecovery)
    }
  } else {
    let sequence: Sequence
    let targets: readonly AdjustedSegmentTarget[] = []
    if (p.kind === "PACE_TARGET") {
      if (p.sequence !== undefined && !matchesPacePrescriptionSequence(p, p.sequence)) return null
      const projected = projectPacePrescriptionSequence(p)
      if (!projected) return null
      sequence = projected
    } else {
      const projection = p.kind === "ADJUSTED_METHOD_V3" ? p.projection : p.snapshot.projection
      const parsed = projection.sequence.version === 3 ? parsePrescriptionSequenceV3(projection.sequence) : parsePrescriptionSequence(projection.sequence)
      if (parsed.kind !== "parsed" || !matchingTargets(parsed.sequence, projection.segmentTargets)) return null
      sequence = parsed.sequence
      targets = projection.segmentTargets
    }
    const recovery = (items: readonly RecoveryStepV3[], phase: Phase, instruction: string, group: string = phaseLabels[phase]) => {
      for (const item of items) push({ phase, kind: item.mode === "WALK" ? "walk" : "recovery", label: recoveryLabels[item.mode],
        amount: "distanceM" in item ? notationDistance(item.distanceM) : item.seconds === null ? "시간 미지정" : notationTime(item.seconds, wording),
        instruction, group,
      }, true)
    }
    const work = (node: Segment, phase: Phase, group: string, occurrence: string) => {
      const isStride = p.kind === "PACE_TARGET" && phase === "warmup" && node.id === "strides"
      const kind = "role" in node && node.role === "BUILDUP" || isStride ? "buildup" : phase === "cooldown" ? "cooldown" : phase === "warmup" ? "preparation" : "work"
      const numeric = targets.find(target => target.segmentId === node.id)
      const details = targetDetails(node.target, node.work, numeric, wording)
      if (occurrence) details.unshift(occurrence)
      if (p.kind === "PACE_TARGET" && phase === "main") {
        details.push(`1회 목표 ${notationTime(roundedPaceSeconds(p.targetRepSeconds), wording)}`)
        if (memo.basisSummary) details.push(memo.basisSummary)
      } else if (numeric && memo.basisSummary) details.push(memo.basisSummary)
      push({ phase, kind, label: isStride ? "가속 달리기" : node.label ?? (kind === "cooldown" ? "정리" : kind === "preparation" ? "준비" : "달리기"),
        amount: node.work.kind === "distance" ? node.work.distanceM === null ? "거리 미지정" : notationDistance(node.work.distanceM)
          : node.work.durationSeconds === null ? "시간 미지정" : notationTime(node.work.durationSeconds, wording),
        instruction: isStride ? notationEffort("PROGRESSIVE_NOT_ALL_OUT", wording)
          : node.target.kind === "EFFORT_GUIDANCE" ? wording === "PLAIN" ? notationEffort(node.target.cue, wording) : node.target.cue ?? "강도 미지정" : "",
        group, details,
      })
    }
    const legacyRecovery = (item: SequenceRecovery): readonly RecoveryStepV3[] => item.mode === "NOT_APPLICABLE" ? [] : [item]
    const visitV2 = (nodes: readonly PrescriptionSequenceNode[], phase: Phase, parent: string) => nodes.forEach((node, index) => {
      if (node.repeatCount > MAX_VISUAL_STEPS) throw Error("VISUAL_SEQUENCE_TOO_LONG")
      for (let i = 0; i < node.repeatCount; i++) {
        const group = node.kind === "group" && node.repeatCount > 1 ? `${parent} · ${i + 1}/${node.repeatCount}세트` : parent
        if (node.kind === "group") visitV2(node.children, phase, group)
        else work(node, phase, group, node.repeatCount > 1 ? `${i + 1}/${node.repeatCount}회` : "")
        if (i < node.repeatCount - 1) recovery(legacyRecovery(node.recoveryBetweenRepeats), phase, node.kind === "group" ? "세트 사이" : "반복 사이", group)
      }
      // V1/V2 recoveryAfter exists only before a next sibling.
      if (index < nodes.length - 1) recovery(legacyRecovery(node.recoveryAfter), phase, "다음 구간 전", parent)
    })
    const visitV3 = (nodes: readonly SequenceNodeV3[], phase: Phase, parent: string, outerOccurrence = "") => nodes.forEach(node => {
      if (node.repeatCount > MAX_VISUAL_STEPS) throw Error("VISUAL_SEQUENCE_TOO_LONG")
      for (let i = 0; i < node.repeatCount; i++) {
        const unit = node.kind === "group" && node.repeatUnit === "SET" ? "세트" : "회"
        const group = unit === "세트" && node.repeatCount > 1 ? `${parent} · ${i + 1}/${node.repeatCount}세트` : parent
        const occurrence = [outerOccurrence, unit !== "세트" && node.repeatCount > 1 ? `${i + 1}/${node.repeatCount}회` : null].filter(Boolean).join(" · ")
        if (node.kind === "group") visitV3(node.children, phase, group, occurrence)
        else work(node, phase, group, occurrence)
        if (i < node.repeatCount - 1) recovery(node.recoveryBetweenRepeats, phase, unit === "세트" ? "세트 사이" : "반복 사이", group)
      }
      // V3 recoveryAfter is unconditional, including the final node.
      const afterGroup = node.kind === "group" && node.repeatUnit === "SET" && node.repeatCount > 1 ? `${parent} · ${node.repeatCount}/${node.repeatCount}세트` : parent
      recovery(node.recoveryAfter, phase, "위 구성을 모두 마친 뒤 한 번", afterGroup)
    })
    for (const phase of phases) {
      if (sequence.version === 3) visitV3(sequence[phase], phase, phaseLabels[phase])
      else {
        visitV2(sequence[phase], phase, phaseLabels[phase])
        if (phase === "main" && sequence.version === 2 && sequence.terminalRecovery) recovery(legacyRecovery(sequence.terminalRecovery), phase, "마지막 본운동 뒤")
      }
    }
  }
  const displayed = detail ? steps : steps.filter(step => step.phase === "main")
  if (!displayed.length) return null
  const guide = { title: "한눈에 보기", contextLabel: [memo.dateLabel, memo.slotLabel, memo.stateLabel, detail ? "전체 구간" : "본운동"].filter(Boolean).join(" · "),
    steps: displayed, layout: "sequence" as const,
    notes: [memo.explanation.scope, `설명 버전 ${memo.explanation.version}`, ...memo.warnings],
    sources: memoExplanationSources(presentWorkoutMemo(memo, "explained")).filter(source => source.url !== null)
      .map(source => ({ label: source.title, url: source.url! })),
  }
  // Opaque UI identity only, never authority. Reset even if new exact values round to the same text.
  return { ...guide, id: `workout-visual:${displayIdentity(JSON.stringify([p, context.date, context.state, guide]))}` }
}

function displayIdentity(value: string): string {
  let first = 2166136261, second = 2246822519
  for (let index = 0; index < value.length; index++) {
    first = Math.imul(first ^ value.charCodeAt(index), 16777619)
    second = Math.imul(second ^ value.charCodeAt(index), 3266489917)
  }
  return `${(first >>> 0).toString(16)}${(second >>> 0).toString(16)}`
}

function catalogStepLabel(step: WorkoutCalculatedStep): string {
  if (step.kind === "BUILDUP") return "가속 달리기"
  const modalities: Record<string, string> = { RUN: "달리기", RUNNING: "달리기", CYCLE: "자전거", SWIM: "수영", PLYO: "플라이오", STRENGTH: "근력", ...recoveryLabels }
  return modalities[step.modality] ?? (step.kind === "RECOVERY" ? "회복" : phaseLabels[step.phase])
}

function targetDetails(target: SequenceTarget, work: SequenceWork, numeric: AdjustedSegmentTarget | undefined, wording: WorkoutNotationStyle): string[] {
  if (target.kind === "SPRINT_REFERENCE") return [`단거리 수행 기준 · ${target.reference ?? "기준 미지정"}`]
  if (target.kind !== "RACE_PACE") return []
  const basis = target.eventDistanceM === null ? "기준 경기 거리 미지정" : `${notationDistance(target.eventDistanceM)} 경기 평균 페이스 기준`
  if (!numeric) return [basis]
  if (work.kind === "distance" && numeric.targetRepSeconds !== null) return [basis, `1회 목표 ${notationTime(roundedPaceSeconds(numeric.targetRepSeconds), wording)}`]
  return [basis, `저장 당시 참고 페이스 ${notationPace(numeric.secondsPerKm)}`]
}

function matchingTargets(sequence: Sequence, targets: readonly AdjustedSegmentTarget[]): boolean {
  const nodes: Segment[] = []
  const visit = (items: readonly (PrescriptionSequenceNode | SequenceNodeV3)[]) => items.forEach(node => node.kind === "group" ? visit(node.children) : nodes.push(node))
  phases.forEach(phase => visit(sequence[phase]))
  if (new Set(targets.map(target => target.segmentId)).size !== targets.length) return false
  if (!targets.every(target => {
    const node = nodes.find(item => item.id === target.segmentId)
    return node?.target.kind === "RACE_PACE" && Number.isFinite(target.secondsPerKm) && target.secondsPerKm > 0
      && positive(target.targetRepSeconds) && positive(target.fixedWorkSeconds) && positive(target.distanceM)
      && target.distanceM === (node.work.kind === "distance" ? node.work.distanceM : null)
      && target.fixedWorkSeconds === (node.work.kind === "duration" ? node.work.durationSeconds : null)
      && (node.work.kind !== "duration" || target.targetRepSeconds === null)
      && (node.work.kind !== "distance" || node.work.distanceM === null || target.targetRepSeconds !== null)
  })) return false
  return nodes.filter(node => node.target.kind === "RACE_PACE").every(node => targets.some(target => target.segmentId === node.id))
}
