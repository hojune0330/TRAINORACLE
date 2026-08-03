import { describe, expect, it } from "vitest"
import { INITIAL_VIEW_STATE, viewForJournalReturn } from "./app-shell-state"

describe("app shell return state", () => {
  it("keeps the selected cycle window when returning from a journal draft", () => {
    const state = {
      ...INITIAL_VIEW_STATE,
      tab: "log" as const,
      journalMode: "CYCLE" as const,
      cycleAnchor: "2026-07-20",
      cycleIndex: 2,
      journalDraft: {
        date: "2026-08-08",
        returnTab: "journal" as const,
        archiveSelection: { selectedMonth: "2026-08", selectedWeekStart: "2026-08-03" },
      },
    }

    expect(viewForJournalReturn(state)).toMatchObject({
      tab: "journal",
      journalMode: "CYCLE",
      cycleAnchor: "2026-07-20",
      cycleIndex: 2,
    })
  })
})
