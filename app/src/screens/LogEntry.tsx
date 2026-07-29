import { EntryChooser } from "./log-entry/EntryChooser"
import { EveningCheckin } from "./log-entry/EveningCheckin"
import { PostSessionForm } from "./log-entry/PostSessionForm"
import { RaceForm } from "./log-entry/RaceForm"
import type { JournalEntryType } from "./log-entry/shared"
import type { JournalEntry } from "../domain/journal-store"

export type EntryType = "choose" | JournalEntryType

export interface LogEntryProps {
  readonly entryType?: EntryType
  readonly onBack?: () => void
  readonly onDone?: (entryType: JournalEntryType, savedEntry?: JournalEntry, reviewMessage?: string) => void
  readonly targetDate?: string
  readonly initialEntry?: JournalEntry
  /** 기기 데이터 가져오기 화면 진입 — 선택 화면에서만 노출 */
  readonly onOpenImport?: () => void
}

export function LogEntry({ entryType = "choose", onBack, onDone, onOpenImport, targetDate, initialEntry }: LogEntryProps) {
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
  if (entryType === "post-session") return <PostSessionForm onBack={onBack} onDone={handleSaved} targetDate={targetDate} initialEntry={initialEntry} />
  if (entryType === "evening") return <EveningCheckin onBack={onBack} onDone={handleSaved} targetDate={targetDate} initialEntry={initialEntry} />
  if (entryType === "race") return <RaceForm onBack={onBack} onDone={handleSaved} targetDate={targetDate} initialEntry={initialEntry} />
  return null
}

export { BodyDiagram } from "./log-entry/BodyDiagram"
