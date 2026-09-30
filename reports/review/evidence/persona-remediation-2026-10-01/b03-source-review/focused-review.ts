import assert from "node:assert/strict"
import { deriveCandidateId, derivePairId } from "../../impl/src/plan-generator/candidate-identity"
import { planBetaStateV3Schema } from "../../app/src/domain/plan-beta-schema"
import { prepareCatalogReplacement } from "../../app/src/domain/catalog-replacement"
import { prepareExecutionReplan, replanFingerprint } from "../../app/src/domain/execution-replan"
import { resolveExecutionReplanSource } from "../../app/src/domain/execution-replan-source"
import { createPlannedSessionLogDraft, plannedSessionLinkSchema } from "../../app/src/domain/planned-session-link"

type State = ReturnType<typeof planBetaStateV3Schema.parse>
const clone = <T>(value: T): T => structuredClone(value)
const now = "2026-10-06T03:10:00.000Z"
const today = "2026-10-06"

function seed(): State {
  const frame = { formationKind: "LOCAL_CIVIL_9_5", lengthDays: 9.5, slotCount: 19,
    projectionLengthDays: 9, continuity: { kind: "STANDARD_FRAME" } } as const
  // Synthetic arrangements reuse existing fixture ranges, not a new dose policy.
  const easy = { role: "EASY", plannedEnergyIntent: "BASE_INTENT", slot: "AM",
    prescription: { kind: "RPE_TIME_RANGE", rpe: { minimum: 3, maximum: 4 },
      durationMinutes: { minimum: 10, maximum: 20 } } } as const
  const quality = { role: "QUALITY", plannedEnergyIntent: "LT_INTENT", slot: "AM",
    prescription: { kind: "RPE_TIME_RANGE", rpe: { minimum: 7, maximum: 8 },
      durationMinutes: { minimum: 20, maximum: 30 } } } as const
  const sessions = [1, 3, 4, 5, 7, 8, 9].map(day => ({ ...(day === 3 || day === 7 ? quality : easy), day }))
  const base = "beta:balanced:five_k:event-5000:developing:lt_intent:single_session_only:varies:projection-9:local-civil-9-5:review-main-1-review-main-2:1-5-9:no_usable_journal:no-continuity:template-rpe-only"
  const projection = { kind: "BALANCED", eventDistanceM: 5000, selectedDetailedTemplateRef: null,
    selectedEnergyIntent: "LT_INTENT", sourceMode: "PROFILE_ONLY", selectionAuthority: "SELF", frame, sessions } as const
  const candidateId = deriveCandidateId(base, projection)
  const conservativeId = deriveCandidateId(base.replace("beta:balanced:", "beta:conservative:"),
    { ...projection, kind: "CONSERVATIVE" })
  return planBetaStateV3Schema.parse({ version: 3,
    intake: { eventGroup: "FIVE_K", eventDistanceM: 5000, competitionDivision: "OPEN",
      experienceBand: "DEVELOPING", availableDayCount: 4, requestedFrameLength: 9,
      trainingFocus: "LT_INTENT", secondSessionMode: "SINGLE_SESSION_ONLY", trainingTimePreference: "VARIES",
      selectedDetailedTemplateRef: null, startDate: "2026-10-05" },
    activePlan: { kind: "BETA_ACTIVE_PLAN_SNAPSHOT", activationState: "SELECTED_BETA_SNAPSHOT",
      candidateId, pairId: derivePairId("plan-pair:v3:5000:rpe-only:lt_intent:review-main-1-review-main-2:1-5-9:no-continuity", candidateId, conservativeId),
      candidateKind: "BALANCED", eventDistanceM: 5000, selectedDetailedTemplateRef: null,
      selectionActor: "SELF", sourceMode: "PROFILE_ONLY", selectedEnergyIntent: "LT_INTENT", frame, sessions },
    progress: [{ sessionDay: 1, sessionSlot: "AM", state: "COMPLETED" }],
    generatedAt: "2026-10-04T01:00:00.000Z" })
}

