/**
 * Minigame medals (🏅) and ad-slot policy. Game-only and deliberately NOT money.
 *
 * Legal/policy lines this file encodes (docs/handoff/minigame/REWARDS_ADS_PLAN.md, owner-approved 2026-10-09):
 * - 게임산업법 제28조 3호·제32조 1항 7호, AdMob rewarded-ads policy, Apps in Toss promotion rules:
 *   a game result must never become cash-equivalent value. Medals are their own ledger, spent only on
 *   cosmetic game items, and can never be converted into TrainOracle P, gift cards or cash.
 * - A run medal is fixed and depends only on having played; score, stars, clears and city never pay more.
 * - Daily caps per account. Ads only between runs, opt-in for rewarded, frequency-capped interstitials,
 *   and none at all without a 14+ check and ad consent. The default provider shows no ads.
 *
 * Storage shape (inside MINIGAME_PROGRESS): per-day event counts for recent days, medal totals for past
 * months, and the set of owned items. Every part merges by max/union, so two devices can never mint
 * more than the daily cap and a purchase is never lost.
 */
import { z } from "zod"

export const MINIGAME_REWARD_RULES = {
  medalsPerRun: 1,
  minRunSeconds: 8,
  runMedalsPerDay: 5,
  rewardedMedals: 2,
  rewardedPerDay: 3,
  interstitialEveryRuns: 3,
  interstitialMinGapSeconds: 180,
  interstitialGraceRuns: 3,
} as const

const dayKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/u)
const monthKey = z.string().regex(/^\d{4}-\d{2}$/u)
const itemId = z.string().regex(/^[a-z][a-z0-9-]{1,23}$/u)
export const medalStateSchema = z.object({
  /** [run medals, completed rewarded views] for each recent local day. */
  days: z.record(dayKey, z.tuple([z.number().int().min(0).max(MINIGAME_REWARD_RULES.runMedalsPerDay), z.number().int().min(0).max(MINIGAME_REWARD_RULES.rewardedPerDay)]))
    .refine(value => Object.keys(value).length <= 62),
  /** Medal totals for months that are over. */
  months: z.record(monthKey, z.number().int().min(0).max(31 * (MINIGAME_REWARD_RULES.runMedalsPerDay * MINIGAME_REWARD_RULES.medalsPerRun + MINIGAME_REWARD_RULES.rewardedPerDay * MINIGAME_REWARD_RULES.rewardedMedals)))
    .refine(value => Object.keys(value).length <= 240),
  owned: z.array(itemId).max(64),
  /** Equipped trail effect, or null. Follows the newer settings on merge. */
  trail: itemId.nullable(),
}).strict()
export type MedalState = z.infer<typeof medalStateSchema>
export const emptyMedals = (): MedalState => ({ days: {}, months: {}, owned: [], trail: null })

/** Cosmetic trail effects. Price in medals. Looks only: no item changes speed, jumps or hit boxes. */
export const TRAIL_ITEMS = [
  { id: "stardust", name: "별가루", line: "발밑에 반짝이는 별", price: 10 },
  { id: "petals", name: "꽃잎 바람", line: "달리는 길에 꽃잎", price: 15 },
  { id: "spark", name: "번개 스텝", line: "대시 때 번쩍", price: 20 },
  { id: "flame", name: "불꽃 신발", line: "뒤꿈치에 작은 불꽃", price: 25 },
  { id: "rainbow", name: "무지개 꼬리", line: "뒤로 길게 남는 무지개", price: 35 },
] as const
export type TrailId = typeof TRAIL_ITEMS[number]["id"]

/** Local calendar day (yyyy-mm-dd) so caps reset at the player's midnight. */
export function rewardDay(now: Date): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
}

const dayMedals = ([runs, ads]: readonly [number, number]) => runs * MINIGAME_REWARD_RULES.medalsPerRun + ads * MINIGAME_REWARD_RULES.rewardedMedals

export function medalsEarned(state: MedalState): number {
  return Object.values(state.months).reduce((sum, value) => sum + value, 0) + Object.values(state.days).reduce((sum, day) => sum + dayMedals(day), 0)
}
export function medalsSpent(state: MedalState): number {
  return state.owned.reduce((sum, id) => sum + (TRAIL_ITEMS.find(item => item.id === id)?.price ?? 0), 0)
}
/** Never below zero, even if two offline devices both spent the same medals. */
export function medalBalance(state: MedalState): number {
  return Math.max(0, medalsEarned(state) - medalsSpent(state))
}

/** Folds day entries of any month that already has a total, keeping the larger of the two counts. */
function canonical(state: MedalState): MedalState {
  const months = { ...state.months }
  const days: MedalState["days"] = {}
  const byMonth = new Map<string, number>()
  for (const [day, counts] of Object.entries(state.days)) {
    const month = day.slice(0, 7)
    if (month in months) byMonth.set(month, (byMonth.get(month) ?? 0) + dayMedals(counts))
    else days[day] = counts
  }
  for (const [month, sum] of byMonth) months[month] = Math.max(months[month]!, sum)
  return { ...state, days: Object.fromEntries(Object.entries(days).sort()), months: Object.fromEntries(Object.entries(months).sort()), owned: [...new Set(state.owned)].sort() }
}

/** Moves days of months before `now`'s month into monthly totals (keeps the record small). */
function archive(state: MedalState, now: Date): MedalState {
  const current = rewardDay(now).slice(0, 7)
  const months = { ...state.months }
  const days: MedalState["days"] = {}
  for (const [day, counts] of Object.entries(state.days)) {
    const month = day.slice(0, 7)
    if (month < current) months[month] = (months[month] ?? 0) + dayMedals(counts)
    else days[day] = counts
  }
  return canonical({ ...state, days, months })
}

