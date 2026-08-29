/*
 * 이모지 스티커 전용 슬롯 3칸: 종이 다이어리의 "칸에 붙이는 스티커" 감성.
 * 슬롯이 3칸뿐이라 페이지당 이모지 밀도 상한(3개)이 스키마 수준에서
 * 구조적으로 강제된다 (검수 계약 2026-08-29 §5.1-2).
 */
export const EMOJI_STICKER_SLOTS = ["BODY_STICKER_1", "BODY_STICKER_2", "BODY_STICKER_3"] as const
export const DECORATION_SLOTS = ["HEADER_TAPE", "TOP_CORNER", "BODY_MARGIN", "PAGE_FOOTER", ...EMOJI_STICKER_SLOTS] as const
export type DecorationSlot = (typeof DECORATION_SLOTS)[number]
export type EmojiStickerSlot = (typeof EMOJI_STICKER_SLOTS)[number]

/*
 * 이모지 스티커: 유니코드 텍스트 렌더 전용(플랫폼 폰트 위임).
 * 특정 벤더(애플 등) 이모지 아트워크 번들 금지 — 저작권 침해.
 * ZWJ 합성·스킨톤 파생은 기기 폴백 검증 전까지 보류 (OI-EMOJI-2).
 */
export const EMOJI_STICKER_IDS = [
  "EMOJI_SUN", "EMOJI_SUN_CLOUD", "EMOJI_CLOUD", "EMOJI_RAIN", "EMOJI_SNOW", "EMOJI_BLOSSOM", "EMOJI_FALLEN_LEAF", "EMOJI_MOON",
  "EMOJI_MUSCLE", "EMOJI_LEG", "EMOJI_BANDAGE", "EMOJI_SWEAT", "EMOJI_HOT", "EMOJI_COLD", "EMOJI_SLEEP", "EMOJI_SICK",
  "EMOJI_RUNNER", "EMOJI_SINGLET", "EMOJI_SHOE", "EMOJI_STOPWATCH", "EMOJI_FINISH", "EMOJI_STADIUM", "EMOJI_MOUNTAIN", "EMOJI_ROAD",
  "EMOJI_SMILE", "EMOJI_DETERMINED", "EMOJI_CRY", "EMOJI_MOVED", "EMOJI_RELIEVED", "EMOJI_STARSTRUCK", "EMOJI_MEH", "EMOJI_MELT",
  "EMOJI_FIRE", "EMOJI_STAR", "EMOJI_MEDAL", "EMOJI_PARTY", "EMOJI_HUNDRED", "EMOJI_GLOW_STAR", "EMOJI_CLOVER", "EMOJI_HEART",
  "EMOJI_RICE", "EMOJI_NOODLE", "EMOJI_WATER", "EMOJI_BANANA", "EMOJI_COFFEE", "EMOJI_ICE", "EMOJI_BATH", "EMOJI_SALAD",
] as const
export type EmojiStickerId = (typeof EMOJI_STICKER_IDS)[number]

export const DECORATION_IDS = ["THEME_TRACK_NOTEBOOK", "INK_NAVY", "STICKER_WEATHER_SUN", "STAMP_REST_DAY", "TAPE_CHECKER", "THEME_SKY_JOURNAL", "STICKER_FINISH_LINE", "AVATAR_START_LINE", ...EMOJI_STICKER_IDS] as const
export type DecorationId = (typeof DECORATION_IDS)[number]
export const STARTER_DECORATION_IDS = ["THEME_TRACK_NOTEBOOK", "INK_NAVY", "STICKER_WEATHER_SUN", "STAMP_REST_DAY", "TAPE_CHECKER", ...EMOJI_STICKER_IDS] as const
export const PAID_DECORATION_IDS = ["THEME_SKY_JOURNAL", "STICKER_FINISH_LINE", "AVATAR_START_LINE"] as const
export const THEME_DECORATION_IDS = ["THEME_TRACK_NOTEBOOK", "THEME_SKY_JOURNAL"] as const
export const INK_DECORATION_IDS = ["INK_NAVY"] as const
export const AVATAR_DECORATION_IDS = ["AVATAR_START_LINE"] as const
export const PLACEMENT_DECORATION_IDS = ["STICKER_WEATHER_SUN", "STAMP_REST_DAY", "TAPE_CHECKER", "STICKER_FINISH_LINE", ...EMOJI_STICKER_IDS] as const
export type PaidDecorationId = (typeof PAID_DECORATION_IDS)[number]
export type ThemeDecorationId = (typeof THEME_DECORATION_IDS)[number]
export type InkDecorationId = (typeof INK_DECORATION_IDS)[number]
export type AvatarDecorationId = (typeof AVATAR_DECORATION_IDS)[number]
export type PlacementDecorationId = (typeof PLACEMENT_DECORATION_IDS)[number]

