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
    const tokens = readFileSync("../colors_and_type.css", "utf8")
    const cssShadows = [...source.matchAll(/box-shadow\s*:\s*([^;]+);/giu)]
      .map((match) => match[1]!.trim().replace(/\s*!important$/u, ""))
      .filter((value) => value !== "none")
    const inlineShadows = [...source.matchAll(/boxShadow\s*:\s*["'`]([^"'`]+)["'`]/giu)]
      .map((match) => match[1]!.trim())
      .filter((value) => value !== "none")

    expect(source).not.toMatch(/border-left\s*:\s*[34]px\s+solid/iu)
    expect(source).not.toMatch(/borderLeft\s*:\s*["'`]\s*[34]px\s+solid/iu)
    expect(cssShadows).toEqual([])
    expect(inlineShadows).toEqual([])
    expect(tokens).toContain("--shadow-frame: none")
    expect(tokens).toContain("--shadow-subtle: none")
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
})
