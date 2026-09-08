import type { PlanCandidate, PlanSession } from "@impl/plan-generator/types"
import { canonicalJsonFingerprint } from "@impl/plan-generator/candidate-identity"
import { hasCanonicalJsonTree, planAdaptationCandidateSchema } from "./plan-beta-schema"
import { revalidateAdjustedMethodSnapshot } from "./adjusted-method-snapshot"
import type { AdjustedMethodSnapshot, ResolvedAdjustedExplanation } from "./adjusted-method-snapshot"
import type { SourceAdjustmentOfferInput } from "./source-adjustment-offer"
import { isValidIsoDate } from "./dates"
import { revalidateAdjustedMethodSnapshotV3 } from "./adjusted-method-snapshot-v3"
import type { ReviewedAdjustedExplanationV3 } from "./adjusted-method-snapshot-v3"
import { resolveAdjustedMethodPrescriptionV3 } from "./adjusted-method-resolution-v3"
import type { PrescriptionSequenceV3 } from "@impl/prescription/sequence-v3"

type Address = { readonly day: number; readonly slot: "AM" | "PM" }
export type AdjustedCandidateSession = PlanSession | {
  readonly day: number
  readonly slot: "AM" | "PM"
  readonly role: "QUALITY"
  readonly plannedEnergyIntent: Extract<PlanSession, { role: "QUALITY" }>["plannedEnergyIntent"]
  readonly prescription: { readonly kind: "ADJUSTED_METHOD"; readonly snapshot: AdjustedMethodSnapshot }
}
const hash = (value: unknown) => canonicalJsonFingerprint("trainoracle.adjusted-plan-candidate.v1", value)
const unavailable = (code: string) => ({ kind: "unavailable" as const, code })
const exactKeys = (value: object, expected: readonly string[]) => Reflect.ownKeys(value).length === expected.length
  && Reflect.ownKeys(value).every(key => typeof key === "string" && expected.includes(key))

/** The owner supplies a fresh original candidate. A saved candidate is not authority. */
export function resolveAdjustedCandidateScope(candidate: PlanCandidate, address: Address, startDate: string) {
  const scope = resolveQualityCandidateScope(candidate, address, startDate)
  if (!scope || candidate.sessions.find(s => s.day === address.day && s.slot === address.slot)?.prescription.kind !== "PACE_TARGET") return null
  return scope
}

export function resolveQualityCandidateScope(candidate: PlanCandidate, address: Address, startDate: string) {
  if (!hasCanonicalJsonTree(candidate) || !hasCanonicalJsonTree(address) || address === null || typeof address !== "object"
      || !exactKeys(address, ["day", "slot"]) || typeof startDate !== "string" || !isValidIsoDate(startDate)) return null
  const parsed = planAdaptationCandidateSchema.safeParse(candidate)
  if (!parsed.success) return null
  const sessions = parsed.data.sessions.filter(session => session.day === address.day && session.slot === address.slot)
  if (sessions.length !== 1 || sessions[0]?.role !== "QUALITY") return null
  const candidateLineageId = hash({ originalCandidateId: candidate.candidateId, originalContent: hash(candidate), startDate })
  return { candidateLineageId, mainSlotId: hash({ candidateLineageId, ...address }) }
}

/** Staged representation for downstream UI/storage integration, never an active
 * PlanCandidate accepted by the existing flat-prescription selection API.
 */
