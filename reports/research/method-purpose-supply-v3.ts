import { canonicalJsonFingerprint } from "../../impl/src/plan-generator/candidate-identity"
import { compareMainMethodsV3 } from "../../impl/src/prescription/sequence-v3-comparison"
import { sequenceNotation } from "../../app/src/domain/workout-notation"
import { METHOD_ADOPTION_PROTOCOLS, METHOD_ADOPTION_VARIANTS, assembleProposalSession, expandProposal } from "./method-adoption-protocols.mjs"
import { PROPOSED_METHOD_SCOPES } from "./method-adoption-applicability.mjs"
import { previewPendingMethodExplanation } from "./method-explanation-preview-v3"
import { sourceAssessmentFor } from "./method-source-assessments-v3"
import type { PendingMethodProtocol } from "./method-proposal-sequence-v3"

const families = ["BASE", "LT", "VO2", "ATP-PC", "GLY", "MIX", "REC", "OFF"] as const
type Family = typeof families[number]
const events = [800, 1500, 3000, 5000, 10000, 21097, 42195] as const
const experiences = ["NEW_TO_RUNNING", "DEVELOPING", "EXPERIENCED"] as const

const methodNames: Record<string, string> = {
  CONTINUOUS: "이어 달리기", WALK_BREAKS: "걷기를 섞은 달리기", LONG_SPLIT: "긴 구간 크루즈 인터벌",
  SHORT_SPLIT: "짧은 구간 크루즈 인터벌", TWO_MINUTE: "인터벌 · Intervals", THREE_MINUTE: "인터벌 · Intervals", FOUR_MINUTE: "인터벌 · Intervals",
  STANDING_ACCELERATION: "서서 출발하는 가속 달리기", FLYING_SEGMENT: "플라잉 스프린트", TIMED_ACCELERATION: "시간형 가속 달리기",
  UNBROKEN_REPEATS: "고강도 거리 반복", SET_REPEATS: "세트형 고강도 거리 반복", ROLL_ON_400: "거리형 리듬 달리기",
  ROLL_ON_SETS_300: "세트형 거리 리듬 달리기", TIMED_RHYTHM: "시간형 리듬 달리기", TIMED_RHYTHM_SETS: "세트형 시간 리듬 달리기",
  WALK: "회복 걷기", NO_PLANNED_EXERCISE: "휴식",
}

function makeCard(protocol: PendingMethodProtocol) {
  const p = structuredClone(protocol)
  const parentId = "parentId" in p && typeof p.parentId === "string" ? p.parentId : null
  const scope = PROPOSED_METHOD_SCOPES.filter(s => s.id === (parentId ?? p.id))
  if (scope.length !== 1 || scope[0]?.status !== "OWNER_ADOPTION_PENDING"
    || !families.includes(p.family as Family)) throw Error("EXACT_PROPOSED_SCOPE_REQUIRED")
  const explanation = previewPendingMethodExplanation(p)
  const representation = explanation.exactStructure.representation
  const sequence = representation.kind === "represented"
    ? { ...representation.sequence, warmup: [], cooldown: [] } : null
  const parts = expandProposal(p)
  const mainSeconds = parts.filter(part => part.unit === "SECONDS").reduce((sum, part) => sum + part.value, 0)
  const distanceParts = parts.filter(part => part.unit === "METERS")
  const exactMainSeconds = distanceParts.length || p.family === "OFF" ? null : mainSeconds
  const design = explanation.methodDesign
  const name = p.method === "CONTINUOUS" ? p.family === "LT" ? "템포런 · Tempo Run" : "저강도 달리기 · Easy Run"
    : methodNames[p.method]
  if (!name) throw Error("MISSING_METHOD_NAME")
  const qualification = p.id.startsWith("P-INTRO-GLY-") ? "HOLD_FIRST_RELEASE" as const
    : p.id.startsWith("P-INTRO-") || p.family === "GLY" ? "MODIFY_BEFORE_ADOPTION" as const : "CONTENT_REVIEW_CANDIDATE" as const
  const content = {
    id: p.id, version: "1.0.0", parentId, family: p.family as Family, method: p.method, name,
    kind: "PURPOSE_SUPPLY_REVIEW_CARD" as const, executionAuthority: "NONE" as const,
    scope: structuredClone(scope[0]!), sequence, sequenceScope: "MAIN_ONLY" as const,
    notation: sequence ? sequenceNotation(sequence) : "계획된 운동 없음",
    exactStructure: { ...structuredClone(p), knownMainSeconds: mainSeconds, exactMainSeconds,
      workMeters: parts.some(part => part.role === "WORK" && part.unit === "METERS")
        ? parts.filter(part => part.role === "WORK" && part.unit === "METERS").reduce((sum, part) => sum + part.value, 0) : null,
      distanceParts: distanceParts.length },
    requires: { measuredDistance: distanceParts.length > 0, repetitionTimer: p.family !== "OFF" && parts.some(part => part.unit === "SECONDS"),
      accelerationSpace: p.family === "ATP-PC", terrain: "FLAT_REVIEW_ONLY" as const },
    explanation: {
      sourceFingerprint: explanation.contentFingerprint,
      purpose: explanation.generalExplanation.profile.purpose,
      energySupply: explanation.generalExplanation.profile.energyContext,
      work: design.work, recovery: design.recovery, tradeoff: design.tradeoff,
      expected: explanation.generalExplanation.profile.expectedAdaptation,
      limitations: explanation.generalExplanation.profile.limitations,
      observation: explanation.generalExplanation.profile.observationGuide,
      generalSources: explanation.generalExplanation.sources,
      sources: sourceAssessmentFor(p),
      personalEvidence: [] as never[],
      cycleRole: "주기 배치는 아직 연결하지 않았어요. 특정 날짜나 앞뒤 훈련을 이 카드만으로 정하지 않아요.",
    },
    qualification,
    unresolved: ["EXACT_OWNER_CONTENT_ADOPTION", "EXACT_FRAME_PLACEMENT", "SUPPORT_BINDING", "CURRENT_SAFETY_AND_AUTHORITY",
      ...(p.family === "GLY" ? ["INDIVIDUAL_OUTPUT_AND_RECOVERY_REVIEW"] : []),
      ...(p.id.startsWith("P-INTRO-") ? ["INTRO_WORK_AND_SUPPORT_APPLICABILITY"] : [])],
  }
  return { ...content, contentFingerprint: canonicalJsonFingerprint("trainoracle.purpose-supply-review.v1", content) }
}

