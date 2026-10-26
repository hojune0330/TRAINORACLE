import { ALL_WORKOUT_CATALOG, verifyCalculatedWorkout, type CalculatedWorkout, type WorkoutCalculatedStep, type WorkoutCatalogEntry } from "@impl/prescription/all-workout-calculator"
import { resolveCatalogBinding } from "@impl/prescription/catalog-session-binding"
import { roundedPaceSeconds } from "@impl/prescription/record-pace"
import type { RecoveryStepV3, SequenceNodeV3 } from "@impl/prescription/sequence-v3"
import { notationDistance, notationEffort, type WorkoutDisplaySession } from "./workout-notation"
import { catalogDeliveryProfile } from "@impl/prescription/catalog-delivery"
import { canonicalJsonFingerprint } from "@impl/plan-generator/candidate-identity"

type Phase = WorkoutCalculatedStep["phase"]
type Segment = Extract<SequenceNodeV3, { readonly kind: "segment" }>
type NumericRange = { readonly minimum: number; readonly maximum: number }
export type CatalogWorkoutReading = {
  readonly name: string
  readonly summary: string
  readonly phases: Readonly<Record<Phase, string>>
  readonly phaseSteps: Readonly<Record<Phase, readonly string[]>>
}

// Exact sources inspected for this reader, not permission to simplify the whole
// catalog. A new version/fingerprint requires its own display/source review.
const sourceFingerprints: Readonly<Record<string, string>> = {
  "RP-10000-INTRO": "sha256:7632d7304b3252ab8e36d9266f208eba1a1e1586f541478117810f4cd90340c4",
  "RP-10000-TIMED": "sha256:f0c9635768b86b4febcf916b7eb13d331041aa72934951e9a17a7e67b24837e2",
  "RP-10000-DISTANCE": "sha256:6b18353561f84fbf72a79c57dac175a3650baff0451ccc945dd6311886f3cd56",
  "P-BASE-B": "sha256:414ad0d8db07fc47af0b4d1b05fbbec61987aa1cb53a87a3a57c78ac3f4ef362",
  "X-BASE-01": "sha256:9d72b8a4404d268a467f4382efed0a2bf575ffe83e96fe038986d10fb23d138d",
  "X-BASE-09": "sha256:8285f615acf8589d363be3b5aeccefadd015498c96056efceef6df7da8fd171f",
  "P-INTRO-LT-C": "sha256:9fd2ef5d03e0dc98a0c6d87ab9c09d839c0861ab24045502375b4d931418e1dd",
  "P-INTRO-LT-S": "sha256:13df1b7a0fdd1bc43caed10506f8569ee730dec36b149d88cd503375ee445b9f",
  "P-LT-B-480": "sha256:b3523c2ccbcd852b3aef5d4d228b74a90cee1eb52842d8e0b510828edd69c2d5",
  "P-LT-C": "sha256:1bd9c4f140bbc67a60606b668455084a19eec78e5c11bb8b8e992fd4cb47d150",
  "X-LT-05": "sha256:3073aaf8353b733a26b43513501ee8d3d230932b5be604c85256076945b866b4",
  "X-LT-06": "sha256:dd0f4dbb9356ee220d7fda579937534040137dbaa086da44edab60333641fdf5",
}
const racePaceIds = new Set(["RP-10000-INTRO", "RP-10000-TIMED", "RP-10000-DISTANCE"])
const racePaceCue = "10km 경기 평균 페이스 연습. 힘들면 낮추거나 중단하며 체감 강도는 따로 기록해요."
const racePaceSafety = "힘들면 속도를 낮추거나 중단하세요. 실제 힘든 정도(RPE)는 따로 기록해요."
const reviewedCues = new Set([
  racePaceCue, "RPE 2-3", "RPE 1-2", "RPE 3-4", "RPE 6-7", "PROGRESSIVE_NOT_ALL_OUT",
  "문장으로 대화할 수 있는 노력 본운동 체감 노력 제안 RPE 3~4",
  "힘들지만 정해진 구간 동안 고르게 유지하는 노력 본운동 체감 노력 제안 RPE 6~7",
])
function supportedSource(entry: WorkoutCatalogEntry, workout: CalculatedWorkout): boolean {
  if (entry.version !== "1.0.0" || sourceFingerprints[entry.id] !== entry.fingerprint
    || !entry.sequence || entry.sequence.label !== null || entry.requirements.length
    || entry.segments.some(segment => segment.modality !== "RUN" || segment.terrain !== "FLAT")) return false
  const racePace = racePaceIds.has(entry.id)
  if (entry.segments.some(segment => racePace
    ? segment.intent !== "RACE_PACE" || segment.referenceEventDistanceM !== 10000
    : !["BASE", "LT"].includes(segment.intent))) return false
  const nodesSupported = (nodes: readonly SequenceNodeV3[]): boolean => nodes.every(node => node.label === null
    && [...node.recoveryBetweenRepeats, ...node.recoveryAfter].every(step => !('distanceM' in step)
      && step.seconds !== null && ["WALK", "JOG"].includes(step.mode))
    && (node.kind === "group" ? node.repeatUnit === "REPETITION" && nodesSupported(node.children)
      : node.target.kind === "EFFORT_GUIDANCE" && node.target.cue !== null && reviewedCues.has(node.target.cue)
        && (node.work.kind === "duration" && node.work.durationSeconds !== null
          || racePace && node.work.kind === "distance" && node.work.distanceM !== null)
        && (node.role !== "BUILDUP" || node.target.cue === "PROGRESSIVE_NOT_ALL_OUT")
        && (node.role !== "WORK" || (racePace ? node.target.cue === racePaceCue : node.target.cue !== racePaceCue))))
  if (![entry.sequence.warmup, entry.sequence.main, entry.sequence.cooldown].every(nodesSupported)) return false
  return workout.steps.every(step => step.kind === "RECOVERY"
    ? ["WALK", "JOG"].includes(step.modality) && step.seconds !== null && step.distanceM === null
    : step.modality === "RUN" && step.terrain === "FLAT" && step.seconds !== null
      && (racePace && step.phase === "main" && step.kind === "WORK"
        ? ["GOAL_RACE_REFERENCE", "ACTUAL_RACE_REFERENCE", "EXPLICIT_SEGMENT_PACE", "EXPLICIT_SEGMENT_SECONDS"].includes(step.targetModel)
        : step.paceSecondsPerKm === null && ["FIXED_DURATION", "EFFORT"].includes(step.targetModel)))
}

