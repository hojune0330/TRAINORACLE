import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { generatePlanFromDraft, selectPlanForActivation } from "./plan-beta-flow"
import { replaceCandidateCatalogWorkout } from "./catalog-plan-binding"
import { createPlannedSessionLogDraft, plannedSessionLinkSchema } from "./planned-session-link"
import { exerciseLogSchema } from "./exercise-log"
import { linkedCatalogWorkout, comparePlannedSegments, type PlannedSegmentEvidence } from "./planned-segment-evidence"
import { parseJournalEntryForWrite, type PostSessionEntry } from "./journal-schema"
import { reviewPlanExecution, type OriginalPlanLookup } from "./plan-execution-review"
import { executionReplanEvidence, replanFingerprint } from "./execution-replan"
import { canonicalJsonFingerprint } from "@impl/plan-generator/candidate-identity"
import { sessionExecutionSteps } from "../screens/plan-beta/labels"

const now = new Date("2026-09-30T03:00:00.000Z")
beforeEach(() => { localStorage.clear(); sessionStorage.clear(); vi.useFakeTimers(); vi.setSystemTime(now) })
afterEach(() => vi.useRealTimers())
function fixture() {
  const result = generatePlanFromDraft({ eventGroup: "FIVE_K", eventDistanceM: 5000, competitionDivision: "OPEN",
    experienceBand: "EXPERIENCED", availableDayCount: 5, requestedFrameLength: 9, trainingFocus: "GLY_INTENT",
    secondSessionMode: "SINGLE_SESSION_ONLY", trainingTimePreference: "VARIES", selectedDetailedTemplateRef: null }, "NO_KNOWN_RISK")
  if (result.kind !== "generated") throw Error(result.kind)
  const address = result.generated.candidates[0].sessions.find(s => s.role === "QUALITY")!
  const generated = replaceCandidateCatalogWorkout(result.generated, address, "X-GLY-01", {
    eventDistanceM: 5000, experience: "EXPERIENCED", availableSeconds: null, confirmedRequirements: [], fiveK: null, segmentPaces: [],
    segmentSeconds: [{ segmentId: "X-GLY-01-1-1", seconds: 24.7 }],
  })!
  if (!generated) throw Error("Catalog replacement did not bind")
  const selected = selectPlanForActivation(generated.candidates[0].candidateId, generated, result.gate, { ...result.intake, startDate: "2026-09-30" }, result.athleteEvidence)
  if (selected.kind !== "selected") throw Error(selected.kind)
  const state = selected.state
  const session = state.activePlan.sessions.find(s => s.day === address.day && s.slot === address.slot)!
  const link = createPlannedSessionLogDraft(state, session, now.toISOString())!.link
  const plan = linkedCatalogWorkout(link, session)!
  const work = plan.steps.find(s => s.phase === "main" && s.kind === "WORK")!
  const recovery = plan.steps.find(s => s.phase === "main" && s.kind === "RECOVERY")!
  const evidence: PlannedSegmentEvidence = { version: 1, source: "SELF_REPORTED", plannedSessionId: link.plannedSessionId,
    sessionContentFingerprint: link.sessionContentFingerprint, calculationFingerprint: plan.fingerprint,
    results: [{ key: work.key, distanceM: 150, seconds: 25.4 }, { key: recovery.key, seconds: 0 }] }
  const entry: PostSessionEntry = { id: "catalog-segment-entry", date: link.plannedDate, kind: "post-session", savedAt: now.toISOString(), syncState: "local",
    activityOutcome: "PARTIAL", activitySlot: session.slot, planExecutionRelation: "MODIFIED", title: "PRIVATE-TITLE", memo: "PRIVATE-MEMO", memoPurpose: "PRIVATE_SELF_ONLY",
    distanceKm: "", durationMin: "", avgPace: "", rpe: 0, system: "", plannedSessionLink: link,
    fieldProvenance: { activityOutcome: { provenance: "EXPLICIT" }, activitySlot: { provenance: "EXPLICIT" },
      plannedSessionLink: { provenance: "EXPLICIT" }, planExecutionRelation: { provenance: "DERIVED", derivationRuleId: "QUICK_PLAN_EXECUTION_RELATION_V2",
        derivedFrom: ["activityOutcome", "activitySlot", "plannedSessionLink"] } },
    exerciseLog: { version: 1, source: "SELF_REPORTED", components: [], plannedSegments: evidence } }
  const original = { kind: "matched", session, source: "ACTIVE", state } as unknown as OriginalPlanLookup
  return { entry, evidence, session, link, plan, work, recovery, original }
}
describe("catalog prescription -> original journal link -> actual segment evaluation", () => {
  it("does not throw when an older linked session has no prescription", () => {
    const f = fixture()
    const session = { ...f.session, prescription: null } as unknown as typeof f.session
    const link = { ...f.link, sessionContentFingerprint: canonicalJsonFingerprint("trainoracle.planned-session-content.v1", session) }
    expect(linkedCatalogWorkout(link, session)).toBeNull()
  })
  it("preserves explicit decimal times and zero actual recovery through storage and analysis", () => {
    const f = fixture()
    expect(exerciseLogSchema.safeParse(f.entry.exerciseLog).success).toBe(true)
    expect(plannedSessionLinkSchema.safeParse(f.link).success).toBe(true)
    expect(parseJournalEntryForWrite(f.entry)).not.toBeNull()
    const saved = parseJournalEntryForWrite(f.entry)
    expect(saved?.kind === "post-session" ? saved.exerciseLog?.plannedSegments : undefined).toEqual(f.evidence)
    const report = comparePlannedSegments(f.evidence, f.link, f.session)
    expect(report).toMatchObject({ kind: "compared", completeDistanceCount: 1, timedCount: 2, changed: true })
    expect(report.facts.join(" ")).toContain("0.7초")
    expect(report.facts.join(" ")).toContain("-180초")
    expect(report.unknowns.join(" ")).toContain("실패나 0초가 아니에요")
    expect(reviewPlanExecution(f.entry, f.original).repetitionComparison).toEqual(report)
    const displayed = sessionExecutionSteps(f.session).find(step => step.title === "본운동")!.detail
    expect(displayed).toContain("150m")
    expect(displayed).toContain("24.7s")
    expect(displayed).toContain("반복 사이 3분 걷기/서서 쉬기")
    expect(displayed).not.toContain("숨이 가라앉으면")
  })
  it("distinguishes missing distance from a deliberately changed distance", () => {
    const f = fixture()
    const missing = comparePlannedSegments({ ...f.evidence, results: [{ key: f.work.key, seconds: 25 }] }, f.link, f.session)
    expect(missing).toMatchObject({ timedCount: 0, changed: false })
    expect(missing.facts.join(" ")).toContain("실제 거리가 미기록")
    const changed = comparePlannedSegments({ ...f.evidence, results: [{ key: f.work.key, distanceM: 100, seconds: 25 }] }, f.link, f.session)
    expect(changed).toMatchObject({ timedCount: 0, changed: true })
  })
  it.each(["unknown-step", "stale-plan", "duplicate", "private-text", "zero-work"])("rejects %s evidence", mutation => {
    const f = fixture(), value = structuredClone(f.evidence)
    if (mutation === "unknown-step") value.results[0]!.key = "not-a-step"
    if (mutation === "stale-plan") value.calculationFingerprint = `sha256:${"a".repeat(64)}`
    if (mutation === "duplicate") value.results.push({ ...value.results[0]! })
    if (mutation === "private-text") Object.assign(value, { memo: "PRIVATE" })
    if (mutation === "zero-work") value.results[0]!.seconds = 0
    expect(comparePlannedSegments(value, f.link, f.session).kind).toBe("unavailable")
  })
  it("invalidates stale replan evidence without leaking private text or inferring missing numbers", () => {
    const f = fixture(), changed = structuredClone(f.entry)
    changed.exerciseLog!.plannedSegments!.results[0]!.seconds = 26
    expect(replanFingerprint(executionReplanEvidence([changed]))).not.toBe(replanFingerprint(executionReplanEvidence([f.entry])))
    expect(JSON.stringify(executionReplanEvidence([f.entry]))).not.toMatch(/PRIVATE/)
    expect(executionReplanEvidence([{ ...f.entry, memo: "OTHER-MEMO" }])).toEqual(executionReplanEvidence([f.entry]))
    expect(parseJournalEntryForWrite({ ...f.entry, plannedSessionLink: undefined })).toBeNull()
    expect(parseJournalEntryForWrite({ ...f.entry, activityOutcome: "RESTED" })).toBeNull()
    expect(reviewPlanExecution({ ...f.entry, painCheckStatus: "SIGNAL_REPORTED" }, f.original).repetitionComparison).toBeUndefined()
  })
})
