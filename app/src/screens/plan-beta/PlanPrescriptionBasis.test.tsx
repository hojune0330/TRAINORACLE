import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import type { PlanSession } from "@impl/plan-generator/types"
import { PlanPrescriptionBasis } from "./PlanPrescriptionBasis"

afterEach(cleanup)

describe("plan prescription basis disclosure", () => {
  it("keeps the short title, source summary, and pending status visible while details are closed", () => {
    render(<PlanPrescriptionBasis sessions={[]} confirmationPending />)

    const summary = screen.getByRole("button", { name: /페이스 안내.*시간·힘든 정도로 훈련/u })
    const details = summary.closest("details")
    expect(summary).toBeVisible()
    expect(details).not.toHaveAttribute("open")
    expect(summary.querySelector(".lucide-circle-help")).toBeNull()
    expect(screen.getByRole("status")).toBeVisible()
    expect(screen.getByText("시간과 힘든 정도에 맞춰 훈련하세요. 날짜별 안내에서 반복 횟수와 회복 구성을 확인해 주세요."))
      .not.toBeVisible()

    fireEvent.click(summary)
    expect(screen.getByText("시간과 힘든 정도에 맞춰 훈련하세요. 날짜별 안내에서 반복 횟수와 회복 구성을 확인해 주세요."))
      .toBeVisible()
    expect(screen.getByRole("status")).toBeVisible()
  })

  it("keeps inline rendering readable without wrapping content in a disclosure", () => {
    const { container } = render(<PlanPrescriptionBasis sessions={[]} confirmationPending inline />)

    expect(screen.getByText("시간·힘든 정도로 훈련")).toBeVisible()
    expect(screen.getByText(/시간과 힘든 정도에 맞춰/u)).toBeVisible()
    expect(screen.getByRole("status")).toBeVisible()
    expect(container.querySelector("details")).toBeNull()
  })

  it("keeps a goal-record caution outside the collapsed details", () => {
    const sessions = [{ role: "QUALITY", prescription: { kind: "PACE_TARGET", selectedAnchor: { kind: "GOAL" } } }] as unknown as PlanSession[]
    render(<PlanPrescriptionBasis sessions={sessions} />)

    const notice = screen.getByRole("note")
    expect(notice).toBeVisible()
    expect(notice).toHaveTextContent("현재 실력이나 실제 달성 기록을 뜻하지 않아요")
    expect(notice.closest("details")).toBeNull()
    expect(screen.getByRole("button", { name: /페이스 안내.*목표기록으로 페이스 계산/u })).toBeVisible()
  })

  it("keeps an unconfirmed-calculation notice outside the collapsed details", () => {
    const sessions = [{ role: "QUALITY", prescription: { kind: "RPE_TIME_RANGE", catalogWorkout: {} } }] as unknown as PlanSession[]
    render(<PlanPrescriptionBasis sessions={sessions} />)

    const notice = screen.getByRole("note")
    expect(notice).toBeVisible()
    expect(notice).toHaveTextContent("계산 상태를 확인하지 못했어요")
    expect(notice.closest("details")).toBeNull()
    expect(screen.getByRole("button", { name: /페이스 안내.*계산 확인 필요/u })).toBeVisible()
  })
})
