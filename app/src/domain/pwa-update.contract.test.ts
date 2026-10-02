import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const updateModule = readFileSync("src/domain/pwa-update.ts", "utf8")
const serviceWorker = readFileSync("public/sw.js", "utf8")
const main = readFileSync("src/main.tsx", "utf8")

describe("PWA update handoff", () => {
  // 2026-10-02: automatic updates remain, but volatile input postpones the swap.
  it("automatically activates only through the draft-safe update path", () => {
    expect(serviceWorker).toContain('e.data?.type === "SKIP_WAITING"')
    expect(updateModule).toContain('postMessage({ type: "SKIP_WAITING" })')
    expect(updateModule).toContain("if (next.waiting !== null) activateWhenSafe(next.waiting)")
    expect(updateModule).toContain("activateWhenSafe(next.waiting ?? installing)")
    expect(updateModule).toContain("isReloadBlocked()")
  })

  it("keeps checking for updates on return and reloads only after a real swap", () => {
    expect(updateModule).toContain('window.addEventListener("focus", checkForUpdate)')
    expect(updateModule).toContain('document.addEventListener("visibilitychange", checkForUpdate)')
    expect(updateModule).toContain("if (!reloadRequested) return")
    expect(main).toContain("registerAppServiceWorker(base)")
  })

  it("does not leave an opt-in update banner — the choice was removed on purpose", () => {
    expect(updateModule).not.toContain("subscribeToAppUpdate")
    expect(updateModule).not.toContain("activateWaitingAppUpdate")
  })
})
