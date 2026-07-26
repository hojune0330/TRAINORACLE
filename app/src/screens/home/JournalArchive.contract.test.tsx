import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { JournalEntry } from "../../domain/journal-store"
import { JournalArchive } from "./JournalArchive"

const entries: readonly JournalEntry[] = [
  {
    id: "session",
    kind: "post-session",
    date: "2026-07-24",
    savedAt: "2026-07-24T07:30:00.000Z",
    syncState: "local",
    system: "lt",
    title: "시드 템포런",
    distanceKm: "8",
    durationMin: "40",
    avgPace: "5:00",
    rpe: 6,
    memo: "OWNER_SECRET_TEXT",
    memoPurpose: "PRIVATE_SELF_ONLY",
  },
  {
    id: "evening",
    kind: "evening",
    date: "2026-07-24",
    savedAt: "2026-07-24T20:30:00.000Z",
    syncState: "local",
    sleepH: 7,
    sleepQuality: 4,
    weightKg: "",
    restingHr: "",
    painParts: { calf: 2 },
    mood: 4,
    note: "OWNER_SECRET_TEXT",
    memoPurpose: "PRIVATE_SELF_ONLY",
  },
]

afterEach(cleanup)

describe("JournalArchive", () => {
  it("Given local journal data, when opened, then it scans a month without exposing private text", async () => {
    const user = userEvent.setup()
    const onOpenDay = vi.fn()

    render(<JournalArchive entries={entries} initialDate="2026-07-24" onOpenDay={onOpenDay} />)

    expect(screen.getByRole("heading", { name: "2026년 7월 일지" })).toBeVisible()
    expect(screen.getByRole("button", { name: /7월 24일.*2건 기록/u })).toBeVisible()
    expect(screen.getByText("2건", { exact: true })).toBeVisible()
    expect(screen.queryByText("40분 · 8km")).toBeNull()
    expect(screen.queryByText("OWNER_SECRET_TEXT")).toBeNull()

    await user.click(screen.getByRole("button", { name: "주간 보기" }))

    expect(screen.getByRole("heading", { name: "7월 20일 - 7월 26일" })).toBeVisible()
    expect(screen.getByText("1일 · 2건 · 40분 · 8km")).toBeVisible()
    expect(screen.getByText("7/24 금")).toBeVisible()
    expect(screen.getByText("통증 2/5")).toBeVisible()
    expect(screen.getByText("40분 · 8km")).toBeVisible()
    await user.click(screen.getByRole("button", { name: /7월 24일.*일지 열기/u }))
    expect(onOpenDay).toHaveBeenCalledWith("2026-07-24")
  })

  it("Given a selected week, when moved forward, then it advances by exactly seven calendar days", async () => {
    const user = userEvent.setup()

    render(<JournalArchive entries={entries} initialDate="2026-07-24" />)

    await user.click(screen.getByRole("button", { name: "주간 보기" }))
    await user.click(screen.getByRole("button", { name: "다음 주" }))

    expect(screen.getByRole("heading", { name: "7월 27일 - 8월 2일" })).toBeVisible()
  })

  it("Given a browsed month, when switched to weekly view, then it opens a week from that month", async () => {
    const user = userEvent.setup()

    render(<JournalArchive entries={entries} initialDate="2026-07-24" />)

    await user.click(screen.getByRole("button", { name: "이전 달" }))
    await user.click(screen.getByRole("button", { name: "주간 보기" }))

    expect(screen.getByText("6월 1일 - 6월 7일")).toBeVisible()
  })
})
