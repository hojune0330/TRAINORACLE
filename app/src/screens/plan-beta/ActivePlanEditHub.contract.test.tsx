import { cleanup, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import { ActivePlanEditHub, type ActivePlanEditIntent } from "./ActivePlanEditHub"

afterEach(cleanup)

describe("active plan edit hub", () => {
  it("offers the four distinct edit intents and sends the selected intent", async () => {
    const user = userEvent.setup()
    const onChoose = vi.fn<(intent: ActivePlanEditIntent) => void>()

    render(<ActivePlanEditHub onClose={vi.fn()} onChoose={onChoose} />)

    const region = screen.getByRole("region", { name: "계획 수정" })
    expect(region).toHaveTextContent("바꾸려는 범위를 선택해 주세요.")
    expect(within(region).getByRole("button", { name: "훈련 날짜 바꾸기" })).toBeVisible()
    expect(within(region).getByRole("button", { name: "훈련 내용 바꾸기" })).toBeVisible()
    expect(within(region).getByRole("button", { name: "남은 일정 다시 짜기" })).toBeVisible()
    expect(within(region).getByRole("button", { name: "새 계획 만들기" })).toBeVisible()

    await user.click(within(region).getByRole("button", { name: "남은 일정 다시 짜기" }))
    expect(onChoose).toHaveBeenCalledWith("remaining")
  })

  it("explains unavailable choices and exposes only a real alternative action", async () => {
    const user = userEvent.setup()
    const onChoose = vi.fn()
    const onAlternative = vi.fn()

    render(<ActivePlanEditHub
      onClose={vi.fn()}
      onChoose={onChoose}
      availability={{
        schedule: {
          available: false,
          reason: "날짜 변경 경로를 아직 열 수 없어요.",
          alternative: { label: "남은 일정 확인하기", onChoose: onAlternative },
        },
      }}
    />)

    expect(screen.getByText("훈련 날짜 바꾸기")).toBeVisible()
    expect(screen.getByText("날짜 변경 경로를 아직 열 수 없어요.")).toBeVisible()
    expect(screen.queryByRole("button", { name: "훈련 날짜 바꾸기" })).not.toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "남은 일정 확인하기" }))
    expect(onAlternative).toHaveBeenCalledOnce()
    expect(onChoose).not.toHaveBeenCalled()
  })

  it("moves focus into the panel and restores it when closed", async () => {
    const user = userEvent.setup()
    const opener = document.createElement("button")
    opener.textContent = "계획 수정 열기"
    document.body.append(opener)
    opener.focus()
    const onClose = vi.fn()

    const { unmount } = render(<ActivePlanEditHub onClose={onClose} onChoose={vi.fn()} />)
    expect(screen.getByRole("heading", { name: "계획 수정" })).toHaveFocus()

    await user.click(screen.getByRole("button", { name: "계획 수정 닫기" }))
    expect(onClose).toHaveBeenCalledOnce()
    expect(opener).toHaveFocus()

    unmount()
    opener.remove()
  })
})
