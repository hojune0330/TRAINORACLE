import type { AppTab } from "../components/AppChrome"
import type { ArchiveSelection } from "./journal-archive"
import type { JournalEntry } from "./journal-store"
import type { EntryType } from "../screens/LogEntry"

export type AppViewState = {
  readonly tab: AppTab
  readonly entryType: EntryType
  readonly detailDate: string | null
  readonly accountOpen: boolean
  readonly importOpen: boolean
  readonly restoreOpen: boolean
  readonly archiveSelection: ArchiveSelection | null
  readonly journalDraft?: {
    readonly date: string
    readonly initialEntry?: JournalEntry
  }
}

export const INITIAL_VIEW_STATE: AppViewState = {
  tab: "home",
  entryType: "choose",
  detailDate: null,
  accountOpen: false,
  importOpen: false,
  restoreOpen: false,
  archiveSelection: null,
}

export function viewForTab(tab: AppTab, entryType: EntryType = "choose"): AppViewState {
  return { ...INITIAL_VIEW_STATE, tab, entryType }
}
