/**
 * Minigame progress: tour stars, best game scores, the chosen character and game settings.
 * Game-only data. It never reads or writes training records, health data or reward points (P).
 *
 * Pure rules and schema only (bundled into the server validator, so no browser storage here).
 * Storage lives in progress-store.ts: this device, plus the account document `MINIGAME_PROGRESS`.
 * Progress only grows, so two copies merge without asking: best stars/score win, the newest
 * settings win.
 */
import { z } from "zod"
import { emptyMedals, medalStateSchema, mergeMedals } from "./rewards"
import type { MedalState } from "./rewards"
import { TOUR_CITIES, TOUR_SEASONS } from "./tour"
import type { TourCity, TourSeasonId } from "./tour"

export const MINIGAME_PROGRESS_VERSION = "MINIGAME_PROGRESS_V1"

/** Stable ids. Unknown ids from a newer app version are kept but ignored by this one. */
const idSchema = z.string().regex(/^[a-z][a-z0-9-]{1,23}$/u)
const count = z.number().int().min(0).max(1_000_000)

export const minigameSettingsSchema = z.object({
  sound: z.boolean(),
  vibration: z.boolean(),
  /** "high": WebGPU sky when available and full weather; "low": 2D only, fewer particles. */
  effects: z.enum(["high", "low"]),
  /** "auto": cities play in 2.5D; "flat": always the classic side view. */
  view: z.enum(["auto", "flat"]),
  /** "system" follows the OS setting; "reduce" stills the game even when the OS does not. */
  motion: z.enum(["system", "reduce"]),
  controls: z.enum(["normal", "large"]),
  /** Which side the big run pad sits on. */
  runSide: z.enum(["left", "right"]),
  jumpGuide: z.boolean(),
}).strict()
export type MinigameSettings = z.infer<typeof minigameSettingsSchema>

export const minigameProgressSchema = z.object({
  version: z.literal(MINIGAME_PROGRESS_VERSION),
  cities: z.record(idSchema, z.object({ stars: z.number().int().min(0).max(3), bestScore: count, clears: count }).strict())
    .refine(value => Object.keys(value).length <= 128),
  character: idSchema,
  settings: minigameSettingsSchema,
  settingsUpdatedAt: z.iso.datetime(),
  /** Game-only medals and owned cosmetic items. Optional so V1 saves without it stay valid. */
  medals: medalStateSchema.optional(),
}).strict()
export type MinigameProgress = z.infer<typeof minigameProgressSchema>

export const DEFAULT_MINIGAME_SETTINGS: MinigameSettings = {
  sound: true, vibration: true, effects: "high", view: "auto", motion: "system", controls: "normal", runSide: "left", jumpGuide: true,
}

export function emptyMinigameProgress(): MinigameProgress {
  return { version: MINIGAME_PROGRESS_VERSION, cities: {}, character: "tori", settings: { ...DEFAULT_MINIGAME_SETTINGS },
    settingsUpdatedAt: "1970-01-01T00:00:00.000Z" }
}

/** Commutative, idempotent merge: the order two devices sync in never loses a star. */
export function mergeMinigameProgress(a: MinigameProgress, b: MinigameProgress): MinigameProgress {
  const cities: MinigameProgress["cities"] = {}
  for (const id of [...new Set([...Object.keys(a.cities), ...Object.keys(b.cities)])].sort()) {
    const x = a.cities[id], y = b.cities[id]
    cities[id] = {
      stars: Math.max(x?.stars ?? 0, y?.stars ?? 0),
      bestScore: Math.max(x?.bestScore ?? 0, y?.bestScore ?? 0),
      clears: Math.max(x?.clears ?? 0, y?.clears ?? 0),
    }
  }
  const aNewer = a.settingsUpdatedAt > b.settingsUpdatedAt || (a.settingsUpdatedAt === b.settingsUpdatedAt && JSON.stringify([a.settings, a.character, a.medals?.trail ?? null]) >= JSON.stringify([b.settings, b.character, b.medals?.trail ?? null]))
  const newer = aNewer ? a : b
  const merged: MinigameProgress = { version: MINIGAME_PROGRESS_VERSION, cities, character: newer.character, settings: { ...newer.settings }, settingsUpdatedAt: newer.settingsUpdatedAt }
  if (!a.medals && !b.medals) return merged
  const trail = newer.medals?.trail ?? null
  return { ...merged, medals: mergeMedals(a.medals ?? emptyMedals(), b.medals ?? emptyMedals(), trail) }
}

export function sameMinigameProgress(a: MinigameProgress, b: MinigameProgress): boolean {
  return JSON.stringify(mergeMinigameProgress(a, a)) === JSON.stringify(mergeMinigameProgress(b, b))
}

