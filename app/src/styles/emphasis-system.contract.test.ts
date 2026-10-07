import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

describe("role based visual emphasis", () => {
  it("uses the root type tokens, stronger role specificity, wrapping, and a short non-text accent", () => {
    const tokens = readFileSync("../colors_and_type.css", "utf8")
    const css = readFileSync("src/styles/emphasis-system.css", "utf8")
    const main = readFileSync("src/main.tsx", "utf8")
    expect(tokens).toContain("--fs-app-title: 24px")
    expect(tokens).toContain("--fs-app-hero: clamp(26px, 6vw, 32px)")
    expect(tokens).toContain("--fw-app-heading: 700")
    expect(css).toContain(".app-heading.app-heading {")
    expect(css).toContain(".app-heading.app-heading--section { font-size: var(--fs-h3); }")
    expect(css).toContain("overflow-wrap: anywhere")
    expect(css).toContain('content: ""')
    expect(css).toContain("font-variant-numeric: tabular-nums")
    expect(main).toContain('import "./styles/emphasis-system.css"')
    expect(css).not.toMatch(/\.journal-paper|\.journal-page|!important|animation:|#[\da-f]{3,8}\b/iu)
  })

  it("keeps navigation distinct from the record action without large active fills or smaller labels", () => {
    const css = readFileSync("src/styles/app.css", "utf8")
    const active = css.match(/\.app-tab-bar__button\[data-active="true"\]\s*\{([^}]+)\}/u)?.[1]
    expect(active).toContain("color: var(--brand)")
    expect(active).not.toContain("background:")
    expect(css).toContain('.app-tab-bar__button[data-active="true"]::before')
    expect(css).toMatch(/\.app-tab-bar__button span\s*\{[^}]*font-size:\s*var\(--fs-caption\)/u)
    expect(css).toContain(".app-tab-bar__button:focus-visible")
  })

  it("applies the same title role to live plan questions without changing input or error styling", () => {
    const css = readFileSync("src/components/instant-plan/instant-plan-entry-steps.css", "utf8")
    const role = css.match(/\.instant-plan__step-heading\s*\{([^}]+)\}/u)?.[1]
    expect(role).toContain("font-size: var(--fs-app-title)")
    expect(role).toContain("font-weight: var(--fw-app-heading)")
    expect(css).toContain(".instant-plan__step-heading:focus-visible")
    expect(css).toContain("min-height: var(--app-touch-min)")
    const plan = readFileSync("src/screens/PlanBeta.tsx", "utf8")
    const layout = readFileSync("src/styles/plan-beta.css", "utf8")
    expect(plan).toContain('<div className="plan-instant-entry" hidden={recordsOpen || notationReaderOpen}>')
    expect(layout).toMatch(/\.plan-instant-entry\s*\{\s*padding:\s*var\(--space-4\) var\(--space-5\)/u)
  })
})
