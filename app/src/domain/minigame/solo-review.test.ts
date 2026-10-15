import { describe, it, expect } from 'vitest'
import { newSoloDefense, buyFacility } from './solo-defense'
import { beginDefenseReview, finishDefenseReview, previousBestMessage } from './solo-review'
import type { SoloRecord } from './solo-party-storage'

describe('evidence for the next solo attempt', () => {
  it('reports only the completed wave delta, keeps the played facilities and refuses interrupted play', () => {
    const s = newSoloDefense(); s.wave = 2; s.totals.killed = 10; s.totals.passed = 2; s.runner.falls = 3
    buyFacility(s, 0, 'cannon')
    const before = beginDefenseReview(s)
    s.phase = 'playing'; s.totals.killed = 22; s.totals.passed = 5; s.totals.unresolved = 1
    s.totals.pushed = 6; s.totals.collected = 2; s.runner.falls = 4
    expect(finishDefenseReview(before, s)).toBeNull()
    s.phase = 'prepare'; s.wave = 3
    const report = finishDefenseReview(before, s)!
    expect(report).toMatchObject({ wave: 2, killed: 12, passed: 3, unresolved: 1, falls: 1, pushed: 6, collected: 2 })
    s.facilities[0]!.level = 2
    expect(report.facilities[0]).toBe('1번 공 발사기 1단계')
    expect(before.totals.killed).toBe(10)
  })
  it('compares a new result with an earlier same-mode best, never itself or a fabricated first record', () => {
    const current: SoloRecord = { id: 'now', mode: 'defense', version: 1, completedAt: '2026-10-15T00:00:00Z', success: 44, missed: 4, falls: 1, wins: 0 }
    expect(previousBestMessage([current, { ...current, id: 'push', mode: 'push', missed: 0 }], current)).toContain('첫 완주')
    const old = { ...current, id: 'old', missed: 7 }
    expect(previousBestMessage([old, current], current)).toContain('3마리 더 막았어요')
    expect(previousBestMessage([old], { ...current, missed: 9 })).toContain('2마리 더 놓쳤어요')
    expect(previousBestMessage([old], { ...current, missed: 7, falls: 0 })).toContain('낙하 1 → 0회')
  })
})
