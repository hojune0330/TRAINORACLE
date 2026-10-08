import { existsSync, readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { LICENSES } from "./GamePanels"

type LockPackage = { version: string; license?: string; dependencies?: Record<string, string> }
const lock = JSON.parse(readFileSync("package-lock.json", "utf8")) as { packages: Record<string, LockPackage> }
const PACKAGE: Record<string, string> = { shaders: "shaders", TypeGPU: "typegpu", tinyest: "tinyest", "typed-binary": "typed-binary", "tsover-runtime": "tsover-runtime", Lucide: "lucide-react" }

/** Every package the lazy shader chunk pulls in, read from the lockfile, so a new transitive dependency fails here. */
function runtimeTree(root: string): string[] {
  const seen = new Set<string>()
  const visit = (name: string) => {
    if (seen.has(name)) return
    seen.add(name)
    for (const dep of Object.keys(lock.packages[`node_modules/${name}`]?.dependencies ?? {})) visit(dep)
  }
  visit(root)
  return [...seen].sort()
}

describe("in-game open-source notice", () => {
  it("names the exact installed version and license of every listed package", () => {
    for (const item of LICENSES) {
      const name = PACKAGE[item.name]
      if (!name) continue
      const installed = lock.packages[`node_modules/${name}`]
      expect(installed, name).toBeDefined()
      expect(item.version, name).toBe(installed!.version)
      expect(item.license, name).toBe(installed!.license)
    }
  })
  it("covers the whole shaders runtime tree, including transitive packages", () => {
    const listed = new Set(LICENSES.map(item => PACKAGE[item.name]).filter(Boolean))
    for (const name of runtimeTree("shaders")) expect(listed.has(name), `${name} is bundled but not in the notice`).toBe(true)
  })
  it("links a full license text that ships with the app", () => {
    for (const item of LICENSES) {
      expect(existsSync(`public/${item.file}`), item.file).toBe(true)
      expect(readFileSync(`public/${item.file}`, "utf8"), item.file).toMatch(/Permission|SIL OPEN FONT LICENSE|ISC License|Apache License/iu)
    }
  })
})
