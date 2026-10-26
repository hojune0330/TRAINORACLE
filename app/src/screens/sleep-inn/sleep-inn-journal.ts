import type { EveningEntry, JournalEntry } from '../../domain/journal-store'
import type { SleepInnJournalContext } from './types'

/** Only an explicitly selected journal is the source. Multiple records are never merged. */
export function sleepJournalChoices(entries: readonly JournalEntry[], date: string): EveningEntry[] {
  return entries.filter((entry): entry is EveningEntry => entry.kind === 'evening' && entry.date === date)
}

export function selectSleepJournal(entries: readonly EveningEntry[], selectedId?: string): EveningEntry | undefined {
  if (selectedId !== undefined) {
    const matches = entries.filter(entry => entry.id === selectedId)
    return matches.length === 1 ? matches[0] : undefined
  }
  return entries.length === 1 ? entries[0] : undefined
}

export function sleepJournalProjection(date: string, entry?: EveningEntry, available = true): SleepInnJournalContext {
  if (!available) return { date, status: 'unavailable', sourceLabel: '일지 확인 필요' }
  if (!entry) return { date, status: 'missing', sourceLabel: '연결할 수면 기록 없음' }
  const sleepH = entry.sleepH > 0 && entry.fieldProvenance?.sleepH?.provenance !== 'MISSING' ? entry.sleepH : undefined
  const sleepQuality = entry.sleepQuality > 0 && entry.fieldProvenance?.sleepQuality?.provenance !== 'MISSING' ? entry.sleepQuality : undefined
  const fields = [sleepH !== undefined ? entry.fieldProvenance?.sleepH : undefined,
    sleepQuality !== undefined ? entry.fieldProvenance?.sleepQuality : undefined].filter(Boolean)
  return {
    date, entryId: entry.id, status: sleepH !== undefined || sleepQuality !== undefined ? 'recorded' : 'missing',
    ...(sleepH === undefined ? {} : { sleepH }), ...(sleepQuality === undefined ? {} : { sleepQuality }),
    ...(sleepQuality === undefined ? {} : { sleepQualityExplicit: entry.fieldProvenance?.sleepQuality?.provenance === 'EXPLICIT' }),
    sourceLabel: fields.length > 0 && fields.every(field => field?.provenance === 'EXPLICIT')
      ? '일지에 직접 입력한 수면' : '기존 일지 · 입력 출처 확인 필요',
  }
}
