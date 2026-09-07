import { parsePrescriptionSequenceV3, type PrescriptionSequenceV3, type RecoveryStepV3, type SequenceNodeV3 } from "../../impl/src/prescription/sequence-v3"
import { expandProposal, assembleProposalSession } from "./method-adoption-protocols.mjs"

type Part = { role: string; unit: string; value: number }
export type PendingMethodProtocol = {
  id: string; family: string; method: string; sets: number; reps: number; work: Part[];
  between: Part | null; setRest: Part | null; afterEvery: Part | null;
  status: string; executionAuthority: string;
}

/** Keep the existing support proposal separate from the still-unprescribed main intensity. */
export function representPendingWholeSessionV3(p: PendingMethodProtocol) {
  const main = representPendingMethodV3(p)
  if (main.kind !== "represented") return main
  const source = assembleProposalSession(p)
  const phase = (parts: typeof source.warmup, prefix: string): SequenceNodeV3[] => {
    const nodes: SequenceNodeV3[] = []
    for (const [index, part] of parts.entries()) {
      if (part.unit !== "SECONDS") throw Error("UNSUPPORTED_SUPPORT_UNIT")
      if (part.role === "WALK") {
        const previous = nodes.at(-1)
        if (!previous) throw Error("UNANCHORED_SUPPORT_RECOVERY")
        nodes[nodes.length - 1] = { ...previous,
          recoveryAfter: [...previous.recoveryAfter, { mode: "WALK", seconds: part.value }] }
      } else {
        if (part.role !== "EASY_RUN" && part.role !== "BUILDUP") throw Error("UNSUPPORTED_SUPPORT_ROLE")
        nodes.push({ kind: "segment", id: `${prefix}-${index}`, label: null,
          role: part.role === "BUILDUP" ? "BUILDUP" : "PREPARATION", repeatCount: 1,
          work: { kind: "duration", durationSeconds: part.value, distanceM: null },
          target: { kind: "EFFORT_GUIDANCE", cue: part.cue }, recoveryBetweenRepeats: [], recoveryAfter: [] })
      }
    }
    return nodes
  }
  const parsed = parsePrescriptionSequenceV3({ ...main.sequence,
    warmup: phase(source.warmup, "warmup"), cooldown: phase(source.cooldown, "cooldown") })
  if (parsed.kind !== "parsed") throw Error("INVALID_WHOLE_SESSION_REPRESENTATION")
  return { ...main, sequence: parsed.sequence, supportIncluded: source.supportRef !== null,
    supportRef: source.supportRef, applicabilityReviewed: false as const,
    supportReviewIssues: [...source.warmup, ...source.cooldown].some(p => p.role === "WALK" && p.cue === "WALK_OR_JOG")
      ? ["SUPPORT_RECOVERY_MODE_CUE_MISMATCH"] : [] }
}

/** Review tooling only: no pace, effort prescription, eligibility or authority is inferred. */
export function representPendingMethodV3(p: PendingMethodProtocol) {
  expandProposal(p)
  if (p.status !== "OWNER_ADOPTION_PENDING" || p.executionAuthority !== "NONE") throw Error("NOT_PENDING")
  if (p.family === "OFF") {
    if (p.sets || p.reps || p.work.length || p.between || p.setRest || p.afterEvery) throw Error("INVALID_OFF")
    return { kind: "no_exercise" as const, id: p.id, executionAuthority: "NONE" as const }
  }
  if (!p.sets || !p.reps || !p.work.length || (p.between && p.afterEvery)) throw Error("INVALID_STRUCTURE")
  const recovery = (part: Part | null): RecoveryStepV3[] => {
    if (!part) return []
    if (part.unit === "METERS" && part.role === "ROLL_ON") return [{ mode: "ACTIVE_ROLL_ON", distanceM: part.value, seconds: null }]
    if (part.unit !== "SECONDS") throw Error("UNSUPPORTED_RECOVERY")
    if (part.role === "WALK" || part.role === "WALK_OR_STAND") return [{ mode: part.role, seconds: part.value }]
    if (part.role === "JOG" || part.role === "EASY_RUN") return [{ mode: "JOG", seconds: part.value }]
    throw Error("UNSUPPORTED_RECOVERY")
  }
  const children: SequenceNodeV3[] = p.work.map((part, i) => {
    if (part.role !== "WORK" && part.role !== "BUILDUP") throw Error("UNSUPPORTED_ROLE")
    if (part.unit !== "SECONDS" && part.unit !== "METERS") throw Error("UNSUPPORTED_UNIT")
    return { kind: "segment", id: `part-${i}`, label: null, role: part.role, repeatCount: 1,
      work: part.unit === "SECONDS" ? { kind: "duration", durationSeconds: part.value, distanceM: null }
        : { kind: "distance", distanceM: part.value, durationSeconds: null },
      target: { kind: "EFFORT_GUIDANCE", cue: "강도 미결정 · 검토 초안" }, recoveryBetweenRepeats: [],
      recoveryAfter: i === p.work.length - 1 ? recovery(p.afterEvery) : [] }
  })
  const repetitions: SequenceNodeV3 = { kind: "group", id: "repetitions", label: null, repeatUnit: "REPETITION",
    repeatCount: p.reps, children, recoveryBetweenRepeats: recovery(p.between), recoveryAfter: [] }
  const main: SequenceNodeV3[] = p.sets === 1 ? [repetitions] : [{ kind: "group", id: "sets", label: null,
    repeatUnit: "SET", repeatCount: p.sets, children: [repetitions], recoveryBetweenRepeats: recovery(p.setRest), recoveryAfter: [] }]
  if (p.sets === 1 && p.setRest) throw Error("UNUSED_SET_RECOVERY")
  const sequence: PrescriptionSequenceV3 = { kind: "PRESCRIPTION_SEQUENCE", version: 3, id: p.id,
    label: null, warmup: [], main, cooldown: [] }
  const parsed = parsePrescriptionSequenceV3(sequence)
  if (parsed.kind !== "parsed") throw Error("INVALID_V3_REPRESENTATION")
  return { kind: "represented" as const, sequence: parsed.sequence, executionAuthority: "NONE" as const,
    supportIncluded: false, targetStatus: "NOT_PRESCRIBED" as const }
}
