import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

describe("standalone instant plan gutter", () => {
  const css = readFileSync("src/styles/app.css", "utf8")
  const selector = ".app-flow-stage > .account-plan-runtime:has(> .instant-plan)"

  it("insets the full plan flow without padding embedded Home or legacy readers", () => {
    const rule = css.slice(css.indexOf(selector), css.indexOf("}", css.indexOf(selector)) + 1)
    expect(rule).toContain("padding: var(--space-5)")
    expect(rule).toContain("box-sizing: border-box")
    expect(rule).toContain("min-width: 0")
    expect(css).not.toMatch(/\.account-plan-runtime\s*\{[^}]*padding:/u)
  })

  it("keeps a real gutter on narrow screens without reducing font or touch sizes", () => {
    const narrowRule = css.match(/@media \(max-width: 380px\)\s*\{\s*\.app-flow-stage > \.account-plan-runtime:has\(> \.instant-plan\)\s*\{([^}]*)\}/u)?.[1]
    expect(narrowRule).toContain("padding: var(--space-4)")
    expect(narrowRule).not.toMatch(/font-size|min-height|transform/u)
  })
})
