import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import { PlanProposalInbox } from "./PlanProposalInbox"

afterEach(cleanup)

describe("plan proposal inbox", () => {
  it("requires two distinct warning confirmations and shows the conservative alternative", async () => {
    const user = userEvent.setup()
    const onReview = vi.fn()
      .mockResolvedValueOnce({ ok: true, status: "WARNING_REVIEWED", message: "경고를 확인했어요." })
      .mockResolvedValueOnce({ ok: true, status: "USER_ACCEPTED_WITH_WARNING", message: "선택을 기록했어요." })
    const onLoad = vi.fn().mockResolvedValue([{
      id: "proposal-1",
      title: "대회 전 계획 제안",
      changeSummary: "고강도 훈련을 하루 뒤로 옮김",
      warningReason: "회복 간격이 짧아질 수 있어요.",
      conservativeAlternative: "현재 날짜를 유지해요.",
      status: "DRAFT",
      createdAt: "2026-08-01T00:00:00.000Z",
      reviewable: true,
    }])
    render(<PlanProposalInbox enabled onLoad={onLoad} onReview={onReview} />)

    expect(await screen.findByText("대회 전 계획 제안")).toBeVisible()
    expect(screen.getByText(/현재 날짜를 유지/u)).toBeVisible()
    expect(screen.queryByRole("button", { name: /그래도 이 제안 선택/u })).not.toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: /1단계.*경고와 대안 확인/u }))
    expect(await screen.findByRole("button", { name: /2단계.*그래도 이 제안 선택/u })).toBeVisible()
    expect(onReview).toHaveBeenCalledTimes(1)

    await user.click(screen.getByRole("button", { name: /2단계.*그래도 이 제안 선택/u }))
    expect(onReview).toHaveBeenCalledTimes(2)
  })

  it("renders nothing while the feature switch is closed", () => {
    const onLoad = vi.fn().mockResolvedValue([])
    const { container } = render(<PlanProposalInbox enabled={false} onLoad={onLoad} />)

    expect(onLoad).not.toHaveBeenCalled()
    expect(container).toBeEmptyDOMElement()
  })
})
