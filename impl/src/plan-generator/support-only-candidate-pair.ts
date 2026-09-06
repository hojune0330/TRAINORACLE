import type { PlanCandidate, PlanSession } from "./types"
import { hasValidCandidatePairIdentity } from "./candidate-identity"

function sameJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

function sharedCandidateContent(candidate: PlanCandidate) {
  return {
    pairId: candidate.pairId,
    eventGroup: candidate.eventGroup,
    eventDistanceM: candidate.eventDistanceM,
    selectedDetailedTemplateRef: candidate.selectedDetailedTemplateRef,
    selectedEnergyIntent: candidate.selectedEnergyIntent,
    sourceMode: candidate.sourceMode,
    confidence: candidate.confidence,
    beta: candidate.beta,
    detailedPrescriptionFingerprint: candidate.detailedPrescriptionFingerprint,
    continuityContext: candidate.continuityContext,
    selectionAuthority: candidate.selectionAuthority,
    frame: candidate.frame,
    mainExposureLedger: candidate.mainExposureLedger,
    rationaleCodes: candidate.rationaleCodes,
  }
}

function isRecoveryCompanion(
  sessions: readonly PlanSession[],
  session: PlanSession,
): boolean {
  if (session.role !== "EASY" || session.plannedEnergyIntent !== "RECOVERY_INTENT") {
    return false
  }
  const sameDay = sessions.filter((item) => item.day === session.day)
  return sameDay.some((item) => item.role === "QUALITY")
    || (session.slot === "PM" && sameDay.length === 2)
}

export function isSupportOnlyCandidatePair(
  balanced: PlanCandidate,
  conservative: PlanCandidate,
): boolean {
  return checkCandidatePair(balanced, conservative, false)
}

/** Initial explicit selection may place the same approved single MAIN independently.
 * Adaptation continues to use the strict support-only predicate above.
 */
export function isInitialCandidatePair(balanced: PlanCandidate, conservative: PlanCandidate): boolean {
  if (isSupportOnlyCandidatePair(balanced, conservative)) return true
  const main = (candidate: PlanCandidate) => candidate.sessions.filter(session => session.role === "QUALITY")
  const left = main(balanced)
  const right = main(conservative)
  if (left.filter(session => session.prescription.kind === "PACE_TARGET").length !== 1
      || right.filter(session => session.prescription.kind === "PACE_TARGET").length !== 1) return false
  const work = (sessions: readonly PlanSession[]) => sessions.map(session => JSON.stringify({
    purpose: session.plannedEnergyIntent, prescription: session.prescription,
  })).sort()
  if (!sameJson(work(left), work(right))) return false
  return checkCandidatePair(balanced, conservative, true)
}

function checkCandidatePair(balanced: PlanCandidate, conservative: PlanCandidate, independentMain: boolean): boolean {
  const shared = (candidate: PlanCandidate) => independentMain
    ? { ...sharedCandidateContent(candidate), detailedPrescriptionFingerprint: null }
    : sharedCandidateContent(candidate)
  if (
    !hasValidCandidatePairIdentity(balanced, conservative)
    || balanced.kind !== "BALANCED"
    || conservative.kind !== "CONSERVATIVE"
    || balanced.sessions.length !== conservative.sessions.length
    || !sameJson(shared(balanced), shared(conservative))
  ) {
    return false
  }

  let shortenedSupport = false
  for (const [index, session] of balanced.sessions.entries()) {
    const shorter = conservative.sessions[index]
    if (
      shorter === undefined
      || session.day !== shorter.day
      || session.slot !== shorter.slot
      || session.role !== shorter.role
      || session.plannedEnergyIntent !== shorter.plannedEnergyIntent
    ) {
      return false
    }
    if (session.role !== "EASY") {
      if (independentMain && session.role === "QUALITY") continue
      if (!sameJson(session, shorter)) return false
      continue
    }
    if (
      session.prescription.kind !== "RPE_TIME_RANGE"
      || shorter.prescription.kind !== "RPE_TIME_RANGE"
    ) {
      return false
    }
    if (isRecoveryCompanion(balanced.sessions, session)) {
      if (
        session.prescription.rpe.minimum < 1
        || session.prescription.rpe.maximum > 3
        || !sameJson(session, shorter)
      ) {
        return false
      }
      continue
    }
    if (
      !sameJson(session.prescription.rpe, shorter.prescription.rpe)
      || shorter.prescription.durationMinutes.minimum
        !== session.prescription.durationMinutes.minimum
      || shorter.prescription.durationMinutes.maximum
        !== session.prescription.durationMinutes.minimum
    ) {
      return false
    }
    if (
      shorter.prescription.durationMinutes.maximum
      < session.prescription.durationMinutes.maximum
    ) {
      shortenedSupport = true
    }
  }
  return shortenedSupport
}
