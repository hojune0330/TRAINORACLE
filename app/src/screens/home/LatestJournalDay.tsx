import { BookOpen, ChevronRight } from "lucide-react"
import type { JournalEntry } from "../../domain/journal-schema"
import { isValidIsoDate } from "../../domain/dates"
import { hasImportedField } from "../../domain/field-provenance"

const KIND_LABELS = [
  ["post-session", "훈련"], ["race", "경기"], ["evening", "하루 마무리"],
] as const

/** A day is one destination, even when it contains several kinds of journal. */
export function LatestJournalDay({ entries, today, onOpenDay, onOpenArchive }: {
  readonly entries: readonly JournalEntry[]
  readonly today: string
  readonly onOpenDay?: (date: string) => void
  readonly onOpenArchive?: () => void
}) {
  const latest = entries.filter(entry => isValidIsoDate(entry.date) && entry.date <= today)
    .map(entry => entry.date).sort().at(-1)
  if (latest === undefined) return null
  const dayEntries = entries.filter(entry => entry.date === latest)
  const kinds = KIND_LABELS.flatMap(([kind, label]) => {
    const count = dayEntries.filter(entry => entry.kind === kind).length
    return count > 0 ? [`${label} ${count}`] : []
  }).join(" · ")
  const [year, month, day] = latest.split("-")
  const dateLabel = `${Number(month)}월 ${Number(day)}일`
  const localCount = dayEntries.filter(entry => entry.syncState !== "synced").length
  const imported = dayEntries.some(entry => hasImportedField(entry.fieldProvenance))

  return <section className="home-hub__recent" aria-label="최근 하루 기록">
    <div className="home-hub__section-heading">
      <h2>최근 기록</h2>
      <button type="button" onClick={onOpenArchive}>전체 일지 <ChevronRight size={16} aria-hidden="true" /></button>
    </div>
    <button type="button" className="home-hub__summary-row" onClick={() => onOpenDay?.(latest)}
      aria-label={`${year}년 ${dateLabel} 기록 ${dayEntries.length}개 보기 · ${kinds}`}>
      <BookOpen size={20} aria-hidden="true" />
      <span className="home-hub__summary-copy">
        <strong>{latest === today ? "오늘" : dateLabel} 기록 {dayEntries.length}개</strong>
        <span>{kinds}</span>
        <small>{localCount > 0 ? `이 기기에만 있는 기록 ${localCount}개` : "계정 보관"}{imported ? " · 가져온 기록 포함" : ""}</small>
      </span>
      <ChevronRight size={18} aria-hidden="true" />
    </button>
  </section>
}
