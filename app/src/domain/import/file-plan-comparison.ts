import { canonicalJsonFingerprint } from "@impl/plan-generator/candidate-identity"
import type { PlanSession } from "@impl/plan-generator/types"
import { parsePrescriptionSequence, type PrescriptionSequence, type PrescriptionSequenceNode, type SequenceRecovery } from "@impl/prescription/sequence"
import { parsePrescriptionSequenceV3, type PrescriptionSequenceV3, type SequenceNodeV3, type RecoveryStepV3 } from "@impl/prescription/sequence-v3"
import { accountPlanFingerprint, validateAccountPlanDocument, validateAccountPlanPacket, type AccountPlanPacket } from "../account/account-plan-document-schema"
import { readAccountPlanHistorical } from "../account/account-plan-historical"
import { validateAccountPlanCollectionEntry } from "../account/account-plan-collection-schema"
import { hasCanonicalJsonTree } from "../plan-beta-schema"
import { createPlannedSessionLogDraft, resolveCurrentPlannedSession } from "../planned-session-link"
import { sessionPrescriptionSequence } from "../session-prescription-sequence"
import { fileObservationAnalysisSignature, isProjectedFileObservation, type ProjectedFileObservation } from "./file-analysis"
import { FILE_OBSERVATION_LIMITS } from "./file-observation"
import { matchesPersistedComparisonReadContext, type PersistedComparisonReadContext } from "./comparison-relation-read"
import { comparisonOriginalReferenceSchema, confirmComparisonRelationRequestSchema, parseComparisonRelation,
  type ComparisonOriginalReference, type ComparisonRelationV1, type ComparisonSegmentMapping } from "./comparison-relation"

const hash = (value: unknown) => canonicalJsonFingerprint("trainoracle.file-plan-comparison.v1", value)
type Sequence = PrescriptionSequence | PrescriptionSequenceV3
type Node = PrescriptionSequenceNode | SequenceNodeV3
type Recovery = SequenceRecovery | RecoveryStepV3
type Phase = "warmup" | "main" | "cooldown"
export type ComparisonPlanSegment = {
  readonly id: string
  readonly phase: Phase
  readonly kind: "WORK" | "RECOVERY"
  readonly role: "WORK" | "BUILDUP" | "PREPARATION" | "RECOVERY"
  readonly targetUnit: "DISTANCE" | "DURATION"
  readonly distanceMeters: number | null
  readonly durationSeconds: number | null
  readonly paceSecondsPerKm: number | null
  readonly recoveryMode: Exclude<Recovery["mode"], "NOT_APPLICABLE"> | null
}
type Target = { readonly segmentId: string; readonly targetRepSeconds: number | null; readonly secondsPerKm: number }
type Structure = { readonly sequence: Sequence; readonly template: unknown; readonly targets: readonly Target[] }
const selectedState = (packet: AccountPlanPacket) => packet.state.version === 2 || packet.state.version === 3
  ? packet.state : packet.state.selection
type StoredSession = ReturnType<typeof selectedState>["activePlan"]["sessions"][number]

function structure(session: StoredSession): Structure | null {
  const p = session.prescription
  if (p.kind === "PACE_TARGET") {
    const sequence = sessionPrescriptionSequence(session as PlanSession)
    return sequence === null ? null : { sequence,
      template: { templateId: p.templateId, templateVersion: p.templateVersion, templateContentFingerprint: p.templateContentFingerprint },
      targets: [{ segmentId: "main", targetRepSeconds: p.targetRepSeconds, secondsPerKm: p.targetRepSeconds * 1000 / p.repetitionDistanceM }] }
  }
  if (p.kind === "ADJUSTED_METHOD") return { sequence: p.snapshot.projection.sequence,
    template: p.snapshot.projection.source.to, targets: p.snapshot.projection.segmentTargets }
  if (p.kind === "ADJUSTED_METHOD_V3") return { sequence: p.projection.sequence,
    template: p.projection.source.to, targets: p.projection.segmentTargets }
  return null
}

