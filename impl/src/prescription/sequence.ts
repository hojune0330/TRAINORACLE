import { RECOVERY_MODES } from "./types"
import type { RecoveryMode } from "./types"

// Serialization/number-representation limits only, never training-dose limits.
export const PRESCRIPTION_SEQUENCE_LIMITS = Object.freeze({
  maxDepth: 16,
  maxNodes: 1024,
  maxChildren: 256,
  maxStringLength: 256,
  maxNumber: Number.MAX_SAFE_INTEGER,
})

export type SequenceWork =
  | { readonly kind: "distance"; readonly distanceM: number | null; readonly durationSeconds: null }
  | { readonly kind: "duration"; readonly distanceM: null; readonly durationSeconds: number | null }

export type SequenceTarget =
  | { readonly kind: "EFFORT_GUIDANCE"; readonly cue: string | null }
  | { readonly kind: "RACE_PACE"; readonly eventDistanceM: number | null; readonly anchorRef: string | null }
  | { readonly kind: "SPRINT_REFERENCE"; readonly reference: string | null }

export type SequenceRecoveryMode = RecoveryMode | "WALK_OR_JOG"

const SEQUENCE_RECOVERY_MODES: readonly SequenceRecoveryMode[] = Object.freeze([...RECOVERY_MODES, "WALK_OR_JOG"])

export type SequenceRecovery =
  | { readonly mode: "NOT_APPLICABLE"; readonly seconds: null }
  | { readonly mode: Exclude<SequenceRecoveryMode, "NOT_APPLICABLE">; readonly seconds: number | null }

type SequenceNodeBase = {
  readonly id: string
  readonly label: string | null
  readonly repeatCount: number
  readonly recoveryBetweenRepeats: SequenceRecovery
  // Used only before the next sibling, never after the last child/phase.
  readonly recoveryAfter: SequenceRecovery
}

export type PrescriptionSequenceSegment = SequenceNodeBase & {
  readonly kind: "segment"
  readonly work: SequenceWork
  readonly target: SequenceTarget
}

export type PrescriptionSequenceGroup = SequenceNodeBase & {
  readonly kind: "group"
  readonly children: readonly PrescriptionSequenceNode[]
}

export type PrescriptionSequenceNode = PrescriptionSequenceSegment | PrescriptionSequenceGroup

/** Representation only: no template identity, adoption, eligibility or pace calculation. */
export type PrescriptionSequence = {
  readonly kind: "PRESCRIPTION_SEQUENCE"
  readonly version: 1
  readonly id: string
  readonly label: string | null
  readonly warmup: readonly PrescriptionSequenceNode[]
  readonly main: readonly PrescriptionSequenceNode[]
  readonly cooldown: readonly PrescriptionSequenceNode[]
}

export type SequenceParseErrorCode =
  | "INVALID_SEQUENCE"
  | "UNKNOWN_KEY"
  | "DUPLICATE_ID"
  | "SERIALIZATION_LIMIT"

export type PrescriptionSequenceParseResult =
  | { readonly kind: "parsed"; readonly sequence: PrescriptionSequence }
  | { readonly kind: "rejected"; readonly code: SequenceParseErrorCode; readonly path: string }

export type SequenceUncomputableReasonCode =
  | "QUALITY_DISTANCE_UNAVAILABLE"
  | "WORK_DURATION_UNAVAILABLE"
  | "REPETITION_RECOVERY_UNAVAILABLE"
  | "SET_RECOVERY_UNAVAILABLE"
  | "TRANSITION_RECOVERY_UNAVAILABLE"

export type SequenceDerivedTotals = {
  readonly totalRepetitions: number
  readonly qualityDistanceM: number | null
  readonly qualityDurationSeconds: number | null
  readonly repetitionRecoveryOccurrences: number
  readonly repetitionRecoveryTotalSeconds: number | null
  readonly setRecoveryOccurrences: number
  readonly setRecoveryTotalSeconds: number | null
  readonly transitionRecoveryOccurrences: number
  readonly transitionRecoveryTotalSeconds: number | null
  readonly plannedRecoverySeconds: number | null
  readonly mainSessionTotalExcludingWarmupCooldown: number | null
  readonly uncomputableReasonCodes: readonly SequenceUncomputableReasonCode[]
}

/** Neither result establishes equal dose/effect, reviewed rationale or adoption. */
export type MainMethodComparison =
  | { readonly kind: "same"; readonly requiresReview: false }
  | { readonly kind: "different"; readonly requiresReview: true }