export const EMOJI_STICKER_GROUPS = [
  { id: "WEATHER_SEASON", label: "날씨·계절" },
  { id: "BODY_CONDITION", label: "몸·컨디션" },
  { id: "RUN_TRAINING", label: "달리기·훈련" },
  { id: "MOOD", label: "기분" },
  { id: "REWARD", label: "보상·기념" },
  { id: "FOOD_RECOVERY", label: "음식·회복" },
] as const
export type EmojiStickerGroupId = (typeof EMOJI_STICKER_GROUPS)[number]["id"]

export type DecorationCatalogItem = {
  readonly id: DecorationId
  readonly name: string
  readonly typeLabel: string
  readonly description: string
  readonly fallbackLabel: string
  readonly assetPath: string
  readonly category: "THEME" | "INK" | "STICKER" | "STAMP" | "TAPE" | "AVATAR" | "EMOJI_STICKER"
  readonly compatibleSlots: readonly DecorationSlot[]
  readonly cost: number
  readonly starterOwned: boolean
  /** EMOJI_STICKER 전용: NFC 정규화된 유니코드 문자. 텍스트로만 렌더한다. */
  readonly emoji?: string
  /** EMOJI_STICKER 전용: 픽커 그룹. */
  readonly emojiGroup?: EmojiStickerGroupId
}

type EmojiStickerDefinition = {
  readonly id: EmojiStickerId
  readonly emoji: string
  readonly name: string
  readonly group: EmojiStickerGroupId
}

/*
 * V1 큐레이션 48종 — 러너의 다이어리 어휘 (검수 계약 §5.2).
 * 전부 단일 코드포인트(+VS16)만: ZWJ 합성·스킨톤은 OI-EMOJI-2 검증 전 보류.
 * 확장은 시리즈(그룹 8종) 단위로만 한다.
 */
const EMOJI_STICKER_DEFINITIONS: readonly EmojiStickerDefinition[] = [
  { id: "EMOJI_SUN", emoji: "☀️", name: "해", group: "WEATHER_SEASON" },
  { id: "EMOJI_SUN_CLOUD", emoji: "🌤️", name: "구름 조금", group: "WEATHER_SEASON" },
  { id: "EMOJI_CLOUD", emoji: "☁️", name: "구름", group: "WEATHER_SEASON" },
  { id: "EMOJI_RAIN", emoji: "🌧️", name: "비", group: "WEATHER_SEASON" },
  { id: "EMOJI_SNOW", emoji: "❄️", name: "눈", group: "WEATHER_SEASON" },
  { id: "EMOJI_BLOSSOM", emoji: "🌸", name: "벚꽃", group: "WEATHER_SEASON" },
  { id: "EMOJI_FALLEN_LEAF", emoji: "🍂", name: "낙엽", group: "WEATHER_SEASON" },
  { id: "EMOJI_MOON", emoji: "🌙", name: "달", group: "WEATHER_SEASON" },
  { id: "EMOJI_MUSCLE", emoji: "💪", name: "힘", group: "BODY_CONDITION" },
  { id: "EMOJI_LEG", emoji: "🦵", name: "다리", group: "BODY_CONDITION" },
  { id: "EMOJI_BANDAGE", emoji: "🩹", name: "반창고", group: "BODY_CONDITION" },
  { id: "EMOJI_SWEAT", emoji: "💦", name: "땀", group: "BODY_CONDITION" },
  { id: "EMOJI_HOT", emoji: "🥵", name: "더위", group: "BODY_CONDITION" },
  { id: "EMOJI_COLD", emoji: "🥶", name: "추위", group: "BODY_CONDITION" },
  { id: "EMOJI_SLEEP", emoji: "😴", name: "졸림", group: "BODY_CONDITION" },
  { id: "EMOJI_SICK", emoji: "🤒", name: "몸살", group: "BODY_CONDITION" },
  { id: "EMOJI_RUNNER", emoji: "🏃", name: "달리기", group: "RUN_TRAINING" },
  { id: "EMOJI_SINGLET", emoji: "🎽", name: "러닝 싱글렛", group: "RUN_TRAINING" },
  { id: "EMOJI_SHOE", emoji: "👟", name: "운동화", group: "RUN_TRAINING" },
  { id: "EMOJI_STOPWATCH", emoji: "⏱️", name: "스톱워치", group: "RUN_TRAINING" },
  { id: "EMOJI_FINISH", emoji: "🏁", name: "결승 깃발", group: "RUN_TRAINING" },
  { id: "EMOJI_STADIUM", emoji: "🏟️", name: "경기장", group: "RUN_TRAINING" },
  { id: "EMOJI_MOUNTAIN", emoji: "⛰️", name: "산", group: "RUN_TRAINING" },
  { id: "EMOJI_ROAD", emoji: "🛣️", name: "도로", group: "RUN_TRAINING" },
  { id: "EMOJI_SMILE", emoji: "🙂", name: "미소", group: "MOOD" },
  { id: "EMOJI_DETERMINED", emoji: "😤", name: "각오", group: "MOOD" },
  { id: "EMOJI_CRY", emoji: "😭", name: "엉엉", group: "MOOD" },
  { id: "EMOJI_MOVED", emoji: "🥹", name: "울컥", group: "MOOD" },
  { id: "EMOJI_RELIEVED", emoji: "😌", name: "안도", group: "MOOD" },
  { id: "EMOJI_STARSTRUCK", emoji: "🤩", name: "반짝", group: "MOOD" },
  { id: "EMOJI_MEH", emoji: "😑", name: "무념", group: "MOOD" },
  { id: "EMOJI_MELT", emoji: "🫠", name: "녹아내림", group: "MOOD" },
  { id: "EMOJI_FIRE", emoji: "🔥", name: "불꽃", group: "REWARD" },
  { id: "EMOJI_STAR", emoji: "⭐", name: "별", group: "REWARD" },
  { id: "EMOJI_MEDAL", emoji: "🏅", name: "메달", group: "REWARD" },
  { id: "EMOJI_PARTY", emoji: "🎉", name: "축하", group: "REWARD" },
  { id: "EMOJI_HUNDRED", emoji: "💯", name: "백점", group: "REWARD" },
  { id: "EMOJI_GLOW_STAR", emoji: "🌟", name: "빛나는 별", group: "REWARD" },
  { id: "EMOJI_CLOVER", emoji: "🍀", name: "네잎클로버", group: "REWARD" },
  { id: "EMOJI_HEART", emoji: "❤️", name: "하트", group: "REWARD" },
  { id: "EMOJI_RICE", emoji: "🍚", name: "밥", group: "FOOD_RECOVERY" },
  { id: "EMOJI_NOODLE", emoji: "🍜", name: "국수", group: "FOOD_RECOVERY" },
  { id: "EMOJI_WATER", emoji: "💧", name: "물", group: "FOOD_RECOVERY" },
  { id: "EMOJI_BANANA", emoji: "🍌", name: "바나나", group: "FOOD_RECOVERY" },
  { id: "EMOJI_COFFEE", emoji: "☕", name: "커피", group: "FOOD_RECOVERY" },
  { id: "EMOJI_ICE", emoji: "🧊", name: "얼음", group: "FOOD_RECOVERY" },
  { id: "EMOJI_BATH", emoji: "🛁", name: "목욕", group: "FOOD_RECOVERY" },
  { id: "EMOJI_SALAD", emoji: "🥗", name: "샐러드", group: "FOOD_RECOVERY" },
]

