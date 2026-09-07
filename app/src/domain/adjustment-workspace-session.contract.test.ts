import { beforeEach, describe, expect, it } from "vitest"
import { ADJUSTMENT_WORKSPACE_SESSION_KEY, openAdjustmentSessionWorkspace, restoreAdjustmentWorkspace } from "./adjustment-workspace-session"
import { createAdjustmentCommitController } from "./prescription-adjustment-commit"
import { adjustmentCommitFixture } from "./prescription-adjustment-commit.test-fixtures"
import { setActiveLocalAccount } from "./account/local-journal-ownership"
import { accountScopedStorageKeyFor } from "./account/local-account-scope"
import { eraseAllLocalData } from "./erase-local-data"
import type { PlanMutationLockManager } from "./plan-mutation-lock"
import type { AdjustmentCommitAdapter } from "./prescription-adjustment-commit"
import { prepareSourceAdjustmentOffer } from "./source-adjustment-offer"
import { createSourceAdjustmentCommitAdapter } from "./source-adjustment-commit-adapter"
import { applyAdjustmentDraft, createAdjustmentDraft } from "@impl/prescription/prescription-adjustment"

const locks: PlanMutationLockManager = { request: async (_name, _options, run) => run({}) }
beforeEach(() => {
  sessionStorage.clear()
  localStorage.clear()
  setActiveLocalAccount(null)
})

function setup() {
  const f = adjustmentCommitFixture()
  const input = { base: f.base, readEnvironment: f.adapter.readEnvironment, now: f.adapter.now, locks }
  return { ...f, open: () => openAdjustmentSessionWorkspace(input), openInput: input }
}