/** Compose existing proposals; never import this registry into the live app. */
export function buildPurposeSupplyCatalog() {
  const rows = [...METHOD_ADOPTION_PROTOCOLS, ...METHOD_ADOPTION_VARIANTS].map(makeCard)
  if (new Set(rows.map(row => row.id)).size !== rows.length) throw Error("DUPLICATE_PROTOCOL")
  return rows
}
export type PurposeSupplyCard = ReturnType<typeof makeCard>

export type PurposeSupplyContext = {
  family: Family; eventDistanceM: number; experience: typeof experiences[number]; population: "YOUTH" | "ADULT";
  actor: "SELF" | "COACH_REQUIRED"; role: "MAIN" | "BASE" | "REC" | "OFF";
  safety: "NO_KNOWN_RISK" | "REVIEW_REQUIRED" | "UNKNOWN";
  phase: "BUILD" | "TAPER" | "RETURN" | "UNKNOWN";
  terrain: "FLAT" | "HILL" | "UNKNOWN";
  measuredDistance: boolean | null; repetitionTimer: boolean | null; accelerationSpace: boolean | null;
  hardTimeLimitSeconds: number | null; support: "EXISTING" | "INTRO_COMPARISON" | "UNSELECTED";
  otherQualitySameDay: boolean | null; wantsPersonalPace: boolean;
}

function validContext(c: PurposeSupplyContext): boolean {
  return !!c && families.includes(c.family) && (events as readonly number[]).includes(c.eventDistanceM)
    && experiences.includes(c.experience) && ["YOUTH", "ADULT"].includes(c.population)
    && ["SELF", "COACH_REQUIRED"].includes(c.actor) && ["MAIN", "BASE", "REC", "OFF"].includes(c.role)
    && ["NO_KNOWN_RISK", "REVIEW_REQUIRED", "UNKNOWN"].includes(c.safety)
    && ["BUILD", "TAPER", "RETURN", "UNKNOWN"].includes(c.phase) && ["FLAT", "HILL", "UNKNOWN"].includes(c.terrain)
    && ["EXISTING", "INTRO_COMPARISON", "UNSELECTED"].includes(c.support)
    && [c.measuredDistance, c.repetitionTimer, c.accelerationSpace, c.otherQualitySameDay].every(v => v === null || typeof v === "boolean")
    && typeof c.wantsPersonalPace === "boolean"
    && (c.hardTimeLimitSeconds === null || Number.isSafeInteger(c.hardTimeLimitSeconds) && c.hardTimeLimitSeconds > 0)
}

