import { webcrypto } from "node:crypto"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { syntheticGoalProgram } from "./account-goal-program.test-fixtures"
import { splitAccountGoalProgramCollection, joinAccountGoalProgramCollection, validateAccountGoalProgramDocument,
  validateAccountGoalProgramDocumentUpdate, accountGoalProgramDocumentId, ACCOUNT_GOAL_PROGRAM_MAX_BYTES } from "./account-goal-program-schema"
import { validateAccountGoalProgramCollectionUpdate } from "./account-goal-program-schema"

// Full source recipe replay for nineteen originals is deliberately not mocked.
vi.setConfig({ testTimeout: 60_000 })

beforeEach(() => vi.stubGlobal("crypto", webcrypto))
afterEach(() => vi.unstubAllGlobals())
it("round trips all original frames and progress without changing execution state", () => {
  const document = syntheticGoalProgram(), history = { version: 1 as const, entries: [] }
  const split = splitAccountGoalProgramCollection(document, history)
  expect(split.parts).toHaveLength(2)
  expect(split.parts.every(validateAccountGoalProgramDocument)).toBe(true)
  expect(joinAccountGoalProgramCollection(split.index, split.parts)).toEqual({ document, history })
})
it("splits a full 18-program archive into bounded documents and a small index", () => {
  const document = syntheticGoalProgram(18), history = { version: 1 as const,
    entries: Array.from({ length: 18 }, (_, index) => ({ archivedAt: "2026-10-10T01:00:00.000Z", document: syntheticGoalProgram(index) })) }
  expect(new TextEncoder().encode(JSON.stringify({ document, history })).byteLength).toBeGreaterThan(ACCOUNT_GOAL_PROGRAM_MAX_BYTES)
  const split = splitAccountGoalProgramCollection(document, history)
  expect(split.parts).toHaveLength(38)
  expect(split.parts.every(part => new TextEncoder().encode(JSON.stringify(part)).byteLength <= ACCOUNT_GOAL_PROGRAM_MAX_BYTES)).toBe(true)
  expect(joinAccountGoalProgramCollection(split.index, split.parts)).toEqual({ document, history })
})
it("rejects missing, swapped, altered or unknown referenced bytes", () => {
  const split = splitAccountGoalProgramCollection(syntheticGoalProgram(), { version: 1, entries: [] })
  expect(joinAccountGoalProgramCollection(split.index, split.parts.slice(1))).toBeNull()
  const other = splitAccountGoalProgramCollection(syntheticGoalProgram(1), { version: 1, entries: [] })
  expect(joinAccountGoalProgramCollection(split.index, other.parts)).toBeNull()
  const altered = structuredClone(split.parts[1]!)
  altered.data.id = `sha256:${"0".repeat(64)}`
  expect(validateAccountGoalProgramDocument(altered)).toBe(false)
  expect(validateAccountGoalProgramDocument({ ...split.index, version: 4 })).toBe(false)
})
it("rejects silent archive loss and immutable body rewrites", () => {
  const old = splitAccountGoalProgramCollection(syntheticGoalProgram(), { version: 1, entries: [{ archivedAt: "2026-10-10T01:00:00.000Z", document: syntheticGoalProgram(1) }] })
  const next = splitAccountGoalProgramCollection(syntheticGoalProgram(2), { version: 1, entries: [] })
  expect(validateAccountGoalProgramDocumentUpdate(old.index, next.index)).toBe(false)
  expect(validateAccountGoalProgramDocumentUpdate(old.parts[0], next.parts[0])).toBe(false)
})
it("binds both physical kind and content identity to its authenticated owner", async () => {
  const split = splitAccountGoalProgramCollection(syntheticGoalProgram(), { version: 1, entries: [] }), a = "a1111111-1111-4111-8111-111111111111", b = "b2222222-2222-4222-8222-222222222222"
  expect(await accountGoalProgramDocumentId(a)).not.toBe(await accountGoalProgramDocumentId(b))
  expect(await accountGoalProgramDocumentId(a, split.parts[0]!.kind, split.parts[0]!.data.id))
    .not.toBe(await accountGoalProgramDocumentId(b, split.parts[0]!.kind, split.parts[0]!.data.id))
})
it("resolves the actual immutable progress to reject revision rewind, application rewind and ended-cycle restart", () => {
  const original = syntheticGoalProgram(), selected = structuredClone(original)
  selected.revision = 1
  selected.application = { appliedAt: "2026-10-10T01:00:00.000Z", currentCycleIndex: 1 }
  selected.cycles[0] = { ...selected.cycles[0], status: "CURRENT", latestPlan: selected.program.frames[0]!.plan }
  const before = splitAccountGoalProgramCollection(selected, { version: 1, entries: [] })
  const old = splitAccountGoalProgramCollection(original, { version: 1, entries: [] })
  expect(validateAccountGoalProgramDocumentUpdate(before.index, old.index)).toBe(true)
  expect(validateAccountGoalProgramCollectionUpdate(before.index, before.parts, old.index, old.parts)).toBe(false)
  original.revision = 2
  const rewound = splitAccountGoalProgramCollection(original, { version: 1, entries: [] })
  expect(validateAccountGoalProgramCollectionUpdate(before.index, before.parts, rewound.index, rewound.parts)).toBe(false)
  const ended = structuredClone(selected); ended.revision = 2; ended.cycles[0].status = "ENDED"
  const archived = splitAccountGoalProgramCollection(ended, { version: 1, entries: [] })
  selected.revision = 3
  const restarted = splitAccountGoalProgramCollection(selected, { version: 1, entries: [] })
  expect(validateAccountGoalProgramCollectionUpdate(archived.index, archived.parts, restarted.index, restarted.parts)).toBe(false)
})
