import rawCatalog from "./all-workout-catalog.json"
import { canonicalJsonFingerprint } from "../plan-generator/candidate-identity"
import { parsePrescriptionSequenceV3 } from "./sequence-v3"
import type { PrescriptionSequenceV3, SequenceNodeV3, RecoveryStepV3 } from "./sequence-v3"
import { canonicalPaceDistance, catalogRecordPaceModel, isSegmentPaceReference, paceReferenceRange, formatPaceSeconds, roundedPaceSeconds, type SegmentPaceReference } from "./record-pace"

export type WorkoutSegmentContext = { readonly segmentId: string; readonly intent: string; readonly modality: string; readonly terrain: string; readonly referenceEventDistanceM?: number }
export type WorkoutCatalogEntry = {
  readonly id: string; readonly name: string; readonly family: string; readonly methodGroup: string
  readonly version: string; readonly fingerprint: string; readonly sourceFingerprint: string; readonly reviewRef: string
  readonly sequence: PrescriptionSequenceV3 | null; readonly segments: readonly WorkoutSegmentContext[]
  readonly eventDistances: readonly number[]; readonly experience: readonly string[]
  readonly requirements: readonly string[]; readonly hold: string | null
  readonly explanation: { readonly purpose: string; readonly energySupply: string; readonly work: string; readonly recovery: string
    readonly tradeoff: string; readonly expected: string; readonly limitations: readonly string[]; readonly observation: string }
  readonly sourceRefs: readonly string[]
}
export const ALL_WORKOUT_CATALOG = rawCatalog.rows as unknown as readonly WorkoutCatalogEntry[]
export type WorkoutCalculationInputs = {
  readonly eventDistanceM: number
  readonly experience: "NEW_TO_RUNNING" | "DEVELOPING" | "EXPERIENCED"
  readonly availableSeconds: number | null
  readonly confirmedRequirements: readonly string[]
  readonly fiveK: { readonly recordId: string; readonly seconds: number; readonly achievedAt: string; readonly evaluatedAt: string } | null
  // An explicitly chosen, current training target. Never infer easy/hill/sprint pace from a race.
  readonly segmentPaces: readonly { readonly segmentId: string; readonly secondsPerKm: number }[]
  readonly segmentSeconds?: readonly { readonly segmentId: string; readonly seconds: number }[]
  readonly recoverySeconds?: readonly { readonly segmentId: string; readonly seconds: number }[]
  readonly paceReferences?: readonly SegmentPaceReference[]
}
/** Copy verified data without requiring browser or Node globals in the pure core. */
export function copyWorkoutCalculationInputs(inputs: WorkoutCalculationInputs): WorkoutCalculationInputs {
  return {
    ...inputs,
    confirmedRequirements: [...inputs.confirmedRequirements],
    fiveK: inputs.fiveK === null ? null : { ...inputs.fiveK },
    segmentPaces: inputs.segmentPaces.map(row => ({ ...row })),
    ...(inputs.segmentSeconds === undefined ? {} : { segmentSeconds: inputs.segmentSeconds.map(row => ({ ...row })) }),
    ...(inputs.recoverySeconds === undefined ? {} : { recoverySeconds: inputs.recoverySeconds.map(row => ({ ...row })) }),
    ...(inputs.paceReferences === undefined ? {} : { paceReferences: inputs.paceReferences.map(row => ({ ...row })) }),
  }
}
export type WorkoutCalculatedStep = {
  readonly key: string; readonly phase: "warmup" | "main" | "cooldown"; readonly segmentId: string
  readonly kind: "WORK" | "BUILDUP" | "PREPARATION" | "RECOVERY"
  readonly occurrence: number; readonly set: number | null
  readonly distanceM: number | null; readonly seconds: { readonly minimum: number; readonly maximum: number } | null
  readonly paceSecondsPerKm: { readonly minimum: number; readonly maximum: number } | null
  readonly intent: string; readonly modality: string; readonly terrain: string; readonly instruction: string
  readonly targetModel: "FIXED_DURATION" | "EXPLICIT_SEGMENT_PACE" | "EXPLICIT_SEGMENT_SECONDS" | "FIVE_K_REFERENCE" | "THRESHOLD_REFERENCE" | "EFFORT" | "RECOVERY" | "ACTUAL_RACE_REFERENCE" | "GOAL_RACE_REFERENCE"
  readonly referenceRecordId: string | null
  readonly referenceEventDistanceM?: number
}
export type CalculatedWorkout = {
  readonly version: 1; readonly catalogId: string; readonly catalogFingerprint: string
  readonly inputs: WorkoutCalculationInputs; readonly steps: readonly WorkoutCalculatedStep[]
  readonly totals: { readonly workOccurrences: number; readonly recoveryOccurrences: number
    readonly mainDistanceM: number | null; readonly knownMainDistanceM: number
    readonly seconds: { readonly minimum: number; readonly maximum: number } | null; readonly knownSeconds: number }
  readonly unresolved: readonly string[]; readonly unavailable: readonly string[]; readonly fingerprint: string
}
const range = (value: number) => ({ minimum: value, maximum: value })
const finitePositive = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n) && n > 0 && n <= 86400
const MIN_SUPPORTED_PACE_SECONDS_PER_KM = 120
const MAX_SUPPORTED_PACE_SECONDS_PER_KM = 1800
const date = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && Number.isFinite(Date.parse(`${s}T00:00:00Z`))
  && new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s
