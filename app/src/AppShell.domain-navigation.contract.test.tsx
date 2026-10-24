import React from "react"
import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { OracleSectionNavigation } from "./components/OracleSectionNavigation"
import { useDomainNavigation } from "./components/DomainNavigation"
import { registerUnsavedDraftGuard } from "./domain/unsaved-draft-navigation"
import { setActiveLocalAccount } from "./domain/account/local-journal-ownership"
import { saveEntry, type JournalEntry } from "./domain/journal-store"
import { initializeCanonicalJournalFixture } from "./test/canonical-journal-fixture"

const savedRest: JournalEntry = { id: "saved-domain-rest", kind: "post-session", date: "2026-10-20", savedAt: "2026-10-20T00:00:00.000Z",
  syncState: "local", captureDepth: "QUICK", system: "", title: "휴식", activityOutcome: "RESTED", objectiveDataState: "NONE", distanceKm: "", durationMin: "", avgPace: "", rpe: 0, memo: "" }

vi.mock("./screens/Home", () => ({ Home: (props: React.ComponentProps<typeof import("./screens/Home").Home>) => <>
  <h1>홈 화면</h1><button onClick={props.onOpenMore}>더보기</button><button onClick={props.onOpenMinigame}>게임 라운지 열기</button>
  <button onClick={props.onOpenArchive}>달력 바로가기</button>
</> }))
vi.mock("./screens/LogEntry", () => ({ LogEntry: (props: React.ComponentProps<typeof import("./screens/LogEntry").LogEntry>) => <>
  <h1>{props.entryType === "choose" ? "기록 종류" : "기록 입력"}</h1>
  <button onClick={() => props.onDone?.("quick-session")}>운동 선택</button><button onClick={props.onBack}>기록 이전</button><button onClick={props.onExit}>기록 취소</button>
  <button onClick={() => { expect(saveEntry(savedRest).ok).toBe(true); props.onDone?.("quick-session", savedRest) }}>휴식 저장</button>
  <button onClick={() => { expect(saveEntry(savedRest).ok).toBe(true); props.onSaved?.(savedRest) }}>휴식 저장 화면</button>
</> }))
vi.mock("./DeferredMobileScreens", () => ({ DeferredMobileScreens: {
  Trends: (props: React.ComponentProps<typeof import("./screens/Trends").Trends>) => <>
    <OracleSectionNavigation current="training" onSelect={section => section === "profile" ? props.onOpenRunningProfile?.() : props.onOpenOracleLibrary?.()} />
    <h1>분석 화면</h1><button onClick={() => props.onOpenCoachingDay?.("2026-10-20", "saved-entry")}>분석 원문 열기</button>
  </>,
  OracleProfileV2: (props: React.ComponentProps<typeof import("./screens/OracleProfileV2").OracleProfileV2>) => <>
    <OracleSectionNavigation current={props.initialView === "library" ? "library" : "profile"} onSelect={() => undefined} />
    <h1>{props.initialView === "library" ? "읽을거리 화면" : "취향 화면"}</h1>
    <button onClick={() => props.onNavigate("JOURNAL")}>일지로 연결</button>
  </>,
  JournalArchive: (props: React.ComponentProps<typeof import("./screens/JournalArchive").JournalArchive>) => <MockJournal {...props} />,
  JournalDayReader: (props: { onBack: () => void }) => <><h1>일지 원문</h1><button onClick={props.onBack}>원문 뒤로</button></>,
  LogDetail: (props: { onBack: () => void }) => <><h1>일지 원문</h1><button onClick={props.onBack}>원문 뒤로</button></>,
  PlanBeta: () => <h1>훈련 화면</h1>,
  More: (props: React.ComponentProps<typeof import("./screens/More").More>) => <>
    <h1>더보기 화면</h1><button onClick={props.onOpenOracleLibrary}>읽을거리 바로가기</button><button onClick={props.onOpenMinigame}>게임 바로가기</button>
  </>,
  TreadmillGame: () => <MockGames />,
} }))

