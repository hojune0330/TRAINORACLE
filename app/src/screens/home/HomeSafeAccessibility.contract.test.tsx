import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { JournalEntry } from "../../domain/journal-store"
import { Home } from "../Home"

const STORAGE_KEY = "trainoracle.journal.v1"

const RECENT_ENTRY = {
  id: "recent-session",
  kind: "post-session",
  date: "2026-07-14",
  savedAt: "2026-07-14T08:00:00.000Z",
  syncState: "local",
  system: "lt",
  title: "시드 템포런",
  distanceKm: "8",
  durationMin: "40",
  avgPace: "5:00",
  rpe: 6,
  memo: "비공개 원문",
  memoPurpose: "PRIVATE_SELF_ONLY",
} satisfies JournalEntry

afterEach(cleanup)

describe("home journal controls", () => {
  beforeEach(() => {
    window.localStorage.clear()
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([RECENT_ENTRY]))
  })

  it("opens a recent journal entry through a semantic labeled button", async () => {
    // Given
    const user = userEvent.setup()
    const onOpenDay = vi.fn()
    render(<Home onOpenDay={onOpenDay} />)
    const recentEntry = screen.getByRole("button", { name: /훈련 후.*시드 템포런.*상세/u })

    // When
    await user.click(recentEntry)

    // Then
    expect(onOpenDay).toHaveBeenCalledWith("2026-07-14")
  })

  it("describes the default export as excluding raw note text", () => {
    // Given
    render(<Home />)

    // When
    const exportButton = screen.getByRole("button", {
      name: /내 일지 데이터 내려받기/u,
      description: /메모 원문.*제외/u,
    })

    // Then
    expect(exportButton).toBeVisible()
  })
})
