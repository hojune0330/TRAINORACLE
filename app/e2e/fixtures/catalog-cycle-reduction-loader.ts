import { buildSync } from "esbuild"
import { createRequire } from "node:module"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { basename, dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import type { PlanBetaStateV3 } from "../../src/domain/plan-beta-schema"
import type { JournalEntry } from "../../src/domain/journal-schema"

export function loadCatalogReductionFixture(): { state: PlanBetaStateV3; journals: JournalEntry[] } {
  const directory = mkdtempSync(join(tmpdir(), "trainoracle-cycle-fixture-"))
  const require = createRequire(import.meta.url)
  const { JSDOM } = require("jsdom")
  const dom = new JSDOM("", { url: "http://localhost" })
  const previous = new Map(["window", "localStorage", "sessionStorage"].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
  try {
    Object.defineProperties(globalThis, {
      window: { value: dom.window, configurable: true },
      localStorage: { value: dom.window.localStorage, configurable: true },
      sessionStorage: { value: dom.window.sessionStorage, configurable: true },
    })
    const output = join(directory, "fixture.cjs")
    buildSync({ entryPoints: [fileURLToPath(new URL("./catalog-cycle-reduction.ts", import.meta.url))],
      outfile: output, bundle: true, platform: "node", format: "cjs", logLevel: "silent",
      alias: { "@impl": fileURLToPath(new URL("../../../impl/src", import.meta.url)) },
      define: { "import.meta.env": "{}" } })
    return require(output).catalogReductionFixture()
  } finally {
    for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor)
      else Reflect.deleteProperty(globalThis, key)
    }
    dom.window.close()
    if (dirname(resolve(directory)) !== resolve(tmpdir()) || !basename(directory).startsWith("trainoracle-cycle-fixture-")) {
      throw Error("Unexpected fixture directory; cleanup refused")
    }
    rmSync(directory, { recursive: true, force: true })
  }
}
