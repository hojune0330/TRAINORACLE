import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { FeedbackGateway } from "../domain/feedback/feedback-types"
import { FeedbackBoard } from "./FeedbackBoard"

afterEach(cleanup)

function gateway(submit: FeedbackGateway["submit"]): FeedbackGateway {
  return { list: async () => [], submit, append: async () => undefined, remove: async () => undefined }
}

describe("private feedback board", () => {
  it("accepts only the text the user explicitly writes", async () => {
    const user = userEvent.setup()
    const submit = vi.fn<FeedbackGateway["submit"]>().mockResolvedValue(undefined)
    render(<FeedbackBoard available gateway={{ ...gateway(submit) }} />)

    await user.click(screen.getByRole("button", { name: "새 문의 쓰기" }))
    await user.type(screen.getByLabelText("제목"), "첫 화면 버튼이 가려져요")
    await user.type(screen.getByLabelText("내용"), "작은 휴대폰에서 버튼이 안 보여요.")
    await user.click(screen.getByRole("button", { name: "문의 남기기" }))

    expect(submit).toHaveBeenCalledWith({
      category: "BUG",
      subject: "첫 화면 버튼이 가려져요",
      body: "작은 휴대폰에서 버튼이 안 보여요.",
    })
    expect(screen.getByText("접수됐어요.")).toBeVisible()
  })

  it("does not claim delivery and keeps typed text when sending fails", async () => {
    const user = userEvent.setup()
    render(<FeedbackBoard available gateway={gateway(async () => Promise.reject(new Error("offline")))} />)

    await user.click(screen.getByRole("button", { name: "새 문의 쓰기" }))
    await user.type(screen.getByLabelText("제목"), "저장이 되지 않아요")
    await user.type(screen.getByLabelText("내용"), "입력한 내용을 다시 확인해 주세요.")
    await user.click(screen.getByRole("button", { name: "문의 남기기" }))

    expect(screen.getByText("전송되지 않았어요. 입력한 내용은 이 화면에 남아 있어요.")).toBeVisible()
    expect(screen.getByLabelText("내용")).toHaveValue("입력한 내용을 다시 확인해 주세요.")
    expect(screen.queryByText("접수됐어요.")).toBeNull()
  })

  it("explains the closed state without redirecting to GitHub", () => {
    render(<FeedbackBoard available={false} gateway={gateway(async () => undefined)} />)
    expect(screen.getByText("문의 게시판을 지금 사용할 수 없어요.")).toBeVisible()
    expect(screen.queryByText(/GitHub/u)).toBeNull()
  })

  it("requires confirmation before deleting a receipt-owned thread", async () => {
    const user = userEvent.setup()
    const remove = vi.fn<FeedbackGateway["remove"]>().mockResolvedValue(undefined)
    const thread = {
      id: "a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1",
      category: "BUG" as const,
      subject: "첫 화면 문의",
      status: "OPEN" as const,
      createdAt: "2026-08-03T00:00:00.000Z",
      lastActivityAt: "2026-08-03T00:00:00.000Z",
      comments: [],
    }
    render(<FeedbackBoard available gateway={{ ...gateway(async () => undefined), list: async () => [thread], remove }} />)

    await screen.findByText("첫 화면 문의")
    await user.click(screen.getByRole("button", { name: /첫 화면 문의/u }))
    await user.click(screen.getByRole("button", { name: "문의 삭제" }))
    expect(remove).not.toHaveBeenCalled()
    await user.click(screen.getByRole("button", { name: "정말 삭제" }))

    expect(remove).toHaveBeenCalledWith(thread.id)
  })

  it("removes a deleted thread immediately even when the next list request fails", async () => {
    const user = userEvent.setup()
    const thread = {
      id: "b2b2b2b2-b2b2-4b2b-8b2b-b2b2b2b2b2b2",
      category: "QUESTION" as const,
      subject: "삭제할 문의",
      status: "OPEN" as const,
      createdAt: "2026-08-03T00:00:00.000Z",
      lastActivityAt: "2026-08-03T00:00:00.000Z",
      comments: [],
    }
    render(<FeedbackBoard available gateway={{
      ...gateway(async () => undefined),
      list: async () => [thread],
      remove: async () => undefined,
    }} />)

    await screen.findByText("삭제할 문의")
    await user.click(screen.getByRole("button", { name: /삭제할 문의/u }))
    await user.click(screen.getByRole("button", { name: "문의 삭제" }))
    await user.click(screen.getByRole("button", { name: "정말 삭제" }))

    expect(await screen.findByText("아직 남긴 문의가 없어요.")).toBeVisible()
  })
})
