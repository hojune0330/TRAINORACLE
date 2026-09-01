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

export const THEME_DECORATION_IDS = [
  "THEME_TRACK_NOTEBOOK", "THEME_SKY_JOURNAL", "THEME_GRID_FIELD",
  "THEME_DAWN_RUN", "THEME_FOREST_TRAIL", "THEME_RACE_DAY",
] as const
export const TAPE_DECORATION_IDS = [
  "TAPE_CHECKER", "TAPE_SAGE_SOLID", "TAPE_DIAGONAL",
  "TAPE_DOT_GRID", "TAPE_TRACK_LANE", "TAPE_MOUNTAIN",
] as const
export const STICKER_DECORATION_IDS = [
  "STICKER_WEATHER_SUN", "STICKER_FINISH_LINE", "STICKER_RUNNING_SHOE",
  "STICKER_WATER_BOTTLE", "STICKER_STOPWATCH_DOODLE", "STICKER_HEART_RATE",
  "STICKER_TRAIL_TREE", "STICKER_MEDAL_RIBBON", "STICKER_NIGHT_MOON",
  "STICKER_BANDAGE_CARE",
] as const
export const STAMP_DECORATION_IDS = [
  "STAMP_REST_DAY", "STAMP_DONE_CHECK", "STAMP_PERSONAL_BEST", "STAMP_EARLY_BIRD",
  "STAMP_RAIN_RUN", "STAMP_LONG_RUN", "STAMP_INTERVAL", "STAMP_RECOVERY",
] as const
export const INK_DECORATION_IDS = ["INK_NAVY"] as const
export const AVATAR_DECORATION_IDS = [
  "AVATAR_START_LINE", "AVATAR_EASY_JOG", "AVATAR_SPRINTER", "AVATAR_STRETCHING",
] as const

