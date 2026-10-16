import { afterEach, expect, it } from "vitest"
import { TRAINING_COMPANIONS_V1 } from "./training-companion-collection"
import { createEmptyDecorationState, decorationStateSchema } from "./decoration-schema"
import { loadDecorationState, purchaseCollectionBundle } from "./decoration-store"

afterEach(() => localStorage.clear())
it("claims all nine companions explicitly with zero points and restores the same ownership", () => {
  const empty = createEmptyDecorationState()
  expect(empty.ownedItemIds).not.toContain("COMPANION_OTTER_RUN")
  const result = purchaseCollectionBundle(0, empty, TRAINING_COMPANIONS_V1.id, "2026-10-15")
  expect(result.kind).toBe("PURCHASED")
  if (result.kind !== "PURCHASED") throw new Error(result.kind)
  expect(result.cost).toBe(0)
  expect(result.state.spentPoints).toBe(0)
  expect(result.itemIds).toHaveLength(9)
  const restored = decorationStateSchema.parse(loadDecorationState())
  for (const item of TRAINING_COMPANIONS_V1.items) expect(restored.ownedItemIds).toContain(item.id)
  expect(purchaseCollectionBundle(0, restored, TRAINING_COMPANIONS_V1.id, "2026-10-15").kind).toBe("ALREADY_OWNED")
})
