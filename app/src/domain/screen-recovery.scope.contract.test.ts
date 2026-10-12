import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { setActiveLocalAccount } from "./account/local-journal-ownership"
import { captureInterruptedDraft, isReloadBlocked, reloadScreenAssets } from "./screen-recovery"
import { registerUnsavedDraftGuard } from "./unsaved-draft-navigation"

beforeEach(() => { setActiveLocalAccount("scope-a") })
afterEach(() => { setActiveLocalAccount(null); vi.restoreAllMocks() })

it("keeps interrupted input blocked in its scope but permits recovery in a different account", async () => {
  const remove = registerUnsavedDraftGuard({ isUnsafe: () => true, onBlocked: vi.fn() })
  expect(captureInterruptedDraft()).toBe(true)
  remove()
  expect(isReloadBlocked()).toBe(true)
  setActiveLocalAccount("scope-b")
  expect(isReloadBlocked()).toBe(false)
  expect(captureInterruptedDraft()).toBe(false)
  const reload = vi.fn()
  const fetchEntry = vi.fn<typeof fetch>().mockResolvedValue(new Response("ok", { headers: { "content-type": "text/html" } }))
  expect(await reloadScreenAssets({ unsafeAtFailure: false, fetchEntry, reload })).toBe("reloading")
  expect(reload).toHaveBeenCalledOnce()
})

it("does not revive an interrupted-draft latch after switching away and back", () => {
  const remove = registerUnsavedDraftGuard({ isUnsafe: () => true, onBlocked: vi.fn() })
  expect(captureInterruptedDraft()).toBe(true)
  remove()
  setActiveLocalAccount("scope-b")
  setActiveLocalAccount("scope-a")
  expect(isReloadBlocked()).toBe(false)
  expect(captureInterruptedDraft()).toBe(false)
})

it("keeps new unsaved input protected after changing the account scope", () => {
  setActiveLocalAccount("scope-b")
  const remove = registerUnsavedDraftGuard({ isUnsafe: () => true, onBlocked: vi.fn() })
  try { expect(isReloadBlocked()).toBe(true) } finally { remove() }
})
