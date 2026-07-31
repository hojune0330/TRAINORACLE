import { parseSafetyGate } from "../plan-generator/input-values"
import type { SafetyGateDecision } from "../safety-gate/gate"
import { validatePrescriptionAnchorReference, validateRacePaceAnchor } from "./anchor"
import { parsePrescriptionNotation } from "./notation"
import { calculateRacePaceSeconds } from "./race-pace"
import { derivePrescriptionTotals } from "./totals"
import type {
  PaceAnchorRecord,
  PrescriptionErrorCode,
  RacePaceCalculationResult,
  StructuredPrescription,
  StructuredPrescriptionResult,
  TemplateRuntimeStatus,
  UnboundPrescriptionNotation,
} from "./types"

type StructuredPrescriptionInput = {
  readonly notation: UnboundPrescriptionNotation
  readonly anchor: PaceAnchorRecord
  readonly displayRoundingPolicyVersion: string
}

type RuntimePreparationResult =
  | {
      readonly kind: "prepared"
      readonly prescription: StructuredPrescription
      readonly totals: ReturnType<typeof derivePrescriptionTotals>
      readonly pace: Extract<RacePaceCalculationResult, { readonly kind: "calculated" }>
    }
  | {
      readonly kind: "rejected"
      readonly code: PrescriptionErrorCode
    }

function reject(code: PrescriptionErrorCode): RuntimePreparationResult {
  return { kind: "rejected", code }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function parseString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined
}

function parseNullableString(value: unknown): string | null | undefined {
  return value === null || typeof value === "string" ? value : undefined
}

function parseNullablePositiveNumber(value: unknown): number | null | undefined {
  return value === null || (typeof value === "number" && Number.isFinite(value) && value > 0)
    ? value
    : undefined
}

function parsePaceAnchor(value: unknown): PaceAnchorRecord | undefined {
  if (!isRecord(value)) return undefined
  const anchorId = parseString(value["anchorId"])
  const eventDistanceM = parseNullablePositiveNumber(value["eventDistanceM"])
  const performanceSeconds = parseNullablePositiveNumber(value["performanceSeconds"])
  const achievedAt = parseNullableString(value["achievedAt"])
  const seasonId = parseNullableString(value["seasonId"])
  const sourceRef = parseString(value["sourceRef"])
  if (
    anchorId === undefined
    || eventDistanceM === undefined
    || performanceSeconds === undefined
    || achievedAt === undefined
    || seasonId === undefined
    || sourceRef === undefined
  ) {
    return undefined
  }

  const kind = value["kind"]
  const enteredBy = value["enteredBy"]
  const verificationState = value["verificationState"]
  const freshnessState = value["freshnessState"]
  const purpose = value["purpose"]
  if (
    (kind !== "RECENT_RESULT" && kind !== "PB" && kind !== "SB" && kind !== "GOAL" && kind !== "COACH_REFERENCE" && kind !== "RPE_ONLY" && kind !== "SPRINT_BENCHMARK")
    || (enteredBy !== "ATHLETE" && enteredBy !== "COACH" && enteredBy !== "VERIFIED_IMPORT")
    || (verificationState !== "VERIFIED" && verificationState !== "SELF_REPORTED" && verificationState !== "UNVERIFIED")
    || (freshnessState !== "CURRENT" && freshnessState !== "STALE" && freshnessState !== "UNKNOWN")
    || (purpose !== "CURRENT_CAPABILITY" && purpose !== "SEASON_CONTEXT" && purpose !== "ASPIRATIONAL_TARGET" && purpose !== "SPRINT_REFERENCE" && purpose !== "EFFORT_ONLY")
  ) {
    return undefined
  }

  return Object.freeze({
    anchorId,
    kind,
    eventDistanceM,
    performanceSeconds,
    achievedAt,
    seasonId,
    enteredBy,
    sourceRef,
    verificationState,
    freshnessState,
    purpose,
  })
}

function parseTemplateStatus(value: unknown): TemplateRuntimeStatus | undefined {
  if (!isRecord(value)) return undefined
  const lifecycleStatus = value["lifecycleStatus"]
  const eligibilityStatus = value["eligibilityStatus"]
  if (
    (lifecycleStatus !== "DRAFT" && lifecycleStatus !== "ACTIVE")
    || (eligibilityStatus !== "REVIEW_REQUIRED" && eligibilityStatus !== "ELIGIBLE")
  ) {
    return undefined
  }
  return Object.freeze({ lifecycleStatus, eligibilityStatus })
}

