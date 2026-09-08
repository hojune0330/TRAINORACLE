import { METHOD_ADOPTION_PROTOCOLS, METHOD_ADOPTION_VARIANTS } from "./method-adoption-protocols.mjs"
import { previewMethodScope } from "./method-adoption-applicability.mjs"

/** Inventories review work, never creates a runtime policy or grants combination suitability. */
export function previewPendingMethodCombinations(context, slots, { materializeLimit = 1000 } = {}) {
  if (!Array.isArray(slots) || !slots.length || slots.length > 20 || !Number.isInteger(materializeLimit)
    || materializeLimit < 0 || materializeLimit > 10000) throw Error("INVALID_COMBINATION_REVIEW_REQUEST")
  const keys = slots.map(s => `${s.day}:${s.slot}`)
  if (new Set(keys).size !== keys.length || slots.some(s => !Number.isInteger(s.day) || s.day < 1
    || !["AM", "PM"].includes(s.slot) || !["LT", "VO2", "ATP-PC", "GLY", "MIX"].includes(s.family))) {
    throw Error("INVALID_MAIN_ADDRESSES")
  }
  const catalog = [...METHOD_ADOPTION_PROTOCOLS, ...METHOD_ADOPTION_VARIANTS]
  const choices = [...slots].sort((a, b) => a.day - b.day || a.slot.localeCompare(b.slot)).map(slot => {
    const scope = previewMethodScope({ ...context, family: slot.family })
    if (scope.kind !== "scope_preview") throw Error("INVALID_COMBINATION_CONTEXT")
    const baseIds = new Set(scope.rows.filter(r => r.scopeMatch).map(r => r.id))
    const ids = catalog.filter(p => baseIds.has(p.parentId ?? p.id)).map(p => p.id)
    return { ...slot, configurationIds: ids, originalMayBeRetained: true }
  })
  // The all-original state requires no new multi-adjustment adoption. Every partial
  // change and repeated-method choice remains represented; there is no A-to-B pairing.
  const count = choices.reduce((total, slot) => total * BigInt(slot.configurationIds.length + 1), 1n) - 1n
  const materialized = count <= BigInt(materializeLimit)
  let combinations = []
  if (materialized) {
    combinations = choices.reduce((rows, slot) => rows.flatMap(row => [null, ...slot.configurationIds]
      .map(configurationId => [...row, { day: slot.day, slot: slot.slot, family: slot.family, configurationId }])), [[]])
      .filter(row => row.some(s => s.configurationId !== null))
  }
  return {
    status: "PENDING_COMBINATION_INVENTORY", executionAuthority: "NONE", runtimePoliciesCreated: 0,
    choices, combinationCount: count.toString(), materialized, combinations,
    missingSlotChoices: choices.filter(s => s.configurationIds.length === 0).map(s => ({ day: s.day, slot: s.slot, family: s.family })),
    caveat: "Review inventory only. Original slots retain existing authority; proposal matches do not establish suitability.",
  }
}
