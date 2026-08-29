import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const updateModule = readFileSync("src/domain/pwa-update.ts", "utf8")
const serviceWorker = readFileSync("public/sw.js", "utf8")
const main = readFileSync("src/main.tsx", "utf8")

describe("PWA update handoff", () => {
  // 오너 결정(2026-08-29): 베타 단계에는 실사용자가 없으므로 이전 버전 화면을
  // 보여 주지 않는다. 새 버전이 설치되면 묻지 않고 즉시 교체한다.
  it("replaces the running app immediately so nobody sees a stale version", () => {
    expect(serviceWorker).toContain('e.data?.type === "SKIP_WAITING"')
    expect(updateModule).toContain('postMessage({ type: "SKIP_WAITING" })')
    expect(updateModule).toContain("if (next.waiting !== null) activateImmediately(next.waiting)")
    expect(updateModule).toContain("activateImmediately(next.waiting ?? installing)")
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
