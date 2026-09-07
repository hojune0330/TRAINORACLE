import { expect, it, vi } from "vitest"
import { createAdjustmentCommitController } from "./prescription-adjustment-commit"
import { adjustmentCommitFixture } from "./prescription-adjustment-commit.test-fixtures"

it("commits prescription, explanation, totals and receipt in one snapshot and replays without a second write", async () => {
  const f = adjustmentCommitFixture()
  const controller = createAdjustmentCommitController(f.adapter)
  const original = JSON.stringify(f.base)
  const result = await controller.commit(f.input)
  expect(result.kind).toBe("committed")
  expect(f.adapter.readState()).toMatchObject({ prescription: f.applied.prescription,
    explanation: { explanationVersion: "test-1", evidenceRefs: ["test-source-1"] },
    lastCommit: { receipt: { afterTotals: { totalRepetitions: 4, qualityDurationSeconds: 52, plannedRecoverySeconds: 21 } } } })
  const replay = await controller.commit(f.input)
  expect(replay.kind).toBe("replayed")
  expect(f.writes()).toBe(1)
  expect(JSON.stringify(f.base)).toBe(original)
})

it.each(["delta", "beforeTotals", "afterTotals", "methodDifferences"] as const)("rejects a forged receipt field: %s", async field => {
  const f = adjustmentCommitFixture()
  const receipt = structuredClone(f.applied.receipt)
  Object.assign(receipt, { [field]: field === "methodDifferences" ? ["WORK_STRUCTURE"] : { totalRepetitions: 999 } })
  expect((await createAdjustmentCommitController(f.adapter).commit({ ...f.input, receipt })).kind).toBe("rejected")
  expect(f.writes()).toBe(0)
  expect(f.adapter.readState()).toEqual(f.base)
})

it.each(["expired", "revoked", "safety", "scope", "explanation", "duplicate-explanation"] as const)("rechecks live %s before writing", async mutation => {
  const f = adjustmentCommitFixture()
  if (mutation === "expired") f.setTime(200)
  if (mutation === "revoked") f.setEnvironment({ ...f.environment, authority: { ...f.authority, policies: [] } })
  if (mutation === "safety") f.setEnvironment({ ...f.environment, allowed: false })
  if (mutation === "scope") f.setEnvironment({ ...f.environment, contextKey: "different-account" })
  if (mutation === "explanation") f.setEnvironment({ ...f.environment, explanations: [] })
  if (mutation === "duplicate-explanation") f.setEnvironment({ ...f.environment, explanations: [...f.environment.explanations, f.environment.explanations[1]!] })
  expect((await createAdjustmentCommitController(f.adapter).commit(f.input)).kind).toBe("rejected")
  expect(f.writes()).toBe(0)
})

it("rejects a different output sequence and a future action timestamp", async () => {
  const f = adjustmentCommitFixture()
  const controller = createAdjustmentCommitController(f.adapter)
  expect((await controller.commit({ ...f.input, prescription: f.base.prescription })).kind).toBe("rejected")
  expect((await controller.commit({ ...f.input, receipt: { ...f.applied.receipt, appliedAtMs: 160 } })).kind).toBe("rejected")
  expect(f.writes()).toBe(0)
})

it("does not overwrite another candidate, slot or revision", async () => {
  for (const patch of [{ candidateLineageId: "B" }, { mainSlotId: "other" }, { revision: "changed" }]) {
    const f = adjustmentCommitFixture()
    const state = { ...f.base, ...patch }
    f.setState(state)
    expect((await createAdjustmentCommitController(f.adapter).commit(f.input)).kind).toBe("rejected")
    expect(f.adapter.readState()).toEqual(state)
    expect(f.writes()).toBe(0)
  }
})

it("rechecks safety after waiting for the owner's atomic write lock", async () => {
  const f = adjustmentCommitFixture()
  const controller = createAdjustmentCommitController({ ...f.adapter,
    compareAndSwap: async (before, next, validate) => {
      await Promise.resolve()
      f.setEnvironment({ ...f.environment, allowed: false })
      return f.adapter.compareAndSwap(before, next, validate)
    } })
  expect((await controller.commit(f.input)).kind).toBe("rejected")
  expect(f.writes()).toBe(0)
})

it("coalesces double apply and rejects a different concurrent intent", async () => {
  const f = adjustmentCommitFixture()
  let release!: () => void
  const wait = new Promise<void>(resolve => { release = resolve })
  const controller = createAdjustmentCommitController({ ...f.adapter,
    compareAndSwap: async (...args) => { await wait; return f.adapter.compareAndSwap(...args) } })
  const first = controller.commit(f.input)
  const second = controller.commit(f.input)
  expect(second).toBe(first)
  const other = await controller.commit({ ...f.input, base: { ...f.base, revision: "other" } })
  expect(other).toEqual({ kind: "rejected", code: "ADJUSTMENT_COMMIT_BUSY" })
  release()
  expect((await first).kind).toBe("committed")
  expect(f.writes()).toBe(1)
})

it("recovers a saved-but-unacknowledged commit without writing again", async () => {
  const f = adjustmentCommitFixture()
  const write = vi.fn(async (...args: Parameters<typeof f.adapter.compareAndSwap>) => {
    await f.adapter.compareAndSwap(...args)
    throw new Error("synthetic lost acknowledgement")
  })
  const controller = createAdjustmentCommitController({ ...f.adapter, compareAndSwap: write })
  expect((await controller.commit(f.input)).kind).toBe("rejected")
  expect((await controller.commit({ ...f.input, receipt: { ...f.applied.receipt, appliedAtMs: 151 } })).kind).toBe("replayed")
  expect(f.writes()).toBe(1)
  expect(write).toHaveBeenCalledOnce()
})

it("invalidates a queued commit when its editor is abandoned", async () => {
  const f = adjustmentCommitFixture()
  let release!: () => void
  const wait = new Promise<void>(resolve => { release = resolve })
  const controller = createAdjustmentCommitController({ ...f.adapter,
    compareAndSwap: async (...args) => { await wait; return f.adapter.compareAndSwap(...args) } })
  const commit = controller.commit(f.input)
  controller.invalidate()
  release()
  expect((await commit).kind).toBe("rejected")
  expect(f.writes()).toBe(0)
})

it("rejects hidden getters without evaluating them", async () => {
  const f = adjustmentCommitFixture()
  const input = { ...f.input }
  const getter = vi.fn(() => "private text")
  Object.defineProperty(input, "memo", { enumerable: true, get: getter })
  expect((await createAdjustmentCommitController(f.adapter).commit(input)).kind).toBe("rejected")
  expect(getter).not.toHaveBeenCalled()
  expect(f.writes()).toBe(0)
})

it("does not carry extra private fields into the committed snapshot or explanation", async () => {
  const f = adjustmentCommitFixture()
  const controller = createAdjustmentCommitController(f.adapter)
  expect((await controller.commit({ ...f.input, base: { ...f.base, memo: "private" } as typeof f.base })).kind).toBe("rejected")
  f.setEnvironment({ ...f.environment, explanations: f.environment.explanations.map(binding => ({ ...binding, memo: "private" })) })
  expect((await controller.commit(f.input)).kind).toBe("rejected")
  expect(f.writes()).toBe(0)
})
