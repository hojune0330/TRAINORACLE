import type { PlanSession } from "./session-types"
import { projectPacePrescriptionSequence } from "../prescription/pace-sequence"
import { compareMainMethods, type PrescriptionSequence } from "../prescription/sequence"

type TemplateReference = {
  readonly templateId: string
  readonly version: string
  readonly fingerprint: string
}

export type MainPlacementContext = {
  readonly eventDistanceM: number | null
  readonly selectedEnergyIntent: string
  readonly selectedDetailedTemplateRef: TemplateReference | null
  readonly sessions: readonly PlanSession[]
  readonly athleteExperienceBand?: "NEW_TO_RUNNING" | "DEVELOPING" | "EXPERIENCED"
}

export type ReviewedMainPlacementPolicy = {
  readonly policyId: string
  readonly version: string
  readonly reviewRef: string
  readonly eventDistanceM: number
  readonly energyIntent: string
  readonly experienceBand: "EXPERIENCED"
  readonly population: "YOUTH_AND_ADULT"
  readonly allowedTemplates: readonly TemplateReference[]
  readonly maximumDetailedSessions: number
  readonly minimumSeparationSlots: number
  readonly allowRepeatedConfiguration: boolean
}

// A template approval is not approval to repeat its dose in one frame.
// Populate only with a separately reviewed placement policy, never catalog labels.
export const REVIEWED_MAIN_PLACEMENT_POLICIES: readonly ReviewedMainPlacementPolicy[] = Object.freeze([])

// V3 archives used structural uniqueness as a storage constraint. Preserve their
// read path; this compatibility branch must never authorize new generation.
export function isStoredMainPlacement(context: MainPlacementContext): boolean {
  if (isReviewedMainPlacement(context)) return true
  const reference = context.selectedDetailedTemplateRef
  const detailed = context.sessions.flatMap(session => session.prescription.kind === "PACE_TARGET" ? [session.prescription] : [])
  if (reference === null || detailed.filter(prescription => matches(reference, prescription)).length !== 1) return false
  const keys = new Set<string>()
  const sequences: PrescriptionSequence[] = []
  for (const prescription of detailed) {
    const key = JSON.stringify([prescription.templateId, prescription.templateVersion, prescription.templateContentFingerprint])
    const sequence = prescription.sequence ?? projectPacePrescriptionSequence(prescription)
    if (keys.has(key) || sequence === null
        || sequences.some(existing => compareMainMethods(existing, sequence).kind !== "different")) return false
    keys.add(key)
    sequences.push(sequence)
  }
  return true
}

export function isReviewedMainPlacement(
  context: MainPlacementContext,
  policies: readonly ReviewedMainPlacementPolicy[] = REVIEWED_MAIN_PLACEMENT_POLICIES,
): boolean {
  const detailed = context.sessions.filter(session => session.prescription.kind === "PACE_TARGET")
  if (detailed.length === 0) return true
  const reference = context.selectedDetailedTemplateRef
  if (reference === null || !detailed.some(session => session.prescription.kind === "PACE_TARGET"
      && matches(reference, session.prescription))) return false

  const addresses = new Set<string>()
  for (const session of detailed) {
    const address = `${session.day}:${session.slot}`
    if (addresses.has(address) || session.role !== "QUALITY"
        || !Number.isInteger(session.day) || session.day < 1
        || (session.slot !== "AM" && session.slot !== "PM")
        || session.plannedEnergyIntent !== context.selectedEnergyIntent
        || session.prescription.kind !== "PACE_TARGET"
        || session.prescription.targetEventDistanceM !== context.eventDistanceM) return false
    addresses.add(address)
  }
  if (detailed.length === 1) return true
  if (context.athleteExperienceBand === undefined) return false

  return policies.some(policy => {
    if (!policy.policyId.trim() || !policy.version.trim() || !policy.reviewRef.trim()
        || policy.eventDistanceM !== context.eventDistanceM
        || policy.energyIntent !== context.selectedEnergyIntent
        || policy.experienceBand !== context.athleteExperienceBand
        || !Number.isInteger(policy.maximumDetailedSessions) || policy.maximumDetailedSessions < 2
        || detailed.length > policy.maximumDetailedSessions
        || !Number.isInteger(policy.minimumSeparationSlots) || policy.minimumSeparationSlots < 1) return false
    const configurations = new Set<string>()
    for (const session of detailed) {
      const prescription = session.prescription
      if (prescription.kind !== "PACE_TARGET"
          || prescription.scope.experienceBand !== policy.experienceBand
          || prescription.scope.population !== policy.population
          || !policy.allowedTemplates.some(template => matches(template, prescription))) return false
      const key = JSON.stringify([prescription.templateId, prescription.templateVersion, prescription.templateContentFingerprint])
      if (!policy.allowRepeatedConfiguration && configurations.has(key)) return false
      configurations.add(key)
    }
    const positions = detailed.map(session => (session.day - 1) * 2 + (session.slot === "AM" ? 0 : 1)).sort((a, b) => a - b)
    return positions.every((position, index) => index === 0
      || position - positions[index - 1]! >= policy.minimumSeparationSlots)
  })
}

function matches(reference: TemplateReference, prescription: {
  readonly templateId: string
  readonly templateVersion: string
  readonly templateContentFingerprint: string
}): boolean {
  return reference.templateId === prescription.templateId
    && reference.version === prescription.templateVersion
    && reference.fingerprint === prescription.templateContentFingerprint
}