function parseRuntimeRequest(input: unknown): {
  readonly notation: string
  readonly anchor: PaceAnchorRecord
  readonly displayRoundingPolicyVersion: string
  readonly template: TemplateRuntimeStatus
  readonly safetyGate: SafetyGateDecision
} | undefined {
  if (!isRecord(input)) return undefined
  const notation = parseString(input["notation"])
  const anchor = parsePaceAnchor(input["anchor"])
  const displayRoundingPolicyVersion = parseString(input["displayRoundingPolicyVersion"])
  const template = parseTemplateStatus(input["template"])
  const safetyGate = parseSafetyGate(input["safetyGate"])
  if (
    notation === undefined
    || anchor === undefined
    || displayRoundingPolicyVersion === undefined
    || template === undefined
    || safetyGate === undefined
  ) {
    return undefined
  }
  return Object.freeze({ notation, anchor, displayRoundingPolicyVersion, template, safetyGate })
}

export function createStructuredPrescription(
  input: StructuredPrescriptionInput,
): StructuredPrescriptionResult {
  const anchorError = validateRacePaceAnchor({
    anchor: input.anchor,
    targetEventDistanceM: input.notation.paceTargetEventDistanceM,
  })
  if (anchorError !== undefined || input.displayRoundingPolicyVersion.length === 0) {
    return { kind: "rejected", code: anchorError ?? "ANCHOR_INCOMPLETE" }
  }
  return {
    kind: "created",
    prescription: Object.freeze({
      kind: "STRUCTURED_PRESCRIPTION",
      setCount: input.notation.setCount,
      repetitionsPerSet: input.notation.repetitionsPerSet,
      repetitionDistanceM: input.notation.repetitionDistanceM,
      repetitionDurationSeconds: input.notation.repetitionDurationSeconds,
      paceAnchorRef: input.anchor.anchorId,
      paceTargetKind: input.notation.paceTargetKind,
      paceTargetEventDistanceM: input.notation.paceTargetEventDistanceM,
      displayRoundingPolicyVersion: input.displayRoundingPolicyVersion,
      repetitionRecoverySeconds: input.notation.repetitionRecoverySeconds,
      repetitionRecoveryMode: input.notation.repetitionRecoveryMode,
      setRecoverySeconds: input.notation.setRecoverySeconds,
      setRecoveryMode: input.notation.setRecoveryMode,
      warmupComponentRef: null,
      cooldownComponentRef: null,
      downshiftOptionRefs: Object.freeze([]),
      stopConditionCodes: Object.freeze([]),
    }),
  }
}

export function calculateSameEventRacePace(
  input: {
    readonly prescription: StructuredPrescription
    readonly anchor: PaceAnchorRecord
  },
): RacePaceCalculationResult {
  const anchorError = validatePrescriptionAnchorReference(input)
  if (anchorError !== undefined) return { kind: "rejected", code: anchorError }
  if (input.prescription.repetitionDistanceM === null || input.anchor.eventDistanceM === null || input.anchor.performanceSeconds === null) {
    return { kind: "rejected", code: "ANCHOR_INCOMPLETE" }
  }
  return {
    kind: "calculated",
    targetRepSeconds: calculateRacePaceSeconds({
      performanceSeconds: input.anchor.performanceSeconds,
      repetitionDistanceM: input.prescription.repetitionDistanceM,
      eventDistanceM: input.anchor.eventDistanceM,
    }),
    displayRoundingPolicyVersion: input.prescription.displayRoundingPolicyVersion,
  }
}

export function preparePrescriptionRuntime(input: unknown): RuntimePreparationResult {
  const request = parseRuntimeRequest(input)
  if (request === undefined) return reject("MALFORMED_RUNTIME_INPUT")
  if (request.safetyGate.kind === "blocked") return reject("SAFETY_GATE_BLOCKED")
  if (request.template.lifecycleStatus !== "ACTIVE") return reject("TEMPLATE_NOT_ACTIVE")
  if (request.template.eligibilityStatus !== "ELIGIBLE") return reject("TEMPLATE_NOT_ELIGIBLE")

  const parsed = parsePrescriptionNotation(request.notation)
  if (parsed.kind === "rejected") return reject(parsed.code)
  const created = createStructuredPrescription({
    notation: parsed.notation,
    anchor: request.anchor,
    displayRoundingPolicyVersion: request.displayRoundingPolicyVersion,
  })
  if (created.kind === "rejected") return reject(created.code)
  const pace = calculateSameEventRacePace({ prescription: created.prescription, anchor: request.anchor })
  if (pace.kind === "rejected") return reject(pace.code)

  return Object.freeze({
    kind: "prepared",
    prescription: created.prescription,
    totals: derivePrescriptionTotals(parsed.notation),
    pace,
  })
}

export { calculateGoalReferenceRacePace } from "./race-pace"
