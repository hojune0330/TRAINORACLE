import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { AppShell } from "./AppShell"

const STORAGE_KEY = "trainoracle.journal.v1"

afterEach(cleanup)

describe("AppShell journal archive navigation", () => {
  beforeEach(() => {
    window.localStorage.clear()
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([{
      id: "seed-session",
      kind: "post-session",
      date: "2026-07-24",
      savedAt: "2026-07-24T07:30:00.000Z",
      syncState: "local",
      system: "base",
      title: "아침 조깅",
      distanceKm: "5",
      durationMin: "30",
      avgPace: "6:00",
      rpe: 3,
      memo: "",
    }]))
  })

  it("Given a browsed past month, when a daily journal is opened and closed, then the archive keeps that month", async () => {
    const user = userEvent.setup()

    render(<AppShell />)

    const initialTitle = screen.getByRole("heading", { name: /년 \d+월 일지/u }).textContent
    await user.click(screen.getByRole("button", { name: "이전 달" }))
    const previousTitle = screen.getByRole("heading", { name: /년 \d+월 일지/u }).textContent
    expect(previousTitle).not.toBe(initialTitle)

    const dateButton = screen.getAllByRole("button", { name: /기록 없음 일지 열기/u }).at(0)
    expect(dateButton).toBeDefined()
    if (dateButton === undefined) return
    await user.click(dateButton)
    await user.click(screen.getByRole("button", { name: /뒤로/u }))

    expect(screen.getByRole("heading", { name: previousTitle ?? "" })).toBeVisible()
  })
})
