import { ChevronDown, PenLine, Plus, Settings2 } from "lucide-react"
import React from "react"
import type { JournalEntry } from "../domain/journal-store"
import { canEditJournalEntry } from "../domain/journal-edit-policy"

type JournalDetailActionsProps = {
  readonly date: string
  readonly entries: readonly JournalEntry[]
  readonly onAddEntry?: (date: string) => void
  readonly onEditEntry?: (entry: JournalEntry) => void
}

function hasDuplicateId(entries: readonly JournalEntry[], id: string): boolean {
  let seen = 0
  for (const entry of entries) {
    if (entry.id === id) {
      seen += 1
      if (seen > 1) return true
    }
  }
  return false
}

function entryLabel(entry: JournalEntry): string {
  switch (entry.kind) {
    case "post-session":
      return "훈련 기록"
    case "evening":
      return "하루 마무리"
    case "race":
      return "경기 기록"
  }
}

function savedClock(savedAt: string): string {
  const date = new Date(savedAt)
  if (Number.isNaN(date.getTime())) return "시간 미상"
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`
}

function entryDescriptor(entry: JournalEntry): string {
  switch (entry.kind) {
    case "post-session":
      return entry.title.trim().slice(0, 40) || savedClock(entry.savedAt)
    case "evening":
      return savedClock(entry.savedAt)
    case "race":
      return entry.record.trim().slice(0, 40) || savedClock(entry.savedAt)
  }
}

function editLabel(entry: JournalEntry, entries: readonly JournalEntry[]): string {
  const sameKind = entries.filter((candidate) => candidate.kind === entry.kind)
  if (sameKind.length < 2) return `${entryLabel(entry)} 수정`
  const position = sameKind.findIndex((candidate) => candidate.id === entry.id) + 1
  return `${entryLabel(entry)} 수정 ${position}/${sameKind.length} · ${entryDescriptor(entry)}`
}

export function JournalDetailActions({
  date,
  entries,
  onAddEntry,
  onEditEntry,
}: JournalDetailActionsProps) {
  const [open, setOpen] = React.useState(false)
  const bodyId = React.useId()
  const editableEntries = entries.filter((entry) => canEditJournalEntry(entry) && !hasDuplicateId(entries, entry.id))
  if (onAddEntry === undefined && (onEditEntry === undefined || editableEntries.length === 0)) return null

  const managementSummary = [
    onAddEntry === undefined ? null : "새 기록 추가",
    editableEntries.length > 0 ? `수정 ${editableEntries.length}개` : null,
  ].filter((label): label is string => label !== null).join(" · ")

  return (
    <section className="journal-detail-actions" data-open={open ? "true" : "false"}>
      <button
        type="button"
        className="journal-detail-actions__summary"
        data-testid="journal-manage-toggle"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="journal-detail-actions__summary-content">
          <span className="journal-detail-actions__title">
            <Settings2 aria-hidden="true" size={16} />
            이 날의 기록 관리
          </span>
          <small>{managementSummary}</small>
          <ChevronDown aria-hidden="true" size={18} />
        </span>
      </button>
      <div id={bodyId} className="journal-detail-actions__body" hidden={!open}>
        {onAddEntry !== undefined && (
          <button
            type="button"
            className="journal-detail-actions__button journal-detail-actions__button--add"
            data-testid="journal-add-entry"
            onClick={() => onAddEntry(date)}
          ><Plus aria-hidden="true" size={15} />이 날짜에 일지 더 쓰기</button>
        )}
        {onEditEntry !== undefined && editableEntries.map((entry) => (
          <button
            key={entry.id}
            type="button"
            className="journal-detail-actions__button"
            data-testid={`journal-edit-${entry.id}`}
            onClick={() => onEditEntry(entry)}
          ><PenLine aria-hidden="true" size={15} />{editLabel(entry, editableEntries)}</button>
        ))}
      </div>
    </section>
  )
}