class SequenceParseFailure extends Error {
  constructor(readonly code: SequenceParseErrorCode, readonly path: string) {
    super(code)
  }
}

function fail(code: SequenceParseErrorCode, path: string): never {
  throw new SequenceParseFailure(code, path)
}

// Read data descriptors, not getters or toJSON hooks. Only plain JSON-shaped data is accepted.
function record(input: unknown, path: string): Record<string, unknown> {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    return fail("INVALID_SEQUENCE", path)
  }
  const prototype: unknown = Object.getPrototypeOf(input)
  if (prototype !== Object.prototype && prototype !== null) return fail("INVALID_SEQUENCE", path)
  return input as Record<string, unknown>
}

function field(input: object, key: string, path: string): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(input, key)
  if (descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable) {
    return fail("INVALID_SEQUENCE", path)
  }
  return descriptor.value as unknown
}

function keys(input: object, expected: readonly string[], path: string): void {
  const actual = Reflect.ownKeys(input)
  if (actual.some((key) => typeof key !== "string" || !expected.includes(key))) {
    fail("UNKNOWN_KEY", path)
  }
  if (actual.length !== expected.length) fail("INVALID_SEQUENCE", path)
}

function textValue(input: unknown, path: string): string {
  if (typeof input !== "string") return fail("INVALID_SEQUENCE", path)
  if (input.length > PRESCRIPTION_SEQUENCE_LIMITS.maxStringLength) return fail("SERIALIZATION_LIMIT", path)
  if (input.trim().length === 0) return fail("INVALID_SEQUENCE", path)
  return input
}

function nullableText(input: unknown, path: string): string | null {
  return input === null ? null : textValue(input, path)
}

function positiveNumber(input: unknown, path: string): number {
  if (typeof input !== "number" || !Number.isFinite(input) || input <= 0) {
    return fail("INVALID_SEQUENCE", path)
  }
  if (input > PRESCRIPTION_SEQUENCE_LIMITS.maxNumber) return fail("SERIALIZATION_LIMIT", path)
  return input
}

function nullableNumber(input: unknown, path: string): number | null {
  return input === null ? null : positiveNumber(input, path)
}

function parseWork(input: unknown, path: string): SequenceWork {
  const data = record(input, path)
  keys(data, ["kind", "distanceM", "durationSeconds"], path)
  const kind = field(data, "kind", `${path}.kind`)
  const distanceM = nullableNumber(field(data, "distanceM", `${path}.distanceM`), `${path}.distanceM`)
  const durationSeconds = nullableNumber(field(data, "durationSeconds", `${path}.durationSeconds`), `${path}.durationSeconds`)
  if (kind === "distance" && durationSeconds === null) return Object.freeze({ kind, distanceM, durationSeconds })
  if (kind === "duration" && distanceM === null) return Object.freeze({ kind, distanceM, durationSeconds })
  return fail("INVALID_SEQUENCE", path)
}

function parseTarget(input: unknown, path: string): SequenceTarget {
  const data = record(input, path)
  const kind = field(data, "kind", `${path}.kind`)
  if (kind === "EFFORT_GUIDANCE") {
    keys(data, ["kind", "cue"], path)
    return Object.freeze({ kind, cue: nullableText(field(data, "cue", `${path}.cue`), `${path}.cue`) })
  }
  if (kind === "RACE_PACE") {
    keys(data, ["kind", "eventDistanceM", "anchorRef"], path)
    return Object.freeze({
      kind,
      eventDistanceM: nullableNumber(field(data, "eventDistanceM", `${path}.eventDistanceM`), `${path}.eventDistanceM`),
      anchorRef: nullableText(field(data, "anchorRef", `${path}.anchorRef`), `${path}.anchorRef`),
    })
  }
  if (kind === "SPRINT_REFERENCE") {
    keys(data, ["kind", "reference"], path)
    return Object.freeze({ kind, reference: nullableText(field(data, "reference", `${path}.reference`), `${path}.reference`) })
  }
  return fail("INVALID_SEQUENCE", `${path}.kind`)
}

function parseRecovery(input: unknown, path: string): SequenceRecovery {
  const data = record(input, path)
  keys(data, ["mode", "seconds"], path)
  const mode = field(data, "mode", `${path}.mode`)
  const seconds = nullableNumber(field(data, "seconds", `${path}.seconds`), `${path}.seconds`)
  if (mode === "NOT_APPLICABLE" && seconds === null) return Object.freeze({ mode, seconds })
  if (typeof mode !== "string" || mode === "NOT_APPLICABLE" || !SEQUENCE_RECOVERY_MODES.includes(mode as SequenceRecoveryMode)) {
    return fail("INVALID_SEQUENCE", `${path}.mode`)
  }
  return Object.freeze({ mode: mode as Exclude<SequenceRecoveryMode, "NOT_APPLICABLE">, seconds })
}

