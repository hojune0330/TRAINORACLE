import { z } from "zod"
import { calendarDecorationStateSchema, calendarDecorationReferenceIds, calendarDecorationsOwnedBy } from "../calendar-decoration-schema"
import { isPaidDecorationId } from "../decoration-catalog"
import { accountDecorationDocumentSchema } from "./account-decoration-schema"

export const accountCalendarDecorationDocumentSchema = z.object({
  version: z.literal(3),
  state: z.literal("ACCOUNT_STATE"),
  kind: z.literal("CALENDAR_DECORATIONS"),
  data: calendarDecorationStateSchema,
}).strict().refine(value => new TextEncoder().encode(JSON.stringify(value)).byteLength <= 500_000)
export type AccountCalendarDecorationDocument = z.infer<typeof accountCalendarDecorationDocumentSchema>
export function validateAccountCalendarDecorationDocument(value: unknown): boolean {
  try { return accountCalendarDecorationDocumentSchema.safeParse(value).success } catch { return false }
}

/** Server derives references from validated content, never from client ownership claims. */
export function accountCalendarDecorationOwnershipMetadata(value: unknown, ownership: unknown) {
  const calendar = accountCalendarDecorationDocumentSchema.parse(value)
  const decorations = accountDecorationDocumentSchema.parse(ownership)
  if (!calendarDecorationsOwnedBy(calendar.data, decorations.data)) throw Error("OWNERSHIP_STATE_CHANGED")
  return { paidReferenceItemIds: calendarDecorationReferenceIds(calendar.data).filter(isPaidDecorationId) }
}
