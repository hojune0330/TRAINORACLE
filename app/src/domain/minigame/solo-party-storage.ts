import { z } from 'zod'
import { newSoloDefense, DEFENSE_RULES } from './solo-defense'
import type { SoloDefense } from './solo-defense'

// Retain v1 bytes: its budgets/results came from different defense rules.
export const SOLO_CHECKPOINT_KEY = 'trainoracle.solo-party.checkpoint.v2'
export const SOLO_RECORDS_KEY = 'trainoracle.solo-party.records.v1'
const integer = z.number().int().nonnegative()
const facility = z.object({ kind: z.enum(['cannon', 'fan', 'flag']), level: z.union([z.literal(1), z.literal(2)]) })
const totals = z.object({ killed: integer.max(48), passed: integer.max(48), unresolved: integer.max(48), collected: integer.max(6), pushed: integer.max(1000) })
const checkpoint = z.object({ version: z.literal(2), id: z.string().min(1).max(100), wave: integer.min(1).max(3), budget: integer.max(20),
  facilities: z.array(facility.nullable()).length(3), falls: integer.max(1000), totals, collectedIds: z.array(integer).max(6) })
const record = z.object({ id: z.string().min(1).max(100), mode: z.enum(['push', 'defense']), version: z.union([z.literal(1), z.literal(2)]),
  completedAt: z.string().datetime(), success: integer.max(48), missed: integer.max(48), falls: integer.max(1000), wins: integer.max(4) })
export type SoloRecord = z.infer<typeof record>
type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
export function loadSoloCheckpoint(storage: StorageLike): { state: SoloDefense; id: string } | null {
  const raw = storage.getItem(SOLO_CHECKPOINT_KEY)
  if (raw === null) return null
  const c = checkpoint.parse(JSON.parse(raw)), state = newSoloDefense()
  const expectedEnemies = [0, 0, 12, 28][c.wave]!
  if (c.totals.killed + c.totals.passed + c.totals.unresolved !== expectedEnemies
    || new Set(c.collectedIds).size !== c.collectedIds.length || c.totals.collected !== c.collectedIds.length
    || c.collectedIds.some(id => ![10, 11, 20, 21, 30, 31].includes(id) || Math.floor(id / 10) >= c.wave)) throw new Error('incompatible-checkpoint')
  return { id: c.id, state: { ...state, wave: c.wave, budget: c.budget, facilities: c.facilities.map(f => f && ({ ...f, cooldown: 0 })),
    runner: { ...state.runner, falls: c.falls }, totals: c.totals, collectedIds: c.collectedIds } }
}
export function saveSoloCheckpoint(storage: StorageLike, s: SoloDefense, id: string) {
  if (s.phase !== 'prepare') throw new Error('save-between-waves-only')
  const value = checkpoint.parse({ version: DEFENSE_RULES.version, id, wave: s.wave, budget: s.budget, facilities: s.facilities,
    falls: s.runner.falls, totals: s.totals, collectedIds: s.collectedIds })
  const raw = JSON.stringify(value)
  storage.setItem(SOLO_CHECKPOINT_KEY, raw)
  if (storage.getItem(SOLO_CHECKPOINT_KEY) !== raw) throw new Error('save-not-confirmed')
}
export function readSoloRecords(storage: StorageLike): SoloRecord[] {
  const raw = storage.getItem(SOLO_RECORDS_KEY)
  return raw === null ? [] : z.array(record).max(20).parse(JSON.parse(raw))
}
export function storeSoloRecord(storage: StorageLike, value: SoloRecord) {
  const result = record.parse(value), records = readSoloRecords(storage)
  const next = [...records.filter(r => r.id !== result.id), result].slice(-20)
  const raw = JSON.stringify(next)
  storage.setItem(SOLO_RECORDS_KEY, raw)
  if (storage.getItem(SOLO_RECORDS_KEY) !== raw) throw new Error('save-not-confirmed')
  // Only retire the checkpoint belonging to this completed series.
  if (result.mode === 'defense') {
    try { if (loadSoloCheckpoint(storage)?.id === result.id) storage.removeItem(SOLO_CHECKPOINT_KEY) } catch { /* retain unknown versions */ }
  }
  return next
}
/** Compare only the same solo mode and rules, never a friend-room leaderboard. */
export function bestSoloRecord(records: SoloRecord[], mode: SoloRecord['mode'], version: number = mode === 'defense' ? DEFENSE_RULES.version : 1) {
  return records.filter(r => r.mode === mode && r.version === version).sort((a, b) =>
    mode === 'defense' ? a.missed - b.missed || a.falls - b.falls
      : b.wins - a.wins || b.success - a.success || a.falls - b.falls)[0]
}
