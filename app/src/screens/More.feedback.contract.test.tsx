import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import { More } from "./More"

vi.mock("../domain/product-features", () => ({
  productFeatures: () => ({ feedbackBoard: true }),
}))

vi.mock("../domain/feedback/feedback-config", () => ({
  feedbackConfig: () => null,
}))

afterEach(cleanup)

describe("more feedback entry", () => {
  it("uses the same inquiry-board name as the comment-style board", () => {
    render(<More onBack={vi.fn()} onOpenMinji={vi.fn()} onOpenGuide={vi.fn()} feedbackAvailable />)
    fireEvent.click(screen.getByRole("button", { name: "앱 정보·개인정보·문의" }))

    expect(screen.getByRole("link", { name: /^문의 게시판/u })).toBeVisible()
    expect(screen.queryByRole("link", { name: /^의견 게시판/u })).not.toBeInTheDocument()
  })

  it("describes a board as closed when its switch is on but its connection is incomplete", () => {
    render(<More onBack={vi.fn()} onOpenMinji={vi.fn()} onOpenGuide={vi.fn()} />)
    fireEvent.click(screen.getByRole("button", { name: "앱 정보·개인정보·문의" }))

    expect(screen.getByRole("link", { name: /^문의 게시판/u })).toHaveTextContent("준비 중")
  })

  it("does not mark the available board as pending", () => {
    render(<More onBack={vi.fn()} onOpenMinji={vi.fn()} onOpenGuide={vi.fn()} feedbackAvailable />)
    fireEvent.click(screen.getByRole("button", { name: "앱 정보·개인정보·문의" }))

    expect(screen.getByRole("link", { name: "문의 게시판" })).not.toHaveTextContent("준비 중")
  })

  it("uses the shell callback instead of leaving the app when available", async () => {
    const user = userEvent.setup()
    let opened = false
    render(<More onBack={vi.fn()} onOpenMinji={vi.fn()} onOpenGuide={vi.fn()} onOpenFeedback={() => { opened = true }} feedbackAvailable />)
    await user.click(screen.getByRole("button", { name: "앱 정보·개인정보·문의" }))

    await user.click(screen.getByRole("button", { name: "문의 게시판" }))

    expect(opened).toBe(true)
    expect(screen.queryByRole("link", { name: /^문의 게시판/u })).not.toBeInTheDocument()
  })
})
