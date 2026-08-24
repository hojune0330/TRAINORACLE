import type {
  DetailedTemplateRef,
  PlanBetaAudit,
  PlanCandidateKind,
  PlanProgressState,
  PlanSourceMode,
  PlannedEnergyIntent,
} from "./types"
import type { PlanFrame, PlanSession, PlanSessionSlot } from "./session-types"
import type { SafetyGateDecision } from "../safety-gate/gate"

export type BetaActivePlanSnapshot = {
  readonly kind: "BETA_ACTIVE_PLAN_SNAPSHOT"
  readonly activationState: "SELECTED_BETA_SNAPSHOT"
  readonly candidateId: string
  readonly pairId: string
  readonly candidateKind: PlanCandidateKind
  readonly eventDistanceM: import("./types").SupportedPlanEventDistanceM
  readonly selectedDetailedTemplateRef: DetailedTemplateRef | null
  readonly selectionActor: "SELF" | "COACH"
  readonly sourceMode: PlanSourceMode
  readonly selectedEnergyIntent: PlannedEnergyIntent
  readonly frame: PlanFrame
  readonly sessions: readonly PlanSession[]
}

export type PlanSelectionRequest = {
  readonly kind: "PLAN_BETA_SELECTION_REQUEST"
  readonly generatedPlan: import("./types").PlanGenerationSuccess
  readonly selectedCandidateId: string
  readonly actor: "SELF" | "COACH"
  readonly safetyGate: SafetyGateDecision
}

export type PlanSelectionResult =
  | {
      readonly kind: "selected"
      readonly activePlan: BetaActivePlanSnapshot
      readonly audit: PlanBetaAudit
    }
  | {
      readonly kind: "blocked"
      readonly code: "SAFETY_GATE_RECHECK_BLOCKED"
      readonly audit: PlanBetaAudit
    }
  | {
      readonly kind: "rejected"
      readonly code:
        | "COACH_SELECTION_REQUIRED"
        | "CANDIDATE_NOT_FOUND"
        | "INVALID_SELECTION_REQUEST"
        | "NON_SELECTABLE_PLAN_RESULT"
        | "STALE_CANDIDATE_FINGERPRINT"
        | "NONCANONICAL_CANDIDATE_FRAME"
      readonly audit: PlanBetaAudit
    }

export type PlanProgressRequest = {
  readonly kind: "PLAN_BETA_PROGRESS_REQUEST"
  readonly activePlan: BetaActivePlanSnapshot
  readonly sessionDay: number
  readonly sessionSlot: PlanSessionSlot
  readonly state: PlanProgressState
}

export type PlanProgressResult =
  | {
      readonly kind: "recorded"
      readonly progress: {
        readonly activePlanCandidateId: string
        readonly sessionDay: number
        readonly sessionSlot: PlanSessionSlot
        readonly state: PlanProgressState
      }
      readonly audit: PlanBetaAudit
    }
  | {
      readonly kind: "rejected"
      readonly code:
        | "SESSION_DAY_NOT_IN_ACTIVE_PLAN"
        | "SESSION_SLOT_NOT_IN_ACTIVE_PLAN"
      readonly audit: PlanBetaAudit
    }
