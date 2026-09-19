import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { accountPlanEntry, emptyAccountPlanDocument, materializeAccountPlan } from "../account/account-plan-document-schema"
import { accountPlanPacketFixture } from "../account/account-plan.test-fixtures"
import { TODAY } from "../prescription-quality-matrix.test-fixtures"
import { createPlannedSessionLogDraft, type LinkablePlanSession } from "../planned-session-link"
import { setActiveLocalAccount } from "../account/local-journal-ownership"
import { loadComparisonPlanChoices, loadComparisonPlanSources, readComparisonPlanChoices, resolveAccountComparisonOriginal, type ComparisonPlanReadService } from "./comparison-plan-source"
import { resolveComparisonOriginal } from "./file-plan-comparison"

const at = TODAY.toISOString()
function setup(version: 2 | 3 | 4 | 5 | 6 = 3) {
  const entry = accountPlanEntry(accountPlanPacketFixture(version), at), document = emptyAccountPlanDocument()
  document.data.plans = [entry]
  if (version !== 2) document.data.currentPlanId = entry.planId
  const state = entry.snapshot.state.version === 2 || entry.snapshot.state.version === 3 ? entry.snapshot.state : entry.snapshot.state.selection
  const session = state.activePlan.sessions.find(session => session.role !== "REST")!
  const reference = { planFingerprint: entry.planId, session: createPlannedSessionLogDraft<LinkablePlanSession>(state, session, at)!.link }
  let view: ReturnType<ComparisonPlanReadService["snapshot"]> = { status: "READY", confirmedDocument: document }
  const service: ComparisonPlanReadService = { snapshot: () => view }
  return { entry, document, state, reference, service, options: { getService: () => service, referenceTime: at },
    update: (patch: Partial<typeof view>) => { view = { ...view, ...patch } } }
}
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(TODAY); localStorage.clear(); sessionStorage.clear(); setActiveLocalAccount(null) })
afterEach(() => { setActiveLocalAccount(null); vi.restoreAllMocks(); vi.useRealTimers() })

