import { cleanup, render, screen } from "@testing-library/react"
import { readFileSync } from "node:fs"
import { afterEach, describe, expect, it } from "vitest"
import { DailyContextTags } from "./DailyContextTags"

afterEach(cleanup)

const appCss = readFileSync("src/styles/app.css", "utf8")
const decorationStudioCss = readFileSync("src/styles/decoration-studio.css", "utf8")
const journalDecorationCss = readFileSync("src/styles/journal-decoration.css", "utf8")
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

  it("keeps the decoration studio icon-only close control at the touch minimum", () => {
    const toggleRule = decorationStudioCss.match(/\.decoration-shop__header > button\s*\{[^}]*\}/u)?.[0] ?? ""

    expect(toggleRule).toContain("min-width: var(--app-touch-min)")
    expect(toggleRule).toContain("min-height: var(--app-touch-min)")
  })

  it("keeps dated journal previous and next controls wide enough at 320px", () => {
    const navigationRule = journalDecorationCss.match(/\.journal-reader-nav button\s*\{[^}]*\}/u)?.[0] ?? ""

    expect(navigationRule).toContain("min-width: var(--app-touch-min)")
  })

  /*
   * 감사 2026-08-27 F1: 장식이 z-index 0 으로 콘텐츠(z-index 1) 뒤에 깔려
   * 구매·배치한 스티커가 실제 일지에서 전혀 보이지 않았다(elementFromPoint 실측).
   * 새 계약: 장식은 콘텐츠 위 레이어(z-index 2)에 스크랩북처럼 붙되,
   * pointer-events: none 으로 본문 상호작용은 절대 가로막지 않는다.
   * 가독성은 슬롯이 여백·모서리에만 놓이는 배치 규칙이 지킨다.
   */
  it("shows decoration layers above content without blocking interaction", () => {
    const contentRule = journalDecorationCss.match(/\.decorated-journal-page__content\s*\{[^}]*\}/u)?.[0] ?? ""
    const decorationRule = journalDecorationCss.match(/\.decorated-journal-page__avatar,[\s\S]*?\.decorated-journal-page__slot\s*\{[^}]*\}/u)?.[0] ?? ""

    // Then
    expect(contentRule).toContain("z-index: 1")
    expect(decorationRule).toContain("z-index: 2")
    expect(decorationRule).toContain("pointer-events: none")
  })

  it("removes animation and transition motion for reduced-motion users", () => {
    const reducedMotionRule = mobileStyles.match(/@media \(prefers-reduced-motion: reduce\)[\s\S]*?animation: none !important;[\s\S]*?transition: none !important;/u)?.[0] ?? ""

    // Then
    expect(reducedMotionRule).not.toBe("")
  })
})
