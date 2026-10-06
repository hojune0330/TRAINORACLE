import { z } from "zod"
import { isValidIsoDate, isoShift } from "./dates"
import { ALL_WORKOUT_CATALOG } from "@impl/prescription/all-workout-calculator"
import { resolveCatalogBinding, type CatalogSessionBinding } from "@impl/prescription/catalog-session-binding"
import { isProjectedFileObservation, type ProjectedFileObservation } from "./import/file-analysis"
import { fileAnalysisFormats } from "./import/file-analysis-policy"
import { ORACLE_CATALOG_REQUIREMENTS } from "./oracle-content-reader"
import type { JournalEntry, PostSessionEntry } from "./journal-schema"
import { projectStructuredJournalObservations } from "./journal-observation"
import { exerciseLogSchema } from "./exercise-log"
import type { FieldProvenance } from "./field-provenance"
import type { EnergySystemKey } from "./energy-system-taxonomy"
import { planHistorySchema, planBetaStateV2Schema, planBetaStateV3Schema, type PlanBetaState } from "./plan-beta-schema"
import { plannedSessionLinkSchema, resolveCurrentPlannedSession } from "./planned-session-link"
import { resolveExecutionReplanSource } from "./execution-replan-source"
import { comparePlannedRepetitions, plannedRepetitionEvidenceSchema, repetitionPrescription } from "./planned-repetition-evidence"
import { comparePlannedSegments, plannedSegmentEvidenceSchema, linkedCatalogWorkout } from "./planned-segment-evidence"
import type {
  OracleActivity, OraclePeriod, OracleReaderExerciseComponent, OracleReaderPlanActual,
  OracleReaderSession, OracleReaderSource, OracleReaderTraining, OracleTrainingPurpose,
  OracleReaderLaps, OracleReaderFileLaps, OracleReaderMethod,
} from "./oracle-content-reader"

export const ORACLE_CONTENT_ADAPTER_VERSION = "ORACLE_CONTENT_ADAPTER_V2_2" as const
export interface OracleContentAdapterInput {
  readonly today: string
  readonly journal: OracleReaderSource<{
    readonly entries: readonly JournalEntry[]
    readonly period: OraclePeriod
    readonly coverage: "COMPLETE" | "PARTIAL"
  }>
  readonly plan?: OracleReaderSource<PlanBetaState>
  readonly planHistory?: OracleReaderSource<readonly unknown[]>
  /** One explicitly selected observation from the existing conflict-filtered file report.
   * The caller owns current account/revision checks; a JSON clone loses the projection attestation.
   */
  readonly fileLaps?: OracleReaderSource<ProjectedFileObservation>
  /** Exact binding of the selected method/session, never an automatically chosen catalog item. */
  readonly catalogMethod?: OracleReaderSource<CatalogSessionBinding>
}
export interface OracleContentAdapterResult {
  readonly training: OracleReaderSource<OracleReaderTraining>
  readonly planActual: OracleReaderSource<readonly OracleReaderPlanActual[]>
  readonly laps: OracleReaderSource<OracleReaderLaps | OracleReaderFileLaps>
  readonly method: OracleReaderSource<OracleReaderMethod>
  readonly diagnostics: {
    readonly adapterVersion: typeof ORACLE_CONTENT_ADAPTER_VERSION
    readonly excludedSessions: number
    readonly conflictingSessions: number
    readonly duplicateSessions: number
    readonly rejectedPlanLinks: number
  }
}

const opaque = z.string().min(1).max(160).regex(/^[A-Za-z0-9._:@/+-]+$/u)
const purposeMap: Readonly<Record<EnergySystemKey, OracleTrainingPurpose>> = {
  RECOVERY: "REC", BASE: "BASE", LT: "LT", VO2: "VO2", GLY: "GLY", ATP_PC: "ATP_PC", MIXED_UNALLOCATED: "MIX",
}
const activityMap = { RUNNING: "RUN", INTERVALS: "RUN", STRENGTH: "WEIGHTS", PLYOMETRIC: "JUMPS", CROSS_TRAINING: "CROSS_TRAINING", OTHER: "UNKNOWN" } as const

function explicit(entry: PostSessionEntry, field: string): boolean { return entry.fieldProvenance?.[field]?.provenance === "EXPLICIT" }

