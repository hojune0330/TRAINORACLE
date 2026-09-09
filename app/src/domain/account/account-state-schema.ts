import { accountDecorationDocumentSchema, validateAccountDecorationDocument } from "./account-decoration-schema"
import { decorationCatalogItem } from "../decoration-catalog"
import { validateAccountPlanDocument, validateAccountPlanDocumentUpdate } from "./account-plan-document-schema"

export function validateAccountStateDocument(value: unknown): boolean {
  return validateAccountDecorationDocument(value) || validateAccountPlanDocument(value)
}

export function validateAccountStateDocumentUpdate(previous: unknown, next: unknown): boolean {
  if (validateAccountDecorationDocument(previous)) return validateAccountDecorationDocument(next)
  return validateAccountPlanDocumentUpdate(previous, next)
}

export function accountDecorationPurchaseMetadata(value: unknown) {
  const parsed = accountDecorationDocumentSchema.safeParse(value)
  if (!parsed.success) throw new Error("INVALID_DECORATION_DOCUMENT")
  return {
    purchases: parsed.data.data.ownedItemIds.flatMap(itemId => {
      const item = decorationCatalogItem(itemId)
      if (!item) throw new Error("INVALID_DECORATION_CATALOG_ITEM")
      return item.cost > 0 ? [{ itemId, cost: item.cost }] : []
    }).sort((a, b) => a.itemId.localeCompare(b.itemId, "en")),
    spentPoints: parsed.data.data.spentPoints,
  }
}