function validInputs(value: WorkoutCalculationInputs): boolean {
  if (!value || Object.keys(value).sort().join() !== ["availableSeconds", "confirmedRequirements", "eventDistanceM", "experience", "fiveK", "segmentPaces",
    ...(value.segmentSeconds === undefined ? [] : ["segmentSeconds"]), ...(value.recoverySeconds === undefined ? [] : ["recoverySeconds"]),
    ...(value.paceReferences === undefined ? [] : ["paceReferences"])].sort().join()) return false
  if (value.paceReferences !== undefined && (!Array.isArray(value.paceReferences) || value.paceReferences.length > 100
    || !value.paceReferences.every(isSegmentPaceReference)
    || new Set(value.paceReferences.map(r => r.segmentId)).size !== value.paceReferences.length)) return false
  for (const rows of [value.segmentSeconds ?? [], value.recoverySeconds ?? []]) {
    if (!Array.isArray(rows) || rows.length > 100 || new Set(rows.map(r => r.segmentId)).size !== rows.length
      || !rows.every(r => Object.keys(r).sort().join() === "seconds,segmentId" && typeof r.segmentId === "string" && finitePositive(r.seconds))) return false
  }
  if (![800, 1500, 3000, 5000, 10000, 21097.5, 42195].includes(canonicalPaceDistance(value.eventDistanceM))
    || !["NEW_TO_RUNNING", "DEVELOPING", "EXPERIENCED"].includes(value.experience)
    || (value.availableSeconds !== null && !finitePositive(value.availableSeconds))
    || !Array.isArray(value.confirmedRequirements) || value.confirmedRequirements.length > 20
    || !value.confirmedRequirements.every(r => typeof r === "string" && /^[A-Z_]+$/.test(r))
    || new Set(value.confirmedRequirements).size !== value.confirmedRequirements.length
    || !Array.isArray(value.segmentPaces) || value.segmentPaces.length > 100
    || new Set(value.segmentPaces.map(p => p.segmentId)).size !== value.segmentPaces.length
    || !value.segmentPaces.every(p => Object.keys(p).sort().join() === "secondsPerKm,segmentId"
      && typeof p.segmentId === "string" && finitePositive(p.secondsPerKm)
      && p.secondsPerKm >= MIN_SUPPORTED_PACE_SECONDS_PER_KM && p.secondsPerKm <= MAX_SUPPORTED_PACE_SECONDS_PER_KM)) return false
  const record = value.fiveK
  if (record === null) return true
  return Object.keys(record).sort().join() === "achievedAt,evaluatedAt,recordId,seconds"
    && typeof record.recordId === "string" && /^[A-Za-z0-9:_-]{1,200}$/.test(record.recordId)
    && finitePositive(record.seconds) && record.seconds >= 600 && record.seconds <= 10800
    && date(record.achievedAt) && date(record.evaluatedAt) && record.achievedAt <= record.evaluatedAt
}
function freshFiveK(input: WorkoutCalculationInputs): boolean {
  if (!input.fiveK) return false
  const achieved = new Date(`${input.fiveK.achievedAt}T00:00:00Z`)
  const evaluated = new Date(`${input.fiveK.evaluatedAt}T00:00:00Z`)
  const months = (evaluated.getUTCFullYear() - achieved.getUTCFullYear()) * 12
    + evaluated.getUTCMonth() - achieved.getUTCMonth() - (evaluated.getUTCDate() < achieved.getUTCDate() ? 1 : 0)
  return months <= 18
}
const effort: Record<string, string> = {
  BASE: "RPE 3~4 · 문장으로 대화할 수 있는 속도", LT: "RPE 6~7 · 짧은 말이 가능한 꾸준한 노력",
  VO2: "RPE 7~8 · 반복 끝까지 유지할 수 있는 강한 노력", GLY: "RPE 8~9 · 정해진 구간을 끝낼 수 있는 강한 노력",
  "ATP-PC": "짧게 빠르게 · 동작이 무너지거나 속도가 떨어지면 중단", ATP_PC: "짧게 빠르게 · 동작이 무너지거나 속도가 떨어지면 중단",
  REC: "RPE 1~2 · 편안한 회복 운동", STEADY: "RPE 5 · 꾸준한 중간 강도", TECHNIQUE: "서서히 가속 · 전력질주하지 않기",
  MIX: "구간별로 표시한 강도 따르기", MIXED: "구간별로 표시한 강도 따르기",
}
const modes: Record<string, string> = { WALK: "걷기", JOG: "조깅", STAND: "서서 쉬기", WALK_OR_STAND: "걷거나 서서 쉬기" }

