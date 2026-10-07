import React from "react"
import { act, cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import { AppShell } from "./AppShell"
import { ENGAGEMENT_STORAGE_KEY } from "./domain/engagement"
import type { JournalEntry } from "./domain/journal-schema"
import { setActiveLocalAccount } from "./domain/account/local-journal-ownership"
import { registerUnsavedDraftGuard } from "./domain/unsaved-draft-navigation"

const STORAGE_KEY = "trainoracle.journal.v1"

// Transform the lazy archive outside the interaction timeout, as in navigation contracts.
beforeAll(async () => { await import("./screens/JournalArchive") }, 60000)

const ENTRY = {
  id: "archive-shell-session",
  kind: "post-session",
  date: "2026-07-10",
  savedAt: "2026-07-10T09:00:00.000Z",
  syncState: "local",
  system: "base",
  title: "아카이브 복귀 훈련",
  distanceKm: "6",
  durationMin: "30",
  avgPace: "5:00",
  rpe: 4,
  memo: "",
  fieldProvenance: {
    distanceKm: { provenance: "EXPLICIT" },
    durationMin: { provenance: "EXPLICIT" },
    avgPace: { provenance: "EXPLICIT" },
    rpe: { provenance: "EXPLICIT" },
  },
} satisfies JournalEntry

afterEach(cleanup)

describe("AppShell journal archive routing", () => {
  beforeEach(() => {
    setActiveLocalAccount("test-reset"); setActiveLocalAccount(null)
    window.localStorage.clear()
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([ENTRY]))
  })

  it("returns from a day detail to the same selected month", async () => {
    const user = userEvent.setup()
    render(<AppShell />)

    await user.click(screen.getByRole("button", { name: "전체 일지" }))
    await user.click(await screen.findByRole("button", { name: /^2026년 7월 훈련 후/u }))
    await user.click(await screen.findByRole("button", { name: /2026년 7월 10일/u }))
    await user.click(screen.getByRole("button", { name: "일지·메모 원문 열기" }))

    expect(await screen.findByText("아카이브 복귀 훈련", {}, { timeout: 5_000 })).toBeVisible()
    await user.click(screen.getByRole("button", { name: "일지 목록으로 돌아가기" }))

    expect(await screen.findByRole("heading", { name: "2026년 7월", level: 1 })).toBeVisible()
    expect(screen.getByRole("grid", { name: "2026년 7월 달력" })).toBeVisible()
    expect(screen.getByRole("button", { name: /2026년 7월 10일/u })).toBeVisible()
  })

  it("does not let browser Back bypass an unsafe decoration draft from a calendar original page", async () => {
    const user = userEvent.setup()
    render(<AppShell />)

    await user.click(screen.getByRole("button", { name: "전체 일지" }))
    await user.click(await screen.findByRole("button", { name: /^2026년 7월 훈련 후/u }, { timeout: 5_000 }))
    await user.click(await screen.findByRole("button", { name: /2026년 7월 10일/u }))
    await user.click(screen.getByRole("button", { name: "일지·메모 원문 열기" }))
    expect(await screen.findByText("아카이브 복귀 훈련", {}, { timeout: 5_000 })).toBeVisible()
    await user.click(screen.getByRole("button", { name: "일지 꾸미기 열기" }))
    expect(await screen.findByRole("dialog", { name: "일지 꾸미기" })).toBeVisible()

    const blocked = vi.fn()
    const unregister = registerUnsavedDraftGuard({ isUnsafe: () => true, onBlocked: blocked })
    try {
      act(() => window.dispatchEvent(new PopStateEvent("popstate", { state: null })))
      await waitFor(() => expect(blocked).toHaveBeenCalledOnce())
      expect(screen.getByText("아카이브 복귀 훈련")).toBeVisible()
    } finally {
      unregister()
    }
  })

  it("returns from editing an archived entry to the same selected month", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false)
    const user = userEvent.setup()
    render(<AppShell />)

    await user.click(screen.getByRole("button", { name: "전체 일지" }))
    await user.click(await screen.findByRole("button", { name: /^2026년 7월 훈련 후/u }, { timeout: 5_000 }))
    await user.click(await screen.findByRole("button", { name: /2026년 7월 10일/u }))
    await user.click(screen.getByRole("button", { name: "일지·메모 원문 열기" }))
    await user.click(await screen.findByTestId("journal-manage-toggle"))
    await user.click(await screen.findByRole("button", { name: "훈련 기록 수정" }))

    await user.click(screen.getByRole("button", { name: "← 뒤로" }))
    expect(confirm).not.toHaveBeenCalled()
    expect(await screen.findByText("아카이브 복귀 훈련")).toBeVisible()
    await user.click(screen.getByRole("button", { name: "일지 목록으로 돌아가기" }))

    expect(await screen.findByRole("heading", { name: "2026년 7월", level: 1 })).toBeVisible()
    expect(screen.getByRole("grid", { name: "2026년 7월 달력" })).toBeVisible()
    expect(screen.getByRole("button", { name: /2026년 7월 10일/u })).toBeVisible()
  })

  it("does not reset the archive when the active journal tab is tapped again", async () => {
    const user = userEvent.setup()
    render(<AppShell />)

    await user.click(screen.getByRole("button", { name: "일지" }))
    await user.click(await screen.findByRole("button", { name: /^2026년 7월 훈련 후/u }))
    await user.click(screen.getByRole("button", { name: "일지" }))

    expect(await screen.findByRole("heading", { name: "2026년 7월", level: 1 })).toBeVisible()
    expect(screen.getByRole("grid", { name: "2026년 7월 달력" })).toBeVisible()
  })

  it("returns a Minji example opened from home back to home", async () => {
    window.localStorage.clear()
    const user = userEvent.setup()
    render(<AppShell />)

    await user.click(screen.getByRole("button", { name: "일지 예시·훈련법·꾸미기" }))
    await user.click(screen.getByRole("button", { name: "일지 예시 보기" }))
    await user.click(await screen.findByRole("button", { name: /돌아가기/u }))

    expect(screen.getByRole("heading", {
      name: "오늘 운동을 기록해요",
    })).toBeVisible()
  })

  it("opens the journal archive from the dedicated journal tab", async () => {
    const user = userEvent.setup()
    render(<AppShell />)

    await user.click(screen.getByRole("button", { name: "일지" }))

    expect(await screen.findByRole("heading", { name: "지난 일지" })).toBeVisible()
  })

  it("starts a journal from the empty archive without returning home first", async () => {
    window.localStorage.clear()
    const user = userEvent.setup()
    render(<AppShell />)

    await user.click(screen.getByRole("button", { name: "일지" }))
    await user.click(await screen.findByRole("button", { name: "내 첫 기록 남기기" }))

    expect(await screen.findByRole("heading", { name: "어떤 일지를 쓰세요?" })).toBeVisible()
  })

  it("starts a journal from the empty analysis screen", async () => {
    window.localStorage.clear()
    const user = userEvent.setup()
    render(<AppShell />)

    await user.click(screen.getByRole("button", { name: "오라클" }))
    expect(await screen.findByRole("heading", { name: "오라클" })).toBeVisible()
    await user.click(screen.getByRole("button", { name: "첫 기록 남기기" }))

    expect(await screen.findByRole("heading", { name: "어떤 일지를 쓰세요?" })).toBeVisible()
  })

  it("keeps the easy FAQ reachable through More's learning menu", async () => {
    const user = userEvent.setup()
    render(<AppShell />)

    await user.click(screen.getByRole("button", { name: "더보기" }))
    await user.click(await screen.findByRole("button", { name: "배우기·꾸미기" }))
    await user.click(await screen.findByRole("button", { name: "훈련 용어집·도움말" }))

    expect(await screen.findByRole("heading", { name: "궁금한 점을 쉽게 풀어드려요" })).toBeVisible()
  })

  it("keeps safe export and confirmed full backup inside more", async () => {
    const user = userEvent.setup()
    render(<AppShell />)

    await user.click(screen.getByRole("button", { name: "더보기" }))
    await user.click(await screen.findByRole("button", { name: "백업·복원·휴지통" }))
    const exportButton = await screen.findByRole("button", {
      name: /내 일지 데이터 내려받기/u,
      description: /메모 원문.*제외/u,
    })
    expect(exportButton).toBeVisible()

    await user.click(await screen.findByRole("button", { name: /메모 포함 파일 내보내기/u }))
    expect(await screen.findByRole("dialog", { name: "메모까지 포함할까요?" })).toBeVisible()
  })

  it("does not grant points merely for opening the app or its decoration menu", async () => {
    window.localStorage.clear()
    const user = userEvent.setup()
    render(<AppShell />)

    expect(screen.getByRole("heading", {
      name: "오늘 운동을 기록해요",
    })).toBeVisible()
    expect(screen.getByRole("button", { name: "오늘 기록 남기기" })).toBeVisible()
    expect(screen.getByRole("button", { name: "일지" })).toBeVisible()
    expect(screen.queryByRole("button", { name: "오늘 방문 확인 +1P" })).not.toBeInTheDocument()
    const learningMenu = screen.getByRole("button", { name: "일지 예시·훈련법·꾸미기" })
    expect(learningMenu).toHaveAttribute("aria-expanded", "false")
    expect(screen.getByRole("button", { name: "일지 꾸미기" })).not.toBeVisible()
    expect(screen.queryByLabelText(/오라클 포인트/u)).not.toBeInTheDocument()
    expect(window.localStorage.getItem("trainoracle.engagement.v1")).toBeNull()
    expect(window.localStorage.getItem(ENGAGEMENT_STORAGE_KEY)).toBeNull()
    await user.click(learningMenu)
    expect(screen.getByRole("button", { name: "일지 꾸미기" })).toBeVisible()
    expect(window.localStorage.getItem("trainoracle.engagement.v1")).toBeNull()
    expect(window.localStorage.getItem(ENGAGEMENT_STORAGE_KEY)).toBeNull()
  })
})
