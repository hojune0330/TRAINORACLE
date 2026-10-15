import React from "react"
import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import { AppShell } from "./AppShell"
import { ENGAGEMENT_STORAGE_KEY } from "./domain/engagement"
import type { JournalEntry } from "./domain/journal-schema"
import { setActiveLocalAccount } from "./domain/account/local-journal-ownership"
import { JOURNAL_STORAGE_KEY } from "./domain/journal-storage-keys"
import { registerUnsavedDraftGuard } from "./domain/unsaved-draft-navigation"
import { initializeCanonicalJournalFixture } from "./test/canonical-journal-fixture"

const STORAGE_KEY = JOURNAL_STORAGE_KEY

// Transform the lazy archive outside the interaction timeout, as in navigation contracts.
beforeAll(async () => {
  await Promise.all([import("./screens/JournalArchive"), import("./screens/Trends")])
}, 60000)

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

afterEach(() => { cleanup(); vi.restoreAllMocks() })

describe("AppShell journal archive routing", () => {
  beforeEach(async () => {
    setActiveLocalAccount("test-reset"); setActiveLocalAccount(null)
    window.localStorage.clear()
    await initializeCanonicalJournalFixture()
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

    await user.click(within(screen.getByRole("navigation", { name: "주 탭" })).getByRole("button", { name: "일지" }))
    await user.click(await screen.findByRole("button", { name: /^2026년 7월 훈련 후/u }))
    await user.click(within(screen.getByRole("navigation", { name: "주 탭" })).getByRole("button", { name: "일지" }))

    expect(await screen.findByRole("heading", { name: "2026년 7월", level: 1 })).toBeVisible()
    expect(screen.getByRole("grid", { name: "2026년 7월 달력" })).toBeVisible()
  })

  it("retries a calendar read in place and keeps the month being viewed", async () => {
    const user = userEvent.setup()
    render(<AppShell />)
    await user.click(screen.getByRole("button", { name: "일지" }))
    await user.click(await screen.findByRole("button", { name: /^2026년 7월 훈련 후/u }))
    const read = Storage.prototype.getItem
    let unavailable = true
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(function(this: Storage, key: string) {
      if (key === STORAGE_KEY && unavailable) throw new Error("synthetic read failure")
      return read.call(this, key)
    })
    act(() => window.dispatchEvent(new Event("focus")))
    const retry = await screen.findByRole("button", { name: "일지 다시 불러오기" })
    unavailable = false
    await user.click(retry)
    expect(await screen.findByRole("heading", { name: "2026년 7월", level: 1 })).toBeVisible()
    expect(screen.getByRole("button", { name: /2026년 7월 10일/u })).toBeVisible()
    expect(screen.queryByRole("button", { name: "일지 다시 불러오기" })).toBeNull()
  })

  it("returns a Minji example opened from home back to home", async () => {
    window.localStorage.clear()
    await initializeCanonicalJournalFixture()
    const user = userEvent.setup()
    render(<AppShell />)

    await user.click(screen.getByRole("button", { name: "일지 예시 보기" }))
    await user.click(await screen.findByRole("button", { name: /돌아가기/u }))

    expect(screen.getByRole("heading", {
      name: "운동 분석과 훈련 계획",
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
    await initializeCanonicalJournalFixture()
    const user = userEvent.setup()
    render(<AppShell />)

    await user.click(screen.getByRole("button", { name: "일지" }))
    const calendar = await screen.findByRole("grid")
    const selectedDate = calendar.querySelector<HTMLButtonElement>('button[data-selected="true"]')
    expect(selectedDate).not.toBeNull()
    await user.click(selectedDate!)
    await user.click(await screen.findByRole("button", { name: "이날 일지 쓰기" }))

    expect(await screen.findByRole("heading", { name: "무엇을 기록할까요?" })).toBeVisible()
  })

  it("starts a journal from the empty analysis screen", async () => {
    window.localStorage.clear()
    await initializeCanonicalJournalFixture()
    const user = userEvent.setup()
    render(<AppShell />)

    await user.click(screen.getByRole("button", { name: "오라클" }))
    expect(await screen.findByRole("heading", { name: "오라클" })).toBeVisible()
    await user.click(screen.getByRole("button", { name: "운동 기록 쓰기" }))

    expect(await screen.findByRole("heading", { name: "무엇을 기록할까요?" })).toBeVisible()
  })

  it("keeps the easy FAQ reachable through More's training section", async () => {
    const user = userEvent.setup()
    render(<AppShell />)

    await user.click(screen.getByRole("button", { name: "더보기" }))
    expect(await screen.findByRole("heading", { name: "배우기" })).toBeVisible()
    await user.click(await screen.findByRole("button", { name: "훈련 용어집·도움말" }))
    expect(await screen.findByRole("heading", { name: "훈련 용어집" })).toBeVisible()
    await user.click(await screen.findByRole("button", { name: "앱 이용 안내" }))

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
    await initializeCanonicalJournalFixture()
    const user = userEvent.setup()
    render(<AppShell />)

    expect(screen.getByRole("heading", {
      name: "운동 분석과 훈련 계획",
    })).toBeVisible()
    expect(screen.getByRole("button", { name: "오늘 운동 기록 쓰기" })).toBeVisible()
    expect(screen.getByRole("button", { name: "일지" })).toBeVisible()
    expect(screen.queryByRole("button", { name: "오늘 방문 확인 +1P" })).not.toBeInTheDocument()
    const decorate = screen.getByRole("button", { name: "일지 꾸미기" })
    expect(decorate).toBeVisible()
    expect(decorate.closest("details")).toBeNull()
    expect(screen.queryByLabelText(/오라클 포인트/u)).not.toBeInTheDocument()
    expect(window.localStorage.getItem("trainoracle.engagement.v1")).toBeNull()
    expect(window.localStorage.getItem(ENGAGEMENT_STORAGE_KEY)).toBeNull()
    await user.click(decorate)
    expect(await screen.findByRole("dialog", { name: "일지 꾸미기" })).toBeVisible()
    expect(window.localStorage.getItem("trainoracle.engagement.v1")).toBeNull()
    expect(window.localStorage.getItem(ENGAGEMENT_STORAGE_KEY)).toBeNull()
  })
})
