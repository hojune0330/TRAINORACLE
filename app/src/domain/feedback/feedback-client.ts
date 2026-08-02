import type { SupabaseClient } from "@supabase/supabase-js"
import { feedbackConfig } from "./feedback-config"

let clientPromise: Promise<SupabaseClient | null> | null = null

export function feedbackClient(): Promise<SupabaseClient | null> {
  if (clientPromise !== null) return clientPromise
  const config = feedbackConfig()
  if (config === null) return Promise.resolve(null)
  clientPromise = import("@supabase/supabase-js")
    .then(({ createClient }) => createClient(config.url, config.anonKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    }))
    .catch(() => null)
  return clientPromise
}