// Keep grouping, counts, work units, roles and ordered recovery; anchor values are conditions, not structure.
function structuralIdentity(sequence: Sequence) {
  const project = (node: Node): unknown => ({
    kind: node.kind, repeatCount: node.repeatCount,
    recoveryBetweenRepeats: node.recoveryBetweenRepeats, recoveryAfter: node.recoveryAfter,
    ...(node.kind === "group" ? { repeatUnit: "repeatUnit" in node ? node.repeatUnit : null, children: node.children.map(project) }
      : { role: "role" in node ? node.role : null, work: node.work,
        target: node.target.kind === "RACE_PACE" ? { kind: node.target.kind, eventDistanceM: node.target.eventDistanceM }
          : node.target.kind === "SPRINT_REFERENCE" ? { kind: node.target.kind } : node.target }),
  })
  return hash({ version: sequence.version, warmup: sequence.warmup.map(project), main: sequence.main.map(project),
    cooldown: sequence.cooldown.map(project), terminalRecovery: "terminalRecovery" in sequence ? sequence.terminalRecovery ?? null : null })
}

/** Technical expansion bound, not a training dose limit. Reject instead of truncating or reconstructing totals. */
function segmentsOf(input: Structure): readonly ComparisonPlanSegment[] | null {
  const parsed = input.sequence.version === 3 ? parsePrescriptionSequenceV3(input.sequence) : parsePrescriptionSequence(input.sequence)
  if (parsed.kind !== "parsed") return null
  const sequence = parsed.sequence, result: ComparisonPlanSegment[] = []
  let visits = 0
  const push = (segment: ComparisonPlanSegment) => {
    if (result.length >= FILE_OBSERVATION_LIMITS.laps) throw Error("SEGMENT_LIMIT")
    result.push(segment)
  }
  const recovery = (value: Recovery | readonly Recovery[], phase: Phase, path: string) => {
    const steps: readonly Recovery[] = Array.isArray(value) ? value : [value as Recovery]
    steps.forEach((step, i) => {
      if (step.mode === "NOT_APPLICABLE") return
      const distance = "distanceM" in step ? step.distanceM : null
      push({ id: `${path}/${i}`, phase, kind: "RECOVERY", role: "RECOVERY", targetUnit: distance === null ? "DURATION" : "DISTANCE",
        distanceMeters: distance, durationSeconds: step.seconds, paceSecondsPerKm: null, recoveryMode: step.mode })
    })
  }
  const visit = (nodes: readonly Node[], phase: Phase, path: string) => nodes.forEach((node, index) => {
    for (let repeat = 0; repeat < node.repeatCount; repeat += 1) {
      if (++visits > FILE_OBSERVATION_LIMITS.laps * 32) throw Error("SEGMENT_LIMIT")
      const id = `${path}/${index}/${repeat}`
      if (node.kind === "group") visit(node.children, phase, id)
      else {
        const target = input.targets.find(value => value.segmentId === node.id)
        push({ id, phase, kind: "WORK", role: "role" in node ? node.role : phase === "main" ? "WORK" : "PREPARATION",
          targetUnit: node.work.kind === "distance" ? "DISTANCE" : "DURATION",
          distanceMeters: node.work.distanceM,
          durationSeconds: node.work.kind === "duration" ? node.work.durationSeconds : target?.targetRepSeconds ?? null,
          paceSecondsPerKm: target?.secondsPerKm ?? null, recoveryMode: null })
      }
      if (repeat < node.repeatCount - 1) recovery(node.recoveryBetweenRepeats, phase, `${id}/between`)
    }
    // V1/V2: before the next sibling only. V3: once after all repeats, including the final sibling.
    if (sequence.version === 3 || index < nodes.length - 1) recovery(node.recoveryAfter, phase, `${path}/${index}/after`)
  })
  try {
    for (const phase of ["warmup", "main", "cooldown"] as const) {
      visit(sequence[phase], phase, phase)
      if (phase === "main" && sequence.version === 2 && sequence.terminalRecovery) recovery(sequence.terminalRecovery, phase, "terminal")
    }
    return result
  } catch { return null }
}

