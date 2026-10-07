import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import {
  createEmptyDecorationState,
  decorationStateSchema,
  loadDecorationState,
  saveDecorationState,
} from "../domain/decorations"
import type { JournalEntry } from "../domain/journal-schema"
import { LogDetail } from "./LogDetail"

afterEach(() => { cleanup(); localStorage.clear(); vi.restoreAllMocks() })

const date = "2026-09-27"
const entry: JournalEntry = {
  id: "reader-session",
  kind: "post-session",
  date,
  savedAt: date + "T02:00:00Z",
  syncState: "local",
  system: "base",
  title: "조깅",
  memo: "기록 원문",
  distanceKm: "8",
  durationMin: "40",
  avgPace: "",
  rpe: 0,
}

describe("journal reader chrome", () => {
  it("keeps the reader background plain while retaining the saved theme and placement", () => {
    const base = createEmptyDecorationState()
    const state = decorationStateSchema.parse({
      ...base,
      ownedItemIds: [...base.ownedItemIds, "THEME_SKY_JOURNAL", "STICKER_FINISH_LINE"],
      spentPoints: 40,
      equipped: { ...base.equipped, themeId: "THEME_SKY_JOURNAL" },
      pages: [{
        date,
        items: [{
          itemId: "STICKER_FINISH_LINE",
          transform: { xPercent: 18, yPercent: 28, scale: 1, rotationDeg: 0 },
        }],
      }],
    })
    expect(saveDecorationState(state).ok).toBe(true)
    const savedBeforeRender = loadDecorationState()
    const { container } = render(<LogDetail date={date} entries={[entry]} readOnly />)

    const chrome = container.querySelector(".journal-detail-page--reader")
    const page = container.querySelector(".decorated-journal-page")
    expect(chrome).not.toBeNull()
    expect(chrome).not.toHaveClass("paper-grid")
    expect(page).toHaveAttribute("data-theme-id", "THEME_SKY_JOURNAL")
    expect(screen.getByTestId("journal-decoration-item-0")).toBeInTheDocument()
    expect(loadDecorationState()).toEqual(savedBeforeRender)
  })
})
