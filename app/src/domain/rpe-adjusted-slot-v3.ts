import { z } from "zod"
import type { PlanCandidate } from "@impl/plan-generator/types"
import { canonicalJsonFingerprint } from "@impl/plan-generator/candidate-identity"
import { deriveSequenceV3Totals } from "@impl/prescription/sequence-v3"
import { hasCanonicalJsonTree } from "./plan-beta-schema"
import { resolveQualityCandidateScope } from "./adjusted-plan-candidate"
import { revalidateUnanchoredAdjustedMethodSnapshotV3, type ReviewedAdjustedExplanationV3 } from "./adjusted-method-snapshot-v3"
import type { UnanchoredAdjustmentOfferInputV3 } from "./unanchored-adjustment-offer-v3"

export type RpeAdjustedSlotInputV3 = {
  readonly candidate: PlanCandidate
  readonly address: { readonly day: number; readonly slot: "AM" | "PM" }
  readonly startDate: string
  readonly rawSnapshot: string
  readonly source: UnanchoredAdjustmentOfferInputV3
  readonly explanation: ReviewedAdjustedExplanationV3
  readonly experienceBand: "NEW_TO_RUNNING" | "DEVELOPING" | "EXPERIENCED"
}
const bindingSchema = z.object({ bindingId: z.string().trim().min(1), version: z.string().trim().min(1),
  scopeFingerprint: z.string().regex(/^sha256:[a-f0-9]{64}$/), reviewRef: z.string().trim().min(1),
  validFromMs: z.number().finite(), expiresAtMs: z.number().finite(), revokedAtMs: z.number().finite().nullable(),
}).strict().refine(p => p.validFromMs < p.expiresAtMs)
export type ReviewedRpeSourceBindingV3 = z.infer<typeof bindingSchema>
export const REVIEWED_RPE_SOURCE_BINDINGS_V3: readonly ReviewedRpeSourceBindingV3[] = Object.freeze([])
const hash = (value: unknown) => canonicalJsonFingerprint("trainoracle.rpe-source-binding.v3", value)
const unavailable = (code: string) => ({ kind: "unavailable" as const, code })

/** Structural adoption scope, not an approval factory. Athlete/date identity remains in the snapshot scope. */
export function rpeSourceBindingScopeV3(input: RpeAdjustedSlotInputV3) {
  try {
    const keys = ["candidate", "address", "startDate", "rawSnapshot", "source", "explanation", "experienceBand"]
    if (!hasCanonicalJsonTree(input) || input === null || typeof input !== "object"
      || Reflect.ownKeys(input).length !== keys.length
      || Reflect.ownKeys(input).some(k => typeof k !== "string" || !keys.includes(k))
      || !["NEW_TO_RUNNING", "DEVELOPING", "EXPERIENCED"].includes(input.experienceBand)) return unavailable("INVALID_RPE_SLOT_INPUT")
    const scope = resolveQualityCandidateScope(input.candidate, input.address, input.startDate)
    if (!scope) return unavailable("ORIGINAL_CANDIDATE_OR_SLOT_UNAVAILABLE")
    const original = input.candidate.sessions.find(s => s.day === input.address.day && s.slot === input.address.slot)!
    if (original.role !== "QUALITY" || original.prescription.kind !== "RPE_TIME_RANGE") return unavailable("RPE_MAIN_REQUIRED")
    const checked = revalidateUnanchoredAdjustedMethodSnapshotV3(input.rawSnapshot,
      { source: input.source, scope, explanation: input.explanation })
    if (checked.kind !== "candidate_ready") return checked
    const bindingScope = { kind: "RPE_SOURCE_BINDING_V3" as const,
      eventDistanceM: input.candidate.eventDistanceM, selectedEnergyIntent: input.candidate.selectedEnergyIntent,
      sessionEnergyIntent: original.plannedEnergyIntent, experienceBand: input.experienceBand,
      originalPrescription: original.prescription, source: checked.source }
    return { kind: "scope" as const, scopeFingerprint: hash(bindingScope), bindingScope, scope, original, checked }
  } catch { return unavailable("INVALID_RPE_SLOT_INPUT") }
}

