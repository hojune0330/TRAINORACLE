import { z } from "zod"
import { productFeatures } from "../product-features"
import type { AccountActionResult } from "./account-service"
import { createProductAnalyticsEvent } from "./product-analytics"
import { supabase } from "./supabase-client"

export type ProductAnalyticsResult = "SENT" | "SKIPPED" | "FAILED"
export type ProductAnalyticsConsentStatus = {
  readonly ok: boolean
  readonly optedIn: boolean
  readonly message: string
}

const consentRowSchema = z.object({ analytics_opt_in: z.boolean() })

export async function loadProductAnalyticsConsent(userId: string): Promise<ProductAnalyticsConsentStatus> {
  if (!productFeatures().productAnalytics) return consentStatus(false, "사용 흐름 분석 기능이 꺼져 있어요.")
  const client = await supabase()
  if (client === null) return consentStatus(false, "분석 설정을 불러올 수 없어요.")
  const { data: sessionData } = await client.auth.getSession()
  if (sessionData.session?.user.id !== userId) return consentStatus(false, "로그인 정보를 다시 확인해 주세요.")

  const { data, error } = await client
    .from("user_private_profiles")
    .select("analytics_opt_in")
    .eq("user_id", userId)
    .maybeSingle()
  const parsed = consentRowSchema.safeParse(data)
  return error === null && parsed.success
    ? { ok: true, optedIn: parsed.data.analytics_opt_in, message: "분석 설정을 불러왔어요." }
    : consentStatus(false, "분석 설정을 불러오지 못했어요.")
}

export async function setProductAnalyticsConsent(
  userId: string,
  optedIn: boolean,
): Promise<AccountActionResult> {
  if (optedIn && !productFeatures().productAnalytics) {
    return { ok: false, message: "사용 흐름 분석 기능이 꺼져 있어요." }
  }
  const client = await supabase()
  if (client === null) return { ok: false, message: "분석 설정을 저장할 수 없어요." }
  const { data: sessionData } = await client.auth.getSession()
  if (sessionData.session?.user.id !== userId) return { ok: false, message: "로그인 정보를 다시 확인해 주세요." }

  const { data, error } = await client.rpc("set_product_analytics_consent", {
    enabled_input: optedIn,
  })
  if (error !== null || data !== true) return { ok: false, message: "분석 설정을 저장하지 못했어요." }
  return optedIn
    ? { ok: true, message: "선택 사용 흐름 분석을 켰어요." }
    : { ok: true, message: "분석을 끄고 전에 모인 사용 흐름 기록도 삭제했어요." }
}

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

function consentStatus(optedIn: boolean, message: string): ProductAnalyticsConsentStatus {
  return { ok: false, optedIn, message }
}
