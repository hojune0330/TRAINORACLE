import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

import {
  renderCollectionDocuments,
  renderOpenSourceHtml,
  validateCollectionRegistry,
} from "./decoration-collection-docs"
import { DECORATION_COLLECTIONS, LICENSES, OPEN_CUTE_V1, type DecorationLicense } from "./decoration-collections"

const publicDir = join(process.cwd(), "public")

describe("decoration collection docs (registry → legal notice + asset ledger)", () => {
  it("registry passes structural validation", () => {
    expect(validateCollectionRegistry(DECORATION_COLLECTIONS)).toEqual([])
  })

  it("generated files in public/ are in sync with the registry (run: node scripts/generate-collection-docs.mjs)", () => {
    for (const document of renderCollectionDocuments(DECORATION_COLLECTIONS)) {
      const onDisk = readFileSync(join(publicDir, document.path), "utf8")
      expect(onDisk, `public/${document.path} 가 레지스트리와 다릅니다`).toBe(document.content)
    }
  })

  it("every collection asset exists and matches the registry sha256", () => {
    for (const collection of DECORATION_COLLECTIONS) {
      for (const item of collection.items) {
        const bytes = readFileSync(join(publicDir, collection.assetDir, item.fileName))
        expect(bytes.byteLength).toBeGreaterThan(0)
        if (item.sha256 !== undefined) {
          expect(createHash("sha256").update(bytes).digest("hex"), item.id).toBe(item.sha256)
        }
      }
    }
  })

  it("open-source.html has an anchor per collection and the license files it links to exist", () => {
    const html = renderOpenSourceHtml(DECORATION_COLLECTIONS)
    for (const collection of DECORATION_COLLECTIONS) {
      expect(html).toContain(`<section id="${collection.id}"`)
      expect(html).toContain(`href="../${collection.assetDir}/assets.json"`)
    }
    for (const license of LICENSES as readonly DecorationLicense[]) {
      if (license.licenseFile === undefined) continue
      expect(readFileSync(join(publicDir, license.licenseFile), "utf8").length).toBeGreaterThan(0)
    }
    expect(html).toContain("mailto:hojune0330@gmail.com")
    expect(html).toContain("2026년 9월 1일")
  })

  it("render is deterministic", () => {
    expect(renderOpenSourceHtml([OPEN_CUTE_V1])).toBe(renderOpenSourceHtml([OPEN_CUTE_V1]))
  })

  it("collection assets stay out of the service worker precache (lazy, network-only)", () => {
    const sw = readFileSync(join(publicDir, "sw.js"), "utf8")
    // 코드(주석 제외)에 pathname.includes("/collections/") 같은 캐시 조건이 생기면 실패한다.
    const code = sw.replace(/\/\*[\s\S]*?\*\//gu, "").replace(/\/\/.*$/gmu, "")
    expect(code).not.toContain("/collections/")
    expect(sw).toContain("/collections/")
  })
})
