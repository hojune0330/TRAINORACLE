import { describe, expect, it } from 'vitest'
import { newSoloPush, startSoloPush, advanceSoloPush, pushSeriesPoints, pushInput } from './solo-push'
import { newSoloDefense, startDefenseWave, advanceSoloDefense, buyFacility, defenseInput, defenseSpawns } from './solo-defense'
import type { SoloDefense } from './solo-defense'
import { bestSoloRecord, loadSoloCheckpoint, saveSoloCheckpoint, storeSoloRecord, readSoloRecords, SOLO_CHECKPOINT_KEY, SOLO_RECORDS_KEY } from './solo-party-storage'

const memory = () => {
  const values = new Map<string, string>()
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, val: string) => { values.set(key, val) }, removeItem: (key: string) => { values.delete(key) } }
}
function completeWave(s: SoloDefense, active = false) {
  startDefenseWave(s)
  for (let frame = 0; frame < 4000 && (s.phase === 'countdown' || s.phase === 'playing'); frame++) {
    const p = s.runner, run = p.x < .57 && p.energy > 22
    if (active) {
      const near = s.enemies.some(e => Math.abs(e.x - p.x) < .135)
      const danger = s.enemies.some(e => e.x > p.x && e.x - p.x < .09)
      defenseInput(s, run, near && p.cooldown <= 0 ? 'dash' : danger && p.dash <= 0 ? 'jump' : undefined)
    }
    advanceSoloDefense(s, 1 / 60, active && run)
  }
}

describe('solo party rules', () => {
  it('plays two full push rounds with unlimited idle respawns and resets the body between rounds', () => {
    const s = newSoloPush(); startSoloPush(s)
    for (let n = 0; n < 5600; n++) advanceSoloPush(s, 1 / 60, false)
    expect(s.phase).toBe('between'); expect(s.results).toHaveLength(1)
    expect(s.game.players[0]!.falls).toBeGreaterThan(3)
    startSoloPush(s)
    expect(s.round).toBe(2); expect(s.game.players[0]!.energy).toBe(100); expect(s.game.players[0]!.falls).toBe(0)
    for (let n = 0; n < 5600; n++) advanceSoloPush(s, 1 / 60, false)
    expect(s.phase).toBe('finished'); expect(s.results).toHaveLength(2)
    const frozen = JSON.stringify(s); advanceSoloPush(s, 1 / 60, true); expect(JSON.stringify(s)).toBe(frozen)
    expect(pushSeriesPoints(s.results, 'you')).toBeLessThanOrEqual(4)
  })
  it('push inputs obey the shared energy and dash cooldown instead of giving solo free attacks', () => {
    const s = newSoloPush(); startSoloPush(s)
    for (let n = 0; n < 360; n++) advanceSoloPush(s, 1 / 60, true)
    const p = s.game.players[0]!; p.protectedUntil = 0; p.energy = 100
    pushInput(s, false, 'dash'); expect(p.energy).toBe(80)
    pushInput(s, false, 'dash'); expect(p.energy).toBe(80)
  })
  it('uses atomic limited construction, freezes purchases after start and keeps all 48 enemy outcomes', () => {
    const s = newSoloDefense()
    expect(buyFacility(s, 0, 'cannon')).toBe(true)
    expect(buyFacility(s, 0, 'cannon')).toBe(false); expect(s.budget).toBe(3)
    expect(buyFacility(s, 0, 'fan')).toBe(false)
    startDefenseWave(s); expect(buyFacility(s, 1, 'fan')).toBe(false)
    for (let n = 0; n < 4000 && s.phase !== 'prepare'; n++) advanceSoloDefense(s, 1 / 60, false)
    expect(s.wave).toBe(2); expect(s.budget).toBe(7)
    expect(s.totals.killed + s.totals.passed + s.totals.unresolved).toBe(12)
    completeWave(s); completeWave(s)
    expect(s.phase).toBe('finished'); expect(s.runner.falls).toBeGreaterThan(10)
    expect(s.totals.killed + s.totals.passed + s.totals.unresolved).toBe(48)
    expect(s.totals.passed).toBeGreaterThan(3) // Base destruction never ends the series.
    const frozen = JSON.stringify(s); advanceSoloDefense(s, 1 / 60, true); expect(JSON.stringify(s)).toBe(frozen)
    expect(defenseSpawns(3).filter(e => e.kind === 'armor')).toHaveLength(4)
    expect(defenseSpawns(2).filter(e => e.kind === 'rush')).toHaveLength(4)
  })
  it('rewards active defense and supply collection instead of leaving identical automatic results', () => {
    const play = (active: boolean) => {
      const s = newSoloDefense(); buyFacility(s, 0, 'cannon'); buyFacility(s, 1, 'fan')
      completeWave(s, active); buyFacility(s, 0, 'cannon')
      completeWave(s, active); buyFacility(s, 2, 'flag')
      completeWave(s, active); return s
    }
    const idle = play(false), active = play(true)
    expect(active.totals.killed).toBeGreaterThan(idle.totals.killed)
    expect(active.totals.pushed).toBeGreaterThan(0)
    expect(active.totals.collected).toBeGreaterThan(0)
    expect(active.totals.collected).toBeLessThanOrEqual(6)
    expect(new Set(active.collectedIds).size).toBe(active.totals.collected)
    expect(active.runner.falls).toBeLessThan(idle.runner.falls)
  })
  it('supply is finite construction budget, never passive energy or respawn farming', () => {
    const s = newSoloDefense(); startDefenseWave(s); s.phase = 'playing'; s.time = 19.7
    s.runner.x = .5; s.runner.protected = 0; s.runner.energy = 40
    advanceSoloDefense(s, 1 / 60, false)
    expect(s.totals.collected).toBe(0); expect(s.budget).toBe(3)
    advanceSoloDefense(s, 1 / 60, true)
    expect(s.budget).toBe(4); expect(s.totals.collected).toBe(1)
    expect(s.runner.energy).toBeLessThan(41)
    for (let n = 0; n < 20; n++) advanceSoloDefense(s, 1 / 60, false)
    expect(s.totals.collected).toBe(1)
    s.runner.respawn = .01; advanceSoloDefense(s, 1 / 60, false)
    expect(s.collectedIds).toEqual([10]); expect(s.budget).toBe(4)
  })
})

