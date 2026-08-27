import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const updateModule = readFileSync("src/domain/pwa-update.ts", "utf8")
const serviceWorker = readFileSync("public/sw.js", "utf8")
const main = readFileSync("src/main.tsx", "utf8")

describe("PWA update handoff", () => {
  it("does not replace the running app while an athlete may be writing", () => {
    expect(serviceWorker).not.toContain("then(() => self.skipWaiting())")
    expect(serviceWorker).toContain('e.data?.type === "SKIP_WAITING"')
    expect(updateModule).toContain('postMessage({ type: "SKIP_WAITING" })')
  })

  it("checks again on return and reloads only after the update button is used", () => {
    expect(updateModule).toContain('window.addEventListener("focus", checkForUpdate)')
    expect(updateModule).toContain('document.addEventListener("visibilitychange", checkForUpdate)')
    expect(updateModule).toContain("if (!reloadRequested) return")
    expect(main).toContain("registerAppServiceWorker(base)")
  })
})
