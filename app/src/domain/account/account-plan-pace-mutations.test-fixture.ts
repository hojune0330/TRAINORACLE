import { deriveCandidateId } from "@impl/plan-generator/candidate-identity"
import { bindCatalogSession } from "@impl/prescription/catalog-session-binding"
import type { WorkoutCalculationInputs } from "@impl/prescription/all-workout-calculator"
import type { AthleteRecord } from "../athlete-records"
import { createSegmentRecordReference, recordPaceSegments } from "../catalog-pace-reference"
import { prepareCatalogReplacement } from "../catalog-replacement"
import { prepareActivePlanEdit } from "../active-plan-edit"
import { activePlanEditDurationConsentRequired, activePlanEditFingerprint } from "../active-plan-edit-policy"
import { prepareExecutionReplan } from "../execution-replan"
import { replanFixture } from "../execution-replan.test-fixture"
import { planBetaStateV3Schema } from "../plan-beta-schema"
import { planSessionSchema } from "../plan-session-schema"
import { createPlannedSessionLogDraft } from "../planned-session-link"
import { preparePacePlanUpdate, preparePacePlanUndo } from "../pace-plan-update"
import { activePlanEditEvidenceFingerprint } from "../active-plan-edit"

export const PACE_MUTATIONS = ["catalog", "edit", "swap", "replan"] as const
export function paceBatchJournalFixture(undo: boolean, protectedJournal: boolean, paceRecordGuard: { documentId: string; revision: number }) {
  const seed = paceMutationFixture("edit")
  const forward = preparePacePlanUpdate({ ...seed, state: seed.before, timeZone: "UTC", record: seed.record, paceRecordGuard }, [seed.record])
  if (forward.kind !== "ready") throw Error(forward.message)
  const before = undo ? forward.proposal.after : seed.before
  const prepared = undo ? preparePacePlanUndo({ ...seed, state: before, timeZone: "UTC" }) : forward
  if (prepared.kind !== "ready") throw Error(prepared.message)
  const after = structuredClone(prepared.proposal.after)
  const receipt = after.activePlanEdit!
  if ((receipt.replacements?.length ?? 0) < 2) throw Error("Expected a multi-slot pace batch")
  const later = before.activePlan.sessions.find(session => session.day === receipt.replacements!.at(-1)!.day)!
  const entry = { ...seed.entries[0]!,
    ...(protectedJournal ? { plannedSessionLink: createPlannedSessionLogDraft(before, later, seed.now)!.link } : {}),
    title: "", memo: "",
  }
  // Model an untrusted client that supplies correct evidence but omits the later protected address.
  const evidenceFingerprint = activePlanEditEvidenceFingerprint([entry])
  after.activePlanEdit = { ...receipt, evidenceFingerprint,
    baseStateFingerprint: activePlanEditFingerprint({ state: before, evidenceFingerprint,
      journalGuard: receipt.journalGuard, today: receipt.today, timeZone: receipt.timeZone }) }
  return { ...seed, initial: seed.before, forward: forward.proposal.after, before, after, originalEntries: seed.entries, entries: [entry] }
}

