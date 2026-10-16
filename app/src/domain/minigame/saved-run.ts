import { z } from "zod"
import { applyUpgrade, newTreadmillRun, TREADMILL_RULES, TREADMILL_STAGES } from "./treadmill"
import type { TreadmillState } from "./treadmill"
import { tourCity, tourStages } from "./tour"

/** Device-only suspended game. Never included in the account progress document. */
export const SAVED_RUN_KEY = "trainoracle.minigame.saved-run.v1"
const finite = (min = 0, max = 1_000_000) => z.number().finite().min(min).max(max)
const count = finite().int()
const upgrade = z.enum(["grip", "spring", "economy"])
const frame = z.object({
  aid: z.object({ claimed: z.number().int().min(0).max(3), rest: finite(0, 3), received: count,
    lastAmount: finite(0, TREADMILL_RULES.aidEnergy) }).strict().default({ claimed: 0, rest: 0, received: 0, lastAmount: 0 }),
  mode: z.enum(["running", "paused", "upgrade"]), countdown: finite(0, 3),
  stage: z.number().int().min(0).max(2), seconds: finite(0, 30),
  x: finite(0, 1), y: finite(0, 300), velocityY: finite(-2000, 2000),
  energy: finite(0, 100), running: z.boolean(), exhausted: z.boolean(),
  dashLeft: finite(0, 1), cooldown: finite(0, 10), invulnerable: finite(0, 1),
  hitFlash: finite(), landed: finite(), spawned: z.number().int().min(0).max(128),
  hazards: z.array(z.object({ id: count, kind: z.enum(["barrier", "spike", "cone", "crate"]),
    x: finite(-1, 2), hit: z.boolean(), passed: z.boolean() }).strict()).max(128),
  upgrades: z.array(upgrade).max(2),
  stats: z.object({ hits: count, cleared: count, jumps: count, dashes: count,
    restSeconds: finite(0, 90), lowestEnergy: finite(0, 100), combo: count,
    bestCombo: count, score: count, retries: count }).strict(),
}).strict()
const schema = z.object({ version: z.literal(1), rulesVersion: z.union([z.literal(3), z.literal(4), z.literal(TREADMILL_RULES.version)]),
  course: z.string().max(30), savedAt: z.string().datetime(),
  state: frame.extend({ checkpoint: frame.nullable() }).strict(),
}).strict()
export type SavedRun = { readonly course: string; readonly savedAt: string; readonly state: TreadmillState; readonly notice?: string }
export type SavedRunRead = { readonly kind: "empty"; readonly raw: null }
  | { readonly kind: "saved"; readonly raw: string; readonly run: SavedRun }
  | { readonly kind: "invalid"; readonly raw: string }
  | { readonly kind: "unavailable"; readonly raw: null }

function packFrame(state: Omit<TreadmillState, "checkpoint">) {
  const { mode, countdown, stage, seconds, x, y, velocityY, energy, running, exhausted,
    dashLeft, cooldown, invulnerable, hitFlash, landed, spawned, hazards, upgrades, stats } = state
  return { aid: state.aid, mode, countdown, stage, seconds, x, y, velocityY, energy, running, exhausted,
    dashLeft, cooldown, invulnerable, hitFlash, landed, spawned, hazards, upgrades, stats }
}

export function decodeSavedRun(raw: string): SavedRun | null {
  try {
    if (raw.length > 50_000) return null
    const parsed = schema.safeParse(JSON.parse(raw))
    if (!parsed.success) return null
    const data = parsed.data, city = tourCity(data.course)
    if (data.course !== "practice" && !city) return null
    const stages = city ? tourStages(city) : TREADMILL_STAGES
    const restore = (value: z.infer<typeof frame>): TreadmillState => {
      // Rebuild physics from the current engine; never trust saved tuning or course data.
      const base = value.upgrades.reduce(applyUpgrade, newTreadmillRun(stages))
      return { ...base, ...value, running: false, exhausted: false,
        mode: value.mode === "upgrade" ? "upgrade" : "paused", message: "중간 저장한 판", checkpoint: null }
    }
    const state = data.state
    if (state.upgrades.length !== state.stage || (state.mode === "upgrade" && (state.stage === 2 || state.seconds !== 30))) return null
    if (state.mode !== "upgrade" && state.seconds >= 30) return null
    if (state.checkpoint && (state.checkpoint.stage !== state.stage || state.checkpoint.seconds !== 0
      || state.checkpoint.upgrades.join() !== state.upgrades.join() || state.checkpoint.mode !== "running")) return null
    const restored = restore(state)
    if (state.checkpoint) {
      const { checkpoint: _, ...checkpoint } = restore(state.checkpoint)
      restored.checkpoint = { ...checkpoint, mode: "running" }
    }
    if (data.rulesVersion < TREADMILL_RULES.version && state.mode !== "upgrade") {
      // The old spawn index refers to a different schedule. Resume safely at the
      // current stage checkpoint, preserving the build and completed-stage score.
      const fresh = state.upgrades.reduce(applyUpgrade, newTreadmillRun(stages))
      const checkpoint = restored.checkpoint ?? { ...fresh, stage: state.stage, mode: "running" as const }
      const { checkpoint: _unused, ...clean } = { ...fresh, ...checkpoint, checkpoint: null }
      return { course: data.course, savedAt: data.savedAt,
        notice: "장애물·보급 규칙이 바뀌어 저장한 구간의 출발점에서 이어져요. 강화는 유지돼요.",
        state: { ...clean, mode: "paused", countdown: TREADMILL_RULES.countdownStage,
          running: false, exhausted: false, checkpoint: clean } }
    }
    return { course: data.course, savedAt: data.savedAt, state: restored }
  } catch { return null }
}

export function readSavedRun(storage: Storage, key: string): SavedRunRead {
  try {
    const raw = storage.getItem(key)
    if (raw === null) return { kind: "empty", raw }
    const run = decodeSavedRun(raw)
    return run ? { kind: "saved", raw, run } : { kind: "invalid", raw }
  } catch { return { kind: "unavailable", raw: null } }
}

export function writeSavedRun(storage: Storage, key: string, course: string, state: TreadmillState, expected: string | null): boolean {
  try {
    const raw = JSON.stringify({ version: 1, rulesVersion: TREADMILL_RULES.version, course,
      savedAt: new Date().toISOString(), state: { ...packFrame(state), checkpoint: state.checkpoint ? packFrame(state.checkpoint) : null } })
    if (!decodeSavedRun(raw) || storage.getItem(key) !== expected) return false
    storage.setItem(key, raw)
    return storage.getItem(key) === raw
  } catch { return false }
}

/** Consume before resuming: a completed run cannot be restored again for its reward. */
export function removeSavedRun(storage: Storage, key: string, expected: string | null): boolean {
  try {
    if (storage.getItem(key) !== expected) return false
    storage.removeItem(key)
    return storage.getItem(key) === null
  } catch { return false }
}