function freeze<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    Object.values(value).forEach(freeze)
    Object.freeze(value)
  }
  return value
}
export type VerifiedComparisonOriginal = {
  readonly status: "ORIGINAL_VERIFIED"
  readonly executionAuthority: "NONE"
  readonly original: ComparisonOriginalReference
  readonly segments: readonly ComparisonPlanSegment[]
  readonly templateFingerprint: string | null
  readonly structureFingerprint: string | null
  readonly limitation: "NO_EXPLICIT_SEGMENTS" | "SEGMENT_LIMIT_OR_INVALID_SEQUENCE" | null
}
type TemporaryComparison = { readonly status: "TEMPORARY_COMPARISON"; readonly reason: "ORIGINAL_UNAVAILABLE"; readonly executionAuthority: "NONE" }
export type ComparisonOriginalResolution = VerifiedComparisonOriginal | TemporaryComparison
const originals = new WeakSet<object>()
const temporary = (): TemporaryComparison => ({ status: "TEMPORARY_COMPARISON", reason: "ORIGINAL_UNAVAILABLE", executionAuthority: "NONE" })
function isOriginal(value: ComparisonOriginalResolution): value is VerifiedComparisonOriginal {
  return value?.status === "ORIGINAL_VERIFIED" && originals.has(value)
}

function immutableSnapshot(value: unknown): AccountPlanPacket | null {
  return validateAccountPlanPacket(value) && value.state.progress.length === 0 && readAccountPlanHistorical(value) !== null ? value : null
}

function projectOriginal(snapshot: AccountPlanPacket, reference: ComparisonOriginalReference): ComparisonOriginalResolution {
  const session = resolveCurrentPlannedSession<StoredSession>(selectedState(snapshot), reference.session)
  if (session === null) return temporary()
  const source = structure(session), segments = source === null ? null : segmentsOf(source)
  const resolved: VerifiedComparisonOriginal = freeze({ status: "ORIGINAL_VERIFIED", executionAuthority: "NONE",
    original: structuredClone(reference), segments: segments ?? [],
    templateFingerprint: source === null ? null : hash(source.template),
    structureFingerprint: source === null ? null : structuralIdentity(source.sequence),
    limitation: source === null ? "NO_EXPLICIT_SEGMENTS" : segments === null ? "SEGMENT_LIMIT_OR_INVALID_SEQUENCE" : null })
  originals.add(resolved)
  return resolved
}

/** linkedAt is reference metadata, not immutable plan/session identity. Both references must still pass the shared identity schema. */
export function sameComparisonOriginalIdentity(left: unknown, right: unknown): boolean {
  if (!hasCanonicalJsonTree(left) || !hasCanonicalJsonTree(right)) return false
  const a = comparisonOriginalReferenceSchema.safeParse(left), b = comparisonOriginalReferenceSchema.safeParse(right)
  return a.success && b.success && a.data.planFingerprint === b.data.planFingerprint
    && a.data.session.plannedSessionId === b.data.session.plannedSessionId
}

/** selectedSnapshot MUST come from the authenticated owner's acknowledged immutable PLAN storage,
 * never a request body, current plan, materialized progress or a summary. Existing readers validate
 * retained evidence for historical display only; this is NOT independent/live execution authority.
 */
export function resolveComparisonOriginal(selectedSnapshot: unknown, reference: unknown): ComparisonOriginalResolution {
  try {
    if (!hasCanonicalJsonTree(reference)) return temporary()
    const checked = comparisonOriginalReferenceSchema.safeParse(reference)
    if (!checked.success) return temporary()
    const snapshot = immutableSnapshot(selectedSnapshot)
    if (snapshot === null || accountPlanFingerprint(selectedSnapshot) !== checked.data.planFingerprint) return temporary()
    return projectOriginal(snapshot, checked.data)
  } catch { return temporary() }
}

/** Batch display projection: validate a known immutable snapshot once, never once per session.
 * References use immutable generatedAt so repeated account reads produce stable selection values.
 */
export function resolveComparisonPlanSessions(selectedSnapshot: unknown) {
  try {
    const snapshot = immutableSnapshot(selectedSnapshot)
    if (snapshot === null) return temporary()
    const state = selectedState(snapshot), planFingerprint = accountPlanFingerprint(snapshot)
    const resolved: VerifiedComparisonOriginal[] = []
    for (const session of state.activePlan.sessions) {
      if (session.role === "REST") continue
      const draft = createPlannedSessionLogDraft<StoredSession>(state, session, state.generatedAt)
      if (draft === null) return temporary()
      const original = projectOriginal(snapshot, { planFingerprint, session: draft.link })
      if (original.status !== "ORIGINAL_VERIFIED") return temporary()
      resolved.push(original)
    }
    return { status: "ORIGINAL_SESSIONS" as const, originals: resolved, executionAuthority: "NONE" as const }
  } catch { return temporary() }
}

