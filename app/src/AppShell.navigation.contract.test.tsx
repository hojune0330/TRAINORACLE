import { act, cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import { AppShell } from "./AppShell"
import { registerUnsavedDraftGuard } from "./domain/unsaved-draft-navigation"
import { setActiveLocalAccount } from "./domain/account/local-journal-ownership"
import { enterPlanWithoutRecord } from "./screens/plan-beta/instant-plan.test-helper"
import { PLAN_BETA_STORAGE_KEY } from "./domain/plan-beta-store"

// Transform the large lazy module outside the interaction timeout; browser tests cover its load.
beforeAll(async () => { await import("./screens/PlanBeta") }, 60000)

beforeEach(() => {
  window.localStorage.clear()
  window.sessionStorage.clear()
  window.history.replaceState(null, "", "/?app=1")
})

afterEach(() => { cleanup(); vi.unstubAllEnvs() })

describe("AppShell origin-preserving navigation", { timeout: 15000 }, () => {
  it("does not resume a delayed draft decision after the owner lifetime has changed", async () => {
    const user = userEvent.setup()
    render(<AppShell />)
    let unsafe = true
    let resume: (() => void) | undefined
    const unregister = registerUnsavedDraftGuard({
      isUnsafe: () => unsafe,
      onBlocked: () => undefined,
      requestNavigation: callback => { resume = callback },
    })
    try {
      await user.click(screen.getByRole("button", { name: "기록하기" }))
      expect(resume).toBeTypeOf("function")
      act(() => {
        setActiveLocalAccount("navigation-decision-account")
        setActiveLocalAccount(null)
        unsafe = false
        resume?.()
      })
      expect(screen.queryByRole("heading", { name: "어떤 일지를 쓰세요?" })).toBeNull()
      expect(screen.getByRole("button", { name: "홈" })).toHaveAttribute("aria-current", "page")
    } finally { unregister(); setActiveLocalAccount(null) }
  })

  it("opens record management and watch import directly from More and returns there", async () => {
    const user = userEvent.setup()
    render(<AppShell />)
    await user.click(screen.getByRole("button", { name: "더보기" }))
    await user.click(await screen.findByRole("button", { name: "경기 기록 추가·수정" }))
    await user.click(await screen.findByRole("button", { name: "더보기로" }))
    expect(await screen.findByRole("heading", { name: "더보기" })).toBeVisible()
    await user.click(screen.getByRole("button", { name: "워치 파일 가져오기" }))
    expect(await screen.findByRole("heading", { name: "워치 기록 불러오기" })).toBeVisible()
    await user.click(screen.getByRole("button", { name: "뒤로" }))
    expect(await screen.findByRole("heading", { name: "더보기" })).toBeVisible()
  })
  it("opens Oracle reading directly from More and keeps the correct return destination", async () => {
    vi.stubEnv("VITE_FEATURE_ORACLE_V2", "true")
    const user = userEvent.setup()
    render(<AppShell />)
    await user.click(screen.getByRole("button", { name: "더보기" }))
    await user.click(await screen.findByRole("button", { name: "오라클 읽을거리" }))
    expect(await screen.findByRole("article", { name: "먼저 읽을 글" }, { timeout: 10000 })).toBeVisible()
    const topics = screen.getByRole("button", { name: /^전체 주제·다른 글/u })
    expect(topics).toHaveAttribute("aria-expanded", "false")
    expect(screen.getByRole("group", { name: "읽을거리 주제" })).not.toBeVisible()
    await user.click(topics)
    expect(await screen.findByRole("group", { name: "읽을거리 주제" }, { timeout: 10000 })).toBeVisible()
    await user.click(screen.getByRole("button", { name: "더보기로 돌아가기" }))
    expect(await screen.findByRole("heading", { name: "더보기" })).toBeVisible()
  })
  it("opens existing training reading directly from V1 Oracle and returns to the same hub", async () => {
    vi.stubEnv("VITE_FEATURE_ORACLE_V2", "false")
    const user = userEvent.setup()
    render(<AppShell />)
    await user.click(screen.getByRole("button", { name: "오라클" }))
    await user.click(await screen.findByRole("button", { name: "읽을거리·관심" }, { timeout: 10000 }))
    expect(await screen.findByRole("heading", { name: "어떤 훈련이 궁금한가요?" })).toBeVisible()
    await user.click(screen.getByRole("button", { name: "이전 화면" }))
    expect(await screen.findByRole("button", { name: "내 훈련" })).toHaveAttribute("aria-pressed", "true")
    expect(screen.getByRole("button", { name: "읽을거리·관심" })).toBeVisible()
    expect(screen.getByRole("button", { name: "오라클" })).toHaveAttribute("aria-current", "page")
  })
  it("keeps the selected training step mounted while recording and returns without a reset", async () => {
    const user = userEvent.setup()
    render(<AppShell />)
    await user.click(screen.getByRole("button", { name: "훈련" }))
    await screen.findByRole("heading", { name: "어떤 종목을 준비하세요?" }, { timeout: 10000 })
    await enterPlanWithoutRecord()
    expect(await screen.findByRole("heading", { name: "지금까지 어떻게 달려왔나요?" })).toBeVisible()
    await user.click(screen.getByRole("button", { name: "기록하기" }))
    expect(await screen.findByRole("heading", { name: "어떤 일지를 쓰세요?" })).toBeVisible()
    expect(screen.getByRole("button", { name: "훈련" })).toHaveAttribute("aria-current", "page")
    await user.click(screen.getByRole("button", { name: "← 뒤로" }))
    expect(await screen.findByRole("heading", { name: "지금까지 어떻게 달려왔나요?" })).toBeVisible()
    await waitFor(() => expect(screen.getByRole("button", { name: "기록하기" })).toHaveFocus())
  })

  it("returns browser Back from recording to the same Oracle analysis selection", async () => {
    const user = userEvent.setup()
    render(<AppShell />)
    await user.click(screen.getByRole("button", { name: "오라클" }))
    await user.click(await screen.findByText("훈련량·구성·변화 보기"))
    await user.click(screen.getByRole("button", { name: "훈련량" }))
    expect(screen.getByText("훈련량 · 다른 항목 보기")).toBeVisible()
    await user.click(screen.getByRole("button", { name: "기록하기" }))
    expect(await screen.findByRole("heading", { name: "어떤 일지를 쓰세요?" })).toBeVisible()
    act(() => window.history.back())
    await waitFor(() => expect(screen.getByText("훈련량 · 다른 항목 보기")).toBeVisible())
    expect(screen.getByRole("button", { name: "내 훈련" })).toHaveAttribute("aria-pressed", "true")
    expect(screen.getByRole("button", { name: "오라클" })).toHaveAttribute("aria-current", "page")
    expect(screen.queryByRole("heading", { name: "어떤 일지를 쓰세요?" })).toBeNull()
    await waitFor(() => expect(screen.getByRole("button", { name: "기록하기" })).toHaveFocus())
    await user.click(screen.getByText("훈련량 · 다른 항목 보기"))
    expect(screen.getByRole("button", { name: "훈련량" })).toHaveAttribute("aria-pressed", "true")
  })

  it("returns from a directly opened glossary term to the exact plan step", async () => {
    const user = userEvent.setup()
    render(<AppShell />)

    await user.click(screen.getByRole("button", { name: "훈련" }))
    await screen.findByRole("heading", { name: "어떤 종목을 준비하세요?" }, { timeout: 10000 })
    await enterPlanWithoutRecord()
    expect(await screen.findByRole("heading", { name: "지금까지 어떻게 달려왔나요?" })).toBeVisible()

    await user.click(screen.getByRole("button", { name: /훈련 경험 설명 보기/u }))
    await user.click(screen.getByRole("link", { name: "왜 이런 이름인가요?" }))

    expect(await screen.findByRole("heading", { name: "훈련 경험" })).toBeVisible()
    expect(window.location.search).toBe("?app=1")
    expect(screen.queryByRole("button", { name: "훈련" })).not.toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "이전 화면" }))
    expect(await screen.findByRole("heading", { name: "지금까지 어떻게 달려왔나요?" })).toBeVisible()
  })

  it("lets the browser Back action close glossary help without resetting the underlying plan", async () => {
    const user = userEvent.setup()
    render(<AppShell />)

    await user.click(screen.getByRole("button", { name: "훈련" }))
    await screen.findByRole("heading", { name: "어떤 종목을 준비하세요?" }, { timeout: 10000 })
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
    await user.click(screen.getByRole("button", { name: "훈련" }))
    await screen.findByRole("heading", { name: "어떤 종목을 준비하세요?" }, { timeout: 10000 })
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

  it("returns training content and feedback to their More submenus instead of Home", async () => {
    const user = userEvent.setup()
    render(<AppShell />)

    await user.click(screen.getByRole("button", { name: "더보기" }))
    await user.click(await screen.findByRole("button", { name: "배우기·꾸미기" }))
    await user.click(await screen.findByRole("button", { name: "훈련법 읽기" }))
    expect(await screen.findByRole("heading", { name: "어떤 훈련이 궁금한가요?" })).toBeVisible()
    await user.click(screen.getByRole("button", { name: "이전 화면" }))
    expect(await screen.findByRole("heading", { name: "배우기·꾸미기" })).toBeVisible()

    await user.click(screen.getByRole("button", { name: "더보기로 돌아가기" }))
    await user.click(await screen.findByRole("button", { name: "앱 정보·개인정보·문의" }))
    await user.click(screen.getByRole("button", { name: "문의 게시판" }))
    expect(await screen.findByRole("heading", { name: "문의 게시판" })).toBeVisible()
    await user.click(screen.getByRole("button", { name: "이전 화면으로 돌아가기" }))
    expect(await screen.findByRole("heading", { name: "앱 정보·개인정보·문의" })).toBeVisible()
    await user.click(screen.getByRole("button", { name: "더보기로 돌아가기" }))
    expect(await screen.findByRole("heading", { name: "더보기" })).toBeVisible()
  })

  it("returns backup restore and watch import to the screen that opened them", async () => {
    const user = userEvent.setup()
    render(<AppShell />)

    await user.click(screen.getByRole("button", { name: "더보기" }))
    await user.click(await screen.findByRole("button", { name: "백업·복원·휴지통" }))
    await user.click(await screen.findByRole("button", { name: "내려받은 백업 되돌리기" }))
    expect(await screen.findByRole("heading", { name: "내려받은 백업 되돌리기" })).toBeVisible()
    await user.click(screen.getByRole("button", { name: "뒤로" }))
    expect(await screen.findByRole("heading", { name: "백업·복원·휴지통" })).toBeVisible()

    await user.click(screen.getByRole("button", { name: "더보기로 돌아가기" }))
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

async function navigateHistory(direction: "back" | "forward") {
  const popped = new Promise<void>(resolve => window.addEventListener("popstate", () => resolve(), { once: true }))
  await act(async () => { window.history[direction](); await popped })
}

async function enterOraclePlan(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "오라클" }))
  await user.click(await screen.findByRole("button", { name: "이 예시 자세히 보기" }, { timeout: 10000 }))
  await user.click(await screen.findByRole("button", { name: "내 기록으로 확인하기" }, { timeout: 10000 }))
  await user.click(screen.getByRole("button", { name: "계획 만들기" }))
  await screen.findByRole("heading", { name: "어떤 종목을 준비하세요?" })
}

async function saveOraclePlan(user: ReturnType<typeof userEvent.setup>) {
  await enterOraclePlan(user)
  await enterPlanWithoutRecord()
  await user.click(screen.getByRole("button", { name: /빠른 훈련과 쉬운 훈련을 나눠 꾸준히 해왔어요/u }))
  await user.click(screen.getByRole("button", { name: /^매일/u }))
  await user.click(screen.getByRole("button", { name: /통증은 없고 몸 상태는 평소와 같아요/u }))
  await user.click(screen.getByRole("button", { name: "이 일정으로 시작" }))
  await screen.findByRole("heading", { name: "9일 훈련 계획" })
}

describe("saved Oracle plan Forward navigation", { timeout: 20000 }, () => {
  it("reopens the saved plan with Forward after returning to its Oracle result", async () => {
    const user = userEvent.setup(); render(<AppShell />)
    await saveOraclePlan(user)
    const stored = localStorage.getItem(PLAN_BETA_STORAGE_KEY)
    expect(stored).not.toBeNull()
    for (let count = 0; count < 2; count += 1) {
      await navigateHistory("back")
      expect(screen.getByRole("combobox", { name: "살펴볼 주제" })).toHaveValue("focus")
      await navigateHistory("forward")
      expect(screen.getByRole("heading", { name: "9일 훈련 계획" })).toBeVisible()
      expect(screen.getByRole("button", { name: "훈련" })).toHaveAttribute("aria-current", "page")
      expect(localStorage.getItem(PLAN_BETA_STORAGE_KEY)).toBe(stored)
    }
  })

  it("does not bring back a discarded unsaved plan through Forward", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true)
    const user = userEvent.setup(); render(<AppShell />)
    await enterOraclePlan(user)
    await user.click(screen.getByRole("button", { name: "1500m" }))
    await user.click(screen.getByRole("button", { name: "내 기록" }))
    await user.type(screen.getByLabelText("분", { exact: true }), "4")
    await user.type(screen.getByLabelText("초", { exact: true }), "23.4")
    await navigateHistory("back")
    expect(confirm).toHaveBeenCalledTimes(1)
    await navigateHistory("forward")
    expect(screen.queryByRole("form", { name: "계획 시작 정보" })).toBeNull()
    expect(localStorage.getItem(PLAN_BETA_STORAGE_KEY)).toBeNull()
  })

  it("keeps the Oracle result when an unsaved draft refuses Forward", async () => {
    const user = userEvent.setup(); render(<AppShell />)
    await saveOraclePlan(user)
    await navigateHistory("back")
    const confirmDiscard = vi.fn(() => false)
    const discard = vi.fn()
    const unregister = registerUnsavedDraftGuard({ isUnsafe: () => true, onBlocked: () => undefined, confirmDiscard, discard })
    try {
      await navigateHistory("forward")
      await waitFor(() => expect(window.history.state?.trainoracleOverlay?.topic).toBe("focus"))
      expect(confirmDiscard).toHaveBeenCalledTimes(1)
      expect(discard).not.toHaveBeenCalled()
      expect(screen.getByRole("combobox", { name: "살펴볼 주제" })).toHaveValue("focus")
      expect(screen.queryByRole("heading", { name: "9일 훈련 계획" })).toBeNull()
    } finally { unregister() }
    await navigateHistory("forward")
    expect(screen.getByRole("heading", { name: "9일 훈련 계획" })).toBeVisible()
  })

  it.each(["tab", "owner", "remount", "removed"] as const)("does not restore a saved plan token after %s invalidation", async reason => {
    const user = userEvent.setup(); const app = render(<AppShell />)
    await saveOraclePlan(user)
    await navigateHistory("back")
    if (reason === "tab") await user.click(screen.getByRole("button", { name: "홈" }))
    if (reason === "owner") act(() => { setActiveLocalAccount("synthetic-forward-owner"); setActiveLocalAccount(null) })
    if (reason === "remount") { app.unmount(); render(<AppShell />) }
    if (reason === "removed") localStorage.removeItem(PLAN_BETA_STORAGE_KEY)
    await navigateHistory("forward")
    expect(screen.queryByRole("heading", { name: "9일 훈련 계획" })).toBeNull()
    expect(screen.getByRole("button", { name: "훈련" })).not.toHaveAttribute("aria-current", "page")
  })
})
