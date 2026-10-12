import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const compactTabsCss = readFileSync("src/styles/compact-tabs.css", "utf8")
const selectionSystemCss = readFileSync("src/styles/selection-system.css", "utf8")
const tokens = readFileSync("../colors_and_type.css", "utf8")
const main = readFileSync("src/main.tsx", "utf8")

const tabSurfaceContracts = [
  { path: "src/screens/JournalArchive.tsx", groupClass: "app-choice-group", buttonClass: "app-choice-control" },
  { path: "src/screens/TrainingLexicon.tsx", groupClass: "app-compact-tabs", buttonClass: "app-compact-tab" },
  { path: "src/screens/trends/CumulativeDistancePanel.tsx", groupClass: "app-compact-tabs", buttonClass: "app-compact-tab" },
  { path: "src/screens/trends/EnergySystemLedgerPanel.tsx", groupClass: "app-compact-tabs", buttonClass: "app-compact-tab" },
  { path: "src/screens/trends/MonthlyTrendSection.tsx", groupClass: "app-compact-tabs", buttonClass: "app-compact-tab" },
] as const

describe("compact tab density", () => {
  it("shrinks the persistent tab bar to the minimum touch-safe height", () => {
    expect(tokens).toContain("--app-tab-height: 44px")
    expect(main).toContain('import "./styles/compact-tabs.css"')
    expect(main).toContain('import "./styles/selection-system.css"')
  })

  it("uses the full touch target for a rounded readable selection face", () => {
    expect(compactTabsCss).toMatch(/\.app-compact-tab\s*\{[\s\S]*min-height:\s*var\(--app-touch-min\)\s*!important/u)
    expect(compactTabsCss).toMatch(/\.app-compact-tab::before\s*\{[\s\S]*inset:\s*0;/u)
    expect(compactTabsCss).toContain("border-radius: var(--r-action)")
    expect(compactTabsCss).toContain("font-size: var(--fs-body) !important")
    expect(compactTabsCss).not.toContain("white-space: nowrap")
    /* P4 v3 자유 배치로 슬롯 레일이 사라져 예시 일지가 짧아졌다 — 최대 스크롤
     * 위치에서 종이를 읽기 상단에 맞추려면 128px 여유가 필요하다. */
    expect(compactTabsCss).toContain("padding-bottom: calc(128px + env(safe-area-inset-bottom))")
    /* 2026-09-01 통합: 홈 꾸미기 편집 모달이 사라져 접힘 헤더 규칙도 함께 제거됐다. */
    expect(compactTabsCss).not.toContain(".decoration-shop--open")
    expect(selectionSystemCss).toMatch(/button\.app-choice-control\.app-choice-control\s*\{[^}]*min-height:\s*var\(--app-touch-min,\s*44px\)/u)
    expect(selectionSystemCss).toContain("border-radius: var(--r-action, 12px)")
    expect(selectionSystemCss).toContain("font-size: var(--fs-body)")
    expect(selectionSystemCss).toContain(".app-choice-control:focus-visible")
  })

  it("uses the explicitly approved shared selection pattern on every audited tab surface", () => {
    for (const { path, groupClass, buttonClass } of tabSurfaceContracts) {
      const source = readFileSync(path, "utf8")
      expect(source, path).toContain(groupClass)
      expect(source, path).toContain(buttonClass)
    }
    // The approved journal view uses the common choice controls instead of tabs.
    const journal = readFileSync("src/screens/JournalArchive.tsx", "utf8")
    expect(journal).toContain("app-choice-group")
    expect(journal).toContain("app-choice-control")
    expect(journal).toContain('aria-pressed={activeMode === "CALENDAR"}')
    expect(journal).toContain('aria-pressed={activeMode === "CYCLE"}')
  })

  it("does not apply the compact rule to answer controls", () => {
    const postSession = readFileSync("src/screens/log-entry/PostSessionForm.tsx", "utf8")
    const evening = readFileSync("src/screens/log-entry/EveningCheckin.tsx", "utf8")
    expect(postSession).not.toContain("app-compact-tab")
    expect(evening).not.toContain("app-compact-tab")
  })
})
