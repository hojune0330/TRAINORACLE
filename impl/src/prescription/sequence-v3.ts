import { parsePrescriptionSequence, PRESCRIPTION_SEQUENCE_LIMITS } from "./sequence"
import type { SequenceWork, SequenceTarget, SequenceRecovery } from "./sequence"

export type RecoveryStepV3 = Exclude<SequenceRecovery, { readonly mode: "NOT_APPLICABLE" }>
  | { readonly mode: "WALK_OR_STAND"; readonly seconds: number | null }
type BaseV3 = {
  readonly id: string
  readonly label: string | null
  readonly repeatCount: number
  readonly recoveryBetweenRepeats: readonly RecoveryStepV3[]
  // Once after all repetitions, including at the end of a phase or set.
  readonly recoveryAfter: readonly RecoveryStepV3[]
}
export type SequenceNodeV3 = BaseV3 & ({
  readonly kind: "segment"
  readonly role: "WORK" | "BUILDUP" | "PREPARATION"
  readonly work: SequenceWork
  readonly target: SequenceTarget
} | {
  readonly kind: "group"
  readonly repeatUnit: "SET" | "REPETITION" | "SEQUENCE"
  readonly children: readonly SequenceNodeV3[]
})
export type PrescriptionSequenceV3 = {
  readonly kind: "PRESCRIPTION_SEQUENCE"
  readonly version: 3
  readonly id: string
  readonly label: string | null
  readonly warmup: readonly SequenceNodeV3[]
  readonly main: readonly SequenceNodeV3[]
  readonly cooldown: readonly SequenceNodeV3[]
}
const none = { mode: "NOT_APPLICABLE" as const, seconds: null }
const limits = PRESCRIPTION_SEQUENCE_LIMITS
const fail = (): never => { throw new Error("INVALID_SEQUENCE_V3") }
function object(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)
    || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) return fail()
  if (Reflect.ownKeys(value).length !== keys.length) return fail()
  const result: Record<string, unknown> = {}
  for (const key of keys) {
    const field = Object.getOwnPropertyDescriptor(value, key)
    if (!field || !("value" in field) || !field.enumerable) return fail()
    result[key] = field.value as unknown
  }
  return result
}
function text(value: unknown): string {
  if (typeof value !== "string" || !value.trim() || value.length > limits.maxStringLength) return fail()
  return value
}
function number(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1) return fail()
  return value
}
function bounded(value: number): number {
  if (!Number.isFinite(value) || value > limits.maxNumber) return fail()
  return value
}
function list(value: unknown): readonly unknown[] {
  if (!Array.isArray(value) || value.length > limits.maxChildren) return fail()
  if (Reflect.ownKeys(value).length !== value.length + 1) return fail()
  return Array.from({ length: value.length }, (_, i) => {
    const d = Object.getOwnPropertyDescriptor(value, String(i))
    if (!d || !("value" in d) || !d.enumerable) return fail()
    return d.value as unknown
  })
}
// Reuse the established V2 target, work and scalar recovery validation.
function legacyParts(work: unknown, target: unknown, recovery: unknown) {
  const parsed = parsePrescriptionSequence({ kind: "PRESCRIPTION_SEQUENCE", version: 2,
    id: "validation-root", label: null, warmup: [], cooldown: [], terminalRecovery: recovery,
    main: [{ kind: "segment", id: "validation-part", label: null, repeatCount: 1,
      work, target, recoveryBetweenRepeats: none, recoveryAfter: none }],
  })
  if (parsed.kind !== "parsed" || parsed.sequence.main[0]?.kind !== "segment") return fail()
  return { ...parsed.sequence.main[0], recoveryBetweenRepeats: parsed.sequence.terminalRecovery! }
}
const dummyWork = { kind: "duration", durationSeconds: 1, distanceM: null }
const dummyTarget = { kind: "EFFORT_GUIDANCE", cue: null }

