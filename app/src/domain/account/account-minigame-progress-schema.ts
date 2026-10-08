import { z } from "zod"
import { minigameProgressSchema } from "../minigame/progress"

/**
 * Account copy of the minigame tour. Game-only: no training, health or reward fields,
 * never reward-eligible (metadata eligible:false), and capped small.
 */
export const MINIGAME_PROGRESS_NAMESPACE = "trainoracle.account.minigame-progress.v1"
export const accountMinigameProgressDocumentSchema = z.object({
  version: z.literal(3), state: z.literal("ACCOUNT_STATE"), kind: z.literal("MINIGAME_PROGRESS"),
  data: minigameProgressSchema,
}).strict().refine(value => new TextEncoder().encode(JSON.stringify(value)).byteLength <= 16_000)
export type AccountMinigameProgressDocument = z.infer<typeof accountMinigameProgressDocumentSchema>

export function validateAccountMinigameProgressDocument(value: unknown): boolean {
  try { return accountMinigameProgressDocumentSchema.safeParse(value).success } catch { return false }
}

/**
 * Progress only grows on the server: an update may not lower any city's stars, best score or
 * clear count. Starting over is an explicit delete of the whole document, not a quiet overwrite.
 */
export function validateAccountMinigameProgressUpdate(previous: unknown, next: unknown): boolean {
  const before = accountMinigameProgressDocumentSchema.safeParse(previous)
  const after = accountMinigameProgressDocumentSchema.safeParse(next)
  if (!before.success || !after.success) return false
  return Object.entries(before.data.data.cities).every(([id, city]) => {
    const now = after.data.data.cities[id]
    return now !== undefined && now.stars >= city.stars && now.bestScore >= city.bestScore && now.clears >= city.clears
  })
}
