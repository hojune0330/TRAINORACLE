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

it("shows a useful general article immediately when reviews are empty and returns without writing a record", async () => {
  vi.spyOn(store, "loadEntriesForPlanSafety").mockReturnValue({ status: "complete", entries: [] })
  const before = { ...localStorage }
  render(<HomeCoachingSummary revision={0} />)
  const heading = screen.getByRole("heading", { name: "훈련법 읽기" })
  expect(heading).toBeVisible()
  expect(screen.getByText("일반 훈련 정보")).toBeVisible()
  expect(screen.getByText(/같은 거리를 뛰어도 연속 달리기와 회복을 넣은 반복 달리기는 구성이 달라요/)).toBeVisible()
  expect(screen.queryByText(/계획에서 운동을 기록하면/)).toBeNull()
  expect(screen.getByRole("button", { name: /계획과 다르게 운동했다면/ })).toBeVisible()
  fireEvent.click(screen.getByRole("button", { name: /계획과 다르게 운동했다면/ }))
  expect(screen.getByRole("dialog")).toBeVisible()
  expect(screen.getByText(/개인의 훈련이나 몸 상태를 분석한 결과는 아니에요/)).toBeVisible()
  fireEvent.click(screen.getByRole("button", { name: "훈련 코칭으로 돌아가기" }))
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
  expect(heading).toHaveFocus()
  expect({ ...localStorage }).toEqual(before)
})

it("does not describe a failed read as no records", () => {
  vi.spyOn(store, "loadEntriesForPlanSafety").mockReturnValue({ status: "uncertain" })
  render(<HomeCoachingSummary revision={0} />)
  expect(screen.getByRole("status")).toHaveTextContent("비교를 잠시 보류")
  expect(screen.getByRole("heading", { name: "훈련 코칭" })).toBeVisible()
  expect(screen.queryByRole("heading", { name: "훈련법 읽기" })).toBeNull()
  expect(screen.queryByText(/계획에서 운동을 기록하면/)).toBeNull()
})

it("does not interrupt general reading on unrelated journal revisions", () => {
  vi.spyOn(store, "loadEntriesForPlanSafety").mockReturnValue({ status: "complete", entries: [] })
  const { rerender } = render(<HomeCoachingSummary revision={0} />)
  fireEvent.click(screen.getByText("다른 훈련법 읽기"))
  fireEvent.click(screen.getByRole("button", { name: /못 한 훈련을 내일/ }))
  expect(screen.getByRole("dialog")).toBeVisible()
  rerender(<HomeCoachingSummary revision={1} />)
  expect(screen.getByRole("dialog")).toBeVisible()
})

it("prioritizes recording and shows one prepared preview without a second entry wrapper", () => {
  const model: TrainingHomeViewModel = { homeMode: "WELCOME", todayMessage: "", todayRecordCount: 0, journalSummary: "", flowSummary: "", planSummary: "저장된 계획 없음", analysisSummary: "", showMinjiPrompt: true, nextTraining: null, briefing: "" }
  render(<TrainingHome model={model} onOpenOracle={vi.fn()} oraclePreview={<h2>오라클 미리보기</h2>} />)
  const write = screen.getByRole("button", { name: "오늘 기록 남기기" })
  const preview = screen.getByRole("heading", { name: "오라클 미리보기" })
  expect(write).toBeVisible()
  expect(preview.closest("details")).toBeNull()
  expect(preview).toBeVisible()
  expect(write.compareDocumentPosition(preview) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(screen.queryByRole("heading", { name: "훈련 코칭" })).toBeNull()
  expect(screen.queryByRole("heading", { name: "더 살펴보기" })).toBeNull()
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
  expect(screen.getByRole("heading", { name: "훈련법 읽기" })).toBeVisible()
  today.mockReturnValue(draft.date)
  fireEvent(window, new Event("focus"))
  expect(screen.getByRole("button", { name: /원래 계획을 확인해 주세요/ })).toBeVisible()
})
