import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const compactTabsCss = readFileSync("src/styles/compact-tabs.css", "utf8")
const tokens = readFileSync("../colors_and_type.css", "utf8")
const main = readFileSync("src/main.tsx", "utf8")

const compactTabSurfaces = [
  "src/screens/JournalArchive.tsx",
  "src/screens/TrainingLexicon.tsx",
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
    /* P4 v3 자유 배치로 슬롯 레일이 사라져 예시 일지가 짧아졌다 — 최대 스크롤
     * 위치에서 종이를 읽기 상단에 맞추려면 128px 여유가 필요하다. */
    expect(compactTabsCss).toContain("padding-bottom: calc(128px + env(safe-area-inset-bottom))")
    /* 2026-09-01 통합: 홈 꾸미기 편집 모달이 사라져 접힘 헤더 규칙도 함께 제거됐다. */
    expect(compactTabsCss).not.toContain(".decoration-shop--open")
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
