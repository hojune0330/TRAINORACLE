import { planBetaStateV2Schema, planBetaStateV3Schema } from "../plan-beta-schema"
import { stateFixture } from "../plan-beta-store.test-fixture"
import { adjustedPlanSelectionFixture } from "../adjusted-plan-selection.test-fixtures"
import { adjustedPlanSelectionV3Fixture } from "../adjusted-plan-selection-v3.test-fixtures"
import { selectAdjustedPlanForActivation } from "../adjusted-plan-selection"
import { selectAdjustedPlanForActivationV3 } from "../selected-adjusted-plan-v3"
import { selectMultiAdjustedPlanV3 } from "../selected-multi-adjusted-plan-v3"
import { multiAdjustedPlanReviewScopeV3 } from "../adjusted-plan-multi-review-v3"
import { encodeStoredAdjustedPlanState } from "../adjusted-plan-storage-schema"
import { encodeStoredAdjustedPlanStateV5 } from "../adjusted-plan-storage-v5-schema"
import { encodeStoredMultiAdjustedPlanV6 } from "../adjusted-plan-storage-v6-schema"
import { TODAY } from "../prescription-quality-matrix.test-fixtures"
import type { AccountPlanPacket } from "./account-plan-document-schema"

export function accountPlanPacketFixture(version: 2 | 3 | 4 | 5 | 6, at = TODAY): AccountPlanPacket {
  if (version === 2) {
    const current = planBetaStateV3Schema.parse(stateFixture())
    const { pairId: _pairId, selectedDetailedTemplateRef: _template, ...activePlan } = current.activePlan
    return { state: planBetaStateV2Schema.parse({ ...current, version: 2, activePlan, generatedAt: at.toISOString() }), evidence: null }
  }
  if (version === 3) return { state: planBetaStateV3Schema.parse({ ...stateFixture(), generatedAt: at.toISOString() }), evidence: null }
  if (version === 4) {
    const f = adjustedPlanSelectionFixture({}, undefined, at)
    const selected = selectAdjustedPlanForActivation(f.request, [f.policy], at)
    if (selected.kind !== "selected_adjusted") throw Error(selected.code)
    const stored = encodeStoredAdjustedPlanState(selected.state, [], at.toISOString(), f.retained, at)
    if (stored.kind !== "encoded") throw Error("fixture encoding")
    return { state: stored.state, evidence: f.retained[0]! }
  }
  const f = adjustedPlanSelectionV3Fixture(undefined, at)
  if (version === 5) {
    const selected = selectAdjustedPlanForActivationV3(f.request, [f.policy], at)
    if (selected.kind !== "selected_adjusted") throw Error(selected.code)
    const stored = encodeStoredAdjustedPlanStateV5(selected.state, [], at.toISOString(), [f.retained], at)
    if (stored.kind !== "encoded") throw Error("fixture encoding")
    return { state: stored.state, evidence: f.retained }
  }
  const preparations = [f.request.preparation]
  const scope = multiAdjustedPlanReviewScopeV3(preparations, f.request.intake.experienceBand)
  if (scope.kind !== "scope") throw Error(scope.code)
  const policy = { ...f.policy, scopeVersion: "MULTI_STRUCTURAL_V3" as const, scopeFingerprint: scope.scopeFingerprint }
  const selected = selectMultiAdjustedPlanV3({ ...f.request, preparations,
    expectedCandidateFingerprint: scope.candidate.contentFingerprint }, [], [policy], at)
  if (selected.kind !== "selected_multi_adjusted") throw Error(selected.code)
  const evidence = { slots: [{ address: f.request.preparation.address, authority: f.retained.authority,
    explanation: f.retained.explanation }], rpeBindings: [], policies: [policy] }
  const stored = encodeStoredMultiAdjustedPlanV6(selected.state, [], at.toISOString(), [evidence], at)
  if (stored.kind !== "encoded") throw Error("fixture encoding")
  return { state: stored.state, evidence }
}
