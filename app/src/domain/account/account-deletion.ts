import { z } from "zod"

const instantSchema = z.string().datetime()
const RETENTION_DAYS = 30
const DAY_MS = 86_400_000

export type AccountDeletionRequest = {
  readonly requestedAt: string
  readonly accessBlockedAt: string
  readonly deleteBy: string
  readonly status: "REQUESTED"
}

export function createAccountDeletionRequest(requestedAt: string): AccountDeletionRequest {
  const instant = instantSchema.parse(requestedAt)
  const deleteBy = new Date(Date.parse(instant) + RETENTION_DAYS * DAY_MS).toISOString()
  return {
    requestedAt: instant,
    accessBlockedAt: instant,
    deleteBy,
    status: "REQUESTED",
  }
}