function journal(state: State, day = 1, id = "synthetic-origin", linkedAt = now) {
  const session = state.activePlan.sessions.find(s => s.day === day && s.slot === "AM")!
  const draft = createPlannedSessionLogDraft(state, session, linkedAt)!
  assert.ok(draft)
  return { id, kind: "post-session" as const, date: draft.date, savedAt: linkedAt, syncState: "local" as const,
    title: "", memo: "", system: "base" as const, distanceKm: "", durationMin: "", avgPace: "", rpe: 0,
    activityOutcome: "PARTIAL" as const, activitySlot: "AM" as const, painCheckStatus: "NO_SIGNAL_REPORTED" as const,
    plannedSessionLink: draft.link }
}
type Entry = ReturnType<typeof journal>
function prepare(state: State, entries: Entry[], archivedPlans: State[], date = today, acceptedAt = now) {
  return prepareExecutionReplan({ state, entries, archivedPlans, entryId: entries[0].id,
    today: date, now: acceptedAt, noFixedFutureCommitments: true, journalGuard: null })
}
function manual(state: State, catalogId: string, day = 4, entries: Entry[] = [], acceptedAt = now) {
  const result = prepareCatalogReplacement({ state, entries, today, now: acceptedAt, address: { day, slot: "AM" },
    catalogId, inputs: { eventDistanceM: 5000, experience: "DEVELOPING", availableSeconds: null,
      confirmedRequirements: [], fiveK: null, segmentPaces: [] },
    acceptStronger: true, acceptLonger: true, journalGuard: null, timeZone: "Asia/Seoul" })
  assert.equal(result.kind, "ready", result.kind === "blocked" ? result.message : "")
  if (result.kind !== "ready") throw Error("manual fixture")
  return result.proposal.after
}
function mustReady(state: State, entries: Entry[], archives: State[], date = today, acceptedAt = now) {
  const result = prepare(state, entries, archives, date, acceptedAt)
  assert.equal(result.kind, "ready", result.kind === "blocked" ? result.message : "")
  if (result.kind !== "ready") throw Error("ready fixture")
  assert.ok(result.proposals.length > 0, "normal chain must produce an actual correction proposal")
  return result
}
function mixed() {
  const original = seed(), entry = journal(original, 1, "synthetic-origin", "2026-10-05T03:00:00.000Z"), entries = [entry]
  const m1 = manual(original, "P-BASE-B", 4, entries, "2026-10-06T03:00:00.000Z")
  const m2 = manual(m1, "P-BASE-C", 8, entries, "2026-10-06T03:01:00.000Z")
  const r1 = mustReady(m2, entries, [original, m1], today, "2026-10-06T03:02:00.000Z").proposals.find(p => p.action === "REDUCE")!.after
  const m3 = manual(r1, "P-BASE-B", 9, entries, "2026-10-06T03:03:00.000Z")
  return { original, entry, entries, m1, m2, r1, current: m3, archives: [original, m1, m2, r1] }
}
const source = (state: State, entry: Entry, archives: State[]) => resolveExecutionReplanSource(state, entry.plannedSessionLink, archives)

