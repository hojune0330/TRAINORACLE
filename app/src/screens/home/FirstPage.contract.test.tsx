import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import { FirstPage } from "./FirstPage"

afterEach(cleanup)

describe("first visit journal routing", () => {
  it("opens the post-session form intent from one transient context choice", async () => {
    // Given
    const user = userEvent.setup()
    const onWriteLog = vi.fn()
    render(<FirstPage onWriteLog={onWriteLog} />)

    // When
    await user.click(screen.getByRole("button", { name: "무엇을 할 수 있나요?" }))
    await user.click(screen.getByRole("button", { name: /훈련을 기록하고 싶어요/u }))

    // Then
    expect(onWriteLog).toHaveBeenCalledWith("post-session")
  })

  it("shows an honest non-collecting plan state", async () => {
    // Given
    const user = userEvent.setup()
    render(<FirstPage />)

    // When
    await user.click(screen.getByRole("button", { name: "무엇을 할 수 있나요?" }))
    await user.click(screen.getByRole("button", { name: /훈련 계획이 궁금해요/u }))

    // Then
    expect(screen.getByRole("heading", { name: "훈련계획은 준비 중이에요" })).toBeVisible()
    expect(screen.queryByRole("textbox")).toBeNull()
  })

  it("dismisses onboarding without storing an answer", async () => {
    // Given
    const user = userEvent.setup()
    const onDismiss = vi.fn()
    render(<FirstPage onDismiss={onDismiss} />)

    // When
    await user.click(screen.getByRole("button", { name: "온보딩 건너뛰기" }))

    // Then
    expect(onDismiss).toHaveBeenCalledOnce()
  })
})