export function parsePrescriptionSequenceV3(input: unknown):
  { readonly kind: "parsed"; readonly sequence: PrescriptionSequenceV3 }
  | { readonly kind: "rejected"; readonly code: "INVALID_SEQUENCE_V3" } {
  try {
    const ids = new Set<string>()
    let count = 0
    const id = (v: unknown) => { const s = text(v); if (ids.has(s)) return fail(); ids.add(s); return s }
    const label = (v: unknown) => v === null ? null : text(v)
    const recovery = (v: unknown): readonly RecoveryStepV3[] => Object.freeze(list(v).map(raw => {
      if (++count > limits.maxNodes) return fail()
      if (!raw || typeof raw !== "object") return fail()
      const modeDescriptor = Object.getOwnPropertyDescriptor(raw, "mode")
      if (!modeDescriptor || !("value" in modeDescriptor)) return fail()
      if (modeDescriptor.value === "WALK_OR_STAND") {
        const r = object(raw, ["mode", "seconds"])
        const validated = legacyParts(dummyWork, dummyTarget, { mode: "STAND", seconds: r["seconds"] }).recoveryBetweenRepeats
        return Object.freeze({ mode: "WALK_OR_STAND", seconds: validated.seconds })
      }
      const validated = legacyParts(dummyWork, dummyTarget, raw).recoveryBetweenRepeats
      if (validated.mode === "NOT_APPLICABLE") return fail()
      return validated
    }))
    const nodes = (v: unknown, depth: number, insideRepetition: boolean): readonly SequenceNodeV3[] => Object.freeze(list(v).map(raw => {
      if (++count > limits.maxNodes || depth > limits.maxDepth || !raw || typeof raw !== "object") return fail()
      const kd = Object.getOwnPropertyDescriptor(raw, "kind")
      if (!kd || !("value" in kd) || !["segment", "group"].includes(kd.value as string)) return fail()
      const kind = kd.value as "segment" | "group"
      const r = object(raw, ["id", "label", "kind", "repeatCount", "recoveryBetweenRepeats", "recoveryAfter",
        ...(kind === "segment" ? ["role", "work", "target"] : ["repeatUnit", "children"])])
      const base = { id: id(r["id"]), label: label(r["label"]), repeatCount: number(r["repeatCount"]),
        recoveryBetweenRepeats: recovery(r["recoveryBetweenRepeats"]), recoveryAfter: recovery(r["recoveryAfter"]) }
      if (base.repeatCount === 1 && base.recoveryBetweenRepeats.length) return fail()
      if (kind === "segment") {
        const role = r["role"]
        if (role !== "WORK" && role !== "BUILDUP" && role !== "PREPARATION") return fail()
        const parts = legacyParts(r["work"], r["target"], none)
        return Object.freeze({ kind, ...base, role, work: parts.work, target: parts.target })
      }
      const repeatUnit = r["repeatUnit"]
      if (repeatUnit !== "SET" && repeatUnit !== "REPETITION" && repeatUnit !== "SEQUENCE") return fail()
      if (insideRepetition && repeatUnit !== "SEQUENCE") return fail()
      const children = nodes(r["children"], depth + 1, insideRepetition || repeatUnit === "REPETITION")
      if (!children.length) return fail()
      const containsWork = (items: readonly SequenceNodeV3[]): boolean => items.some(item =>
        item.kind === "segment" ? item.role === "WORK" : containsWork(item.children))
      if (repeatUnit === "REPETITION" && !containsWork(children)) return fail()
      return Object.freeze({ kind, ...base, repeatUnit, children })
    }))
    const root = object(input, ["kind", "version", "id", "label", "warmup", "main", "cooldown"])
    if (root["kind"] !== "PRESCRIPTION_SEQUENCE" || root["version"] !== 3) return fail()
    const sequence: PrescriptionSequenceV3 = Object.freeze({ kind: "PRESCRIPTION_SEQUENCE", version: 3,
      id: id(root["id"]), label: label(root["label"]), warmup: nodes(root["warmup"], 1, false),
      main: nodes(root["main"], 1, false), cooldown: nodes(root["cooldown"], 1, false) })
    if (!sequence.main.length) return fail()
    for (const phase of [sequence.warmup, sequence.main, sequence.cooldown]) calculate(phase)
    return Object.freeze({ kind: "parsed", sequence })
  } catch {
    return Object.freeze({ kind: "rejected", code: "INVALID_SEQUENCE_V3" })
  }
}

