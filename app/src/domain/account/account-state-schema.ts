import { accountDecorationDocumentSchema, validateAccountDecorationDocument } from "./account-decoration-schema"
import { decorationCatalogItem } from "../decoration-catalog"
import { validateAccountPlanDocument, validateAccountPlanDocumentUpdate } from "./account-plan-document-schema"
import { validateAccountCalendarDecorationDocument } from "./account-calendar-decoration-schema"
import { validateAccountAthleteRecordDocument, validateAccountAthleteRecordDocumentUpdate } from "./account-athlete-record-schema"
import { validateAccountRunningProfileDocument } from "./account-running-profile-schema"
import { validateAccountMinigameProgressDocument, validateAccountMinigameProgressUpdate } from "./account-minigame-progress-schema"
import { accountOracleV2DocumentSchema, validateOracleV2Migration, validateOracleV2Transition, validateInitialOracleV2Document } from "./account-oracle-v2-schema"
export { validateInitialOracleV2Document }
export { accountCalendarDecorationOwnershipMetadata } from "./account-calendar-decoration-schema"

export function validateAccountStateDocument(value: unknown): boolean {
  return accountOracleV2DocumentSchema.safeParse(value).success || validateAccountRunningProfileDocument(value) || validateAccountDecorationDocument(value) || validateAccountCalendarDecorationDocument(value) || validateAccountAthleteRecordDocument(value) || validateAccountPlanDocument(value)
    || validateAccountMinigameProgressDocument(value)
}

export function validateAccountStateDocumentUpdate(previous: unknown, next: unknown): boolean {
  if (accountOracleV2DocumentSchema.safeParse(previous).success) return validateOracleV2Transition(previous, next)
  if (validateAccountRunningProfileDocument(previous)) return validateAccountRunningProfileDocument(next) || validateOracleV2Migration(previous, next)
  if (validateAccountDecorationDocument(previous)) return validateAccountDecorationDocument(next)
  if (validateAccountCalendarDecorationDocument(previous)) return validateAccountCalendarDecorationDocument(next)
  if (validateAccountAthleteRecordDocument(previous)) return validateAccountAthleteRecordDocumentUpdate(previous, next)
  if (validateAccountMinigameProgressDocument(previous)) return validateAccountMinigameProgressUpdate(previous, next)
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
