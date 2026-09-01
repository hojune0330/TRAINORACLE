import { cleanup, render, screen } from "@testing-library/react"
import { readFileSync } from "node:fs"
import { afterEach, describe, expect, it } from "vitest"
import { DailyContextTags } from "./DailyContextTags"

afterEach(cleanup)

const appCss = readFileSync("src/styles/app.css", "utf8")
const decorationStudioCss = readFileSync("src/styles/decoration-studio.css", "utf8")
const journalDecorationCss = readFileSync("src/styles/journal-decoration.css", "utf8")
const planBetaCss = readFileSync("src/styles/plan-beta.css", "utf8")
const mobileStyles = [
  appCss,
  decorationStudioCss,
  journalDecorationCss,
  readFileSync("src/styles/minji-showcase.css", "utf8"),
].join("\n")

describe("task 10 mobile accessibility contract", () => {
  it("keeps mood, body, and weather chips at the 44px touch minimum in every state", () => {
    // Given
    render(<DailyContextTags date="2026-08-04" />)

    // When
    const chips = screen.getAllByRole("button")

    // Then
    expect(chips).toHaveLength(11)
    expect(chips.every((chip) => chip.getAttribute("aria-pressed") === "false")).toBe(true)
    expect(appCss).toMatch(/\.daily-context__group button\s*\{[^}]*min-inline-size:\s*44px;[^}]*min-block-size:\s*44px;/u)
  })

  it("keeps the review dismissal control from shrinking below the touch minimum", () => {
    const dismissalRule = appCss.match(/\.saved-toast__heading button\s*\{[^}]*\}/u)?.[0] ?? ""

    expect(dismissalRule).toContain("width: var(--app-touch-min)")
    expect(dismissalRule).toContain("height: var(--app-touch-min)")
    expect(dismissalRule).toContain("flex: 0 0 var(--app-touch-min)")
  })

  it("keeps the home decoration entry control at the touch minimum", () => {
    const toggleRule = decorationStudioCss.match(/\.decoration-shop__header > button\s*\{[^}]*\}/u)?.[0] ?? ""

    expect(toggleRule).toContain("min-width: var(--app-touch-min)")
    expect(toggleRule).toContain("min-height: var(--app-touch-min)")
  })

  it("keeps legacy studio item layout out of every stylesheet after the editor merge", () => {
    /* 2026-09-01 통합: 홈 전용 꾸미기 편집 화면이 사라져 카달로그 카드 규칙도 함께 제거됐다. */
    expect(decorationStudioCss).not.toMatch(/\.decoration-shop__item\s*\{/u)
    expect(planBetaCss).not.toMatch(/\.decoration-shop__item\s*\{/u)
  })

  it("keeps dated journal previous and next controls wide enough at 320px", () => {
    const navigationRule = journalDecorationCss.match(/\.journal-reader-nav button\s*\{[^}]*\}/u)?.[0] ?? ""

    expect(navigationRule).toContain("min-width: var(--app-touch-min)")
  })

  it("keeps free-placement decorations from stealing taps over journal text", () => {
    /* P4 v3: 예약 레일 대신 자유 배치 레이어 — 읽기 화면에서는 레이어와
     * 읽기 전용 아이템이 pointer-events: none이라 본문 터치를 절대 가로채지 않는다. */
    const bodyRule = journalDecorationCss.match(/\.decorated-journal-page__body\s*\{[^}]*\}/u)?.[0] ?? ""
    const decorationRule = journalDecorationCss.match(/\.decorated-journal-page__avatar,[\s\S]*?\.decorated-journal-page__slot\s*\{[^}]*\}/u)?.[0] ?? ""
    const freeLayerRule = journalDecorationCss.match(/\.decorated-journal-page__free-layer\s*\{[^}]*\}/u)?.[0] ?? ""
    const readonlyRule = journalDecorationCss.match(/\.decorated-journal-page__free-item--readonly\s*\{[^}]*\}/u)?.[0] ?? ""

    expect(bodyRule).toContain("display: grid")
    expect(decorationRule).not.toContain("position: absolute")
    expect(decorationRule).toContain("pointer-events: none")
    expect(freeLayerRule).toContain("pointer-events: none")
    expect(readonlyRule).toContain("pointer-events: none")
  })

  it("removes animation and transition motion for reduced-motion users", () => {
    const reducedMotionRule = mobileStyles.match(/@media \(prefers-reduced-motion: reduce\)[\s\S]*?animation: none !important;[\s\S]*?transition: none !important;/u)?.[0] ?? ""

    // Then
    expect(reducedMotionRule).not.toBe("")
  })
})
