import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

describe("DS-04 reading layouts", () => {
  it("uses defined tokens and readable boundaries in training content", () => {
    const css = readFileSync("src/styles/training-content.css", "utf8")

    expect(css).not.toContain("--bw-section")
    expect(css).not.toContain("--fs-title-sm")
    expect(css).not.toContain("font-size: 9.5px")
    expect(css).toMatch(/\.training-content-article\s*\{[^}]*width:\s*min\(100%,\s*680px\)/u)
    expect(css).toMatch(/\.training-content-article__compatibility-boundary\s*\{[^}]*font-size:\s*var\(--fs-caption\)/u)
    expect(css).toMatch(/\.training-content-article__source\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s*auto/u)
    expect(css).toMatch(/\.training-content-article__compatibility details summary\s*\{[^}]*min-height:\s*var\(--app-touch-min\)/u)
  })

  it("keeps the lexicon detail narrower than the index and long Korean copy reflowable", () => {
    const css = readFileSync("src/styles/training-lexicon.css", "utf8")

    expect(css).toMatch(/\.training-lexicon__index\s*\{[^}]*width:\s*min\(100%,\s*760px\)/u)
    expect(css).toMatch(/\.training-term\s*\{[^}]*width:\s*min\(100%,\s*680px\)/u)
    expect(css).toMatch(/\.training-term__section li\s*\{[^}]*max-width:\s*68ch[^}]*font-size:\s*var\(--fs-body\)[^}]*word-break:\s*keep-all/u)
    expect(css).toMatch(/\.training-lexicon__tools select\s*\{[^}]*font:\s*400\s+var\(--fs-body-lg\)/u)
  })
})
