import { describe, expect, it } from "vitest"
import { advanceTreadmill, nearestHazard, newTreadmillRun, treadmillCommand, treadmillCourseSeconds, TREADMILL_RULES, TREADMILL_STAGES } from "./treadmill"
import type { TreadmillStage, TreadmillState, TreadmillUpgrade } from "./treadmill"
import { TOUR_CITIES, TOUR_SEASONS, citiesOf, tourCity, tourStages } from "./tour"

type Strategy = (state: TreadmillState) => TreadmillState
const player = (target: number, reserve: number, gap: number): Strategy => state => {
  let next = state
  const want = (next.x < target && next.energy > reserve) || (next.x < 0.22 && next.energy > 0)
  if (want !== next.running) next = treadmillCommand(next, { type: "run", held: want })
  const ahead = nearestHazard(next)
  if (ahead && ahead.x - next.x < gap) next = treadmillCommand(next, { type: "jump" })
  if (next.x < 0.16) next = treadmillCommand(next, { type: "dash" })
  return next
}
function play(stages: readonly TreadmillStage[], picks: readonly TreadmillUpgrade[], strategy: Strategy): TreadmillState {
  let state = treadmillCommand(newTreadmillRun(stages), { type: "start", stages })
  for (let frame = 0; frame < 6000 && (state.mode === "running" || state.mode === "upgrade"); frame++) {
    if (state.mode === "upgrade") state = treadmillCommand(treadmillCommand(state, { type: "upgrade", upgrade: picks[state.stage]! }), { type: "resume" })
    state = advanceTreadmill(strategy(state), 1 / 60)
  }
  return state
}

describe("running tour content", () => {
  it("has two seasons of four cities with stable, unique ids", () => {
    expect(TOUR_SEASONS.map(season => season.id)).toEqual(["korea", "world"])
    expect(citiesOf("korea").map(city => city.name)).toEqual(["서울", "대전", "대구", "부산"])
    expect(citiesOf("world").map(city => city.name)).toEqual(["도쿄", "오사카", "파리", "런던"])
    expect(new Set(TOUR_CITIES.map(city => city.id)).size).toBe(TOUR_CITIES.length)
    for (const city of TOUR_CITIES) expect(city.id).toMatch(/^[a-z][a-z0-9-]{1,23}$/u)
    expect(TOUR_CITIES.map(city => city.level)).toEqual(TOUR_CITIES.map((_, index) => index))
    expect(tourCity("busan")?.landmark).toBe("gwangan")
  })
  it("builds each city on the same three surfaces, and gets harder city by city", () => {
    let previous = { hazards: 0, belt: 0 }
    for (const city of TOUR_CITIES) {
      const stages = tourStages(city)
      expect(stages.map(stage => stage.surface)).toEqual(["track", "mud", "spikes"])
      expect(stages.map(stage => stage.name)).toEqual(city.stageNames)
      const hazards = stages.reduce((sum, stage) => sum + stage.course.length, 0)
      const belt = stages[0]!.belt
      expect(hazards, city.id).toBeGreaterThanOrEqual(previous.hazards)
      expect(belt, city.id).toBeGreaterThan(previous.belt)
      previous = { hazards, belt }
      for (const stage of stages) {
        const times = stage.course.map(item => item.at)
        expect(times, stage.id).toEqual([...times].sort((a, b) => a - b))
        // Hazards stay far enough apart to land and jump again, and enter before the stage ends.
        for (let i = 1; i < times.length; i++) expect(times[i]! - times[i - 1]!, `${stage.id} @${times[i]}`).toBeGreaterThanOrEqual(1.1)
        expect(Math.max(...times)).toBeLessThan(TREADMILL_RULES.stageSeconds)
      }
    }
    expect(tourStages(TOUR_CITIES[TOUR_CITIES.length - 1]!).reduce((sum, stage) => sum + stage.course.length, 0))
      .toBeGreaterThan(TREADMILL_STAGES.reduce((sum, stage) => sum + stage.course.length, 0))
  })
  it("plays a city course through the same engine and finishes on its last stage", () => {
    const stages = tourStages(tourCity("seoul")!)
    const done = advanceTreadmill({ ...treadmillCommand(newTreadmillRun(stages), { type: "start", stages }), countdown: 0, stage: 2, seconds: 9.99, spawned: 99 }, 0.05)
    expect(done.mode).toBe("clear")
    expect(done.stages[0]!.id).toBe("seoul-track")
    expect(treadmillCourseSeconds(done)).toBe(30)
    // Restarting keeps the city unless a different course is given.
    expect(treadmillCommand(done, { type: "start" }).stages[0]!.id).toBe("seoul-track")
    expect(treadmillCommand(done, { type: "start", stages: TREADMILL_STAGES }).stages[0]!.id).toBe("track")
  })
})

describe("tour balance guard (game feel, not training)", () => {
  it("keeps every city clearable by a player that runs, rests and times jumps, with every upgrade path", () => {
    for (const city of TOUR_CITIES) for (const pick of ["grip", "spring", "economy"] as const) {
      expect(play(tourStages(city), [pick, pick], player(0.55, 25, 0.08)).mode, `${city.id} ${pick}`).toBe("clear")
    }
  })
  it("still does not reward doing nothing or only holding run, even in the first city", () => {
    for (const city of [TOUR_CITIES[0]!, TOUR_CITIES[TOUR_CITIES.length - 1]!]) {
      expect(play(tourStages(city), ["grip", "grip"], state => state).failure, city.id).toBe("fall")
      const holdOnly: Strategy = state => {
        const next = state.running ? state : treadmillCommand(state, { type: "run", held: true })
        const ahead = nearestHazard(next)
        return ahead && ahead.x - next.x < 0.09 ? treadmillCommand(next, { type: "jump" }) : next
      }
      expect(play(tourStages(city), ["economy", "economy"], holdOnly).mode, city.id).toBe("over")
    }
  })
  it("makes the last city harder than the first for a careless player", () => {
    const careless = player(0.5, 8, 0.08)
    const survived = (stages: readonly TreadmillStage[]) => {
      const end = play(stages, ["grip", "grip"], careless)
      return end.stage * 10 + end.seconds
    }
    expect(survived(tourStages(TOUR_CITIES[TOUR_CITIES.length - 1]!))).toBeLessThanOrEqual(survived(tourStages(TOUR_CITIES[0]!)))
  })
})
