import { afterEach, describe, expect, it, vi } from "vitest"
import { savePrivateProfile } from "./account-service"

const { supabaseMock } = vi.hoisted(() => ({ supabaseMock: vi.fn() }))
vi.mock("./supabase-client", () => ({ supabase: supabaseMock }))

afterEach(() => {
  vi.clearAllMocks()
})

describe("beta account admission service", () => {
  it("claims a server seat instead of inserting a profile directly", async () => {
    const from = vi.fn()
    const rpc = vi.fn().mockResolvedValue({ data: "ADMITTED_NEW", error: null })
    supabaseMock.mockResolvedValue({ from, rpc })

    await expect(savePrivateProfile({
      userId: "athlete-a",
      birthDate: "2000-01-01",
    })).resolves.toEqual({ ok: true, message: "계정 정보를 저장했어요." })

    expect(rpc).toHaveBeenCalledWith("claim_beta_seat", { birth_date_input: "2000-01-01" })
    expect(from).not.toHaveBeenCalled()
  })

  it("keeps the local diary available when all 200 seats are occupied", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: "BETA_FULL", error: null })
    supabaseMock.mockResolvedValue({ rpc })

    await expect(savePrivateProfile({
      userId: "athlete-201",
      birthDate: "2000-01-01",
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
    })).resolves.toEqual({
      ok: false,
      message: "계정 정보를 저장하지 못했어요.",
    })
  })
})
