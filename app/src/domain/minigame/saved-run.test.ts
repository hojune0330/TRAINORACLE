import { beforeEach, describe, expect, it } from "vitest"
import { advanceTreadmill, newTreadmillRun, treadmillCommand } from "./treadmill"
import { decodeSavedRun, readSavedRun, removeSavedRun, SAVED_RUN_KEY, writeSavedRun } from "./saved-run"
import { tourCity, tourStages } from "./tour"

const key = SAVED_RUN_KEY
const started = () => treadmillCommand(newTreadmillRun(), { type: "start" })
beforeEach(() => localStorage.clear())

describe("device-only suspended run", () => {
  it("restores fantasy and legacy city courses independently and refuses to overwrite an existing run", () => {
    const state = treadmillCommand(newTreadmillRun(tourStages(tourCity("starlight")!)), {type: "start"})
    expect(writeSavedRun(localStorage, key, "seoul", started(), null)).toBe(true)
    const legacy = localStorage.getItem(key)!
    expect(writeSavedRun(localStorage, key, "starlight", state, null)).toBe(false)
    expect(decodeSavedRun(legacy)?.state.stages[0]?.id).toBe("seoul-track")
    expect(writeSavedRun(localStorage, key, "starlight", state, legacy)).toBe(true)
    const fantasy = readSavedRun(localStorage, key)
    if (fantasy.kind !== "saved") throw Error("missing fantasy run")
    expect(fantasy.run.course).toBe("starlight")
    expect(fantasy.run.state.stages.map(stage => stage.name)).toEqual(["별빛 샘", "수정 다리", "숲의 관문"])
    expect(fantasy.run.state.mode).toBe("paused")
  })
  it("round-trips position, moving obstacles, energy and stats, releasing held input", () => {
    let state = { ...started(), countdown: 0 }
    state = treadmillCommand(state, { type: "run", held: true })
    for (let i = 0; i < 40; i++) state = advanceTreadmill(state, 0.05)
    expect(writeSavedRun(localStorage, key, "practice", state, null)).toBe(true)
    const saved = readSavedRun(localStorage, key)
    expect(saved.kind).toBe("saved")
    if (saved.kind !== "saved") throw Error("missing run")
    expect(saved.run.state).toMatchObject({ mode: "paused", running: false, energy: state.energy,
      seconds: state.seconds, x: state.x, hazards: state.hazards, stats: state.stats })
    expect(removeSavedRun(localStorage, key, saved.raw)).toBe(true)
    expect(readSavedRun(localStorage, key).kind).toBe("empty")
    expect(removeSavedRun(localStorage, key, saved.raw)).toBe(false)
  })
  it("preserves an upgrade selection and reconstructs its tuning and retry checkpoint", () => {
    const checkpoint = started()
    const choice = { ...checkpoint, mode: "upgrade" as const, seconds: 30 }
    expect(writeSavedRun(localStorage, key, "seoul", choice, null)).toBe(true)
    let saved = readSavedRun(localStorage, key)
    if (saved.kind !== "saved") throw Error("missing choice")
    expect(saved.run.state.mode).toBe("upgrade")
    const upgraded = treadmillCommand(saved.run.state, { type: "upgrade", upgrade: "grip" })
    expect(writeSavedRun(localStorage, key, "seoul", upgraded, saved.raw)).toBe(true)
    saved = readSavedRun(localStorage, key)
    if (saved.kind !== "saved") throw Error("missing upgraded run")
    expect(saved.run.state).toMatchObject({ stage: 1, upgrades: ["grip"], mudBonus: 0.5, jumpCost: 10 })
    expect(saved.run.state.checkpoint).toMatchObject({ stage: 1, upgrades: ["grip"], mode: "running" })
    expect(saved.run.state.stages[0]?.name).toBe("한강 러닝트랙")
  })
  it("round-trips both new obstacle kinds and migrates old layouts at their checkpoint", () => {
    const upgraded = treadmillCommand({ ...started(), mode: "upgrade", seconds: 30 }, { type: "upgrade", upgrade: "grip" })
    const state = { ...upgraded, countdown: 0, seconds: 12, spawned: 7,
      hazards: ["cone", "crate"].map((kind, id) => ({ id, kind: kind as "cone" | "crate", x: .8 + id * .2, hit: false, passed: false })) }
    expect(writeSavedRun(localStorage, key, "practice", state, null)).toBe(true)
    const raw = localStorage.getItem(key)!
    expect(decodeSavedRun(raw)?.state.hazards).toEqual(state.hazards)
    const legacy = JSON.parse(raw); legacy.rulesVersion = 3
    legacy.state.hazards = []; legacy.state.stats.score = 999
    const migrated = decodeSavedRun(JSON.stringify(legacy))!
    expect(migrated.notice).toContain("출발점")
    expect(migrated.state).toMatchObject({ stage: 1, seconds: 0, spawned: 0, hazards: [], mode: "paused", upgrades: ["grip"], stats: upgraded.checkpoint!.stats })
    expect(localStorage.getItem(key)).toBe(raw)
    const choice = { ...started(), mode: "upgrade" as const, seconds: 30 }
    expect(writeSavedRun(localStorage, key, "practice", choice, raw)).toBe(true)
    const oldChoice = JSON.parse(localStorage.getItem(key)!); oldChoice.rulesVersion = 3
    expect(decodeSavedRun(JSON.stringify(oldChoice))?.state.mode).toBe("upgrade")
  })
  it("rejects finished runs, corrupt state, incompatible rules and injected tuning", () => {
    expect(writeSavedRun(localStorage, key, "practice", { ...started(), mode: "clear" }, null)).toBe(false)
    expect(writeSavedRun(localStorage, key, "unknown-city", started(), null)).toBe(false)
    expect(writeSavedRun(localStorage, key, "practice", started(), null)).toBe(true)
    const raw = localStorage.getItem(key)!
    for (const corrupt of [
      (v: any) => { v.rulesVersion = 999 },
      (v: any) => { v.state.energy = -1 },
      (v: any) => { v.state.stage = 99 },
      (v: any) => { v.state.jumpCost = 0 },
      (v: any) => { v.state.hazards = [{ kind: "other" }] },
      (v: any) => { v.state.checkpoint.checkpoint = { mode: "running" } },
    ]) {
      const value = JSON.parse(raw); corrupt(value)
      expect(decodeSavedRun(JSON.stringify(value))).toBeNull()
    }
    localStorage.setItem(key, "{broken")
    expect(readSavedRun(localStorage, key).kind).toBe("invalid")
    expect(localStorage.getItem(key)).toBe("{broken")
  })
  it("preserves a claimed aid stop and migrates v4 saves without mixing old automatic supplies", () => {
    const state = { ...started(), countdown: 0, seconds: 10.8,
      aid: { claimed: 1, rest: 0, received: 1, lastAmount: 28 } }
    expect(writeSavedRun(localStorage, key, "practice", state, null)).toBe(true)
    const raw = localStorage.getItem(key)!
    expect(decodeSavedRun(raw)?.state.aid).toEqual(state.aid)
    const old = JSON.parse(raw); old.rulesVersion = 4
    delete old.state.aid; delete old.state.checkpoint.aid
    const restored = decodeSavedRun(JSON.stringify(old))!
    expect(restored.notice).toContain("보급 규칙")
    expect(restored.state.seconds).toBe(0)
    expect(restored.state.aid.claimed).toBe(0)
    expect(localStorage.getItem(key)).toBe(raw)
  })
  it("does not overwrite or consume a newer save from another window", () => {
    expect(writeSavedRun(localStorage, key, "practice", started(), null)).toBe(true)
    const first = localStorage.getItem(key)!
    const newer = first.replace('"energy":100', '"energy":80')
    localStorage.setItem(key, newer)
    expect(writeSavedRun(localStorage, key, "practice", started(), first)).toBe(false)
    expect(removeSavedRun(localStorage, key, first)).toBe(false)
    expect(localStorage.getItem(key)).toBe(newer)
  })
  it("requires confirmed writes and removals; quota and denied storage are failures", () => {
    const unavailable = { getItem: () => { throw Error("denied") } } as unknown as Storage
    expect(readSavedRun(unavailable, key).kind).toBe("unavailable")
    const quota = { getItem: () => null, setItem: () => { throw Error("quota") } } as unknown as Storage
    expect(writeSavedRun(quota, key, "practice", started(), null)).toBe(false)
    const ignored = { getItem: () => null, setItem: () => {} } as unknown as Storage
    expect(writeSavedRun(ignored, key, "practice", started(), null)).toBe(false)
    const noDelete = { getItem: () => "saved", removeItem: () => {} } as unknown as Storage
    expect(removeSavedRun(noDelete, key, "saved")).toBe(false)
  })
  it("keeps guest and account save slots separate without storing or awarding medals", () => {
    localStorage.setItem("trainoracle.minigame.progress.v1", '{"existing":"progress"}')
    expect(writeSavedRun(localStorage, key, "practice", started(), null)).toBe(true)
    expect(readSavedRun(localStorage, key + ".account.synthetic").kind).toBe("empty")
    expect(localStorage.getItem("trainoracle.minigame.progress.v1")).toBe('{"existing":"progress"}')
    expect(localStorage.getItem(key)).not.toContain("medals")
  })
})