/** Names, memos, titles, pain and note metadata do not enter even the conflict signature. */
function safeEntry(entry: PostSessionEntry): PostSessionEntry {
  const fields = ["system", "distanceKm", "durationMin", "avgPace", "rpe", "activityOutcome", "activitySlot", "objectiveComponents", "plannedSessionLink"]
  const provenance = Object.fromEntries(fields.flatMap<[string, FieldProvenance]>(field => {
    const p = entry.fieldProvenance?.[field]
    if (p?.provenance === "EXPLICIT" || p?.provenance === "MISSING") return [[field, { provenance: p.provenance }]]
    if (p?.provenance === "DERIVED") return [[field, { provenance: p.provenance, derivedFrom: [...p.derivedFrom], derivationRuleId: p.derivationRuleId }]]
    return []
  }))
  return {
    id: entry.id, kind: "post-session", date: entry.date, savedAt: entry.savedAt, syncState: "local",
    system: entry.system, distanceKm: entry.distanceKm, durationMin: entry.durationMin, avgPace: entry.avgPace, rpe: entry.rpe,
    title: "", memo: "", fieldProvenance: provenance, activityOutcome: entry.activityOutcome, activitySlot: entry.activitySlot,
    // rpeBand means the numeric RPE may be a display representative, not an exact observed value.
    rpeBand: entry.rpeBand,
  }
}

function componentsFor(entry: PostSessionEntry): { components: OracleReaderExerciseComponent[]; forms: ("CONTINUOUS" | "INTERVAL")[]; valid: boolean } {
  if (!explicit(entry, "objectiveComponents") || !entry.exerciseLog) return { components: [], forms: [], valid: true }
  const log = entry.exerciseLog
  // Project before parsing: free exercise names are neither output nor validation signals.
  const parsed = exerciseLogSchema.safeParse({ version: log.version, source: log.source,
    components: Array.isArray(log.components) ? log.components.map(c => ({ id: c.id, kind: c.kind, name: "", rows: Array.isArray(c.rows) ? c.rows.map(row => ({
      id: row.id, distanceM: row.distanceM, durationSeconds: row.durationSeconds, repetitions: row.repetitions,
      sets: row.sets, loadKg: row.loadKg, contacts: row.contacts, side: row.side,
      recovery: row.recovery, setRecovery: row.setRecovery,
    })) : null })) : null })
  if (!parsed.success || parsed.data.components.some(c => !opaque.safeParse(c.id).success || c.rows.some(row => !opaque.safeParse(row.id).success))) return { components: [], forms: [], valid: false }
  return {
    valid: true,
    forms: [...new Set(parsed.data.components.flatMap(c => c.kind === "RUNNING" ? ["CONTINUOUS" as const] : c.kind === "INTERVALS" ? ["INTERVAL" as const] : []))],
    components: parsed.data.components.map(c => ({ id: c.id, activity: activityMap[c.kind], rows: c.rows.map(row => ({
      id: row.id,
      ...(row.distanceM === undefined ? {} : { distanceM: row.distanceM }),
      ...(row.durationSeconds === undefined ? {} : { durationSeconds: row.durationSeconds }),
      ...(row.repetitions === undefined ? {} : { repetitions: row.repetitions }),
      ...(row.sets === undefined ? {} : { sets: row.sets }),
      ...(row.loadKg === undefined ? {} : { loadKg: row.loadKg }),
      ...(row.contacts === undefined ? {} : { contacts: row.contacts }),
      ...(row.recovery === undefined ? {} : { recoverySeconds: row.recovery.kind === "NONE" ? 0 : row.recovery.seconds }),
      ...(row.setRecovery === undefined ? {} : { setRecoverySeconds: row.setRecovery.kind === "NONE" ? 0 : row.setRecovery.seconds }),
    })) })),
  }
}

/** Pure adapter. Deliberately supplies an empty file-confirmation scope, so it never
 * reads account storage or promotes file/provider observations into explicit facts.
 */
