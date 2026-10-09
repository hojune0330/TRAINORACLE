import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
// @ts-expect-error plain .mjs build script without type declarations
import { productionPackages, renderNotices } from "../../scripts/generate-third-party-notices.mjs"

type Pkg = { name: string; version: string; license: string }
const committed = readFileSync("public/legal/third-party-notices.html", "utf8").replace(/\r\n/gu, "\n")

describe("app-wide open-source software notice", () => {
  it("is regenerated whenever production dependencies change", () => {
    expect(committed, "run: node scripts/generate-third-party-notices.mjs").toBe(renderNotices())
  })
  it("covers every production package, including transitive ones, and none of the dev tools", () => {
    const packages = productionPackages() as Pkg[]
    const names = packages.map(item => item.name)
    for (const name of ["react", "react-dom", "scheduler", "zod", "@supabase/supabase-js", "lucide-react", "shaders", "typegpu", "tsover-runtime", "tslib"]) {
      expect(names, name).toContain(name)
    }
    for (const dev of ["vite", "vitest", "typescript", "@playwright/test", "esbuild"]) expect(names, dev).not.toContain(dev)
    for (const item of packages) expect(committed, item.name).toContain(`<h2>${item.name} ${item.version}</h2>`)
  })
  it("ships a full license text for every package and only licenses that allow redistribution with notice", () => {
    const allowed = new Set(["MIT", "ISC", "0BSD", "BSD-2-Clause", "BSD-3-Clause", "Apache-2.0"])
    for (const item of productionPackages() as Pkg[]) expect(allowed.has(item.license), `${item.name}: ${item.license}`).toBe(true)
    expect(committed).not.toContain("라이선스 파일이 없어")
    expect(committed).toContain("Apache License")
    expect(committed).toContain("SIL OPEN FONT LICENSE")
  })
  it("is linked from More and from the game menu", () => {
    expect(readFileSync("src/screens/More.tsx", "utf8")).toContain("./legal/third-party-notices.html")
    expect(readFileSync("src/screens/treadmill/GamePanels.tsx", "utf8")).toContain("legal/third-party-notices.html")
  })
})
