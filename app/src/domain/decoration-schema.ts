import { z } from "zod"
import {
  AVATAR_DECORATION_IDS,
  DECORATION_IDS,
  INK_DECORATION_IDS,
  PLACEMENT_DECORATION_IDS,
  STARTER_DECORATION_IDS,
  THEME_DECORATION_IDS,
  decorationCatalogItem,
  minimumSpentPointsForOwned,
  isAvatarDecorationId,
  isDecorationId,
  isDecorationSlot,
  isInkDecorationId,
  isPaidDecorationId,
  isPlacementDecorationId,
  isThemeDecorationId,
} from "./decoration-catalog"
import {
  TEXT_INK_IDS,
  TEXT_STICKER_ITEM_ID,
  TEXT_STICKER_MAX_LENGTH,
} from "./decoration-catalog"
import type { DecorationId, DecorationSlot, PlacementDecorationId } from "./decoration-catalog"

const pointMeaningSchema = z.literal("NON_ECONOMIC_NON_TRANSFERABLE_BETA")
const decorationIdSchema = z.enum(DECORATION_IDS)
const themeIdSchema = z.enum(THEME_DECORATION_IDS)
const inkIdSchema = z.enum(INK_DECORATION_IDS)
const avatarIdSchema = z.enum(AVATAR_DECORATION_IDS)
const placementItemIdSchema = z.enum(PLACEMENT_DECORATION_IDS)
const isoDateSchema = z.string().refine((value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) return false
  const [yearText, monthText, dayText] = value.split("-")
  const year = Number(yearText)
  const month = Number(monthText)
  const day = Number(dayText)
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day
}, "invalid calendar date")

/*
 * v3 범위 (마이그레이션 계약 §2 C4~C6): 위치 4~96%, 크기 0.3~3.0, 회전 ±180°.
 * -180과 180은 시각적으로 같지만 정규화하지 않는다 — 저장·복원 왕복 안정성이 우선이다.
 */
export const decorationPlacementTransformSchema = z.object({
  xPercent: z.number().min(4).max(96),
  yPercent: z.number().min(4).max(96),
  scale: z.number().min(0.3).max(3),
  rotationDeg: z.number().min(-180).max(180),
}).strict().readonly()

/* 페이지당 상한 (계약 §2 C1) — 저장 크기 팽창과 렌더 부하 방어선. */
export const MAX_DECORATION_ITEMS_PER_PAGE = 24

const uniqueIds = (ids: readonly string[]): boolean => new Set(ids).size === ids.length

/*
 * v3 자유 배치 (계약 §2): 슬롯 없음, 같은 아이템 복수 허용,
 * 배열 순서 = 렌더 순서(마지막이 최상단), transform 필수.
 */
const catalogPageItemSchema = z.object({
  itemId: placementItemIdSchema,
  transform: decorationPlacementTransformSchema,
}).strict().readonly()

/*
 * 텍스트 스티커 (P5 계약 §1): 사용자 입력 텍스트 1~20자(trim 후 판정) +
 * 전용 잉크 6색. strict 판별 유니온으로 일반 아이템에 text 오염을 막는다 (T10).
 */
export const textStickerTextSchema = z.string()
  .min(1)
  .max(TEXT_STICKER_MAX_LENGTH)
  .refine((value) => value.trim().length > 0, "blank text")
const textInkIdSchema = z.enum(TEXT_INK_IDS)
const textPageItemSchema = z.object({
  itemId: z.literal(TEXT_STICKER_ITEM_ID),
  text: textStickerTextSchema,
  inkId: textInkIdSchema,
  transform: decorationPlacementTransformSchema,
}).strict().readonly()

const pageItemSchema = z.union([catalogPageItemSchema, textPageItemSchema])

const decorationPageSchema = z.object({
  date: isoDateSchema,
  items: z.array(pageItemSchema).min(1).max(MAX_DECORATION_ITEMS_PER_PAGE).readonly(),
}).strict().readonly()