// Display rounding matches the existing calculated target lane: pace to a whole
// second, distance-work targets to a tenth. Work/recovery keep three decimals.
function timeText(seconds: number, decimals: 0 | 1 | 3 = 3): string {
  const value = decimals === 3 ? Number(seconds.toFixed(3)) : roundedPaceSeconds(seconds, decimals)
  const factor = 10 ** decimals
  const ticks = Math.round(value * factor)
  const minutes = Math.floor(ticks / (60 * factor))
  const remainder = (ticks % (60 * factor)) / factor
  const amount = minutes === 0 ? `${remainder}초` : remainder === 0 ? `${minutes}분` : `${minutes}분 ${remainder}초`
  return `${value === seconds ? "" : "약 "}${amount}`
}
function rangeText(range: NumericRange, decimals: 0 | 1 | 3 = 3): string {
  return `${timeText(range.minimum, decimals)}${range.minimum === range.maximum ? "" : `~${timeText(range.maximum, decimals)}`}`
}
const recoveryModes: Record<RecoveryStepV3["mode"], string> = {
  WALK: "걷기", JOG: "조깅", STAND: "서서 쉬기", WALK_OR_JOG: "걷기 또는 조깅",
  WALK_OR_STAND: "걷기 또는 서서 쉬기", FULL_RECOVERY: "상태에 맞춰 회복",
  COACH_DEFINED: "지도자가 정한 회복", ACTIVE_ROLL_ON: "달리며 회복",
}
function recoveryText(steps: readonly RecoveryStepV3[], nodeId: string, position: "between" | "after", workout: CalculatedWorkout): string {
  return steps.map((step, index) => {
    const calculated = workout.steps.find(item => item.kind === "RECOVERY" && item.segmentId === `${nodeId}:${position}:recovery-${index}`)
    if (!calculated) throw Error("UNVERIFIED_RECOVERY_DISPLAY")
    // Distance is the stopping condition. A supplied time remains an additional
    // explicit value; no distance is converted using the work/race pace.
    const amount = "distanceM" in step ? notationDistance(step.distanceM)
      : calculated.seconds ? rangeText(calculated.seconds) : "시간 미지정"
    const explicitTime = "distanceM" in step
      ? calculated.seconds ? ` · 직접 정한 회복 시간 ${rangeText(calculated.seconds)}` : " · 시간 미지정"
      : ""
    return `${amount} ${recoveryModes[step.mode]}${explicitTime}`
  }).join(" + ")
}
function stepDisplayIdentity(step: WorkoutCalculatedStep): string {
  return JSON.stringify({ phase: step.phase, kind: step.kind, distanceM: step.distanceM,
    seconds: step.seconds, pace: step.paceSecondsPerKm, instruction: step.instruction,
    model: step.targetModel, intent: step.intent, modality: step.modality, terrain: step.terrain,
    referenceRecordId: step.referenceRecordId, referenceEventDistanceM: step.referenceEventDistanceM })
}
function recoveryIdentity(node: Segment, workout: CalculatedWorkout): string {
  return JSON.stringify(node.recoveryAfter.map((source, index) => {
    const step = workout.steps.find(item => item.kind === "RECOVERY" && item.segmentId === `${node.id}:after:recovery-${index}`)
    if (!step) throw Error("UNVERIFIED_RECOVERY_DISPLAY")
    return { source, step: stepDisplayIdentity(step) }
  }))
}
function segmentStep(node: Segment, phase: Phase, workout: CalculatedWorkout): WorkoutCalculatedStep {
  const steps = workout.steps.filter(item => item.kind !== "RECOVERY" && item.segmentId === node.id)
  const first = steps[0]
  if (!first || first.phase !== phase || first.kind !== node.role || first.distanceM !== node.work.distanceM) throw Error("UNVERIFIED_SEGMENT_DISPLAY")
  if (steps.some(step => stepDisplayIdentity(step) !== stepDisplayIdentity(first))) throw Error("VARIABLE_REPEAT_DISPLAY")
  return first
}
function workAmount(node: Segment, phase: Phase, workout: CalculatedWorkout): string {
  if (node.work.kind === "distance") return node.work.distanceM === null ? "거리 미지정" : notationDistance(node.work.distanceM)
  const step = segmentStep(node, phase, workout)
  return node.work.durationSeconds !== null ? timeText(node.work.durationSeconds)
    : step.seconds ? rangeText(step.seconds) : "시간 미지정"
}
function referenceText(step: WorkoutCalculatedStep, workout: CalculatedWorkout): string {
  const reference = workout.inputs.paceReferences?.find(item => item.segmentId === step.segmentId)
  if (reference) {
    const source = `${notationDistance(reference.eventDistanceM)} ${reference.kind === "GOAL" ? "목표 기록" : "실제 기록"} 기준`
    return reference.model === "FIVE_K_THRESHOLD_V1" ? `${source} · 참고 범위, 측정한 역치 아님` : source
  }
  switch (step.targetModel) {
    case "THRESHOLD_REFERENCE": return "5km 기록 기반 참고 범위 · 측정한 역치 아님"
    case "FIVE_K_REFERENCE": return "5km 평균 속도 기준 · 산소섭취량 측정값 아님"
    case "EXPLICIT_SEGMENT_PACE": return "직접 정한 속도"
    case "EXPLICIT_SEGMENT_SECONDS": return "직접 정한 시간 · 경기 기록 환산 아님"
    default: return ""
  }
}
function targetText(node: Segment, step: WorkoutCalculatedStep, workout: CalculatedWorkout): string {
  const basis = referenceText(step, workout)
  // This is a bounded presentation token, only after the complete source cue and
  // exact catalog fingerprint pass supportedSource. Keep the standard RPE term;
  // do not remove it, infer a new effort value, or rewrite arbitrary free text.
  const effort = node.target.kind === "EFFORT_GUIDANCE"
    ? notationEffort(node.target.cue, "PLAIN").replace("힘든 정도", "힘든 정도(RPE)") : step.instruction
  const target = node.work.kind === "distance" && step.seconds
    ? `한 번에 ${rangeText(step.seconds, 1)}`
    : step.paceSecondsPerKm ? `1km에 ${rangeText(step.paceSecondsPerKm, 0)}`
      : effort
  return `${target}${basis ? ` · ${basis}` : ""}`
}
function segmentBody(node: Segment, phase: Phase, workout: CalculatedWorkout, count = node.repeatCount): string {
  const step = segmentStep(node, phase, workout)
  const amount = workAmount(node, phase, workout)
  const modalities: Record<string, string> = { RUN: "달리기", WALK: "걷기", BIKE: "자전거", SWIM: "수영", ELLIPTICAL: "일립티컬", DEEP_WATER_RUN: "수중 조깅" }
  const terrains: Record<string, string> = { UPHILL: "오르막", ROLLING: "기복 있는 코스", INDOOR: "실내", POOL: "수영장" }
  const context = [step.modality !== "RUN" ? modalities[step.modality] ?? step.modality : "",
    step.terrain !== "FLAT" ? terrains[step.terrain] ?? step.terrain : ""].filter(Boolean).join(" · ")
  if (node.role === "BUILDUP" && ["PROGRESSIVE_NOT_ALL_OUT", "점진적으로 속도를 올리되 전력질주하지 않기"].includes(step.instruction)) {
    return `${amount} 가속 달리기${count > 1 ? ` ${count}번` : ""} (전력질주 아님)${context ? ` · ${context}` : ""}`
  }
  return `${amount}${count > 1 ? `씩 ${count}번` : ""}${context ? ` · ${context}` : ""} · ${targetText(node, step, workout)}`
}