/** The same expanded sequence drives numbers, instructions and subsequent comparison. */
export function calculateCatalogWorkout(id: string, inputs: WorkoutCalculationInputs): CalculatedWorkout | null {
  try {
    if (!validInputs(inputs)) return null
    const entry = ALL_WORKOUT_CATALOG.find(e => e.id === id)
    if (!entry || (entry.sequence && parsePrescriptionSequenceV3(entry.sequence).kind !== "parsed")) return null
    const knownIds = entry.segments.map(s => s.segmentId)
    if (inputs.segmentPaces.some(p => !knownIds.includes(p.segmentId)) || inputs.segmentSeconds?.some(p => !knownIds.includes(p.segmentId))
      || inputs.paceReferences?.some(p => !knownIds.includes(p.segmentId)
        || inputs.segmentPaces.some(s => s.segmentId === p.segmentId) || inputs.segmentSeconds?.some(s => s.segmentId === p.segmentId))) return null
    const acceptedOverrides = new Set<string>()
    const unavailable: string[] = [], unresolved = new Set<string>()
    if (!entry.eventDistances.some(d => canonicalPaceDistance(d) === canonicalPaceDistance(inputs.eventDistanceM))) unavailable.push("EVENT_SCOPE")
    if (!entry.experience.includes(inputs.experience)) unavailable.push("EXPERIENCE_SCOPE")
    if (entry.hold) unavailable.push(entry.hold)
    for (const requirement of entry.requirements) if (!inputs.confirmedRequirements.includes(requirement)) unavailable.push(requirement)
    if (inputs.fiveK && !freshFiveK(inputs)) unresolved.add("RECORD_NOT_CURRENT")
    const steps: WorkoutCalculatedStep[] = [], occurrences = new Map<string, number>()
    const add = (step: Omit<WorkoutCalculatedStep, "key" | "occurrence">) => {
      if (steps.length >= 1000) throw Error("SEQUENCE_TOO_LARGE")
      const n = (occurrences.get(`${step.segmentId}:${step.kind}`) ?? 0) + 1
      occurrences.set(`${step.segmentId}:${step.kind}`, n)
      steps.push({ ...step, occurrence: n, key: `${step.phase}:${step.segmentId}:${step.kind}:${n}` })
    }
    const recovery = (items: readonly RecoveryStepV3[], nodeId: string, phase: WorkoutCalculatedStep["phase"], set: number | null) => {
      for (const [i, item] of items.entries()) {
        const distanceM = "distanceM" in item ? item.distanceM : null
        const segmentId = `${nodeId}:recovery-${i}`
        const override = item.seconds === null ? inputs.recoverySeconds?.find(s => s.segmentId === segmentId) : undefined
        if (override) acceptedOverrides.add(`recovery:${segmentId}`)
        const seconds = override?.seconds ?? item.seconds
        if (seconds === null) unresolved.add(distanceM ? "RECOVERY_DISTANCE_WITHOUT_PACE" : "RECOVERY_DURATION_NOT_FIXED")
        add({ phase, segmentId, set, kind: "RECOVERY", distanceM,
          seconds: seconds === null ? null : range(seconds), intent: "REC", modality: item.mode, terrain: "AS_SPECIFIED",
          instruction: `${modes[item.mode] ?? item.mode}${seconds === null ? " · 시간 미지정" : ` ${seconds}초`}${distanceM ? ` · ${distanceM}m` : ""}${override ? " · 직접 정한 회복 시간" : ""}`,
          targetModel: "RECOVERY", referenceRecordId: null, paceSecondsPerKm: null })
      }
    }
    const visit = (nodes: readonly SequenceNodeV3[], phase: WorkoutCalculatedStep["phase"], set: number | null) => {
      for (const node of nodes) {
        for (let r = 1; r <= node.repeatCount; r++) {
          if (node.kind === "group") visit(node.children, phase, node.repeatUnit === "SET" ? r : set)
          else {
            const context: WorkoutSegmentContext = entry.segments.find(s => s.segmentId === node.id)
              ?? { segmentId: node.id, intent: node.role === "BUILDUP" ? "TECHNIQUE" : "REC", modality: "RUN", terrain: "FLAT" }
            const numericEligible = context.modality === "RUN" && context.terrain === "FLAT"
              && !["ATP-PC", "ATP_PC", "TECHNIQUE"].includes(context.intent)
              && (node.work.distanceM === null || node.work.distanceM >= 60)
            const explicit = numericEligible ? inputs.segmentPaces.find(p => p.segmentId === node.id) : undefined
            const record = freshFiveK(inputs) ? inputs.fiveK : null
            let pace: { minimum: number; maximum: number } | null = explicit ? range(explicit.secondsPerKm) : null
            let targetModel: WorkoutCalculatedStep["targetModel"] = explicit ? "EXPLICIT_SEGMENT_PACE" : "EFFORT"
            const reference = inputs.paceReferences?.find(p => p.segmentId === node.id)
            if (reference) {
              // Reference selection cannot attach flat race pace to recovery, easy running or sprint mechanics.
              if (!numericEligible || phase !== "main" || node.role !== "WORK"
                || catalogRecordPaceModel(context.intent, reference.eventDistanceM, context.referenceEventDistanceM) !== reference.model) throw Error("REFERENCE_NOT_APPLICABLE")
              pace = paceReferenceRange(reference)
              if (context.intent === "RACE_PACE" && (!pace
                || pace.minimum < MIN_SUPPORTED_PACE_SECONDS_PER_KM || pace.maximum > MAX_SUPPORTED_PACE_SECONDS_PER_KM)) {
                unavailable.push("RACE_PACE_REFERENCE_OUT_OF_RANGE")
              }
              acceptedOverrides.add(`reference:${node.id}`)
              targetModel = reference.kind === "GOAL" ? "GOAL_RACE_REFERENCE" : "ACTUAL_RACE_REFERENCE"
            }
            if (context.referenceEventDistanceM !== undefined && !reference && !explicit
              && !inputs.segmentSeconds?.some(row => row.segmentId === node.id)) unavailable.push("RACE_PACE_REFERENCE_REQUIRED")
            if (!pace && numericEligible && record && context.intent === "LT"
              && (node.work.durationSeconds === null || node.work.durationSeconds <= 1200)) {
              pace = { minimum: record.seconds / 5 + 24 * 1000 / 1609.344, maximum: record.seconds / 5 + 30 * 1000 / 1609.344 }
              targetModel = "THRESHOLD_REFERENCE"
            }
            if (!pace && numericEligible && record && context.intent === "VO2") {
              pace = range(record.seconds / 5); targetModel = "FIVE_K_REFERENCE"
            }
            const duration = node.work.durationSeconds
            let seconds = duration === null && pace && node.work.distanceM !== null
              ? { minimum: node.work.distanceM * pace.minimum / 1000, maximum: node.work.distanceM * pace.maximum / 1000 }
              : duration === null ? null : range(duration)
            if (reference && (pace === null || pace.minimum < 120 || pace.maximum > 1800
              || context.intent === "LT" && seconds && seconds.maximum > 1200
              || context.intent === "VO2" && seconds && seconds.maximum > 300)) unavailable.push("REFERENCE_OUTSIDE_CONFIGURATION")
            // Long threshold/interval repetitions need their own pace model, not this short-repetition reference.
            if (targetModel === "THRESHOLD_REFERENCE" && seconds && seconds.maximum > 1200
              || targetModel === "FIVE_K_REFERENCE" && seconds && seconds.maximum > 300) {
              pace = null; targetModel = "EFFORT"; seconds = duration === null ? null : range(duration)
            }
            const explicitSeconds = duration === null && !explicit ? inputs.segmentSeconds?.find(s => s.segmentId === node.id) : undefined
            if (explicitSeconds) {
              seconds = range(explicitSeconds.seconds); pace = null; targetModel = "EXPLICIT_SEGMENT_SECONDS"
              acceptedOverrides.add(`segment:${node.id}`)
            }
            if (seconds === null) unresolved.add("WORK_DURATION_NOT_FIXED")
            const cue = node.target.kind === "EFFORT_GUIDANCE" ? node.target.cue : null
            const instruction = pace
              ? reference ? `${formatPaceSeconds(pace.minimum, 0)}${pace.maximum === pace.minimum ? "" : `~${formatPaceSeconds(pace.maximum, 0)}`}/km · ${reference.eventDistanceM === 21097 || reference.eventDistanceM === 21097.5 ? "하프" : `${reference.eventDistanceM}m`} ${reference.kind === "GOAL" ? "목표" : "기록"} 기준${reference.achievedOn ? ` (${reference.achievedOn})` : reference.kind === "ACTUAL" ? " · 날짜 미입력" : ""}${reference.model === "FIVE_K_THRESHOLD_V1" ? " · 참고 범위, 측정 역치 아님" : " RP"}`
                : `${Math.round(pace.minimum)}${pace.maximum === pace.minimum ? "" : `~${Math.round(pace.maximum)}`}초/km${targetModel === "THRESHOLD_REFERENCE" ? " · 5km 기록 기반 참고 범위, 측정 역치 아님" : targetModel === "FIVE_K_REFERENCE" ? " · 현재 5km 평균 페이스, 산소섭취량 측정값 아님" : " · 직접 정한 훈련 페이스"}`
              : `${cue && (node.role !== "WORK" || /RPE\s*\d/.test(cue) || ["MIX", "MIXED"].includes(context.intent)) ? cue : effort[context.intent] ?? cue ?? "표시된 구간의 노력 기준을 따르세요."}${explicitSeconds ? " · 직접 정한 구간 시간, 경기 기록 환산 아님" : ""}`
            add({ phase, segmentId: node.id, kind: node.role, set, distanceM: node.work.distanceM,
              seconds, paceSecondsPerKm: pace, intent: context.intent, modality: context.modality, terrain: context.terrain, instruction,
              targetModel: targetModel === "EFFORT" && duration !== null ? "FIXED_DURATION" : targetModel,
              referenceRecordId: reference?.recordId ?? (targetModel === "FIVE_K_REFERENCE" || targetModel === "THRESHOLD_REFERENCE" ? record!.recordId : null),
              ...(context.referenceEventDistanceM === undefined ? {} : { referenceEventDistanceM: context.referenceEventDistanceM }) })
          }
          if (r < node.repeatCount) recovery(node.recoveryBetweenRepeats, `${node.id}:between`, phase, set)
        }
        recovery(node.recoveryAfter, `${node.id}:after`, phase, set)
      }
    }
    if (entry.sequence) for (const phase of ["warmup", "main", "cooldown"] as const) visit(entry.sequence[phase], phase, null)
    if (inputs.segmentSeconds?.some(s => !acceptedOverrides.has(`segment:${s.segmentId}`))
      || inputs.recoverySeconds?.some(s => !acceptedOverrides.has(`recovery:${s.segmentId}`))
      || inputs.paceReferences?.some(s => !acceptedOverrides.has(`reference:${s.segmentId}`))) return null
    const mainWork = steps.filter(s => s.phase === "main" && s.kind === "WORK")
    const knownMainDistanceM = mainWork.reduce((n, s) => n + (s.distanceM ?? 0), 0)
    const seconds = steps.every(s => s.seconds !== null) ? {
      minimum: steps.reduce((n, s) => n + s.seconds!.minimum, 0), maximum: steps.reduce((n, s) => n + s.seconds!.maximum, 0),
    } : null
    const knownSeconds = steps.reduce((n, s) => n + (s.seconds?.minimum ?? 0), 0)
    if (inputs.availableSeconds !== null && (seconds?.maximum ?? knownSeconds) > inputs.availableSeconds) unavailable.push("TIME_BUDGET_EXCEEDED")
    if (inputs.availableSeconds !== null && seconds === null) unavailable.push("TIME_BUDGET_UNCONFIRMED")
    const content = { version: 1 as const, catalogId: id, catalogFingerprint: entry.fingerprint, inputs: copyWorkoutCalculationInputs(inputs), steps,
      totals: { workOccurrences: mainWork.length, recoveryOccurrences: steps.filter(s => s.kind === "RECOVERY").length,
        mainDistanceM: mainWork.every(s => s.distanceM !== null) ? knownMainDistanceM : null, knownMainDistanceM, seconds, knownSeconds },
      unresolved: [...unresolved], unavailable }
    return { ...content, fingerprint: canonicalJsonFingerprint("trainoracle.calculated-workout.v1", content) }
  } catch { return null }
}

