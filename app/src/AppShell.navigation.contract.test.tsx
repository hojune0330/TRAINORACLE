import { act, cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { AppShell } from "./AppShell"
import { registerUnsavedDraftGuard } from "./domain/unsaved-draft-navigation"
import { enterPlanWithoutRecord } from "./screens/plan-beta/instant-plan.test-helper"

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
    await screen.findByRole("button", { name: "내 계획 받기" }, { timeout: 5000 })
    await enterPlanWithoutRecord()
    expect(await screen.findByRole("heading", { name: "지금까지 어떻게 달려왔나요?" })).toBeVisible()

    await user.click(screen.getByRole("button", { name: /훈련 경험 설명 보기/u }))
    await user.click(screen.getByRole("link", { name: "왜 이런 이름인가요?" }))

    expect(await screen.findByRole("heading", { name: "훈련 경험" })).toBeVisible()
    expect(window.location.search).toBe("?app=1")
    expect(screen.queryByRole("button", { name: "계획" })).not.toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "이전 화면" }))
    expect(await screen.findByRole("heading", { name: "지금까지 어떻게 달려왔나요?" })).toBeVisible()
  })

  it("lets the browser Back action close glossary help without resetting the underlying plan", async () => {
    const user = userEvent.setup()
    render(<AppShell />)

    await user.click(screen.getByRole("button", { name: "계획" }))
    await screen.findByRole("button", { name: "내 계획 받기" }, { timeout: 5000 })
    await enterPlanWithoutRecord()
    await user.click(screen.getByRole("button", { name: /훈련 경험 설명 보기/u }))
    await user.click(screen.getByRole("link", { name: "왜 이런 이름인가요?" }))
    expect(await screen.findByRole("heading", { name: "훈련 경험" })).toBeVisible()

    act(() => window.history.back())

    await waitFor(() => expect(screen.getByRole("heading", {
      name: "지금까지 어떻게 달려왔나요?",
    })).toBeVisible())
  })

  it("opens non-destructive glossary help without treating it as leaving a draft", async () => {
    const user = userEvent.setup()
    render(<AppShell />)
    await user.click(screen.getByRole("button", { name: "계획" }))
    await screen.findByRole("button", { name: "내 계획 받기" }, { timeout: 5000 })
    await enterPlanWithoutRecord()

    const blocked = vi.fn()
    const unregister = registerUnsavedDraftGuard({ isUnsafe: () => true, onBlocked: blocked })
    try {
      await user.click(screen.getByRole("button", { name: /훈련 경험 설명 보기/u }))
      await user.click(screen.getByRole("link", { name: "왜 이런 이름인가요?" }))
      expect(await screen.findByRole("heading", { name: "훈련 경험" })).toBeVisible()
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
    expect(await screen.findByRole("heading", { name: "어떤 훈련이 궁금한가요?" })).toBeVisible()
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
    await user.click(screen.getByRole("button", { name: "기록하기" }))
    expect(await screen.findByRole("heading", { name: "어떤 일지를 쓰세요?" })).toBeVisible()
    await user.click(screen.getByRole("button", { name: /^워치 기록 불러오기/u }))
    expect(await screen.findByRole("heading", { name: "워치 기록 불러오기" })).toBeVisible()
    await user.click(screen.getByRole("button", { name: "뒤로" }))
    expect(await screen.findByRole("heading", { name: "어떤 일지를 쓰세요?" })).toBeVisible()
  })
})