/** Legacy PLAN document adapter: exact selected ID only, never currentPlanId or a best-match scan. */
export function resolveComparisonOriginalFromPlanDocument(storedDocument: unknown, reference: unknown): ComparisonOriginalResolution {
  if (!hasCanonicalJsonTree(reference) || !validateAccountPlanDocument(storedDocument)) return temporary()
  const checked = comparisonOriginalReferenceSchema.safeParse(reference)
  if (!checked.success) return temporary()
  const selected = storedDocument.data.plans.find(entry => entry.planId === checked.data.planFingerprint)
  return resolveComparisonOriginal(selected?.snapshot, checked.data)
}

/** All three inputs are owner-scoped stored reads. A staged snapshot without an acknowledged index is insufficient. */
export function resolveComparisonOriginalFromPlanCollection(storedIndex: unknown, storedSnapshotPart: unknown,
  storedProgressPart: unknown, reference: unknown): ComparisonOriginalResolution {
  const entry = validateAccountPlanCollectionEntry(storedIndex, storedSnapshotPart, storedProgressPart)
  return resolveComparisonOriginal(entry?.snapshot, reference)
}

export function comparisonObservationInterpretationFingerprint(observation: ProjectedFileObservation): string {
  return hash({ policyVersion: observation.policyVersion, sourceObservationKey: observation.sourceObservationKey,
    format: observation.format, analysis: fileObservationAnalysisSignature(observation) })
}

function originalMappingIssue(relation: ComparisonRelationV1, original: VerifiedComparisonOriginal): string | null {
  let lastPlan = -1, lastLap = -1
  for (const mapping of relation.segmentMappings) {
    const index = original.segments.findIndex(segment => segment.id === mapping.planSegmentId)
    const segment = original.segments[index]
    if (!segment || index <= lastPlan || mapping.sourceLapIndex <= lastLap) return "MAPPING_ADDRESS_OR_ORDER"
    if (mapping.confirmedKind !== segment.kind || mapping.confirmedTargetUnit !== segment.targetUnit) return "MAPPING_SEMANTICS"
    lastPlan = index
    lastLap = mapping.sourceLapIndex
  }
  return null
}

/** Historical restore validation only, including released/stale relations. The resolver input MUST be
 * the authenticated owner's exact stored PLAN. Validate every relation and preserve the original list
 * unchanged; success grants no current observation binding, numeric comparison, or persistence authority.
 */
export function validateComparisonRelationOriginalMapping(value: unknown, original: ComparisonOriginalResolution) {
  if (!isOriginal(original)) return temporary()
  const relation = parseComparisonRelation(value)
  const invalid = (reason: string) => ({ status: "INVALID_COMPARISON" as const, reason, executionAuthority: "NONE" as const })
  if (relation === null) return invalid("INVALID_RELATION")
  if (!sameComparisonOriginalIdentity(relation.original, original.original)) return invalid("ORIGINAL_IDENTITY_MISMATCH")
  const issue = originalMappingIssue(relation, original)
  return issue === null ? { status: "VALID_ORIGINAL_MAPPING" as const, executionAuthority: "NONE" as const } : invalid(issue)
}

function mappingIssue(relation: ComparisonRelationV1, original: VerifiedComparisonOriginal, observation: ProjectedFileObservation): string | null {
  const issue = originalMappingIssue(relation, original)
  if (issue !== null) return issue
  for (const mapping of relation.segmentMappings) {
    const lap = observation.laps[mapping.sourceLapIndex]
    if (!lap) return "MAPPING_ADDRESS_OR_ORDER"
    if (lap.kind !== "UNKNOWN" && lap.kind !== mapping.confirmedKind) return "MAPPING_SEMANTICS"
    if (mapping.confirmedDurationMeaning !== null && lap.durationMeaning !== "UNKNOWN" && lap.durationMeaning !== "SOURCE_DEFINED"
      && lap.durationMeaning !== mapping.confirmedDurationMeaning) return "TIME_MEANING_CONFLICT"
  }
  return null
}

