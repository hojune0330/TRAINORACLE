import { z } from "zod"
import { canonicalJsonFingerprint } from "@impl/plan-generator/candidate-identity"
import {
  hasCanonicalJsonTree,
  planBetaStateV2Schema,
  planBetaStateV3Schema,
  progressSchema,
  type PlanBetaStateV2,
  type PlanBetaStateV3,
} from "../plan-beta-schema"
import { readStoredAdjustedPlanState, type StoredAdjustedPlanState } from "../adjusted-plan-storage-schema"
import { readStoredAdjustedPlanStateV5, type StoredAdjustedPlanStateV5 } from "../adjusted-plan-storage-v5-schema"
import { readStoredMultiAdjustedPlanV6, type StoredMultiAdjustedPlanStateV6 } from "../adjusted-plan-storage-v6-schema"
import type { RetainedAdjustedPlanEvidence } from "../selected-adjusted-plan-content"
import type { RetainedAdjustedPlanEvidenceV3 } from "../selected-adjusted-plan-v3"
import type { RetainedMultiAdjustedEvidenceV3 } from "../selected-multi-adjusted-plan-v3"
import { contextSchema, type PlanAdaptationContext } from "../plan-adaptation-context-schema"

export type AccountPlanPacket =
  | { state: PlanBetaStateV2; evidence: null; context?: never }
  | { state: PlanBetaStateV3; evidence: null; context?: PlanAdaptationContext }
  | { state: StoredAdjustedPlanState; evidence: RetainedAdjustedPlanEvidence }
  | { state: StoredAdjustedPlanStateV5; evidence: RetainedAdjustedPlanEvidenceV3 }
  | { state: StoredMultiAdjustedPlanStateV6; evidence: RetainedMultiAdjustedEvidenceV3 }
export type AccountPlanStoredState = AccountPlanPacket["state"]
export const accountPlanFingerprint = (value: unknown) => canonicalJsonFingerprint("trainoracle.account-plan.v1", value)
const exact = (value: unknown, keys: readonly string[]): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value)
  && Reflect.ownKeys(value).length === keys.length && Reflect.ownKeys(value).every(k => typeof k === "string" && keys.includes(k))

/** Transport consistency only. Bundled historical evidence is NOT a trusted registry. */
export function validateAccountPlanPacket(value: unknown): value is AccountPlanPacket {
  try {
    if (!hasCanonicalJsonTree(value) || !(exact(value, ["state", "evidence"]) || exact(value, ["state", "evidence", "context"]))) return false
    const packet = value as AccountPlanPacket, state = packet.state
    if (state.version === 2) {
      return packet.evidence === null && packet.context === undefined
        && planBetaStateV2Schema.safeParse(state).success
    }
    if (state.version === 3) {
      if (packet.evidence !== null || !planBetaStateV3Schema.safeParse(state).success) return false
      if (packet.context !== undefined) {
        const context = contextSchema.safeParse(packet.context)
        if (!context.success || context.data.activeCandidateId !== state.activePlan.candidateId) return false
        const candidate = context.data.candidates.find(c => c.candidateId === state.activePlan.candidateId)
        if (!candidate || candidate.pairId !== state.activePlan.pairId
          || accountPlanFingerprint(candidate.sessions) !== accountPlanFingerprint(state.activePlan.sessions)) return false
      }
      return true
    }
    if ("context" in packet) return false
    if (!exact(packet.evidence, state.version === 6 ? ["slots", "rpeBindings", "policies"] : ["authority", "explanation", "policies"])) return false
    // Each packet carries only its one exact review policy, not unrelated authority packets.
    if (!Array.isArray(packet.evidence.policies) || packet.evidence.policies.length !== 1) return false
    if (state.version === 4) return readStoredAdjustedPlanState(state, [packet.evidence as RetainedAdjustedPlanEvidence]).kind === "loaded"
    if (state.version === 5) return readStoredAdjustedPlanStateV5(state, [packet.evidence as RetainedAdjustedPlanEvidenceV3]).kind === "loaded"
    if (state.version === 6) {
      const evidence = packet.evidence as RetainedMultiAdjustedEvidenceV3
      if (!Array.isArray(evidence.slots) || !evidence.slots.every(s => exact(s, ["address", "authority", "explanation"])
        && exact(s.address, ["day", "slot"]))) return false
      return readStoredMultiAdjustedPlanV6(state, [evidence]).kind === "loaded"
    }
    return false
  } catch { return false }
}

