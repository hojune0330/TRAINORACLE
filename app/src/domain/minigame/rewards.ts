/**
 * Minigame reward and ad-slot policy. Game-only and deliberately NOT money.
 *
 * Legal/policy lines this file encodes (see docs/handoff/minigame/REWARDS_ADS_PLAN.md):
 * - 게임산업법 제28조 3호·제32조 1항 7호, AdMob rewarded-ads policy, Apps in Toss promotion rules:
 *   a game result must never turn into cash-equivalent value. So medals (🏅) are a separate ledger
 *   that can never be converted into TrainOracle P, gift cards or cash. There is no conversion API.
 * - Medals for *playing* are fixed per run and capped per day, so a better score never pays more.
 * - Ad slots are only between runs (never during play), opt-in for rewarded, frequency-capped for
 *   interstitials, and off for anyone under 14 or without consent. No ad network is wired yet:
 *   `AdBreakProvider` is an interface the owner can back with an approved network later.
 */

export const MINIGAME_REWARD_RULES = {
  /** Medals for finishing or failing a run that lasted at least `minRunSeconds`. Same for both. */
  medalsPerRun: 1,
  minRunSeconds: 8,
  /** Daily cap on run medals, so grinding does not pay. */
  runMedalsPerDay: 5,
  /** Opt-in rewarded break: +medals, at most this many per day. */
  rewardedMedals: 2,
  rewardedPerDay: 3,
  /** Interstitial at most once every N finished runs, and never twice within this many seconds. */
  interstitialEveryRuns: 3,
  interstitialMinGapSeconds: 180,
  /** First runs of a new player never see an interstitial. */
  interstitialGraceRuns: 3,
} as const

export type MedalLedger = { readonly day: string; readonly runMedals: number; readonly rewardedViews: number; readonly balance: number; readonly lifetime: number }

export const emptyMedalLedger = (day: string): MedalLedger => ({ day, runMedals: 0, rewardedViews: 0, balance: 0, lifetime: 0 })

/** Local calendar day (yyyy-mm-dd) so caps reset at the player's midnight. */
export function rewardDay(now: Date): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
}

function rolled(ledger: MedalLedger, day: string): MedalLedger {
  return ledger.day === day ? ledger : { ...ledger, day, runMedals: 0, rewardedViews: 0 }
}

/**
 * Medal for one run. Depends only on having played (duration), never on score, stars, clear or
 * city: two runs of the same length earn the same, whatever the result.
 */
export function medalForRun(ledger: MedalLedger, runSeconds: number, now: Date): { ledger: MedalLedger; earned: number } {
  const today = rolled(ledger, rewardDay(now))
  const earned = runSeconds >= MINIGAME_REWARD_RULES.minRunSeconds && today.runMedals < MINIGAME_REWARD_RULES.runMedalsPerDay
    ? MINIGAME_REWARD_RULES.medalsPerRun : 0
  return { earned, ledger: { ...today, runMedals: today.runMedals + earned, balance: today.balance + earned, lifetime: today.lifetime + earned } }
}

export function rewardedAvailable(ledger: MedalLedger, now: Date): boolean {
  return rolled(ledger, rewardDay(now)).rewardedViews < MINIGAME_REWARD_RULES.rewardedPerDay
}

/** Only called after the provider reports a completed view. A skipped or failed view earns nothing. */
export function medalForRewardedView(ledger: MedalLedger, now: Date): { ledger: MedalLedger; earned: number } {
  const today = rolled(ledger, rewardDay(now))
  if (today.rewardedViews >= MINIGAME_REWARD_RULES.rewardedPerDay) return { ledger: today, earned: 0 }
  const earned = MINIGAME_REWARD_RULES.rewardedMedals
  return { earned, ledger: { ...today, rewardedViews: today.rewardedViews + 1, balance: today.balance + earned, lifetime: today.lifetime + earned } }
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

export function rewardedOffered(ledger: MedalLedger, audience: AdAudience, now: Date): boolean {
  return audience.ageVerified14Plus && audience.adConsent && rewardedAvailable(ledger, now)
}

/** What an ad network must provide. Nothing in the app implements it yet (no SDK, no network calls). */
export interface AdBreakProvider {
  /** Resolves "completed" only when the full rewarded view finished. */
  rewarded(placement: "result-bonus"): Promise<"completed" | "skipped" | "unavailable">
  interstitial(placement: "between-runs"): Promise<"shown" | "unavailable">
}

/** The default: no ads at all. Keeps every caller honest until the owner approves a network. */
export const NO_ADS: AdBreakProvider = {
  rewarded: async () => "unavailable",
  interstitial: async () => "unavailable",
}
