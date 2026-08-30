import { z } from "zod"
import {
  AVATAR_DECORATION_IDS,
  DECORATION_IDS,
  DECORATION_SLOTS,
  INK_DECORATION_IDS,
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
import type { DecorationId, DecorationSlot, PlacementDecorationId } from "./decoration-catalog"

const pointMeaningSchema = z.literal("NON_ECONOMIC_NON_TRANSFERABLE_BETA")
const decorationIdSchema = z.enum(DECORATION_IDS)
const themeIdSchema = z.enum(THEME_DECORATION_IDS)
const inkIdSchema = z.enum(INK_DECORATION_IDS)
const avatarIdSchema = z.enum(AVATAR_DECORATION_IDS)
const slotSchema = z.enum(DECORATION_SLOTS)
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

export const decorationPlacementTransformSchema = z.object({
  xPercent: z.number().min(4).max(96),
  yPercent: z.number().min(4).max(96),
  scale: z.number().min(0.6).max(2),
  rotationDeg: z.number().min(-45).max(45),
}).strict().readonly()

const uniqueIds = (ids: readonly string[]): boolean => new Set(ids).size === ids.length

const pagePlacementSchema = z.object({
  date: isoDateSchema,
  slot: slotSchema,
  itemId: placementItemIdSchema,
  transform: decorationPlacementTransformSchema.optional(),
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
  version: z.literal(2),
  spentPoints: z.number().int().nonnegative(),
  ownedItemIds: z.array(decorationIdSchema).refine(uniqueIds).readonly(),
  equipped: equippedSchema,
  library: librarySchema,
  pagePlacements: z.array(pagePlacementSchema).readonly(),
  pointMeaning: pointMeaningSchema,
}).strict().superRefine((state, context) => {
  const owned = new Set(state.ownedItemIds)
  for (const starterId of STARTER_DECORATION_IDS) {
    if (!owned.has(starterId)) context.addIssue({ code: "custom", message: `missing starter ${starterId}` })
  }
  const minimumSpentPoints = state.ownedItemIds.reduce(
    (total, itemId) => total + (decorationCatalogItem(itemId)?.cost ?? 0),
    0,
  )
  if (state.spentPoints < minimumSpentPoints) {
    context.addIssue({ code: "custom", message: "paid ownership exceeds spent points" })
  }

  const referenced = [
    state.equipped.themeId,
    ...(state.equipped.avatarId === null ? [] : [state.equipped.avatarId]),
    ...state.library.favoriteItemIds,
    ...state.library.recentItemIds,
    ...state.pagePlacements.map((placement) => placement.itemId),
  ]
  for (const itemId of referenced) {
    if (isPaidDecorationId(itemId) && !owned.has(itemId)) {
      context.addIssue({ code: "custom", message: `unowned paid reference ${itemId}` })
    }
  }

  const occupiedSlots = new Set<string>()
  for (const placement of state.pagePlacements) {
    const key = `${placement.date}:${placement.slot}`
    if (occupiedSlots.has(key)) context.addIssue({ code: "custom", message: `duplicate slot ${key}` })
    occupiedSlots.add(key)
    const item = decorationCatalogItem(placement.itemId)
    if (item === undefined || !item.compatibleSlots.some((slot) => slot === placement.slot)) {
      context.addIssue({ code: "custom", message: `incompatible slot ${key}` })
    }
  }
}).readonly()

export type DecorationState = z.infer<typeof decorationStateSchema>
export type DecorationPagePlacement = z.infer<typeof pagePlacementSchema>
export type DecorationPlacementTransform = z.infer<typeof decorationPlacementTransformSchema>

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

const storedPlacementShapeSchema = z.object({
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

function normalizedPlacements(rows: readonly unknown[], owned: ReadonlySet<DecorationId>): DecorationPagePlacement[] {
  const result: DecorationPagePlacement[] = []
  const occupiedSlots = new Set<string>()
  for (const row of rows) {
    const parsed = storedPlacementShapeSchema.safeParse(row)
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
    result.push({
      date,
      slot,
      itemId,
      ...(parsedTransform.success ? { transform: parsedTransform.data } : {}),
    })
  }
  return result
}

function normalizedOwnedIds(ids: readonly string[]): DecorationId[] {
  return DECORATION_IDS.filter((itemId) => !isPaidDecorationId(itemId) || ids.includes(itemId))
}

function normalizeStoredV2(input: z.infer<typeof storedV2ShapeSchema>): DecorationState | null {
  const ownedItemIds = normalizedOwnedIds(input.ownedItemIds)
  const owned = new Set(ownedItemIds)
  const themeId = isThemeDecorationId(input.equipped.themeId) && owned.has(input.equipped.themeId)
    ? input.equipped.themeId
    : "THEME_TRACK_NOTEBOOK"
  const inkId = isInkDecorationId(input.equipped.inkId) ? input.equipped.inkId : "INK_NAVY"
  const avatarId = input.equipped.avatarId !== null
    && isAvatarDecorationId(input.equipped.avatarId)
    && owned.has(input.equipped.avatarId)
    ? input.equipped.avatarId
    : null
  const normalized = {
    version: 2,
    spentPoints: input.spentPoints,
    ownedItemIds,
    equipped: { themeId, inkId, avatarId },
    library: {
      favoriteItemIds: uniqueUsableIds(input.library.favoriteItemIds, owned),
      recentItemIds: uniqueUsableIds(input.library.recentItemIds, owned).slice(0, 8),
    },
    pagePlacements: normalizedPlacements(input.pagePlacements, owned),
    pointMeaning: input.pointMeaning,
  }
  const parsed = decorationStateSchema.safeParse(normalized)
  return parsed.success ? parsed.data : null
}

export function createEmptyDecorationState(): DecorationState {
  const parsed = decorationStateSchema.parse({
    version: 2,
    spentPoints: 0,
    ownedItemIds: [...STARTER_DECORATION_IDS],
    equipped: { themeId: "THEME_TRACK_NOTEBOOK", inkId: "INK_NAVY", avatarId: null },
    library: { favoriteItemIds: [], recentItemIds: [] },
    pagePlacements: [],
    pointMeaning: "NON_ECONOMIC_NON_TRANSFERABLE_BETA",
  })
  return parsed
}

export function parseStoredDecorationState(raw: string): DecorationState | null {
  const json = parseJson(raw)
  const parsed = storedV2ShapeSchema.safeParse(json)
  return parsed.success ? normalizeStoredV2(parsed.data) : null
}

export function migrateLegacyDecorationState(raw: string): DecorationState | null {
  const json = parseJson(raw)
  const parsed = legacyStateSchema.safeParse(json)
  if (!parsed.success) return null
  /* 보유 목록 순서는 v2 로드 경로와 동일하게 카탈로그 순서로 통일한다. */
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
