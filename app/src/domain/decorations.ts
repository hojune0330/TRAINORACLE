import { z } from "zod"

const STORAGE_KEY = "trainoracle.decorations.v1"

export const DECORATION_CATALOG = [
  { id: "THEME_SKY_JOURNAL", category: "THEME", name: "하늘 일지 테마", cost: 12 },
  { id: "STICKER_FINISH_LINE", category: "STICKER", name: "결승선 스티커", cost: 8 },
  { id: "AVATAR_START_LINE", category: "AVATAR", name: "출발선 아바타", cost: 20 },
] as const

type DecorationId = (typeof DECORATION_CATALOG)[number]["id"]

const decorationStateSchema = z.object({
  version: z.literal(1),
  spentPoints: z.number().int().nonnegative(),
  ownedItemIds: z.array(z.enum(["THEME_SKY_JOURNAL", "STICKER_FINISH_LINE", "AVATAR_START_LINE"])),
  pointMeaning: z.literal("NON_ECONOMIC_NON_TRANSFERABLE_BETA"),
})

export type DecorationState = z.infer<typeof decorationStateSchema>

export type DecorationPurchase = {
  readonly kind: "PURCHASED" | "ALREADY_OWNED" | "INSUFFICIENT_POINTS" | "UNKNOWN_ITEM"
  readonly state: DecorationState
  readonly remainingPoints: number
}

const EMPTY_STATE: DecorationState = {
  version: 1,
  spentPoints: 0,
  ownedItemIds: [],
  pointMeaning: "NON_ECONOMIC_NON_TRANSFERABLE_BETA",
}

export function loadDecorationState(): DecorationState {
  if (typeof window === "undefined") return EMPTY_STATE
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw === null) return EMPTY_STATE
    const parsedJson: unknown = JSON.parse(raw)
    const parsed = decorationStateSchema.safeParse(parsedJson)
    return parsed.success ? parsed.data : EMPTY_STATE
  } catch (error) {
    if (error instanceof SyntaxError) return EMPTY_STATE
    throw error
  }
}

export function purchaseDecoration(
  earnedPoints: number,
  state: DecorationState,
  itemId: string,
): DecorationPurchase {
  const item = DECORATION_CATALOG.find((candidate) => candidate.id === itemId)
  const available = Math.max(0, earnedPoints - state.spentPoints)
  if (item === undefined) return { kind: "UNKNOWN_ITEM", state, remainingPoints: available }
  if (state.ownedItemIds.includes(item.id)) return { kind: "ALREADY_OWNED", state, remainingPoints: available }
  if (available < item.cost) return { kind: "INSUFFICIENT_POINTS", state, remainingPoints: available }

  const next: DecorationState = {
    ...state,
    spentPoints: state.spentPoints + item.cost,
    ownedItemIds: [...state.ownedItemIds, item.id],
  }
  if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  return { kind: "PURCHASED", state: next, remainingPoints: available - item.cost }
}

export function decorationItemOwned(state: DecorationState, itemId: DecorationId): boolean {
  return state.ownedItemIds.includes(itemId)
}
