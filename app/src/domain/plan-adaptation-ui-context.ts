import { z } from "zod"
import type { PlanCandidate } from "@impl/plan-generator/types"
import type { SafetyGatePassed } from "@impl/safety-gate/gate"
import { RVE_NON_SENSITIVE_REASON_CODES } from "@impl/rve/signal"
import type { AthleteRecord } from "./athlete-records"
import { planAdaptationProposalSchema } from "./plan-beta-schema"
import type { PlanBetaState } from "./plan-beta-schema"
import {
  evaluatePlanSafety,
  type PlanCurrentCheck,
} from "./plan-beta-flow"

export const PLAN_ADAPTATION_CONTEXT_STORAGE_KEY = "trainoracle.plan-adaptation-context.v1"
export const LOCAL_ADAPTATION_ATHLETE_ID = "local-athlete"

const supportedEventSchema = z.union([
  z.literal(800),
  z.literal(1500),
  z.literal(3000),
  z.literal(5000),
])
const contextSchema = z.object({
  version: z.literal(1),
  activeCandidateId: z.string().min(1),
  candidates: z.tuple([
    planAdaptationProposalSchema.shape.baseCandidate,
    planAdaptationProposalSchema.shape.baseCandidate,
  ]),
}).strict().superRefine((context, refinement) => {
  if (!context.candidates.some((candidate) => candidate.candidateId === context.activeCandidateId)) {
    refinement.addIssue({
      code: "custom",
      path: ["activeCandidateId"],
      message: "Active candidate must reference one candidate in this context.",
    })
  }
})

const passedSafetyGateSchema = z.object({
  kind: z.literal("passed"),
  action: z.literal("CONTINUE_WITH_OTHER_GATES"),
  planGenerationAllowed: z.literal(true),
  nonSensitiveReasonCodes: z.array(z.enum(RVE_NON_SENSITIVE_REASON_CODES)).readonly(),
  audit: z.object({
    event: z.literal("PLAN_SAFETY_GATE_PASSED"),
    privacy: z.literal("REASON_CODES_ONLY"),
  }).strict(),
}).strict()

const activePlanAdaptationSafetySchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("blocked"),
    code: z.string().min(1),
  }).strict(),
  z.object({
    kind: z.literal("evaluated"),
    safetyGate: passedSafetyGateSchema,
    safetyEvaluatedAt: z.string().datetime(),
    safetyValidUntil: z.string().datetime(),
    activeHold: z.boolean(),
  }).strict(),
])

export type ActivePlanAdaptationSafety =
  | { readonly kind: "blocked"; readonly code: string }
  | {
      readonly kind: "evaluated"
      readonly safetyGate: SafetyGatePassed
      readonly safetyEvaluatedAt: string
      readonly safetyValidUntil: string
      readonly activeHold: boolean
    }

export function evaluateActivePlanAdaptationSafety(
  state: PlanBetaState,
  currentCheck: PlanCurrentCheck,
  evaluatedAt: Date,
): ActivePlanAdaptationSafety {
  const safety = evaluatePlanSafety(currentCheck, evaluatedAt)
  if (safety.kind === "blocked") return safety
  const timestamp = evaluatedAt.toISOString()
  return {
    kind: "evaluated",
    safetyGate: safety.gate,
    safetyEvaluatedAt: timestamp,
    safetyValidUntil: timestamp,
    activeHold: state.progress.some((progress) => progress.state === "PAIN_CHECKIN"),
  }
}

export function parseActivePlanAdaptationSafety(
  value: unknown,
): ActivePlanAdaptationSafety | null {
  const parsed = activePlanAdaptationSafetySchema.safeParse(value)
  return parsed.success ? parsed.data : null
}

export function adaptationScopeForCandidate(candidate: PlanCandidate) {
  const parsed = supportedEventSchema.safeParse(candidate.eventDistanceM)
  return parsed.success
    ? { athleteId: LOCAL_ADAPTATION_ATHLETE_ID, eventDistanceM: parsed.data }
    : null
}

export function savePlanAdaptationContext(
  candidates: readonly [PlanCandidate, PlanCandidate],
  activeCandidateId: string,
): boolean {
  if (typeof window === "undefined") return false
  const parsed = contextSchema.safeParse({ version: 1, activeCandidateId, candidates })
  if (!parsed.success) return false
  try {
    window.localStorage.setItem(
      PLAN_ADAPTATION_CONTEXT_STORAGE_KEY,
      JSON.stringify(parsed.data),
    )
    return true
  } catch {
    return false
  }
}

export function loadPlanAdaptationContext(activeCandidateId: string) {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(PLAN_ADAPTATION_CONTEXT_STORAGE_KEY)
    if (raw === null) return null
    const parsed = contextSchema.safeParse(JSON.parse(raw) as unknown)
    return parsed.success && parsed.data.activeCandidateId === activeCandidateId
      ? parsed.data
      : null
  } catch {
    return null
  }
}

export function eligiblePbSbRecords(
  state: PlanBetaState,
  records: readonly AthleteRecord[],
): readonly AthleteRecord[] {
  const eventDistanceM = state.adaptationScope?.eventDistanceM
  const startedAt = Date.parse(state.generatedAt)
  if (eventDistanceM === undefined || !Number.isFinite(startedAt)) return []
  return records.filter((record) => (
    (record.purpose === "PERSONAL_BEST" || record.purpose === "SEASON_BEST")
    && record.eventDistanceM === eventDistanceM
    && record.achievedOn !== null
    && Date.parse(`${record.achievedOn}T00:00:00.000Z`) > startedAt
  ))
}