function adaptJournal(input: OracleContentAdapterInput): Omit<OracleContentAdapterResult, "laps" | "method"> {
  const diagnostics = { adapterVersion: ORACLE_CONTENT_ADAPTER_VERSION, excludedSessions: 0, conflictingSessions: 0, duplicateSessions: 0, rejectedPlanLinks: 0 }
  const journal = input.journal
  if (journal.state !== "READY") return { training: { state: journal.state }, planActual: { state: journal.state }, diagnostics }
  const header = z.object({ period: z.object({ startDate: z.string().refine(isValidIsoDate), endDate: z.string().refine(isValidIsoDate) }),
    coverage: z.enum(["COMPLETE", "PARTIAL"]), entries: z.array(z.unknown()) }).safeParse(journal.data)
  if (!header.success || !opaque.safeParse(journal.sourceVersion).success || !isValidIsoDate(input.today)
    || header.data.period.startDate > header.data.period.endDate || header.data.period.endDate > input.today) {
    return { training: { state: "UNAVAILABLE" }, planActual: { state: "UNAVAILABLE" }, diagnostics }
  }
  const { period } = header.data
  type Candidate = { entry: PostSessionEntry; session: OracleReaderSession | null; signature: string; link: ReturnType<typeof plannedSessionLinkSchema.safeParse> | null
    executionOnly: boolean
    repetitions: ReturnType<typeof plannedRepetitionEvidenceSchema.safeParse> | null
    segments: ReturnType<typeof plannedSegmentEvidenceSchema.safeParse> | null }
  const groups = new Map<string, Candidate[]>()
  for (const raw of journal.data.entries) {
    if (!raw || raw.kind !== "post-session") continue
    if (!opaque.safeParse(raw.id).success) { diagnostics.excludedSessions++; continue }
    const entry = safeEntry(raw)
    const componentResult = componentsFor(raw)
    const link = explicit(entry, "plannedSessionLink") && raw.plannedSessionLink ? plannedSessionLinkSchema.safeParse(raw.plannedSessionLink) : null
    const repetitions = raw.exerciseLog?.plannedRepetitions ? plannedRepetitionEvidenceSchema.safeParse(raw.exerciseLog.plannedRepetitions) : null
    const segments = raw.exerciseLog?.plannedSegments ? plannedSegmentEvidenceSchema.safeParse(raw.exerciseLog.plannedSegments) : null
    const primitive = z.object({ date: z.string().refine(isValidIsoDate), system: z.string(), distanceKm: z.string(), durationMin: z.string(), avgPace: z.string(), rpe: z.number().finite(), savedAt: z.string() }).safeParse(entry)
    const observation = primitive.success ? projectStructuredJournalObservations([entry], { confirmedFileEntries: [] })[0] : undefined
    const accepted = observation?.sourceRef.trustState === "ACCEPTED"
    const eligible = (field: "system" | "distanceKm" | "durationMin" | "rpe") => accepted && observation.fieldProvenance[field] === "EXPLICIT"
    const activities = [...new Set(componentResult.components.map(c => c.activity))]
    const activity: OracleActivity = activities.length > 1 ? "MIXED" : activities[0] ?? "UNKNOWN"
    const hasSystem = eligible("system") && observation?.energySystem !== null && observation?.energySystem !== undefined
    const hasDuration = eligible("durationMin") && observation?.durationMin != null
    const hasRpe = eligible("rpe") && observation?.rpe != null && entry.rpeBand === undefined
    const hasDistance = eligible("distanceKm") && observation?.distanceKm != null && activity === "RUN"
    const performed = entry.activityOutcome !== "RESTED" && entry.activityOutcome !== "SKIPPED"
    const inPeriod = primitive.success && entry.date >= period.startDate && entry.date <= period.endDate
    const componentOnlyExplicit = componentResult.components.length > 0 && observation === undefined
      && Object.values(entry.fieldProvenance ?? {}).every(p => p.provenance !== "DERIVED")
    const structuredUsable = (accepted || componentOnlyExplicit)
      && (hasSystem || hasDuration || hasRpe || hasDistance || componentResult.components.length > 0)
    const executionOnly = !structuredUsable && !!link?.success && raw.exerciseLog?.source === "SELF_REPORTED"
      && ((repetitions?.success && repetitions.data.results.some(v => v.distanceM !== undefined || v.seconds !== undefined))
        || (segments?.success && segments.data.results.some(v => !/:RECOVERY:\d+$/u.test(v.key) && (v.distanceM !== undefined || v.seconds !== undefined)))) === true
    const usable = inPeriod && performed && componentResult.valid && (structuredUsable || executionOnly)
    const session: OracleReaderSession | null = usable ? {
      id: entry.id, date: entry.date, provenance: "EXPLICIT", activity,
      ...(hasSystem ? { purpose: purposeMap[observation!.energySystem!] } : {}),
      ...(hasDistance ? { distanceKm: observation!.distanceKm! } : {}),
      ...(hasDuration ? { durationMinutes: observation!.durationMin! } : {}),
      ...(hasRpe ? { rpe: observation!.rpe! } : {}),
      ...(explicit(entry, "activitySlot") && (entry.activitySlot === "AM" || entry.activitySlot === "PM") ? { slot: entry.activitySlot } : {}),
      ...(componentResult.forms.length === 1 && activity === "RUN" ? { form: componentResult.forms[0] } : {}),
      ...(componentResult.components.length ? { components: componentResult.components } : {}),
    } : null
    // Group before eligibility exclusion: a conflicting ineligible copy must not leave a winning copy.
    const { savedAt: _savedAt, ...stableEntry } = entry
    const signature = JSON.stringify({ entry: stableEntry, components: componentResult, link: link?.success ? link.data : link ? "INVALID" : null,
      repetitions: repetitions?.success ? repetitions.data : repetitions ? "INVALID" : null,
      segments: segments?.success ? segments.data : segments ? "INVALID" : null })
    const group = groups.get(entry.id) ?? []
    group.push({ entry, session, signature, link, repetitions, segments, executionOnly }); groups.set(entry.id, group)
  }
  const included: Candidate[] = []
  for (const group of groups.values()) {
    if (new Set(group.map(c => c.signature)).size > 1) { diagnostics.conflictingSessions++; continue }
    const candidate = group[0]!
    diagnostics.duplicateSessions += group.length - 1
    if (!candidate.session) {
      if (!isValidIsoDate(candidate.entry.date) || candidate.entry.date >= period.startDate && candidate.entry.date <= period.endDate && candidate.entry.activityOutcome !== "RESTED" && candidate.entry.activityOutcome !== "SKIPPED") diagnostics.excludedSessions++
      continue
    }
    included.push(candidate)
  }
  const sessions = included.filter(c => !c.executionOnly).map(c => c.session!).sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))
  const coverage = journal.coverage === "PARTIAL" || header.data.coverage === "PARTIAL" || diagnostics.excludedSessions > 0 || diagnostics.conflictingSessions > 0 ? "PARTIAL" : "COMPLETE"
  const training = (): OracleReaderSource<OracleReaderTraining> => {
    const unresolved = included.filter(c => c.executionOnly && !sessions.some(s => s.id === c.entry.id)).length
    diagnostics.excludedSessions += unresolved
    return { state: "READY", sourceVersion: journal.sourceVersion, data: { period, coverage: unresolved ? "PARTIAL" : coverage, sessions } }
  }
  if (!input.plan || input.plan.state !== "READY") return { training: training(), planActual: { state: input.plan?.state ?? "MISSING" }, diagnostics }
  const planSource = input.plan
  if (!opaque.safeParse(planSource.sourceVersion).success) return { training: training(), planActual: { state: "UNAVAILABLE" }, diagnostics }
  const parsed = z.union([planBetaStateV3Schema, planBetaStateV2Schema]).safeParse(planSource.data)
  if (!parsed.success) return { training: training(), planActual: { state: "UNAVAILABLE" }, diagnostics }
  const state = parsed.data
  const history = input.planHistory
  // Existing callers may pass replay-validating original states or validated V5 archive wrappers.
  const originals = history?.state === "READY" ? history.data.flatMap(value => {
    const original = planBetaStateV3Schema.safeParse(value)
    if (original.success) return [original.data]
    const archived = planHistorySchema.safeParse(value)
    return archived.success && "originalPlan" in archived.data ? [archived.data.originalPlan] : []
  }) : []
  const plans: OracleReaderPlanActual[] = []
  const occurrences = new Map<string, Candidate[]>()
  const occurrence = (link: { plannedDate: string; sessionDay: number; sessionSlot: string }) => `${link.plannedDate}:${link.sessionDay}:${link.sessionSlot}`
  for (const candidate of included) if (candidate.link?.success) {
    const key = occurrence(candidate.link.data)
    occurrences.set(key, [...(occurrences.get(key) ?? []), candidate])
  }
  let unavailableHistory = false
  for (const candidate of included) {
    const { entry, link } = candidate
    if (!link) continue
    if (!link.success || entry.date !== link.data.plannedDate || (occurrences.get(occurrence(link.data))?.length ?? 0) !== 1) { diagnostics.rejectedPlanLinks++; continue }
    const resolved = state.version === 3 ? resolveExecutionReplanSource(state, link.data, originals) : null
    const session = state.version === 3 ? resolved?.session : resolveCurrentPlannedSession(state, link.data)
    if (!session || session.role === "REST" || candidate.session?.slot !== undefined && candidate.session.slot !== session.slot) {
      diagnostics.rejectedPlanLinks++
      if (state.version === 3 && (state.executionReplan || state.catalogReplacement) && history?.state !== "READY") unavailableHistory = true
      continue
    }
    const p = session.prescription
    const completion = explicit(entry, "activityOutcome") ? entry.activityOutcome === "COMPLETED" ? "COMPLETED" as const
      : entry.activityOutcome === "PARTIAL" ? "PARTIAL" as const : entry.activityOutcome === "LIGHT_ACTIVITY" ? "CHANGED" as const : "UNKNOWN" as const : "UNKNOWN" as const
    let pointTargets: OracleReaderPlanActual["pointTargets"]
    let segmentTargets: OracleReaderPlanActual["segmentTargets"]
    let stepTargets: OracleReaderPlanActual["stepTargets"]
    let actualSteps: OracleReaderSession["steps"]
    const actualSegments: NonNullable<OracleReaderSession["segments"]>[number][] = []
    let expectedSegmentCount = 0
    let executionValid = true
    if (candidate.repetitions && candidate.segments) executionValid = false
    else if (candidate.repetitions) {
      const evidence = candidate.repetitions
      const prescription = repetitionPrescription(link.data, session)
      if (!evidence.success || !prescription || comparePlannedRepetitions(evidence.data, link.data, session).kind !== "compared") executionValid = false
      else {
        expectedSegmentCount = prescription.setCount * prescription.repetitionsPerSet
        const targets: NonNullable<OracleReaderPlanActual["pointTargets"]>[number][] = []
        for (let set = 1; set <= prescription.setCount; set++) for (let rep = 1; rep <= prescription.repetitionsPerSet; rep++) {
          const id = `set${set}:rep${rep}`
          targets.push({ segmentId: id, distanceM: prescription.repetitionDistanceM, seconds: prescription.targetRepSeconds })
          const actual = evidence.data.results.find(r => r.set === set && r.repetition === rep)
          if (actual?.distanceM !== undefined && actual.seconds !== undefined) actualSegments.push({
            id, distanceM: actual.distanceM, seconds: actual.seconds, set,
            ...(actual.recoverySeconds === undefined ? {} : { recoverySeconds: actual.recoverySeconds }),
          })
        }
        pointTargets = targets
      }
    } else if (candidate.segments) {
      const evidence = candidate.segments
      const calculation = linkedCatalogWorkout(link.data, session)
      if (!evidence.success || !calculation || comparePlannedSegments(evidence.data, link.data, session).kind !== "compared") executionValid = false
      else {
        // Only distance-bearing main work is a repetition. Recovery and time-only
        // steps must not be passed off as running laps or multiplied into km.
        const steps = calculation.steps.filter(step => step.phase === "main" && step.kind === "WORK" && step.distanceM !== null)
        expectedSegmentCount = steps.length
        const targets: NonNullable<OracleReaderPlanActual["segmentTargets"]>[number][] = []
        const points: NonNullable<OracleReaderPlanActual["pointTargets"]>[number][] = []
        for (const step of steps) {
          if (!opaque.safeParse(step.key).success) { executionValid = false; break }
          if (step.seconds) {
            if (step.seconds.minimum === step.seconds.maximum) points.push({ segmentId: step.key, distanceM: step.distanceM!, seconds: step.seconds.minimum })
            else targets.push({ segmentId: step.key, distanceM: step.distanceM!, minSeconds: step.seconds.minimum, maxSeconds: step.seconds.maximum })
          }
          const actual = evidence.data.results.find(row => row.key === step.key)
          if (actual?.distanceM !== undefined && actual.seconds !== undefined && actual.seconds > 0) actualSegments.push({ id: step.key, distanceM: actual.distanceM, seconds: actual.seconds })
        }
        segmentTargets = targets.length ? targets : undefined
        pointTargets = points.length ? points : undefined
        const stepRows: NonNullable<OracleReaderSession["steps"]>[number][] = []
        const timeTargets: NonNullable<OracleReaderPlanActual["stepTargets"]>[number][] = []
        for (const step of calculation.steps.filter(s => s.phase !== "main" || s.kind !== "WORK" || s.distanceM === null)) {
          if (!opaque.safeParse(step.key).success) { executionValid = false; break }
          const actual = evidence.data.results.find(row => row.key === step.key)
          if (actual) stepRows.push({ id: step.key, phase: step.phase, kind: step.kind,
            ...(actual.distanceM === undefined ? {} : { distanceM: actual.distanceM }),
            ...(actual.seconds === undefined ? {} : { seconds: actual.seconds }),
            ...(actual.rpe === undefined ? {} : { rpe: actual.rpe }),
          })
          if (step.seconds) timeTargets.push({ stepId: step.key, minSeconds: step.seconds.minimum, maxSeconds: step.seconds.maximum,
            ...(step.distanceM === null ? {} : { distanceM: step.distanceM }),
          })
        }
        actualSteps = stepRows.length ? stepRows : undefined
        stepTargets = timeTargets.length ? timeTargets : undefined
      }
    }
    if (!executionValid) { diagnostics.rejectedPlanLinks++; continue }
    if (actualSegments.length || actualSteps) {
      const index = sessions.findIndex(s => s.id === entry.id)
      const enriched = { ...candidate.session!, ...(actualSegments.length ? { segments: actualSegments,
        segmentsComplete: actualSegments.length === expectedSegmentCount } : {}),
        ...(actualSteps ? { steps: actualSteps } : {}),
      }
      if (index < 0) sessions.push(enriched)
      else sessions[index] = enriched
    }
    plans.push({ id: link.data.plannedSessionId, date: entry.date, sessionId: entry.id,
      originalPlanVersion: link.data.sessionContentFingerprint, completion,
      ...(p.kind === "RPE_TIME_RANGE" ? {
        plannedRpe: { min: p.rpe.minimum, max: p.rpe.maximum },
        plannedDurationMinutesRange: { min: p.durationMinutes.minimum, max: p.durationMinutes.maximum },
      } : {}),
      ...(pointTargets ? { pointTargets } : {}), ...(segmentTargets ? { segmentTargets } : {}),
      ...(stepTargets ? { stepTargets } : {}),
    })
  }
  sessions.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))
  if (unavailableHistory && (history?.state === "REVOKED" || !plans.length)) return { training: training(), planActual: { state: history?.state === "REVOKED" ? "REVOKED" : "UNAVAILABLE" }, diagnostics }
  return { training: training(), planActual: { state: "READY", sourceVersion: planSource.sourceVersion, data: plans,
    coverage: diagnostics.rejectedPlanLinks || coverage === "PARTIAL" || planSource.coverage === "PARTIAL" ? "PARTIAL" : "COMPLETE" }, diagnostics }
}

