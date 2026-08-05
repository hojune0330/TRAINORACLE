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

/**
 * 탭바에서 이미 열려 있는 탭을 다시 눌렀을 때, 그 탭을 초기화해야 하는가.
 *
 * 두 요구가 정면으로 부딪히는 자리다.
 *
 * (1) 일지 탭에서 주를 골라 둔 상태로 "일지"를 다시 누르면 선택이 날아가면
 *     안 된다. 고른 주가 사라지는 것은 사용자가 한 일을 앱이 지우는 것이다.
 *     (AppShell.archive.contract.test.tsx
 *      "does not reset the archive when the active journal tab is tapped again")
 *
 * (2) WORK_ORDER_UX2 §3-3이 홈 CTA를 훈련 후 폼 직행으로 바꾼 뒤, 기록 탭은
 *     `entryType: "post-session"` 상태로 들어가게 됐다. 그런데 §3-3 자신이
 *     "More 등 다른 진입은 choose 유지"라고 규정한다. 즉 탭바 "기록"은
 *     여전히 종류 선택 화면으로 가야 한다.
 *
 * `tab`만 비교하면 (2)가 깨진다. 훈련 후 폼에 있는 동안 탭바 "기록"을 눌러도
 *  tab이 이미 "log"라 아무 일도 일어나지 않고, 탭바가 죽은 것처럼 보인다.
 *  `entryType`까지 비교하면 (1)과 (2)가 함께 성립한다. 일지 탭은 entryType을
 *  쓰지 않으므로 (1)의 보호가 그대로 유지된다.
 *
 * 초기화 여부만 답한다. 어디로 갈지는 호출자가 정한다.
 */
export function shouldResetTabView(
  state: AppViewState,
  tab: AppTab,
  overlayOpen: boolean,
): boolean {
  if (overlayOpen) return true
  if (tab !== state.tab) return true
  // 같은 탭이지만 하위 화면에 들어가 있다면, 탭바는 그 탭의 첫 화면으로
  // 돌려보내야 한다. viewForTab의 기본값과 다른 상태가 곧 "하위 화면"이다.
  return state.entryType !== viewForTab(tab).entryType
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
