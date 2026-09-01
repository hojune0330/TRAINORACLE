import { EntryChooser } from "./log-entry/EntryChooser"
import { EveningCheckin } from "./log-entry/EveningCheckin"
import { PostSessionForm } from "./log-entry/PostSessionForm"
import { RaceForm } from "./log-entry/RaceForm"
import { QuickSessionForm } from "./log-entry/QuickSessionForm"
import type { JournalEntryType, LogEntryType } from "./log-entry/shared"
import type { JournalEntry } from "../domain/journal-store"
import type { PlannedSessionLink } from "../domain/planned-session-link"

export type EntryType = "choose" | "quick-session" | JournalEntryType

export interface LogEntryProps {
  readonly entryType?: EntryType
  readonly onBack?: () => void
  readonly onDone?: (entryType: LogEntryType, savedEntry?: JournalEntry, reviewMessage?: string) => void
  readonly targetDate?: string
  readonly initialEntry?: JournalEntry
  readonly plannedSessionLink?: PlannedSessionLink
  readonly onContinueDetailed?: (entry: JournalEntry) => void
  /** 기기 데이터 가져오기 화면 진입 — 선택 화면에서만 노출 */
  readonly onOpenImport?: () => void
}

export function LogEntry({ entryType = "choose", onBack, onDone, onOpenImport, onContinueDetailed, targetDate, initialEntry, plannedSessionLink }: LogEntryProps) {
  if (entryType === "choose") {
    return <EntryChooser onBack={onBack} onPick={(picked) => onDone?.(picked)} onOpenImport={onOpenImport} targetDate={targetDate} />
  }
  const handleSaved = (
    picked: JournalEntryType,
    savedEntry: JournalEntry,
    reviewMessage?: string,
  ) => {
    if (reviewMessage === undefined) {
      onDone?.(picked, savedEntry)
      return
    }

    onDone?.(picked, savedEntry, reviewMessage)
  }
  const draftKey = `${entryType}:${initialEntry?.id ?? targetDate ?? "new"}`
  if (entryType === "quick-session") return (
    <QuickSessionForm
      key={draftKey}
      onBack={onBack}
      targetDate={targetDate}
      onDone={(entry) => onDone?.("post-session", entry)}
      onContinueDetailed={onContinueDetailed}
    />
  )
  if (entryType === "post-session") return <PostSessionForm key={draftKey} onBack={onBack} onDone={handleSaved} targetDate={targetDate} initialEntry={initialEntry} plannedSessionLink={plannedSessionLink} />
  if (entryType === "evening") return <EveningCheckin key={draftKey} onBack={onBack} onDone={handleSaved} targetDate={targetDate} initialEntry={initialEntry} />
  if (entryType === "race") return <RaceForm key={draftKey} onBack={onBack} onDone={handleSaved} targetDate={targetDate} initialEntry={initialEntry} />
  return null
}

export { BodyDiagram } from "./log-entry/BodyDiagram"
