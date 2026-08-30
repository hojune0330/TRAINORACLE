import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const compactTabsCss = readFileSync("src/styles/compact-tabs.css", "utf8")
const tokens = readFileSync("../colors_and_type.css", "utf8")
const main = readFileSync("src/main.tsx", "utf8")

const compactTabSurfaces = [
  "src/screens/JournalArchive.tsx",
  "src/screens/TrainingLexicon.tsx",
  "src/screens/home/DecorationStudio.tsx",
  "src/screens/trends/CumulativeDistancePanel.tsx",
  "src/screens/trends/EnergySystemLedgerPanel.tsx",
  "src/screens/trends/MonthlyTrendSection.tsx",
] as const

describe("compact tab density", () => {
  it("shrinks the persistent tab bar to the minimum touch-safe height", () => {
    expect(tokens).toContain("--app-tab-height: 44px")
    expect(main).toContain('import "./styles/compact-tabs.css"')
  })

  it("keeps a 44px target around a 32px visible tab face", () => {
    expect(compactTabsCss).toMatch(/\.app-compact-tab\s*\{[\s\S]*min-height:\s*var\(--app-touch-min\)\s*!important/u)
    expect(compactTabsCss).toMatch(/\.app-compact-tab::before\s*\{[\s\S]*inset:\s*6px 0/u)
    expect(compactTabsCss).toContain("padding-bottom: calc(64px + env(safe-area-inset-bottom))")
    expect(compactTabsCss).toMatch(/\.decoration-shop--open \.decoration-shop__header\.decoration-shop__header--collapsed\s*\{[\s\S]*max-height:\s*0/u)
  })

  it("uses the shared density rule on every audited tab surface", () => {
    for (const path of compactTabSurfaces) {
      const source = readFileSync(path, "utf8")
      expect(source, path).toContain("app-compact-tabs")
      expect(source, path).toContain("app-compact-tab")
    }
  })

  it("does not apply the compact rule to answer controls", () => {
    const postSession = readFileSync("src/screens/log-entry/PostSessionForm.tsx", "utf8")
    const evening = readFileSync("src/screens/log-entry/EveningCheckin.tsx", "utf8")
    expect(postSession).not.toContain("app-compact-tab")
    expect(evening).not.toContain("app-compact-tab")
  })
})
