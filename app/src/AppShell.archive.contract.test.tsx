import React from "react"
import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { AppShell } from "./AppShell"
import type { JournalEntry } from "./domain/journal-schema"

const STORAGE_KEY = "trainoracle.journal.v1"

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
    window.localStorage.clear()
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([ENTRY]))
  })

  it("returns from a day detail to the same selected week", async () => {
    const user = userEvent.setup()
    render(<AppShell />)

    await user.click(screen.getByRole("button", { name: "전체 보기" }))
    await user.click(screen.getByRole("button", { name: /2026년 7월/u }))
    await user.click(screen.getByRole("button", { name: /7월 6일.*7월 12일/u }))
    await user.click(screen.getByRole("button", { name: /2026년 7월 10일/u }))

    expect(screen.getByText("아카이브 복귀 훈련")).toBeVisible()
    await user.click(screen.getByRole("button", { name: "← 뒤로" }))

    expect(screen.getByRole("heading", { name: "7월 6일–12일" })).toBeVisible()
    expect(screen.getByRole("button", { name: /2026년 7월 10일/u })).toBeVisible()
  })

  it("keeps the easy FAQ one tap away after journal history has accumulated", async () => {
    const user = userEvent.setup()
    render(<AppShell />)

    await user.click(screen.getByRole("button", { name: "도움" }))

    expect(screen.getByRole("heading", { name: "궁금한 점을 쉽게 풀어드려요" })).toBeVisible()
  })

  it("does not grant points merely for opening the app", () => {
    window.localStorage.clear()
    render(<AppShell />)

    expect(screen.getByLabelText("오라클 포인트 0점")).toBeVisible()
    expect(window.localStorage.getItem("trainoracle.engagement.v1")).toBeNull()
  })
})
