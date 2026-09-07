import { METHOD_ADOPTION_PROTOCOLS } from "./method-adoption-protocols.mjs"

// Proposed review scope only. No clinical inference, selection receipt or runtime activation.
const events = [800, 1500, 3000, 5000, 10000, 21097, 42195]
const allExperience = ["NEW_TO_RUNNING", "DEVELOPING", "EXPERIENCED"]
const trained = ["DEVELOPING", "EXPERIENCED"]
const scope = (ids, eventDistances, experience, replacementRole) => ids.map(id => ({
  id, eventDistances, experience, replacementRole,
  population: ["YOUTH", "ADULT"], actor: ["SELF", "COACH_REQUIRED"],
  status: "OWNER_ADOPTION_PENDING",
}))
export const PROPOSED_METHOD_SCOPES = [
  ...scope(["P-BASE-C", "P-BASE-B"], events, allExperience, "BASE"),
  ...scope(["P-LT-C", "P-LT-B", "P-LT-S"], events, trained, "MAIN"),
  ...scope(["P-RHYTHM-400"], [3000, 5000, 10000, 21097, 42195], ["EXPERIENCED"], "MAIN"),
  ...scope(["P-RHYTHM-300"], [800, 1500, 3000, 5000], trained, "MAIN"),
  ...scope(["P-RHYTHM-T", "P-RHYTHM-TS"], events, trained, "MAIN"),
  ...scope(["P-VO2-2", "P-VO2-3", "P-VO2-4"], events, trained, "MAIN"),
  ...scope(["P-ATP-A"], events, trained, "MAIN"),
  ...scope(["P-ATP-T"], events, trained, "MAIN"),
  ...scope(["P-ATP-F"], events, ["EXPERIENCED"], "MAIN"),
  ...scope(["P-GLY-D", "P-GLY-S"], events, trained, "MAIN"),
  ...scope(["P-REC-W"], events, allExperience, "REC"),
  ...scope(["P-OFF"], events, allExperience, "OFF"),
]

export function previewMethodScope(context) {
  if (!context || !events.includes(context.eventDistanceM)
    || !allExperience.includes(context.experience)
    || !["YOUTH", "ADULT"].includes(context.population)
    || !["SELF", "COACH_REQUIRED"].includes(context.actor)
    || !["BASE", "LT", "VO2", "ATP-PC", "GLY", "MIX", "REC", "OFF"].includes(context.family)) {
    return { kind: "invalid_context", executionAuthority: "NONE", rows: [] }
  }
  const rows = METHOD_ADOPTION_PROTOCOLS.filter(p => p.family === context.family).map(protocol => {
    const matches = PROPOSED_METHOD_SCOPES.filter(s => s.id === protocol.id)
    if (matches.length !== 1) throw new Error("SCOPE_COVERAGE_ERROR")
    const s = matches[0]
    const reasons = []
    if (!s.eventDistances.includes(context.eventDistanceM)) reasons.push("OUTSIDE_PROPOSED_EVENT_SCOPE")
    if (!s.experience.includes(context.experience)) reasons.push("OUTSIDE_PROPOSED_EXPERIENCE_SCOPE")
    return {
      id: protocol.id, scopeMatch: reasons.length === 0, reasons,
      replacementRole: s.replacementRole, executionAuthority: "NONE",
      requiredReviews: ["EXACT_OWNER_ADOPTION", "WHOLE_FRAME_PLACEMENT", "CURRENT_INPUT_AND_SAFETY"],
      recordAbsenceExcludes: false,
    }
  })
  return { kind: "scope_preview", executionAuthority: "NONE", rows }
}
