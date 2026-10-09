import { readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import {
  emptyMedalLedger, interstitialDue, medalForRewardedView, medalForRun, rewardDay, rewardedOffered, MINIGAME_REWARD_RULES, NO_ADS,
} from "./rewards"

const day = new Date(2026, 9, 9, 12)
const adult = { ageVerified14Plus: true, adConsent: true }

describe("minigame medals (game-only, never money)", () => {
  it("pays the same fixed medal for any run long enough, whatever the result, and caps it per day", () => {
    let ledger = emptyMedalLedger(rewardDay(day))
    const earned: number[] = []
    for (let run = 0; run < MINIGAME_REWARD_RULES.runMedalsPerDay + 3; run++) {
      const result = medalForRun(ledger, 12 + run, day); ledger = result.ledger; earned.push(result.earned)
    }
    expect(earned.filter(value => value > 0)).toHaveLength(MINIGAME_REWARD_RULES.runMedalsPerDay)
    expect(new Set(earned.filter(value => value > 0))).toEqual(new Set([MINIGAME_REWARD_RULES.medalsPerRun]))
    expect(medalForRun(emptyMedalLedger(rewardDay(day)), MINIGAME_REWARD_RULES.minRunSeconds - 1, day).earned).toBe(0)
    // Next local day resets the cap but keeps the balance.
    const tomorrow = medalForRun(ledger, 20, new Date(2026, 9, 10, 0, 5))
    expect(tomorrow.earned).toBe(MINIGAME_REWARD_RULES.medalsPerRun)
    expect(tomorrow.ledger.balance).toBe(ledger.balance + MINIGAME_REWARD_RULES.medalsPerRun)
  })
  it("has no input that could make a score, star, clear or city pay more", () => {
    const source = readFileSync("src/domain/minigame/rewards.ts", "utf8")
    const signature = /export function medalForRun\(([^)]*)\)/u.exec(source)![1]!
    expect(signature).not.toMatch(/score|star|clear|city|stage|combo|mode/iu)
    expect(medalForRun.length).toBe(3)
  })
  it("caps opt-in rewarded views per day and only pays after a completed view is reported", () => {
    let ledger = emptyMedalLedger(rewardDay(day))
    for (let view = 0; view < MINIGAME_REWARD_RULES.rewardedPerDay; view++) ledger = medalForRewardedView(ledger, day).ledger
    expect(ledger.balance).toBe(MINIGAME_REWARD_RULES.rewardedPerDay * MINIGAME_REWARD_RULES.rewardedMedals)
    expect(medalForRewardedView(ledger, day).earned).toBe(0)
    expect(rewardedOffered(ledger, adult, day)).toBe(false)
  })
  it("shows ads only to consenting 14+ players, between runs, after a grace period and with a frequency cap", () => {
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
    expect(rewardedOffered(emptyMedalLedger(rewardDay(day)), { ageVerified14Plus: false, adConsent: true }, day)).toBe(false)
  })
  it("ships with no ad network: the default provider never shows anything", async () => {
    expect(await NO_ADS.rewarded("result-bonus")).toBe("unavailable")
    expect(await NO_ADS.interstitial("between-runs")).toBe("unavailable")
  })
  it("keeps medals and game results out of every point, reward and payment module", () => {
    const walk = (dir: string): string[] => readdirSync(dir).flatMap(name => {
      const path = join(dir, name)
      return statSync(path).isDirectory() ? walk(path) : /\.(tsx?)$/u.test(name) && !/\.test\./u.test(name) ? [path] : []
    })
    const offenders = walk("src").filter(path => {
      if (/minigame|treadmill|TreadmillGame/u.test(path)) return false
      return /from "[^"]*minigame\/(rewards|progress|tour|treadmill)"/u.test(readFileSync(path, "utf8"))
    })
    // Only the game screen and its own domain may import game results; points/rewards/decorations never do.
    expect(offenders.filter(path => /reward|engagement|decoration|point|account-reward/iu.test(path))).toEqual([])
    const rewards = readFileSync("src/domain/minigame/rewards.ts", "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/gu, "")
    expect(rewards).not.toMatch(/from "[^"]*(reward-service|engagement|decoration|account-reward)/u)
    expect(rewards).not.toMatch(/convert|exchange|toPoints|cashOut|withdraw/iu)
  })
})
