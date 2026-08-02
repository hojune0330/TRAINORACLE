import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import { PlanProposalInbox } from "./PlanProposalInbox"

afterEach(cleanup)

const warningProposal = {
  id: "proposal-1",
  title: "대회 전 계획 제안",
  changeSummary: "고강도 훈련을 하루 뒤로 옮김",
  warningReason: "회복 간격이 짧아질 수 있어요.",
  conservativeAlternative: "현재 날짜를 유지해요.",
  status: "DRAFT" as const,
  createdAt: "2026-08-01T00:00:00.000Z",
  reviewable: true,
}

describe("plan proposal inbox", () => {
  it("requires a recorded warning review before a separate atomic activation", async () => {
    const user = userEvent.setup()
    const onRecordWarningReview = vi.fn().mockResolvedValue({ ok: true, message: "경고와 보수적인 대안을 확인했어요." })
    const onActivate = vi.fn().mockResolvedValue({
      ok: true,
      receipt: {
        proposalId: "proposal-1",
        planVersionId: "a3704a33-5b9d-4fc6-a2a9-585196198ca0",
        activeRevision: 4,
        activatedAt: "2026-08-01T00:00:00.000Z",
      },
    })
    const onActivated = vi.fn()
    render(
      <PlanProposalInbox
        enabled
        onLoad={vi.fn().mockResolvedValue([warningProposal])}
        onRecordWarningReview={onRecordWarningReview}
        onActivate={onActivate}
        onActivated={onActivated}
      />,
    )

    expect(await screen.findByText("대회 전 계획 제안")).toBeVisible()
    expect(screen.queryByRole("button", { name: /그래도 이 제안 선택/u })).not.toBeInTheDocument()
    expect(onActivate).not.toHaveBeenCalled()

    await user.type(screen.getByLabelText("경고 검토 이유"), "보수적인 대안을 확인했어요")
    await user.click(screen.getByRole("button", { name: /1단계.*경고와 대안 확인/u }))

    expect(await screen.findByRole("button", { name: /2단계.*그래도 이 제안 선택/u })).toBeVisible()
    expect(onRecordWarningReview).toHaveBeenCalledWith("proposal-1", "보수적인 대안을 확인했어요")
    expect(onActivate).not.toHaveBeenCalled()

    await user.click(screen.getByRole("button", { name: /2단계.*그래도 이 제안 선택/u }))
    expect(onActivate).toHaveBeenCalledWith("proposal-1")
    expect(onActivated).toHaveBeenCalledTimes(1)
  })

  it("keeps the current plan unchanged when atomic activation is rejected", async () => {
    const user = userEvent.setup()
    const onActivated = vi.fn()
    render(
      <PlanProposalInbox
        enabled
        onLoad={vi.fn().mockResolvedValue([{ ...warningProposal, warningReason: null, conservativeAlternative: null }])}
        onActivate={vi.fn().mockResolvedValue({ ok: false, message: "계획을 적용하지 못했어요. 현재 계획은 그대로예요." })}
        onActivated={onActivated}
      />,
    )

    await user.click(await screen.findByRole("button", { name: /제안 확인하고 적용/u }))

    expect(await screen.findByRole("status")).toHaveTextContent("현재 계획은 그대로예요")
    expect(onActivated).not.toHaveBeenCalled()
  })

  it("renders nothing while the feature switch is closed", () => {
    const onLoad = vi.fn().mockResolvedValue([])
    const { container } = render(<PlanProposalInbox enabled={false} onLoad={onLoad} />)

    expect(onLoad).not.toHaveBeenCalled()
    expect(container).toBeEmptyDOMElement()
  })
})