/** Commutative, idempotent merge. `newerTrail` is decided by the caller from the settings timestamp. */
export function mergeMedals(a: MedalState, b: MedalState, newerTrail: string | null): MedalState {
  const days: MedalState["days"] = {}
  for (const day of new Set([...Object.keys(a.days), ...Object.keys(b.days)])) {
    const x = a.days[day] ?? [0, 0], y = b.days[day] ?? [0, 0]
    days[day] = [Math.max(x[0], y[0]), Math.max(x[1], y[1])]
  }
  const months: MedalState["months"] = {}
  for (const month of new Set([...Object.keys(a.months), ...Object.keys(b.months)])) months[month] = Math.max(a.months[month] ?? 0, b.months[month] ?? 0)
  return canonical({ days, months, owned: [...a.owned, ...b.owned], trail: newerTrail })
}

/** True if `next` keeps every earned medal and owned item of `previous` (server grow-only rule). */
export function medalsGrewFrom(previous: MedalState, next: MedalState): boolean {
  return medalsEarned(next) >= medalsEarned(previous) && previous.owned.every(id => next.owned.includes(id))
}

/**
 * Medal for one run. The only inputs are the ledger, how long the run lasted and the clock: two runs of
 * the same length earn the same, whatever the score, stars, clear or city.
 */
export function medalForRun(state: MedalState, runSeconds: number, now: Date): { state: MedalState; earned: number } {
  const day = rewardDay(now)
  const current = archive(state, now)
  const counts = current.days[day] ?? [0, 0]
  if (runSeconds < MINIGAME_REWARD_RULES.minRunSeconds || counts[0] >= MINIGAME_REWARD_RULES.runMedalsPerDay) return { state: current, earned: 0 }
  return { earned: MINIGAME_REWARD_RULES.medalsPerRun, state: { ...current, days: { ...current.days, [day]: [counts[0] + 1, counts[1]] } } }
}

export function runMedalsLeftToday(state: MedalState, now: Date): number {
  return MINIGAME_REWARD_RULES.runMedalsPerDay - (state.days[rewardDay(now)]?.[0] ?? 0)
}

export function rewardedAvailable(state: MedalState, now: Date): boolean {
  return (state.days[rewardDay(now)]?.[1] ?? 0) < MINIGAME_REWARD_RULES.rewardedPerDay
}

/** Only called after the provider reports a completed view. A skipped or failed view earns nothing. */
export function medalForRewardedView(state: MedalState, now: Date): { state: MedalState; earned: number } {
  const day = rewardDay(now)
  const current = archive(state, now)
  const counts = current.days[day] ?? [0, 0]
  if (counts[1] >= MINIGAME_REWARD_RULES.rewardedPerDay) return { state: current, earned: 0 }
  return { earned: MINIGAME_REWARD_RULES.rewardedMedals, state: { ...current, days: { ...current.days, [day]: [counts[0], counts[1] + 1] } } }
}

export function buyTrail(state: MedalState, id: string): { state: MedalState; ok: boolean } {
  const item = TRAIL_ITEMS.find(entry => entry.id === id)
  if (!item || state.owned.includes(id) || medalBalance(state) < item.price) return { state, ok: false }
  return { ok: true, state: canonical({ ...state, owned: [...state.owned, id], trail: id }) }
}

export function equipTrail(state: MedalState, id: string | null): MedalState {
  return id === null || state.owned.includes(id) ? { ...state, trail: id } : state
}

export type AdAudience = { readonly ageVerified14Plus: boolean; readonly adConsent: boolean }
export type InterstitialMemory = { readonly finishedRuns: number; readonly lastShownAt: number | null }

/** Interstitials: between runs only, after a grace period, at most every N runs and never back-to-back. */
export function interstitialDue(memory: InterstitialMemory, audience: AdAudience, nowMs: number): boolean {
  const rules = MINIGAME_REWARD_RULES
  if (!audience.ageVerified14Plus || !audience.adConsent) return false
  if (memory.finishedRuns < rules.interstitialGraceRuns) return false
  if (memory.finishedRuns % rules.interstitialEveryRuns !== 0) return false
  return memory.lastShownAt === null || nowMs - memory.lastShownAt >= rules.interstitialMinGapSeconds * 1000
}

export function rewardedOffered(state: MedalState, audience: AdAudience, now: Date, provider: AdBreakProvider): boolean {
  return provider.available && audience.ageVerified14Plus && audience.adConsent && rewardedAvailable(state, now)
}

/** What an ad network must provide. Nothing in the app implements it yet (no SDK, no network calls). */
export interface AdBreakProvider {
  readonly available: boolean
  /** Resolves "completed" only when the full rewarded view finished. */
  rewarded(placement: "result-bonus"): Promise<"completed" | "skipped" | "unavailable">
  interstitial(placement: "between-runs"): Promise<"shown" | "unavailable">
}

/** The default: no ads at all, so no ad slot renders until the owner approves a network and consent flow. */
export const NO_ADS: AdBreakProvider = {
  available: false,
  rewarded: async () => "unavailable",
  interstitial: async () => "unavailable",
}

/** No age check or ad consent exists in the app yet, so the audience is "not eligible" by default. */
export const NO_AD_AUDIENCE: AdAudience = { ageVerified14Plus: false, adConsent: false }
