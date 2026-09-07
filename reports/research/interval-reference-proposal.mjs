import { METHOD_ADOPTION_PROTOCOLS, METHOD_ADOPTION_VARIANTS, expandProposal } from "./method-adoption-protocols.mjs"
// A coaching fallback reference, not VDOT or an estimate of measured vVO2max.
export const INTERVAL_REFERENCE_PROPOSAL = Object.freeze({
  modelId: "TO-HARD-5K-RP-REFERENCE", version: "0.2",
  status: "OWNER_ADOPTION_PENDING", source: "https://vdoto2.com/",
  sourceSection: "Interval Pace",
})
const supportedIds = new Set(["P-VO2-2", "P-VO2-3", "P-VO2-4", "P-VO2-2-4", "P-VO2-2-5"])
function readPrescription(id) {
  if (!supportedIds.has(id)) return null
  const matches = [...METHOD_ADOPTION_PROTOCOLS, ...METHOD_ADOPTION_VARIANTS].filter(p => p.id === id)
  if (matches.length !== 1) return null
  const p = matches[0]
  try { expandProposal(p) } catch { return null }
  if (p.family !== "VO2" || p.sets !== 1 || p.work.length !== 1 || p.work[0].role !== "WORK"
    || p.work[0].unit !== "SECONDS" || p.between?.unit !== "SECONDS" || p.between.role !== "JOG"
    || p.setRest || p.afterEvery) return null
  return { workSeconds: p.work[0].value, repeats: p.reps, restSeconds: p.between.value }
}
export function calculateIntervalReferenceProposal(input) {
  const unavailable = { kind: "unavailable", executionAuthority: "NONE" }
  if (!input || input.eventDistanceM !== 5000 || input.freshness !== "CURRENT"
    || !["PERSONAL_BEST", "SEASON_BEST", "RECENT_RESULT"].includes(input.purpose)
    || !Number.isFinite(input.performanceSeconds) || input.performanceSeconds <= 0) return unavailable
  const prescription = readPrescription(input.protocolId)
  if (!prescription) return unavailable
  const secondsPerKm = input.performanceSeconds / 5
  const secondsPer400m = input.performanceSeconds * 400 / 5000
  if (!Number.isFinite(secondsPerKm) || secondsPerKm <= 0 || !Number.isFinite(secondsPer400m) || secondsPer400m <= 0) return unavailable
  return {
    kind: "research_reference", executionAuthority: "NONE",
    modelId: INTERVAL_REFERENCE_PROPOSAL.modelId, modelVersion: INTERVAL_REFERENCE_PROPOSAL.version,
    referenceKind: "CURRENT_5K_RACE_PACE_NOT_MEASURED_I",
    secondsPerKm, secondsPer400m,
    prescription: { ...prescription, finalRecoverySeconds: null },
    paceChangesRecovery: false, measuredVo2maxPace: false,
    sourceConditionAssessment: "NOT_PERFORMED",
  }
}
