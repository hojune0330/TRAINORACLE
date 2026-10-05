import { beforeEach, describe, expect, it, vi } from "vitest"

const { createClientMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(() => ({ auth: {} })),
}))

vi.mock("@supabase/supabase-js", () => ({ createClient: createClientMock }))

const releaseEnvironment = {
  VITE_ACCOUNT_PUBLIC_ENABLED: "true",
  VITE_SUPABASE_URL: "https://example.supabase.co",
  VITE_SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiYW5vbiJ9.synthetic-signature",
  VITE_PRIVACY_POLICY_URL: "https://trainoracle.example/privacy",
  VITE_PRIVACY_POLICY_VERSION: "2026-08-26",
  VITE_TERMS_OF_SERVICE_URL: "https://trainoracle.example/terms",
  VITE_TERMS_OF_SERVICE_VERSION: "2026-08-26",
}

describe("Supabase authentication client", () => {
  beforeEach(() => {
    localStorage.clear()
    vi.resetModules()
    vi.unstubAllEnvs()
    createClientMock.mockClear()
  })

  it("uses PKCE but leaves authorization-code exchange to the attempt-bound callback", async () => {
    for (const [name, value] of Object.entries(releaseEnvironment)) vi.stubEnv(name, value)

    const { supabase } = await import("./supabase-client")
    await supabase()

    expect(createClientMock).toHaveBeenCalledWith(
      releaseEnvironment.VITE_SUPABASE_URL,
      releaseEnvironment.VITE_SUPABASE_ANON_KEY,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          flowType: "pkce",
          detectSessionInUrl: false,
          storageKey: "trainoracle.auth.v1",
        },
      },
    )
  })

  it("does not construct an auth client while the account release gate is closed", async () => {
    vi.stubEnv("VITE_ACCOUNT_PUBLIC_ENABLED", "false")

    const { supabase } = await import("./supabase-client")

    await expect(supabase()).resolves.toBeNull()
    expect(createClientMock).not.toHaveBeenCalled()
  })

  it("keeps ordinary account data calls closed while an auth callback is quarantined", async () => {
    for (const [name, value] of Object.entries(releaseEnvironment)) vi.stubEnv(name, value)
    localStorage.setItem("trainoracle.auth.quarantine.v1", JSON.stringify({
      schemaVersion: 1,
      attemptId: "a".repeat(32),
      method: "email",
      phase: "SESSION_MAY_EXIST",
      createdAtMs: Date.now(),
    }))
    const { supabase } = await import("./supabase-client")

    await expect(supabase()).resolves.toBeNull()
    expect(createClientMock).not.toHaveBeenCalled()
    await expect(supabase({ allowQuarantined: true })).resolves.not.toBeNull()
    expect(createClientMock).toHaveBeenCalledOnce()
  })
})
