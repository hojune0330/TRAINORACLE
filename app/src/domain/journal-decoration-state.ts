import {
  decorationStateSchema,
  isAvatarDecorationId,
  isEmojiStickerId,
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

/*
 * 이모지 스티커는 전용 슬롯 3칸 중 비어 있는 첫 칸을 고른다.
 * 세 칸이 모두 차면 첫 칸을 돌려줘서 교체 확인 흐름을 타게 한다.
 * 다른 장식은 기존처럼 첫 호환 슬롯을 쓴다.
 */
export function resolveJournalDecorationSlot(
  state: DecorationState,
  item: DecorationCatalogItem,
  date: string,
  slot?: DecorationSlot,
): DecorationSlot | undefined {
  if (slot !== undefined) return slot
  if (!isEmojiStickerId(item.id)) return item.compatibleSlots[0]
  const occupied = new Set(
    state.pagePlacements.filter((placement) => placement.date === date).map((placement) => placement.slot),
  )
  return item.compatibleSlots.find((candidate) => !occupied.has(candidate)) ?? item.compatibleSlots[0]
}

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
  const targetSlot = resolveJournalDecorationSlot(state, item, date, slot)
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
