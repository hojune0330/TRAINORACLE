import { afterEach, describe, expect, it, vi } from "vitest"
import { loadPrivateProfileSetupStatus, savePrivateProfile } from "./account-service"

const { supabaseMock } = vi.hoisted(() => ({ supabaseMock: vi.fn() }))
vi.mock("./supabase-client", () => ({ supabase: supabaseMock }))

afterEach(() => {
  vi.clearAllMocks()
  vi.useRealTimers()
})

describe("beta account admission service", () => {
  it("does not call the server for an under-14 profile", async () => {
    const rpc = vi.fn()
    supabaseMock.mockResolvedValue({ rpc })

    await expect(savePrivateProfile({
      userId: "athlete-minor",
      birthDate: "2020-01-01",
      privacyPolicyVersion: "2026-08-12",
      termsOfServiceVersion: "2026-08-12",
    })).resolves.toMatchObject({ ok: false })

    expect(rpc).not.toHaveBeenCalled()
  })

  it("claims a server seat instead of inserting a profile directly", async () => {
    const from = vi.fn()
    const rpc = vi.fn().mockResolvedValue({ data: "ADMITTED_NEW", error: null })
    supabaseMock.mockResolvedValue({ from, rpc })

    await expect(savePrivateProfile({
      userId: "athlete-a",
      birthDate: "2000-01-01",
      privacyPolicyVersion: "2026-08-12",
      termsOfServiceVersion: "2026-08-12",
    })).resolves.toEqual({ ok: true, message: "계정 정보를 저장했어요." })

    expect(rpc).toHaveBeenCalledWith("claim_beta_seat", {
      birth_date_input: "2000-01-01",
      privacy_policy_version_input: "2026-08-12",
      terms_of_service_version_input: "2026-08-12",
    })
    expect(from).not.toHaveBeenCalled()
  })

  it("keeps the local diary available when all 200 seats are occupied", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: "BETA_FULL", error: null })
    supabaseMock.mockResolvedValue({ rpc })

    await expect(savePrivateProfile({
      userId: "athlete-201",
      birthDate: "2000-01-01",
      privacyPolicyVersion: "2026-08-12",
      termsOfServiceVersion: "2026-08-12",
    })).resolves.toEqual({
      ok: false,
      message: "무료 베타 200명 자리가 모두 찼어요. 기기 일지는 계속 사용할 수 있어요.",
    })
  })

  it("fails closed on an unknown server response", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: "UNEXPECTED", error: null })
    supabaseMock.mockResolvedValue({ rpc })

    await expect(savePrivateProfile({
      userId: "athlete-a",
      birthDate: "2000-01-01",
      privacyPolicyVersion: "2026-08-12",
      termsOfServiceVersion: "2026-08-12",
    })).resolves.toEqual({
      ok: false,
      message: "계정 정보를 저장하지 못했어요.",
    })
  })

  it("uses the Korean service day when the exact 14th birthday starts", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-08-24T15:00:00.000Z"))
    const rpc = vi.fn().mockResolvedValue({ data: "ADMITTED_NEW", error: null })
    supabaseMock.mockResolvedValue({ rpc })

    await expect(savePrivateProfile({
      userId: "athlete-exactly-14",
      birthDate: "2012-08-25",
      privacyPolicyVersion: "2026-08-25",
      termsOfServiceVersion: "2026-08-25",
    })).resolves.toMatchObject({ ok: true })

    expect(rpc).toHaveBeenCalledOnce()
  })

  it("restores setup only when the signed-in user's server profile has current legal versions", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: {
        privacy_policy_version: "2026-08-25",
        terms_of_service_version: "2026-08-25",
        deletion_requested_at: null,
      },
      error: null,
    })
    const eq = vi.fn().mockReturnValue({ maybeSingle })
    const select = vi.fn().mockReturnValue({ eq })
    const from = vi.fn().mockReturnValue({ select })
    const getSession = vi.fn().mockResolvedValue({
      data: { session: { user: { id: "athlete-a" } } },
    })
    supabaseMock.mockResolvedValue({ auth: { getSession }, from })

    await expect(loadPrivateProfileSetupStatus({
      userId: "athlete-a",
      privacyPolicyVersion: "2026-08-25",
      termsOfServiceVersion: "2026-08-25",
    })).resolves.toEqual({ ok: true, ready: true, message: "가입 확인을 마쳤어요." })
  })

  it("fails closed when a signed-in account has no completed private profile", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null })
    const eq = vi.fn().mockReturnValue({ maybeSingle })
    const select = vi.fn().mockReturnValue({ eq })
    const from = vi.fn().mockReturnValue({ select })
    const getSession = vi.fn().mockResolvedValue({
      data: { session: { user: { id: "athlete-a" } } },
    })
    supabaseMock.mockResolvedValue({ auth: { getSession }, from })

    await expect(loadPrivateProfileSetupStatus({
      userId: "athlete-a",
      privacyPolicyVersion: "2026-08-25",
      termsOfServiceVersion: "2026-08-25",
    })).resolves.toMatchObject({ ok: true, ready: false })
  })
})
