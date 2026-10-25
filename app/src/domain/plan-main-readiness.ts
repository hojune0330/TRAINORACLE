import type { PlanSession } from "@impl/plan-generator/types"
import { isValidCatalogSession, resolveCatalogBinding } from "@impl/prescription/catalog-session-binding"

/** Structural readiness only; record authority, environment and safety gates still apply. */
export function unresolvedPlanMains(sessions: readonly PlanSession[]) {
  return sessions.filter(session => {
    if (session.role !== "QUALITY") return false
    const prescription = session.prescription
    if (prescription.kind === "PACE_TARGET") return false
    return prescription.kind !== "RPE_TIME_RANGE" || !prescription.catalogWorkout
      || !resolveCatalogBinding(prescription.catalogWorkout) || !isValidCatalogSession(session)
  })
}