/** Calendar windows are independent of whether a read was complete. Never upgrade its coverage. */
export function oracleContentCalendarPeriods(today: string): { readonly currentMonth: OraclePeriod; readonly previousMonth: OraclePeriod } {
  if (!isValidIsoDate(today)) throw new RangeError("INVALID_ORACLE_CALENDAR_DATE")
  const first = `${today.slice(0, 7)}-01`
  const previousEnd = isoShift(first, -1)
  return { currentMonth: { startDate: first, endDate: today }, previousMonth: { startDate: `${previousEnd.slice(0, 7)}-01`, endDate: previousEnd } }
}

function adaptFileLaps(source: OracleContentAdapterInput["fileLaps"], today: string): OracleContentAdapterResult["laps"] {
  if (!source || source.state !== "READY") return { state: source?.state ?? "MISSING" }
  if (!opaque.safeParse(source.sourceVersion).success || !isValidIsoDate(today)
    || !isProjectedFileObservation(source.data) || !fileAnalysisFormats().includes(source.data.format)) return { state: "UNAVAILABLE" }
  const observation = source.data
  if (!opaque.safeParse(observation.journalEntryId).success || observation.date > today) return { state: "UNAVAILABLE" }
  if (observation.laps.length === 0) return { state: "MISSING" }
  return { state: "READY", sourceVersion: source.sourceVersion, coverage: source.coverage, data: {
    kind: "FILE_ACTIVITY", journalEntryId: observation.journalEntryId, date: observation.date, sport: observation.sport,
    sourceObservationKey: observation.sourceObservationKey, contentRevisionFingerprint: observation.contentRevisionFingerprint,
    policyVersion: observation.policyVersion, laps: observation.laps.map(lap => ({ sourceIndex: lap.sourceIndex,
      distanceMeters: lap.distanceMeters, durationSeconds: lap.durationSeconds, durationMeaning: lap.durationMeaning, kind: lap.kind,
    })),
  } }
}

