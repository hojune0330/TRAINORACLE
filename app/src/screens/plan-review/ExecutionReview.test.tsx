import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { ExecutionReviewContent, ExecutionReviewReader } from "./ExecutionReview"
import type { ExecutionReview } from "../../domain/plan-execution-review"

const review: ExecutionReview = {
  policyVersion: "descriptive-review-v2", id: "test", date: "2026-09-29", slot: "오전", status: "CHANGED", title: "일부만 한 훈련",
  summary: "일부만 했다고 기록했어요.", next: "남은 일정부터 확인해 주세요.",
  metrics: [{ label: "힘든 정도 · RPE", actual: "7", planned: "3~4" }, { label: "거리", actual: "3km" },
    { label: "시간", actual: "20분" }, { label: "평균 페이스", actual: "6분 40초/km" }],
  facts: ["FACT-DETAIL"], unknowns: ["UNKNOWN-DETAIL"], explanation: "구간별 수행이 아직 확인되지 않았어요.",
  actualExercises: [{ kind: "반복 달리기", rows: ["400m · 6회", "200m · 4회", "100m · 2회"] },
    { kind: "근력 운동", rows: ["30kg · 5회"] }, { kind: "점프 운동", rows: ["10접지"] }],
}

afterEach(() => { cleanup(); vi.restoreAllMocks() })

describe("compact execution review", () => {
  it("starts with summary and lets users act without reading the other pages", async () => {
    const onClose = vi.fn(), onOpenPlan = vi.fn()
    render(<ExecutionReviewReader review={review} originalMethod={<h3>당시 계획한 훈련</h3>} onOpenPlan={onOpenPlan} onOpenJournal={vi.fn()} onClose={onClose} />)
    expect(screen.getByRole("tab", { name: "요약" })).toHaveAttribute("aria-selected", "true")
    expect(screen.queryByRole("heading", { name: "당시 계획한 훈련" })).toBeNull()
    expect(screen.queryByText("FACT-DETAIL")).toBeNull()
    expect(screen.queryByText("6분 40초/km")).toBeNull()
    expect(screen.getByText("계획은 변경되지 않았어요.")).toBeVisible()
    fireEvent.click(screen.getByRole("button", { name: "현재 일정" }))
    await waitFor(() => expect(onOpenPlan).toHaveBeenCalledTimes(1))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it("offers direct tabs and keyboard navigation, with all records still reachable", () => {
    render(<ExecutionReviewReader review={review} originalMethod={<h3>당시 계획한 훈련</h3>} onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole("tab", { name: "계획·기록" }))
    expect(screen.getByRole("heading", { name: "당시 계획한 훈련" })).toBeVisible()
    expect(screen.getByText("6분 40초/km")).toBeVisible()
    expect(screen.getByText("100m · 2회")).not.toBeVisible()
    fireEvent.click(screen.getByText("나머지 구간 1개"))
    expect(screen.getByText("100m · 2회")).toBeVisible()
    fireEvent.click(screen.getByText("다른 운동 1개"))
    expect(screen.getByText("10접지")).toBeVisible()
    const evidenceTab = screen.getByRole("tab", { name: "계획·기록" })
    fireEvent.keyDown(evidenceTab, { key: "ArrowRight" })
    expect(screen.getByRole("tab", { name: "이유" })).toHaveFocus()
    expect(screen.getByText(review.explanation)).toBeVisible()
    fireEvent.keyDown(screen.getByRole("tab", { name: "이유" }), { key: "Home" })
    expect(screen.getByRole("tab", { name: "요약" })).toHaveFocus()
  })

  it("keeps attention visible on every page and does not turn navigation into a write", () => {
    const before = { ...localStorage }
    render(<ExecutionReviewReader review={{ ...review, status: "SAFETY_REVIEW", title: "몸 상태 확인이 먼저예요" }} onOpenJournal={vi.fn()} onOpenPlan={vi.fn()} onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole("button", { name: "다음 내용" }))
    fireEvent.click(screen.getByRole("button", { name: "다음 내용" }))
    expect(screen.getByRole("heading", { name: "몸 상태 확인이 먼저예요" })).toBeVisible()
    expect(screen.getByRole("button", { name: "일지 확인" })).toHaveAttribute("data-primary", "true")
    expect(screen.getByRole("button", { name: "다음 내용" })).toBeDisabled()
    expect({ ...localStorage }).toEqual(before)
  })

  it("opens both sides together and only collapses long reasons in the journal", () => {
    render(<ExecutionReviewContent review={review} originalMethod={<h3>당시 계획한 훈련</h3>} />)
    expect(screen.getByText(review.summary)).toBeVisible()
    expect(screen.getByRole("heading", { name: "당시 계획한 훈련" })).toBeVisible()
    expect(screen.getByText("6분 40초/km")).toBeVisible()
    expect(screen.getByText(review.explanation)).not.toBeVisible()
    fireEvent.click(screen.getByText("이렇게 안내하는 이유", { selector: "summary" }))
    expect(screen.getByText(review.explanation)).toBeVisible()
    const details = screen.getByText("사용한 기록").closest("details")!
    fireEvent.click(within(details).getByText("사용한 기록"))
    expect(screen.getByText("FACT-DETAIL")).toBeVisible()
  })
  it("keeps all tab targets and reading disclosures while exposing waiting on summary", () => {
    render(<ExecutionReviewReader review={{ ...review, awaitingDeviceData: true }} onClose={vi.fn()} />)
    expect(screen.getByRole("status")).toHaveTextContent("워치 기록을 기다리고 있어요")
    for (const tab of screen.getAllByRole("tab")) expect(document.getElementById(tab.getAttribute("aria-controls")!)).not.toBeNull()
    fireEvent.click(screen.getByRole("tab", { name: "이유" }))
    fireEvent.click(screen.getByText("사용한 기록"))
    fireEvent.click(screen.getByRole("tab", { name: "요약" }))
    expect(screen.getByText("FACT-DETAIL")).not.toBeVisible()
    fireEvent.click(screen.getByRole("tab", { name: "이유" }))
    expect(screen.getByText("FACT-DETAIL")).toBeVisible()
    expect(screen.getAllByRole("tabpanel")).toHaveLength(1)
  })
})
