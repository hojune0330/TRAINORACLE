import { describe, expect, it } from "vitest"
import { MINJI_JOURNAL_PAGES } from "./minji-journal-data"

describe("Minji journal showcase data", () => {
  it("provides six dated read-only pages with complete, distinct decoration presets", () => {
    expect(MINJI_JOURNAL_PAGES).toHaveLength(6)
    expect(new Set(MINJI_JOURNAL_PAGES.map((page) => page.date)).size).toBe(6)

    for (const page of MINJI_JOURNAL_PAGES) {
      expect(page.date).toMatch(/^\d{4}-\d{2}-\d{2}$/u)
      expect(page.mood).not.toHaveLength(0)
      expect(page.bodyCondition).not.toHaveLength(0)
      expect(page.weather).not.toHaveLength(0)
      expect(page.decorationPreset.name).not.toHaveLength(0)
      expect(page.decorationPreset.placements).not.toHaveLength(0)
      expect(new Set(page.decorationPreset.placements.map((placement) => placement.slot)).size)
        .toBe(page.decorationPreset.placements.length)
    }
  })

  it("starts with a gentle thirty-minute example, never the old forty-minute session", () => {
    const firstPage = MINJI_JOURNAL_PAGES[0]

    expect(firstPage?.facts).toContain("시간 30분")
    expect(firstPage?.facts).not.toContain("시간 40분")
  })
})
