import { describe, expect, it } from "vitest"
import {
  activeCharacter, characterUnlocked, cityUnlocked, emptyMinigameProgress, mergeMinigameProgress, minigameProgressSchema,
  nextCity, recordCityResult, seasonUnlocked, totalStars, updateMinigameSettings, MINIGAME_CHARACTERS,
} from "./progress"
import type { MinigameProgress } from "./progress"
import { TOUR_CITIES, tourCity } from "./tour"
import { validateAccountMinigameProgressDocument, validateAccountMinigameProgressUpdate } from "../account/account-minigame-progress-schema"
import { validateAccountStateDocument, validateAccountStateDocumentUpdate } from "../account/account-state-schema"

const city = (id: string) => tourCity(id)!
const clear = (progress: MinigameProgress, ...ids: string[]) => ids.reduce((value, id) => recordCityResult(value, id, 1, 500), progress)
const doc = (data: MinigameProgress) => ({ version: 3, state: "ACCOUNT_STATE", kind: "MINIGAME_PROGRESS", data })

describe("tour unlocks", () => {
  it("opens Seoul only, then each next city after a clear, then season 2 after Busan", () => {
    const fresh = emptyMinigameProgress()
    expect(TOUR_CITIES.filter(item => cityUnlocked(fresh, item)).map(item => item.id)).toEqual(["seoul"])
    expect(seasonUnlocked(fresh, "world")).toBe(false)
    const seoul = clear(fresh, "seoul")
    expect(cityUnlocked(seoul, city("daejeon"))).toBe(true)
    expect(cityUnlocked(seoul, city("daegu"))).toBe(false)
    expect(nextCity(seoul, "seoul")?.id).toBe("daejeon")
    const korea = clear(fresh, "seoul", "daejeon", "daegu")
    expect(seasonUnlocked(korea, "world")).toBe(false)
    expect(cityUnlocked(korea, city("tokyo"))).toBe(false)
    const busan = clear(korea, "busan")
    expect(seasonUnlocked(busan, "world")).toBe(true)
    expect(cityUnlocked(busan, city("tokyo"))).toBe(true)
    expect(cityUnlocked(busan, city("osaka"))).toBe(false)
    expect(nextCity(busan, "busan")?.id).toBe("tokyo")
  })
  it("never counts a failed run (0 stars) as a clear", () => {
    const failed = recordCityResult(emptyMinigameProgress(), "seoul", 0, 900)
    expect(failed).toEqual(emptyMinigameProgress())
    expect(cityUnlocked(failed, city("daejeon"))).toBe(false)
  })
  it("keeps the best stars and score, and counts clears", () => {
    let progress = recordCityResult(emptyMinigameProgress(), "seoul", 3, 1200)
    progress = recordCityResult(progress, "seoul", 1, 400)
    expect(progress.cities.seoul).toEqual({ stars: 3, bestScore: 1200, clears: 2 })
    expect(totalStars(progress)).toBe(3)
  })
  it("unlocks cosmetic characters by city clears and total stars, and falls back when locked", () => {
    const fresh = emptyMinigameProgress()
    expect(MINIGAME_CHARACTERS.filter(item => characterUnlocked(fresh, item.id)).map(item => item.id)).toEqual(["tori", "hana"])
    expect(characterUnlocked(clear(fresh, "seoul"), "dandan")).toBe(true)
    const six = ["seoul", "daejeon"].reduce((value, id) => recordCityResult(value, id, 3, 1), fresh)
    expect(characterUnlocked(six, "nabi")).toBe(true)
    expect(characterUnlocked(recordCityResult(fresh, "seoul", 3, 1), "nabi")).toBe(false)
    expect(characterUnlocked(fresh, "nobody")).toBe(false)
    expect(activeCharacter({ ...fresh, character: "r01" })).toBe("tori")
    expect(activeCharacter({ ...clear(fresh, "seoul", "daejeon", "daegu", "busan"), character: "r01" })).toBe("r01")
  })
})

describe("progress merge (two devices, any order)", () => {
  const a = updateMinigameSettings(recordCityResult(recordCityResult(emptyMinigameProgress(), "seoul", 2, 900), "daejeon", 1, 300),
    { sound: false, character: "hana" }, new Date("2026-10-08T01:00:00.000Z"))
  const b = updateMinigameSettings(recordCityResult(emptyMinigameProgress(), "seoul", 3, 700),
    { effects: "low" }, new Date("2026-10-08T02:00:00.000Z"))
  it("keeps every star and best score from both, and the newest settings", () => {
    const merged = mergeMinigameProgress(a, b)
    expect(merged.cities).toEqual({ daejeon: { stars: 1, bestScore: 300, clears: 1 }, seoul: { stars: 3, bestScore: 900, clears: 1 } })
    expect(merged.settings.effects).toBe("low")
    expect(merged.settings.sound).toBe(true)
    expect(merged.character).toBe("tori")
  })
  it("is commutative, idempotent and associative", () => {
    const c = recordCityResult(emptyMinigameProgress(), "daegu", 1, 50)
    expect(mergeMinigameProgress(a, b)).toEqual(mergeMinigameProgress(b, a))
    expect(mergeMinigameProgress(a, a)).toEqual(mergeMinigameProgress(a, emptyMinigameProgress()))
    expect(mergeMinigameProgress(mergeMinigameProgress(a, b), c)).toEqual(mergeMinigameProgress(a, mergeMinigameProgress(b, c)))
  })
})

describe("minigame progress storage contract", () => {
  const good = recordCityResult(emptyMinigameProgress(), "seoul", 2, 900)
  it("accepts the game shape only: no training, health or point fields", () => {
    expect(minigameProgressSchema.safeParse(good).success).toBe(true)
    expect(validateAccountMinigameProgressDocument(doc(good))).toBe(true)
    expect(validateAccountStateDocument(doc(good))).toBe(true)
    for (const extra of [{ points: 5 }, { distanceKm: 3 }, { painParts: {} }]) {
      expect(validateAccountMinigameProgressDocument(doc({ ...good, ...extra } as MinigameProgress)), JSON.stringify(extra)).toBe(false)
    }
    expect(validateAccountMinigameProgressDocument(doc({ ...good, cities: { seoul: { stars: 4, bestScore: 1, clears: 1 } } }))).toBe(false)
    expect(validateAccountMinigameProgressDocument(doc({ ...good, cities: { "Bad Id": { stars: 1, bestScore: 1, clears: 1 } } }))).toBe(false)
    expect(validateAccountMinigameProgressDocument({ ...doc(good), kind: "DECORATIONS" })).toBe(false)
  })
  it("lets the server accept growth but refuse a quiet loss of progress", () => {
    const more = recordCityResult(good, "daejeon", 1, 100)
    expect(validateAccountMinigameProgressUpdate(doc(good), doc(more))).toBe(true)
    expect(validateAccountStateDocumentUpdate(doc(good), doc(more))).toBe(true)
    expect(validateAccountMinigameProgressUpdate(doc(good), doc(updateMinigameSettings(good, { sound: false })))).toBe(true)
    for (const lower of [{ ...good, cities: {} as MinigameProgress["cities"] }, { ...good, cities: { seoul: { stars: 1, bestScore: 900, clears: 1 } } },
      { ...good, cities: { seoul: { stars: 2, bestScore: 10, clears: 1 } } }]) {
      expect(validateAccountMinigameProgressUpdate(doc(good), doc(lower))).toBe(false)
      expect(validateAccountStateDocumentUpdate(doc(good), doc(lower))).toBe(false)
    }
  })
})