function MockJournal(props: React.ComponentProps<typeof import("./screens/JournalArchive").JournalArchive>) {
  const section = props.section ?? "JOURNAL"
  const navigation = useDomainNavigation({ domain: "journal", current: section, onSelect: next => {
    if (next === "JOURNAL" || next === "BODY") props.onSectionChange?.(next)
  } })
  return <><h1>{section === "BODY" ? "몸 기록 화면" : "일지 화면"}</h1>
    <button onClick={navigation.onRecord} aria-label="기록하기">+ 기록</button>
    <output aria-label="일지 방식">{props.mode}</output>
    <button onClick={() => props.onModeChange?.("CYCLE")}>묶음으로</button>
    <button onClick={() => props.onOpenDay("2026-10-20", "saved-entry")}>원문 열기</button>
  </>
}
function MockGames() {
  const [tab, setTab] = React.useState<"games" | "records">("games")
  const [playing, setPlaying] = React.useState(false)
  useDomainNavigation({ domain: "games", current: tab, hidden: playing, onSelect: next => {
    if (next === "games" || next === "records") setTab(next)
  } })
  return <><h1>{playing ? "경기장" : tab === "games" ? "게임 목록" : "게임 기록"}</h1>
    <button onClick={() => setPlaying(value => !value)}>{playing ? "게임 소개로" : "게임 시작"}</button>
  </>
}

import { AppShell } from "./AppShell"
const globalDock = () => screen.getByRole("navigation", { name: "주 탭" })
const domainDock = (name: string) => screen.getByRole("navigation", { name: `${name} 메뉴` })
const region = () => document.querySelector<HTMLElement>(".app-scroll-region")!
async function exit(name: string) {
  await userEvent.click(within(domainDock(name)).getByRole("button", { name: `${name} 나가기` }))
}

beforeEach(async () => {
  localStorage.clear(); sessionStorage.clear(); setActiveLocalAccount(null)
  await initializeCanonicalJournalFixture()
  window.history.replaceState(null, "", "/?app=1")
  vi.stubEnv("VITE_FEATURE_ORACLE_V2", "true")
  vi.stubGlobal("fetch", vi.fn(() => Promise.reject(Error("No network in navigation contracts"))))
})
afterEach(() => { cleanup(); setActiveLocalAccount(null); vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks() })

