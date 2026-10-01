import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { replanFixture } from "./execution-replan.test-fixture"
import { applyActivePlanEdit, prepareCurrentActivePlanEdit, replaceActivePlanWithDraft } from "./active-plan-edit-store"
import { activePlanEditEvidenceFingerprint } from "./active-plan-edit"
import { generateReplacementPlanFromDraft, selectPlanForActivation } from "./plan-beta-flow"
import { activePlanBetaStorageKey, loadVersionedPlanBetaState, readArchivedOriginalPlans } from "./plan-beta-store"
import { planBetaStateV3Schema } from "./plan-beta-schema"
import { setActiveLocalAccount } from "./account/local-journal-ownership"

vi.mock("./plan-mutation-lock", () => ({ PLAN_BETA_MUTATION_LOCK_NAME: "test-plan-lock", getPlanMutationLockManager: () => ({
  request: async (_name: string, _options: unknown, run: (lock: object) => unknown) => run({}),
}) }))
vi.mock("./account/account-plan-service", async importOriginal => {
  const actual = await importOriginal<typeof import("./account/account-plan-service")>()
  return { ...actual, accountPlansEnabled: vi.fn(() => false) }
})

const HISTORY_KEY = "trainoracle.plan-beta.history.v1"
const JOURNAL_KEY = "trainoracle.journal.v1"

beforeEach(() => {
  localStorage.clear()
  setActiveLocalAccount(null)
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(new Date("2026-09-29T03:00:00.000Z"))
})
afterEach(() => {
  setActiveLocalAccount(null)
  vi.restoreAllMocks()
  vi.useRealTimers()
  localStorage.clear()
})

function seeded() {
  const fixture = replanFixture()
  localStorage.setItem(activePlanBetaStorageKey(), JSON.stringify(fixture.state))
  localStorage.setItem(JOURNAL_KEY, JSON.stringify(fixture.entries))
  return fixture
}

async function prepareDuration() {
  const fixture = seeded()
  const preparation = await prepareCurrentActivePlanEdit({ source: { day: 3, slot: "AM" }, action: "DURATION",
    maximumMinutes: 25, unstartedConfirmed: true, noFixedFutureCommitments: false })
  if (preparation.kind !== "ready") throw Error("active edit proposal was not ready")
  return { ...fixture, proposal: preparation.proposal }
}

function replacementDraft(before: ReturnType<typeof replanFixture>["state"]) {
  const generated = generateReplacementPlanFromDraft({ ...before.intake, startDate: "2026-09-30" }, "NO_KNOWN_RISK")
  if (generated.kind !== "generated") throw Error("replacement plan draft was not generated")
  const selected = selectPlanForActivation(generated.generated.candidates[0]!.candidateId, generated.generated,
    generated.gate, generated.intake, generated.athleteEvidence)
  if (selected.kind !== "selected") throw Error("replacement draft could not be selected: " + selected.code)
  const parsed = planBetaStateV3Schema.safeParse(selected.state)
  if (!parsed.success) throw Error("replacement draft was not V3")
  return parsed.data
}

