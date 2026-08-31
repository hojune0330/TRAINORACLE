import {
  DECORATION_CATALOG,
  decorationStateSchema,
  isAvatarDecorationId,
  isInkDecorationId,
  isPlacementDecorationId,
  isThemeDecorationId,
  rememberDecorationUse,
} from "../../domain/decorations"
import { appendJournalDecoration, journalDecorationItems } from "../../domain/journal-decoration-state"
import type {
  DecorationCatalogItem,
  DecorationId,
  DecorationState,
} from "../../domain/decorations"

export const SITUATION_TABS = [
  { id: "RECOMMENDED", label: "추천 조합" },
  { id: "RECENT", label: "최근 사용" },
  { id: "FAVORITES", label: "즐겨찾기" },
  { id: "WEATHER", label: "날씨" },
  { id: "RECOVERY", label: "회복" },
  { id: "COMPETITION", label: "경기" },
  { id: "SEASON", label: "계절" },
  { id: "ALL", label: "모두" },
] as const

export type SituationTabId = (typeof SITUATION_TABS)[number]["id"]

export const TYPE_FILTERS = [
  { id: "ALL", label: "전체" },
  { id: "THEME", label: "테마" },
  { id: "STICKER", label: "스티커" },
  { id: "STAMP", label: "도장" },
  { id: "TAPE", label: "테이프" },
  { id: "INK", label: "글자색" },
  { id: "AVATAR", label: "아바타" },
  { id: "EMOJI_STICKER", label: "이모지" },
] as const

export type TypeFilterId = (typeof TYPE_FILTERS)[number]["id"]

export function moveDecorationDate(date: string, days: number): string {
  const selected = new Date(`${date}T12:00:00`)
  if (Number.isNaN(selected.getTime())) return date
  selected.setDate(selected.getDate() + days)
  const padded = (value: number) => String(value).padStart(2, "0")
  return `${selected.getFullYear()}-${padded(selected.getMonth() + 1)}-${padded(selected.getDate())}`
}

export type DecorationPreset = {
  readonly id: "LIGHT_DAY" | "RECOVERY_DAY" | "RAINY_DAY" | "COMPETITION_DAY"
  readonly name: string
  readonly description: string
  readonly itemIds: readonly DecorationId[]
}

export const DECORATION_PRESETS: readonly DecorationPreset[] = [
  { id: "LIGHT_DAY", name: "가벼운 날", description: "평범한 훈련 기록을 밝게 꾸며요.", itemIds: ["THEME_TRACK_NOTEBOOK", "STICKER_WEATHER_SUN", "INK_NAVY"] },
  { id: "RECOVERY_DAY", name: "회복한 날", description: "회복일 기록을 차분하게 정리해요.", itemIds: ["THEME_SKY_JOURNAL", "STAMP_REST_DAY"] },
  { id: "RAINY_DAY", name: "비 오는 날", description: "비 오는 날의 기록을 차분한 색으로 묶어요.", itemIds: ["THEME_SKY_JOURNAL", "TAPE_CHECKER", "INK_NAVY"] },
  { id: "COMPETITION_DAY", name: "경기 날", description: "경기 날짜와 그날의 느낌을 한눈에 남겨요.", itemIds: ["THEME_TRACK_NOTEBOOK", "STICKER_FINISH_LINE", "AVATAR_START_LINE"] },
]

/* 상황 탭에 이모지 그룹을 연결해 “오늘 붙일 만한 것”이 바로 보이게 한다. */
const SITUATION_ITEMS: Readonly<Record<Exclude<SituationTabId, "RECENT" | "FAVORITES" | "ALL" | "RECOMMENDED">, readonly DecorationId[]>> = {
  WEATHER: ["STICKER_WEATHER_SUN", "THEME_SKY_JOURNAL", "TAPE_CHECKER", "EMOJI_SUN", "EMOJI_SUN_CLOUD", "EMOJI_CLOUD", "EMOJI_RAIN", "EMOJI_SNOW"],
  RECOVERY: ["STAMP_REST_DAY", "THEME_SKY_JOURNAL", "INK_NAVY", "EMOJI_SLEEP", "EMOJI_BATH", "EMOJI_WATER", "EMOJI_SALAD", "EMOJI_BANDAGE"],
  COMPETITION: ["STICKER_FINISH_LINE", "AVATAR_START_LINE", "THEME_TRACK_NOTEBOOK", "EMOJI_FINISH", "EMOJI_MEDAL", "EMOJI_STADIUM", "EMOJI_PARTY", "EMOJI_FIRE"],
  SEASON: ["THEME_SKY_JOURNAL", "STICKER_WEATHER_SUN", "TAPE_CHECKER", "EMOJI_BLOSSOM", "EMOJI_FALLEN_LEAF", "EMOJI_MOON", "EMOJI_HOT", "EMOJI_COLD"],
}

