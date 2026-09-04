import { describe, expect, it } from "vitest"
import {
  INITIAL_VIEW_STATE,
  shouldResetTabView,
  tabForChrome,
  viewForJournalDraft,
  viewForJournalReturn,
  viewForPlannedSessionDraft,
} from "./app-shell-state"
import { stateFixture } from "./plan-beta-store.test-fixture"
import { createPlannedSessionLogDraft } from "./planned-session-link"

describe("app shell return state", () => {
  it("keeps the selected cycle window when returning from a journal draft", () => {
    const state = {
      ...INITIAL_VIEW_STATE,
      tab: "log" as const,
      journalMode: "CYCLE" as const,
      cycleAnchor: "2026-07-20",
      cycleIndex: 2,
      journalDraft: {
        date: "2026-08-08",
        returnTab: "journal" as const,
        archiveSelection: { selectedMonth: "2026-08", selectedWeekStart: "2026-08-03" },
      },
    }

    expect(viewForJournalReturn(state)).toMatchObject({
      tab: "journal",
      journalMode: "CYCLE",
      cycleAnchor: "2026-07-20",
      cycleIndex: 2,
    })
  })

  it("returns a planned-session journal to the plan tab with its exact link", () => {
    const plan = stateFixture()
    const session = plan.activePlan.sessions[0]
    if (session === undefined) throw new Error("Missing fixture session")
    const draft = createPlannedSessionLogDraft(plan, session, "2026-08-28T03:00:00.000Z")
    if (draft === null) throw new Error("Missing planned session draft")

    const view = viewForPlannedSessionDraft(INITIAL_VIEW_STATE, draft)
    expect(view).toMatchObject({
      tab: "log",
      entryType: "quick-session",
      detailDate: draft.date,
      journalDraft: {
        date: draft.date,
        returnTab: "plan",
        plannedSessionLink: draft.link,
      },
    })
    expect(viewForJournalReturn(view).tab).toBe("plan")
  })

  it("keeps the exact planned DAY and AM/PM link through detailed continuation", () => {
    const plan = stateFixture()
    const session = plan.activePlan.sessions[0]
    if (session === undefined) throw new Error("Missing fixture session")
    const draft = createPlannedSessionLogDraft(plan, session, "2026-08-28T03:00:00.000Z")
    if (draft === null) throw new Error("Missing planned session draft")

    const quick = viewForPlannedSessionDraft(INITIAL_VIEW_STATE, draft)
    const detailed = viewForJournalDraft(quick, draft.date)
    expect(viewForJournalReturn(detailed)).toMatchObject({
      tab: "plan",
      returnToSession: draft.link,
    })
  })

  it("returns a cancelled planned journal to its exact plan session without inventing a save", () => {
    const plan = stateFixture()
    const session = plan.activePlan.sessions[0]
    if (session === undefined) throw new Error("Missing fixture session")
    const draft = createPlannedSessionLogDraft(plan, session, "2026-08-28T03:00:00.000Z")
    if (draft === null) throw new Error("Missing planned session draft")

    const view = viewForPlannedSessionDraft(INITIAL_VIEW_STATE, draft)
    expect(viewForJournalReturn(view)).toMatchObject({
      tab: "plan",
      returnToSession: draft.link,
    })
    expect(viewForJournalReturn(view)).not.toHaveProperty("journalDraft")
  })
})

describe("bottom navigation context", () => {
  it.each(["quick-session", "post-session", "evening"] as const)(
    "shows %s as journal work instead of a race record",
    (entryType) => {
      expect(tabForChrome({ ...INITIAL_VIEW_STATE, tab: "log", entryType })).toBe("journal")
    },
  )

  it("keeps the race form under the race-record tab", () => {
    expect(tabForChrome({ ...INITIAL_VIEW_STATE, tab: "log", entryType: "race" })).toBe("log")
  })
})

// 탭바 재탭 판정 — 서로 반대 방향으로 당기는 두 요구를 동시에 고정한다.
//
// 배경: WORK_ORDER_UX2 §3-3이 홈 CTA를 훈련 후 폼 직행으로 바꾸면서, 기록 탭이
// entryType="post-session" 상태로 열릴 수 있게 됐다. 이때 `tab`만 비교하는
// 조기 반환이 탭바를 무반응으로 만들었다(PR #183 CI 실패의 실제 원인).
//
// 하지만 그 조기 반환은 실수가 아니라 의도된 보호였다(4c6bf90 "does not reset
// the archive when the active journal tab is tapped again"). 그래서 지우지 않고
// 조건을 좁혔다. 아래 T-3이 그 보호가 살아 있음을 지킨다.
describe("tab bar re-tap decision", () => {
  const logChooser = { ...INITIAL_VIEW_STATE, tab: "log" as const, entryType: "choose" as const }
  const logPostSession = {
    ...INITIAL_VIEW_STATE,
    tab: "log" as const,
    entryType: "post-session" as const,
  }
  const journalWithWeek = {
    ...INITIAL_VIEW_STATE,
    tab: "journal" as const,
    archiveSelection: { selectedMonth: "2026-07", selectedWeekStart: "2026-07-06" },
  }

  // T-1: §3-3이 만든 새 경로에서 탭바가 살아 있어야 한다.
  //      훈련 후 폼에 있는 동안 "기록"을 누르면 종류 선택 화면으로 나가야 한다.
  //      §3-3 자신이 "More 등 다른 진입은 choose 유지"라고 규정했다.
  it("T-1 훈련 후 폼에서 기록 탭을 다시 누르면 종류 선택으로 돌아간다", () => {
    expect(shouldResetTabView(logPostSession, "log", false)).toBe(true)
  })

  // T-2: 이미 그 탭의 첫 화면이면 아무 일도 하지 않는다. 같은 화면을 다시
  //      그리면서 스크롤 위치만 잃는 것은 손해다.
  it("T-2 이미 종류 선택 화면이면 기록 탭 재탭은 아무 일도 하지 않는다", () => {
    expect(shouldResetTabView(logChooser, "log", false)).toBe(false)
  })

  // T-3: 앞의 수정이 원래 보호를 깨지 않았음을 지킨다. 이 테스트가 없으면
  //      T-1을 만족시키려고 조기 반환을 통째로 지우는 회귀가 통과해 버린다.
  //      고른 주가 사라지는 것은 사용자가 한 일을 앱이 지우는 것이다.
  it("T-3 일지 탭을 다시 눌러도 골라 둔 주 선택을 초기화하지 않는다", () => {
    expect(shouldResetTabView(journalWithWeek, "journal", false)).toBe(false)
  })

  // T-4: 다른 탭으로 가는 것은 당연히 이동이다.
  it.each(["home", "journal", "plan", "trends"] as const)(
    "T-4 다른 탭 %s 으로는 항상 이동한다",
    (tab) => {
      expect(shouldResetTabView(logPostSession, tab, false)).toBe(true)
    },
  )

  // T-5: More·선수기록 같은 겹쳐진 화면이 열려 있으면, 같은 탭이라도 그것을
  //      닫고 나가야 한다. 겹친 화면 뒤에 갇히는 것을 막는다.
  it("T-5 겹쳐진 화면이 열려 있으면 같은 탭이어도 빠져나온다", () => {
    expect(shouldResetTabView(logChooser, "log", true)).toBe(true)
    expect(shouldResetTabView(journalWithWeek, "journal", true)).toBe(true)
  })
})
