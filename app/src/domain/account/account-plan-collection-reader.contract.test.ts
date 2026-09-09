import { expect, it } from "vitest"
import { accountPlanEntry, emptyAccountPlanDocument } from "./account-plan-document-schema"
import { accountPlanPacketFixture } from "./account-plan.test-fixtures"
import { accountPlanCollectionPartHash, splitAccountPlanCollection, validateAccountPlanCollectionEntry,
  validateAccountPlanCollectionIndex, validateAccountPlanCollectionPart, validateAccountPlanCollectionUpdate } from "./account-plan-collection-schema"

function fixture() {
  const document = emptyAccountPlanDocument()
  document.data.plans.push(accountPlanEntry(accountPlanPacketFixture(3)))
  document.data.currentPlanId = document.data.plans[0]!.planId
  return { document, parts: splitAccountPlanCollection(document) }
}
it("reads the selected original and progress from two parts, not a full history wrapper", () => {
  const { document, parts } = fixture()
  expect(validateAccountPlanCollectionEntry(parts.index, parts.snapshots[0], parts.progress[0])).toEqual(document.data.plans[0])
  expect(validateAccountPlanCollectionIndex(parts.index)).toBe(true)
  expect(parts.snapshots.every(validateAccountPlanCollectionPart)).toBe(true)
  expect(parts.progress.every(validateAccountPlanCollectionPart)).toBe(true)
})
it("rejects missing/corrupt parts, duplicated references, wrong pointer and forged part identity", () => {
  const { parts } = fixture()
  expect(validateAccountPlanCollectionEntry(parts.index, null, parts.progress[0])).toBeNull()
  expect(validateAccountPlanCollectionPart({ ...parts.snapshots[0], id: accountPlanCollectionPartHash({}) })).toBe(false)
  expect(validateAccountPlanCollectionIndex({ ...parts.index, plans: [...parts.index.plans, ...parts.index.plans] })).toBe(false)
  expect(validateAccountPlanCollectionIndex({ ...parts.index, currentPlanId: accountPlanCollectionPartHash({}) })).toBe(false)
  expect(validateAccountPlanCollectionEntry(parts.index, parts.snapshots[0], { ...parts.progress[0], updatedAt: "garbage" })).toBeNull()
})
it("a valid rehashed archive may not be current and may not be rewritten later", () => {
  const { document, parts } = fixture(), changed = structuredClone(document)
  changed.data.currentPlanId = null
  changed.data.plans[0]!.archivedAt = new Date().toISOString()
  const archived = splitAccountPlanCollection(changed)
  expect(validateAccountPlanCollectionUpdate(parts, archived)).toBe(true)
  expect(validateAccountPlanCollectionUpdate(archived, parts)).toBe(false)
  expect(validateAccountPlanCollectionEntry({ ...archived.index, currentPlanId: document.data.currentPlanId },
    archived.snapshots[0], archived.progress[0])).toBeNull()
})
it("cannot drop a stored original through a newly rehashed empty collection", () => {
  expect(validateAccountPlanCollectionUpdate(fixture().parts, splitAccountPlanCollection(emptyAccountPlanDocument()))).toBe(false)
})
