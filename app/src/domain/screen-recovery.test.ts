import { afterEach, describe, expect, it, vi } from "vitest"
import { captureInterruptedDraft, clearRecoveryTab, isReloadBlocked, isScreenAssetFailure, readRecoveryTab, reloadScreenAssets, rememberRecoveryTab } from "./screen-recovery"
import { registerUnsavedDraftGuard } from "./unsaved-draft-navigation"

afterEach(() => { vi.restoreAllMocks(); sessionStorage.clear() })

describe("screen recovery", () => {
  it.each([
    "Failed to fetch dynamically imported module: /assets/Guide.js",
    "Unable to preload CSS for /assets/Guide.css",
    "Importing a module script failed.",
  ])("recognizes asset loading: %s", message => expect(isScreenAssetFailure(message)).toBe(true))

  it.each(["Cannot read properties of undefined", "Failed to fetch", "invalid plan"])("does not mislabel %s as a network error", message => expect(isScreenAssetFailure(message)).toBe(false))

  it("reloads once after a real HTML response, without changing user storage", async () => {
    const reload = vi.fn(), beforeReload = vi.fn()
    const fetchEntry = vi.fn<typeof fetch>().mockResolvedValue(new Response("<html></html>", { headers: { "content-type": "text/html" } }))
    localStorage.setItem("recovery-test-plan", "keep")
    expect(await reloadScreenAssets({ unsafeAtFailure: false, fetchEntry, reload, beforeReload })).toBe("reloading")
    expect(reload).toHaveBeenCalledOnce()
    expect(beforeReload).toHaveBeenCalledOnce()
    expect(fetchEntry.mock.calls[0]?.[1]).toMatchObject({ cache: "no-store", credentials: "omit" })
    expect(localStorage.getItem("recovery-test-plan")).toBe("keep")
    localStorage.removeItem("recovery-test-plan")
  })

  it.each([new Response("missing", { status: 404 }), new Response("{}", { headers: { "content-type": "application/json" } })])("does not reload when entry is unavailable", async response => {
    const reload = vi.fn()
    expect(await reloadScreenAssets({ unsafeAtFailure: false, fetchEntry: vi.fn().mockResolvedValue(response), reload })).toBe("unavailable")
    expect(reload).not.toHaveBeenCalled()
  })

  it("reports connection failure without an automatic retry loop", async () => {
    const fetchEntry = vi.fn().mockRejectedValue(new Error("offline")), reload = vi.fn()
    expect(await reloadScreenAssets({ unsafeAtFailure: false, fetchEntry, reload })).toBe("unavailable")
    expect(fetchEntry).toHaveBeenCalledOnce()
    expect(reload).not.toHaveBeenCalled()
  })

  it("blocks reload for volatile input without asking to discard it", async () => {
    const discard = vi.fn(), fetchEntry = vi.fn(), reload = vi.fn()
    const remove = registerUnsavedDraftGuard({ isUnsafe: () => true, onBlocked: vi.fn(), discard })
    try {
      expect(await reloadScreenAssets({ unsafeAtFailure: false, fetchEntry, reload })).toBe("draft-blocked")
      expect(fetchEntry).not.toHaveBeenCalled()
      expect(discard).not.toHaveBeenCalled()
    } finally { remove() }
  })

  it("checks input again after the network request", async () => {
    let unsafe = false
    const remove = registerUnsavedDraftGuard({ isUnsafe: () => unsafe, onBlocked: vi.fn() })
    const reload = vi.fn()
    try {
      const fetchEntry = vi.fn().mockImplementation(async () => { unsafe = true; return new Response("ok", { headers: { "content-type": "text/html" } }) })
      expect(await reloadScreenAssets({ unsafeAtFailure: false, fetchEntry, reload })).toBe("draft-blocked")
      expect(reload).not.toHaveBeenCalled()
    } finally { remove() }
  })

  it("stores only a short-lived tab and removes the recovery hint", () => {
    rememberRecoveryTab("plan")
    expect(readRecoveryTab()).toBe("plan")
    vi.spyOn(Date, "now").mockReturnValue(Date.now() + 61_000)
    expect(readRecoveryTab()).toBeNull()
    clearRecoveryTab()
    expect(sessionStorage.length).toBe(0)
  })

  it("does not reload a different screen after the user leaves the failed region", async () => {
    const reload = vi.fn(), beforeReload = vi.fn()
    const fetchEntry = vi.fn().mockResolvedValue(new Response("ok", { headers: { "content-type": "text/html" } }))
    expect(await reloadScreenAssets({ unsafeAtFailure: false, fetchEntry, reload, beforeReload, isCurrent: () => false })).toBe("cancelled")
    expect(reload).not.toHaveBeenCalled()
    expect(beforeReload).not.toHaveBeenCalled()
  })

  it("retains an interrupted-draft block even after the failed form unmounts", () => {
    const remove = registerUnsavedDraftGuard({ isUnsafe: () => true, onBlocked: vi.fn() })
    expect(captureInterruptedDraft()).toBe(true)
    remove()
    expect(isReloadBlocked()).toBe(true)
  })
})