export function prepareAdjustedPlanCandidate(input: {
  readonly candidate: PlanCandidate
  readonly address: Address
  readonly startDate: string
  readonly rawSnapshot: string
  readonly source: SourceAdjustmentOfferInput
  readonly explanation: ResolvedAdjustedExplanation
}) {
  try {
    if (!hasCanonicalJsonTree(input) || !exactKeys(input, ["candidate", "address", "startDate", "rawSnapshot", "source", "explanation"])) {
      return unavailable("INVALID_CANDIDATE_ADJUSTMENT")
    }
    const scope = resolveAdjustedCandidateScope(input.candidate, input.address, input.startDate)
    if (scope === null) return unavailable("ORIGINAL_CANDIDATE_OR_SLOT_UNAVAILABLE")
    const checked = revalidateAdjustedMethodSnapshot(input.rawSnapshot, { source: input.source, scope, explanation: input.explanation })
    if (checked.kind !== "candidate_ready") return checked
    const originalSession = input.candidate.sessions.find(session => session.day === input.address.day && session.slot === input.address.slot)!
    if (hash(originalSession.prescription) !== hash(checked.snapshot.original)) return unavailable("ORIGINAL_PRESCRIPTION_MISMATCH")
    const sessions: readonly AdjustedCandidateSession[] = input.candidate.sessions.map(session => {
      if (session !== originalSession) return session
      if (session.role !== "QUALITY") throw Error("Expected validated quality session")
      return { day: session.day, slot: session.slot, role: session.role, plannedEnergyIntent: session.plannedEnergyIntent,
        prescription: { kind: "ADJUSTED_METHOD", snapshot: checked.snapshot } }
    })
    const content = {
      kind: "ADJUSTED_PLAN_CANDIDATE" as const, schemaVersion: 1 as const,
      activationState: "NOT_ACCEPTED" as const, selectionAuthority: "NONE" as const,
      originalCandidateId: input.candidate.candidateId, originalContentFingerprint: hash(input.candidate),
      candidateKind: input.candidate.kind, eventDistanceM: input.candidate.eventDistanceM,
      selectedEnergyIntent: input.candidate.selectedEnergyIntent, sourceMode: input.candidate.sourceMode,
      startDate: input.startDate, frame: input.candidate.frame, continuityContext: input.candidate.continuityContext,
      changedSlot: { ...input.address, ...scope }, sessions,
      requiredNextGate: "FULL_PLAN_SELECTION_REVALIDATION" as const,
    }
    return { kind: "prepared" as const, candidate: structuredClone({ ...content, contentFingerprint: hash(content) }) }
  } catch { return unavailable("INVALID_CANDIDATE_ADJUSTMENT") }
}

/** V3 stays a distinct candidate format until the version-aware selection/store
 * accepts it. Reuse the current whole-candidate scope and original slot checks.
 */
export function prepareAdjustedPlanCandidateV3(input: {
  readonly candidate: PlanCandidate
  readonly address: Address
  readonly startDate: string
  readonly rawSnapshot: string
  readonly source: SourceAdjustmentOfferInput<PrescriptionSequenceV3>
  readonly explanation: ReviewedAdjustedExplanationV3
}) {
  try {
    if (!hasCanonicalJsonTree(input) || !exactKeys(input, ["candidate", "address", "startDate", "rawSnapshot", "source", "explanation"])) {
      return unavailable("INVALID_CANDIDATE_ADJUSTMENT")
    }
    const scope = resolveAdjustedCandidateScope(input.candidate, input.address, input.startDate)
    if (scope === null) return unavailable("ORIGINAL_CANDIDATE_OR_SLOT_UNAVAILABLE")
    const checked = revalidateAdjustedMethodSnapshotV3(input.rawSnapshot, { source: input.source, scope, explanation: input.explanation })
    if (checked.kind !== "candidate_ready") return checked
    const original = input.candidate.sessions.find(s => s.day === input.address.day && s.slot === input.address.slot)!
    const resolved = resolveAdjustedMethodPrescriptionV3({ original: original.prescription,
      source: input.source, receipt: checked.snapshot.receipt })
    if (resolved.kind !== "resolved") return resolved
    const sessions = input.candidate.sessions.map(session => {
      if (session !== original) return session
      if (session.role !== "QUALITY") throw Error("Expected validated quality session")
      return { day: session.day, slot: session.slot, role: session.role, plannedEnergyIntent: session.plannedEnergyIntent,
        prescription: { kind: "ADJUSTED_METHOD_V3" as const, snapshot: checked.snapshot, projection: resolved.projection,
          projectionFingerprint: resolved.contentFingerprint } }
    })
    const content = { kind: "ADJUSTED_PLAN_CANDIDATE" as const, schemaVersion: 3 as const,
      activationState: "NOT_ACCEPTED" as const, selectionAuthority: "NONE" as const,
      originalCandidateId: input.candidate.candidateId, originalContentFingerprint: hash(input.candidate),
      candidateKind: input.candidate.kind, eventDistanceM: input.candidate.eventDistanceM,
      selectedEnergyIntent: input.candidate.selectedEnergyIntent, sourceMode: input.candidate.sourceMode,
      startDate: input.startDate, frame: input.candidate.frame, continuityContext: input.candidate.continuityContext,
      changedSlot: { ...input.address, ...scope }, sessions, requiredNextGate: "FULL_PLAN_SELECTION_REVALIDATION" as const }
    return { kind: "prepared" as const, candidate: structuredClone({ ...content,
      contentFingerprint: canonicalJsonFingerprint("trainoracle.adjusted-plan-candidate.v3", content) }) }
  } catch { return unavailable("INVALID_CANDIDATE_ADJUSTMENT") }
}

export type AdjustedPlanCandidateV3 = Extract<ReturnType<typeof prepareAdjustedPlanCandidateV3>, { kind: "prepared" }>["candidate"]
