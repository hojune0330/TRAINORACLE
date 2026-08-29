export const DECORATION_SLOTS = ["HEADER_TAPE", "TOP_CORNER", "BODY_MARGIN", "PAGE_FOOTER"] as const
export type DecorationSlot = (typeof DECORATION_SLOTS)[number]

export const DECORATION_IDS = ["THEME_TRACK_NOTEBOOK", "INK_NAVY", "STICKER_WEATHER_SUN", "STAMP_REST_DAY", "TAPE_CHECKER", "THEME_SKY_JOURNAL", "STICKER_FINISH_LINE", "AVATAR_START_LINE"] as const
export type DecorationId = (typeof DECORATION_IDS)[number]
export const STARTER_DECORATION_IDS = ["THEME_TRACK_NOTEBOOK", "INK_NAVY", "STICKER_WEATHER_SUN", "STAMP_REST_DAY", "TAPE_CHECKER"] as const
export const PAID_DECORATION_IDS = ["THEME_SKY_JOURNAL", "STICKER_FINISH_LINE", "AVATAR_START_LINE"] as const
export const THEME_DECORATION_IDS = ["THEME_TRACK_NOTEBOOK", "THEME_SKY_JOURNAL"] as const
export const INK_DECORATION_IDS = ["INK_NAVY"] as const
export const AVATAR_DECORATION_IDS = ["AVATAR_START_LINE"] as const
export const PLACEMENT_DECORATION_IDS = ["STICKER_WEATHER_SUN", "STAMP_REST_DAY", "TAPE_CHECKER", "STICKER_FINISH_LINE"] as const
export type PaidDecorationId = (typeof PAID_DECORATION_IDS)[number]
export type ThemeDecorationId = (typeof THEME_DECORATION_IDS)[number]
export type InkDecorationId = (typeof INK_DECORATION_IDS)[number]
export type AvatarDecorationId = (typeof AVATAR_DECORATION_IDS)[number]
export type PlacementDecorationId = (typeof PLACEMENT_DECORATION_IDS)[number]

export type DecorationCatalogItem = {
  readonly id: DecorationId
  readonly name: string
  readonly typeLabel: string
  readonly description: string
  readonly fallbackLabel: string
  readonly assetPath: string
  readonly category: "THEME" | "INK" | "STICKER" | "STAMP" | "TAPE" | "AVATAR"
  readonly compatibleSlots: readonly DecorationSlot[]
  readonly cost: number
  readonly starterOwned: boolean
}

export const DECORATION_CATALOG = [
  { id: "THEME_TRACK_NOTEBOOK", name: "트랙 노트", typeLabel: "페이지 테마", description: "기록을 차분하게 읽는 기본 테마예요.", fallbackLabel: "트랙 노트 미리보기", assetPath: "decorations/theme-track-notebook.webp", category: "THEME", compatibleSlots: [], cost: 0, starterOwned: true },
  { id: "INK_NAVY", name: "남색 잉크", typeLabel: "글자색", description: "조용하고 또렷한 기본 잉크색이에요.", fallbackLabel: "남색 잉크 예시", assetPath: "decorations/ink-navy.webp", category: "INK", compatibleSlots: [], cost: 0, starterOwned: true },
  { id: "STICKER_WEATHER_SUN", name: "맑은 날", typeLabel: "스티커", description: "가벼운 날씨를 보여 주는 스티커예요.", fallbackLabel: "맑은 날 예시", assetPath: "decorations/sticker-weather-sun.webp", category: "STICKER", compatibleSlots: ["TOP_CORNER", "BODY_MARGIN"], cost: 0, starterOwned: true },
  { id: "STAMP_REST_DAY", name: "푹 쉬었어요", typeLabel: "도장", description: "회복과 쉼을 보여 주는 도장이에요.", fallbackLabel: "푹 쉬었어요 예시", assetPath: "decorations/stamp-rest-day.webp", category: "STAMP", compatibleSlots: ["PAGE_FOOTER"], cost: 0, starterOwned: true },
  { id: "TAPE_CHECKER", name: "체크 테이프", typeLabel: "마스킹 테이프", description: "페이지의 시작을 정리하는 테이프예요.", fallbackLabel: "체크 테이프 예시", assetPath: "decorations/tape-checker.webp", category: "TAPE", compatibleSlots: ["HEADER_TAPE"], cost: 0, starterOwned: true },
  { id: "THEME_SKY_JOURNAL", name: "하늘 일지 테마", typeLabel: "페이지 테마", description: "회복 페이지에 어울리는 맑은 배경이에요.", fallbackLabel: "하늘 일지 테마 예시", assetPath: "decorations/theme-sky-journal.webp", category: "THEME", compatibleSlots: [], cost: 12, starterOwned: false },
  { id: "STICKER_FINISH_LINE", name: "결승선 스티커", typeLabel: "스티커", description: "기록의 마무리를 보여 주는 스티커예요.", fallbackLabel: "결승선 스티커 예시", assetPath: "decorations/sticker-finish-line.webp", category: "STICKER", compatibleSlots: ["TOP_CORNER", "BODY_MARGIN"], cost: 8, starterOwned: false },
  { id: "AVATAR_START_LINE", name: "출발선 아바타", typeLabel: "아바타", description: "일지 첫머리에 출발선을 표시하는 작은 아바타예요.", fallbackLabel: "출발선 아바타 예시", assetPath: "decorations/avatar-start-line.webp", category: "AVATAR", compatibleSlots: [], cost: 20, starterOwned: false },
] as const satisfies readonly DecorationCatalogItem[]

function includesValue<T extends string>(values: readonly T[], candidate: string): candidate is T { return values.includes(candidate as T) }
export function isDecorationId(candidate: string): candidate is DecorationId { return includesValue(DECORATION_IDS, candidate) }
export function isPaidDecorationId(candidate: string): candidate is PaidDecorationId { return includesValue(PAID_DECORATION_IDS, candidate) }
export function isThemeDecorationId(candidate: string): candidate is ThemeDecorationId { return includesValue(THEME_DECORATION_IDS, candidate) }
export function isInkDecorationId(candidate: string): candidate is InkDecorationId { return includesValue(INK_DECORATION_IDS, candidate) }
export function isAvatarDecorationId(candidate: string): candidate is AvatarDecorationId { return includesValue(AVATAR_DECORATION_IDS, candidate) }
export function isPlacementDecorationId(candidate: string): candidate is PlacementDecorationId { return includesValue(PLACEMENT_DECORATION_IDS, candidate) }
export function isDecorationSlot(candidate: string): candidate is DecorationSlot { return includesValue(DECORATION_SLOTS, candidate) }
export function decorationCatalogItem(itemId: string): DecorationCatalogItem | undefined { return DECORATION_CATALOG.find((item) => item.id === itemId) }