/** Restored revision namespaces require a current ACK capability; confirmation always uses strict CAS without it.
 * Content/interpretation mismatch is not permanent revocation: exact fingerprint reversion may compare again
 * after all current binding checks pass. Released relations remain released; history is never rewritten.
 */
export function validateComparisonRelationBinding(value: unknown, original: ComparisonOriginalResolution,
  observation: ProjectedFileObservation, journalRevision: number, persistedReadContext?: PersistedComparisonReadContext | null) {
  if (!isOriginal(original)) return temporary()
  const relation = parseComparisonRelation(value)
  const invalid = (reason: string) => ({ status: "INVALID_COMPARISON" as const, reason, executionAuthority: "NONE" as const })
  if (!relation || !isProjectedFileObservation(observation)) return invalid("INVALID_RELATION_OR_OBSERVATION")
  if (relation.releasedAt !== null) return invalid("RELATION_RELEASED")
  if (!Number.isSafeInteger(journalRevision) || journalRevision < 1) return invalid("REVISION_BEFORE_CONFIRMATION")
  if (persistedReadContext != null) {
    if (!matchesPersistedComparisonReadContext(persistedReadContext, relation, observation, journalRevision)) return invalid("PERSISTED_READ_CONTEXT_INVALID")
  } else if (journalRevision < relation.journalRevisionAtConfirmation) return invalid("REVISION_BEFORE_CONFIRMATION")
  if (relation.journalId !== observation.journalEntryId || relation.contentRevisionFingerprint !== observation.contentRevisionFingerprint
    || relation.observationInterpretationFingerprint !== comparisonObservationInterpretationFingerprint(observation)) return invalid("OBSERVATION_CHANGED")
  if (!sameComparisonOriginalIdentity(relation.original, original.original)) return invalid("ORIGINAL_IDENTITY_MISMATCH")
  const issue = mappingIssue(relation, original, observation)
  return issue === null ? { status: "VALID_COMPARISON" as const, relation, executionAuthority: "NONE" as const } : invalid(issue)
}

export function prepareComparisonRelation(request: unknown, original: ComparisonOriginalResolution,
  observation: ProjectedFileObservation, journalRevision: number) {
  if (!isOriginal(original)) return temporary()
  const parsed = hasCanonicalJsonTree(request) ? confirmComparisonRelationRequestSchema.safeParse(request) : null
  if (!parsed?.success || parsed.data.expectedRevision !== journalRevision) {
    return { status: "INVALID_COMPARISON" as const, reason: "CAS_OR_REQUEST_INVALID", executionAuthority: "NONE" as const }
  }
  const result = validateComparisonRelationBinding(parsed.data.relation, original, observation, journalRevision)
  return result.status === "VALID_COMPARISON" ? { status: "READY_FOR_PERSISTENCE" as const,
    relation: freeze(result.relation), executionAuthority: "NONE" as const } : result
}

const finite = (value: number) => Number.isFinite(value) ? value : null
const difference = (actual: number | null, planned: number | null) => actual === null || planned === null ? null : finite(actual - planned)
const pace = (meters: number | null, seconds: number | null) => meters === null || meters <= 0 || seconds === null || seconds <= 0
  ? null : finite(seconds * 1000 / meters)