function emojiStickerItems(): readonly DecorationCatalogItem[] {
  return EMOJI_STICKER_DEFINITIONS.map((definition) => ({
    id: definition.id,
    name: definition.name,
    typeLabel: "이모지 스티커",
    description: `${definition.name} 이모지를 페이지에 붙여요.`,
    fallbackLabel: `${definition.name} 이모지`,
    assetPath: "",
    category: "EMOJI_STICKER" as const,
    compatibleSlots: EMOJI_STICKER_SLOTS,
    cost: 0,
    starterOwned: true,
    emoji: definition.emoji.normalize("NFC"),
    emojiGroup: definition.group,
  }))
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
  ...emojiStickerItems(),
] as const satisfies readonly DecorationCatalogItem[]


function includesValue<T extends string>(values: readonly T[], candidate: string): candidate is T { return values.includes(candidate as T) }
export function isDecorationId(candidate: string): candidate is DecorationId { return includesValue(DECORATION_IDS, candidate) }
export function isPaidDecorationId(candidate: string): candidate is PaidDecorationId { return includesValue(PAID_DECORATION_IDS, candidate) }
export function isThemeDecorationId(candidate: string): candidate is ThemeDecorationId { return includesValue(THEME_DECORATION_IDS, candidate) }
export function isInkDecorationId(candidate: string): candidate is InkDecorationId { return includesValue(INK_DECORATION_IDS, candidate) }
export function isAvatarDecorationId(candidate: string): candidate is AvatarDecorationId { return includesValue(AVATAR_DECORATION_IDS, candidate) }
export function isPlacementDecorationId(candidate: string): candidate is PlacementDecorationId { return includesValue(PLACEMENT_DECORATION_IDS, candidate) }
export function isDecorationSlot(candidate: string): candidate is DecorationSlot { return includesValue(DECORATION_SLOTS, candidate) }
export function isEmojiStickerId(candidate: string): candidate is EmojiStickerId { return includesValue(EMOJI_STICKER_IDS, candidate) }
export function isEmojiStickerSlot(candidate: string): candidate is EmojiStickerSlot { return includesValue(EMOJI_STICKER_SLOTS, candidate) }
export function decorationCatalogItem(itemId: string): DecorationCatalogItem | undefined { return DECORATION_CATALOG.find((item) => item.id === itemId) }