/** Recompute trusted catalog content; a self-consistent user-supplied hash is not authority. */
export function verifyCalculatedWorkout(value: unknown): value is CalculatedWorkout {
  try {
    const v = value as CalculatedWorkout
    const calculated = calculateCatalogWorkout(v.catalogId, v.inputs)
    return calculated !== null && canonicalJsonFingerprint("verify", calculated) === canonicalJsonFingerprint("verify", value)
  } catch { return false }
}

export function compatibleCatalogWorkouts(family: string, inputs: WorkoutCalculationInputs): CalculatedWorkout[] {
  return ALL_WORKOUT_CATALOG.filter(e => e.family === family).map(e => calculateCatalogWorkout(e.id, inputs))
    .filter((c): c is CalculatedWorkout => c !== null && c.unavailable.length === 0)
}

/** Names, wrappers and repeat counts alone do not make another method. */
export function catalogMethodIdentity(entry: WorkoutCatalogEntry): string {
  const project = (node: SequenceNodeV3): unknown => {
    const recovery = { between: node.recoveryBetweenRepeats, after: node.recoveryAfter }
    if (node.kind === "group") {
      const children = node.children.map(project)
      if (children.length === 1 && !recovery.between.length && !recovery.after.length) return children[0]
      return { kind: node.kind, unit: node.repeatUnit, recovery, children }
    }
    const context = entry.segments.find(s => s.segmentId === node.id)
    return { kind: node.kind, role: node.role, work: node.work, recovery,
      context: context ? { intent: context.intent, modality: context.modality, terrain: context.terrain,
        ...(context.referenceEventDistanceM === undefined ? {} : { referenceEventDistanceM: context.referenceEventDistanceM }) } : null }
  }
  return canonicalJsonFingerprint("trainoracle.catalog-method.v1", entry.sequence?.main.map(project) ?? [])
}

