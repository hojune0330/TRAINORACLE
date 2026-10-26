import { initializeCanonicalJournalFixture } from "../test/canonical-journal-fixture"
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { initializeCanonicalJournalFixture } from "../test/canonical-journal-fixture"
import { PlanBeta } from "./PlanBeta"
import { loadAthleteRecords } from "../domain/athlete-records"
import { activePlanBetaStorageKey, loadPlanBetaState } from "../domain/plan-beta-store"
import { enterPlanWithoutRecord } from "./plan-beta/instant-plan.test-helper"

beforeEach(async () => { localStorage.clear(); sessionStorage.clear(); await initializeCanonicalJournalFixture() })
afterEach(() => { cleanup(); vi.restoreAllMocks() })

function expectBefore(first: HTMLElement, second: HTMLElement) {
  expect(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING)
    .toBe(Node.DOCUMENT_POSITION_FOLLOWING)
}

async function fillEntry() {
  const user = userEvent.setup()
  await user.click(screen.getByRole("button", { name: "1500m" }))
  await user.click(screen.getByRole("button", { name: "내 기록" }))
  await user.type(screen.getByLabelText("분", { exact: true }), "4")
  await user.type(screen.getByLabelText("초", { exact: true }), "23.4")
  await user.click(screen.getByText("기록 날짜 추가", { selector: "summary span" }))
  fireEvent.change(screen.getByLabelText("기록 달성일"), { target: { value: "2026-09-01" } })
  return user
}

beforeEach(async () => {
  await initializeCanonicalJournalFixture()
})

