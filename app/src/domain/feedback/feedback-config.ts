import { resolveProductFeatures } from "../product-features"

export type FeedbackConfig = {
  readonly url: string
  readonly anonKey: string
}

function textValue(env: Readonly<Record<string, unknown>>, name: string): string {
  const value = env[name]
  return typeof value === "string" ? value.trim() : ""
}

export function resolveFeedbackConfig(env: Readonly<Record<string, unknown>>): FeedbackConfig | null {
  if (!resolveProductFeatures(env).feedbackBoard) return null
  const url = textValue(env, "VITE_SUPABASE_URL")
  const anonKey = textValue(env, "VITE_SUPABASE_ANON_KEY")
  if (!url.startsWith("https://") || anonKey === "") return null
  return { url, anonKey }
}

export function feedbackConfig(): FeedbackConfig | null {
  return resolveFeedbackConfig(import.meta.env)
}