describe("single shell navigation slot", () => {
  it.each(["훈련", "오라클"].flatMap(origin => ["휴식 저장", "휴식 저장 화면"].map(save => ({ origin, save }))))("returns a saved Journal reader to the actual $origin recording origin through $save", async ({ origin, save }) => {
    render(<AppShell />)
    await userEvent.click(within(globalDock()).getByRole("button", { name: origin }))
    await act(() => new Promise<void>(resolve => window.requestAnimationFrame(() => resolve())))
    region().scrollTop = 135
    if (origin === "오라클") await userEvent.click(screen.getByRole("button", { name: "기록하기" }))
    else await userEvent.click(within(globalDock()).getByRole("button", { name: "기록하기" }))
    await userEvent.click(screen.getByRole("button", { name: "운동 선택" }))
    await userEvent.click(screen.getByRole("button", { name: save }))
    await userEvent.click(screen.getByRole("button", { name: "기록 보기" }))
    expect(screen.getByRole("heading", { name: "일지 원문" })).toBeVisible()
    await act(() => new Promise<void>(resolve => window.requestAnimationFrame(() => resolve())))
    expect(region().scrollTop).not.toBe(135)
    await exit("일지")
    await waitFor(() => expect(screen.getByRole("heading", { name: origin === "훈련" ? "훈련 화면" : "분석 화면" })).toBeVisible())
    await waitFor(() => expect(region().scrollTop).toBe(135))
  })

  it("replaces the global dock with Journal, keeps mode, and restores origin scroll and focus", async () => {
    render(<AppShell />)
    expect(within(globalDock()).getAllByRole("button").map(button => button.textContent)).toEqual(["홈", "일지", "기록", "훈련", "오라클"])
    region().scrollTop = 145
    await userEvent.click(within(globalDock()).getByRole("button", { name: "일지" }))
    expect(screen.queryByRole("navigation", { name: "주 탭" })).toBeNull()
    expect(document.querySelectorAll(".app-tab-bar")).toHaveLength(1)
    await userEvent.click(within(domainDock("일지")).getByRole("button", { name: "몸 기록" }))
    expect(screen.getByRole("heading", { name: "몸 기록 화면" })).toBeVisible()
    await userEvent.click(within(domainDock("일지")).getByRole("button", { name: "일지" }))
    await userEvent.click(screen.getByRole("button", { name: "묶음으로" }))
    region().scrollTop = 92
    await exit("일지")
    await waitFor(() => expect(globalDock()).toBeVisible())
    await waitFor(() => expect(region().scrollTop).toBe(145))
    expect(within(globalDock()).getByRole("button", { name: "일지" })).toHaveFocus()
    await userEvent.click(within(globalDock()).getByRole("button", { name: "일지" }))
    expect(screen.getByLabelText("일지 방식")).toHaveTextContent("CYCLE")
    await waitFor(() => expect(region().scrollTop).toBe(92))
  })

  it("replaces Oracle siblings without growing history and hides every dock through recording", async () => {
    render(<AppShell />)
    await userEvent.click(within(globalDock()).getByRole("button", { name: "오라클" }))
    const length = window.history.length
    for (const name of ["취향", "읽을거리", "분석", "취향", "읽을거리", "분석"]) {
      await userEvent.click(within(domainDock("오라클")).getByRole("button", { name }))
      expect(within(domainDock("오라클")).getByRole("button", { name })).toHaveAttribute("aria-current", "page")
    }
    expect(window.history.length).toBe(length)
    const replace = vi.spyOn(window.history, "replaceState")
    await userEvent.click(within(domainDock("오라클")).getByRole("button", { name: "분석" }))
    expect(replace).not.toHaveBeenCalled()
    region().scrollTop = 120
    await userEvent.click(screen.getByRole("button", { name: "기록하기" }))
    expect(screen.getByRole("heading", { name: "기록 종류" })).toBeVisible()
    expect(screen.queryByRole("navigation")).toBeNull()
    await userEvent.click(screen.getByRole("button", { name: "운동 선택" }))
    expect(screen.getByRole("heading", { name: "기록 입력" })).toBeVisible()
    expect(screen.queryByRole("navigation")).toBeNull()
    await userEvent.click(screen.getByRole("button", { name: "기록 취소" }))
    await waitFor(() => expect(domainDock("오라클")).toBeVisible())
    await waitFor(() => expect(region().scrollTop).toBe(120))
    expect(screen.getByRole("button", { name: "기록하기" })).toHaveFocus()
  })

  it("restores nested explicit link origins and the original Training destination", async () => {
    render(<AppShell />)
    await userEvent.click(within(globalDock()).getByRole("button", { name: "훈련" }))
    region().scrollTop = 75
    await userEvent.click(within(globalDock()).getByRole("button", { name: "오라클" }))
    await userEvent.click(within(domainDock("오라클")).getByRole("button", { name: "취향" }))
    await act(() => new Promise<void>(resolve => window.requestAnimationFrame(() => resolve())))
    region().scrollTop = 160
    await userEvent.click(screen.getByRole("button", { name: "일지로 연결" }))
    expect(domainDock("일지")).toBeVisible()
    await exit("일지")
    await waitFor(() => expect(screen.getByRole("heading", { name: "취향 화면" })).toBeVisible())
    await waitFor(() => expect(region().scrollTop).toBe(160))
    await exit("오라클")
    await waitFor(() => expect(screen.getByRole("heading", { name: "훈련 화면" })).toBeVisible())
    await waitFor(() => expect(region().scrollTop).toBe(75))
  })

  it("opens an explicit calendar target and consumes original-reader history before switching Journal sections", async () => {
    render(<AppShell />)
    await userEvent.click(within(globalDock()).getByRole("button", { name: "일지" }))
    await userEvent.click(screen.getByRole("button", { name: "묶음으로" }))
    await exit("일지")
    await waitFor(() => expect(globalDock()).toBeVisible())
    await userEvent.click(screen.getByRole("button", { name: "달력 바로가기" }))
    expect(screen.getByLabelText("일지 방식")).toHaveTextContent("CALENDAR")
    await userEvent.click(screen.getByRole("button", { name: "원문 열기" }))
    expect(screen.getByRole("heading", { name: "일지 원문" })).toBeVisible()
    await userEvent.click(within(domainDock("일지")).getByRole("button", { name: "몸 기록" }))
    await waitFor(() => expect(screen.getByRole("heading", { name: "몸 기록 화면" })).toBeVisible())
    expect(window.history.state?.calendarOriginalPage).toBeUndefined()
    await exit("일지")
    await waitFor(() => expect(globalDock()).toBeVisible())
  })

  it("restores a pending native Back after the existing draft decision is confirmed", async () => {
    render(<AppShell />)
    await userEvent.click(within(globalDock()).getByRole("button", { name: "오라클" }))
    let unsafe = true
    let resume: (() => void) | undefined
    const stop = registerUnsavedDraftGuard({ isUnsafe: () => unsafe, onBlocked: () => undefined, requestNavigation: next => { resume = next } })
    try {
      const token = window.history.state.trainoracleDomain
      act(() => window.history.back())
      await waitFor(() => expect(resume).toBeTypeOf("function"))
      await waitFor(() => expect(window.history.state.trainoracleDomain).toBe(token))
      act(() => { unsafe = false; resume?.() })
      await waitFor(() => expect(globalDock()).toBeVisible())
      expect(screen.getByRole("heading", { name: "홈 화면" })).toBeVisible()
    } finally { stop() }
  })

  it("uses the game domain slot, hides it in play, and restores More on exit", async () => {
    render(<AppShell />)
    await userEvent.click(screen.getByRole("button", { name: "더보기" }))
    region().scrollTop = 61
    await userEvent.click(screen.getByRole("button", { name: "게임 바로가기" }))
    await userEvent.click(within(domainDock("게임 라운지")).getByRole("button", { name: "내 기록" }))
    expect(screen.getByRole("heading", { name: "게임 기록" })).toBeVisible()
    await userEvent.click(within(domainDock("게임 라운지")).getByRole("button", { name: "게임" }))
    await userEvent.click(screen.getByRole("button", { name: "게임 시작" }))
    expect(screen.queryByRole("navigation")).toBeNull()
    await userEvent.click(screen.getByRole("button", { name: "게임 소개로" }))
    expect(domainDock("게임 라운지")).toBeVisible()
    await exit("게임 라운지")
    await waitFor(() => expect(screen.getByRole("heading", { name: "더보기 화면" })).toBeVisible())
    await waitFor(() => expect(region().scrollTop).toBe(61))
  })
  it("reopens the last Journal area with native Forward after exiting it", async () => {
    render(<AppShell />)
    await userEvent.click(within(globalDock()).getByRole("button", { name: "일지" }))
    await userEvent.click(within(domainDock("일지")).getByRole("button", { name: "몸 기록" }))
    await exit("일지")
    await waitFor(() => expect(globalDock()).toBeVisible())
    act(() => window.history.forward())
    await waitFor(() => expect(domainDock("일지")).toBeVisible())
    expect(screen.getByRole("heading", { name: "몸 기록 화면" })).toBeVisible()
  })
  it("returns a forwarded nested area to the parent's current sibling and position", async () => {
    render(<AppShell />)
    await userEvent.click(within(globalDock()).getByRole("button", { name: "오라클" }))
    await userEvent.click(within(domainDock("오라클")).getByRole("button", { name: "취향" }))
    await userEvent.click(screen.getByRole("button", { name: "일지로 연결" }))
    await exit("일지")
    await waitFor(() => expect(screen.getByRole("heading", { name: "취향 화면" })).toBeVisible())
    await userEvent.click(within(domainDock("오라클")).getByRole("button", { name: "분석" }))
    await act(() => new Promise<void>(resolve => window.requestAnimationFrame(() => resolve())))
    region().scrollTop = 99
    act(() => window.history.forward())
    await waitFor(() => expect(domainDock("일지")).toBeVisible())
    await exit("일지")
    await waitFor(() => expect(screen.getByRole("heading", { name: "분석 화면" })).toBeVisible())
    await waitFor(() => expect(region().scrollTop).toBe(99))
    expect(screen.queryByRole("heading", { name: "취향 화면" })).toBeNull()
  })
})
