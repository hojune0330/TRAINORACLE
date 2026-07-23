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
}

export function LogEntry({ entryType = "choose", onBack, onDone }: LogEntryProps) {
  if (entryType === "choose") return <EntryChooser onBack={onBack} onPick={(picked) => onDone?.(picked)} />
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
  if (entryType === "post-session") return <PostSessionForm onBack={onBack} onDone={handleSaved} />
  if (entryType === "evening") return <EveningCheckin onBack={onBack} onDone={handleSaved} />
  if (entryType === "race") return <RaceForm onBack={onBack} onDone={handleSaved} />
  return null
}

export { BodyDiagram } from "./log-entry/BodyDiagram"