export function prepareRpeAdjustedSlotV3(input: RpeAdjustedSlotInputV3,
  bindings: readonly ReviewedRpeSourceBindingV3[] = REVIEWED_RPE_SOURCE_BINDINGS_V3) {
  try {
    const inspected = rpeSourceBindingScopeV3(input)
    if (inspected.kind !== "scope") return inspected
    if (!hasCanonicalJsonTree(bindings)) return unavailable("INVALID_RPE_BINDING_REGISTRY")
    const parsed = z.array(bindingSchema).safeParse(bindings)
    if (!parsed.success) return unavailable("INVALID_RPE_BINDING_REGISTRY")
    const ids = parsed.data.map(b => JSON.stringify([b.bindingId, b.version]))
    if (new Set(ids).size !== ids.length) return unavailable("AMBIGUOUS_RPE_BINDING")
    const matches = parsed.data.filter(b => b.scopeFingerprint === inspected.scopeFingerprint && b.revokedAtMs === null
      && b.validFromMs <= input.source.nowMs && input.source.nowMs < b.expiresAtMs)
    if (matches.length !== 1) return unavailable(matches.length ? "AMBIGUOUS_RPE_BINDING" : "RPE_SOURCE_BINDING_REVIEW_REQUIRED")
    const binding = matches[0]!, { checked, original, scope } = inspected
    const sequence = checked.snapshot.receipt.after.sequence
    const projection = { kind: "RESOLVED_METHOD_ADJUSTMENT" as const, schemaVersion: 3 as const,
      stage: "CANDIDATE_PROJECTION_ONLY" as const, bridgeVersion: "REVIEWED_RPE_SOURCE_TO_V3@1" as const,
      recordBasis: "NOT_USED" as const, originalPrescription: original.prescription,
      originalBindingFingerprint: hash({ scope, original, binding }),
      source: checked.source, resolutionContextKey: checked.resolutionContextKey,
      sequence, segmentTargets: [] as const, structuralTotals: deriveSequenceV3Totals(sequence),
      targetModel: "REVIEWED_EFFORT_GUIDANCE_V1" as const,
      explanation: { kind: "ADJUSTED_CONFIGURATION_EXPLANATION_REQUIRED" as const, sourceConfiguration: checked.source.to } }
    const sessions = input.candidate.sessions.map(session => session === original
      ? { day: session.day, slot: session.slot, role: "QUALITY" as const, plannedEnergyIntent: session.plannedEnergyIntent,
        prescription: { kind: "ADJUSTED_METHOD_V3" as const, snapshot: checked.snapshot, projection,
          projectionFingerprint: hash(projection) } } : session)
    const c = input.candidate
    const content = { kind: "RPE_ADJUSTED_SLOT_CANDIDATE" as const, schemaVersion: 3 as const,
      activationState: "NOT_ACCEPTED" as const, selectionAuthority: "NONE" as const,
      originalCandidateId: c.candidateId,
      originalContentFingerprint: canonicalJsonFingerprint("trainoracle.adjusted-plan-candidate.v1", c),
      candidateKind: c.kind, eventDistanceM: c.eventDistanceM, selectedEnergyIntent: c.selectedEnergyIntent,
      sourceMode: c.sourceMode, startDate: input.startDate, frame: c.frame, continuityContext: c.continuityContext,
      changedSlot: { ...input.address, ...scope }, sessions,
      rpeBinding: { bindingId: binding.bindingId, version: binding.version, contentFingerprint: hash(binding) },
      requiredNextGate: "MULTI_FULL_PLAN_SELECTION_REVALIDATION" as const }
    return { kind: "prepared" as const, candidate: structuredClone({ ...content, contentFingerprint: hash(content) }) }
  } catch { return unavailable("INVALID_RPE_SLOT_INPUT") }
}