describe("tab-scoped adjustment workspace persistence", () => {
  it("saves only a session draft, applies once and restores the exact result after reopening", async () => {
    const f = setup()
    localStorage.setItem("trainoracle.plan-beta.v1", "ACTIVE_PLAN_UNCHANGED")
    const opened = await f.open()
    expect(opened.kind).toBe("opened")
    if (opened.kind !== "opened") throw Error(opened.code)
    const result = await createAdjustmentCommitController(opened.adapter).commit(f.input)
    expect(result.kind).toBe("committed")
    const saved = sessionStorage.getItem(ADJUSTMENT_WORKSPACE_SESSION_KEY)!
    const reopened = await f.open()
    if (reopened.kind !== "opened") throw Error(reopened.code)
    expect(reopened.adapter.readState()).toEqual(opened.adapter.readState())
    expect(reopened.adapter.readState().prescription).toEqual(f.applied.prescription)
    expect((await createAdjustmentCommitController(reopened.adapter).commit(f.input)).kind).toBe("replayed")
    expect(sessionStorage.getItem(ADJUSTMENT_WORKSPACE_SESSION_KEY)).toBe(saved)
    expect(localStorage.getItem("trainoracle.plan-beta.v1")).toBe("ACTIVE_PLAN_UNCHANGED")
    expect(localStorage.length).toBe(1)
  })

  it("discards only the exact opened workspace and invalidates its owner", async () => {
    const f = setup()
    sessionStorage.setItem("UNRELATED", "KEEP")
    const opened = await f.open()
    if (opened.kind !== "opened") throw Error(opened.code)
    expect(await opened.discard()).toBe(true)
    expect(sessionStorage.getItem(ADJUSTMENT_WORKSPACE_SESSION_KEY)).toBeNull()
    expect(sessionStorage.getItem("UNRELATED")).toBe("KEEP")
    expect(() => opened.adapter.readState()).toThrow("WORKSPACE_CHANGED")
  })

  it.each(["revision", "slot", "lineage"] as const)("does not overwrite a different candidate %s", async field => {
    const f = setup()
    await f.open()
    const previous = sessionStorage.getItem(ADJUSTMENT_WORKSPACE_SESSION_KEY)
    const base = { ...f.base, ...(field === "revision" ? { revision: "OTHER" } : field === "slot" ? { mainSlotId: "OTHER" } : { candidateLineageId: "OTHER" }) }
    expect((await openAdjustmentSessionWorkspace({ ...f.openInput, base })).kind).toBe("unavailable")
    expect(sessionStorage.getItem(ADJUSTMENT_WORKSPACE_SESSION_KEY)).toBe(previous)
  })

  it.each(["extra", "receipt", "explanation", "version", "json"] as const)("rejects corrupt %s without deleting the original bytes", async change => {
    const f = setup()
    const opened = await f.open()
    if (opened.kind !== "opened") throw Error(opened.code)
    await createAdjustmentCommitController(opened.adapter).commit(f.input)
    const stored = JSON.parse(sessionStorage.getItem(ADJUSTMENT_WORKSPACE_SESSION_KEY)!)
    if (change === "extra") stored.memo = "PRIVATE_EXTRA"
    if (change === "receipt") stored.state.lastCommit.receipt.delta.qualityDurationSeconds = 999
    if (change === "explanation") stored.state.explanation.explanationVersion = "INVENTED"
    if (change === "version") stored.version = 2
    const raw = change === "json" ? "{BROKEN" : JSON.stringify(stored)
    sessionStorage.setItem(ADJUSTMENT_WORKSPACE_SESSION_KEY, raw)
    expect((await f.open()).kind).toBe("unavailable")
    expect(sessionStorage.getItem(ADJUSTMENT_WORKSPACE_SESSION_KEY)).toBe(raw)
  })

  it("rejects stale authority on reopening rather than treating stored approval as current", async () => {
    const f = setup()
    const opened = await f.open()
    if (opened.kind !== "opened") throw Error(opened.code)
    await createAdjustmentCommitController(opened.adapter).commit(f.input)
    f.setTime(200)
    expect((await f.open()).kind).toBe("unavailable")
    f.setTime(151)
    f.setEnvironment({ ...f.environment, allowed: false })
    expect((await f.open()).kind).toBe("unavailable")
  })

  it("isolates accounts and blocks a queued commit or discard after switching accounts", async () => {
    const f = setup()
    setActiveLocalAccount("TEST-A")
    const opened = await f.open()
    if (opened.kind !== "opened") throw Error(opened.code)
    const keyA = accountScopedStorageKeyFor(ADJUSTMENT_WORKSPACE_SESSION_KEY, "TEST-A")
    const saved = sessionStorage.getItem(keyA)
    setActiveLocalAccount("TEST-B")
    expect((await createAdjustmentCommitController(opened.adapter).commit(f.input)).kind).toBe("rejected")
    expect(await opened.discard()).toBe(false)
    expect(sessionStorage.getItem(keyA)).toBe(saved)
    expect((await f.open()).kind).toBe("opened")
    expect(sessionStorage.getItem(accountScopedStorageKeyFor(ADJUSTMENT_WORKSPACE_SESSION_KEY, "TEST-B"))).not.toBeNull()
    expect(sessionStorage.getItem(ADJUSTMENT_WORKSPACE_SESSION_KEY)).toBeNull()
  })

  it("does not continue using a handle after another handle writes a newer snapshot", async () => {
    const f = setup()
    const one = await f.open()
    const two = await f.open()
    if (one.kind !== "opened" || two.kind !== "opened") throw Error("Expected opened fixture")
    expect((await createAdjustmentCommitController(one.adapter).commit(f.input)).kind).toBe("committed")
    expect((await createAdjustmentCommitController(two.adapter).commit(f.input)).kind).toBe("rejected")
    expect(await two.discard()).toBe(false)
  })

  it("fails without a lock and does not write a baseline", async () => {
    const f = setup()
    expect(await openAdjustmentSessionWorkspace({ ...f.openInput, locks: null })).toEqual({ kind: "unavailable", code: "MUTATION_LOCK_UNAVAILABLE" })
    expect(sessionStorage.length).toBe(0)
  })

  it("keeps an old snapshot when storage rejects a write", async () => {
    const f = setup()
    let fail = false
    const storage = { getItem: (key: string) => sessionStorage.getItem(key), removeItem: (key: string) => sessionStorage.removeItem(key),
      setItem: (key: string, value: string) => { if (fail) throw Error("QUOTA"); sessionStorage.setItem(key, value) } }
    const opened = await openAdjustmentSessionWorkspace({ ...f.openInput, storage })
    if (opened.kind !== "opened") throw Error(opened.code)
    const before = sessionStorage.getItem(ADJUSTMENT_WORKSPACE_SESSION_KEY)
    fail = true
    expect((await createAdjustmentCommitController(opened.adapter).commit(f.input)).kind).toBe("rejected")
    expect(sessionStorage.getItem(ADJUSTMENT_WORKSPACE_SESSION_KEY)).toBe(before)
  })

  it("does not restore a manufactured initial prescription or an envelope-provided authority", async () => {
    const f = setup()
    const base = { ...f.base, prescription: f.applied.prescription }
    expect((await restoreAdjustmentWorkspace(JSON.stringify({ version: 1, base, state: base }), base, f.adapter)).kind).toBe("unavailable")
    expect((await restoreAdjustmentWorkspace(JSON.stringify({ version: 1, base: f.base, state: f.base, authority: f.authority }), f.base, f.adapter)).kind).toBe("unavailable")
  })

  it("includes anonymous and account-scoped drafts in erase-all", async () => {
    const f = setup()
    await f.open()
    setActiveLocalAccount("TEST-A")
    await f.open()
    await eraseAllLocalData()
    expect(sessionStorage.getItem(ADJUSTMENT_WORKSPACE_SESSION_KEY)).toBeNull()
    expect(sessionStorage.getItem(accountScopedStorageKeyFor(ADJUSTMENT_WORKSPACE_SESSION_KEY, "TEST-A"))).toBeNull()
  })

  it("connects source resolution, live source revalidation, session CAS and restoration end to end", async () => {
    const f = adjustmentCommitFixture()
    const source = { authority: f.authority, policy: f.policy, current: f.base.prescription.configuration,
      contextKey: f.base.contextKey, resolutionRevision: f.base.revision,
      anchor: { eventDistanceM: 5000, sourceRef: "TEST-ANCHOR", contentFingerprint: `sha256:${"a".repeat(64)}` }, nowMs: 151 }
    const offer = prepareSourceAdjustmentOffer(source)
    if (offer.kind !== "available") throw Error(offer.code)
    const base = { ...f.base, contextKey: offer.contextKey, prescription: offer.current,
      explanation: { ...f.base.explanation, configuration: offer.current.configuration } }
    let storageOwner: AdjustmentCommitAdapter | undefined
    const adapter = createSourceAdjustmentCommitAdapter({
      isAllowed: () => f.adapter.readEnvironment().allowed,
      readSource: () => source, readSourceExplanations: () => f.environment.explanations, now: f.adapter.now,
      readState: () => { if (!storageOwner) throw Error("NOT_OPEN"); return storageOwner.readState() },
      compareAndSwap: (...args) => storageOwner?.compareAndSwap(...args) ?? false,
    })
    const input = { base, readEnvironment: adapter.readEnvironment, now: adapter.now, locks }
    const opened = await openAdjustmentSessionWorkspace(input)
    if (opened.kind !== "opened") throw Error(opened.code)
    storageOwner = opened.adapter
    const draft = createAdjustmentDraft({ authority: offer.authority, policy: offer.policy, current: offer.current,
      target: offer.targets[0]!, contextKey: offer.contextKey, nowMs: 151 })
    if (draft.kind !== "draft") throw Error(draft.code)
    const applied = applyAdjustmentDraft({ authority: offer.authority, draft: draft.draft, current: offer.current,
      contextKey: offer.contextKey, nowMs: 151, action: "USER_EXPLICIT" })
    if (applied.kind !== "applied") throw Error(applied.code)
    expect((await createAdjustmentCommitController(adapter).commit({ base, receipt: applied.receipt, prescription: applied.prescription })).kind).toBe("committed")
    const reopened = await openAdjustmentSessionWorkspace(input)
    if (reopened.kind !== "opened") throw Error(reopened.code)
    expect(reopened.adapter.readState().prescription).toEqual(applied.prescription)
    f.setEnvironment({ ...f.environment, allowed: false })
    expect((await openAdjustmentSessionWorkspace(input)).kind).toBe("unavailable")
  })
})
