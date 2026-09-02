import { z } from "zod"
import { canonicalJsonFingerprint } from "@impl/plan-generator/candidate-identity"
import type { PlanSession, PlannedEnergyIntent, PlanSourceMode } from "@impl/plan-generator/types"
import { EXPLANATION_VERSION, TRAINING_EXPLANATION_PROFILES, EXPLANATION_SOURCES } from "./training-explanation-profiles"
import { buildSessionExplanationContent } from "./session-explanation-content"

export type ExplanationPlan = {
  readonly candidateId: string
  readonly eventDistanceM?: number | null
  readonly selectedEnergyIntent: PlannedEnergyIntent
  readonly sourceMode: PlanSourceMode
  readonly frame: { readonly lengthDays: number }
  readonly sessions: readonly PlanSession[]
}

const fingerprint = z.string().regex(/^sha256:[a-f0-9]{64}$/u)
export const explanationReceiptSchema = z.object({
  version: z.literal(1),
  explanationVersion: z.string().regex(/^\d+\.\d+\.\d+$/u),
  capturedAt: z.string().datetime(),
  planFingerprint: fingerprint,
  contentFingerprint: fingerprint,
}).strict()
export type ExplanationReceipt = z.infer<typeof explanationReceiptSchema>

const catalogFingerprint = canonicalJsonFingerprint("training-explanation-content-v1", {
  version: EXPLANATION_VERSION,
  profiles: TRAINING_EXPLANATION_PROFILES,
  sources: EXPLANATION_SOURCES,
})

function contentFingerprint(plan: ExplanationPlan): string {
  // Bind the composed explanation too: changing a sentence must invalidate old receipts.
  return canonicalJsonFingerprint("training-explanation-composed-v1", {
    catalogFingerprint,
    sessions: plan.sessions.map((session) => buildSessionExplanationContent(session, { plan, kind: "CANDIDATE" })),
  })
}

function planFingerprint(plan: ExplanationPlan): string {
  // Explicit projection: no journal, free text, progress or account metadata enters this receipt.
  return canonicalJsonFingerprint("training-explanation-plan-v1", {
    candidateId: plan.candidateId,
    eventDistanceM: plan.eventDistanceM ?? null,
    selectedEnergyIntent: plan.selectedEnergyIntent,
    sourceMode: plan.sourceMode,
    frame: plan.frame,
    sessions: plan.sessions,
  })
}

export function createExplanationReceipt(plan: ExplanationPlan, capturedAt: string): ExplanationReceipt {
  return explanationReceiptSchema.parse({
    version: 1,
    explanationVersion: EXPLANATION_VERSION,
    capturedAt,
    planFingerprint: planFingerprint(plan),
    contentFingerprint: contentFingerprint(plan),
  })
}

export function hasMatchingExplanationReceipt(
  plan: ExplanationPlan,
  generatedAt: string,
  receipt: unknown,
): boolean {
  const parsed = explanationReceiptSchema.safeParse(receipt)
  return parsed.success
    && parsed.data.capturedAt === generatedAt
    && parsed.data.explanationVersion === EXPLANATION_VERSION
    && parsed.data.contentFingerprint === contentFingerprint(plan)
    && parsed.data.planFingerprint === planFingerprint(plan)
}
