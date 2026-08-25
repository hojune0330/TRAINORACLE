export {
  AVATAR_DECORATION_IDS,
  DECORATION_CATALOG,
  DECORATION_IDS,
  DECORATION_SLOTS,
  INK_DECORATION_IDS,
  PAID_DECORATION_IDS,
  PLACEMENT_DECORATION_IDS,
  STARTER_DECORATION_IDS,
  THEME_DECORATION_IDS,
  decorationCatalogItem,
  isAvatarDecorationId,
  isDecorationId,
  isDecorationSlot,
  isInkDecorationId,
  isPaidDecorationId,
  isPlacementDecorationId,
  isThemeDecorationId,
} from "./decoration-catalog"
export type {
  AvatarDecorationId,
  DecorationCatalogItem,
  DecorationId,
  DecorationSlot,
  InkDecorationId,
  PaidDecorationId,
  PlacementDecorationId,
  ThemeDecorationId,
} from "./decoration-catalog"
export {
  createEmptyDecorationState,
  decorationStateSchema,
  isCompatiblePlacement,
  migrateLegacyDecorationState,
  parseStoredDecorationState,
} from "./decoration-schema"
export type { DecorationPagePlacement, DecorationState } from "./decoration-schema"
export {
  DECORATION_STORAGE_KEY_V1,
  DECORATION_STORAGE_KEY_V2,
  activeDecorationStorageKeyV1,
  activeDecorationStorageKeyV2,
  decorationItemOwned,
  loadDecorationState,
  readDecorationStateSerialized,
  purchaseDecoration,
  rememberDecorationUse,
  saveDecorationState,
  saveDecorationStateIfCurrent,
  toggleFavoriteDecoration,
} from "./decoration-store"
export type {
  DecorationPurchase,
  DecorationSaveFailureCode,
  DecorationSaveResult,
} from "./decoration-store"