type Lap = ProjectedFileObservation["laps"][number]
function effectiveMeaning(lap: Lap, mapping: ComparisonSegmentMapping) {
  return mapping.confirmedDurationMeaning ?? lap.durationMeaning
}
function compareLap(segment: ComparisonPlanSegment, lap: Lap, mapping: ComparisonSegmentMapping) {
  const limitations: string[] = []
  const meaning = effectiveMeaning(lap, mapping)
  const recoveryMatches = segment.kind !== "RECOVERY" || mapping.confirmedRecoveryMode === segment.recoveryMode
  if (!recoveryMatches) limitations.push("RECOVERY_MODE_UNKNOWN_OR_DIFFERENT")
  // Prescription seconds describe the segment's timer, not moving-only or source-defined time.
  const timer = meaning === "TIMER"
  if (!timer) limitations.push("TIME_MEANING_NOT_TIMER")
  if (lap.distanceMeters === null) limitations.push("MISSING_DISTANCE")
  if (lap.durationSeconds === null) limitations.push("MISSING_DURATION")
  return { planSegmentId: segment.id, sourceLapIndex: lap.sourceIndex, planned: segment, actual: lap,
    durationMeaning: meaning, confirmedRecoveryMode: mapping.confirmedRecoveryMode,
    delta: {
      distanceMeters: recoveryMatches ? difference(lap.distanceMeters, segment.distanceMeters) : null,
      durationSeconds: recoveryMatches && timer ? difference(lap.durationSeconds, segment.durationSeconds) : null,
      paceSecondsPerKm: recoveryMatches && timer ? difference(pace(lap.distanceMeters, lap.durationSeconds), segment.paceSecondsPerKm) : null,
    }, limitations }
}

export function compareFileToPlan(original: ComparisonOriginalResolution, observation: ProjectedFileObservation,
  relation: unknown = null, journalRevision = 0, persistedReadContext?: PersistedComparisonReadContext | null) {
  if (!isProjectedFileObservation(observation)) return { status: "INVALID_COMPARISON" as const, reason: "OBSERVATION_NOT_ADOPTED", executionAuthority: "NONE" as const }
  const sideBySide = { actualLaps: observation.laps, plannedSegments: isOriginal(original) ? original.segments : [], executionAuthority: "NONE" as const }
  if (!isOriginal(original)) return { ...temporary(), ...sideBySide }
  if (relation === null) return { status: "MAPPING_REQUIRED" as const, ...sideBySide,
    // FileObservationV1 has no source-declared target unit or recovery mode. Numeric similarity is not semantic evidence.
    automaticMappingCandidates: [] as readonly never[], reason: "SOURCE_TARGET_UNIT_UNAVAILABLE" as const }
  const valid = validateComparisonRelationBinding(relation, original, observation, journalRevision, persistedReadContext)
  if (valid.status !== "VALID_COMPARISON") return { ...valid, ...sideBySide }
  const mappings = valid.relation.segmentMappings
  return { status: "QUANTITATIVE_COMPARISON" as const, ...sideBySide,
    rows: mappings.map(mapping => compareLap(original.segments.find(segment => segment.id === mapping.planSegmentId)!, observation.laps[mapping.sourceLapIndex]!, mapping)),
    unmatchedPlanSegmentIds: original.segments.filter(segment => !mappings.some(mapping => mapping.planSegmentId === segment.id)).map(segment => segment.id),
    unmatchedSourceLapIndices: observation.laps.filter(lap => !mappings.some(mapping => mapping.sourceLapIndex === lap.sourceIndex)).map(lap => lap.sourceIndex),
  }
}