describe("acknowledged account comparison plan source", () => {
  it.each([2, 3, 4, 5, 6] as const)("lists V%s immutable non-rest sessions with exact original identities and no authority", version => {
    const f = setup(version), writes = vi.spyOn(Storage.prototype, "setItem"), before = JSON.stringify(f.document)
    const result = readComparisonPlanChoices(f.options)
    expect(result.status).toBe("AVAILABLE")
    if (result.status !== "AVAILABLE") throw Error("choices missing")
    expect(result.coverage).toBe("COMPLETE")
    expect(result.choices).toHaveLength(f.state.activePlan.sessions.filter(s => s.role !== "REST").length)
    expect(result.choices[0]!.reference).toEqual(f.reference)
    expect(result).toMatchObject({ executionAuthority: "NONE", persistenceAuthority: "NONE", requiresServerOriginalVerification: true })
    expect(result.choices.every(choice => choice.reference.planFingerprint === f.entry.planId)).toBe(true)
    expect(JSON.stringify(f.document)).toBe(before)
    expect(writes).not.toHaveBeenCalled()
  })

  it("ignores pending overlays and materialized currentPlan even while pending or conflicted", () => {
    const f = setup(), pending = accountPlanEntry(accountPlanPacketFixture(2), at), overlay = emptyAccountPlanDocument()
    overlay.data.plans = [pending]
    f.entry.progress = [{ sessionDay: 1, sessionSlot: "AM", state: "COMPLETED" }]
    const view = { status: "PENDING" as const, document: overlay, confirmedDocument: f.document,
      currentPlan: { packet: materializeAccountPlan(f.entry) } }
    f.service.snapshot = () => view
    const result = readComparisonPlanChoices(f.options)
    expect(result.status).toBe("AVAILABLE")
    expect(result.choices.map(choice => choice.reference.planFingerprint)).toEqual([f.entry.planId])
    expect(result.choices.some(choice => choice.reference.planFingerprint === pending.planId)).toBe(false)
    f.service.snapshot = () => ({ ...view, confirmedDocument: null })
    expect(readComparisonPlanChoices(f.options)).toMatchObject({ status: "UNAVAILABLE", choices: [] })
  })

  it("does not present a current-only projection as complete history, or silently load it", async () => {
    const f = setup()
    f.update({ historyLoaded: false, totalPlans: 3 })
    const loader = vi.fn(async () => { f.update({ historyLoaded: true, totalPlans: 1 }); return true })
    f.service.loadHistory = loader
    expect(readComparisonPlanChoices(f.options)).toMatchObject({ status: "AVAILABLE", coverage: "PARTIAL", loadedPlans: 1, totalPlans: 3 })
    expect(loader).not.toHaveBeenCalled()
    expect(await loadComparisonPlanChoices(f.options)).toMatchObject({ status: "AVAILABLE", coverage: "COMPLETE" })
    expect(loader).toHaveBeenCalledTimes(1)
  })

  it("loads only a selected known original from the collection and keeps partial history partial", async () => {
    const f = setup(), empty = emptyAccountPlanDocument()
    f.update({ historyLoaded: false, confirmedDocument: empty, totalPlans: 1 })
    const read = vi.fn(async (planId: string) => planId === f.entry.planId ? f.entry : null)
    f.service.loadPlan = read
    expect(await resolveAccountComparisonOriginal(f.reference, f.options)).toMatchObject({ status: "ORIGINAL_VERIFIED", original: f.reference })
    expect(read).toHaveBeenCalledExactlyOnceWith(f.entry.planId)
    expect(readComparisonPlanChoices(f.options)).toMatchObject({ status: "AVAILABLE", coverage: "PARTIAL", loadedPlans: 0, totalPlans: 1 })
    expect(await resolveAccountComparisonOriginal({ ...f.reference, planFingerprint: `sha256:${"a".repeat(64)}` }, f.options)).toMatchObject({ status: "TEMPORARY_COMPARISON" })
  })

  it("retains archived originals and reports unavailable instead of falling back to currentPlan", async () => {
    const f = setup()
    f.entry.archivedAt = at
    f.document.data.currentPlanId = null
    expect(readComparisonPlanChoices(f.options).choices[0]).toMatchObject({ archivedAt: at, isCurrentPlan: false })
    expect(await resolveAccountComparisonOriginal(f.reference, f.options)).toMatchObject({ status: "ORIGINAL_VERIFIED" })
    f.update({ confirmedDocument: emptyAccountPlanDocument() })
    expect(await resolveAccountComparisonOriginal(f.reference, f.options)).toMatchObject({ status: "TEMPORARY_COMPARISON" })
  })

  it("discards responses when account service changes during either history or selected-plan reads", async () => {
    const f = setup(), replacement: ComparisonPlanReadService = { snapshot: () => ({ status: "EMPTY", confirmedDocument: emptyAccountPlanDocument() }) }
    let current = f.service
    const options = { ...f.options, getService: () => current }
    f.update({ historyLoaded: false })
    f.service.loadHistory = async () => { current = replacement; return true }
    expect(await loadComparisonPlanChoices(options)).toMatchObject({ status: "UNAVAILABLE", reason: "ACCOUNT_CHANGED" })
    current = f.service
    f.update({ confirmedDocument: emptyAccountPlanDocument() })
    f.service.loadPlan = async () => { current = replacement; return f.entry }
    expect(await resolveAccountComparisonOriginal(f.reference, options)).toMatchObject({ status: "TEMPORARY_COMPARISON" })
  })

  it("fails closed on auth loss, missing original, incomplete load and failed read", async () => {
    const f = setup()
    f.update({ historyLoaded: false })
    f.service.loadHistory = async () => true
    expect(await loadComparisonPlanChoices(f.options)).toMatchObject({ reason: "HISTORY_INCOMPLETE" })
    f.service.loadHistory = async () => { throw Error("synthetic failure") }
    expect(await loadComparisonPlanChoices(f.options)).toMatchObject({ reason: "HISTORY_LOAD_FAILED" })
    f.service.loadPlan = async () => { f.update({ status: "AUTH_REQUIRED" }); return f.entry }
    f.update({ confirmedDocument: emptyAccountPlanDocument() })
    expect(await resolveAccountComparisonOriginal(f.reference, f.options)).toMatchObject({ status: "TEMPORARY_COMPARISON" })
    expect(readComparisonPlanChoices(f.options)).toMatchObject({ status: "UNAVAILABLE" })
  })

  it("refuses a materialized packet substituted for an immutable stored snapshot", async () => {
    const f = setup()
    f.entry.progress = [{ sessionDay: 1, sessionSlot: "AM", state: "COMPLETED" }]
    f.entry.snapshot = materializeAccountPlan(f.entry)
    expect(readComparisonPlanChoices(f.options)).toMatchObject({ status: "UNAVAILABLE", choices: [] })
    expect(await resolveAccountComparisonOriginal(f.reference, f.options)).toMatchObject({ status: "TEMPORARY_COMPARISON" })
  })

  it("hydrates then loads history and returns stable labeled original sessions plus detached snapshots", async () => {
    const f = setup(5), calls: string[] = []
    setActiveLocalAccount("synthetic-owner-a")
    f.update({ historyLoaded: false, totalPlans: 1 })
    f.service.hydrate = async () => { calls.push("hydrate"); return true }
    f.service.loadHistory = async () => { calls.push("history"); f.update({ historyLoaded: true }); return true }
    const first = await loadComparisonPlanSources(f.options)
    expect(calls).toEqual(["hydrate", "history"])
    expect(first.kind).toBe("ready")
    if (first.kind !== "ready") throw Error("sources missing")
    expect(first.sources.length).toBeGreaterThan(1)
    const source = first.sources[0]!
    expect(source.label).toContain(source.reference.session.plannedDate)
    expect(source.reference.session.linkedAt).toBe(f.state.generatedAt)
    expect(source.snapshot).toEqual(f.entry.snapshot)
    expect(source.snapshot).not.toBe(f.entry.snapshot)
    expect(resolveComparisonOriginal(source.snapshot, source.reference).status).toBe("ORIGINAL_VERIFIED")
    vi.setSystemTime(new Date(TODAY.getTime() + 86_400_000))
    const second = await loadComparisonPlanSources(f.options)
    if (second.kind !== "ready") throw Error("reopened sources missing")
    expect(second.sources.map(value => value.reference)).toEqual(first.sources.map(value => value.reference))
    expect(second).toMatchObject({ persistenceAuthority: "NONE", executionAuthority: "NONE", requiresServerOriginalVerification: true })
  })

  it("rejects unauthenticated, failed hydration and still-partial collection reads", async () => {
    const f = setup(), hydrate = vi.fn(async () => true)
    f.service.hydrate = hydrate
    expect(await loadComparisonPlanSources(f.options)).toEqual({ kind: "unavailable" })
    expect(hydrate).not.toHaveBeenCalled()
    setActiveLocalAccount("synthetic-owner-a")
    f.service.hydrate = async () => false
    expect(await loadComparisonPlanSources(f.options)).toEqual({ kind: "unavailable" })
    f.service.hydrate = hydrate
    f.update({ historyLoaded: false })
    f.service.loadHistory = async () => true
    expect(await loadComparisonPlanSources(f.options)).toEqual({ kind: "unavailable" })
  })

  it("invalidates the UI source load on owner A to B to A during hydration or history", async () => {
    const f = setup()
    setActiveLocalAccount("synthetic-owner-a")
    const changeOwner = async () => { setActiveLocalAccount("synthetic-owner-b"); setActiveLocalAccount("synthetic-owner-a"); return true }
    f.service.hydrate = changeOwner
    f.service.loadHistory = vi.fn(async () => true)
    expect(await loadComparisonPlanSources(f.options)).toEqual({ kind: "unavailable" })
    expect(f.service.loadHistory).not.toHaveBeenCalled()
    f.service.hydrate = async () => true
    f.service.loadHistory = changeOwner
    expect(await loadComparisonPlanSources(f.options)).toEqual({ kind: "unavailable" })
  })
})
