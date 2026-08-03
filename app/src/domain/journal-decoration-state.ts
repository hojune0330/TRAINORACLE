import {
  decorationStateSchema,
  isAvatarDecorationId,
  isInkDecorationId,
  isPlacementDecorationId,
  isThemeDecorationId,
  rememberDecorationUse,
} from "./decorations"
import type {
  DecorationCatalogItem,
  DecorationSlot,
  DecorationState,
} from "./decorations"

function candidateState(
  state: DecorationState,
  item: DecorationCatalogItem,
  date: string,
  slot?: DecorationSlot,
): unknown {
  if (isThemeDecorationId(item.id)) {
    return { ...state, equipped: { ...state.equipped, themeId: item.id } }
  }
  if (isInkDecorationId(item.id)) {
    return { ...state, equipped: { ...state.equipped, inkId: item.id } }
  }
  if (isAvatarDecorationId(item.id)) {
    return { ...state, equipped: { ...state.equipped, avatarId: item.id } }
  }
  if (!isPlacementDecorationId(item.id)) return state
  const targetSlot = slot ?? item.compatibleSlots[0]
  if (targetSlot === undefined || !item.compatibleSlots.includes(targetSlot)) return null
  return {
    ...state,
    pagePlacements: [
      ...state.pagePlacements.filter((placement) => placement.date !== date || placement.slot !== targetSlot),
      { date, slot: targetSlot, itemId: item.id },
    ],
  }
}

export function previewJournalDecoration(
  state: DecorationState,
  item: DecorationCatalogItem,
  date: string,
  slot?: DecorationSlot,
): DecorationState | null {
  const candidate = candidateState(state, item, date, slot)
  if (candidate === null) return null
  if (isThemeDecorationId(item.id)) {
    return { ...state, equipped: { ...state.equipped, themeId: item.id } }
  }
  if (isInkDecorationId(item.id)) {
    return { ...state, equipped: { ...state.equipped, inkId: item.id } }
  }
  if (isAvatarDecorationId(item.id)) {
    return { ...state, equipped: { ...state.equipped, avatarId: item.id } }
  }
  const parsed = decorationStateSchema.safeParse(candidate)
  return parsed.success ? parsed.data : null
}

export function applyJournalDecoration(
  state: DecorationState,
  item: DecorationCatalogItem,
  date: string,
  slot?: DecorationSlot,
): DecorationState | null {
  if (!state.ownedItemIds.includes(item.id)) return null
  const previewed = previewJournalDecoration(state, item, date, slot)
  if (previewed === null) return null
  return rememberDecorationUse(previewed, item.id)
}

export function removeJournalDecoration(
  state: DecorationState,
  item: DecorationCatalogItem,
  date: string,
): DecorationState | null {
  if (!isPlacementDecorationId(item.id)) return null
  const parsed = decorationStateSchema.safeParse({
    ...state,
    pagePlacements: state.pagePlacements.filter(
      (placement) => placement.date !== date || placement.itemId !== item.id,
    ),
  })
  return parsed.success ? parsed.data : null
}