const equippedSchema = z.object({
  themeId: themeIdSchema,
  inkId: inkIdSchema,
  avatarId: avatarIdSchema.nullable(),
}).strict().readonly()

const librarySchema = z.object({
  favoriteItemIds: z.array(decorationIdSchema).refine(uniqueIds).readonly(),
  recentItemIds: z.array(decorationIdSchema).max(8).refine(uniqueIds).readonly(),
}).strict().readonly()

export const decorationStateSchema = z.object({
  version: z.literal(3),
  spentPoints: z.number().int().nonnegative(),
  ownedItemIds: z.array(decorationIdSchema).refine(uniqueIds).readonly(),
  equipped: equippedSchema,
  library: librarySchema,
  pages: z.array(decorationPageSchema).readonly(),
  pointMeaning: pointMeaningSchema,
}).strict().superRefine((state, context) => {
  const owned = new Set(state.ownedItemIds)
  for (const starterId of STARTER_DECORATION_IDS) {
    if (!owned.has(starterId)) context.addIssue({ code: "custom", message: `missing starter ${starterId}` })
  }
  /* 보상·시즌 지급분은 0, 컬렉션은 번들 할인을 인정한 하한 — 계산은 카탈로그의 단일 함수에 위임한다. */
  const minimumSpentPoints = minimumSpentPointsForOwned(state.ownedItemIds)
  if (state.spentPoints < minimumSpentPoints) {
    context.addIssue({ code: "custom", message: "paid ownership exceeds spent points" })
  }

  const referenced = [
    state.equipped.themeId,
    ...(state.equipped.avatarId === null ? [] : [state.equipped.avatarId]),
    ...state.library.favoriteItemIds,
    ...state.library.recentItemIds,
    ...state.pages.flatMap((page) => page.items.map((item) => item.itemId)),
  ]
  for (const itemId of referenced) {
    if (isPaidDecorationId(itemId) && !owned.has(itemId)) {
      context.addIssue({ code: "custom", message: `unowned paid reference ${itemId}` })
    }
  }

  const seenDates = new Set<string>()
  for (const page of state.pages) {
    if (seenDates.has(page.date)) context.addIssue({ code: "custom", message: `duplicate page ${page.date}` })
    seenDates.add(page.date)
  }
}).readonly()

export type DecorationState = z.infer<typeof decorationStateSchema>
export type DecorationPage = z.infer<typeof decorationPageSchema>
export type DecorationPageItem = z.infer<typeof pageItemSchema>
export type DecorationTextPageItem = z.infer<typeof textPageItemSchema>

export function isTextStickerPageItem(item: DecorationPageItem): item is DecorationTextPageItem {
  return item.itemId === TEXT_STICKER_ITEM_ID
}
export type DecorationPlacementTransform = z.infer<typeof decorationPlacementTransformSchema>

/* ── v2 → v3 변환표 (계약 §3): 슬롯 기본 좌표. v2 렌더 레이어 순서와 동일한 고정 순서. ── */
const V2_SLOT_ORDER = [
  "HEADER_TAPE",
  "TOP_CORNER",
  "BODY_MARGIN",
  "PAGE_FOOTER",
  "BODY_STICKER_1",
  "BODY_STICKER_2",
  "BODY_STICKER_3",
] as const

export const V2_SLOT_DEFAULT_TRANSFORMS: Readonly<Record<DecorationSlot, DecorationPlacementTransform>> = {
  HEADER_TAPE: { xPercent: 50, yPercent: 9, scale: 1, rotationDeg: 0 },
  TOP_CORNER: { xPercent: 86, yPercent: 14, scale: 1, rotationDeg: 0 },
  BODY_MARGIN: { xPercent: 88, yPercent: 48, scale: 1, rotationDeg: 0 },
  PAGE_FOOTER: { xPercent: 50, yPercent: 91, scale: 1, rotationDeg: 0 },
  BODY_STICKER_1: { xPercent: 24, yPercent: 84, scale: 1, rotationDeg: -4 },
  BODY_STICKER_2: { xPercent: 50, yPercent: 84, scale: 1, rotationDeg: 3 },
  BODY_STICKER_3: { xPercent: 76, yPercent: 84, scale: 1, rotationDeg: -2 },
}