// A predicate, not z.unknown(): every accepted branch must pass its existing full reader.
export const accountPlanPacketSchema = z.custom<AccountPlanPacket>(validateAccountPlanPacket)
const time = z.string().datetime().refine(v => new Date(v).toISOString() === v && Date.parse(v) <= Date.now())
const fingerprint = z.string().regex(/^sha256:[a-f0-9]{64}$/u)
const entrySchema = z.object({
  planId: fingerprint,
  snapshot: accountPlanPacketSchema,
  progress: z.array(progressSchema).max(64),
  updatedAt: time,
  archivedAt: time.nullable(),
}).strict()
export type AccountPlanEntry = z.infer<typeof entrySchema>

/** Recombine progress without modifying the immutable selection or its original provenance. */
export function materializeAccountPlan(entry: AccountPlanEntry): AccountPlanPacket {
  const state = entry.snapshot.state
  if (state.version === 2 || state.version === 3) {
    return { ...entry.snapshot, state: { ...state, progress: [...entry.progress] }, evidence: null } as AccountPlanPacket
  }
  const content = { version: state.version, selection: state.selection, progress: [...entry.progress], updatedAt: entry.updatedAt }
  return { state: { ...content, contentFingerprint: canonicalJsonFingerprint(`trainoracle.adjusted-plan-storage.v${state.version}`, content) },
    evidence: entry.snapshot.evidence } as AccountPlanPacket
}

export function accountPlanEntry(packet: AccountPlanPacket, at = new Date().toISOString()): AccountPlanEntry {
  if (!validateAccountPlanPacket(packet)) throw new Error("Invalid plan packet")
  const generatedAt = packet.state.version === 2 || packet.state.version === 3
    ? packet.state.generatedAt
    : packet.state.selection.generatedAt
  const seed = { snapshot: packet, progress: [], updatedAt: generatedAt } as unknown as AccountPlanEntry
  const snapshot = materializeAccountPlan(seed)
  return entrySchema.parse({ planId: accountPlanFingerprint(snapshot), snapshot,
    progress: packet.state.progress, updatedAt: at, archivedAt: null })
}

export const accountPlanDocumentSchema = z.object({
  version: z.literal(3), state: z.literal("ACCOUNT_STATE"), kind: z.literal("PLAN"),
  data: z.object({ schemaVersion: z.literal(1), currentPlanId: fingerprint.nullable(), plans: z.array(entrySchema).max(100) }).strict(),
}).strict().superRefine((document, ctx) => {
  const invalid = () => ctx.addIssue({ code: "custom", message: "Invalid account plan lineage" })
  const ids = new Set<string>()
  for (const entry of document.data.plans) {
    if (ids.has(entry.planId) || accountPlanFingerprint(entry.snapshot) !== entry.planId || entry.snapshot.state.progress.length !== 0) invalid()
    ids.add(entry.planId)
    const generated = entry.snapshot.state.version === 2 || entry.snapshot.state.version === 3
      ? entry.snapshot.state.generatedAt
      : entry.snapshot.state.selection.generatedAt
    if (entry.updatedAt < generated || (entry.archivedAt !== null && entry.archivedAt < entry.updatedAt)
      || !validateAccountPlanPacket(materializeAccountPlan(entry))) invalid()
  }
  if (document.data.currentPlanId !== null) {
    const current = document.data.plans.filter(p => p.planId === document.data.currentPlanId && p.archivedAt === null)
    if (current.length !== 1 || current[0]!.snapshot.state.version === 2) invalid()
  }
})
export type AccountPlanDocument = z.infer<typeof accountPlanDocumentSchema>
export const ACCOUNT_PLAN_MAX_BYTES = 500_000
export function accountPlanCapacity(value: AccountPlanDocument) {
  const bytes = new TextEncoder().encode(JSON.stringify(value)).byteLength
  return { bytes, limit: ACCOUNT_PLAN_MAX_BYTES, plans: value.data.plans.length,
    exceeded: bytes > ACCOUNT_PLAN_MAX_BYTES || value.data.plans.length > 100 }
}
export function validateAccountPlanDocument(value: unknown): value is AccountPlanDocument {
  try {
    return hasCanonicalJsonTree(value) && new TextEncoder().encode(JSON.stringify(value)).byteLength <= ACCOUNT_PLAN_MAX_BYTES
      && accountPlanDocumentSchema.safeParse(value).success
  } catch { return false }
}
export function emptyAccountPlanDocument(): AccountPlanDocument {
  return { version: 3, state: "ACCOUNT_STATE", kind: "PLAN", data: { schemaVersion: 1, currentPlanId: null, plans: [] } }
}

