import { expect, it, vi } from "vitest"
import { registerUnsavedDraftGuard, runDraftSafeNavigation } from "./unsaved-draft-navigation"

it("resumes an interactive draft decision only after it becomes safe and retains other blockers", () => {
  let unsafe = true
  let resume: (() => void) | undefined
  const navigate = vi.fn()
  const remove = registerUnsavedDraftGuard({ isUnsafe: () => unsafe, onBlocked: vi.fn(), requestNavigation: next => { resume = next } })
  const blocked = vi.fn()
  const hard = registerUnsavedDraftGuard({ isUnsafe: () => true, onBlocked: blocked })
  try {
    expect(runDraftSafeNavigation(navigate)).toBe(false); expect(resume).toBeUndefined()
    hard(); expect(runDraftSafeNavigation(navigate)).toBe(false); expect(resume).toBeTypeOf("function")
    unsafe = false; resume?.(); expect(navigate).toHaveBeenCalledOnce()
  } finally { remove(); hard() }
})

it("confirms volatile discard only after all hard storage guards permit leaving", () => {
  const confirm = vi.fn(() => true), discard = vi.fn(), navigate = vi.fn()
  const removeGuest = registerUnsavedDraftGuard({ isUnsafe: () => true, onBlocked: vi.fn(), confirmDiscard: confirm, discard })
  const removeStorage = registerUnsavedDraftGuard({ isUnsafe: () => true, onBlocked: vi.fn() })
  try {
    expect(runDraftSafeNavigation(navigate)).toBe(false)
    expect(confirm).not.toHaveBeenCalled()
    expect(discard).not.toHaveBeenCalled()
    removeStorage()
    confirm.mockReturnValueOnce(false)
    expect(runDraftSafeNavigation(navigate)).toBe(false)
    expect(discard).not.toHaveBeenCalled()
    expect(runDraftSafeNavigation(navigate)).toBe(true)
    expect(discard).toHaveBeenCalledOnce()
    expect(navigate).toHaveBeenCalledOnce()
  } finally { removeGuest(); removeStorage() }
})

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
