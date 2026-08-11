import { describe, expect, it } from "vitest"
import { resolveAccountConfig } from "./config"

const credentials = {
  VITE_SUPABASE_URL: "https://example.supabase.co",
  VITE_SUPABASE_ANON_KEY: "public-anon-key",
}

const legalDocuments = {
  VITE_PRIVACY_POLICY_URL: "https://trainoracle.example/privacy",
  VITE_PRIVACY_POLICY_VERSION: "2026-08-12",
  VITE_TERMS_OF_SERVICE_URL: "https://trainoracle.example/terms",
  VITE_TERMS_OF_SERVICE_VERSION: "2026-08-12",
}

describe("account public release gate", () => {
  it("stays disabled when credentials exist without release approval", () => {
    expect(resolveAccountConfig(credentials)).toBeNull()
  })

  it("stays disabled when approval exists without complete credentials", () => {
    expect(resolveAccountConfig({ VITE_ACCOUNT_PUBLIC_ENABLED: "true" })).toBeNull()
  })

  it("enables only with exact approval, complete credentials, and public legal documents", () => {
    expect(resolveAccountConfig({
      ...credentials,
      ...legalDocuments,
      VITE_ACCOUNT_PUBLIC_ENABLED: "true",
    })).toEqual({
      url: credentials.VITE_SUPABASE_URL,
      anonKey: credentials.VITE_SUPABASE_ANON_KEY,
      privacyPolicy: {
        url: legalDocuments.VITE_PRIVACY_POLICY_URL,
        version: legalDocuments.VITE_PRIVACY_POLICY_VERSION,
      },
      termsOfService: {
        url: legalDocuments.VITE_TERMS_OF_SERVICE_URL,
        version: legalDocuments.VITE_TERMS_OF_SERVICE_VERSION,
      },
    })
  })

  it("stays disabled when a deploy has account credentials but no public legal-document versions", () => {
    expect(resolveAccountConfig({
      ...credentials,
      VITE_ACCOUNT_PUBLIC_ENABLED: "true",
    })).toBeNull()
  })

  it("rejects a non-HTTPS endpoint", () => {
    expect(resolveAccountConfig({
      ...credentials,
      ...legalDocuments,
      VITE_ACCOUNT_PUBLIC_ENABLED: "true",
      VITE_SUPABASE_URL: "http://example.supabase.co",
    })).toBeNull()
  })

  it("rejects a non-HTTPS legal-document link", () => {
    expect(resolveAccountConfig({
      ...credentials,
      ...legalDocuments,
      VITE_ACCOUNT_PUBLIC_ENABLED: "true",
      VITE_PRIVACY_POLICY_URL: "http://trainoracle.example/privacy",
    })).toBeNull()
  })

  it("lets the service operator close only account access during an incident", () => {
    expect(resolveAccountConfig({
      ...credentials,
      ...legalDocuments,
      VITE_ACCOUNT_PUBLIC_ENABLED: "true",
      VITE_KILL_ACCOUNT: "true",
    })).toBeNull()
  })
})
