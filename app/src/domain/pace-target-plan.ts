import {
  calculateGoalReferenceRacePace,
  preparePrescriptionRuntime,
} from "@impl/prescription/runtime"
import type {
  PaceAnchorRecord,
  PrescriptionOperationalComponents,
  PrescriptionErrorCode,
  TemplateRuntimeStatus,
} from "@impl/prescription/types"
import type { SafetyGateDecision } from "@impl/safety-gate/gate"
import type { AthleteRecord } from "./athlete-records"
import {
  toCurrentSnapshot,
  toGoalSnapshot,
  toRuntimeAnchor,
} from "./pace-target-evidence"

export type PaceSelectionFreshness = "CURRENT" | "STALE" | "UNKNOWN"

export type PaceAnchorEvidenceSnapshot = {
  readonly anchorId: string
  readonly kind: "RECENT_RESULT" | "PB" | "SB"
  readonly purpose: "CURRENT_CAPABILITY" | "SEASON_CONTEXT"
  readonly eventDistanceM: number
  readonly performanceSeconds: number
  readonly achievedAt: string
  readonly seasonId: string | null
  readonly enteredBy: "ATHLETE" | "COACH" | "VERIFIED_IMPORT"
  readonly verificationState: "VERIFIED" | "SELF_REPORTED" | "UNVERIFIED"
  readonly freshnessState: "CURRENT"
  readonly sourceRef: string
  readonly elapsedLabel: string
}

export type GoalReferenceEvidenceSnapshot = {
  readonly anchorId: string
  readonly kind: "GOAL"
  readonly purpose: "ASPIRATIONAL_TARGET"
  readonly eventDistanceM: number
  readonly performanceSeconds: number
  readonly enteredBy: "ATHLETE" | "COACH" | "VERIFIED_IMPORT"
  readonly verificationState: "VERIFIED" | "SELF_REPORTED" | "UNVERIFIED"
  readonly freshnessState: "UNKNOWN"
  readonly sourceRef: string
}

export type PaceTargetPlanItem = {
  readonly kind: "PACE_TARGET"
  readonly setCount: number
  readonly repetitionsPerSet: number
  readonly repetitionDistanceM: number
  readonly targetRepSeconds: number
  readonly selectedAnchor: PaceAnchorEvidenceSnapshot
  readonly comparisonAnchor: {
    readonly anchor: PaceAnchorEvidenceSnapshot
    readonly repSeconds: number
    readonly deltaSeconds: number
  } | null
  readonly goalReference: {
    readonly anchor: GoalReferenceEvidenceSnapshot
    readonly repSeconds: number
    readonly displayOnly: true
  } | null
  readonly displayRoundingPolicyVersion: string
  readonly repetitionRecoverySeconds: number | null
  readonly setRecoverySeconds: number | null
}

export type PaceTargetPlanBuildResult =
  | { readonly kind: "created"; readonly item: PaceTargetPlanItem }
  | {
      readonly kind: "fallback"
      readonly code: PrescriptionErrorCode
      readonly guidance: "RPE"
    }
  | { readonly kind: "blocked"; readonly code: "SAFETY_GATE_BLOCKED" }

type PaceTargetPlanBuildInput = {
  readonly selectedRecord: AthleteRecord
  readonly selectedFreshness: PaceSelectionFreshness
  readonly comparison: {
    readonly record: AthleteRecord
    readonly freshness: PaceSelectionFreshness
  } | null
  readonly goalRecord: AthleteRecord | null
  readonly notation: string
  readonly displayRoundingPolicyVersion: string
  readonly template: TemplateRuntimeStatus
  readonly safetyGate: SafetyGateDecision
  readonly operationalComponents: PrescriptionOperationalComponents
  readonly today: Date
}

