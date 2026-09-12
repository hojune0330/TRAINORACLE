import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

describe("existing shortcut manifest assets", () => {
  it("keeps the branded install assets real and start URL free of account or record context", () => {
    const manifest = JSON.parse(readFileSync("public/manifest.webmanifest", "utf8"))
    const scope = new URL(manifest.scope, "https://example.test/TRAINORACLE/")
    const start = new URL(manifest.start_url, scope)
    expect(start.origin).toBe(scope.origin)
    expect(start.pathname.startsWith(scope.pathname)).toBe(true)
    expect(start.search).toBe("")
    expect(start.hash).toBe("")
    expect(manifest.display).toBe("standalone")
    expect(manifest.icons).toEqual(expect.arrayContaining([
      expect.objectContaining({ sizes: "192x192", purpose: "any" }),
      expect.objectContaining({ sizes: "512x512", purpose: "any" }),
    ]))
    for (const icon of manifest.icons) {
      const data = readFileSync(path.join("public", icon.src))
      expect(data.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a")
      expect(`${data.readUInt32BE(16)}x${data.readUInt32BE(20)}`).toBe(icon.sizes)
    }
    const html = readFileSync("index.html", "utf8")
    expect(html).toContain('rel="apple-touch-icon" href="icons/apple-touch-icon.png"')
    expect(readFileSync("public/icons/apple-touch-icon.png").length).toBeGreaterThan(0)
  })
})
