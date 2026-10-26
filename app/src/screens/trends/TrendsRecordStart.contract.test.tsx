import { initializeCanonicalJournalFixture } from "../../test/canonical-journal-fixture"
import { cleanup, render, screen, fireEvent } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { Trends } from "../Trends"
import { stateFixture } from "../../domain/plan-beta-store.test-fixture"
import { createPlannedSessionLogDraft } from "../../domain/planned-session-link"
import { JOURNAL_STORAGE_KEY } from "../../domain/journal-storage-keys"

const planStore = vi.hoisted(() => ({ state: null as unknown }))
vi.mock("../../domain/plan-beta-store", async importOriginal => ({
  ...await importOriginal<typeof import("../../domain/plan-beta-store")>(),
  loadPlanBetaState: () => planStore.state,
  readPlanBetaStateFromStorage: () => planStore.state ? { kind: "loaded", state: planStore.state } : { kind: "missing" },
}))
vi.mock("./PersonalOraclePanel", () => ({ PersonalOraclePanel: () => null }))
vi.mock("../home/HomeCoachingSummary", () => ({ HomeCoachingSummary: () => <div data-testid="home-coaching-summary" /> }))
beforeEach(async () => { localStorage.clear(); sessionStorage.clear(); await initializeCanonicalJournalFixture(); planStore.state = null })
afterEach(cleanup)

it("keeps linked execution review reachable without putting it in the initial report or examples", () => {
  const state = stateFixture()
  const draft = createPlannedSessionLogDraft(state, state.activePlan.sessions[0]!, "2026-07-24T01:00:00Z")!
  localStorage.setItem(JOURNAL_STORAGE_KEY, JSON.stringify([{
    id: "linked-review", kind: "post-session", date: draft.date, savedAt: "2026-07-24T02:00:00Z", syncState: "local",
    plannedSessionLink: draft.link, activityOutcome: "PARTIAL", activitySlot: "AM", planExecutionRelation: "MODIFIED",
    title: "", memo: "", system: "", distanceKm: "", durationMin: "", avgPace: "", rpe: 0,
  }]))
  const { rerender } = render(<Trends onOpenPlan={vi.fn()} />)
  const entry = screen.getByRole("button", { name: "계획과 수행 살펴보기" })
  expect(entry).toBeVisible()
  expect(screen.getByTestId("home-coaching-summary")).not.toBeVisible()
  fireEvent.click(entry)
  expect(screen.getByTestId("home-coaching-summary")).toBeVisible()
  fireEvent.click(screen.getByRole("button", { name: "예시" }))
  expect(screen.queryByTestId("home-coaching-summary")).toBeNull()
  fireEvent.click(screen.getByRole("button", { name: "내 기록" }))
  rerender(<Trends journalReadComplete={false} onOpenPlan={vi.fn()} />)
  expect(screen.queryByRole("button", { name: "계획과 수행 살펴보기" })).toBeNull()
})

it("keeps import and PB actions direct on a confirmed empty analysis", () => {
  const onImport = vi.fn(), onRecords = vi.fn()
  render(<Trends onOpenImport={onImport} onOpenRecords={onRecords} />)
  expect(screen.getByRole("button", { name: /운동 파일 가져오기/ })).toBeVisible()
  expect(screen.getByRole("region", { name: "이미 있는 기록으로 시작하기" })).toBeVisible()
  expect(screen.queryByText("운동 파일·최고기록 추가")).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole("button", { name: /운동 파일 가져오기/ }))
  fireEvent.click(screen.getByRole("button", { name: /최고기록 남기기/ }))
  expect(onImport).toHaveBeenCalledOnce()
  expect(onRecords).toHaveBeenCalledOnce()
})

it("does not treat a plan alone as an analysis and offers direct workout, example, and plan paths", () => {
  planStore.state = stateFixture()
  const onWriteLog = vi.fn(), onOpenPlan = vi.fn(), onOpenOracle = vi.fn()
  const { container, unmount: unmountPlanOnly } = render(<Trends onWriteLog={onWriteLog} onOpenPlan={onOpenPlan} onOpenOracle={onOpenOracle} />)

  expect(screen.queryByTestId("home-coaching-summary")).not.toBeInTheDocument()
  expect(screen.queryByRole("heading", { name: "내 훈련 요약" })).not.toBeInTheDocument()
  expect(screen.getByRole("button", { name: "운동 기록 쓰기" })).toBeVisible()
  expect(screen.getByRole("button", { name: "예시 결과 보기" })).toBeVisible()
  expect(screen.getByRole("button", { name: "현재 훈련표 보기" })).toBeVisible()
  expect(container.querySelectorAll(".trends-hub__guide img")).toHaveLength(0)
  expect(screen.queryByRole("img")).toBeNull()

  fireEvent.click(screen.getByRole("button", { name: "운동 기록 쓰기" }))
  expect(onWriteLog).toHaveBeenCalledOnce()
  fireEvent.click(screen.getByRole("button", { name: "예시 결과 보기" }))
  expect(screen.getByRole("region", { name: "기간별 훈련 리포트" })).toHaveAttribute("data-source", "example")
  expect(onOpenOracle).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole("button", { name: "내 기록" }))
  fireEvent.click(screen.getByRole("button", { name: "현재 훈련표 보기" }))
  expect(onOpenPlan).toHaveBeenCalledOnce()

  unmountPlanOnly()
  localStorage.setItem("trainoracle.athlete-records.v1", JSON.stringify([{
    schemaVersion: 1, id: "plan-and-pb", purpose: "PERSONAL_BEST", eventDistanceM: 5000,
    performanceSeconds: 1500, achievedOn: "2026-08-02", seasonId: null, enteredBy: "ATHLETE",
    verificationState: "SELF_REPORTED", sourceRef: "athlete-record:plan-and-pb", savedAt: "2026-08-02T00:00:00.000Z",
  }]))
  const onOpenPlanWithPb = vi.fn()
  render(<Trends onWriteLog={onWriteLog} onOpenPlan={onOpenPlanWithPb} onOpenOracle={onOpenOracle} />)

  expect(screen.getByRole("region", { name: "최근 저장한 경기 기록" })).toBeVisible()
  expect(screen.queryByRole("region", { name: "내 기록으로 시작하기" })).not.toBeInTheDocument()
  expect(screen.getByRole("button", { name: "현재 훈련표 보기" })).toBeVisible()
  expect(screen.getByRole("button", { name: "운동 기록 쓰기" })).toBeVisible()
  fireEvent.click(screen.getByRole("button", { name: "현재 훈련표 보기" }))
  expect(onOpenPlanWithPb).toHaveBeenCalledOnce()
})