export function buildPaceTargetPlanItem(
  input: PaceTargetPlanBuildInput,
): PaceTargetPlanBuildResult {
  const selectedAnchor = toRuntimeAnchor(
    input.selectedRecord,
    input.selectedFreshness,
  )
  const prepared = preparePrescriptionRuntime({
    notation: input.notation,
    anchor: selectedAnchor,
    displayRoundingPolicyVersion: input.displayRoundingPolicyVersion,
    template: input.template,
    safetyGate: input.safetyGate,
    operationalComponents: input.operationalComponents,
  })
  if (prepared.kind === "rejected") {
    return prepared.code === "SAFETY_GATE_BLOCKED"
      ? { kind: "blocked", code: prepared.code }
      : { kind: "fallback", code: prepared.code, guidance: "RPE" }
  }

  if (prepared.prescription.repetitionDistanceM === null) {
    return { kind: "fallback", code: "ANCHOR_INCOMPLETE", guidance: "RPE" }
  }
  const snapshot = toCurrentSnapshot(
    input.selectedRecord,
    input.selectedFreshness,
    input.today,
  )
  if (snapshot === null) {
    return {
      kind: "fallback",
      code: "ANCHOR_PROVENANCE_INCOMPLETE",
      guidance: "RPE",
    }
  }

  return {
    kind: "created",
    item: Object.freeze({
      kind: "PACE_TARGET",
      setCount: prepared.prescription.setCount,
      repetitionsPerSet: prepared.prescription.repetitionsPerSet,
      repetitionDistanceM: prepared.prescription.repetitionDistanceM,
      targetRepSeconds: prepared.pace.targetRepSeconds,
      selectedAnchor: snapshot,
      comparisonAnchor: buildComparison(input, prepared.pace.targetRepSeconds),
      goalReference: buildGoalReference(input, prepared.prescription.repetitionDistanceM),
      displayRoundingPolicyVersion: prepared.pace.displayRoundingPolicyVersion,
      repetitionRecoverySeconds: prepared.prescription.repetitionRecoverySeconds,
      setRecoverySeconds: prepared.prescription.setRecoverySeconds,
    }),
  }
}

function buildComparison(
  input: PaceTargetPlanBuildInput,
  selectedRepSeconds: number,
): PaceTargetPlanItem["comparisonAnchor"] {
  if (input.comparison === null || input.comparison.freshness !== "CURRENT") {
    return null
  }
  const anchor = toRuntimeAnchor(input.comparison.record, "CURRENT")
  const prepared = preparePrescriptionRuntime({
    notation: input.notation,
    anchor,
    displayRoundingPolicyVersion: input.displayRoundingPolicyVersion,
    template: input.template,
    safetyGate: input.safetyGate,
    operationalComponents: input.operationalComponents,
  })
  const snapshot = toCurrentSnapshot(
    input.comparison.record,
    "CURRENT",
    input.today,
  )
  if (prepared.kind !== "prepared" || snapshot === null) return null

  return Object.freeze({
    anchor: snapshot,
    repSeconds: prepared.pace.targetRepSeconds,
    deltaSeconds: prepared.pace.targetRepSeconds - selectedRepSeconds,
  })
}

function buildGoalReference(
  input: PaceTargetPlanBuildInput,
  repetitionDistanceM: number,
): PaceTargetPlanItem["goalReference"] {
  if (input.goalRecord?.purpose !== "RACE_GOAL") return null
  const anchor = toRuntimeAnchor(input.goalRecord, "UNKNOWN")
  const calculated = calculateGoalReferenceRacePace({
    anchor,
    targetEventDistanceM: input.selectedRecord.eventDistanceM,
    repetitionDistanceM,
    displayRoundingPolicyVersion: input.displayRoundingPolicyVersion,
  })
  if (calculated.kind !== "calculated-goal-reference") return null

  return Object.freeze({
    anchor: toGoalSnapshot(input.goalRecord),
    repSeconds: calculated.targetRepSeconds,
    displayOnly: true,
  })
}
