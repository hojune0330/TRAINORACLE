import { canonicalJsonFingerprint } from "@impl/plan-generator/candidate-identity"
import type { PlanAdjustmentResolver } from "../PlanBeta"

export function matchingAdjustmentEntry(resolver: PlanAdjustmentResolver | undefined,
  context: Parameters<PlanAdjustmentResolver>[0]) {
  try {
    const entry = resolver?.(context)
    if (!entry) return null
    const candidate = context.generated.candidates.find(item => item.candidateId === context.candidateId)
    const same = (a: unknown, b: unknown) => canonicalJsonFingerprint("adjustment-entry.v1", a)
      === canonicalJsonFingerprint("adjustment-entry.v1", b)
    if (!candidate || !same(entry.seed.generated, context.generated)
      || !same(entry.seed.preparation.candidate, candidate) || !same(entry.seed.intake, context.intake)
      || !same(entry.seed.athleteEvidence, context.athleteEvidence) || !same(entry.seed.gate, context.gate)
      || entry.seed.currentCheck !== context.currentCheck || entry.seed.preparation.startDate !== context.startDate) return null
    return entry
  } catch { return null }
}
