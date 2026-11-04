import { readFileSync } from "node:fs"
import { createHash } from "node:crypto"
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
  it("ships full license text and admits only the declared licenses or the exact FIT SDK license reviewed for integration", () => {
    const allowed = new Set(["MIT", "ISC", "0BSD", "BSD-2-Clause", "BSD-3-Clause", "Apache-2.0"])
    for (const item of productionPackages() as Pkg[]) {
      if (item.name === "@garmin/fitsdk") {
        // This is Garmin's custom FIT Protocol License, not an SPDX open-source license.
        // Garmin documents use in compatible browsers. A different version or license
        // must be reviewed again; arbitrary SEE LICENSE packages are not admitted.
        expect(item.version).toBe("21.221.0")
        expect(item.license).toBe("SEE LICENSE IN LICENSE.txt")
        const license = readFileSync("node_modules/@garmin/fitsdk/LICENSE.txt")
        expect(createHash("sha256").update(license).digest("hex"))
          .toBe("6cc7ff94b5afc8c3a2b14aeb3e90da97a9fb6c8d40644304da94df5cf56428cf")
        expect(committed).toContain("FIT Protocol License Agreement")
      } else {
        expect(allowed.has(item.license), `${item.name}: ${item.license}`).toBe(true)
      }
    }
    expect(committed).not.toContain("라이선스 파일이 없어")
    expect(committed).toContain("Apache License")
    expect(committed).toContain("SIL OPEN FONT LICENSE")
    expect(committed).toContain("개별 사용 조건이 있는 소프트웨어")
  })
  it("is linked from More and from the game menu", () => {
    expect(readFileSync("src/screens/More.tsx", "utf8")).toContain("./legal/third-party-notices.html")
    expect(readFileSync("src/screens/treadmill/GamePanels.tsx", "utf8")).toContain("legal/third-party-notices.html")
  })
  it("retains pinned source provenance and the full MIT terms for adapted UI", () => {
    const sources = JSON.parse(readFileSync("scripts/ui-source-attributions.json", "utf8"))
    expect(sources).toHaveLength(2)
    for (const item of sources) {
      expect(item.version).toMatch(/^[a-f0-9]{40}$/u)
      expect(committed).toContain(item.version)
      expect(committed).toContain(item.name)
      expect(item.text).toContain("Permission is hereby granted, free of charge")
      expect(item.text).toContain("Copyright (c)")
    }
    expect(productionPackages().some((item: Pkg) => item.name === "@radix-ui/react-radio-group" && item.version === "1.5.1")).toBe(true)
  })
})
