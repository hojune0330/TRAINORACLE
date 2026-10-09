import { readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import {
  buyTrail, emptyMedals, equipTrail, interstitialDue, medalBalance, medalForRewardedView, medalForRun, medalsEarned, medalsGrewFrom,
  medalStateSchema, mergeMedals, rewardedOffered, runMedalsLeftToday, MINIGAME_REWARD_RULES, NO_AD_AUDIENCE, NO_ADS, TRAIL_ITEMS,
} from "./rewards"
import type { AdBreakProvider, MedalState } from "./rewards"
import { emptyMinigameProgress, mergeMinigameProgress, withMedals } from "./progress"
import { validateAccountMinigameProgressDocument, validateAccountMinigameProgressUpdate } from "../account/account-minigame-progress-schema"

const day = new Date(2026, 9, 9, 12)
const adult = { ageVerified14Plus: true, adConsent: true }
const liveAds: AdBreakProvider = { ...NO_ADS, available: true }
const play = (state: MedalState, runs: number, at = day, seconds = 20) => {
  let current = state
  for (let run = 0; run < runs; run++) current = medalForRun(current, seconds, at).state
  return current
}
const doc = (medals: MedalState) => ({ version: 3, state: "ACCOUNT_STATE", kind: "MINIGAME_PROGRESS", data: { ...emptyMinigameProgress(), medals } })

describe("minigame medals (game-only, never money)", () => {
  it("pays the same fixed medal for any run long enough, whatever the result, capped per day", () => {
    const earned: number[] = []
    let state = emptyMedals()
    for (let run = 0; run < MINIGAME_REWARD_RULES.runMedalsPerDay + 3; run++) {
      const result = medalForRun(state, 12 + run, day); state = result.state; earned.push(result.earned)
    }
    expect(earned.filter(value => value > 0)).toHaveLength(MINIGAME_REWARD_RULES.runMedalsPerDay)
    expect(new Set(earned.filter(value => value > 0))).toEqual(new Set([MINIGAME_REWARD_RULES.medalsPerRun]))
    expect(runMedalsLeftToday(state, day)).toBe(0)
    expect(medalForRun(emptyMedals(), MINIGAME_REWARD_RULES.minRunSeconds - 1, day).earned).toBe(0)
    const tomorrow = medalForRun(state, 20, new Date(2026, 9, 10, 0, 5))
    expect(tomorrow.earned).toBe(MINIGAME_REWARD_RULES.medalsPerRun)
    expect(medalBalance(tomorrow.state)).toBe(medalBalance(state) + MINIGAME_REWARD_RULES.medalsPerRun)
  })
  it("has no input that could make a score, star, clear or city pay more", () => {
    const source = readFileSync("src/domain/minigame/rewards.ts", "utf8")
    const signature = /export function medalForRun\(([^)]*)\)/u.exec(source)![1]!
    expect(signature).not.toMatch(/score|star|clear|city|stage|combo|mode/iu)
    expect(medalForRun.length).toBe(3)
  })
  it("caps opt-in rewarded views per day and only offers them with a live provider, 14+ and consent", () => {
    let state = emptyMedals()
    for (let view = 0; view < MINIGAME_REWARD_RULES.rewardedPerDay; view++) state = medalForRewardedView(state, day).state
    expect(medalBalance(state)).toBe(MINIGAME_REWARD_RULES.rewardedPerDay * MINIGAME_REWARD_RULES.rewardedMedals)
    expect(medalForRewardedView(state, day).earned).toBe(0)
    expect(rewardedOffered(state, adult, day, liveAds)).toBe(false)
    const fresh = emptyMedals()
    expect(rewardedOffered(fresh, adult, day, liveAds)).toBe(true)
    expect(rewardedOffered(fresh, adult, day, NO_ADS)).toBe(false)
    expect(rewardedOffered(fresh, { ageVerified14Plus: false, adConsent: true }, day, liveAds)).toBe(false)
    expect(rewardedOffered(fresh, NO_AD_AUDIENCE, day, liveAds)).toBe(false)
  })
  it("spends medals only on cosmetic trails, never below zero, and equips only owned ones", () => {
    const rich = play(play(play(emptyMedals(), 5, new Date(2026, 9, 1)), 5, new Date(2026, 9, 2)), 5, day)
    expect(medalBalance(rich)).toBe(15)
    expect(buyTrail(rich, "rainbow").ok).toBe(false)
    const bought = buyTrail(rich, "stardust")
    expect(bought.ok).toBe(true)
    expect(bought.state.trail).toBe("stardust")
    expect(medalBalance(bought.state)).toBe(5)
    expect(buyTrail(bought.state, "stardust").ok).toBe(false)
    expect(equipTrail(bought.state, "flame").trail).toBe("stardust")
    expect(equipTrail(bought.state, null).trail).toBeNull()
    // Two offline devices that spent the same medals on different items: balance floors at 0, both items kept.
    const a = buyTrail(rich, "stardust").state, b = buyTrail(rich, "petals").state
    const both = mergeMedals(a, b, null)
    expect(both.owned).toEqual(["petals", "stardust"])
    expect(medalBalance(both)).toBe(0)
    for (const item of TRAIL_ITEMS) expect(item.line, item.id).not.toMatch(/빠르|속도|점프력|판정|에너지/u)
  })
  it("merges two devices without minting extra medals, in any order, and archives old months", () => {
    const a = play(emptyMedals(), 3), b = play(emptyMedals(), 4)
    const merged = mergeMedals(a, b, null)
    expect(medalsEarned(merged)).toBe(4)
    expect(mergeMedals(a, b, null)).toEqual(mergeMedals(b, a, null))
    expect(mergeMedals(merged, merged, null)).toEqual(merged)
    const october = play(emptyMedals(), 5, new Date(2026, 9, 9))
    const november = play(october, 2, new Date(2026, 10, 2))
    expect(Object.keys(november.days)).toEqual(["2026-11-02"])
    expect(november.months).toEqual({ "2026-10": 5 })
    // A device that still has October as days merges into the archived total without double counting.
    expect(medalsEarned(mergeMedals(october, november, null))).toBe(7)
    expect(medalStateSchema.safeParse(november).success).toBe(true)
  })
  it("keeps medals through the progress merge and the server's grow-only rule", () => {
    const one = withMedals(emptyMinigameProgress(), play(emptyMedals(), 2), new Date("2026-10-09T01:00:00Z"))
    const two = withMedals(emptyMinigameProgress(), play(emptyMedals(), 1))
    expect(medalsEarned(mergeMinigameProgress(one, two).medals!)).toBe(2)
    // A V1 save without medals still merges and keeps the other device's medals.
    expect(medalsEarned(mergeMinigameProgress(emptyMinigameProgress(), one).medals!)).toBe(2)
    expect(mergeMinigameProgress(emptyMinigameProgress(), emptyMinigameProgress()).medals).toBeUndefined()
    const before = play(emptyMedals(), 3)
    expect(validateAccountMinigameProgressDocument(doc(before))).toBe(true)
    expect(validateAccountMinigameProgressUpdate(doc(before), doc(play(before, 1)))).toBe(true)
    expect(validateAccountMinigameProgressUpdate(doc(before), doc(emptyMedals()))).toBe(false)
    const owning = buyTrail(play(play(emptyMedals(), 5, new Date(2026, 9, 1)), 5, day), "stardust").state
    expect(validateAccountMinigameProgressUpdate(doc(owning), doc({ ...owning, owned: [] }))).toBe(false)
    expect(medalsGrewFrom(owning, owning)).toBe(true)
    // Over-cap day counts are rejected by the schema.
    expect(validateAccountMinigameProgressDocument(doc({ ...before, days: { "2026-10-09": [99, 0] } }))).toBe(false)
  })
  it("shows interstitials only to consenting 14+ players, between runs, after a grace period, with a cap", () => {
    const at = (finishedRuns: number, lastShownAt: number | null, now: number, audience = adult) => interstitialDue({ finishedRuns, lastShownAt }, audience, now)
    // Run 0 passes the every-N check, so only the grace period keeps a new player ad-free.
    expect(at(0, null, 0)).toBe(false)
    expect(at(1, null, 0)).toBe(false)
    expect(at(3, null, 0)).toBe(true)
    expect(at(4, null, 0)).toBe(false)
    expect(at(6, 0, 60_000)).toBe(false)
    expect(at(6, 0, MINIGAME_REWARD_RULES.interstitialMinGapSeconds * 1000)).toBe(true)
    expect(at(3, null, 0, { ageVerified14Plus: false, adConsent: true })).toBe(false)
    expect(at(3, null, 0, { ageVerified14Plus: true, adConsent: false })).toBe(false)
  })
  it("ships with no ad network and no eligible audience", async () => {
    expect(NO_ADS.available).toBe(false)
    expect(await NO_ADS.rewarded("result-bonus")).toBe("unavailable")
    expect(await NO_ADS.interstitial("between-runs")).toBe("unavailable")
    expect(NO_AD_AUDIENCE).toEqual({ ageVerified14Plus: false, adConsent: false })
  })
  it("keeps medals and game results out of every point, reward and payment module", () => {
    const walk = (dir: string): string[] => readdirSync(dir).flatMap(name => {
      const path = join(dir, name)
      return statSync(path).isDirectory() ? walk(path) : /\.(tsx?)$/u.test(name) && !/\.test\./u.test(name) ? [path] : []
    })
    const offenders = walk("src").filter(path => !/minigame|treadmill|TreadmillGame/u.test(path)
      && /from "[^"]*minigame\/(rewards|progress|tour|treadmill)"/u.test(readFileSync(path, "utf8")))
    expect(offenders.filter(path => /reward|engagement|decoration|point|account-reward/iu.test(path))).toEqual([])
    const rewards = readFileSync("src/domain/minigame/rewards.ts", "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/gu, "")
    expect(rewards).not.toMatch(/from "[^"]*(reward-service|engagement|decoration|account-reward)/u)
    expect(rewards).not.toMatch(/convert|exchange|toPoints|cashOut|withdraw/iu)
  })
})
