import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import { FirstPage } from "./FirstPage"

afterEach(cleanup)

describe("first visit routing", () => {
  it("makes today's journal the first action and asks one follow-up choice", async () => {
    // Given
    const user = userEvent.setup()
    const onWriteLog = vi.fn()
    render(<FirstPage onWriteLog={onWriteLog} />)

    // When
    await user.click(screen.getByRole("button", { name: "오늘 기록 시작하기" }))

    // Then
    expect(screen.getByRole("heading", { name: "무엇을 남길까요?" })).toBeVisible()
    expect(onWriteLog).not.toHaveBeenCalled()
    expect(screen.getByRole("button", { name: /경기를 기록할래요/u })).toBeVisible()
  })

  it("opens the post-session form intent from one transient context choice", async () => {
    // Given
    const user = userEvent.setup()
    const onWriteLog = vi.fn()
    render(<FirstPage onWriteLog={onWriteLog} />)

    // When
    await user.click(screen.getByRole("button", { name: "오늘 기록 시작하기" }))
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
    await user.click(screen.getByRole("button", { name: "훈련계획 먼저 보기" }))

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
    await user.click(screen.getByRole("button", { name: "홈 먼저 둘러보기" }))

    // Then
    expect(onDismiss).toHaveBeenCalledOnce()
  })

  it("moves focus to the new question and exposes backup recovery", async () => {
    const user = userEvent.setup()
    const onOpenRestore = vi.fn()
    render(<FirstPage onOpenRestore={onOpenRestore} />)

    await user.click(screen.getByRole("button", { name: "오늘 기록 시작하기" }))
    expect(screen.getByRole("heading", { name: "무엇을 남길까요?" })).toHaveFocus()

    await user.click(screen.getByRole("button", { name: "이전 화면으로" }))
    await user.click(screen.getByRole("button", { name: "백업 불러오기" }))
    expect(onOpenRestore).toHaveBeenCalledOnce()
  })
})