export function paceMutationFixture(kind: typeof PACE_MUTATIONS[number], goal = false) {
  const seed = replanFixture()
  if (kind === "replan") { seed.today = "2026-10-01"; seed.now = "2026-10-01T03:00:00.000Z" }
  const common = { schemaVersion: 1 as const, eventDistanceM: 5000 as const, seasonId: null,
    enteredBy: "ATHLETE" as const, verificationState: "SELF_REPORTED" as const, savedAt: seed.now }
  const record: AthleteRecord = goal
    ? { ...common, id: "goal", sourceRef: "athlete-record:goal", purpose: "RACE_GOAL", performanceSeconds: 950, achievedOn: null }
    : { ...common, id: "recent", sourceRef: "athlete-record:recent", purpose: "RECENT_RESULT", performanceSeconds: 1000, achievedOn: "2026-09-28" }
  const historical: AthleteRecord = { ...common, id: "historical", sourceRef: "athlete-record:historical",
    purpose: "RECENT_RESULT", performanceSeconds: 1100, achievedOn: "2026-09-20", savedAt: "2026-09-20T03:00:00.000Z" }
  const inputsFor = (source: AthleteRecord): WorkoutCalculationInputs => {
    const inputs: WorkoutCalculationInputs = { eventDistanceM: 5000, experience: seed.state.intake.experienceBand,
      availableSeconds: null, confirmedRequirements: [], fiveK: null, segmentPaces: [] }
    const segments = recordPaceSegments("P-LT-B-480", inputs)
    if (!segments.length) throw Error("Missing pace segments")
    return { ...inputs, paceReferences: segments.map(segment => createSegmentRecordReference(segment.segmentId,
      source, seed.today, "FIVE_K_THRESHOLD_V1")) }
  }
  const moving = kind === "swap" || kind === "replan"
  const sessions = seed.state.activePlan.sessions.filter(session => kind !== "replan" || session.day !== 6).map(session => {
    if (session.day !== 3 && session.day !== 7) return session
    const source = moving && session.day === 7 ? record : historical
    const bound = bindCatalogSession(session, "P-LT-B-480", inputsFor(source), true)
    if (!bound) throw Error("Missing bound session")
    return bound
  })
  const active = seed.state.activePlan
  if (!("formationKind" in active.frame)) throw Error("Canonical frame required")
  seed.state = planBetaStateV3Schema.parse({ ...seed.state, activePlan: { ...active, sessions,
    candidateId: deriveCandidateId(active.candidateId, { kind: active.candidateKind, eventDistanceM: active.eventDistanceM,
      selectedDetailedTemplateRef: active.selectedDetailedTemplateRef, selectedEnergyIntent: active.selectedEnergyIntent,
      sourceMode: active.sourceMode, selectionAuthority: "SELF", frame: active.frame, sessions }) } })
  seed.entries[0] = { ...seed.entries[0]!, plannedSessionLink: createPlannedSessionLogDraft(seed.state,
    planSessionSchema.parse(sessions[0]!), seed.entries[0]!.savedAt)!.link }
  const source = { day: moving ? 7 : 3, slot: "AM" as const }
  let after
  if (kind === "catalog") {
    const result = prepareCatalogReplacement({ ...seed, address: source, catalogId: "P-LT-B-480", inputs: inputsFor(record),
      acceptStronger: true, acceptLonger: true, timeZone: "UTC" })
    if (result.kind !== "ready") throw Error(result.message)
    after = result.proposal.after
  } else if (kind === "replan") {
    const result = prepareExecutionReplan(seed)
    const proposal = result.kind === "ready" ? result.proposals.find(value => value.action === "MOVE_LATER") : null
    if (!proposal) throw Error(`No move proposal: ${JSON.stringify(result)}`)
    after = proposal.after
  } else {
    const original = planSessionSchema.parse(sessions.find(session => session.day === source.day)!)
    const replacement = bindCatalogSession(original, "P-LT-B-480", inputsFor(record), true)
    if (!replacement) throw Error("Missing replacement")
    const parsedReplacement = planSessionSchema.parse(replacement)
    const result = prepareActivePlanEdit({ ...seed, action: kind === "swap" ? "SWAP" : "CATALOG", source,
      ...(kind === "swap" ? { target: { day: 8, slot: "AM" } } : { replacement: parsedReplacement }),
      timeZone: "UTC", unstartedConfirmed: true,
      acceptedLongerDuration: kind === "edit" && activePlanEditDurationConsentRequired(original, parsedReplacement) })
    if (result.kind !== "ready") throw Error(result.reasonCode)
    after = result.proposal.after
  }
  return { ...seed, before: seed.state, after, record, historical }
}