function nodesLines(nodes: readonly SequenceNodeV3[], phase: Phase, workout: CalculatedWorkout): string[] {
  const pieces: string[] = []
  for (let index = 0; index < nodes.length; index++) {
    const node = nodes[index]!
    // Only identical, consecutive individual buildup segments can be condensed.
    // Each intervening recovery must match, and the last recovery is shown on its
    // own. Groups, sets, changing cues/amounts and MAIN work are never coalesced.
    if (phase === "warmup" && node.kind === "segment" && node.role === "BUILDUP"
      && node.repeatCount === 1 && node.recoveryBetweenRepeats.length === 0) {
      const shape = (item: Segment) => JSON.stringify({ label: item.label, work: item.work, target: item.target,
        step: stepDisplayIdentity(segmentStep(item, phase, workout)), between: item.recoveryBetweenRepeats })
      const shapeOfFirst = shape(node)
      const between = recoveryIdentity(node, workout)
      let end = index
      while (end + 1 < nodes.length) {
        const next = nodes[end + 1]!
        const previous = nodes[end]!
        if (next.kind !== "segment" || next.role !== "BUILDUP" || next.repeatCount !== 1
          || next.recoveryBetweenRepeats.length !== 0 || shape(next) !== shapeOfFirst
          || previous.kind !== "segment" || recoveryIdentity(previous, workout) !== between) break
        end++
      }
      if (end > index) {
        const last = nodes[end]!
        const after = recoveryText(last.recoveryAfter, last.id, "after", workout)
        pieces.push(`${segmentBody(node, phase, workout, end - index + 1)} · ${node.recoveryAfter.length
          ? `사이 ${recoveryText(node.recoveryAfter, node.id, "after", workout)}` : "사이 회복 없음"}${after ? ` · 마지막 뒤 ${after}` : ""}`)
        index = end
        continue
      }
    }
    let body: string
    if (node.kind === "segment") body = segmentBody(node, phase, workout)
    else {
      const child = node.children[0]
      const simple = node.repeatUnit !== "SET" && node.children.length === 1 && child?.kind === "segment"
        && child.repeatCount === 1 && child.recoveryBetweenRepeats.length === 0 && child.recoveryAfter.length === 0
      const inner = simple ? segmentBody(child, phase, workout, node.repeatCount) : nodesText(node.children, phase, workout)
      body = simple || node.repeatCount === 1 ? inner : node.repeatUnit === "SET"
        ? `${node.repeatCount}세트: (${inner})` : `(${inner})을 ${node.repeatCount}번`
    }
    if (node.repeatCount > 1 && node.recoveryBetweenRepeats.length) body += ` · ${node.kind === "group" && node.repeatUnit === "SET" ? "세트 사이" : "사이"} ${recoveryText(node.recoveryBetweenRepeats, node.id, "between", workout)}`
    if (node.recoveryAfter.length) body += ` → 끝낸 뒤 ${recoveryText(node.recoveryAfter, node.id, "after", workout)}`
    pieces.push(`${node.label ? `${node.label}: ` : ""}${body}`)
  }
  return pieces
}
function nodesText(nodes: readonly SequenceNodeV3[], phase: Phase, workout: CalculatedWorkout): string {
  return nodesLines(nodes, phase, workout).join(" → ")
}
function simpleMainAmount(nodes: readonly SequenceNodeV3[], workout: CalculatedWorkout): string | null {
  if (nodes.length !== 1) return null
  const node = nodes[0]!
  const child = node.kind === "group" && node.repeatUnit !== "SET" && node.children.length === 1 ? node.children[0] : node
  if (!child || child.kind !== "segment" || child.role !== "WORK"
    || node.kind === "group" && (child.repeatCount !== 1 || child.recoveryBetweenRepeats.length || child.recoveryAfter.length)) return null
  const count = node.repeatCount
  return `${workAmount(child, "main", workout)}${count > 1 ? `씩 ${count}번` : ""}`
}