describe("active plan edit storage", () => {
  it("keeps a generated and selected replacement draft side-effect free until explicit apply", () => {
    const fixture = seeded()
    const key = activePlanBetaStorageKey()
    const activeBefore = localStorage.getItem(key)
    const journalBefore = localStorage.getItem(JOURNAL_KEY)
    const write = vi.spyOn(Storage.prototype, "setItem")
    const draft = replacementDraft(fixture.state)
    expect(draft.activePlan.sessions.length).toBeGreaterThan(0)
    expect(write.mock.calls.filter(([writtenKey]) => writtenKey !== "__to_probe__")).toEqual([])
    expect(localStorage.getItem(key)).toBe(activeBefore)
    expect(localStorage.getItem(JOURNAL_KEY)).toBe(journalBefore)
    expect(localStorage.getItem(HISTORY_KEY)).toBeNull()
  })

  it("explicitly archives the old plan and reloads a selected fresh-start plan", async () => {
    const fixture = seeded()
    const after = replacementDraft(fixture.state)
    const evidenceFingerprint = activePlanEditEvidenceFingerprint(fixture.entries)
    expect(await replaceActivePlanWithDraft({ before: fixture.state, after, evidenceFingerprint,
      confirmsNoKnownRisk: true, freshDraft: () => true })).toMatchObject({ kind: "applied" })
    expect(loadVersionedPlanBetaState()).toEqual(after)
    expect(localStorage.getItem(JOURNAL_KEY)).toBe(JSON.stringify(fixture.entries))
    const archive = readArchivedOriginalPlans()
    expect(archive.kind).toBe("loaded")
    if (archive.kind === "loaded") expect(archive.plans).toContainEqual(fixture.state)
  })

  it("blocks a current PAIN_CHECKIN even when the selected new plan has cleared progress", async () => {
    const fixture = seeded()
    const before = { ...fixture.state, progress: [{ sessionDay: 1, sessionSlot: "AM" as const, state: "PAIN_CHECKIN" as const }] }
    localStorage.setItem(activePlanBetaStorageKey(), JSON.stringify(before))
    const after = replacementDraft(before)
    expect(after.progress).toEqual([])
    const key = activePlanBetaStorageKey()
    const original = localStorage.getItem(key)
    expect((await replaceActivePlanWithDraft({ before, after, evidenceFingerprint: activePlanEditEvidenceFingerprint(fixture.entries),
      confirmsNoKnownRisk: true, freshDraft: () => true })).kind).toBe("blocked")
    expect(localStorage.getItem(key)).toBe(original)
    expect(localStorage.getItem(HISTORY_KEY)).toBeNull()
  })

  it.each(["scope", "active-state"] as const)("does not make the second write after post-archive %s change", async change => {
    const fixture = seeded()
    const after = replacementDraft(fixture.state)
    const key = activePlanBetaStorageKey()
    const historyWrite = Storage.prototype.setItem
    let changedAfterArchive = false
    const activeWrites: string[] = []
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, itemKey, value) {
      historyWrite.call(this, itemKey, value)
      if (changedAfterArchive && itemKey === key) activeWrites.push(value)
      if (!changedAfterArchive && itemKey === HISTORY_KEY) {
        changedAfterArchive = true
        if (change === "scope") setActiveLocalAccount("changed-account")
        else historyWrite.call(this, key, JSON.stringify({ ...fixture.state, progress: [] }))
      }
    })
    const result = await replaceActivePlanWithDraft({ before: fixture.state, after,
      evidenceFingerprint: activePlanEditEvidenceFingerprint(fixture.entries), confirmsNoKnownRisk: true,
      freshDraft: () => true })
    expect(result.kind).toBe("blocked")
    expect(changedAfterArchive).toBe(true)
    expect(activeWrites).toEqual([])
    expect(readArchivedOriginalPlans().kind).toBe("loaded")
  })

  it("prepares without writes, then explicitly archives, applies, and reloads the edited plan", async () => {
    const fixture = seeded()
    const key = activePlanBetaStorageKey()
    const originalRaw = localStorage.getItem(key)
    const journalRaw = localStorage.getItem(JOURNAL_KEY)
    const write = vi.spyOn(Storage.prototype, "setItem")
    const preparation = await prepareCurrentActivePlanEdit({ source: { day: 3, slot: "AM" }, action: "DURATION",
      maximumMinutes: 25, unstartedConfirmed: true, noFixedFutureCommitments: false })
    expect(preparation.kind).toBe("ready")
    expect(write.mock.calls.filter(([writtenKey]) => writtenKey !== "__to_probe__")).toEqual([])
    expect(localStorage.getItem(key)).toBe(originalRaw)
    expect(localStorage.getItem(HISTORY_KEY)).toBeNull()

    write.mockRestore()
    if (preparation.kind !== "ready") throw Error("proposal")
    expect(await applyActivePlanEdit(preparation.proposal, true)).toMatchObject({ kind: "applied" })
    expect(loadVersionedPlanBetaState()).toEqual(preparation.proposal.after)
    expect(localStorage.getItem(JOURNAL_KEY)).toBe(journalRaw)
    const archive = readArchivedOriginalPlans()
    expect(archive.kind).toBe("loaded")
    if (archive.kind === "loaded") expect(archive.plans).toContainEqual(fixture.state)
    expect(loadVersionedPlanBetaState()?.activePlan.candidateId).toBe(preparation.proposal.newPlanId)
  })

  it.each(["state", "journal"] as const)("blocks stale %s before writing", async changed => {
    const fixture = await prepareDuration()
    if (changed === "state") {
      localStorage.setItem(activePlanBetaStorageKey(), JSON.stringify({ ...fixture.state, progress: [] }))
    } else {
      localStorage.setItem(JOURNAL_KEY, JSON.stringify([{ ...fixture.entries[0], activityOutcome: "RESTED" }]))
    }
    const before = localStorage.getItem(activePlanBetaStorageKey())
    expect((await applyActivePlanEdit(fixture.proposal, true)).kind).toBe("blocked")
    expect(localStorage.getItem(activePlanBetaStorageKey())).toBe(before)
    expect(localStorage.getItem(HISTORY_KEY)).toBeNull()
  })

  it("keeps guest data untouched when an account-scoped session is offline", async () => {
    const fixture = seeded()
    setActiveLocalAccount("offline-account")
    const originalRaw = localStorage.getItem("trainoracle.plan-beta.v1")
    const setItem = vi.spyOn(Storage.prototype, "setItem")
    const preparation = await prepareCurrentActivePlanEdit({ source: { day: 3, slot: "AM" }, action: "DURATION",
      maximumMinutes: 25, unstartedConfirmed: true, noFixedFutureCommitments: false })
    expect(preparation).toMatchObject({ kind: "blocked" })
    expect(setItem).not.toHaveBeenCalled()
    expect(localStorage.getItem("trainoracle.plan-beta.v1")).toBe(originalRaw)
    expect(localStorage.getItem("trainoracle.plan-beta.v1.account.offline-account")).toBeNull()
    expect(localStorage.getItem(HISTORY_KEY)).toBeNull()
    expect(fixture.state.activePlan.candidateId).toBeTruthy()
  })

  it("does not replace the active plan when archive readback fails", async () => {
    const fixture = await prepareDuration()
    const key = activePlanBetaStorageKey()
    const original = localStorage.getItem(key)
    const write = Storage.prototype.setItem
    const read = Storage.prototype.getItem
    let archiveWritten = false
    const spy = vi.spyOn(Storage.prototype, "getItem").mockImplementation(function (this: Storage, itemKey) {
      if (archiveWritten && itemKey === HISTORY_KEY) throw new DOMException("synthetic archive readback failure", "SecurityError")
      return read.call(this, itemKey)
    })
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, itemKey, value) {
      write.call(this, itemKey, value)
      if (itemKey === HISTORY_KEY) archiveWritten = true
    })
    expect((await applyActivePlanEdit(fixture.proposal, true)).kind).toBe("blocked")
    spy.mockRestore()
    expect(localStorage.getItem(key)).toBe(original)
    expect(loadVersionedPlanBetaState()).toEqual(fixture.state)
  })

  it("reports uncertain after active write acknowledgement is lost and keeps the archived original", async () => {
    const fixture = await prepareDuration()
    const key = activePlanBetaStorageKey()
    const write = Storage.prototype.setItem
    const read = Storage.prototype.getItem
    let activeWritten = false
    const writer = vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, itemKey, value) {
      write.call(this, itemKey, value)
      if (itemKey === key) activeWritten = true
    })
    const reader = vi.spyOn(Storage.prototype, "getItem").mockImplementation(function (this: Storage, itemKey) {
      if (activeWritten && itemKey === key) throw new DOMException("synthetic active readback failure", "SecurityError")
      return read.call(this, itemKey)
    })
    expect((await applyActivePlanEdit(fixture.proposal, true)).kind).toBe("uncertain")
    reader.mockRestore()
    writer.mockRestore()
    expect(loadVersionedPlanBetaState()).toEqual(fixture.proposal.after)
    const archive = readArchivedOriginalPlans()
    expect(archive.kind).toBe("loaded")
    if (archive.kind === "loaded") expect(archive.plans).toContainEqual(fixture.state)
  })
})
