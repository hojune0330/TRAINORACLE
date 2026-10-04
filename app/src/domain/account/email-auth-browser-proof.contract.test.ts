import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  EMAIL_AUTH_BROWSER_PROOF_KEY,
  consumeEmailAuthBrowserProof,
  createEmailAuthBrowserProof,
  hasEmailAuthBrowserProof,
} from "./email-auth-browser-proof"

const attemptId = "a".repeat(32)

beforeEach(() => {
  localStorage.clear()
  vi.useRealTimers()
})

describe("email auth browser proof", () => {
  it("is one-time and cannot be reconstructed from the public attempt id", () => {
    expect(createEmailAuthBrowserProof(attemptId)).toBe(true)
    const stored = localStorage.getItem(EMAIL_AUTH_BROWSER_PROOF_KEY) ?? ""
    expect(stored).not.toContain("token_hash")
    expect(hasEmailAuthBrowserProof(attemptId)).toBe(true)
    expect(hasEmailAuthBrowserProof("b".repeat(32))).toBe(false)
    expect(consumeEmailAuthBrowserProof(attemptId)).toBe(true)
    expect(consumeEmailAuthBrowserProof(attemptId)).toBe(false)
  })

  it("expires instead of authorizing an abandoned old link", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-10-03T00:00:00Z"))
    expect(createEmailAuthBrowserProof(attemptId)).toBe(true)
    vi.advanceTimersByTime(15 * 60 * 1000 + 1)
    expect(hasEmailAuthBrowserProof(attemptId)).toBe(false)
    expect(localStorage.getItem(EMAIL_AUTH_BROWSER_PROOF_KEY)).toBeNull()
  })
})