/** Explicit easy-reader projection only. Never save or calculate with this text.
 * Every number comes from the verified binding and exact catalog structure;
 * unsupported or unreadable sources return null so callers retain their existing
 * information instead of guessing, rewriting a cue, or changing a prescription.
 */
export function catalogWorkoutReader(session: WorkoutDisplaySession): CatalogWorkoutReading | null {
  const prescription = session.prescription
  if (prescription?.kind !== "RPE_TIME_RANGE" || !prescription.catalogWorkout) return null
  try {
    const workout = resolveCatalogBinding(prescription.catalogWorkout)
    const entry = workout && ALL_WORKOUT_CATALOG.find(item => item.id === workout.catalogId && item.fingerprint === workout.catalogFingerprint)
    const sequence = entry?.sequence
    if (!workout || !entry || !sequence || !supportedSource(entry, workout)) return null
    const phases = { warmup: nodesText(sequence.warmup, "warmup", workout), main: nodesText(sequence.main, "main", workout),
      cooldown: nodesText(sequence.cooldown, "cooldown", workout) }
    // The exact RP source cue is split into structured speed/provenance above
    // and its safety/observation sentences here, rather than silently discarded.
    if (racePaceIds.has(entry.id)) phases.main += `. ${racePaceSafety}`
    const main = workout.steps.filter(step => step.phase === "main" && step.kind === "WORK")
    const event = main[0]?.referenceEventDistanceM
    const amount = simpleMainAmount(sequence.main, workout)
    const sameEventRacePace = amount && event !== undefined && main.every(step => step.intent === "RACE_PACE" && step.referenceEventDistanceM === event)
    const references = main.map(step => workout.inputs.paceReferences?.find(reference => reference.segmentId === step.segmentId))
    const goalReference = references.every(reference => reference?.kind === "GOAL")
    // RP is only the same-event average speed, never LT/VO2 or an effect claim.
    const name = sameEventRacePace && event !== undefined
      ? `${notationDistance(event)} ${goalReference ? "목표 속도" : references.every(reference => reference?.kind === "ACTUAL") ? "기록 속도" : "속도"} 연습 (RP) · ${amount}`
      : amount ? `${catalogDeliveryProfile(entry).name} · ${amount}` : catalogDeliveryProfile(entry).name
    return { name, summary: phases.main, phases, phaseSteps: {
      warmup: nodesLines(sequence.warmup, "warmup", workout), main: [phases.main], cooldown: nodesLines(sequence.cooldown, "cooldown", workout),
    } }
  } catch {
    return null
  }
}