/* 34개 그림 자산 + 이미지 대신 색으로 보여 주는 INK_NAVY 스와치 1개. */
export const DECORATION_IDS = [
  ...THEME_DECORATION_IDS,
  ...TAPE_DECORATION_IDS,
  ...STICKER_DECORATION_IDS,
  ...STAMP_DECORATION_IDS,
  ...INK_DECORATION_IDS,
  ...AVATAR_DECORATION_IDS,
  ...EMOJI_STICKER_IDS,
] as const
export type DecorationId = (typeof DECORATION_IDS)[number]
export const STARTER_DECORATION_IDS = [
  "THEME_TRACK_NOTEBOOK", "THEME_GRID_FIELD",
  "TAPE_CHECKER", "TAPE_SAGE_SOLID", "TAPE_DIAGONAL",
  "STICKER_WEATHER_SUN", "STICKER_RUNNING_SHOE", "STICKER_WATER_BOTTLE",
  "STICKER_STOPWATCH_DOODLE", "STICKER_BANDAGE_CARE",
  "STAMP_REST_DAY", "STAMP_DONE_CHECK", "STAMP_RECOVERY",
  "INK_NAVY", "AVATAR_EASY_JOG", "AVATAR_STRETCHING",
  ...EMOJI_STICKER_IDS,
] as const
export const PAID_DECORATION_IDS = [
  "THEME_SKY_JOURNAL", "THEME_DAWN_RUN", "THEME_FOREST_TRAIL", "THEME_RACE_DAY",
  "TAPE_DOT_GRID", "TAPE_TRACK_LANE", "TAPE_MOUNTAIN",
  "STICKER_FINISH_LINE", "STICKER_HEART_RATE", "STICKER_TRAIL_TREE",
  "STICKER_MEDAL_RIBBON", "STICKER_NIGHT_MOON",
  "STAMP_PERSONAL_BEST", "STAMP_EARLY_BIRD", "STAMP_RAIN_RUN", "STAMP_LONG_RUN",
  "STAMP_INTERVAL", "AVATAR_START_LINE", "AVATAR_SPRINTER",
] as const
export const PLACEMENT_DECORATION_IDS = [
  ...STICKER_DECORATION_IDS,
  ...STAMP_DECORATION_IDS,
  ...TAPE_DECORATION_IDS,
  ...EMOJI_STICKER_IDS,
] as const
export type PaidDecorationId = (typeof PAID_DECORATION_IDS)[number]
export type ThemeDecorationId = (typeof THEME_DECORATION_IDS)[number]
export type TapeDecorationId = (typeof TAPE_DECORATION_IDS)[number]
export type StickerDecorationId = (typeof STICKER_DECORATION_IDS)[number]
export type StampDecorationId = (typeof STAMP_DECORATION_IDS)[number]
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
  { id: "THEME_TRACK_NOTEBOOK", name: "트랙 노트", typeLabel: "페이지 테마", description: "줄노트처럼 훈련 내용을 차분하게 정리해요.", fallbackLabel: "트랙 노트 미리보기", assetPath: "decorations/theme-track-notebook.webp", category: "THEME", compatibleSlots: [], cost: 0, starterOwned: true },
  { id: "THEME_SKY_JOURNAL", name: "하늘 일지 테마", typeLabel: "페이지 테마", description: "하늘색 배경으로 회복 기록을 정리해요.", fallbackLabel: "하늘 일지 테마 예시", assetPath: "decorations/theme-sky-journal.webp", category: "THEME", compatibleSlots: [], cost: 12, starterOwned: false },
  { id: "THEME_GRID_FIELD", name: "모눈 연습장", typeLabel: "페이지 테마", description: "옅은 모눈 위에 훈련 수치와 메모를 반듯하게 정리해요.", fallbackLabel: "모눈 연습장 미리보기", assetPath: "decorations/theme-grid-field.webp", category: "THEME", compatibleSlots: [], cost: 0, starterOwned: true },
  { id: "THEME_DAWN_RUN", name: "새벽 러닝", typeLabel: "페이지 테마", description: "동트는 수평선을 아래에만 얹어 본문 여백을 지켜요.", fallbackLabel: "새벽 러닝 테마 미리보기", assetPath: "decorations/theme-dawn-run.webp", category: "THEME", compatibleSlots: [], cost: 12, starterOwned: false },
  { id: "THEME_FOREST_TRAIL", name: "숲길 트레일", typeLabel: "페이지 테마", description: "아래 모서리의 숲 선화로 트레일 기록을 구분해요.", fallbackLabel: "숲길 트레일 테마 미리보기", assetPath: "decorations/theme-forest-trail.webp", category: "THEME", compatibleSlots: [], cost: 12, starterOwned: false },
  { id: "THEME_RACE_DAY", name: "레이스 데이", typeLabel: "페이지 테마", description: "체커 리본 모서리로 경기 날 기록을 표시해요.", fallbackLabel: "레이스 데이 테마 미리보기", assetPath: "decorations/theme-race-day.webp", category: "THEME", compatibleSlots: [], cost: 12, starterOwned: false },

  { id: "TAPE_CHECKER", name: "체크 테이프", typeLabel: "마스킹 테이프", description: "페이지 위쪽을 구분하는 차분한 체크무늬 테이프예요.", fallbackLabel: "체크 테이프 예시", assetPath: "decorations/tape-checker.webp", category: "TAPE", compatibleSlots: ["HEADER_TAPE"], cost: 0, starterOwned: true },
  { id: "TAPE_SAGE_SOLID", name: "세이지 무지", typeLabel: "마스킹 테이프", description: "옅은 세이지색 종이 테이프로 기록 영역을 담백하게 나눠요.", fallbackLabel: "세이지 무지 테이프 예시", assetPath: "decorations/tape-sage-solid.webp", category: "TAPE", compatibleSlots: ["HEADER_TAPE"], cost: 0, starterOwned: true },
  { id: "TAPE_DIAGONAL", name: "사선 줄무늬", typeLabel: "마스킹 테이프", description: "가는 남색 사선으로 페이지 위쪽에 리듬을 더해요.", fallbackLabel: "사선 줄무늬 테이프 예시", assetPath: "decorations/tape-diagonal.webp", category: "TAPE", compatibleSlots: ["HEADER_TAPE"], cost: 0, starterOwned: true },
  { id: "TAPE_DOT_GRID", name: "점 테이프", typeLabel: "마스킹 테이프", description: "작은 도트가 반복되는 종이 테이프예요.", fallbackLabel: "점 테이프 예시", assetPath: "decorations/tape-dot-grid.webp", category: "TAPE", compatibleSlots: ["HEADER_TAPE"], cost: 4, starterOwned: false },
  { id: "TAPE_TRACK_LANE", name: "트랙 레인", typeLabel: "마스킹 테이프", description: "트랙 레인 선으로 육상 훈련일을 또렷하게 표시해요.", fallbackLabel: "트랙 레인 테이프 예시", assetPath: "decorations/tape-track-lane.webp", category: "TAPE", compatibleSlots: ["HEADER_TAPE"], cost: 8, starterOwned: false },
  { id: "TAPE_MOUNTAIN", name: "능선 테이프", typeLabel: "마스킹 테이프", description: "낮은 산 능선 선화가 이어지는 테이프예요.", fallbackLabel: "능선 테이프 예시", assetPath: "decorations/tape-mountain.webp", category: "TAPE", compatibleSlots: ["HEADER_TAPE"], cost: 8, starterOwned: false },

  { id: "STICKER_WEATHER_SUN", name: "맑은 날", typeLabel: "스티커", description: "맑았던 날의 일지 여백에 붙이는 날씨 스티커예요.", fallbackLabel: "맑은 날 예시", assetPath: "decorations/sticker-weather-sun.webp", category: "STICKER", compatibleSlots: ["TOP_CORNER", "BODY_MARGIN"], cost: 0, starterOwned: true },
  { id: "STICKER_FINISH_LINE", name: "결승선 스티커", typeLabel: "스티커", description: "경기나 중요한 훈련을 마친 날에 붙여요.", fallbackLabel: "결승선 스티커 예시", assetPath: "decorations/sticker-finish-line.webp", category: "STICKER", compatibleSlots: ["TOP_CORNER", "BODY_MARGIN"], cost: 8, starterOwned: false },
  { id: "STICKER_RUNNING_SHOE", name: "러닝화 한 켤레", typeLabel: "스티커", description: "달린 날을 바로 알아볼 수 있는 러닝화 스티커예요.", fallbackLabel: "러닝화 스티커 예시", assetPath: "decorations/sticker-running-shoe.webp", category: "STICKER", compatibleSlots: ["TOP_CORNER", "BODY_MARGIN"], cost: 0, starterOwned: true },
  { id: "STICKER_WATER_BOTTLE", name: "물병", typeLabel: "스티커", description: "수분 보충을 기억하고 싶은 날에 붙여요.", fallbackLabel: "물병 스티커 예시", assetPath: "decorations/sticker-water-bottle.webp", category: "STICKER", compatibleSlots: ["TOP_CORNER", "BODY_MARGIN"], cost: 0, starterOwned: true },
  { id: "STICKER_STOPWATCH_DOODLE", name: "스톱워치 낙서", typeLabel: "스티커", description: "기록을 재거나 반복 훈련을 한 날에 붙여요.", fallbackLabel: "스톱워치 스티커 예시", assetPath: "decorations/sticker-stopwatch-doodle.webp", category: "STICKER", compatibleSlots: ["TOP_CORNER", "BODY_MARGIN"], cost: 0, starterOwned: true },
  { id: "STICKER_HEART_RATE", name: "심박 곡선", typeLabel: "스티커", description: "심박 흐름을 살펴본 날에 붙이는 한 줄 곡선이에요.", fallbackLabel: "심박 곡선 스티커 예시", assetPath: "decorations/sticker-heart-rate.webp", category: "STICKER", compatibleSlots: ["TOP_CORNER", "BODY_MARGIN"], cost: 4, starterOwned: false },
  { id: "STICKER_TRAIL_TREE", name: "가로수", typeLabel: "스티커", description: "공원이나 숲길을 달린 날에 어울리는 나무 스티커예요.", fallbackLabel: "가로수 스티커 예시", assetPath: "decorations/sticker-trail-tree.webp", category: "STICKER", compatibleSlots: ["TOP_CORNER", "BODY_MARGIN"], cost: 4, starterOwned: false },
  { id: "STICKER_MEDAL_RIBBON", name: "완주 메달", typeLabel: "스티커", description: "레이스 완주나 기억할 성취가 있던 날에 붙여요.", fallbackLabel: "완주 메달 스티커 예시", assetPath: "decorations/sticker-medal-ribbon.webp", category: "STICKER", compatibleSlots: ["TOP_CORNER", "BODY_MARGIN"], cost: 8, starterOwned: false },
  { id: "STICKER_NIGHT_MOON", name: "야간 러닝 달", typeLabel: "스티커", description: "밤에 달린 기록을 초승달과 별로 표시해요.", fallbackLabel: "야간 러닝 달 스티커 예시", assetPath: "decorations/sticker-night-moon.webp", category: "STICKER", compatibleSlots: ["TOP_CORNER", "BODY_MARGIN"], cost: 4, starterOwned: false },
  { id: "STICKER_BANDAGE_CARE", name: "회복 반창고", typeLabel: "스티커", description: "회복과 몸 돌봄을 우선한 날에 붙여요.", fallbackLabel: "회복 반창고 스티커 예시", assetPath: "decorations/sticker-bandage-care.webp", category: "STICKER", compatibleSlots: ["TOP_CORNER", "BODY_MARGIN"], cost: 0, starterOwned: true },

  { id: "STAMP_REST_DAY", name: "푹 쉬었어요", typeLabel: "도장", description: "휴식이나 회복을 기록한 날에 찍는 도장이에요.", fallbackLabel: "푹 쉬었어요 예시", assetPath: "decorations/stamp-rest-day.webp", category: "STAMP", compatibleSlots: ["PAGE_FOOTER"], cost: 0, starterOwned: true },
  { id: "STAMP_DONE_CHECK", name: "해냈다", typeLabel: "도장", description: "계획한 기록을 마친 날에 체크 도장을 남겨요.", fallbackLabel: "해냈다 도장 예시", assetPath: "decorations/stamp-done-check.webp", category: "STAMP", compatibleSlots: ["PAGE_FOOTER"], cost: 0, starterOwned: true },
  { id: "STAMP_PERSONAL_BEST", name: "자기 최고", typeLabel: "도장", description: "개인 최고 기록을 남긴 날에 월계수 도장을 찍어요.", fallbackLabel: "자기 최고 도장 예시", assetPath: "decorations/stamp-personal-best.webp", category: "STAMP", compatibleSlots: ["PAGE_FOOTER"], cost: 8, starterOwned: false },
  { id: "STAMP_EARLY_BIRD", name: "새벽 기상", typeLabel: "도장", description: "이른 시간에 움직인 날을 떠오르는 해로 표시해요.", fallbackLabel: "새벽 기상 도장 예시", assetPath: "decorations/stamp-early-bird.webp", category: "STAMP", compatibleSlots: ["PAGE_FOOTER"], cost: 4, starterOwned: false },
  { id: "STAMP_RAIN_RUN", name: "우중 완주", typeLabel: "도장", description: "비 오는 날 달린 기록에 빗방울과 발자국을 남겨요.", fallbackLabel: "우중 완주 도장 예시", assetPath: "decorations/stamp-rain-run.webp", category: "STAMP", compatibleSlots: ["PAGE_FOOTER"], cost: 4, starterOwned: false },
  { id: "STAMP_LONG_RUN", name: "롱런", typeLabel: "도장", description: "긴 거리를 달린 날에 이어지는 길 도장을 찍어요.", fallbackLabel: "롱런 도장 예시", assetPath: "decorations/stamp-long-run.webp", category: "STAMP", compatibleSlots: ["PAGE_FOOTER"], cost: 4, starterOwned: false },
  { id: "STAMP_INTERVAL", name: "인터벌", typeLabel: "도장", description: "빠른 구간과 회복을 반복한 날에 파형 도장을 찍어요.", fallbackLabel: "인터벌 도장 예시", assetPath: "decorations/stamp-interval.webp", category: "STAMP", compatibleSlots: ["PAGE_FOOTER"], cost: 4, starterOwned: false },
  { id: "STAMP_RECOVERY", name: "회복 완료", typeLabel: "도장", description: "몸을 돌보고 회복 기록을 마친 날에 새싹 도장을 찍어요.", fallbackLabel: "회복 완료 도장 예시", assetPath: "decorations/stamp-recovery.webp", category: "STAMP", compatibleSlots: ["PAGE_FOOTER"], cost: 0, starterOwned: true },

  { id: "INK_NAVY", name: "남색 잉크", typeLabel: "글자색", description: "일지 본문을 또렷한 남색으로 보여 줘요.", fallbackLabel: "남색 잉크 예시", assetPath: "decorations/ink-navy.webp", category: "INK", compatibleSlots: [], cost: 0, starterOwned: true },

  { id: "AVATAR_START_LINE", name: "출발선 아바타", typeLabel: "아바타", description: "출발선에 선 러너를 일지 위쪽에 보여 줘요.", fallbackLabel: "출발선 아바타 예시", assetPath: "decorations/avatar-start-line.webp", category: "AVATAR", compatibleSlots: [], cost: 20, starterOwned: false },
  { id: "AVATAR_EASY_JOG", name: "조깅 아바타", typeLabel: "아바타", description: "편안하게 조깅하는 중립 러너 동작을 보여 줘요.", fallbackLabel: "조깅 아바타 예시", assetPath: "decorations/avatar-easy-jog.webp", category: "AVATAR", compatibleSlots: [], cost: 0, starterOwned: true },
  { id: "AVATAR_SPRINTER", name: "스퍼트 아바타", typeLabel: "아바타", description: "빠르게 가속하는 중립 러너 동작을 보여 줘요.", fallbackLabel: "스퍼트 아바타 예시", assetPath: "decorations/avatar-sprinter.webp", category: "AVATAR", compatibleSlots: [], cost: 20, starterOwned: false },
  { id: "AVATAR_STRETCHING", name: "스트레칭 아바타", typeLabel: "아바타", description: "훈련 뒤 몸을 푸는 중립 러너 동작을 보여 줘요.", fallbackLabel: "스트레칭 아바타 예시", assetPath: "decorations/avatar-stretching.webp", category: "AVATAR", compatibleSlots: [], cost: 0, starterOwned: true },
  ...emojiStickerItems(),
] as const satisfies readonly DecorationCatalogItem[]