/** Server update guard: no deleting originals, mutating a snapshot, or resurrecting an archive. */
export function validateAccountPlanDocumentUpdate(previous: unknown, next: unknown): boolean {
  if (!validateAccountPlanDocument(previous) || !validateAccountPlanDocument(next)) return false
  const current = next.data.plans.find(p => p.planId === next.data.currentPlanId)?.snapshot.state
  // Replanning needs the collection gateway's transactional journal-version guard.
  if (previous.data.currentPlanId !== next.data.currentPlanId && current?.version === 3
    && (current.executionReplan || current.catalogReplacement)) return false
  return previous.data.plans.every(old => {
    const newer = next.data.plans.find(p => p.planId === old.planId)
    return !!newer && accountPlanFingerprint(newer.snapshot) === accountPlanFingerprint(old.snapshot)
      && newer.updatedAt >= old.updatedAt && (old.archivedAt === null || accountPlanFingerprint(newer) === accountPlanFingerprint(old))
  })
}

export function validateExecutionReplanTransition(previous: AccountPlanDocument, next: AccountPlanDocument): boolean {
  const selected = next.data.plans.find(p => p.planId === next.data.currentPlanId)
  if (!selected || next.data.currentPlanId === previous.data.currentPlanId) return true
  const after = materializeAccountPlan(selected).state
  if (after.version !== 3 || !(after.executionReplan || after.catalogReplacement)) return true
  const old = previous.data.plans.find(p => p.planId === previous.data.currentPlanId)
  if (!old || old.archivedAt !== null) return false
  const archived = next.data.plans.find(p => p.planId === old.planId)
  if (!archived || archived.archivedAt === null
    || accountPlanFingerprint({ ...archived, archivedAt: null }) !== accountPlanFingerprint(old)) return false
  const before = materializeAccountPlan(old).state, r = (after.executionReplan ?? after.catalogReplacement)!
  if (before.version !== 3 || before.activePlan.selectionActor !== "SELF" || !r.journalGuard) return false
  if (after.catalogReplacement && before.progress.some(progress => progress.state === "PAIN_CHECKIN"
    || progress.sessionDay === after.catalogReplacement!.source.day && progress.sessionSlot === after.catalogReplacement!.source.slot)) return false
  const fp = (v: unknown) => canonicalJsonFingerprint("trainoracle.execution-replan.v1", v)
  if (r.baseStateFingerprint !== fp(before) || r.baseCandidateId !== before.activePlan.candidateId
    || fp(r.baseSessions) !== fp(before.activePlan.sessions) || fp(before.progress) !== fp(after.progress)) return false
  const { explanationReceipt: _oldExplanation, executionReplan: _oldReplan, catalogReplacement: _oldReplacement, activePlan: beforePlan, ...beforeRest } = before
  const { explanationReceipt: unexpectedExplanation, executionReplan: _newReplan, catalogReplacement: _newReplacement, activePlan: afterPlan, ...afterRest } = after
  const { candidateId: _oldId, sessions: _oldSessions, ...beforeMeta } = beforePlan
  const { candidateId: _newId, sessions: _newSessions, ...afterMeta } = afterPlan
  return unexpectedExplanation === undefined && fp(beforeRest) === fp(afterRest) && fp(beforeMeta) === fp(afterMeta)
    && before.progress.every(p => r.protectedSlots.some(s => s.day === p.sessionDay && s.slot === p.sessionSlot))
}
