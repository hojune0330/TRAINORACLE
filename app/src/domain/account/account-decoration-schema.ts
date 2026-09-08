import { z } from "zod"
import { decorationStateSchema } from "../decoration-schema"

export const accountDecorationDocumentSchema = z.object({
  version: z.literal(3),
  state: z.literal("ACCOUNT_STATE"),
  kind: z.literal("DECORATIONS"),
  data: decorationStateSchema,
}).strict().refine(document => Number.isSafeInteger(document.data.spentPoints)
  && new TextEncoder().encode(JSON.stringify(document)).byteLength <= 500_000,
"Invalid decoration document size or points")
export type AccountDecorationDocument = z.infer<typeof accountDecorationDocumentSchema>

export function validateAccountDecorationDocument(value: unknown): boolean {
  try {
    const parsed = accountDecorationDocumentSchema.safeParse(value)
    return parsed.success
  } catch { return false }
}