describe('solo storage boundaries', () => {
  it('restores the exact next-wave budget, facilities and achievements without granting another wave budget', () => {
    const storage = memory(), s = newSoloDefense()
    buyFacility(s, 1, 'cannon'); completeWave(s, true)
    saveSoloCheckpoint(storage, s, 'one')
    const restored = loadSoloCheckpoint(storage)!
    expect(restored.id).toBe('one'); expect(restored.state.phase).toBe('prepare'); expect(restored.state.wave).toBe(2)
    expect(restored.state.budget).toBe(s.budget); expect(restored.state.facilities[1]!.level).toBe(1)
    expect(restored.state.collectedIds).toEqual(s.collectedIds); expect(restored.state.totals).toEqual(s.totals)
    startDefenseWave(restored.state); expect(restored.state.budget).toBe(s.budget)
    expect(() => saveSoloCheckpoint(storage, restored.state, 'one')).toThrow('save-between-waves-only')
  })
  it('rejects unknown and damaged saves while retaining their original bytes', () => {
    const storage = memory()
    saveSoloCheckpoint(storage, newSoloDefense(), 'future')
    const raw = JSON.stringify({ ...JSON.parse(storage.getItem(SOLO_CHECKPOINT_KEY)!), version: 999 })
    storage.setItem(SOLO_CHECKPOINT_KEY, raw)
    expect(() => loadSoloCheckpoint(storage)).toThrow(); expect(storage.getItem(SOLO_CHECKPOINT_KEY)).toBe(raw)
    storage.setItem(SOLO_RECORDS_KEY, 'broken')
    expect(() => storeSoloRecord(storage, { id: 'one', mode: 'push', version: 1, completedAt: new Date().toISOString(), success: 1, missed: 0, falls: 2, wins: 2 })).toThrow()
    expect(storage.getItem(SOLO_RECORDS_KEY)).toBe('broken')
  })
  it('deduplicates completed series and compares only like modes with a bounded history', () => {
    const storage = memory()
    for (let i = 0; i < 24; i++) storeSoloRecord(storage, { id: String(i), mode: i % 2 ? 'push' : 'defense', version: 1, completedAt: new Date().toISOString(), success: i, missed: i, falls: 1, wins: 2 })
    const latest = readSoloRecords(storage)[19]!
    storeSoloRecord(storage, latest)
    const records = readSoloRecords(storage)
    expect(records).toHaveLength(20); expect(bestSoloRecord(records, 'defense', 1)!.missed).toBe(4)
    expect(bestSoloRecord(records, 'defense')).toBeUndefined()
    expect(records.filter(r => r.id === latest.id)).toHaveLength(1)
    expect(bestSoloRecord(records, 'push')!.success).toBe(23)
    expect(() => saveSoloCheckpoint({ ...storage, setItem: () => { throw new Error('quota') } }, newSoloDefense(), 'x')).toThrow('quota')
  })
})
