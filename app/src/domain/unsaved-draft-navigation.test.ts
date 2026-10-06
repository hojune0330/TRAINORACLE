import { expect, it, vi } from "vitest"
import { hasUnsafeDrafts, registerUnsavedDraftGuard, runDraftSafeNavigation } from "./unsaved-draft-navigation"

it("preserves a still-mounted plan without bypassing storage blockers or reload protection", () => {
  const discard = vi.fn(), confirm = vi.fn(() => true), navigate = vi.fn()
  const plan = registerUnsavedDraftGuard({ isUnsafe: () => true, onBlocked: vi.fn(), confirmDiscard: confirm, discard,
    canPreserveMountedDraft: () => true })
  const blocked = vi.fn()
  const storage = registerUnsavedDraftGuard({ isUnsafe: () => true, onBlocked: blocked })
  try {
    expect(runDraftSafeNavigation(navigate, true)).toBe(false)
    expect(discard).not.toHaveBeenCalled()
    storage()
    expect(runDraftSafeNavigation(navigate, true)).toBe(true)
    expect(confirm).not.toHaveBeenCalled()
    expect(hasUnsafeDrafts()).toBe(true)
    expect(runDraftSafeNavigation(navigate)).toBe(true)
    expect(discard).toHaveBeenCalledOnce()
  } finally { plan(); storage() }
})

it("rechecks lifetime after mounted-draft preservation and cannot discard another owner", () => {
  let current = true
  const navigate = vi.fn(), discard = vi.fn()
  const remove = registerUnsavedDraftGuard({ isUnsafe: () => true, onBlocked: vi.fn(),
    confirmDiscard: () => true, discard, canPreserveMountedDraft: () => { current = false; return false } })
  try {
    expect(runDraftSafeNavigation(navigate, true, () => current)).toBe(false)
    expect(discard).not.toHaveBeenCalled(); expect(navigate).not.toHaveBeenCalled()
  } finally { remove() }
})

it("does not inspect a guard removed by an earlier guard callback", () => {
  const inspected = vi.fn(() => true), navigate = vi.fn()
  let removeSecond = () => {}
  const removeFirst = registerUnsavedDraftGuard({ isUnsafe: () => { removeSecond(); return false }, onBlocked: vi.fn() })
  removeSecond = registerUnsavedDraftGuard({ isUnsafe: inspected, onBlocked: vi.fn() })
  try {
    expect(runDraftSafeNavigation(navigate)).toBe(true)
    expect(inspected).not.toHaveBeenCalled(); expect(navigate).toHaveBeenCalledOnce()
  } finally { removeFirst(); removeSecond() }
})

it("does not report navigation as successful if the navigation callback throws", () => {
  expect(runDraftSafeNavigation(() => { throw new Error("synthetic navigation failure") })).toBe(false)
})

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

it("consumes a deferred continuation before duplicate or reentrant resume", () => {
  let unsafe = true
  let resume!: () => void
  const navigate = vi.fn(() => resume())
  const remove = registerUnsavedDraftGuard({ isUnsafe: () => unsafe, onBlocked: vi.fn(), requestNavigation: next => { resume = next } })
  try {
    expect(runDraftSafeNavigation(navigate)).toBe(false)
    unsafe = false
    resume(); resume()
    expect(navigate).toHaveBeenCalledOnce()
    // A fresh explicit attempt is independent of the completed continuation.
    expect(runDraftSafeNavigation(navigate)).toBe(true)
    expect(navigate).toHaveBeenCalledTimes(2)
  } finally { remove() }
})

it("permits a synchronous resume after the interactive consumer makes input safe", () => {
  let unsafe = true
  const navigate = vi.fn()
  const decide = vi.fn((resume: () => void) => { unsafe = false; resume(); resume() })
  const remove = registerUnsavedDraftGuard({ isUnsafe: () => unsafe, onBlocked: vi.fn(), requestNavigation: decide })
  try {
    expect(runDraftSafeNavigation(navigate)).toBe(true)
    expect(decide).toHaveBeenCalledOnce()
    expect(navigate).toHaveBeenCalledOnce()
  } finally { remove() }
})

it("ignores the first continuation while a second interactive decision is pending", () => {
  let firstUnsafe = true, secondUnsafe = true, resumeFirst!: () => void, resumeSecond!: () => void
  const first = registerUnsavedDraftGuard({ isUnsafe: () => firstUnsafe, onBlocked: vi.fn(), requestNavigation: next => { resumeFirst = next } })
  const decideSecond = vi.fn((next: () => void) => { resumeSecond = next })
  const second = registerUnsavedDraftGuard({ isUnsafe: () => secondUnsafe, onBlocked: vi.fn(), requestNavigation: decideSecond })
  const navigate = vi.fn()
  try {
    expect(runDraftSafeNavigation(navigate)).toBe(false)
    firstUnsafe = false; resumeFirst(); resumeFirst()
    expect(decideSecond).toHaveBeenCalledOnce()
    expect(navigate).not.toHaveBeenCalled()
    secondUnsafe = false; resumeSecond(); resumeFirst(); resumeSecond()
    expect(navigate).toHaveBeenCalledOnce()
  } finally { first(); second() }
})

it("does not spin or reopen an unsafe synchronous decision", () => {
  const navigate = vi.fn(), decide = vi.fn((resume: () => void) => resume())
  const remove = registerUnsavedDraftGuard({ isUnsafe: () => true, onBlocked: vi.fn(), requestNavigation: decide })
  try {
    expect(runDraftSafeNavigation(navigate)).toBe(false)
    expect(decide).toHaveBeenCalledOnce()
    expect(navigate).not.toHaveBeenCalled()
  } finally { remove() }
})