export type PreviousComparisonInput = {
  readonly original: ComparisonOriginalResolution
  readonly observation: ProjectedFileObservation
  readonly relation: unknown
  readonly journalRevision: number
  readonly persistedReadContext?: PersistedComparisonReadContext | null
}
/** No ranking, weather correction, improvement verdict or inferred cause. Only compatible, confirmed lap pairs. */
export function comparePreviousFilePerformance(current: PreviousComparisonInput, previous: PreviousComparisonInput) {
  const incompatible = (reason: string, changedConditions: readonly string[] = []) => ({ status: "PREVIOUS_COMPARISON_UNAVAILABLE" as const,
    reason, changedConditions, executionAuthority: "NONE" as const, causation: "NOT_INFERRED" as const })
  if (!isOriginal(current.original) || !isOriginal(previous.original)) return incompatible("ORIGINAL_UNAVAILABLE")
  const a = compareFileToPlan(current.original, current.observation, current.relation, current.journalRevision, current.persistedReadContext)
  const b = compareFileToPlan(previous.original, previous.observation, previous.relation, previous.journalRevision, previous.persistedReadContext)
  if (a.status !== "QUANTITATIVE_COMPARISON" || b.status !== "QUANTITATIVE_COMPARISON") return incompatible("CONFIRMED_MAPPING_REQUIRED")
  const changed: string[] = []
  if (current.observation.date !== previous.observation.date) changed.push("OBSERVATION_DATE")
  if (current.original.original.session.sessionSlot !== previous.original.original.session.sessionSlot) changed.push("PLANNED_SLOT")
  if (current.observation.sport !== previous.observation.sport) changed.push("SPORT")
  if (current.original.templateFingerprint !== previous.original.templateFingerprint) changed.push("TEMPLATE_VERSION_OR_CONFIGURATION")
  if (current.original.structureFingerprint !== previous.original.structureFingerprint) changed.push("STRUCTURE_UNITS_OR_RECOVERY")
  if (hash(current.original.segments) !== hash(previous.original.segments)) changed.push("PLANNED_TARGETS")
  if (changed.some(code => ["SPORT", "TEMPLATE_VERSION_OR_CONFIGURATION", "STRUCTURE_UNITS_OR_RECOVERY"].includes(code))) return incompatible("INCOMPATIBLE_METHOD", changed)
  if (current.observation.sport === "UNKNOWN" || current.observation.sourceObservationKey === previous.observation.sourceObservationKey) return incompatible("UNKNOWN_SPORT_OR_SAME_OBSERVATION", changed)
  if (a.rows.length !== b.rows.length || a.rows.some((row, index) => row.planSegmentId !== b.rows[index]?.planSegmentId)) return incompatible("DIFFERENT_MAPPED_COVERAGE", [...changed, "MAPPED_COVERAGE"])
  if (a.rows.some((row, index) => row.durationMeaning !== b.rows[index]!.durationMeaning)) return incompatible("DIFFERENT_TIME_MEANING", [...changed, "TIME_MEANING"])
  if (a.rows.some((row, index) => row.planned.kind === "RECOVERY" && (row.confirmedRecoveryMode === null
    || row.confirmedRecoveryMode !== b.rows[index]!.confirmedRecoveryMode || row.confirmedRecoveryMode !== row.planned.recoveryMode))) return incompatible("RECOVERY_NOT_COMPATIBLE", [...changed, "ACTUAL_RECOVERY_MODE"])
  if (current.original.segments.some(segment => segment.kind === "RECOVERY" && !a.rows.some(row => row.planSegmentId === segment.id))) {
    return incompatible("RECOVERY_COVERAGE_UNCONFIRMED", [...changed, "RECOVERY_COVERAGE"])
  }
  if (a.rows.some((row, index) => row.planned.kind === "RECOVERY" && (row.planned.targetUnit === "DURATION"
    ? row.actual.durationSeconds === null || row.durationMeaning !== "TIMER" || row.actual.durationSeconds !== b.rows[index]!.actual.durationSeconds
    : row.actual.distanceMeters === null || row.actual.distanceMeters !== b.rows[index]!.actual.distanceMeters))) {
    return incompatible("RECOVERY_VALUES_NOT_COMPATIBLE", [...changed, "ACTUAL_RECOVERY_VALUES"])
  }
  return { status: "PREVIOUS_QUANTITATIVE_COMPARISON" as const, changedConditions: changed,
    executionAuthority: "NONE" as const, causation: "NOT_INFERRED" as const, unobservedConditions: ["WEATHER", "SURFACE", "FATIGUE"] as const,
    rows: a.rows.map((row, index) => {
      const prior = b.rows[index]!, knownTime = ["TIMER", "ELAPSED", "MOVING"].includes(row.durationMeaning)
      return { planSegmentId: row.planSegmentId, currentSourceLapIndex: row.sourceLapIndex, previousSourceLapIndex: prior.sourceLapIndex,
        delta: { distanceMeters: difference(row.actual.distanceMeters, prior.actual.distanceMeters),
          durationSeconds: knownTime ? difference(row.actual.durationSeconds, prior.actual.durationSeconds) : null,
          paceSecondsPerKm: knownTime && row.planned.paceSecondsPerKm !== null && prior.planned.paceSecondsPerKm !== null
            ? difference(pace(row.actual.distanceMeters, row.actual.durationSeconds), pace(prior.actual.distanceMeters, prior.actual.durationSeconds)) : null },
        limitations: [...new Set([...row.limitations, ...prior.limitations])].filter(code => !knownTime || code !== "TIME_MEANING_NOT_TIMER") }
    }),
  }
}