type ParseContext = { readonly ids: Set<string>; nodes: number }

function parseId(input: unknown, path: string, context: ParseContext): string {
  const id = textValue(input, path)
  if (context.ids.has(id)) return fail("DUPLICATE_ID", path)
  context.ids.add(id)
  return id
}

function parseNodes(input: unknown, path: string, depth: number, context: ParseContext, allowEmpty = false): readonly PrescriptionSequenceNode[] {
  if (!Array.isArray(input) || Object.getPrototypeOf(input) !== Array.prototype) return fail("INVALID_SEQUENCE", path)
  if (input.length > PRESCRIPTION_SEQUENCE_LIMITS.maxChildren) return fail("SERIALIZATION_LIMIT", path)
  if ((!allowEmpty && input.length === 0) || Reflect.ownKeys(input).length !== input.length + 1) {
    return fail("INVALID_SEQUENCE", path)
  }
  const nodes: PrescriptionSequenceNode[] = []
  for (let index = 0; index < input.length; index += 1) {
    const childPath = `${path}[${index}]`
    nodes.push(parseNode(field(input, String(index), childPath), childPath, depth, context))
  }
  return Object.freeze(nodes)
}

function parseNode(input: unknown, path: string, depth: number, context: ParseContext): PrescriptionSequenceNode {
  context.nodes += 1
  if (depth > PRESCRIPTION_SEQUENCE_LIMITS.maxDepth || context.nodes > PRESCRIPTION_SEQUENCE_LIMITS.maxNodes) {
    return fail("SERIALIZATION_LIMIT", path)
  }
  const data = record(input, path)
  const kind = field(data, "kind", `${path}.kind`)
  if (kind !== "segment" && kind !== "group") return fail("INVALID_SEQUENCE", `${path}.kind`)
  keys(data, ["kind", "id", "label", "repeatCount", "recoveryBetweenRepeats", "recoveryAfter", ...(kind === "segment" ? ["work", "target"] : ["children"])], path)
  const repeatCount = positiveNumber(field(data, "repeatCount", `${path}.repeatCount`), `${path}.repeatCount`)
  if (!Number.isSafeInteger(repeatCount)) return fail("INVALID_SEQUENCE", `${path}.repeatCount`)
  const base: SequenceNodeBase = {
    id: parseId(field(data, "id", `${path}.id`), `${path}.id`, context),
    label: nullableText(field(data, "label", `${path}.label`), `${path}.label`),
    repeatCount,
    recoveryBetweenRepeats: parseRecovery(field(data, "recoveryBetweenRepeats", `${path}.recoveryBetweenRepeats`), `${path}.recoveryBetweenRepeats`),
    recoveryAfter: parseRecovery(field(data, "recoveryAfter", `${path}.recoveryAfter`), `${path}.recoveryAfter`),
  }
  if (kind === "segment") {
    return Object.freeze({
      kind, ...base,
      work: parseWork(field(data, "work", `${path}.work`), `${path}.work`),
      target: parseTarget(field(data, "target", `${path}.target`), `${path}.target`),
    })
  }
  return Object.freeze({ kind, ...base, children: parseNodes(field(data, "children", `${path}.children`), `${path}.children`, depth + 1, context) })
}

function bounded(value: number, path: string): number {
  if (!Number.isFinite(value) || value > PRESCRIPTION_SEQUENCE_LIMITS.maxNumber) return fail("SERIALIZATION_LIMIT", path)
  return value
}

// Track known sums even when the public total is null, so unknowns cannot hide overflow.
type Measure = { known: number; unknown: boolean }
type RecoveryTotal = { occurrences: number; seconds: Measure }
type Totals = {
  repetitions: number
  distance: Measure
  duration: Measure
  repetition: RecoveryTotal
  set: RecoveryTotal
  transition: RecoveryTotal
}

function measure(): Measure { return { known: 0, unknown: false } }
function recoveryTotal(): RecoveryTotal { return { occurrences: 0, seconds: measure() } }

function add(target: Measure, value: number | null, count: number, path: string): void {
  if (count === 0) return
  if (value === null) target.unknown = true
  else target.known = bounded(target.known + bounded(value * count, path), path)
}

