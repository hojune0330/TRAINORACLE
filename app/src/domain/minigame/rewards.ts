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
 * Storage shape (inside MINIGAME_PROGRESS): per-day event counts for recent days, compact daily counts
 * for past months, and the set of owned items. Every count merges by max/union, so two devices cannot mint
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

const dayKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/u).refine(value => {
  const date = new Date(`${value}T00:00:00.000Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
})
const monthKey = z.string().regex(/^\d{4}-(?:0[1-9]|1[0-2])$/u)
const itemId = z.string().regex(/^[a-z][a-z0-9-]{1,23}$/u)
const monthlyTotal = z.number().int().min(0).max(31 * (MINIGAME_REWARD_RULES.runMedalsPerDay * MINIGAME_REWARD_RULES.medalsPerRun + MINIGAME_REWARD_RULES.rewardedPerDay * MINIGAME_REWARD_RULES.rewardedMedals))
/** One character per day: run count 0–5 + six times the ad count 0–3. */
const COUNT_ALPHABET = "0123456789abcdefghijklmn"
const monthLedgerSchema = z.union([monthlyTotal, z.tuple([monthlyTotal, z.string().max(31).regex(/^[0-9a-n]*$/u)])])
type MonthLedger = z.infer<typeof monthLedgerSchema>
type DayCounts = [number, number]
function daysInMonth(month: string): number {
  const year = Number(month.slice(0, 4)), number = Number(month.slice(5))
  return number === 2 ? 28 + Number(year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0))
    : [4, 6, 9, 11].includes(number) ? 30 : 31
}
export const medalStateSchema = z.object({
  /** [run medals, completed rewarded views] for each recent local day. */
  days: z.record(dayKey, z.tuple([z.number().int().min(0).max(MINIGAME_REWARD_RULES.runMedalsPerDay), z.number().int().min(0).max(MINIGAME_REWARD_RULES.rewardedPerDay)]))
    .refine(value => Object.keys(value).length <= 62),
  /** Old scalar totals remain conservative floors; new [floor, daily counts] retain date identities. */
  months: z.record(monthKey, monthLedgerSchema)
    .refine(value => Object.keys(value).length <= 240
      && Object.entries(value).every(([month, ledger]) => typeof ledger === "number" || ledger[1].length <= daysInMonth(month))),
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

const monthFloor = (ledger: MonthLedger | undefined) => typeof ledger === "number" ? ledger : ledger?.[0] ?? 0
const monthDays = (ledger: MonthLedger | undefined) => typeof ledger === "number" ? "" : ledger?.[1] ?? ""
function monthDayCounts(ledger: MonthLedger | undefined, index: number): DayCounts {
  const value = COUNT_ALPHABET.indexOf(monthDays(ledger)[index] ?? "0")
  return [value % 6, Math.floor(value / 6)]
}
const maxCounts = (a: DayCounts, b: DayCounts): DayCounts => [Math.max(a[0], b[0]), Math.max(a[1], b[1])]
const encodedCount = ([runs, ads]: DayCounts) => COUNT_ALPHABET[runs + 6 * ads]!
function mergeMonth(a: MonthLedger | undefined, b: MonthLedger | undefined): [number, string] {
  const length = Math.max(monthDays(a).length, monthDays(b).length)
  const counts = Array.from({ length }, (_, index) => encodedCount(maxCounts(monthDayCounts(a, index), monthDayCounts(b, index)))).join("")
  return [Math.max(monthFloor(a), monthFloor(b)), counts.replace(/0+$/u, "")]
}
function withMonthDay(ledger: MonthLedger | undefined, index: number, counts: DayCounts): [number, string] {
  const encoded = monthDays(ledger).padEnd(index + 1, "0").split("")
  encoded[index] = encodedCount(maxCounts(monthDayCounts(ledger, index), counts))
  return [monthFloor(ledger), encoded.join("").replace(/0+$/u, "")]
}
function countsForDay(state: MedalState, day: string): DayCounts {
  return maxCounts(state.days[day] ?? [0, 0], monthDayCounts(state.months[day.slice(0, 7)], Number(day.slice(8)) - 1))
}
function withDay(state: MedalState, day: string, counts: DayCounts): MedalState {
  const month = day.slice(0, 7)
  return month in state.months
    ? { ...state, months: { ...state.months, [month]: withMonthDay(state.months[month], Number(day.slice(8)) - 1, counts) } }
    : { ...state, days: { ...state.days, [day]: counts } }
}
function monthMedals(ledger: MonthLedger): number {
  const sum = Array.from({ length: monthDays(ledger).length }, (_, index) => dayMedals(monthDayCounts(ledger, index))).reduce((total, value) => total + value, 0)
  return Math.max(monthFloor(ledger), sum)
}

export function medalsEarned(state: MedalState): number {
  const normalized = canonical(state)
  return Object.values(normalized.months).reduce((sum, ledger) => sum + monthMedals(ledger), 0) + Object.values(normalized.days).reduce((sum, day) => sum + dayMedals(day), 0)
}
export function medalsSpent(state: MedalState): number {
  return state.owned.reduce((sum, id) => sum + (TRAIL_ITEMS.find(item => item.id === id)?.price ?? 0), 0)
}
/** Never below zero, even if two offline devices both spent the same medals. */
export function medalBalance(state: MedalState): number {
  return Math.max(0, medalsEarned(state) - medalsSpent(state))
}

/** Fold duplicate day representations by their date, keeping legacy scalar totals only as floors. */
function canonical(state: MedalState): MedalState {
  const months: MedalState["months"] = Object.fromEntries(Object.entries(state.months).map(([month, ledger]) => [month, mergeMonth(ledger, undefined)]))
  const days: MedalState["days"] = {}
  for (const [day, counts] of Object.entries(state.days)) {
    const month = day.slice(0, 7)
    if (month in months) months[month] = withMonthDay(months[month], Number(day.slice(8)) - 1, counts)
    else days[day] = counts
  }
  return { ...state, days: Object.fromEntries(Object.entries(days).sort()), months: Object.fromEntries(Object.entries(months).sort()), owned: [...new Set(state.owned)].sort() }
}

/** Move past months into compact daily ledgers, retaining both counters for every actual day. */
function archive(state: MedalState, now: Date): MedalState {
  const current = rewardDay(now).slice(0, 7)
  const months = { ...state.months }
  const days: MedalState["days"] = {}
  for (const [day, counts] of Object.entries(state.days)) {
    const month = day.slice(0, 7)
    if (month < current) months[month] = withMonthDay(months[month], Number(day.slice(8)) - 1, counts)
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
  for (const month of new Set([...Object.keys(a.months), ...Object.keys(b.months)])) months[month] = mergeMonth(a.months[month], b.months[month])
  return canonical({ days, months, owned: [...a.owned, ...b.owned], trail: newerTrail })
}

/** True if `next` keeps every earned medal and owned item of `previous` (server grow-only rule). */
export function medalsGrewFrom(previous: MedalState, next: MedalState): boolean {
  const retained = (day: string, before: DayCounts) => {
    const after = countsForDay(next, day)
    return after[0] >= before[0] && after[1] >= before[1]
  }
  return medalsEarned(next) >= medalsEarned(previous) && previous.owned.every(id => next.owned.includes(id))
    && Object.entries(previous.days).every(([day, counts]) => retained(day, counts))
    && Object.entries(previous.months).every(([month, ledger]) => monthFloor(next.months[month]) >= monthFloor(ledger)
      && Array.from({ length: monthDays(ledger).length }, (_, index) =>
        retained(`${month}-${String(index + 1).padStart(2, "0")}`, monthDayCounts(ledger, index))).every(Boolean))
}

/**
 * Medal for one run. The only inputs are the ledger, how long the run lasted and the clock: two runs of
 * the same length earn the same, whatever the score, stars, clear or city.
 */
export function medalForRun(state: MedalState, runSeconds: number, now: Date): { state: MedalState; earned: number } {
  const day = rewardDay(now)
  const current = archive(state, now)
  const counts = countsForDay(current, day)
  if (runSeconds < MINIGAME_REWARD_RULES.minRunSeconds || counts[0] >= MINIGAME_REWARD_RULES.runMedalsPerDay) return { state: current, earned: 0 }
  return { earned: MINIGAME_REWARD_RULES.medalsPerRun, state: withDay(current, day, [counts[0] + 1, counts[1]]) }
}

export function runMedalsLeftToday(state: MedalState, now: Date): number {
  return MINIGAME_REWARD_RULES.runMedalsPerDay - countsForDay(state, rewardDay(now))[0]
}

export function rewardedAvailable(state: MedalState, now: Date): boolean {
  return countsForDay(state, rewardDay(now))[1] < MINIGAME_REWARD_RULES.rewardedPerDay
}

/** Only called after the provider reports a completed view. A skipped or failed view earns nothing. */
export function medalForRewardedView(state: MedalState, now: Date): { state: MedalState; earned: number } {
  const day = rewardDay(now)
  const current = archive(state, now)
  const counts = countsForDay(current, day)
  if (counts[1] >= MINIGAME_REWARD_RULES.rewardedPerDay) return { state: current, earned: 0 }
  return { earned: MINIGAME_REWARD_RULES.rewardedMedals, state: withDay(current, day, [counts[0], counts[1] + 1]) }
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
