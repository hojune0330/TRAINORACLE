import { parseSafetyGate } from "../plan-generator/input-values"
import type { SafetyGateDecision } from "../safety-gate/gate"
import { validatePrescriptionAnchorReference, validateRacePaceAnchor } from "./anchor"
import { parsePrescriptionNotation } from "./notation"
import { calculateRacePaceSeconds } from "./race-pace"
import { derivePrescriptionTotals } from "./totals"
import type {
  PaceAnchorRecord,
  PrescriptionOperationalComponents,
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
  readonly operationalComponents: PrescriptionOperationalComponents
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

const STOP_CODES = [
  "STOP_NEW_OR_WORSENING_PAIN",
  "STOP_DIZZINESS_OR_FAINTNESS",
  "STOP_CHEST_PAIN_OR_UNUSUAL_BREATHING",
  "STOP_LOSS_OF_CONTROLLED_FORM",
] as const

function parseOperationalComponents(value: unknown): PrescriptionOperationalComponents | undefined {
  if (!isRecord(value)) return undefined
  const warmup = value["warmup"]
  const cooldown = value["cooldown"]
  const fallback = value["fallback"]
  const stopConditions = value["stopConditions"]
  if (!isRecord(warmup) || !isRecord(warmup["strides"]) || !isRecord(cooldown) || !isRecord(fallback) || !isRecord(stopConditions)) return undefined
  const strides = warmup["strides"]
  const codes = stopConditions["codes"]
  const usesFiveKilometreComponents = warmup["componentRef"] === "WU-V2-5K-01"
    && cooldown["componentRef"] === "CD-V2-5K-01"
    && stopConditions["componentRef"] === "STOP-V2-5K-01"
  const usesMiddleDistanceComponents = warmup["componentRef"] === "WU-MD-01"
    && cooldown["componentRef"] === "CD-MD-01"
    && stopConditions["componentRef"] === "STOP-MD-01"
  if (!usesFiveKilometreComponents && !usesMiddleDistanceComponents) return undefined

  if (
    warmup["componentVersion"] !== "1.0.0"
    || warmup["authority"] !== "OWNER_OPERATIONAL_ADAPTATION"
    || warmup["easyDurationMinutes"] !== 15
    || warmup["rpeMin"] !== 2
    || warmup["rpeMax"] !== 3
    || strides["repetitions"] !== 4
    || strides["durationSeconds"] !== 20
    || strides["recoverySeconds"] !== 40
    || strides["recoveryMode"] !== "WALK_OR_JOG"
    || strides["progression"] !== "PROGRESSIVE"
    || cooldown["componentVersion"] !== "1.0.0"
    || cooldown["authority"] !== "OWNER_OPERATIONAL_ADAPTATION"
    || cooldown["easyDurationMinutes"] !== 10
    || cooldown["rpeMin"] !== 1
    || cooldown["rpeMax"] !== 2
    || fallback["componentRef"] !== "RPE-ONLY-CONTROLLED-01"
    || fallback["componentVersion"] !== "1.0.0"
    || fallback["code"] !== "RPE_ONLY_CONTROLLED"
    || fallback["behavior"] !== "DELEGATE_TO_EXISTING_RPE_CANDIDATE"
    || fallback["numericRepetitionVariant"] !== null
    || stopConditions["componentVersion"] !== "1.0.0"
    || stopConditions["authority"] !== "OWNER_PRECAUTIONARY_OPERATIONAL_RULE"
    || stopConditions["diagnosticClaim"] !== false
    || !Array.isArray(codes)
    || codes.length !== STOP_CODES.length
    || !STOP_CODES.every((code, index) => codes[index] === code)
  ) return undefined
  return Object.freeze({
    warmup: Object.freeze({
      componentRef: usesFiveKilometreComponents ? "WU-V2-5K-01" : "WU-MD-01", componentVersion: "1.0.0", authority: "OWNER_OPERATIONAL_ADAPTATION",
      easyDurationMinutes: 15, rpeMin: 2, rpeMax: 3,
      strides: Object.freeze({ repetitions: 4, durationSeconds: 20, recoverySeconds: 40, recoveryMode: "WALK_OR_JOG", progression: "PROGRESSIVE" }),
    }),
    cooldown: Object.freeze({
      componentRef: usesFiveKilometreComponents ? "CD-V2-5K-01" : "CD-MD-01", componentVersion: "1.0.0", authority: "OWNER_OPERATIONAL_ADAPTATION",
      easyDurationMinutes: 10, rpeMin: 1, rpeMax: 2,
    }),
    fallback: Object.freeze({
      componentRef: "RPE-ONLY-CONTROLLED-01", componentVersion: "1.0.0", code: "RPE_ONLY_CONTROLLED",
      behavior: "DELEGATE_TO_EXISTING_RPE_CANDIDATE", numericRepetitionVariant: null,
    }),
    stopConditions: Object.freeze({
      componentRef: usesFiveKilometreComponents ? "STOP-V2-5K-01" : "STOP-MD-01", componentVersion: "1.0.0", authority: "OWNER_PRECAUTIONARY_OPERATIONAL_RULE",
      diagnosticClaim: false, codes: Object.freeze([...STOP_CODES]),
    }),
  })
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
  readonly operationalComponents: PrescriptionOperationalComponents
} | undefined {
  if (!isRecord(input)) return undefined
  const notation = parseString(input["notation"])
  const anchor = parsePaceAnchor(input["anchor"])
  const displayRoundingPolicyVersion = parseString(input["displayRoundingPolicyVersion"])
  const template = parseTemplateStatus(input["template"])
  const safetyGate = parseSafetyGate(input["safetyGate"])
  const operationalComponents = parseOperationalComponents(input["operationalComponents"])
  if (
    notation === undefined
    || anchor === undefined
    || displayRoundingPolicyVersion === undefined
    || template === undefined
    || safetyGate === undefined
    || operationalComponents === undefined
  ) {
    return undefined
  }
  return Object.freeze({ notation, anchor, displayRoundingPolicyVersion, template, safetyGate, operationalComponents })
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
      warmupComponent: input.operationalComponents.warmup,
      cooldownComponent: input.operationalComponents.cooldown,
      fallbackComponent: input.operationalComponents.fallback,
      stopConditionComponent: input.operationalComponents.stopConditions,
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
  try {
    return preparePrescriptionRuntimeUnchecked(input)
  } catch {
    return reject("MALFORMED_RUNTIME_INPUT")
  }
}

function preparePrescriptionRuntimeUnchecked(input: unknown): RuntimePreparationResult {
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
    operationalComponents: request.operationalComponents,
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