/*
 * ── 텍스트 스티커 (P5 계약 §1) ──
 * 사용자 입력 텍스트 아이템. 상점·보유·비용 개념이 없는 사용자 콘텐츠라
 * 카탈로그 배치 ID 집합에 넣지 않고 전용 리터럴로 분리한다 (계약 T1).
 */
export const TEXT_STICKER_ITEM_ID = "TEXT_STICKER" as const
export const TEXT_STICKER_MAX_LENGTH = 20

/* 전용 잉크 팔레트 6색 (계약 T5) — 종이 톤(--paper #F7F3E8) 위 대비 4.5:1 이상. */
export const TEXT_INK_IDS = [
  "TEXT_INK_NAVY",
  "TEXT_INK_BLACK",
  "TEXT_INK_RED",
  "TEXT_INK_GREEN",
  "TEXT_INK_VIOLET",
  "TEXT_INK_ORANGE",
] as const
export type TextInkId = (typeof TEXT_INK_IDS)[number]

export const TEXT_INK_DEFINITIONS: readonly { readonly id: TextInkId; readonly name: string; readonly color: string }[] = [
  { id: "TEXT_INK_NAVY", name: "남색", color: "#1F3A5F" },
  { id: "TEXT_INK_BLACK", name: "먹색", color: "#26241F" },
  { id: "TEXT_INK_RED", name: "다홍", color: "#B3372E" },
  { id: "TEXT_INK_GREEN", name: "초록", color: "#2E6B4F" },
  { id: "TEXT_INK_VIOLET", name: "보라", color: "#5B4A8A" },
  { id: "TEXT_INK_ORANGE", name: "주황", color: "#B4632A" },
]

export function textInkColor(inkId: TextInkId): string {
  return TEXT_INK_DEFINITIONS.find((definition) => definition.id === inkId)?.color ?? "#1F3A5F"
}

function includesValue<T extends string>(values: readonly T[], candidate: string): candidate is T { return values.includes(candidate as T) }
export function isTextInkId(candidate: string): candidate is TextInkId { return includesValue(TEXT_INK_IDS, candidate) }
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