function adaptCatalogMethod(source: OracleContentAdapterInput["catalogMethod"]): OracleContentAdapterResult["method"] {
  if (!source || source.state !== "READY") return { state: source?.state ?? "MISSING" }
  if (!opaque.safeParse(source.sourceVersion).success) return { state: "UNAVAILABLE" }
  const calculation = resolveCatalogBinding(source.data)
  if (!calculation) return { state: "UNAVAILABLE" }
  const entry = ALL_WORKOUT_CATALOG.find(candidate => candidate.id === calculation.catalogId)
  if (!entry) return { state: "UNAVAILABLE" }
  if (entry.family === "OFF") return { state: "MISSING" }
  const metadata = z.object({ family: z.enum(["BASE", "LT", "VO2", "ATP-PC", "GLY", "MIX", "REC"]),
    requirements: z.array(z.enum(ORACLE_CATALOG_REQUIREMENTS)), version: opaque,
    segments: z.array(z.object({ modality: z.enum(["RUN", "WALK", "BIKE", "ELLIPTICAL", "DEEP_WATER_RUN", "SWIM"]),
      terrain: z.enum(["FLAT", "INDOOR", "POOL", "UPHILL", "ROLLING"]) })),
  }).safeParse({ family: entry.family, requirements: entry.requirements, version: entry.version, segments: entry.segments })
  if (!metadata.success || !calculation.totals.seconds || !calculation.steps.some(step => step.phase === "main" && step.kind === "WORK")) return { state: "UNAVAILABLE" }
  const modalities = [...new Set(metadata.data.segments.map(segment => segment.modality))]
  const terrains = [...new Set(metadata.data.segments.map(segment => segment.terrain))]
  const work = calculation.steps.filter(step => step.phase === "main" && step.kind === "WORK")
  const running = work.every(step => step.modality === "RUN")
  const main = calculation.steps.filter(step => step.phase === "main")
  const firstWork = main.findIndex(step => step.kind === "WORK")
  let lastWork = firstWork
  for (let index = firstWork + 1; index < main.length; index++) if (main[index]!.kind === "WORK") lastWork = index
  const separated = main.slice(firstWork + 1, lastWork).some(step => step.kind === "RECOVERY")
  return { state: "READY", sourceVersion: source.sourceVersion, coverage: source.coverage, data: {
    id: entry.id, purpose: metadata.data.family === "ATP-PC" ? "ATP_PC" : metadata.data.family,
    ...(running ? { form: separated ? "INTERVAL" : "CONTINUOUS" } : {}),
    requiredMinutesRange: { min: calculation.totals.seconds.minimum / 60, max: calculation.totals.seconds.maximum / 60 },
    ...(metadata.data.requirements.includes("BIKE_AVAILABLE") ? { equipment: ["BIKE" as const] } : {}),
    catalog: { version: metadata.data.version, fingerprint: entry.fingerprint, calculationFingerprint: calculation.fingerprint,
      requirements: metadata.data.requirements, modalities, terrains },
  } }
}

/** Independent optional sources stay readable when an unrelated journal fetch fails.
 * No device-prediction adapter: PreparedDeviceActivity is analysisEligible:false and contains no race estimate.
 * No file-to-race matching: existing schemas do not store that relationship.
 */
export function buildOracleContentAdapter(input: OracleContentAdapterInput): OracleContentAdapterResult {
  return { ...adaptJournal(input), laps: adaptFileLaps(input.fileLaps, input.today), method: adaptCatalogMethod(input.catalogMethod) }
}
