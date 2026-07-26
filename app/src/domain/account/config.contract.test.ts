import { describe, expect, it } from "vitest"
import { resolveAccountConfig } from "./config"

const credentials = {
  VITE_SUPABASE_URL: "https://example.supabase.co",
  VITE_SUPABASE_ANON_KEY: "public-anon-key",
}

describe("account public release gate", () => {
  it("stays disabled when credentials exist without release approval", () => {
    expect(resolveAccountConfig(credentials)).toBeNull()
  })

  it("stays disabled when approval exists without complete credentials", () => {
    expect(resolveAccountConfig({ VITE_ACCOUNT_PUBLIC_ENABLED: "true" })).toBeNull()
  })

  it("enables only with exact approval and complete valid credentials", () => {
    expect(resolveAccountConfig({
      ...credentials,
      VITE_ACCOUNT_PUBLIC_ENABLED: "true",
    })).toEqual({
      url: credentials.VITE_SUPABASE_URL,
      anonKey: credentials.VITE_SUPABASE_ANON_KEY,
    })
  })

  it("rejects a non-HTTPS endpoint", () => {
    expect(resolveAccountConfig({
      ...credentials,
      VITE_ACCOUNT_PUBLIC_ENABLED: "true",
      VITE_SUPABASE_URL: "http://example.supabase.co",
    })).toBeNull()
  })
})
