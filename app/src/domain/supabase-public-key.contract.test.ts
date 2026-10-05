import { describe, expect, it, vi } from "vitest"
import { isSupabasePublicClientKey } from "./supabase-public-key"
import {
  isRetiredSharedAuthOrigin,
  retireSharedOriginAuthCredentials,
} from "./account/auth-origin"

describe("public browser key and retired auth origin", () => {
  it("accepts only anon JWTs or publishable keys", () => {
    expect(isSupabasePublicClientKey("eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiYW5vbiJ9.synthetic-signature")).toBe(true)
    expect(isSupabasePublicClientKey("sb_publishable_synthetic_public_key_123456")).toBe(true)
    expect(isSupabasePublicClientKey("eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.synthetic-signature")).toBe(false)
    expect(isSupabasePublicClientKey(["sb", "secret", "this", "must", "not", "be", "bundled", "123456"].join("_"))).toBe(false)
    expect(isSupabasePublicClientKey("public-anon-key")).toBe(false)
  })

  it("removes only auth and onboarding state on the retired shared GitHub Pages origin", () => {
    const localRemoveItem = vi.fn()
    const sessionRemoveItem = vi.fn()
    expect(isRetiredSharedAuthOrigin("hojune0330.github.io")).toBe(true)
    expect(retireSharedOriginAuthCredentials(
      { removeItem: localRemoveItem },
      { removeItem: sessionRemoveItem },
      "hojune0330.github.io",
    )).toBe(true)
    expect(localRemoveItem.mock.calls.map(([key]) => key)).toEqual([
      "trainoracle.auth.v1",
      "trainoracle.auth.v1-code-verifier",
      "trainoracle.account.setup-receipt.v1",
      "trainoracle.auth.quarantine.v1",
      "trainoracle.account.email-browser-proof.v1",
    ])
    expect(sessionRemoveItem).toHaveBeenCalledOnce()
    expect(sessionRemoveItem).toHaveBeenCalledWith("trainoracle.account.pending-setup.v1")
    expect(localRemoveItem).not.toHaveBeenCalledWith("trainoracle.journal.v1")
    expect(localRemoveItem).not.toHaveBeenCalledWith("trainoracle.training-plan.v1")

    localRemoveItem.mockClear()
    sessionRemoveItem.mockClear()
    expect(retireSharedOriginAuthCredentials(
      { removeItem: localRemoveItem },
      { removeItem: sessionRemoveItem },
      "trainoracle.example",
    )).toBe(false)
    expect(localRemoveItem).not.toHaveBeenCalled()
    expect(sessionRemoveItem).not.toHaveBeenCalled()
  })

  it("still attempts the pending-setup purge when retired-origin localStorage cleanup throws", () => {
    const localRemoveItem = vi.fn().mockImplementation(() => { throw new DOMException("blocked", "SecurityError") })
    const sessionRemoveItem = vi.fn()

    expect(retireSharedOriginAuthCredentials(
      { removeItem: localRemoveItem },
      { removeItem: sessionRemoveItem },
      "hojune0330.github.io",
    )).toBe(true)
    expect(localRemoveItem).toHaveBeenCalledTimes(5)
    expect(sessionRemoveItem).toHaveBeenCalledWith("trainoracle.account.pending-setup.v1")
  })
})