it.each(["isUnsafe", "onBlocked", "requestNavigation", "confirmDiscard", "discard"] as const)("stops before the next effect when %s invalidates the producer", callback => {
  let current = true, resume!: () => void
  const next = { isUnsafe: vi.fn(() => true), onBlocked: vi.fn(), confirmDiscard: vi.fn(() => true), discard: vi.fn() }
  const first = registerUnsavedDraftGuard({
    isUnsafe: () => { if (callback === "isUnsafe") current = false; return true },
    onBlocked: () => { current = false },
    ...(callback === "requestNavigation" ? { requestNavigation: (nextResume: () => void) => { resume = nextResume; current = false } } : {}),
    ...(["confirmDiscard", "discard", "isUnsafe"].includes(callback) ? {
      confirmDiscard: () => { if (callback === "confirmDiscard") current = false; return true },
      discard: () => { current = false },
    } : {}),
  })
  const second = registerUnsavedDraftGuard(next), navigate = vi.fn()
  try {
    expect(runDraftSafeNavigation(navigate, false, () => current)).toBe(false)
    resume?.()
    expect(next.confirmDiscard).toHaveBeenCalledTimes(callback === "discard" ? 1 : 0)
    expect(next.discard).not.toHaveBeenCalled()
    expect(next.onBlocked).not.toHaveBeenCalled()
    expect(navigate).not.toHaveBeenCalled()
    if (callback === "isUnsafe") expect(next.isUnsafe).not.toHaveBeenCalled()
  } finally { first(); second() }
})

it("confirms and discards both normal guards before one navigation", () => {
  const confirmA = vi.fn(() => true), confirmB = vi.fn(() => true)
  const discardA = vi.fn(), discardB = vi.fn(), navigate = vi.fn()
  const removeA = registerUnsavedDraftGuard({ isUnsafe: () => true, onBlocked: vi.fn(), confirmDiscard: confirmA, discard: discardA })
  const removeB = registerUnsavedDraftGuard({ isUnsafe: () => true, onBlocked: vi.fn(), confirmDiscard: confirmB, discard: discardB })
  try {
    expect(runDraftSafeNavigation(navigate, false, () => true)).toBe(true)
    expect(confirmA).toHaveBeenCalledOnce(); expect(confirmB).toHaveBeenCalledOnce()
    expect(discardA).toHaveBeenCalledOnce(); expect(discardB).toHaveBeenCalledOnce()
    expect(navigate).toHaveBeenCalledOnce()
  } finally { removeA(); removeB() }
})

it("does not notify the next hard blocker after the first onBlocked cancels", () => {
  let current = true
  const nextBlocked = vi.fn(), navigate = vi.fn()
  const first = registerUnsavedDraftGuard({ isUnsafe: () => true, onBlocked: () => { current = false } })
  const second = registerUnsavedDraftGuard({ isUnsafe: () => true, onBlocked: nextBlocked })
  try {
    expect(runDraftSafeNavigation(navigate, false, () => current)).toBe(false)
    expect(nextBlocked).not.toHaveBeenCalled(); expect(navigate).not.toHaveBeenCalled()
  } finally { first(); second() }
})

it("does not open the next decision after requestNavigation synchronously cancels and resumes", () => {
  let current = true, firstUnsafe = true
  const nextDecision = vi.fn(), navigate = vi.fn()
  const first = registerUnsavedDraftGuard({ isUnsafe: () => firstUnsafe, onBlocked: vi.fn(), requestNavigation: resume => { firstUnsafe = false; current = false; resume() } })
  const second = registerUnsavedDraftGuard({ isUnsafe: () => true, onBlocked: vi.fn(), requestNavigation: nextDecision })
  try {
    expect(runDraftSafeNavigation(navigate, false, () => current)).toBe(false)
    expect(nextDecision).not.toHaveBeenCalled(); expect(navigate).not.toHaveBeenCalled()
  } finally { first(); second() }
})

it("does not inspect new owner guards after the deferred producer is invalidated", () => {
  let current = true, unsafe = true, resume!: () => void
  const first = registerUnsavedDraftGuard({ isUnsafe: () => unsafe, onBlocked: vi.fn(), requestNavigation: next => { resume = next } })
  const navigate = vi.fn()
  expect(runDraftSafeNavigation(navigate, false, () => current)).toBe(false)
  first(); current = false; unsafe = false
  const read = vi.fn(() => true), confirm = vi.fn(() => true), discard = vi.fn()
  const second = registerUnsavedDraftGuard({ isUnsafe: read, onBlocked: vi.fn(), confirmDiscard: confirm, discard })
  try {
    resume()
    expect(read).not.toHaveBeenCalled(); expect(confirm).not.toHaveBeenCalled(); expect(discard).not.toHaveBeenCalled()
    expect(navigate).not.toHaveBeenCalled()
  } finally { second() }
})

it("fails closed when a guard or lifetime predicate throws", () => {
  const navigate = vi.fn(), blocked = vi.fn()
  const remove = registerUnsavedDraftGuard({ isUnsafe: () => { throw new Error("synthetic storage failure") }, onBlocked: blocked })
  try {
    expect(runDraftSafeNavigation(navigate)).toBe(false)
    remove()
    expect(runDraftSafeNavigation(navigate, false, () => { throw new Error("synthetic authority failure") })).toBe(false)
    expect(navigate).not.toHaveBeenCalled(); expect(blocked).not.toHaveBeenCalled()
  } finally { remove() }
})