export function recordCityResult(progress: MinigameProgress, cityId: string, stars: 0 | 1 | 2 | 3, score: number): MinigameProgress {
  const city = progress.cities[cityId]
  if (stars === 0) return progress
  return { ...progress, cities: { ...progress.cities, [cityId]: {
    stars: Math.max(city?.stars ?? 0, stars), bestScore: Math.max(city?.bestScore ?? 0, Math.floor(score)), clears: (city?.clears ?? 0) + 1,
  } } }
}

export function updateMinigameSettings(progress: MinigameProgress, patch: Partial<MinigameSettings> & { character?: string }, now = new Date()): MinigameProgress {
  const { character, ...settings } = patch
  return { ...progress, character: character ?? progress.character, settings: { ...progress.settings, ...settings }, settingsUpdatedAt: now.toISOString() }
}

export function totalStars(progress: MinigameProgress): number {
  return TOUR_CITIES.reduce((sum, city) => sum + (progress.cities[city.id]?.stars ?? 0), 0)
}

export function cityCleared(progress: MinigameProgress, cityId: string): boolean {
  return (progress.cities[cityId]?.stars ?? 0) > 0
}

/** A season opens when the previous season's last city is cleared. */
export function seasonUnlocked(progress: MinigameProgress, season: TourSeasonId): boolean {
  const index = TOUR_SEASONS.findIndex(item => item.id === season)
  if (index <= 0) return index === 0
  const previous = TOUR_CITIES.filter(city => city.season === TOUR_SEASONS[index - 1]!.id)
  return cityCleared(progress, previous[previous.length - 1]!.id)
}

/** The first city of an open season is open; each next city opens when the one before it is cleared. */
export function cityUnlocked(progress: MinigameProgress, city: TourCity): boolean {
  if (!seasonUnlocked(progress, city.season)) return false
  const inSeason = TOUR_CITIES.filter(item => item.season === city.season)
  const index = inSeason.findIndex(item => item.id === city.id)
  return index === 0 || cityCleared(progress, inSeason[index - 1]!.id)
}

export function nextCity(progress: MinigameProgress, cityId: string): TourCity | undefined {
  const index = TOUR_CITIES.findIndex(city => city.id === cityId)
  const next = TOUR_CITIES[index + 1]
  return next && cityUnlocked(progress, next) ? next : undefined
}

/* Characters: cosmetic only, unlocked by tour progress. Art lives in screens/treadmill/sprites.ts. */
export type CharacterUnlock = { kind: "free" } | { kind: "city"; cityId: string } | { kind: "stars"; stars: number }
export const MINIGAME_CHARACTERS = [
  { id: "tori", name: "토리", line: "모자 쓴 기본 러너", unlock: { kind: "free" } },
  { id: "hana", name: "하나", line: "포니테일 스프린터", unlock: { kind: "free" } },
  { id: "dandan", name: "단단", line: "든든한 곰 러너", unlock: { kind: "city", cityId: "seoul" } },
  { id: "nabi", name: "나비", line: "날쌘 고양이", unlock: { kind: "stars", stars: 6 } },
  { id: "r01", name: "R-01", line: "트랙 로봇", unlock: { kind: "city", cityId: "busan" } },
  { id: "pengu", name: "펭구", line: "겨울을 좋아하는 펭귄", unlock: { kind: "stars", stars: 18 } },
] as const satisfies readonly { id: string; name: string; line: string; unlock: CharacterUnlock }[]
export type MinigameCharacterId = typeof MINIGAME_CHARACTERS[number]["id"]

export function characterUnlocked(progress: MinigameProgress, id: string): boolean {
  const character = MINIGAME_CHARACTERS.find(item => item.id === id)
  if (!character) return false
  const unlock: CharacterUnlock = character.unlock
  if (unlock.kind === "free") return true
  if (unlock.kind === "city") return cityCleared(progress, unlock.cityId)
  return totalStars(progress) >= unlock.stars
}

export function unlockLabel(unlock: CharacterUnlock): string {
  if (unlock.kind === "free") return "기본"
  if (unlock.kind === "city") return `${TOUR_CITIES.find(city => city.id === unlock.cityId)?.name ?? unlock.cityId} 완주`
  return `별 ${unlock.stars}개`
}

/** The character to draw: the saved one if it is still unlocked here, else the default. */
export function activeCharacter(progress: MinigameProgress): MinigameCharacterId {
  return (characterUnlocked(progress, progress.character) ? progress.character : "tori") as MinigameCharacterId
}

export function medalsOf(progress: MinigameProgress): MedalState {
  return progress.medals ?? emptyMedals()
}

export function withMedals(progress: MinigameProgress, medals: MedalState, now?: Date): MinigameProgress {
  // Equipping a trail is a settings change: bump the timestamp so it wins the merge on other devices.
  const trailChanged = medals.trail !== (progress.medals?.trail ?? null)
  return { ...progress, medals, ...(trailChanged ? { settingsUpdatedAt: (now ?? new Date()).toISOString() } : {}) }
}
