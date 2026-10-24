import { readFileSync } from "node:fs"
import { createElement } from "react"
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { ViewSwitcher } from "../components/ViewSwitcher"

afterEach(cleanup)

const compactTabsCss = readFileSync("src/styles/compact-tabs.css", "utf8")
const tokens = readFileSync("../colors_and_type.css", "utf8")
const main = readFileSync("src/main.tsx", "utf8")

const compactTabSurfaces = [
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
  })

  it("uses the audited tab surfaces and keeps the journal view switcher controlled", () => {
    for (const path of compactTabSurfaces) {
      const source = readFileSync(path, "utf8")
      expect(source, path).toContain("app-compact-tabs")
      expect(source, path).toContain("app-compact-tab")
    }
    // Journal destinations use the shell dock; its view mode keeps controlled radios.
    const journal = readFileSync("src/screens/JournalArchive.tsx", "utf8")
    expect(journal).toContain('useDomainNavigation({ domain: "journal", current: activeSection')
    expect(journal).not.toContain('aria-label="일지와 몸 기록"')
    const dock = readFileSync("src/components/DomainNavigation.tsx", "utf8")
    expect(dock).toContain('label: "일지", icon: BookOpen, category: "journal"')
    expect(dock).toContain('label: "몸 기록", icon: HeartPulse, category: "body"')
    expect(dock).toContain('aria-current={state.current === id ? "page" : undefined}')
    expect(journal).toMatch(/<ViewSwitcher\s+label="일지 보기 방식"\s+category="journal"\s+value=\{activeMode\}\s+onValueChange=\{changeMode\}/u)
    expect(journal).toContain('{ value: "CALENDAR", label: "달력", ariaLabel: "월간 달력", icon: CalendarDays }')
    expect(journal).toContain('{ value: "CYCLE", label: "묶음", ariaLabel: "기록 묶음", icon: Layers }')

    const changeMode = vi.fn()
    render(createElement(ViewSwitcher<"CALENDAR" | "CYCLE">, {
      label: "일지 보기 방식", category: "journal", value: "CYCLE", onValueChange: changeMode,
      options: [{ value: "CALENDAR", label: "월간 달력" }, { value: "CYCLE", label: "기록 묶음" }],
    }))
    const modes = screen.getByRole("radiogroup", { name: "일지 보기 방식" })
    const calendar = within(modes).getByRole("radio", { name: "월간 달력" })
    const cycle = within(modes).getByRole("radio", { name: "기록 묶음" })
    expect(calendar).toHaveAttribute("aria-checked", "false")
    expect(cycle).toHaveAttribute("aria-checked", "true")
    fireEvent.click(calendar)
    expect(changeMode).toHaveBeenCalledExactlyOnceWith("CALENDAR")
    expect(cycle).toHaveAttribute("aria-checked", "true")
    expect(within(modes).queryByRole("tab")).toBeNull()
  })

  it("does not apply the compact rule to answer controls", () => {
    const postSession = readFileSync("src/screens/log-entry/PostSessionForm.tsx", "utf8")
    const evening = readFileSync("src/screens/log-entry/EveningCheckin.tsx", "utf8")
    expect(postSession).not.toContain("app-compact-tab")
    expect(evening).not.toContain("app-compact-tab")
  })
})