export function reviewPurposeSupply(context: PurposeSupplyContext) {
  if (!validContext(context)) return { kind: "invalid_context" as const, executionAuthority: "NONE" as const, rows: [] }
  const rows = buildPurposeSupplyCatalog().filter(card => card.family === context.family).map(card => {
    const excluded: string[] = [], checks: string[] = []
    if (!card.scope.eventDistances.includes(context.eventDistanceM)) excluded.push("EVENT_OUTSIDE_PROPOSAL")
    if (!card.scope.experience.includes(context.experience)) excluded.push("EXPERIENCE_OUTSIDE_PROPOSAL")
    if (!card.scope.population.includes(context.population)) excluded.push("POPULATION_OUTSIDE_PROPOSAL")
    if (!card.scope.actor.includes(context.actor)) excluded.push("ACTOR_OUTSIDE_PROPOSAL")
    if (card.scope.replacementRole !== context.role) excluded.push("ROLE_MISMATCH")
    if (context.safety === "REVIEW_REQUIRED") excluded.push("SAFETY_REVIEW_REQUIRED")
    if (context.safety === "UNKNOWN") checks.push("SAFETY_UNKNOWN")
    if (card.family !== "OFF") {
      if (context.terrain === "HILL") excluded.push("HILL_SPECIFIC_PROTOCOL_REQUIRED")
      if (context.terrain === "UNKNOWN") checks.push("TERRAIN_UNCONFIRMED")
      for (const [required, available, label] of [
        [card.requires.measuredDistance, context.measuredDistance, "MEASURED_DISTANCE"],
        [card.requires.repetitionTimer, context.repetitionTimer, "TIMER"],
        [card.requires.accelerationSpace, context.accelerationSpace, "ACCELERATION_SPACE"],
      ] as const) if (required) {
        if (available === false) excluded.push(`${label}_UNAVAILABLE`)
        if (available === null) checks.push(`${label}_UNCONFIRMED`)
      }
    }
    const supportNeeded = card.scope.replacementRole === "MAIN"
    let supportSeconds: number | null = supportNeeded ? null : 0
    let wholeSession: ReturnType<typeof assembleProposalSession> | null = supportNeeded ? null : assembleProposalSession(card.exactStructure)
    if (supportNeeded && context.support !== "UNSELECTED") {
      if (context.support === "INTRO_COMPARISON" && !card.id.startsWith("P-INTRO-")) excluded.push("SUPPORT_SCOPE_MISMATCH")
      else {
        wholeSession = assembleProposalSession(card.exactStructure, context.support)
        supportSeconds = wholeSession.supportSeconds
      }
    }
    if (supportNeeded && supportSeconds === null) checks.push("SUPPORT_UNSELECTED")
    const knownSeconds = card.exactStructure.knownMainSeconds + (supportSeconds ?? 0)
    const totalSeconds = card.exactStructure.exactMainSeconds === null || supportSeconds === null ? null
      : card.exactStructure.exactMainSeconds + supportSeconds
    const timeFit = card.family === "OFF" ? "NOT_APPLICABLE" as const
      : context.hardTimeLimitSeconds === null ? "NO_DECLARED_LIMIT" as const
        : knownSeconds > context.hardTimeLimitSeconds ? "EXCEEDS_LIMIT" as const
          : totalSeconds === null ? "UNRESOLVED" as const : "FITS_DECLARED_LIMIT" as const
    if (timeFit === "EXCEEDS_LIMIT") excluded.push("WHOLE_SESSION_EXCEEDS_HARD_LIMIT")
    if (timeFit === "UNRESOLVED") checks.push("WHOLE_SESSION_DURATION_UNKNOWN")
    if (card.qualification === "HOLD_FIRST_RELEASE") excluded.push("HELD_FROM_FIRST_RELEASE")
    if (card.qualification === "MODIFY_BEFORE_ADOPTION") checks.push("CONTENT_MODIFICATION_REVIEW")
    if (context.phase !== "BUILD") checks.push(`${context.phase}_PLACEMENT_REVIEW`)
    if (context.role === "MAIN" && context.otherQualitySameDay !== false) checks.push("SAME_DAY_QUALITY_CONTEXT_REVIEW")
    if (context.wantsPersonalPace && card.family !== "OFF") checks.push("PERSONAL_PACE_MODEL_NOT_ADOPTED")
    if (context.actor === "COACH_REQUIRED") checks.push("ASSIGNED_COACH_SELECTION_REQUIRED")
    return { card, wholeSession, excluded, checks, time: { timeFit, totalSeconds, knownSeconds, supportSeconds },
      contextFit: excluded.length ? "EXCLUDED" as const : checks.length ? "REQUIRES_CONTEXT_REVIEW" as const : "DECLARED_CONSTRAINTS_MATCH" as const,
      // Matching declared constraints is not readiness, approval, an automatic suggestion or a dose increase.
      runtimeReady: false as const, executionAuthority: "NONE" as const,
      reasons: ["SELECTED_PURPOSE_ONLY", "EXACT_WORK_RECOVERY_STRUCTURE",
        ...(!excluded.some(reason => reason.endsWith("OUTSIDE_PROPOSAL") || reason === "ROLE_MISMATCH") ? ["PROPOSED_SCOPE_MATCH"] : [])],
      pending: [...card.unresolved, ...checks],
    }
  })
  return { kind: "review" as const, executionAuthority: "NONE" as const, rows }
}

/** A dose variant remains a variant even when work duration changes the structural fingerprint. */
export function comparePurposeCards(left: PurposeSupplyCard, right: PurposeSupplyCard) {
  if (left.family !== right.family) return { kind: "different_purpose" as const }
  if (!left.sequence || !right.sequence) return { kind: "not_exercise_comparison" as const }
  const comparison = compareMainMethodsV3(left.sequence, right.sequence)
  const commonRoot = (left.parentId ?? left.id) === (right.parentId ?? right.id)
  const scalarOnly = comparison.differences.every(d => d === "WORK")
  return { kind: comparison.kind === "same" || (commonRoot || left.method === right.method) && scalarOnly
    ? "dose_variant" as const : "different_method" as const,
    differences: comparison.differences, equalBurden: false as const, equalEffect: false as const, executionAuthority: "NONE" as const }
}