function addRecovery(target: RecoveryTotal, recovery: SequenceRecovery, count: number, path: string): void {
  if (recovery.mode === "NOT_APPLICABLE") return
  target.occurrences = bounded(target.occurrences + count, path)
  add(target.seconds, recovery.seconds, count, path)
}

function accumulate(nodes: readonly PrescriptionSequenceNode[], multiplier: number, totals: Totals, path: string): void {
  nodes.forEach((node, index) => {
    const nodePath = `${path}[${index}]`
    const instances = bounded(multiplier * node.repeatCount, nodePath)
    const gaps = bounded(multiplier * (node.repeatCount - 1), nodePath)
    if (node.kind === "segment") {
      totals.repetitions = bounded(totals.repetitions + instances, nodePath)
      add(totals.distance, node.work.distanceM, instances, nodePath)
      add(totals.duration, node.work.durationSeconds, instances, nodePath)
      addRecovery(totals.repetition, node.recoveryBetweenRepeats, gaps, nodePath)
    } else {
      accumulate(node.children, instances, totals, `${nodePath}.children`)
      addRecovery(totals.set, node.recoveryBetweenRepeats, gaps, nodePath)
    }
    // The parent's repeat recovery replaces the final child's recoveryAfter.
    if (index < nodes.length - 1) addRecovery(totals.transition, node.recoveryAfter, multiplier, nodePath)
  })
}

function calculate(nodes: readonly PrescriptionSequenceNode[], path: string): Totals {
  const totals: Totals = {
    repetitions: 0, distance: measure(), duration: measure(),
    repetition: recoveryTotal(), set: recoveryTotal(), transition: recoveryTotal(),
  }
  accumulate(nodes, 1, totals, path)
  bounded(totals.repetition.occurrences + totals.set.occurrences + totals.transition.occurrences, path)
  bounded(totals.duration.known + totals.repetition.seconds.known + totals.set.seconds.known + totals.transition.seconds.known, path)
  return totals
}

/** Returns a detached, deeply frozen JSON value, or a value-free rejection. No activation. */
export function parsePrescriptionSequence(input: unknown): PrescriptionSequenceParseResult {
  try {
    const path = "$"
    const data = record(input, path)
    keys(data, ["kind", "version", "id", "label", "warmup", "main", "cooldown"], path)
    if (field(data, "kind", "$.kind") !== "PRESCRIPTION_SEQUENCE" || field(data, "version", "$.version") !== 1) {
      return fail("INVALID_SEQUENCE", path)
    }
    const context: ParseContext = { ids: new Set(), nodes: 0 }
    const sequence: PrescriptionSequence = Object.freeze({
      kind: "PRESCRIPTION_SEQUENCE", version: 1,
      id: parseId(field(data, "id", "$.id"), "$.id", context),
      label: nullableText(field(data, "label", "$.label"), "$.label"),
      warmup: parseNodes(field(data, "warmup", "$.warmup"), "$.warmup", 1, context, true),
      main: parseNodes(field(data, "main", "$.main"), "$.main", 1, context),
      cooldown: parseNodes(field(data, "cooldown", "$.cooldown"), "$.cooldown", 1, context, true),
    })
    calculate(sequence.warmup, "$.warmup")
    calculate(sequence.main, "$.main")
    calculate(sequence.cooldown, "$.cooldown")
    return Object.freeze({ kind: "parsed", sequence })
  } catch (error: unknown) {
    return Object.freeze({
      kind: "rejected",
      code: error instanceof SequenceParseFailure ? error.code : "INVALID_SEQUENCE",
      path: error instanceof SequenceParseFailure ? error.path : "$",
    })
  }
}

function validated(sequence: PrescriptionSequence): PrescriptionSequence {
  const result = parsePrescriptionSequence(sequence)
  if (result.kind === "rejected") throw new TypeError(`Invalid prescription sequence: ${result.code} at ${result.path}`)
  return result.sequence
}

function total(value: Measure): number | null { return value.unknown ? null : value.known }

