import { z } from "zod"

const analyticsEventNameSchema = z.enum([
  "APP_OPENED",
  "JOURNAL_STARTED",
  "JOURNAL_SAVED",
  "ARCHIVE_OPENED",
  "PLAN_PROPOSAL_REVIEWED",
  "SYNC_SUCCEEDED",
  "SYNC_FAILED",
])
const instantSchema = z.string().datetime()
const RETENTION_DAYS = 30
const DAY_MS = 86_400_000

export type ProductAnalyticsEvent = {
  readonly name: z.infer<typeof analyticsEventNameSchema>
  readonly occurredAt: string
  readonly expiresAt: string
}

export function createProductAnalyticsEvent(
  name: string,
  optedIn: boolean,
  occurredAt: string,
): ProductAnalyticsEvent | null {
  if (!optedIn) return null
  const parsedName = analyticsEventNameSchema.parse(name)
  const parsedInstant = instantSchema.parse(occurredAt)
  return {
    name: parsedName,
    occurredAt: parsedInstant,
    expiresAt: new Date(Date.parse(parsedInstant) + RETENTION_DAYS * DAY_MS).toISOString(),
  }
}
