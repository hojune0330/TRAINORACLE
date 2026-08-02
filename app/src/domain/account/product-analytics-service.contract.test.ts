import { afterEach, describe, expect, it, vi } from "vitest"
import {
  loadProductAnalyticsConsent,
  setProductAnalyticsConsent,
} from "./product-analytics-service"

const { supabaseMock } = vi.hoisted(() => ({ supabaseMock: vi.fn() }))
vi.mock("./supabase-client", () => ({ supabase: supabaseMock }))

afterEach(() => {
  vi.clearAllMocks()
  vi.unstubAllEnvs()
})

describe("product analytics consent service", () => {
  it("does not load analytics state while the product flag is off", async () => {
    vi.stubEnv("VITE_FEATURE_PRODUCT_ANALYTICS", "false")

    await expect(loadProductAnalyticsConsent("athlete-a")).resolves.toEqual({
      ok: false,
      optedIn: false,
      message: "사용 흐름 분석 기능이 꺼져 있어요.",
    })
    expect(supabaseMock).not.toHaveBeenCalled()
  })

  it("still sends consent withdrawal while the product flag is off", async () => {
    vi.stubEnv("VITE_FEATURE_PRODUCT_ANALYTICS", "false")
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null })
    supabaseMock.mockResolvedValue({
      auth: { getSession: vi.fn().mockResolvedValue({ data: { session: { user: { id: "athlete-a" } } } }) },
      rpc,
    })

    await expect(setProductAnalyticsConsent("athlete-a", false)).resolves.toEqual({
      ok: true,
      message: "분석을 끄고 전에 모인 사용 흐름 기록도 삭제했어요.",
    })
    expect(rpc).toHaveBeenCalledWith("set_product_analytics_consent", { enabled_input: false })
  })

  it("loads only the signed-in user's boolean consent", async () => {
    vi.stubEnv("VITE_FEATURE_PRODUCT_ANALYTICS", "true")
    const maybeSingle = vi.fn().mockResolvedValue({ data: { analytics_opt_in: true }, error: null })
    const eq = vi.fn(() => ({ maybeSingle }))
    const select = vi.fn(() => ({ eq }))
    const from = vi.fn(() => ({ select }))
    supabaseMock.mockResolvedValue({
      auth: { getSession: vi.fn().mockResolvedValue({ data: { session: { user: { id: "athlete-a" } } } }) },
      from,
    })

    await expect(loadProductAnalyticsConsent("athlete-a")).resolves.toMatchObject({
      ok: true,
      optedIn: true,
    })
    expect(from).toHaveBeenCalledWith("user_private_profiles")
    expect(select).toHaveBeenCalledWith("analytics_opt_in")
    expect(eq).toHaveBeenCalledWith("user_id", "athlete-a")
  })

  it("uses the separate RPC when the user withdraws consent", async () => {
    vi.stubEnv("VITE_FEATURE_PRODUCT_ANALYTICS", "true")
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null })
    supabaseMock.mockResolvedValue({
      auth: { getSession: vi.fn().mockResolvedValue({ data: { session: { user: { id: "athlete-a" } } } }) },
      rpc,
    })

    await expect(setProductAnalyticsConsent("athlete-a", false)).resolves.toEqual({
      ok: true,
      message: "분석을 끄고 전에 모인 사용 흐름 기록도 삭제했어요.",
    })
    expect(rpc).toHaveBeenCalledWith("set_product_analytics_consent", { enabled_input: false })
  })
})