describe("plan entry supporting navigation", () => {
  it.each(["invalid", "storage_error"] as const)("keeps %s plan status ahead of the goal program entry", mode => {
    const key = activePlanBetaStorageKey()
    if (mode === "invalid") localStorage.setItem(key, "{synthetic-invalid-plan")
    else {
      const originalGet = Storage.prototype.getItem
      vi.spyOn(Storage.prototype, "getItem").mockImplementation(function (this: Storage, queried: string) {
        if (queried === key) throw Error("Synthetic plan read failure")
        return originalGet.call(this, queried)
      })
    }
    render(<PlanBeta />)
    const entry = screen.getByRole("button", { name: "10km 한 달 훈련표" })
    expect(screen.getAllByRole("button", { name: "10km 한 달 훈련표" })).toHaveLength(1)
    expectBefore(screen.getByRole("heading", { name: "저장된 계획을 확인하지 못했어요" }), entry)
  })

  it("returns from notation help to the exact unsent current and goal drafts", async () => {
    render(<PlanBeta />)
    const user = await fillEntry()
    await user.click(screen.getByRole("button", { name: "기준 다시 선택" }))
    await user.click(screen.getByRole("button", { name: "목표만 있어요" }))
    await user.type(screen.getByLabelText("분", { exact: true }), "4")
    await user.type(screen.getByLabelText("초", { exact: true }), "10.5")
    await user.click(screen.getByRole("button", { name: "훈련표 표기 읽기" }))
    expect(screen.queryByRole("form", { name: "계획 시작 정보" })).not.toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "계획 시작으로 돌아가기" }))
    expect(screen.getByRole("heading", { name: "1500m 목표 전체 시간" })).toHaveFocus()
    expect(screen.getByLabelText("분", { exact: true })).toHaveValue("4")
    expect(screen.getByLabelText("초", { exact: true })).toHaveValue("10.5")
    await user.click(screen.getByRole("button", { name: "기준 다시 선택" }))
    await user.click(screen.getByRole("button", { name: "내 기록" }))
    expect(screen.getByLabelText("분", { exact: true })).toHaveValue("4")
    expect(screen.getByLabelText("초", { exact: true })).toHaveValue("23.4")
    expect(screen.getByLabelText("기록 달성일")).toHaveValue("2026-09-01")
    expect(loadAthleteRecords()).toEqual([])
    expect(loadPlanBetaState()).toBeNull()
  })

  it("keeps the mounted entry when record management returns without discarding the plan", async () => {
    const onManageRecords = vi.fn()
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false)
    render(<PlanBeta onManageRecords={onManageRecords} />)
    const user = await fillEntry()
    await user.click(screen.getByRole("button", { name: "내 경기 기록" }))
    expect(onManageRecords).not.toHaveBeenCalled()
    await user.click(await screen.findByRole("button", { name: "계획으로" }))
    expect(confirm).not.toHaveBeenCalled()
    expect(screen.getByRole("heading", { name: "1500m를 달린 전체 시간" })).toHaveFocus()
    expect(screen.getByLabelText("초", { exact: true })).toHaveValue("23.4")
    expect(screen.getByLabelText("기록 달성일")).toHaveValue("2026-09-01")
    expect(loadAthleteRecords()).toEqual([])
  })

  it("still protects unsaved record-manager edits while preserving the separate plan entry", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false)
    render(<PlanBeta />)
    const user = await fillEntry()
    await user.click(screen.getByRole("button", { name: "내 경기 기록" }))
    await user.click(await screen.findByRole("button", { name: "시간 입력" }))
    await user.type(screen.getByLabelText("기록 분", { exact: true }), "19")
    await user.click(screen.getByRole("button", { name: "계획으로" }))
    expect(confirm).toHaveBeenCalledExactlyOnceWith("저장하지 않은 기록을 지우고 나갈까요?")
    expect(screen.getByLabelText("기록 분", { exact: true })).toHaveValue("19")
    confirm.mockReturnValue(true)
    await user.click(screen.getByRole("button", { name: "계획으로" }))
    const entry = within(screen.getByRole("form", { name: "계획 시작 정보" }))
    expect(entry.getByLabelText("분", { exact: true })).toHaveValue("4")
    expect(entry.getByLabelText("초", { exact: true })).toHaveValue("23.4")
    expect(loadAthleteRecords()).toEqual([])
  })

  it("moves keyboard focus to each new condition question", async () => {
    render(<PlanBeta />)
    expect(screen.getByRole("heading", { name: "어떤 종목을 준비하세요?" })).toHaveFocus()
    expect(screen.getAllByRole("button", { name: "10km 한 달 훈련표" })).toHaveLength(1)
    expectBefore(screen.getByRole("heading", { name: "어떤 종목을 준비하세요?" }),
      screen.getByRole("button", { name: "10km 한 달 훈련표" }))
    expectBefore(screen.getByRole("heading", { name: "어떤 종목을 준비하세요?" }),
      screen.getByRole("button", { name: "개인 계획 파일 불러오기" }))
    expectBefore(screen.getByRole("button", { name: "10km 한 달 훈련표" }),
      screen.getByRole("button", { name: "개인 계획 파일 불러오기" }))
    const user = await fillEntry()
    screen.getByRole("button", { name: "기록 저장하고 계속" }).focus()
    await user.keyboard("{Enter}")
    const question = () => screen.getByRole("heading", { level: 1 })
    await waitFor(() => expect(question()).toHaveFocus())
    screen.getByRole("button", { name: /빠른 훈련과 쉬운 훈련을 나눠 꾸준히 해왔어요/u }).focus()
    await user.keyboard("{Enter}")
    await waitFor(() => expect(screen.getByRole("heading", { name: "이번 9일 중 며칠 훈련할까요?" })).toHaveFocus())
    screen.getByRole("button", { name: /^매일/u }).focus()
    await user.keyboard("{Enter}")
    await waitFor(() => expect(question()).toHaveFocus())
    expect(screen.getByRole("button", { name: /통증은 없고 몸 상태는 평소와 같아요/u })).toBeVisible()
    expect(loadPlanBetaState()).toBeNull()
  })

  it("focuses the generated result, its refinement return and the saved plan", async () => {
    const user = userEvent.setup()
    render(<PlanBeta />)
    await enterPlanWithoutRecord()
    await user.click(screen.getByRole("button", { name: /빠른 훈련과 쉬운 훈련을 나눠 꾸준히 해왔어요/u }))
    await user.click(screen.getByRole("button", { name: /^매일/u }))
    await user.click(screen.getByRole("button", { name: /통증은 없고 몸 상태는 평소와 같아요/u }))
    expect(screen.getByRole("heading", { name: "계획이 준비됐어요" })).toHaveFocus()
    await user.click(screen.getByRole("button", { name: "일정·운동 시간" }))
    const refine = within(screen.getByRole("region", { name: "일정 조건" }))
    await user.click(refine.getByRole("button", { name: /^달력 길이 바꾸기/u }))
    await user.click(screen.getByRole("button", { name: /7일만 먼저 받기/u }))
    expect(screen.getByRole("heading", { name: "계획이 준비됐어요" })).toHaveFocus()
    await user.click(screen.getByRole("button", { name: "이 일정으로 시작" }))
    // The real saved-plan view is lazy-loaded; await its arrival before checking focus.
    const savedHeading = await screen.findByRole("heading", { name: "7일 훈련 계획" }, { timeout: 10_000 })
    await waitFor(() => expect(savedHeading).toHaveFocus())
    expect(loadPlanBetaState()).not.toBeNull()
    expect(screen.getAllByRole("button", { name: "10km 한 달 훈련표" })).toHaveLength(1)
    expectBefore(screen.getByRole("heading", { name: "7일 훈련 계획" }),
      screen.getByRole("button", { name: "10km 한 달 훈련표" }))
  }, 20_000)
})
