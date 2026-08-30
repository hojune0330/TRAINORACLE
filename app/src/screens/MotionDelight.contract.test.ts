import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const appCss = readFileSync("src/styles/app.css", "utf8")
const studioCss = readFileSync("src/styles/decoration-studio.css", "utf8")
const journalCss = readFileSync("src/styles/journal-decoration.css", "utf8")

describe("decoration and oracle motion contract", () => {
  it("uses brief transform and opacity motion without continuous loops", () => {
    expect(appCss).toContain("oracle-insight-enter var(--dur-slow) var(--ease-out-strong) backwards")
    expect(appCss).toContain("oracle-evidence-enter var(--dur-base) var(--ease-out-strong) backwards")
    expect(studioCss).toContain("decoration-page-forward")
    expect(studioCss).toContain("decoration-page-backward")
    expect(studioCss).toContain("decoration-emoji-confirm var(--dur-slow) var(--ease-out-strong) both")
    expect(journalCss).toContain("journal-emoji-selected 480ms var(--ease-out-strong) both")

    const motionCss = `${appCss}\n${studioCss}\n${journalCss}`
    expect(motionCss).not.toMatch(/animation\s*:[^;]*\binfinite\b/iu)
    const keyframes = motionCss.match(
      /@keyframes (?:oracle|decoration|journal-emoji-selected)[^{]*\{[\s\S]*?^\}/gmu,
    ) ?? []
    expect(keyframes.length).toBeGreaterThanOrEqual(11)
    for (const keyframe of keyframes) {
      expect(keyframe).not.toMatch(/\b(?:width|height|top|left|right|bottom)\s*:/iu)
    }
  })

  it("keeps every new motion inside a reduced-motion fallback", () => {
    const appReduce = appCss.slice(appCss.indexOf("@media (prefers-reduced-motion: reduce)"))
    const studioReduce = studioCss.slice(studioCss.lastIndexOf("@media (prefers-reduced-motion: reduce)"))
    const journalReduce = journalCss.slice(journalCss.lastIndexOf("@media (prefers-reduced-motion: reduce)"))

    expect(appReduce).toContain(".trends-motion-stage > *")
    expect(appReduce).toContain("animation: none")
    expect(studioReduce).toContain("animation: none !important")
    expect(journalReduce).toContain(".journal-decoration-workspace--open > .decorated-journal-page")
    expect(journalReduce).toContain("animation: none !important")
  })

  it("preserves a stable workspace while tools animate over it", () => {
    expect(journalCss).toContain("animation: decoration-canvas-enter")
    expect(journalCss).toContain("transform: translateY(calc(100% + 72px))")
    expect(journalCss).toContain("visibility: hidden")
    expect(studioCss).toContain('data-motion-direction="FORWARD"')
    expect(studioCss).toContain('data-motion-direction="BACKWARD"')
  })
})
