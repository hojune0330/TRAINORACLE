import { describe, expect, it } from 'vitest'
import { advanceSoloDefense, buyFacility, defenseInput, defenseSupplies, newSoloDefense, startDefenseWave, waveCount } from './solo-defense'

describe('defense v2 decisions', () => {
  it('a timed dash opens armor to cannon fire; holding does not', () => {
    const state = () => {
      const s = newSoloDefense(); buyFacility(s, 0, 'cannon'); startDefenseWave(s)
      s.phase = 'playing'; s.spawned = 1; s.runner.protected = 0; s.runner.x = .3
      s.enemies = [{ id: 100, kind: 'armor', x: .34, hp: 6, maxHp: 6, touched: true, resist: 0 }]
      return s
    }
    const idle = state(), active = state()
    defenseInput(active, false, 'dash')
    advanceSoloDefense(idle, 1 / 60, false); advanceSoloDefense(active, 1 / 60, false)
    expect(idle.enemies[0]!.hp).toBeCloseTo(5.85)
    expect(active.enemies[0]!.cracked).toBe(true)
    expect(active.enemies[0]!.hp).toBe(4)
  })
  it('two upgraded cannons cannot achieve perfect defense with no player decisions', () => {
    for (const run of [false, true]) {
      const s = newSoloDefense(); buyFacility(s, 0, 'cannon'); buyFacility(s, 1, 'cannon')
      for (let wave = 0; wave < 3; wave++) {
        if (wave) buyFacility(s, wave - 1, 'cannon')
        startDefenseWave(s)
        for (let frame = 0; frame < 4000 && ['countdown', 'playing'].includes(s.phase); frame++) advanceSoloDefense(s, 1 / 60, run)
      }
      expect(s.phase).toBe('finished')
      expect(s.totals.killed).toBeLessThan(48)
      expect(s.totals.killed + s.totals.passed + s.totals.unresolved).toBe(48)
    }
  })
  it('finishes a cleared wave immediately', () => {
    const s = newSoloDefense(); startDefenseWave(s)
    s.phase = 'playing'; s.time = 48; s.spawned = waveCount(1); s.totals.killed = waveCount(1)
    advanceSoloDefense(s, 1 / 60, false)
    expect(s.phase).toBe('prepare'); expect(s.wave).toBe(2); expect(s.time).toBeLessThan(49)
  })
  it('never offers unusable final-wave construction drops', () => {
    const s = newSoloDefense(); s.wave = 3; s.time = 20
    expect(defenseSupplies(s)).toEqual([])
  })
  it('flag location helps an active runner recharge, not an absent runner', () => {
    const s = newSoloDefense(); buyFacility(s, 1, 'flag'); startDefenseWave(s)
    s.phase = 'playing'; s.runner.protected = 0; s.runner.cooldown = 2; s.runner.x = .5
    advanceSoloDefense(s, 1 / 30, false)
    expect(s.runner.cooldown).toBeCloseTo(1.95)
    s.runner.x = .85; s.runner.cooldown = 2; advanceSoloDefense(s, 1 / 30, false)
    expect(s.runner.cooldown).toBeCloseTo(2 - 1 / 30)
  })
})
