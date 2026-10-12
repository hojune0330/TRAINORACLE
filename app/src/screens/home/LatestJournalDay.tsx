import { BookOpen, ChevronRight } from "lucide-react"
import { useId, useMemo } from "react"
import type { JournalEntry } from "../../domain/journal-schema"
import type { CalendarReadiness } from "../../domain/calendar-context"
import type { accountJournalProjectionStatus } from "../../domain/account/account-journal-projection"
import { isValidIsoDate } from "../../domain/dates"
import { hasImportedField } from "../../domain/field-provenance"
import { JournalDecorationPreview, useJournalDecorationPreviews } from "../journal/JournalDecorationPreview"

const KIND_LABELS = [
  ["post-session", "훈련"], ["race", "경기"], ["evening", "컨디션·메모"],
] as const

type JournalStorageVersion = Pick<JournalEntry, "savedAt" | "date" | "kind">

/** Metadata from the existing owner-scoped projection; no memo or remote reads. */
export type LatestJournalStorage = {
  readonly readiness: CalendarReadiness
  readonly owner: string | null
  readonly accountStatus: ReturnType<typeof accountJournalProjectionStatus>
  readonly accountStoredVersions: ReadonlyMap<string, JournalStorageVersion>
  readonly currentConfirmedVersions: ReadonlyMap<string, JournalStorageVersion>
}

/** A day is one destination, even when it contains several kinds of journal. */
export function LatestJournalDay({ entries, today, storage, onOpenDay, onOpenArchive }: {
  readonly entries: readonly JournalEntry[]
  readonly today: string
  readonly storage?: LatestJournalStorage
  readonly onOpenDay?: (date: string) => void
  readonly onOpenArchive?: () => void
}) {
  const descriptionId = useId()
  const latest = entries.filter(entry => isValidIsoDate(entry.date) && entry.date <= today)
    .map(entry => entry.date).sort().at(-1)
  const activeDates = useMemo(() => new Set(latest === undefined ? [] : [latest]), [latest])
  const decorationPreviews = useJournalDecorationPreviews(activeDates)
  if (latest === undefined) return null
  const dayEntries = entries.filter(entry => entry.date === latest)
  const kinds = KIND_LABELS.flatMap(([kind, label]) => {
    const count = dayEntries.filter(entry => entry.kind === kind).length
    return count > 0 ? [`${label} ${count}`] : []
  }).join(" · ")
  const [year, month, day] = latest.split("-")
  const dateLabel = `${Number(month)}월 ${Number(day)}일`
  const visibleDate = latest === today ? "오늘" : year === today.slice(0, 4) ? dateLabel : `${year}년 ${dateLabel}`
  const singleKind = dayEntries.length === 1 ? KIND_LABELS.find(([kind]) => kind === dayEntries[0]?.kind)?.[1] : null
  const storageLabel = describeStorage(dayEntries, storage)
  const imported = dayEntries.some(entry => hasImportedField(entry.fieldProvenance))

  return <section className="home-hub__recent" aria-label="최근 하루 기록">
    <div className="home-hub__section-heading">
      <h2>최근 기록</h2>
      <button type="button" onClick={onOpenArchive}>전체 일지 <ChevronRight size={16} aria-hidden="true" /></button>
    </div>
    <button type="button" className="home-hub__summary-row" onClick={() => onOpenDay?.(latest)}
      aria-label={`${year}년 ${dateLabel} 기록 ${dayEntries.length}개 보기 · ${kinds}`} aria-describedby={descriptionId}>
      <BookOpen size={20} aria-hidden="true" />
      <span className="home-hub__summary-copy">
        <span className="home-hub__latest-heading">
          <strong>{visibleDate} · {singleKind ?? `기록 ${dayEntries.length}개`}</strong>
          <JournalDecorationPreview item={decorationPreviews.get(latest)} />
        </span>
        {dayEntries.length > 1 && <span>{kinds}</span>}
        <small id={descriptionId}>{storageLabel}{imported ? " · 가져온 기록 포함" : ""}</small>
      </span>
      <ChevronRight size={18} aria-hidden="true" />
    </button>
  </section>
}

function describeStorage(entries: readonly JournalEntry[], storage?: LatestJournalStorage): string {
  if (storage === undefined) return "저장 범위 확인 필요"
  if (storage.owner === null) {
    // A restored/legacy synced flag alone cannot identify any current account receipt.
    return storage.readiness === "READY" && storage.accountStatus === "IDLE" && entries.every(entry => entry.syncState === "local")
      ? "이 브라우저에 저장됨"
      : "보관된 기록 · 계정 저장 미확인"
  }
  const storedCount = entries.filter(entry => matchesStoredVersion(entry, storage.accountStoredVersions)).length
  const confirmedCount = storage.readiness === "READY" && storage.accountStatus === "READY"
    ? entries.filter(entry => matchesStoredVersion(entry, storage.accountStoredVersions)
      && matchesStoredVersion(entry, storage.currentConfirmedVersions)).length : 0
  const cachedCount = storedCount - confirmedCount
  const deviceCount = entries.length - storedCount
  const parts = [
    ...(confirmedCount > 0 ? [`계정 보관${entries.length > 1 ? ` ${confirmedCount}개` : ""}`] : []),
    ...(cachedCount > 0 ? [`마지막 확인 기록 ${cachedCount}개`] : []),
    ...(deviceCount > 0 ? [`기기 보관${entries.length > 1 ? ` ${deviceCount}개` : ""}`] : []),
  ]
  const state = storage.accountStatus === "LOADING" ? "계정 확인 중"
    : storage.accountStatus === "PENDING" ? "계정 저장 대기"
    : storage.accountStatus === "FAILED" ? "최신 확인 실패"
    : storage.accountStatus === "REJECTED" ? "계정 저장 실패"
    : storage.accountStatus === "CONFLICT" ? "수정 충돌"
    : storage.accountStatus === "IDLE" ? "계정 저장 미확인"
    : cachedCount > 0 || storage.readiness !== "READY" ? "현재 계정 확인 미완료"
    : deviceCount > 0 ? "계정 저장 미확인" : null
  if (state !== null) parts.push(state)
  return parts.join(" · ")
}

function matchesStoredVersion(entry: JournalEntry, versions: ReadonlyMap<string, JournalStorageVersion>): boolean {
  const stored = versions.get(entry.id)
  return entry.syncState === "synced" && stored !== undefined
    && stored.savedAt === entry.savedAt && stored.date === entry.date && stored.kind === entry.kind
}
