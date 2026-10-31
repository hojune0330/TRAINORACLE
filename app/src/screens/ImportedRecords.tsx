import { ArrowLeft, ChevronRight } from "lucide-react"
import type { JournalEntry } from "../domain/journal-store"
import { hasImportedField, isImportedField } from "../domain/field-provenance"
import { AppHeading } from "../components/AppHeading"
import { RecordNotice } from "../components/RecordUI"
import { compactDate } from "../domain/dates"
import { importedActivityFactLabels } from "./import-activities/ImportedActivityFacts"
import { LogDetail } from "./LogDetail"
import React from "react"
import { useActiveContentScroll } from "../hooks/useActiveContentScroll"
import { activeLocalAccount } from "../domain/account/local-journal-ownership"
import { readCurrentConfirmedAccountJournalProjection } from "../domain/account/account-journal-projection"
import "./imported-records.css"

/** Actual imported journals, never a file-analysis result or a guessed save receipt. */
export function ImportedRecords({ entries, readComplete, readUnavailable = false, onRetry, selected, onOpenEntry, onBack }: {
  readonly entries: readonly JournalEntry[]
  readonly readComplete: boolean
  readonly readUnavailable?: boolean
  readonly onRetry?: (() => void) | undefined
  readonly selected?: { readonly date: string; readonly id: string } | undefined
  readonly onOpenEntry: (date: string, id: string) => void
  readonly onBack: () => void
}) {
  const pageRef = React.useRef<HTMLElement>(null), headingRef = React.useRef<HTMLHeadingElement>(null)
  useActiveContentScroll(selected ? null : "imported-records", pageRef, headingRef)
  const confirmed = activeLocalAccount() === null ? null : readCurrentConfirmedAccountJournalProjection()
  const imported = entries.filter(entry => (!confirmed || confirmed.some(record => record.id === entry.id && record.date === entry.date && record.savedAt === entry.savedAt))
    && entry.kind === "post-session" && (entry.fileObservation || hasImportedField(entry.fieldProvenance)))
    .sort((a, b) => b.date.localeCompare(a.date) || b.savedAt.localeCompare(a.savedAt) || a.id.localeCompare(b.id))
  const target = selected && imported.find(entry => entry.id === selected.id && entry.date === selected.date)
  if (selected) return <LogDetail date={selected.date} initialEntryId={selected.id} readOnly readComplete={readComplete}
    entries={target ? imported.filter(entry => entry.date === selected.date) : []} onBack={onBack} />
  return <section ref={pageRef} className="imported-records" aria-label="가져온 기록 목록">
    <header><button type="button" aria-label="이전 화면으로 돌아가기" onClick={onBack}><ArrowLeft size={20} aria-hidden="true" /></button>
      <AppHeading ref={headingRef} tabIndex={-1} as="h1" variant="screen">가져온 기록</AppHeading></header>
    <p>{readComplete ? `저장한 파일 기록 ${imported.length}건이에요.` : `불러온 파일 기록 ${imported.length}건이에요.`} 항목을 고르면 그 일지를 볼 수 있어요.</p>
    <p className="imported-records__scope">원본 수치 보기예요. 파일 저장과 분석 포함은 달라요.</p>
    {!readComplete && <RecordNotice kind="unknown" title={readUnavailable ? "기록을 모두 확인하지 못했어요" : "기록 확인 중"}
      {...(onRetry ? { action: { label: "다시 확인", onClick: onRetry } } : {})}><p>불러온 항목만 표시해요. 기록이 없다는 뜻은 아니에요.</p></RecordNotice>}
    {readComplete && imported.length === 0 && <RecordNotice kind="empty" title="가져온 기록이 없어요"><p>확인된 파일 일지가 아직 없어요.</p></RecordNotice>}
    <ol aria-label="저장한 파일 일지">
      {imported.map((entry, index) => {
        if (entry.kind !== "post-session") return null
        const facts = importedActivityFactLabels({ date: entry.date, name: entry.title, sport: "",
          distanceKm: isImportedField("distanceKm", entry.fieldProvenance) ? entry.distanceKm : "",
          durationMin: isImportedField("durationMin", entry.fieldProvenance) ? entry.durationMin : "", avgPace: "",
          ...(entry.fileObservation ? { observation: entry.fileObservation } : {}),
        })
        return <li key={entry.id}><button type="button" id={`imported-record-${entry.id}`} onClick={() => onOpenEntry(entry.date, entry.id)}>
          <span className="imported-records__identity"><span>{compactDate(entry.date)} · 기록 {index + 1}</span><strong>{entry.title || "가져온 운동"}</strong></span>
          <ChevronRight size={18} aria-hidden="true" />
          <span className="imported-records__values"><span>거리 <strong>{facts.distance}</strong></span><span>{facts.meaning === "TIMER" || facts.meaning === "MOVING" || facts.meaning === "ELAPSED" ? facts.timeLabel : "파일 시간"} <strong>{facts.duration}</strong>
            {facts.meaning !== "TIMER" && facts.meaning !== "MOVING" && facts.meaning !== "ELAPSED" && <span>종류 미확인</span>}</span></span>
          <span className="imported-records__source">파일에서 가져옴{entry.fileObservation ? ` · ${entry.fileObservation.format.toUpperCase()}` : ""}</span>
        </button></li>
      })}
    </ol>
  </section>
}
