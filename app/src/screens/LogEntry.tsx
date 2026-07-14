import { EntryChooser } from "./log-entry/EntryChooser"
import { EveningCheckin } from "./log-entry/EveningCheckin"
import { PostSessionForm } from "./log-entry/PostSessionForm"
import { RaceForm } from "./log-entry/RaceForm"
import type { JournalEntryType } from "./log-entry/shared"

export type EntryType = "choose" | JournalEntryType

export interface LogEntryProps {
  readonly entryType?: EntryType
  readonly onBack?: () => void
  readonly onDone?: (entryType: JournalEntryType, reviewMessage?: string) => void
}

export function LogEntry({ entryType = "choose", onBack, onDone }: LogEntryProps) {
  if (entryType === "choose") return <EntryChooser onBack={onBack} onPick={onDone} />
  if (entryType === "post-session") return <PostSessionForm onBack={onBack} onDone={onDone} />
  if (entryType === "evening") return <EveningCheckin onBack={onBack} onDone={onDone} />
  if (entryType === "race") return <RaceForm onBack={onBack} onDone={onDone} />
  return null
}

export { BodyDiagram } from "./log-entry/BodyDiagram"