/** Presentation only. Targets and optional recovery times come from this exact calculation. */
export function calculatedWorkoutSequence(workout: CalculatedWorkout): PrescriptionSequenceV3 | null {
  const source = ALL_WORKOUT_CATALOG.find(e => e.id === workout.catalogId && e.fingerprint === workout.catalogFingerprint)?.sequence
  if (!source) return null
  const number = (n: number, decimals: 0 | 1) => `${roundedPaceSeconds(n, decimals) === n ? "" : "≈"}${roundedPaceSeconds(n, decimals)}`
  const nodes = (items: readonly SequenceNodeV3[]): readonly SequenceNodeV3[] => items.map(node => {
    const recovery = (items: readonly RecoveryStepV3[], position: string) => items.map((item, index) => {
      const calculated = workout.steps.find(s => s.segmentId === `${node.id}:${position}:recovery-${index}`)
      // V3 distance recovery cannot also carry seconds; show its explicit time alongside the structure.
      return !("distanceM" in item) && item.seconds === null && calculated?.seconds?.minimum === calculated?.seconds?.maximum && calculated?.seconds
        ? { ...item, seconds: calculated.seconds.minimum } : item
    })
    const rest = { recoveryBetweenRepeats: recovery(node.recoveryBetweenRepeats, "between"), recoveryAfter: recovery(node.recoveryAfter, "after") }
    if (node.kind === "group") return { ...node, ...rest, children: nodes(node.children) }
    const step = workout.steps.find(s => s.segmentId === node.id && s.kind !== "RECOVERY")
    const reference = workout.inputs.paceReferences?.find(row => row.segmentId === node.id)
    const model = reference ? `${reference.kind === "GOAL" ? "목표기록" : "실제 기록"} 기준 · ${reference.model === "FIVE_K_THRESHOLD_V1" ? "LT 참고" : "RP"}`
      : step?.targetModel === "THRESHOLD_REFERENCE" ? "LT 참고" : step?.targetModel === "FIVE_K_REFERENCE" ? "5K RP 참고"
        : step?.targetModel === "EXPLICIT_SEGMENT_PACE" || step?.targetModel === "EXPLICIT_SEGMENT_SECONDS" ? "직접 정한 목표"
          : step?.targetModel === "FIXED_DURATION" ? "정해진 시간" : "체감 강도 기준"
    const range = (v: { minimum: number; maximum: number }, decimals: 0 | 1) => `${number(v.minimum, decimals)}${v.minimum === v.maximum ? "" : `~${number(v.maximum, decimals)}`}`
    const cue = step?.distanceM !== null && step?.seconds ? `${range(step.seconds, 1)}s/${step.distanceM}m · ${model}`
      : step?.paceSecondsPerKm ? `${range(step.paceSecondsPerKm, 0)}초/km · ${model}` : step?.instruction
    const target = step ? { kind: "EFFORT_GUIDANCE" as const, cue: cue ?? step.instruction } : node.target
    return { ...node, ...rest, target }
  })
  return { ...source, warmup: nodes(source.warmup), main: nodes(source.main), cooldown: nodes(source.cooldown) }
}

