import { describe, expect, it } from 'vitest'
import type { EveningEntry } from '../../domain/journal-store'
import { selectSleepJournal, sleepJournalChoices, sleepJournalProjection } from './sleep-inn-journal'

const entry: EveningEntry = { id: 'sleep-one', kind: 'evening', date: '2026-10-09', savedAt: '2026-10-09T01:00:00Z', syncState: 'local',
  sleepH: 7.25, sleepQuality: 3, mood: 4, weightKg: '', restingHr: '', painParts: {}, note: 'synthetic private text',
  fieldProvenance: { sleepH: { provenance: 'EXPLICIT' }, sleepQuality: { provenance: 'EXPLICIT' } } }

describe('sleep journal projection', () => {
  it('requires a real selection for multiple records and never borrows another date', () => {
    const other = { ...entry, id: 'sleep-two', sleepH: 9 }
    const choices = sleepJournalChoices([entry, other, { ...entry, id: 'other-date', date: '2026-10-10' }], entry.date)
    expect(choices).toHaveLength(2)
    expect(selectSleepJournal(choices)).toBeUndefined()
    expect(selectSleepJournal(choices, 'sleep-two')).toEqual(other)
    expect(selectSleepJournal(choices, 'deleted')).toBeUndefined()
    expect(selectSleepJournal([entry, { ...entry }], entry.id)).toBeUndefined()
  })
  it('projects only recorded sleep facts and excludes memo, mood, pain and save timestamps', () => {
    expect(sleepJournalProjection(entry.date, entry)).toEqual({ date: entry.date, entryId: entry.id, status: 'recorded',
      sleepH: 7.25, sleepQuality: 3, sourceLabel: '일지에 직접 입력한 수면' })
    expect(sleepJournalProjection(entry.date, { ...entry, sleepH: 0, sleepQuality: 0 })).toMatchObject({ status: 'missing' })
    expect(sleepJournalProjection(entry.date, { ...entry, fieldProvenance: undefined }).sourceLabel).toContain('출처 확인 필요')
  })
  it('does not represent a failed read as missing sleep or expose stale measurements', () => {
    expect(sleepJournalProjection(entry.date, entry, false)).toEqual({ date: entry.date, status: 'unavailable', sourceLabel: '일지 확인 필요' })
    expect(sleepJournalProjection(entry.date, { ...entry, fieldProvenance: { sleepH: { provenance: 'MISSING' }, sleepQuality: { provenance: 'MISSING' } } }))
      .not.toHaveProperty('sleepH')
  })
})
