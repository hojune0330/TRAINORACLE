import { METHOD_ADOPTION_PROTOCOLS } from "./method-adoption-protocols.mjs"
import { previewMethodScope, type ProposedMethodContext } from "./method-adoption-applicability.mjs"
import { representPendingMethodV3 } from "./method-proposal-sequence-v3"
import { compareMainMethodsV3 } from "../../impl/src/prescription/sequence-v3-comparison"

/** Coverage audit only. Distinct structures do not establish dose suitability or approval. */
export function auditPendingMethodChoices(context: ProposedMethodContext) {
  const scope = previewMethodScope(context)
  if (scope.kind !== "scope_preview") throw Error("INVALID_CONTEXT")
  const methods = scope.rows.filter(row => row.scopeMatch).map(row => {
    const matches = METHOD_ADOPTION_PROTOCOLS.filter(p => p.id === row.id)
    if (matches.length !== 1) throw Error("AMBIGUOUS_PROTOCOL")
    return { id: row.id, representation: representPendingMethodV3(matches[0]!) }
  })
  const comparisons = methods.flatMap((a, i) => methods.slice(i + 1).map(b => ({
    left: a.id, right: b.id,
    comparison: a.representation.kind === "represented" && b.representation.kind === "represented"
      ? compareMainMethodsV3(a.representation.sequence, b.representation.sequence) : null,
  })))
  const requiresTwo = ["LT", "VO2", "ATP-PC", "GLY", "MIX"].includes(context.family)
  return {
    context, methodIds: methods.map(m => m.id), comparisons,
    coverage: !requiresTwo ? "NOT_A_MAIN_TWO_CHOICE_REQUIREMENT" as const
      : comparisons.some(p => p.comparison?.kind === "different") ? "STRUCTURAL_OPTIONS_PRESENT" as const
        : "MISSING_DISTINCT_MAIN_OPTIONS" as const,
    executionAuthority: "NONE" as const, scientificAdoption: "NOT_ESTABLISHED" as const,
  }
}

export function auditAllPendingMainChoices() {
  return [800, 1500, 3000, 5000, 10000, 21097, 42195].flatMap(eventDistanceM =>
    ["NEW_TO_RUNNING", "DEVELOPING", "EXPERIENCED"].flatMap(experience =>
      ["YOUTH", "ADULT"].flatMap(population => ["SELF", "COACH_REQUIRED"].flatMap(actor =>
        ["LT", "VO2", "ATP-PC", "GLY", "MIX"].map(family =>
          auditPendingMethodChoices({ eventDistanceM, experience, population, actor, family }))))))
}