/** All catalog forms retain their exact structure, cues, modality and terrain.
 * Unlike the legacy easy-reader whitelist, this projection does not abbreviate cues.
 * Callers must supply a binding that has passed resolveCatalogBinding.
 */
export function catalogExecutionReading(workout: CalculatedWorkout): CatalogWorkoutReading | null {
  try {
    const entry = ALL_WORKOUT_CATALOG.find(item => item.id === workout.catalogId && item.fingerprint === workout.catalogFingerprint)
    if (!entry?.sequence || entry.version !== "1.0.0" || workout.unavailable.length || !verifyCalculatedWorkout(workout)) return null
    const { fingerprint, ...content } = entry
    const { version: _version, reviewRef: _review, ...originalContent } = content
    const sourceIdentity = entry.id.startsWith("RP-")
      ? canonicalJsonFingerprint("trainoracle.same-event-race-pace.v1", content)
      : canonicalJsonFingerprint("trainoracle.all-workout-catalog.v1", originalContent)
    if (sourceIdentity !== fingerprint) return null
    const phaseReading = (phase: Phase) => {
      const lines = nodesLines(entry.sequence![phase], phase, workout)
      // Calculated speed can replace an effort cue in targetText. Keep the
      // source instruction alongside it, including its safety limitations.
      const cues: string[] = []
      const inspect = (nodes: readonly SequenceNodeV3[]) => nodes.forEach(node => {
        if (node.kind === "group") inspect(node.children)
        else if (node.target.kind === "EFFORT_GUIDANCE" && node.target.cue) {
          const step = segmentStep(node, phase, workout)
          if (step.paceSecondsPerKm || node.work.kind === "distance" && step.seconds) cues.push(notationEffort(node.target.cue, "PLAIN"))
        }
      })
      inspect(entry.sequence![phase])
      const additional = [...new Set(cues)]
      return { steps: [...lines, ...additional].filter(Boolean), text: [lines.join(" → "), ...additional].filter(Boolean).join(" · ") }
    }
    const reading = { warmup: phaseReading("warmup"), main: phaseReading("main"), cooldown: phaseReading("cooldown") }
    const phaseSteps = { warmup: reading.warmup.steps, main: reading.main.steps, cooldown: reading.cooldown.steps }
    const phases = { warmup: reading.warmup.text, main: reading.main.text, cooldown: reading.cooldown.text }
    return { name: catalogDeliveryProfile(entry).name, summary: phases.main, phases, phaseSteps }
  } catch { return null }
}
