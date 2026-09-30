import { canonicalJson } from "@impl/plan-generator/adaptation"
import { canonicalJsonFingerprint, hasValidCandidatePairIdentity } from "@impl/plan-generator/candidate-identity"
import type { PlanCandidate } from "@impl/plan-generator/types"
import { planBetaStateV3Schema, type PlanBetaStateV3 } from "./plan-beta-schema"
import { contextSchema, type PlanAdaptationContext } from "./plan-adaptation-context-schema"
import type { PlanJournalHistory } from "./plan-journal-evidence"
import { isVerifiedSameCycleChange } from "./execution-replan-source"

const fingerprint = (value: unknown) => canonicalJsonFingerprint("trainoracle.execution-replan.v1", value)

export function candidateMatchesCurrentSnapshot(candidate: PlanCandidate, state: PlanBetaStateV3) {
  const plan = state.activePlan
  return candidate.candidateId === plan.candidateId && candidate.kind === plan.candidateKind
    && candidate.pairId === plan.pairId && candidate.eventDistanceM === plan.eventDistanceM
    && candidate.sourceMode === plan.sourceMode && candidate.selectedEnergyIntent === plan.selectedEnergyIntent
    && (candidate.selectionAuthority === "SELF" ? "SELF" : "COACH") === plan.selectionActor
    && canonicalJson(candidate.selectedDetailedTemplateRef) === canonicalJson(plan.selectedDetailedTemplateRef)
    && canonicalJson(candidate.frame) === canonicalJson(plan.frame)
    && canonicalJson(candidate.sessions) === canonicalJson(plan.sessions)
}

function originalPair(value: unknown, original: PlanBetaStateV3): PlanAdaptationContext | null {
  const parsed = contextSchema.safeParse(value)
  if (!parsed.success || parsed.data.activeCandidateId !== original.activePlan.candidateId) return null
  const balanced = parsed.data.candidates.find(candidate => candidate.kind === "BALANCED")
  const conservative = parsed.data.candidates.find(candidate => candidate.kind === "CONSERVATIVE")
  const selected = parsed.data.candidates.find(candidate => candidate.candidateId === parsed.data.activeCandidateId)
  return balanced && conservative && selected && hasValidCandidatePairIdentity(balanced, conservative)
    && candidateMatchesCurrentSnapshot(selected, original) ? parsed.data : null
}

export type CurrentCycleContext =
  | { readonly kind: "invalid" }
  | {
      readonly kind: "current"
      readonly current: PlanBetaStateV3
      readonly fingerprint: string
      readonly origin:
        | { readonly kind: "unavailable"; readonly code: "HISTORY_UNAVAILABLE" | "INVALID_OR_MISSING_CHAIN" }
        | { readonly kind: "verified"; readonly changeCount: number; readonly original: PlanBetaStateV3;
            readonly originalContext: PlanAdaptationContext | null }
    }

/** Provenance for the current plan, not authority to adapt a historical sibling. */
export function resolveCurrentCycleContext(currentValue: unknown, history: PlanJournalHistory,
  readOriginalContext: (original: PlanBetaStateV3) => unknown = () => null): CurrentCycleContext {
  const parsed = planBetaStateV3Schema.safeParse(currentValue)
  if (!parsed.success) return { kind: "invalid" }
  const current = parsed.data
  const base = { kind: "current" as const, current, fingerprint: fingerprint(current) }
  const unavailable = (code: "HISTORY_UNAVAILABLE" | "INVALID_OR_MISSING_CHAIN"): CurrentCycleContext =>
    ({ ...base, origin: { kind: "unavailable", code } })
  if ((current.executionReplan || current.catalogReplacement) && history.kind !== "loaded") return unavailable("HISTORY_UNAVAILABLE")
  const retained = new Map<string, PlanBetaStateV3>()
  for (const value of history.kind === "loaded" ? history.plans : []) {
    const original = planBetaStateV3Schema.safeParse(value)
    if (original.success) retained.set(fingerprint(original.data), original.data)
  }
  const visited = new Set<string>([fingerprint(current)])
  let original = current, changeCount = 0
  while (original.executionReplan || original.catalogReplacement) {
    const receipt = original.executionReplan ?? original.catalogReplacement!
    const previous = retained.get(receipt.baseStateFingerprint)
    if (!previous || visited.has(receipt.baseStateFingerprint) || !isVerifiedSameCycleChange(previous, original)) {
      return unavailable("INVALID_OR_MISSING_CHAIN")
    }
    visited.add(receipt.baseStateFingerprint)
    original = previous
    changeCount++
  }
  let originalContext: PlanAdaptationContext | null = null
  try { originalContext = originalPair(readOriginalContext(original), original) } catch { /* Historical pair is optional. */ }
  return { ...base, origin: { kind: "verified", changeCount, original, originalContext } }
}
