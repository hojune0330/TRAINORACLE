import { z } from "zod"
import { supabase } from "./supabase-client"
import { activeLocalAccount } from "./local-journal-ownership"
import { isValidIsoDate } from "../dates"

const count = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER - 1)
export const accountRewardSummarySchema = z.object({
  kind: z.literal("rewardSummary"), ownerId: z.uuid(), today: z.string().refine(isValidIsoDate),
  points: count, spentPoints: count, availablePoints: count,
  legacySpentPoints: count.optional(),
  journalDays: count, visitDays: count, visitedToday: z.boolean(), journalRecordedToday: z.boolean(),
}).strict().refine(value => value.points === value.journalDays * 4 + value.visitDays
  && value.availablePoints === value.points - value.spentPoints)
export type AccountRewardSummary = z.infer<typeof accountRewardSummarySchema>
const visitSchema = z.object({ kind: z.literal("visit"), awardedPoints: z.union([z.literal(0), z.literal(1)]),
  summary: accountRewardSummarySchema }).strict()
export type AccountRewardResult = { ok: true; summary: AccountRewardSummary; awardedPoints: 0 | 1 }
  | { ok: false; code: "STALE_RESPONSE" | "AUTH_REQUIRED" | "ACCESS_DENIED" | "UNAVAILABLE" | "INVALID_RESPONSE" }

export async function requestAccountRewards(
  ownerId: string, action: "rewardSummary" | "visit", isCurrent: () => boolean,
  dependencies: { client: typeof supabase; owner: typeof activeLocalAccount } = { client: supabase, owner: activeLocalAccount },
): Promise<AccountRewardResult> {
  const current = () => isCurrent() && dependencies.owner() === ownerId
  if (!current()) return { ok: false, code: "STALE_RESPONSE" }
  try {
    const client = await dependencies.client()
    if (!current()) return { ok: false, code: "STALE_RESPONSE" }
    if (!client) return { ok: false, code: "UNAVAILABLE" }
    const session = await client.auth.getSession()
    if (!current()) return { ok: false, code: "STALE_RESPONSE" }
    if (session.error || session.data.session?.user.id !== ownerId) return { ok: false, code: "AUTH_REQUIRED" }
    const { data, error } = await client.functions.invoke("account-journal", { body: { action } })
    if (!current()) return { ok: false, code: "STALE_RESPONSE" }
    if (error) {
      const status = error.context instanceof Response ? error.context.status : 0
      return { ok: false, code: status === 401 ? "AUTH_REQUIRED" : status === 403 ? "ACCESS_DENIED" : "UNAVAILABLE" }
    }
    const parsed = action === "visit" ? visitSchema.safeParse(data) : accountRewardSummarySchema.safeParse(data)
    if (!parsed.success) return { ok: false, code: "INVALID_RESPONSE" }
    const summary = parsed.data.kind === "visit" ? parsed.data.summary : parsed.data
    if (summary.ownerId !== ownerId) return { ok: false, code: "INVALID_RESPONSE" }
    return { ok: true, summary, awardedPoints: parsed.data.kind === "visit" ? parsed.data.awardedPoints : 0 }
  } catch { return { ok: false, code: current() ? "UNAVAILABLE" : "STALE_RESPONSE" } }
}
