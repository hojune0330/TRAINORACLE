import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import { FirstPage } from "./FirstPage"

afterEach(cleanup)

describe("first visit routing", () => {
  it("opens the plan beta directly from the primary action", async () => {
    // Given
    const user = userEvent.setup()
    const onOpenPlan = vi.fn()
    render(<FirstPage onOpenPlan={onOpenPlan} />)

    // When
    await user.click(screen.getByRole("button", { name: "훈련계획 후보 만들기" }))

    // Then
    expect(onOpenPlan).toHaveBeenCalledOnce()
  })

  it("opens the post-session form intent from one transient context choice", async () => {
    // Given
    const user = userEvent.setup()
    const onWriteLog = vi.fn()
    render(<FirstPage onWriteLog={onWriteLog} />)

    // When
    await user.click(screen.getByRole("button", { name: "다른 시작 방법 보기" }))
    await user.click(screen.getByRole("button", { name: /훈련을 기록하고 싶어요/u }))

    // Then
    expect(onWriteLog).toHaveBeenCalledWith("post-session")
  })

  it("routes plan interest without collecting an onboarding answer", async () => {
    // Given
    const user = userEvent.setup()
    const onOpenPlan = vi.fn()
    render(<FirstPage onOpenPlan={onOpenPlan} />)

    // When
    await user.click(screen.getByRole("button", { name: "다른 시작 방법 보기" }))
    await user.click(screen.getByRole("button", { name: /훈련 계획이 궁금해요/u }))

    // Then
    expect(onOpenPlan).toHaveBeenCalledOnce()
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
