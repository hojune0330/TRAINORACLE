import { expect, it, vi } from "vitest"
import { registerUnsavedDraftGuard, runDraftSafeNavigation } from "./unsaved-draft-navigation"

it("blocks all navigation callbacks until volatile input is durable, and unregisters independently", () => {
  let unsafe = true
  const navigate = vi.fn()
  const blocked = vi.fn()
  const unregister = registerUnsavedDraftGuard({ isUnsafe: () => unsafe, onBlocked: blocked })
  const other = registerUnsavedDraftGuard({ isUnsafe: () => false, onBlocked: vi.fn() })
  try {
    expect(runDraftSafeNavigation(navigate)).toBe(false)
    expect(navigate).not.toHaveBeenCalled()
    expect(blocked).toHaveBeenCalledOnce()
    unsafe = false
    expect(runDraftSafeNavigation(navigate)).toBe(true)
    unsafe = true
    other()
    expect(runDraftSafeNavigation(navigate)).toBe(false)
    unregister()
    expect(runDraftSafeNavigation(navigate)).toBe(true)
    expect(navigate).toHaveBeenCalledTimes(2)
  } finally { unregister(); other() }
})