/** MAIN only. Unknown work never becomes zero, pace-derived time or partial totals. */
export function deriveSequenceTotals(sequence: PrescriptionSequence): SequenceDerivedTotals {
  const values = calculate(validated(sequence).main, "$.main")
  const qualityDistanceM = total(values.distance)
  const qualityDurationSeconds = total(values.duration)
  const repetitionRecoveryTotalSeconds = total(values.repetition.seconds)
  const setRecoveryTotalSeconds = total(values.set.seconds)
  const transitionRecoveryTotalSeconds = total(values.transition.seconds)
  const plannedRecoverySeconds = repetitionRecoveryTotalSeconds === null || setRecoveryTotalSeconds === null || transitionRecoveryTotalSeconds === null
    ? null : repetitionRecoveryTotalSeconds + setRecoveryTotalSeconds + transitionRecoveryTotalSeconds
  const reasons: SequenceUncomputableReasonCode[] = []
  if (qualityDistanceM === null) reasons.push("QUALITY_DISTANCE_UNAVAILABLE")
  if (qualityDurationSeconds === null) reasons.push("WORK_DURATION_UNAVAILABLE")
  if (repetitionRecoveryTotalSeconds === null) reasons.push("REPETITION_RECOVERY_UNAVAILABLE")
  if (setRecoveryTotalSeconds === null) reasons.push("SET_RECOVERY_UNAVAILABLE")
  if (transitionRecoveryTotalSeconds === null) reasons.push("TRANSITION_RECOVERY_UNAVAILABLE")
  return Object.freeze({
    totalRepetitions: values.repetitions,
    qualityDistanceM, qualityDurationSeconds,
    repetitionRecoveryOccurrences: values.repetition.occurrences,
    repetitionRecoveryTotalSeconds,
    setRecoveryOccurrences: values.set.occurrences,
    setRecoveryTotalSeconds,
    transitionRecoveryOccurrences: values.transition.occurrences,
    transitionRecoveryTotalSeconds,
    plannedRecoverySeconds,
    mainSessionTotalExcludingWarmupCooldown: qualityDurationSeconds === null || plannedRecoverySeconds === null
      ? null : qualityDurationSeconds + plannedRecoverySeconds,
    uncomputableReasonCodes: Object.freeze(reasons),
  })
}

type MainMethodNode = {
  readonly recoveryBetweenRepeats: SequenceRecovery
  readonly recoveryAfter: SequenceRecovery | null
} & (
  | { readonly kind: "group"; readonly children: readonly MainMethodNode[] }
  | {
      readonly kind: "segment"
      readonly work: SequenceWork
      readonly target:
        | Extract<SequenceTarget, { kind: "EFFORT_GUIDANCE" }>
        | Pick<Extract<SequenceTarget, { kind: "RACE_PACE" }>, "kind" | "eventDistanceM">
        | { readonly kind: "SPRINT_REFERENCE" }
    }
)

function mainMethodNode(node: PrescriptionSequenceNode, recoveryAfter: SequenceRecovery | null): MainMethodNode {
  if (node.kind === "group") {
    const children = mainMethod(node.children)
    const child = children.length === 1 ? children[0] : undefined
    const recovery = node.recoveryBetweenRepeats
    // Normalize inside-out: unary wrappers add no repeat unit unless their recovery differs.
    // The outer boundary replaces the last child's unused recoveryAfter; counts never expand.
    if (child !== undefined && (recovery.mode === "NOT_APPLICABLE"
      || (recovery.mode === child.recoveryBetweenRepeats.mode && recovery.seconds === child.recoveryBetweenRepeats.seconds))) {
      return { ...child, recoveryAfter }
    }
    return { kind: node.kind, children, recoveryBetweenRepeats: recovery, recoveryAfter }
  }
  return {
    kind: node.kind,
    recoveryBetweenRepeats: node.recoveryBetweenRepeats,
    recoveryAfter,
    work: node.work,
    // Selected athlete/reference IDs are provenance, not a different MAIN method.
    target: node.target.kind === "RACE_PACE"
      ? { kind: node.target.kind, eventDistanceM: node.target.eventDistanceM }
      : node.target.kind === "SPRINT_REFERENCE" ? { kind: node.target.kind } : node.target,
  }
}

function mainMethod(nodes: readonly PrescriptionSequenceNode[]): readonly MainMethodNode[] {
  return nodes.map((node, index) => mainMethodNode(node, index < nodes.length - 1 ? node.recoveryAfter : null))
}

/** Count-only differences stay the same method, even when one count is 1. */
export function compareMainMethods(a: PrescriptionSequence, b: PrescriptionSequence): MainMethodComparison {
  const same = JSON.stringify(mainMethod(validated(a).main)) === JSON.stringify(mainMethod(validated(b).main))
  return same ? Object.freeze({ kind: "same", requiresReview: false }) : Object.freeze({ kind: "different", requiresReview: true })
}