export function visibleStudioItems(
  state: DecorationState,
  situation: SituationTabId,
  type: TypeFilterId,
): readonly DecorationCatalogItem[] {
  const situationIds = situation === "RECENT"
    ? state.library.recentItemIds
    : situation === "FAVORITES"
      ? state.library.favoriteItemIds
      : situation === "ALL" || situation === "RECOMMENDED"
        ? DECORATION_CATALOG.map((item) => item.id)
        : SITUATION_ITEMS[situation]
  return DECORATION_CATALOG.filter((item) => situationIds.includes(item.id) && (type === "ALL" || item.category === type))
}

export function previewDecorationItem(
  state: DecorationState,
  item: DecorationCatalogItem,
  date: string,
): DecorationState {
  if (isThemeDecorationId(item.id)) return { ...state, equipped: { ...state.equipped, themeId: item.id } }
  if (isInkDecorationId(item.id)) return { ...state, equipped: { ...state.equipped, inkId: item.id } }
  if (isAvatarDecorationId(item.id)) return { ...state, equipped: { ...state.equipped, avatarId: item.id } }
  if (!isPlacementDecorationId(item.id)) return state
  /* v3 자유 배치: 배열 끝에 추가(최상단). 상한 초과면 원본 그대로 돌려준다. */
  return appendJournalDecoration(state, date, item.id) ?? state
}

export function previewDecorationPreset(
  state: DecorationState,
  preset: DecorationPreset,
  date: string,
): DecorationState {
  return preset.itemIds.reduce((current, itemId) => {
    const item = DECORATION_CATALOG.find((candidate) => candidate.id === itemId)
    return item === undefined ? current : previewDecorationItem(current, item, date)
  }, state)
}

export function useOwnedDecorationItem(
  state: DecorationState,
  item: DecorationCatalogItem,
  date: string,
): DecorationState | null {
  if (!state.ownedItemIds.includes(item.id)) return null
  const previewed = previewDecorationItem(state, item, date)
  const remembered = rememberDecorationUse(previewed, item.id)
  const parsed = decorationStateSchema.safeParse(remembered)
  return parsed.success ? parsed.data : null
}

export function removeDecorationItem(
  state: DecorationState,
  item: DecorationCatalogItem,
  date: string,
): DecorationState | null {
  let next: DecorationState = state
  if (item.id === "THEME_SKY_JOURNAL") {
    next = { ...state, equipped: { ...state.equipped, themeId: "THEME_TRACK_NOTEBOOK" } }
  } else if (isAvatarDecorationId(item.id)) {
    next = { ...state, equipped: { ...state.equipped, avatarId: null } }
  } else if (isPlacementDecorationId(item.id)) {
    {
    const items = journalDecorationItems(state, date).filter((candidate) => candidate.itemId !== item.id)
    const others = state.pages.filter((page) => page.date !== date)
    next = { ...state, pages: items.length === 0 ? others : [...others, { date, items }] }
  }
  }
  const parsed = decorationStateSchema.safeParse(next)
  return parsed.success ? parsed.data : null
}

export function decorationItemActive(state: DecorationState, item: DecorationCatalogItem, date: string): boolean {
  if (isThemeDecorationId(item.id)) return state.equipped.themeId === item.id
  if (isInkDecorationId(item.id)) return state.equipped.inkId === item.id
  if (isAvatarDecorationId(item.id)) return state.equipped.avatarId === item.id
  return isPlacementDecorationId(item.id)
    && journalDecorationItems(state, date).some((placement) => placement.itemId === item.id)
}

export function missingPresetItems(state: DecorationState, preset: DecorationPreset): number {
  return preset.itemIds.filter((itemId) => !state.ownedItemIds.includes(itemId)).length
}
