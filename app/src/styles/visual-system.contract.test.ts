import { createHash } from "node:crypto"
import { readFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

const fontPath = "public/fonts/PretendardVariable.woff2"
const fontSha256 = "9599f12fd42fc0bce1cd50b47a0c022e108d7aa64dd0d1bb0ed44f3282d900b4"

function sourceFiles(root: string): readonly string[] {
  return readdirSync(root).flatMap((name) => {
    const path = join(root, name)
    if (statSync(path).isDirectory()) {
      return name === "testing" ? [] : sourceFiles(path)
    }
    return /\.(?:css|tsx)$/u.test(name) && !name.includes(".test.") ? [path] : []
  })
}

describe("shared visual system", () => {
  it("self-hosts one variable Korean interface font", () => {
    const indexHtml = readFileSync("index.html", "utf8")
    const tokens = readFileSync("../colors_and_type.css", "utf8")
    const legalCss = readFileSync("public/legal/legal.css", "utf8")
    const fontBytes = readFileSync(fontPath)

    expect(indexHtml).toContain('rel="preload" href="fonts/PretendardVariable.woff2"')
    expect(indexHtml).toContain('font-family: "Pretendard Variable"')
    expect(tokens).toContain('--sans: "Pretendard Variable"')
    expect(tokens).toContain('--mono: "Pretendard Variable"')
    expect(tokens).toContain("font-synthesis: none")
    expect(legalCss).toContain('src: url("../fonts/PretendardVariable.woff2")')
    expect(createHash("sha256").update(fontBytes).digest("hex")).toBe(fontSha256)
  })

  it("does not bring decorative left stripes or card shadows back", () => {
    const source = sourceFiles("src").map((path) => readFileSync(path, "utf8")).join("\n")
    const main = readFileSync("src/main.tsx", "utf8")
    const tokens = readFileSync("../colors_and_type.css", "utf8")
    const journalTokens = readFileSync("../colors_and_type_journal.css", "utf8")
    const importedCss = [source, tokens, journalTokens].join("\n")
    const cssShadows = [...importedCss.matchAll(/box-shadow\s*:\s*([^;]+);/giu)]
      .map((match) => match[1]!.trim().replace(/\s*!important$/u, ""))
      .filter((value) => value !== "none")
    const inlineShadows = [...source.matchAll(/boxShadow\s*:\s*["'`]([^"'`]+)["'`]/giu)]
      .map((match) => match[1]!.trim())
      .filter((value) => value !== "none")

    expect(source).not.toMatch(/border-left\s*:\s*[34]px\s+solid/iu)
    expect(source).not.toMatch(/borderLeft\s*:\s*["'`]\s*[34]px\s+solid/iu)
    expect(cssShadows).toEqual([])
    expect(inlineShadows).toEqual([])
    expect(source).not.toMatch(/filter\s*:\s*drop-shadow/iu)
    expect(tokens).toContain("--shadow-frame: none")
    expect(tokens).toContain("--shadow-subtle: none")
    expect(journalTokens).toMatch(/\.tape\s*\{[\s\S]*?box-shadow:\s*none/u)
    expect(main).toContain('import "../../colors_and_type.css"')
    expect(main).toContain('import "../../colors_and_type_journal.css"')
  })

  it("keeps Korean labels out of platform-dependent cursive fallbacks", () => {
    const source = sourceFiles("src").map((path) => readFileSync(path, "utf8")).join("\n")
    const journalTokens = readFileSync("../colors_and_type_journal.css", "utf8")

    expect(source).not.toMatch(/Caveat|Gowun Dodum|Segoe Print|Nanum Pen Script|cursive/iu)
    expect(journalTokens).not.toMatch(/Segoe Print|Nanum Pen Script|cursive/iu)
  })

  it("keeps the audited new surfaces free from inline presentation styles", () => {
    const guardedSurfaces = [
      "src/screens/TrainingContent.tsx",
      "src/screens/trends/PersonalOraclePanel.tsx",
      "src/screens/account/PlanCloudBackupNotice.tsx",
    ]

    for (const path of guardedSurfaces) {
      expect(readFileSync(path, "utf8"), path).not.toMatch(/\sstyle=/u)
    }
  })

  it("maps the audited DS-01 colors to defined semantic tokens", () => {
    const tokens = readFileSync("../colors_and_type.css", "utf8")
    const auditedCss = [
      "src/styles/app.css",
      "src/styles/plan-beta.css",
      "src/styles/training-content.css",
      "src/styles/training-lexicon.css",
    ].map((path) => readFileSync(path, "utf8")).join("\n")
    const legacyAliases = ["--accent", "--line-dark", "--accent-ink"] as const
    const semanticTokens = ["--brand", "--line-2", "--brand-ink"] as const
    const unresolved = (tokenSource: string) => semanticTokens.filter((token) => (
      auditedCss.includes(`var(${token})`) && !new RegExp(`${token}\\s*:`).test(tokenSource)
    ))

    for (const alias of legacyAliases) expect(auditedCss).not.toContain(`var(${alias})`)
    expect(unresolved(tokens)).toEqual([])

    const tokensWithoutBrand = tokens.replace(/^\s*--brand:\s*[^;]+;/mu, "")
    expect(unresolved(tokensWithoutBrand)).toContain("--brand")
  })

  it("keeps plan legends touch-safe, two-column at phone widths, and reflowable under zoom", () => {
    const planCss = readFileSync("src/styles/plan-beta.css", "utf8")
    const accountCss = readFileSync("src/screens/plan-beta/AccountPlanStorage.css", "utf8")

    expect(planCss).toMatch(/\.plan-training-flow__legend\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/u)
    expect(planCss).toMatch(/\.plan-training-flow__legend li\s*\{[\s\S]*?min-height:\s*var\(--app-touch-min\)/u)
    expect(planCss).toMatch(/@media \(max-width:\s*280px\)[\s\S]*?\.plan-training-flow__legend\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1fr\)/u)
    expect(accountCss).not.toContain(".plan-training-flow__legend")
  })

  it("keeps receipt toasts clear of decoration controls without suppressing review alerts", () => {
    const appCss = readFileSync("src/styles/app.css", "utf8")
    const tokens = readFileSync("../colors_and_type.css", "utf8")

    expect(tokens).toMatch(/--z-toast:\s*200/u)
    expect(appCss).toContain('.saved-toast[data-toast-priority="receipt"]')
    expect(appCss).toContain('.journal-decoration-toolbar[data-open="true"]')
    expect(appCss).toContain("min(44dvh, 380px)")
    expect(appCss).toMatch(/\.saved-toast\[data-toast-priority="review"\]\s*\{[\s\S]*?top:\s*calc\(58px[^;]+;[\s\S]*?bottom:\s*auto/u)
    expect(appCss).not.toMatch(/\.saved-toast\[data-toast-priority="review"\][^{]*\{[^}]*display:\s*none/u)
  })

  it("uses readable semantic type tokens for DS-01 status and explanation text", () => {
    const appCss = readFileSync("src/styles/app.css", "utf8")
    const planCss = readFileSync("src/styles/plan-beta.css", "utf8")
    const contentCss = readFileSync("src/styles/training-content.css", "utf8")
    const lexiconCss = readFileSync("src/styles/training-lexicon.css", "utf8")

    expect(appCss).toMatch(/\.personal-oracle__status\s*\{[\s\S]*?font-size:\s*var\(--fs-caption\)/u)
    expect(planCss).not.toContain("font-size: 8.5px")
    expect(contentCss).toMatch(/\.training-content-reward-note\s*\{[\s\S]*?font-size:\s*var\(--fs-caption\)/u)
    expect(lexiconCss).toMatch(/\.term-help__more\s*\{[^}]*min-height:\s*var\(--app-touch-min\)/u)
  })
})
