import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it } from "vitest"
import { Guide } from "./Guide"

afterEach(cleanup)

describe("guide feedback entry", () => {
  it("keeps error and feedback reports inside TrainOracle", () => {
    render(<Guide />)

    const link = screen.getByRole("link", { name: "문의 게시판 열기" })
    expect(link).toHaveAttribute("href", "?feedback=1")
    expect(screen.queryByText(/GitHub Issues/u)).toBeNull()
  })

  it("lets a reader open and close Minji's diary pages in plain language", async () => {
    const user = userEvent.setup()
    render(<Guide />)

    expect(screen.getByRole("heading", { name: "민지의 일지" })).toBeVisible()
    await user.click(screen.getByRole("button", { name: /2개월.*힘든 날에 함께 보인 것/u }))

    expect(screen.getByRole("heading", { name: "힘든 날에 함께 보인 것" })).toBeVisible()
    expect(screen.getByText(/잠 때문이라고 확정할 수는 없어요/u)).toBeVisible()
    expect(screen.queryByText(/상관관계/u)).toBeNull()

    await user.click(screen.getByRole("button", { name: "민지의 일지 닫기" }))
    expect(screen.getByRole("heading", { name: "민지의 일지" })).toBeVisible()
  })

  it("closes an open Minji page with Escape", async () => {
    const user = userEvent.setup()
    render(<Guide />)

    await user.click(screen.getByRole("button", { name: /2개월.*힘든 날에 함께 보인 것/u }))
    fireEvent.keyDown(window, { key: "Escape" })

    expect(screen.getByRole("heading", { name: "민지의 일지" })).toBeVisible()
  })

  it("explains training notation without presenting it as a recommendation", async () => {
    const user = userEvent.setup()
    render(<Guide />)

    await user.click(screen.getByRole("button", { name: /10개월.*같은 훈련, 달라진 느낌/u }))
    expect(screen.getByText("민지의 가상 예시이며 따라 하는 훈련계획이 아니에요.")).toBeVisible()
    await user.click(screen.getByRole("button", { name: "훈련 표시 쉽게 보기" }))

    expect(screen.getByText("1000m를 여섯 번 뛰는 예시예요.")).toBeVisible()
    expect(screen.getByText("민지의 가상 기록이며 따라 하라는 계획이 아니에요.")).toBeVisible()
  })
})