type Measure = { known: number; unknown: boolean }
const measure = (): Measure => ({ known: 0, unknown: false })
function add(m: Measure, value: number | null, count: number) {
  if (count === 0) return
  if (value === null) m.unknown = true
  else m.known = bounded(m.known + bounded(value * count))
}
function calculate(nodes: readonly SequenceNodeV3[]) {
  const roles = { WORK: { distance: measure(), duration: measure() }, BUILDUP: { distance: measure(), duration: measure() },
    PREPARATION: { distance: measure(), duration: measure() } }
  const rest = { distance: measure(), duration: measure() }
  let repetitionBlocks = 0, workSegments = 0, recoverySteps = 0
  function recover(steps: readonly RecoveryStepV3[], count: number) {
    recoverySteps = bounded(recoverySteps + bounded(steps.length * count))
    for (const step of steps) {
      add(rest.duration, step.seconds, count)
      add(rest.distance, "distanceM" in step ? step.distanceM : step.mode === "STAND" ? 0 : null, count)
    }
  }
  function visit(items: readonly SequenceNodeV3[], multiplier: number, inBlock: boolean) {
    for (const node of items) {
      const instances = bounded(multiplier * node.repeatCount)
      if (node.kind === "segment") {
        add(roles[node.role].distance, node.work.distanceM, instances)
        add(roles[node.role].duration, node.work.durationSeconds, instances)
        if (node.role === "WORK") {
          workSegments = bounded(workSegments + instances)
          if (!inBlock) repetitionBlocks = bounded(repetitionBlocks + instances)
        }
      } else {
        if (node.repeatUnit === "REPETITION") repetitionBlocks = bounded(repetitionBlocks + instances)
        visit(node.children, instances, inBlock || node.repeatUnit === "REPETITION")
      }
      recover(node.recoveryBetweenRepeats, bounded(multiplier * (node.repeatCount - 1)))
      recover(node.recoveryAfter, multiplier)
    }
  }
  visit(nodes, 1, false)
  const value = (m: Measure) => m.unknown ? null : m.known
  const knownDuration = bounded(Object.values(roles).reduce((sum, r) => bounded(sum + r.duration.known), rest.duration.known))
  const knownDistance = bounded(Object.values(roles).reduce((sum, r) => bounded(sum + r.distance.known), rest.distance.known))
  return Object.freeze({ repetitionBlocks, workSegments, recoverySteps,
    workDistanceM: value(roles.WORK.distance), buildupDistanceM: value(roles.BUILDUP.distance),
    preparationDistanceM: value(roles.PREPARATION.distance), workSeconds: value(roles.WORK.duration),
    buildupSeconds: value(roles.BUILDUP.duration), preparationSeconds: value(roles.PREPARATION.duration),
    recoverySeconds: value(rest.duration), recoveryDistanceM: value(rest.distance),
    knownRecoverySeconds: rest.duration.known, knownRecoveryDistanceM: rest.distance.known,
    totalSeconds: rest.duration.unknown || Object.values(roles).some(r => r.duration.unknown) ? null : knownDuration,
    totalDistanceM: rest.distance.unknown || Object.values(roles).some(r => r.distance.unknown) ? null : knownDistance,
  })
}
export function deriveSequenceV3Totals(input: unknown) {
  const parsed = parsePrescriptionSequenceV3(input)
  if (parsed.kind !== "parsed") throw new TypeError("INVALID_SEQUENCE_V3")
  return Object.freeze({ warmup: calculate(parsed.sequence.warmup), main: calculate(parsed.sequence.main),
    cooldown: calculate(parsed.sequence.cooldown) })
}
