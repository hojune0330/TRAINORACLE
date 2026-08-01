import { productFeatures } from "../product-features"
import { createProductAnalyticsEvent } from "./product-analytics"
import { supabase } from "./supabase-client"

export type ProductAnalyticsResult = "SENT" | "SKIPPED" | "FAILED"

export async function trackProductEvent(name: string): Promise<ProductAnalyticsResult> {
  if (!productFeatures().productAnalytics) return "SKIPPED"
  const client = await supabase()
  if (client === null) return "SKIPPED"
  const { data: sessionData } = await client.auth.getSession()
  const userId = sessionData.session?.user.id
  if (userId === undefined) return "SKIPPED"

  const event = createProductAnalyticsEvent(name, true, new Date().toISOString())
  if (event === null) return "SKIPPED"
  const { data, error } = await client.rpc("record_product_analytics_event", {
    event_name_input: event.name,
  })
  if (error !== null) return "FAILED"
  return data === true ? "SENT" : "SKIPPED"
}
