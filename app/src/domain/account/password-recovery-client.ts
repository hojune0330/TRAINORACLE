import type { SupabaseClient } from "@supabase/supabase-js"
import { accountConfig } from "./config"

/** Recovery credentials stay in an independent memory-only auth client. */
export async function createPasswordRecoveryClient(): Promise<SupabaseClient | null> {
  const config = accountConfig()
  if (!config?.passwordAuthEnabled) return null
  const { createClient } = await import("@supabase/supabase-js")
  return createClient(config.url, config.anonKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, flowType: "pkce", storageKey: "trainoracle.password.recovery.memory.v1" } })
}
