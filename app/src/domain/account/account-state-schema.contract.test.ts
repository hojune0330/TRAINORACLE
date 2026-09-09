import { expect, it } from "vitest"
import { createEmptyDecorationState } from "../decoration-schema"
import { DECORATION_CATALOG } from "../decoration-catalog"
import { accountDecorationPurchaseMetadata } from "./account-state-schema"

it("derives purchases only from the compiled catalog, never supplied prices", () => {
  const state = createEmptyDecorationState()
  const free = { version: 3, state: "ACCOUNT_STATE", kind: "DECORATIONS", data: state }
  expect(accountDecorationPurchaseMetadata(free)).toEqual({ purchases: [], spentPoints: 0 })
  const paid = DECORATION_CATALOG.find(item => item.cost > 0)!
  const data = { ...state, ownedItemIds: [...state.ownedItemIds, paid.id], spentPoints: paid.cost }
  expect(accountDecorationPurchaseMetadata({ ...free, data })).toEqual({
    purchases: [{ itemId: paid.id, cost: paid.cost }], spentPoints: paid.cost,
  })
  expect(() => accountDecorationPurchaseMetadata({ ...free, data: { ...data, price: 0 } })).toThrow()
  expect(() => accountDecorationPurchaseMetadata({ ...free, data: { ...data, spentPoints: 0 } })).toThrow()
})
