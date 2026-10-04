import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  AUTH_SESSION_QUARANTINE_KEY,
  authSessionQuarantinePhase,
  beginAuthSessionQuarantine,
  clearAuthSessionQuarantine,
  clearAuthSessionQuarantineAfterConfirmedSignOut,
  isAuthSessionQuarantined,
  markAuthSessionExchangeStarted,
  subscribeAuthSessionQuarantine,
  withAuthSessionQuarantineLock,
} from "./auth-session-quarantine"

const attemptId = "a".repeat(32)

beforeEach(() => {
  Object.defineProperty(navigator, "locks", {
    configurable: true,
    value: {
      request: vi.fn(async (_name: string, _options: unknown, operation: () => Promise<unknown>) => operation()),
    },
  })
  localStorage.clear()
  vi.restoreAllMocks()
})

describe("durable auth-session quarantine", () => {
  it("survives module reads until the exact attempt clears it", () => {
    expect(beginAuthSessionQuarantine({ attemptId, method: "email" })).toBe(true)
    expect(authSessionQuarantinePhase()).toBe("PRE_EXCHANGE")
    expect(markAuthSessionExchangeStarted(attemptId)).toBe(true)
    expect(authSessionQuarantinePhase()).toBe("SESSION_MAY_EXIST")
    expect(isAuthSessionQuarantined()).toBe(true)
    expect(clearAuthSessionQuarantine("b".repeat(32))).toBe(false)
    expect(isAuthSessionQuarantined()).toBe(true)
    expect(clearAuthSessionQuarantine(attemptId)).toBe(true)
    expect(isAuthSessionQuarantined()).toBe(false)
  })

  it("fails closed for a malformed marker and does not overwrite it", () => {
    localStorage.setItem(AUTH_SESSION_QUARANTINE_KEY, "not-json")
    expect(isAuthSessionQuarantined()).toBe(true)
    expect(beginAuthSessionQuarantine({ attemptId, method: "email" })).toBe(false)
    expect(clearAuthSessionQuarantine(attemptId)).toBe(false)
    expect(clearAuthSessionQuarantineAfterConfirmedSignOut()).toBe(true)
    expect(isAuthSessionQuarantined()).toBe(false)
  })

  it("does not authorize an exchange when the guard cannot be persisted", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError")
    })
    expect(beginAuthSessionQuarantine({ attemptId, method: "phone" })).toBe(false)
  })

  it("refuses to begin an auth exchange when cross-tab locking is unavailable", () => {
    Object.defineProperty(navigator, "locks", { configurable: true, value: undefined })
    expect(beginAuthSessionQuarantine({ attemptId, method: "email" })).toBe(false)
    expect(isAuthSessionQuarantined()).toBe(false)
  })

  it("notifies this tab and other-tab storage changes", () => {
    const listener = vi.fn()
    const unsubscribe = subscribeAuthSessionQuarantine(listener)
    expect(beginAuthSessionQuarantine({ attemptId, method: "google" })).toBe(true)
    expect(listener).toHaveBeenLastCalledWith(true)
    localStorage.removeItem(AUTH_SESSION_QUARANTINE_KEY)
    window.dispatchEvent(new StorageEvent("storage", { key: AUTH_SESSION_QUARANTINE_KEY }))
    expect(listener).toHaveBeenLastCalledWith(false)
    unsubscribe()
  })

  it("serializes exchange and recovery work across the origin lock", async () => {
    let queue = Promise.resolve<unknown>(undefined)
    Object.defineProperty(navigator, "locks", {
      configurable: true,
      value: {
        request: vi.fn((_name: string, _options: unknown, operation: () => Promise<unknown>) => {
          const next = queue.then(operation)
          queue = next.catch(() => undefined)
          return next
        }),
      },
    })
    let release!: () => void
    const barrier = new Promise<void>(resolve => { release = resolve })
    const order: string[] = []
    const exchange = withAuthSessionQuarantineLock(async () => {
      order.push("exchange-start")
      await barrier
      order.push("exchange-finish")
    })
    const recovery = withAuthSessionQuarantineLock(async () => {
      order.push("recovery")
    })

    await vi.waitFor(() => expect(order).toEqual(["exchange-start"]))
    release()
    await Promise.all([exchange, recovery])
    expect(order).toEqual(["exchange-start", "exchange-finish", "recovery"])
  })
})
