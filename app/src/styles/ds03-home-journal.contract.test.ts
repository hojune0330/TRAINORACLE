import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

describe("DS-03 home and journal presentation", () => {
  it("keeps the home and journal layouts compact and reflowable", () => {
    const appCss = readFileSync("src/styles/app.css", "utf8")
    const readerCss = readFileSync("src/styles/journal-reader.css", "utf8")
    const showcaseCss = readFileSync("src/styles/minji-showcase.css", "utf8")
    const welcomeRule = appCss.match(/\.training-home__welcome-fold\s*\{[^}]*\}/u)?.[0] ?? ""

    expect(welcomeRule).toContain("min-block-size: 0")
    expect(welcomeRule).not.toContain("100dvh")
    expect(appCss).toMatch(/\.training-home__example-preview\s*\{[^}]*min-height:\s*76px/u)
    expect(appCss).toMatch(/@media \(max-width:\s*360px\)[\s\S]*?\.device-journal__entry\s*\{[^}]*grid-template-columns:\s*20px minmax\(0, 1fr\)/u)
    expect(readerCss).toMatch(/@media \(max-width:\s*360px\)[\s\S]*?\.journal-entry-metrics\s*\{[^}]*repeat\(2, minmax\(0, 1fr\)\)/u)
    expect(showcaseCss).toMatch(/\.minji-index__stack button\s*\{[^}]*grid-template-columns:\s*54px minmax\(0, 1fr\) 34px 22px/u)
  })
})
