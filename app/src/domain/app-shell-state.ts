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
  readonly journalMode: "CALENDAR" | "CYCLE"
  readonly cycleAnchor: string | null
  readonly cycleIndex: number
  readonly journalDraft?: {
    readonly date: string
    readonly initialEntry?: JournalEntry
    readonly returnTab: "home" | "journal"
    readonly archiveSelection: ArchiveSelection | null
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
  journalMode: "CALENDAR",
  cycleAnchor: null,
  cycleIndex: 0,
}

export function viewForTab(tab: AppTab, entryType: EntryType = "choose"): AppViewState {
  return {
    ...INITIAL_VIEW_STATE,
    tab,
    entryType,
    archiveSelection: tab === "journal"
      ? { selectedMonth: null, selectedWeekStart: null }
      : null,
  }
}

export function viewForJournalReturn(state: AppViewState): AppViewState {
  const draft = state.journalDraft
  if (draft === undefined) return INITIAL_VIEW_STATE
  return {
    ...INITIAL_VIEW_STATE,
    tab: draft.returnTab,
    detailDate: draft.date,
    archiveSelection: draft.returnTab === "journal" ? draft.archiveSelection : null,
    journalMode: state.journalMode,
    cycleAnchor: state.cycleAnchor,
    cycleIndex: state.cycleIndex,
  }
}

export function viewForJournalDraft(
  state: AppViewState,
  date: string,
  initialEntry?: JournalEntry,
): AppViewState {
  return {
    ...state,
    tab: "log",
    entryType: initialEntry?.kind ?? "choose",
    detailDate: date,
    journalDraft: {
      date,
      ...(initialEntry === undefined ? {} : { initialEntry }),
      returnTab: state.tab === "journal" ? "journal" : "home",
      archiveSelection: state.archiveSelection,
    },
  }
}