/* ── 저장 원본(신뢰 불가) 파서들 ── */

const storedV3ShapeSchema = z.object({
  version: z.literal(3),
  spentPoints: z.number().int().nonnegative(),
  ownedItemIds: z.array(z.string()),
  equipped: z.object({
    themeId: z.string(),
    inkId: z.string(),
    avatarId: z.string().nullable(),
  }).strict(),
  library: z.object({
    favoriteItemIds: z.array(z.string()),
    recentItemIds: z.array(z.string()),
  }).strict(),
  pages: z.array(z.unknown()),
  pointMeaning: pointMeaningSchema,
}).strict()

const storedV3PageShapeSchema = z.object({
  date: isoDateSchema,
  items: z.array(z.unknown()),
}).strict()

const storedV3ItemShapeSchema = z.object({
  itemId: z.string(),
  transform: z.unknown(),
}).strict()

const storedV3TextItemShapeSchema = z.object({
  itemId: z.literal(TEXT_STICKER_ITEM_ID),
  text: z.string(),
  inkId: z.string(),
  transform: z.unknown(),
}).strict()

const storedV2ShapeSchema = z.object({
  version: z.literal(2),
  spentPoints: z.number().int().nonnegative(),
  ownedItemIds: z.array(z.string()),
  equipped: z.object({
    themeId: z.string(),
    inkId: z.string(),
    avatarId: z.string().nullable(),
  }).strict(),
  library: z.object({
    favoriteItemIds: z.array(z.string()),
    recentItemIds: z.array(z.string()),
  }).strict(),
  pagePlacements: z.array(z.unknown()),
  pointMeaning: pointMeaningSchema,
}).strict()

/* v2 transform 범위(크기 0.6~2, 회전 ±45)는 v3 범위의 부분집합 — v3 스키마로 그대로 검증한다. */
const storedV2PlacementShapeSchema = z.object({
  date: isoDateSchema,
  slot: z.string(),
  itemId: z.string(),
  transform: z.unknown().optional(),
}).strict()

const legacyStateSchema = z.object({
  version: z.literal(1),
  spentPoints: z.number().int().nonnegative(),
  ownedItemIds: z.array(z.string()),
  pointMeaning: pointMeaningSchema,
}).strict()

function parseJson(raw: string): unknown | null {
  try {
    return JSON.parse(raw)
  } catch (error) {
    if (error instanceof SyntaxError) return null
    throw error
  }
}

function uniqueUsableIds(ids: readonly string[], owned: ReadonlySet<DecorationId>): DecorationId[] {
  const result: DecorationId[] = []
  for (const itemId of ids) {
    if (!isDecorationId(itemId)) continue
    if (isPaidDecorationId(itemId) && !owned.has(itemId)) continue
    if (!result.includes(itemId)) result.push(itemId)
  }
  return result
}

function normalizedOwnedIds(ids: readonly string[]): DecorationId[] {
  return DECORATION_IDS.filter((itemId) => !isPaidDecorationId(itemId) || ids.includes(itemId))
}

function normalizedEquipped(input: { themeId: string; inkId: string; avatarId: string | null }, owned: ReadonlySet<DecorationId>) {
  const themeId = isThemeDecorationId(input.themeId) && owned.has(input.themeId)
    ? input.themeId
    : "THEME_TRACK_NOTEBOOK"
  const inkId = isInkDecorationId(input.inkId) ? input.inkId : "INK_NAVY"
  const avatarId = input.avatarId !== null
    && isAvatarDecorationId(input.avatarId)
    && owned.has(input.avatarId)
    ? input.avatarId
    : null
  return { themeId, inkId, avatarId }
}

