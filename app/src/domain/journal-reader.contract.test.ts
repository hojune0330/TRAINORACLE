import { describe, expect, it } from "vitest"
import { projectJournalReader } from "./journal-reader"

const entries = [
  { id: "c", date: "2026-08-03" },
  { id: "a", date: "2026-07-29" },
  { id: "b", date: "2026-08-01" },
  { id: "b-2", date: "2026-08-01" },
]

describe("journal day reader", () => {
  it("orders unique journal days and exposes adjacent pages", () => {
    expect(projectJournalReader(entries, "2026-08-01")).toEqual({
      dates: ["2026-07-29", "2026-08-01", "2026-08-03"],
      currentIndex: 1,
      previousDate: "2026-07-29",
      nextDate: "2026-08-03",
      position: 2,
      total: 3,
    })
  })
})
