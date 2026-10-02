import { z } from "zod"
import { PLACEMENT_DECORATION_IDS, THEME_DECORATION_IDS } from "./decoration-catalog"
import { decorationPlacementTransformSchema, type DecorationState } from "./decoration-schema"

export const MAX_CALENDAR_DECORATION_ITEMS = 6
export const MAX_CALENDAR_DECORATION_ITEMS_PER_REGION = 3
export const CALENDAR_DECORATION_REGIONS = ["HEADER_MARGIN", "FOOTER_MARGIN"] as const
export const calendarDecorationItemSchema = z.object({
  placementId: z.uuid(),
  itemId: z.enum(PLACEMENT_DECORATION_IDS),
  region: z.enum(CALENDAR_DECORATION_REGIONS),
  transform: decorationPlacementTransformSchema,
}).strict().readonly()

/** One global frame. Journal dates, text and commerce belong to their existing documents. */
export const calendarDecorationStateSchema = z.object({
  version: z.literal(1),
  paperThemeId: z.enum(THEME_DECORATION_IDS).nullable(),
  items: z.array(calendarDecorationItemSchema).max(MAX_CALENDAR_DECORATION_ITEMS).readonly(),
}).strict().superRefine((state, context) => {
  if (new Set(state.items.map(item => item.placementId)).size !== state.items.length) {
    context.addIssue({ code: "custom", message: "Duplicate calendar placement ID" })
  }
  for (const region of CALENDAR_DECORATION_REGIONS) {
    if (state.items.filter(item => item.region === region).length > MAX_CALENDAR_DECORATION_ITEMS_PER_REGION) {
      context.addIssue({ code: "custom", message: "Calendar region capacity exceeded" })
    }
  }
}).readonly()

export type CalendarDecorationState = z.infer<typeof calendarDecorationStateSchema>
export type CalendarDecorationItem = z.infer<typeof calendarDecorationItemSchema>
export type CalendarDecorationRegion = (typeof CALENDAR_DECORATION_REGIONS)[number]

export function createEmptyCalendarDecorationState(): CalendarDecorationState {
  return calendarDecorationStateSchema.parse({ version: 1, paperThemeId: null, items: [] })
}

/** Never normalizes or drops unknown content; callers preserve unsupported originals. */
export function parseStoredCalendarDecorationState(raw: string): CalendarDecorationState | null {
  try {
    const parsed = calendarDecorationStateSchema.safeParse(JSON.parse(raw))
    return parsed.success ? parsed.data : null
  } catch { return null }
}

export function calendarDecorationReferenceIds(state: CalendarDecorationState): readonly string[] {
  return [...new Set([...(state.paperThemeId === null ? [] : [state.paperThemeId]), ...state.items.map(item => item.itemId)])].sort()
}

export function calendarDecorationsOwnedBy(state: CalendarDecorationState, decorations: DecorationState): boolean {
  const owned = new Set<string>(decorations.ownedItemIds)
  return calendarDecorationReferenceIds(state).every(id => owned.has(id))
}
