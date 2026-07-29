import type { JournalEntry } from "../domain/journal-store"
import { hasImportedField } from "../domain/field-provenance"

type JournalDetailActionsProps = {
  readonly date: string
  readonly entries: readonly JournalEntry[]
  readonly onAddEntry?: (date: string) => void
  readonly onEditEntry?: (entry: JournalEntry) => void
}

function canEdit(entry: JournalEntry): boolean {
  return entry.syncState === "local" && !hasImportedField(entry.fieldProvenance)
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

export function JournalDetailActions({
  date,
  entries,
  onAddEntry,
  onEditEntry,
}: JournalDetailActionsProps) {
  const editableEntries = entries.filter(canEdit)
  if (onAddEntry === undefined && (onEditEntry === undefined || editableEntries.length === 0)) return null

  return (
    <div style={{ padding: "12px 20px 0", display: "grid", gap: 8 }}>
      {onAddEntry !== undefined && (
        <button
          type="button"
          data-testid="journal-add-entry"
          onClick={() => onAddEntry(date)}
          style={buttonStyle("transparent", "var(--ink)")}
        >이 날짜에 일지 더 쓰기</button>
      )}
      {onEditEntry !== undefined && editableEntries.map((entry) => (
        <button
          key={entry.id}
          type="button"
          data-testid={`journal-edit-${entry.id}`}
          onClick={() => onEditEntry(entry)}
          style={buttonStyle("var(--surface)", "var(--ink-2)")}
        >{entryLabel(entry)} 수정</button>
      ))}
    </div>
  )
}

function buttonStyle(background: string, color: string) {
  return {
    minHeight: 44,
    padding: "10px 12px",
    border: "1px solid var(--ink)",
    background,
    color,
    fontFamily: "var(--mono)",
    fontSize: 10.5,
    cursor: "pointer",
    textAlign: "left" as const,
  }
}