export function runReview(only?: string[]) {
  const results: any[] = []
  const test = (id: string, action: (trace: any) => void) => {
    if (only && !only.includes(id)) return
    const trace: any = {}
    try { action(trace); results.push({ id, status: "PASS", trace }) }
    catch (error) { results.push({ id, status: "FAIL", trace, error: String(error) }) }
  }
  test("B01-mixed-multiple-manual-and-execution", trace => {
    const f = mixed(), before = JSON.stringify(f)
    const archives = [f.r1, clone(f.original), f.m2, f.m1, clone(f.m1)]
    const resolved = source(f.current, f.entry, archives)
    assert.equal(resolved?.source, "ARCHIVED")
    assert.equal(replanFingerprint(resolved!.state), replanFingerprint(f.original))
    const result = mustReady(f.current, f.entries, archives)
    assert.ok(result.proposals.every(p => replanFingerprint(p.before) === replanFingerprint(f.current)))
    assert.equal(JSON.stringify(f), before, "source or journal mutated")
    const advanced = clone(f.current)
    advanced.progress.push({ sessionDay: 3, sessionSlot: "AM", state: "COMPLETED" })
    assert.ok(source(advanced, f.entry, archives), "progress advancing must not break the same cycle")
    trace.actions = ["manual(day4)", "manual(day8)", "execution(REDUCE)", "manual(day9)"]
    trace.proposalActions = result.proposals.map(p => p.action)
    trace.originalPreserved = true
    trace.strictlyOrderedChangeTimes = [f.original.generatedAt, f.m1.catalogReplacement!.acceptedAt,
      f.m2.catalogReplacement!.acceptedAt, f.r1.executionReplan!.acceptedAt, f.current.catalogReplacement!.acceptedAt]
      .every((time, i, values) => i === 0 || Date.parse(time) > Date.parse(values[i - 1]))
    assert.equal(trace.strictlyOrderedChangeTimes, true)
  })
  test("B02-exact-original-with-missing-or-tampered-middle", trace => {
    const f = mixed()
    const variants: Record<string, State[]> = { missing: f.archives.filter(s => s !== f.m2) }
    const altered = clone(f.m2); altered.progress = []
    variants["tampered-progress"] = f.archives.map(s => s === f.m2 ? altered : s)
    const brokenReplay = clone(f.m2); brokenReplay.catalogReplacement!.source.day = 5
    variants["tampered-receipt"] = f.archives.map(s => s === f.m2 ? brokenReplay : s)
    const wrongId = clone(f.m2); wrongId.activePlan.candidateId += ":forged"
    variants["tampered-candidate"] = f.archives.map(s => s === f.m2 ? wrongId : s)
    trace.variants = []
    for (const [name, archives] of Object.entries(variants)) {
      assert.equal(source(f.current, f.entry, archives), null, name)
      assert.equal(prepare(f.current, f.entries, archives).kind, "blocked", name)
      trace.variants.push(name)
    }
    const regression = manual(f.current, "P-BASE-C", 9, f.entries, "2026-10-06T03:01:00.000Z")
    trace.chronologyProposalProbe = { previousAcceptedAt: f.current.catalogReplacement!.acceptedAt,
      afterAcceptedAt: regression.catalogReplacement!.acceptedAt,
      schemaValid: planBetaStateV3Schema.safeParse(regression).success,
      acceptedByCurrentSourceResolver: source(regression, f.entry, [...f.archives, f.current]) !== null }
    assert.equal(trace.chronologyProposalProbe.acceptedByCurrentSourceResolver, false, "backward-time edge must be rejected")
    const simultaneous = manual(f.current, "P-BASE-C", 9, f.entries, f.current.catalogReplacement!.acceptedAt)
    trace.equalEdgeTimeAccepted = source(simultaneous, f.entry, [...f.archives, f.current]) !== null
  })
  test("B03-same-date-slot-different-cycle", trace => {
    const f = mixed(), other = clone(f.original)
    other.generatedAt = "2026-10-04T02:00:00.000Z"
    const entry = journal(other, 1, "synthetic-other-cycle")
    assert.equal(entry.plannedSessionLink.plannedDate, f.entry.plannedSessionLink.plannedDate)
    assert.equal(entry.plannedSessionLink.sessionSlot, f.entry.plannedSessionLink.sessionSlot)
    assert.equal(other.activePlan.candidateId, f.original.activePlan.candidateId)
    assert.equal(source(f.current, entry, [...f.archives, other]), null)
    assert.equal(prepare(f.current, [entry], [...f.archives, other]).kind, "blocked")
    mustReady(f.current, [...f.entries, entry], [...f.archives, other])
    const substituted = clone(f.current); substituted.generatedAt = other.generatedAt
    assert.ok(planBetaStateV3Schema.safeParse(substituted).success)
    assert.equal(source(substituted, f.entry, f.archives), null)
    trace.sameCandidateDifferentGenerationRejected = true
    trace.unrelatedCycleNotCountedAsOverlap = true
  })
  test("B04-performed-slot-changed-and-restored", trace => {
    const base = seed()
    const original = manual(base, "P-BASE-B", 5, [], "2026-10-06T03:00:00.000Z")
    const entry = journal(original, 5, "synthetic-roundtrip")
    entry.plannedSessionLink = createPlannedSessionLogDraft(original, original.activePlan.sessions.find(s => s.day === 5)!,
      "2026-10-06T03:00:30.000Z")!.link
    entry.savedAt = "2026-10-09T03:00:00.000Z"
    const intermediate = manual(original, "P-BASE-C", 5, [], "2026-10-06T03:01:00.000Z")
    const returned = manual(intermediate, "P-BASE-B", 5, [], "2026-10-06T03:02:00.000Z")
    const furtherChanged = manual(returned, "P-BASE-C", 9, [], "2026-10-06T03:03:00.000Z")
    const reviewAt = "2026-10-09T04:00:00.000Z"
    const archives = [base, original, intermediate]
    const normal = mustReady(original, [entry], [], "2026-10-09", reviewAt)
    const resolved = source(returned, entry, archives)
    const actual = prepare(returned, [entry], archives, "2026-10-09", reviewAt)
    const laterResolved = source(furtherChanged, entry, [...archives, returned])
    const laterActual = prepare(furtherChanged, [entry], [...archives, returned], "2026-10-09", reviewAt)
    trace.schemaValid = [base, original, intermediate, returned].map(s => planBetaStateV3Schema.safeParse(s).success)
    trace.sameCandidateAfterRoundtrip = returned.activePlan.candidateId === original.activePlan.candidateId
    trace.sameLinkAfterRoundtrip = journal(returned, 5).plannedSessionLink.plannedSessionId === entry.plannedSessionLink.plannedSessionId
    trace.changedIntermediateSession = replanFingerprint(intermediate.activePlan.sessions.find(s => s.day === 5)) !== replanFingerprint(original.activePlan.sessions.find(s => s.day === 5))
    trace.source = resolved?.source ?? null
    trace.actualKind = actual.kind
    trace.proposalActions = actual.kind === "ready" ? actual.proposals.map(p => p.action) : []
    trace.normalControlActions = normal.proposals.map(p => p.action)
    trace.missingAllArchivesSource = source(returned, entry, [])?.source ?? null
    trace.missingAllArchivesPreparation = prepare(returned, [entry], [], "2026-10-09", reviewAt).kind
    const tampered = clone(intermediate); tampered.progress = []
    trace.tamperedMiddleSource = source(returned, entry, [base, original, tampered])?.source ?? null
    trace.unrelatedFurtherChange = { source: laterResolved?.source ?? null, kind: laterActual.kind,
      returnedVersionUsedInsteadOfExactOriginal: !!laterResolved && replanFingerprint(laterResolved.state) === replanFingerprint(returned),
      fullStateDifferentFromOriginal: !!laterResolved && replanFingerprint(laterResolved.state) !== replanFingerprint(original),
      proposalActions: laterActual.kind === "ready" ? laterActual.proposals.map(p => p.action) : [] }
    trace.chronology = { originalAcceptedAt: original.catalogReplacement!.acceptedAt, linkedAt: entry.plannedSessionLink.linkedAt,
      middleAcceptedAt: intermediate.catalogReplacement!.acceptedAt, returnedAcceptedAt: returned.catalogReplacement!.acceptedAt,
      datePerformed: entry.date, journalSavedAt: entry.savedAt, reviewAt }
    const alteredTime = clone(entry)
    alteredTime.plannedSessionLink.linkedAt = "2026-10-06T03:02:30.000Z"
    const equalTime = clone(entry)
    equalTime.plannedSessionLink.linkedAt = returned.catalogReplacement!.acceptedAt
    const genuineCurrent = journal(returned, 5, "synthetic-genuine-current", "2026-10-09T03:00:00.000Z")
    trace.temporalProposalProbe = {
      savedOriginalLinkUnchanged: entry.plannedSessionLink.linkedAt === "2026-10-06T03:00:30.000Z",
      savedOriginalPassesLastChangeTimeGate: Date.parse(entry.plannedSessionLink.linkedAt) > Date.parse(returned.catalogReplacement!.acceptedAt),
      clientOnlyTimestampEdit: { schemaValid: plannedSessionLinkSchema.safeParse(alteredTime.plannedSessionLink).success,
        samePlannedSessionId: alteredTime.plannedSessionLink.plannedSessionId === entry.plannedSessionLink.plannedSessionId,
        passesProposedLastChangeTimeGate: Date.parse(alteredTime.plannedSessionLink.linkedAt) > Date.parse(returned.catalogReplacement!.acceptedAt),
        source: source(returned, alteredTime, [])?.source ?? null,
        preparationKind: prepare(returned, [alteredTime], [], "2026-10-09", reviewAt).kind },
      equalTimePassesStrictGate: Date.parse(equalTime.plannedSessionLink.linkedAt) > Date.parse(returned.catalogReplacement!.acceptedAt),
      equalTimeAcceptedByCurrentResolver: source(returned, equalTime, archives) !== null,
      genuineCurrentPassesStrictGate: Date.parse(genuineCurrent.plannedSessionLink.linkedAt) > Date.parse(returned.catalogReplacement!.acceptedAt),
      genuineCurrentPreparationKind: prepare(returned, [genuineCurrent], [], "2026-10-09", reviewAt).kind,
      note: "Actual revised resolver tested. Client-only timestamp alteration is not proof that a stored original journal can be altered." }
    const rootAtGeneration = journal(base, 1, "synthetic-root-at-generation", base.generatedAt)
    const rootBeforeGeneration = journal(base, 1, "synthetic-root-before-generation", "2026-10-04T00:59:59.000Z")
    trace.rootTimeBoundary = { exactGenerationMatched: source(base, rootAtGeneration, []) !== null,
      beforeGenerationMatched: source(base, rootBeforeGeneration, []) !== null }
    assert.equal(trace.rootTimeBoundary.exactGenerationMatched, true)
    assert.equal(trace.rootTimeBoundary.beforeGenerationMatched, false)
    assert.equal(trace.temporalProposalProbe.genuineCurrentPreparationKind, "ready")
    assert.equal(trace.temporalProposalProbe.equalTimeAcceptedByCurrentResolver, false)
    assert.equal(trace.missingAllArchivesSource, null)
    assert.equal(trace.missingAllArchivesPreparation, "blocked")
    assert.equal(trace.tamperedMiddleSource, null)
    assert.equal(resolved === null, true, "roundtrip must not bypass preserved-session verification across the path")
    assert.equal(actual.kind, "blocked")
    assert.equal(laterResolved === null, true, "an unrelated later change must not make the returned version an exact original")
    assert.equal(laterActual.kind, "blocked")
  })
  test("B05-overlapping-journals-across-three-versions", trace => {
    const f = mixed()
    const second = journal(f.m1, 1, "synthetic-middle-version", "2026-10-06T03:00:30.000Z")
    const third = journal(f.current, 1, "synthetic-current-version", "2026-10-06T03:03:30.000Z")
    assert.equal(new Set([f.entry, second, third].map(e => e.plannedSessionLink.plannedSessionId)).size, 3)
    assert.ok(source(f.current, second, f.archives))
    for (const pair of [[f.entry, second], [second, third], [third, f.entry]]) {
      for (const entries of [pair, [...pair].reverse()]) {
        const result = prepare(f.current, entries, f.archives)
        assert.equal(result.kind, "blocked", "version-only overlap must be blocked from either selected entry")
      }
    }
    assert.equal(prepare(f.current, [f.entry, second, third], f.archives).kind, "blocked")
    trace.twoEntryOrderVariants = 6
    trace.threeVersionOverlapBlocked = true
  })
  return results
}
