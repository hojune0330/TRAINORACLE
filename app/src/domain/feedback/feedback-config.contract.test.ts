import { describe, expect, it } from "vitest"
import { resolveFeedbackConfig } from "./feedback-config"

const credentials = {
  VITE_SUPABASE_URL: "https://example.supabase.co",
  VITE_SUPABASE_ANON_KEY: "anon-key",
}

describe("feedback board configuration", () => {
  it("stays closed without an explicit release switch", () => {
    expect(resolveFeedbackConfig(credentials)).toBeNull()
  })

  it("opens independently from account login", () => {
    expect(resolveFeedbackConfig({ ...credentials, VITE_FEATURE_FEEDBACK_BOARD: "true" })).toEqual({
      url: credentials.VITE_SUPABASE_URL,
      anonKey: credentials.VITE_SUPABASE_ANON_KEY,
    })
  })

  it("honors the immediate kill switch", () => {
    expect(resolveFeedbackConfig({
      ...credentials,
      VITE_FEATURE_FEEDBACK_BOARD: "true",
      VITE_KILL_FEEDBACK_BOARD: "true",
    })).toBeNull()
  })
})
