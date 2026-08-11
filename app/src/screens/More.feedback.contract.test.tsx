import { cleanup, render, screen } from "@testing-library/react"
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

    expect(screen.getByRole("link", { name: /^문의 게시판/u })).toBeVisible()
    expect(screen.queryByRole("link", { name: /^의견 게시판/u })).not.toBeInTheDocument()
  })

  it("describes a board as closed when its switch is on but its connection is incomplete", () => {
    render(<More onBack={vi.fn()} onOpenMinji={vi.fn()} onOpenGuide={vi.fn()} />)

    expect(screen.getByText("지금은 준비 중이에요. 열리면 앱 안에서 알려드려요")).toBeVisible()
  })

  it("keeps the post invitation when the board is open", () => {
    render(<More onBack={vi.fn()} onOpenMinji={vi.fn()} onOpenGuide={vi.fn()} feedbackAvailable />)

    expect(screen.getByText("불편한 점을 일지 내용 없이 남겨요")).toBeVisible()
  })
})