/* v3 페이지 정규화: 깨진 아이템은 건너뛰고, 상한 초과분은 뒤에서 자르고, 빈 페이지는 버린다. */
function normalizedPages(rows: readonly unknown[], owned: ReadonlySet<DecorationId>): DecorationPage[] {
  const result: DecorationPage[] = []
  const seenDates = new Set<string>()
  for (const row of rows) {
    const page = storedV3PageShapeSchema.safeParse(row)
    if (!page.success) continue
    if (seenDates.has(page.data.date)) continue
    seenDates.add(page.data.date)
    const items: DecorationPageItem[] = []
    for (const candidate of page.data.items) {
      if (items.length >= MAX_DECORATION_ITEMS_PER_PAGE) break
      /* 텍스트 스티커 먼저 시도 — text/inkId 필드가 있으면 이 경로만 유효하다 (P5 T10). */
      const textItem = storedV3TextItemShapeSchema.safeParse(candidate)
      if (textItem.success) {
        const parsed = textPageItemSchema.safeParse(textItem.data)
        if (parsed.success) items.push(parsed.data)
        continue
      }
      const item = storedV3ItemShapeSchema.safeParse(candidate)
      if (!item.success) continue
      const { itemId, transform } = item.data
      if (!isPlacementDecorationId(itemId)) continue
      if (isPaidDecorationId(itemId) && !owned.has(itemId)) continue
      const parsedTransform = decorationPlacementTransformSchema.safeParse(transform)
      if (!parsedTransform.success) continue
      items.push({ itemId, transform: parsedTransform.data })
    }
    if (items.length > 0) result.push({ date: page.data.date, items })
  }
  return result
}

function normalizeStoredV3(input: z.infer<typeof storedV3ShapeSchema>): DecorationState | null {
  const ownedItemIds = normalizedOwnedIds(input.ownedItemIds)
  const owned = new Set(ownedItemIds)
  const normalized = {
    version: 3,
    spentPoints: input.spentPoints,
    ownedItemIds,
    equipped: normalizedEquipped(input.equipped, owned),
    library: {
      favoriteItemIds: uniqueUsableIds(input.library.favoriteItemIds, owned),
      recentItemIds: uniqueUsableIds(input.library.recentItemIds, owned).slice(0, 8),
    },
    pages: normalizedPages(input.pages, owned),
    pointMeaning: input.pointMeaning,
  }
  const parsed = decorationStateSchema.safeParse(normalized)
  return parsed.success ? parsed.data : null
}

/*
 * v2 → v3 마이그레이션 (계약 §3): placement에 transform이 있으면 그대로,
 * 없으면 슬롯 기본 좌표. 같은 날짜의 슬롯들은 v2 레이어 순서로 배열에 쌓는다.
 */
function migratedPagesFromV2(rows: readonly unknown[], owned: ReadonlySet<DecorationId>): DecorationPage[] {
  type V2Row = { readonly date: string; readonly slot: DecorationSlot; readonly itemId: PlacementDecorationId; readonly transform: DecorationPlacementTransform | undefined }
  const valid: V2Row[] = []
  const occupiedSlots = new Set<string>()
  for (const row of rows) {
    const parsed = storedV2PlacementShapeSchema.safeParse(row)
    if (!parsed.success) continue
    const { date, slot, itemId, transform } = parsed.data
    if (!isDecorationSlot(slot) || !isPlacementDecorationId(itemId)) continue
    if (isPaidDecorationId(itemId) && !owned.has(itemId)) continue
    const item = decorationCatalogItem(itemId)
    if (item === undefined || !item.compatibleSlots.some((candidate) => candidate === slot)) continue
    const key = `${date}:${slot}`
    if (occupiedSlots.has(key)) continue
    occupiedSlots.add(key)
    const parsedTransform = decorationPlacementTransformSchema.safeParse(transform)
    valid.push({ date, slot, itemId, transform: parsedTransform.success ? parsedTransform.data : undefined })
  }
  const dates = [...new Set(valid.map((row) => row.date))]
  return dates.map((date) => ({
    date,
    items: V2_SLOT_ORDER.flatMap((slot) => {
      const row = valid.find((candidate) => candidate.date === date && candidate.slot === slot)
      if (row === undefined) return []
      return [{ itemId: row.itemId, transform: row.transform ?? V2_SLOT_DEFAULT_TRANSFORMS[slot] }]
    }),
  })).filter((page) => page.items.length > 0)
}

