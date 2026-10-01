import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import { HomeCoachingSummary } from "./HomeCoachingSummary"
import { TrainingHome } from "./TrainingHome"
import type { TrainingHomeViewModel } from "../../domain/home-view-model"
import * as store from "../../domain/journal-store"
import { stateFixture } from "../../domain/plan-beta-store.test-fixture"
import { createPlannedSessionLogDraft } from "../../domain/planned-session-link"
import type { PostSessionEntry } from "../../domain/journal-schema"

afterEach(() => { cleanup(); vi.restoreAllMocks(); localStorage.clear() })

it("keeps empty guidance honest and returns from general reading without writing a record", async () => {
  vi.spyOn(store, "loadEntriesForPlanSafety").mockReturnValue({ status: "complete", entries: [] })
  const before = { ...localStorage }
  render(<HomeCoachingSummary revision={0} />)
  expect(screen.getByRole("heading", { name: "훈련 코칭" })).toBeVisible()
  fireEvent.click(screen.getByText("훈련을 바꿨을 때 읽어보기"))
  fireEvent.click(screen.getByRole("button", { name: /계획과 다르게 운동했다면/ }))
  expect(screen.getByRole("dialog")).toBeVisible()
  expect(screen.getByText(/개인의 훈련이나 몸 상태를 분석한 결과는 아니에요/)).toBeVisible()
  fireEvent.click(screen.getByRole("button", { name: "훈련 코칭으로 돌아가기" }))
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
  expect({ ...localStorage }).toEqual(before)
})

it("does not describe a failed read as no records", () => {
  vi.spyOn(store, "loadEntriesForPlanSafety").mockReturnValue({ status: "uncertain" })
  render(<HomeCoachingSummary revision={0} />)
  expect(screen.getByRole("status")).toHaveTextContent("비교를 잠시 보류")
  expect(screen.queryByText(/계획에서 운동을 기록하면/)).toBeNull()
})

it("does not interrupt general reading on unrelated journal revisions", () => {
  vi.spyOn(store, "loadEntriesForPlanSafety").mockReturnValue({ status: "complete", entries: [] })
  const { rerender } = render(<HomeCoachingSummary revision={0} />)
  fireEvent.click(screen.getByText("훈련을 바꿨을 때 읽어보기"))
  fireEvent.click(screen.getByRole("button", { name: /못 한 훈련을 내일/ }))
  expect(screen.getByRole("dialog")).toBeVisible()
  rerender(<HomeCoachingSummary revision={1} />)
  expect(screen.getByRole("dialog")).toBeVisible()
})

it("keeps recording and coaching before the six analysis topics", () => {
  const model: TrainingHomeViewModel = { homeMode: "WELCOME", todayMessage: "", todayRecordCount: 0, journalSummary: "", flowSummary: "", planSummary: "저장된 계획 없음", analysisSummary: "", showMinjiPrompt: true, nextTraining: null, briefing: "" }
  render(<TrainingHome model={model} onOpenOracle={vi.fn()} coaching={<h2>훈련 코칭</h2>} />)
  const write = screen.getByRole("button", { name: "오늘 기록 남기기" })
  const coaching = screen.getByRole("heading", { name: "훈련 코칭" })
  const explore = screen.getByRole("heading", { name: "더 살펴보기" })
  expect(write.compareDocumentPosition(coaching) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(coaching.compareDocumentPosition(explore) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(screen.getAllByRole("button", { name: /결과 보기$/ })).toHaveLength(6)
  expect(screen.queryByText("내 훈련, 무엇부터 개선할까요?")).toBeNull()
})

it("refreshes the date filter after the tab resumes across midnight", () => {
  const plan = stateFixture()
  const draft = createPlannedSessionLogDraft(plan, plan.activePlan.sessions[0]!, plan.generatedAt)!
  const entry: PostSessionEntry = { id: "midnight-synthetic", kind: "post-session", date: draft.date, savedAt: plan.generatedAt,
    syncState: "local", system: "", title: "", memo: "", rpe: 0, distanceKm: "", durationMin: "", avgPace: "", plannedSessionLink: draft.link }
  const today = vi.spyOn(store, "todayISO").mockReturnValue("2000-01-01")
  vi.spyOn(store, "loadEntriesForPlanSafety").mockReturnValue({ status: "complete", entries: [entry] })
  render(<HomeCoachingSummary revision={0} />)
  expect(screen.getByText(/계획에서 운동을 기록하면/)).toBeVisible()
  today.mockReturnValue(draft.date)
  fireEvent(window, new Event("focus"))
  expect(screen.getByRole("button", { name: /원래 계획을 확인해 주세요/ })).toBeVisible()
})