export function compareCatalogPerformance(plan: CalculatedWorkout, actual: readonly {
  readonly key: string; readonly distanceM?: number; readonly seconds?: number; readonly rpe?: number
}[]) {
  if (!verifyCalculatedWorkout(plan) || actual.length > 1000 || new Set(actual.map(r => r.key)).size !== actual.length
    || actual.some(r => !plan.steps.some(s => s.key === r.key) || Object.keys(r).some(k => !["key", "distanceM", "seconds", "rpe"].includes(k))
      || (r.distanceM !== undefined && !finitePositive(r.distanceM)) || (r.seconds !== undefined && (!Number.isFinite(r.seconds) || r.seconds < 0 || r.seconds > 86400))
      || (r.seconds === 0 && plan.steps.find(s => s.key === r.key)?.kind !== "RECOVERY")
      || (r.rpe !== undefined && (!Number.isInteger(r.rpe) || r.rpe < 1 || r.rpe > 10)))) return null
  return { rows: actual.map(r => {
    const p = plan.steps.find(s => s.key === r.key)!
    const distanceStatus = p.distanceM === null ? "not_applicable" as const : r.distanceM === undefined ? "missing" as const
      : r.distanceM === p.distanceM ? "same" as const : "different" as const
    const sameDistance = distanceStatus === "not_applicable" || distanceStatus === "same"
    return { key: r.key, intent: p.intent, kind: p.kind, sameDistance, distanceStatus,
      timeDifference: sameDistance && p.seconds !== null && r.seconds !== undefined
        ? { minimum: r.seconds - p.seconds.maximum, maximum: r.seconds - p.seconds.minimum } : null }
  }), unrecordedSteps: plan.steps.length - actual.length,
    interpretation: "계획과 실제 수행의 차이를 비교해요. 차이만으로 특정 능력의 부족이나 향상을 단정하지 않아요.", automaticIncreaseAllowed: false as const }
}