function normalizeStoredV2(input: z.infer<typeof storedV2ShapeSchema>): DecorationState | null {
  const ownedItemIds = normalizedOwnedIds(input.ownedItemIds)
  const owned = new Set(ownedItemIds)
  const normalized = {
    version: 3,
    spentPoints: input.spentPoints,
    ownedItemIds,
    equipped: normalizedEquipped(input.equipped, owned),
    library: {
      favoriteItemIds: uniqueUsableIds(input.library.favoriteItemIds, owned),
      recentItemIds: uniqueUsableIds(input.library.recentItemIds, owned).slice(0, 8),
    },
    pages: migratedPagesFromV2(input.pagePlacements, owned),
    pointMeaning: input.pointMeaning,
  }
  const parsed = decorationStateSchema.safeParse(normalized)
  return parsed.success ? parsed.data : null
}

export function createEmptyDecorationState(): DecorationState {
  const parsed = decorationStateSchema.parse({
    version: 3,
    spentPoints: 0,
    ownedItemIds: [...STARTER_DECORATION_IDS],
    equipped: { themeId: "THEME_TRACK_NOTEBOOK", inkId: "INK_NAVY", avatarId: null },
    library: { favoriteItemIds: [], recentItemIds: [] },
    pages: [],
    pointMeaning: "NON_ECONOMIC_NON_TRANSFERABLE_BETA",
  })
  return parsed
}

/** v3 저장 원본을 파싱한다 — v3 키 전용. */
export function parseStoredDecorationStateV3(raw: string): DecorationState | null {
  const json = parseJson(raw)
  const parsed = storedV3ShapeSchema.safeParse(json)
  return parsed.success ? normalizeStoredV3(parsed.data) : null
}

/** v2 저장 원본(또는 v2 백업 파일 섹션)을 읽어 v3 상태로 마이그레이션한다. */
export function parseStoredDecorationStateV2(raw: string): DecorationState | null {
  const json = parseJson(raw)
  const parsed = storedV2ShapeSchema.safeParse(json)
  return parsed.success ? normalizeStoredV2(parsed.data) : null
}

/** 저장 원본을 버전 무관하게 읽는다 — v3 우선, 실패 시 v2 마이그레이션 시도. */
export function parseStoredDecorationState(raw: string): DecorationState | null {
  return parseStoredDecorationStateV3(raw) ?? parseStoredDecorationStateV2(raw)
}

export function migrateLegacyDecorationState(raw: string): DecorationState | null {
  const json = parseJson(raw)
  const parsed = legacyStateSchema.safeParse(json)
  if (!parsed.success) return null
  /* 보유 목록 순서는 저장 로드 경로와 동일하게 카탈로그 순서로 통일한다. */
  const candidate = {
    ...createEmptyDecorationState(),
    spentPoints: parsed.data.spentPoints,
    ownedItemIds: normalizedOwnedIds(parsed.data.ownedItemIds),
  }
  const state = decorationStateSchema.safeParse(candidate)
  return state.success ? state.data : null
}

export function isCompatiblePlacement(itemId: PlacementDecorationId, slot: DecorationSlot): boolean {
  const item = decorationCatalogItem(itemId)
  return item?.compatibleSlots.some((candidate) => candidate === slot) === true
}
