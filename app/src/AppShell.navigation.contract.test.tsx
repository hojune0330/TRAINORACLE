import { act, cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { AppShell } from "./AppShell"
import { registerUnsavedDraftGuard } from "./domain/unsaved-draft-navigation"

beforeEach(() => {
  window.localStorage.clear()
  window.sessionStorage.clear()
  window.history.replaceState(null, "", "/?app=1")
})

afterEach(cleanup)

describe("AppShell origin-preserving navigation", () => {
  it("returns from a directly opened glossary term to the exact plan step", async () => {
    const user = userEvent.setup()
    render(<AppShell />)

    await user.click(screen.getByRole("button", { name: "계획" }))
    await user.click(await screen.findByRole("button", { name: /^1500m/u }))
    expect(await screen.findByRole("heading", { name: "현재 참가하거나 준비 중인 부문이 있나요?" })).toBeVisible()

    await user.click(screen.getByRole("button", { name: /현재 참가 부문 설명 보기/u }))
    await user.click(screen.getByRole("link", { name: "왜 이런 이름인가요?" }))

    expect(await screen.findByRole("heading", { name: "현재 참가 부문" })).toBeVisible()
    expect(window.location.search).toBe("?app=1")
    expect(screen.queryByRole("button", { name: "계획" })).not.toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "이전 화면" }))
    expect(await screen.findByRole("heading", { name: "현재 참가하거나 준비 중인 부문이 있나요?" })).toBeVisible()
  })

  it("lets the browser Back action close glossary help without resetting the underlying plan", async () => {
    const user = userEvent.setup()
    render(<AppShell />)

    await user.click(screen.getByRole("button", { name: "계획" }))
    await user.click(await screen.findByRole("button", { name: /^1500m/u }))
    await user.click(screen.getByRole("button", { name: /현재 참가 부문 설명 보기/u }))
    await user.click(screen.getByRole("link", { name: "왜 이런 이름인가요?" }))
    expect(await screen.findByRole("heading", { name: "현재 참가 부문" })).toBeVisible()

    act(() => window.history.back())

    await waitFor(() => expect(screen.getByRole("heading", {
      name: "현재 참가하거나 준비 중인 부문이 있나요?",
    })).toBeVisible())
  })

  it("opens non-destructive glossary help without treating it as leaving a draft", async () => {
    const user = userEvent.setup()
    render(<AppShell />)
    await user.click(screen.getByRole("button", { name: "계획" }))
    await user.click(await screen.findByRole("button", { name: /^1500m/u }))

    const blocked = vi.fn()
    const unregister = registerUnsavedDraftGuard({ isUnsafe: () => true, onBlocked: blocked })
    try {
      await user.click(screen.getByRole("button", { name: /현재 참가 부문 설명 보기/u }))
      await user.click(screen.getByRole("link", { name: "왜 이런 이름인가요?" }))
      expect(await screen.findByRole("heading", { name: "현재 참가 부문" })).toBeVisible()
      expect(blocked).not.toHaveBeenCalled()
    } finally {
      unregister()
    }
  })

  it("returns training content and feedback to More instead of Home", async () => {
    const user = userEvent.setup()
    render(<AppShell />)

    await user.click(screen.getByRole("button", { name: "더보기" }))
    await user.click(await screen.findByRole("button", { name: "요즘 주목받는 훈련법" }))
    expect(await screen.findByRole("heading", { name: /유행 이름보다/u })).toBeVisible()
    await user.click(screen.getByRole("button", { name: "이전 화면" }))
    expect(await screen.findByRole("heading", { name: "더보기" })).toBeVisible()

    await user.click(screen.getByRole("button", { name: "문의 게시판" }))
    expect(await screen.findByRole("heading", { name: "문의 게시판" })).toBeVisible()
    await user.click(screen.getByRole("button", { name: "이전 화면으로 돌아가기" }))
    expect(await screen.findByRole("heading", { name: "더보기" })).toBeVisible()
  })

  it("returns backup restore and watch import to the screen that opened them", async () => {
    const user = userEvent.setup()
    render(<AppShell />)

    await user.click(screen.getByRole("button", { name: "더보기" }))
    await user.click(await screen.findByRole("button", { name: "내려받은 백업 되돌리기" }))
    expect(await screen.findByRole("heading", { name: "내려받은 백업 되돌리기" })).toBeVisible()
    await user.click(screen.getByRole("button", { name: "뒤로" }))
    expect(await screen.findByRole("heading", { name: "더보기" })).toBeVisible()

    await user.click(screen.getByRole("button", { name: "홈으로 돌아가기" }))
    await user.click(screen.getByRole("button", { name: "경기기록" }))
    expect(await screen.findByRole("heading", { name: "어떤 일지를 쓰세요?" })).toBeVisible()
    await user.click(screen.getByRole("button", { name: /^워치 기록 불러오기/u }))
    expect(await screen.findByRole("heading", { name: "워치 기록 불러오기" })).toBeVisible()
    await user.click(screen.getByRole("button", { name: "뒤로" }))
    expect(await screen.findByRole("heading", { name: "어떤 일지를 쓰세요?" })).toBeVisible()
  })
})
