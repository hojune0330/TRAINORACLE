import { afterEach, describe, expect, it, vi } from "vitest"
import {
  loadPrivateProfileSetupStatus,
  requestServerAccountDeletion,
  savePrivateProfile,
} from "./account-service"
import { closeAccountDeletionBoundary, isAccountDeletionClosed } from "./account-deletion-boundary"
import { activeLocalAccount, localJournalScopeGeneration, setActiveLocalAccount } from "./local-journal-ownership"

const { supabaseMock } = vi.hoisted(() => ({ supabaseMock: vi.fn() }))
vi.mock("./supabase-client", () => ({ supabase: supabaseMock }))

function verifiedClient(rpc: ReturnType<typeof vi.fn>, userId = "athlete-a") {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: userId } },
        error: null,
      }),
    },
    from: vi.fn(),
    rpc,
  }
}

const profileInput = {
  userId: "athlete-a",
  expectedSessionId: "11111111-1111-4111-8111-111111111111",
  birthDate: "2000-01-01",
  privacyPolicyVersion: "2026-08-26",
  termsOfServiceVersion: "2026-08-26",
} as const

afterEach(() => {
  vi.clearAllMocks()
  vi.useRealTimers()
})

describe("beta account admission service", () => {
  it("does not call any external auth or server operation for an under-14 profile", async () => {
    const rpc = vi.fn()
    const getUser = vi.fn()
    supabaseMock.mockResolvedValue({ auth: { getUser }, rpc })

    await expect(savePrivateProfile({
      ...profileInput,
      birthDate: "2020-01-01",
    })).resolves.toMatchObject({ ok: false })

    expect(getUser).not.toHaveBeenCalled()
    expect(rpc).not.toHaveBeenCalled()
  })

  it("binds a beta-seat claim to the server-verified current user", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: "ADMITTED_NEW", error: null })
    const client = verifiedClient(rpc)
    supabaseMock.mockResolvedValue(client)

    await expect(savePrivateProfile(profileInput)).resolves.toEqual({
      ok: true,
      message: "계정 정보를 저장했어요.",
    })

    expect(client.auth.getUser).toHaveBeenCalledOnce()
    expect(rpc).toHaveBeenCalledWith("claim_beta_seat", {
      expected_user_id_input: "athlete-a",
      expected_session_id_input: "11111111-1111-4111-8111-111111111111",
      birth_date_input: "2000-01-01",
      privacy_policy_version_input: "2026-08-26",
      terms_of_service_version_input: "2026-08-26",
    })
    expect(client.from).not.toHaveBeenCalled()
  })

  it("does not call the claim RPC when the server-verified user differs", async () => {
    const rpc = vi.fn()
    supabaseMock.mockResolvedValue(verifiedClient(rpc, "athlete-b"))

    await expect(savePrivateProfile(profileInput)).resolves.toMatchObject({ ok: false })

    expect(rpc).not.toHaveBeenCalled()
  })

  it("keeps the local diary available when all 200 seats are occupied", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: "BETA_FULL", error: null })
    supabaseMock.mockResolvedValue(verifiedClient(rpc))

    await expect(savePrivateProfile(profileInput)).resolves.toEqual({
      ok: false,
      message: "무료 베타 200명 자리가 모두 찼어요. 기기 일지는 계속 사용할 수 있어요.",
    })
  })

  it("does not treat a different birth date as a legal-consent retry", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: "BIRTH_DATE_MISMATCH", error: null })
    supabaseMock.mockResolvedValue(verifiedClient(rpc))

    await expect(savePrivateProfile(profileInput)).resolves.toEqual({
      ok: false,
      message: "기존 계정의 생년월일과 달라 정보를 바꾸지 않았어요. 입력값을 다시 확인해 주세요.",
    })
  })

  it("fails closed when the server sees a different current session", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: "SESSION_MISMATCH", error: null })
    supabaseMock.mockResolvedValue(verifiedClient(rpc))

    await expect(savePrivateProfile(profileInput)).resolves.toEqual({
      ok: false,
      message: "로그인 세션이 바뀌었어요. 가입 확인을 처음부터 다시 진행해 주세요.",
    })
  })

  it("fails closed on an unknown server response", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: "UNEXPECTED", error: null })
    supabaseMock.mockResolvedValue(verifiedClient(rpc))

    await expect(savePrivateProfile(profileInput)).resolves.toEqual({
      ok: false,
      message: "계정 정보를 저장하지 못했어요.",
    })
  })

  it("uses the Korean service day when the exact 14th birthday starts", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-08-24T15:00:00.000Z"))
    const rpc = vi.fn().mockResolvedValue({ data: "ADMITTED_NEW", error: null })
    supabaseMock.mockResolvedValue(verifiedClient(rpc, "athlete-exactly-14"))

    await expect(savePrivateProfile({
      ...profileInput,
      userId: "athlete-exactly-14",
      birthDate: "2012-08-25",
    })).resolves.toMatchObject({ ok: true })

    expect(rpc).toHaveBeenCalledOnce()
  })

  it("restores setup only from the server admission RPC, never a direct profile read", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: "ADMITTED", error: null })
    const client = verifiedClient(rpc)
    supabaseMock.mockResolvedValue(client)

    await expect(loadPrivateProfileSetupStatus({ userId: "athlete-a" })).resolves.toEqual({
      ok: true,
      ready: true,
      canComplete: false,
      message: "가입 확인을 마쳤어요.",
    })
    expect(rpc).toHaveBeenCalledWith("get_current_account_admission_status", {
      expected_user_id_input: "athlete-a",
    })
    expect(client.from).not.toHaveBeenCalled()
  })

  it("allows profile completion only for explicit server-completable statuses", async () => {
    for (const status of ["NEEDS_PROFILE", "LEGAL_RECONSENT_REQUIRED", "BETA_NOT_ENROLLED"]) {
      const rpc = vi.fn().mockResolvedValue({ data: status, error: null })
      supabaseMock.mockResolvedValue(verifiedClient(rpc))

      await expect(loadPrivateProfileSetupStatus({ userId: "athlete-a" })).resolves.toMatchObject({
        ok: true,
        ready: false,
        canComplete: true,
      })
    }
  })

  it("fails closed instead of opening profile completion for disabled or unknown states", async () => {
    for (const status of ["ACCOUNT_DISABLED", "AUTH_METHOD_UNSUPPORTED", "RESTRICTED", "UNEXPECTED"]) {
      const rpc = vi.fn().mockResolvedValue({ data: status, error: null })
      supabaseMock.mockResolvedValue(verifiedClient(rpc))

      await expect(loadPrivateProfileSetupStatus({ userId: "athlete-a" })).resolves.toMatchObject({
        ok: false,
        ready: false,
        canComplete: false,
      })
    }
  })

  it("explains that a server-rejected password session must reauthenticate without treating it as completable", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: "AUTH_METHOD_UNSUPPORTED", error: null })
    supabaseMock.mockResolvedValue(verifiedClient(rpc))

    await expect(loadPrivateProfileSetupStatus({ userId: "athlete-a" })).resolves.toEqual({
      ok: false,
      ready: false,
      canComplete: false,
      message: "지원하지 않는 로그인 방식이에요. 로그아웃한 뒤 이메일 확인 링크나 간편 로그인으로 다시 시작해 주세요.",
    })

    await expect(savePrivateProfile(profileInput)).resolves.toEqual({
      ok: false,
      message: "지원하지 않는 로그인 방식이에요. 로그아웃한 뒤 이메일 확인 링크나 간편 로그인으로 다시 시작해 주세요.",
    })
  })

  it("binds account deletion to the same server-verified user", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: "2026-10-03T00:00:00.000Z", error: null })
    supabaseMock.mockResolvedValue(verifiedClient(rpc))

    await expect(requestServerAccountDeletion("athlete-a")).resolves.toMatchObject({ ok: true })
    expect(rpc).toHaveBeenCalledWith("request_account_deletion", {
      expected_user_id_input: "athlete-a",
    })
  })

  it("does not call account deletion when the server-verified user differs", async () => {
    const rpc = vi.fn()
    supabaseMock.mockResolvedValue(verifiedClient(rpc, "athlete-b"))

    await expect(requestServerAccountDeletion("athlete-a")).resolves.toMatchObject({ ok: false })
    expect(rpc).not.toHaveBeenCalled()
  })

  it.each([null, "not-a-receipt", { requestedAt: "2026-10-07T00:00:00Z" }, "2026-99-99T00:00:00Z"])(
    "does not close a local owner when the deletion receipt is invalid: %#", async data => {
      const owner = "deletion-invalid-" + JSON.stringify(data)
      const rpc = vi.fn().mockResolvedValue({ data, error: null })
      supabaseMock.mockResolvedValue(verifiedClient(rpc, owner))
      setActiveLocalAccount(owner)
      const generation = localJournalScopeGeneration()
      expect(await requestServerAccountDeletion(owner)).toMatchObject({ ok: false })
      expect(isAccountDeletionClosed(owner)).toBe(false)
      expect(activeLocalAccount()).toBe(owner)
      expect(localJournalScopeGeneration()).toBe(generation)
      setActiveLocalAccount(null)
    },
  )

  it("preserves the normal owner and device original when deletion fails or throws", async () => {
    const owner = "deletion-failed-owner"
    const rpc = vi.fn().mockResolvedValueOnce({ error: { message: "synthetic refusal" }, data: null })
      .mockRejectedValueOnce(new Error("synthetic offline"))
    supabaseMock.mockResolvedValue(verifiedClient(rpc, owner))
    localStorage.setItem("trainoracle.journal.v1", "synthetic original unchanged")
    setActiveLocalAccount(owner)
    expect(await requestServerAccountDeletion(owner)).toMatchObject({ ok: false })
    expect(await requestServerAccountDeletion(owner)).toMatchObject({ ok: false })
    expect(isAccountDeletionClosed(owner)).toBe(false)
    expect(activeLocalAccount()).toBe(owner)
    expect(localStorage.getItem("trainoracle.journal.v1")).toBe("synthetic original unchanged")
    setActiveLocalAccount(null)
  })

  it("closes the owner's local generation on a valid deletion before any logout callback", async () => {
    const owner = "deletion-confirmed-owner"
    const rpc = vi.fn().mockResolvedValue({ data: "2026-10-07T09:10:11.123456+00:00", error: null })
    supabaseMock.mockResolvedValue(verifiedClient(rpc, owner))
    setActiveLocalAccount(owner)
    const generation = localJournalScopeGeneration()
    expect(await requestServerAccountDeletion(owner)).toMatchObject({ ok: true })
    expect(activeLocalAccount()).toBeNull()
    expect(localJournalScopeGeneration()).toBeGreaterThan(generation)
    expect(isAccountDeletionClosed(owner)).toBe(true)
    setActiveLocalAccount("deletion-confirmed-other")
    expect(activeLocalAccount()).toBe("deletion-confirmed-other")
    setActiveLocalAccount(owner)
    expect(activeLocalAccount()).toBeNull()
  })

  it("does not close B when A's deletion receipt arrives after a switch", async () => {
    const owner = "deletion-switched-a", other = "deletion-switched-b"
    let resolve!: (value: { data: string; error: null }) => void
    const rpc = vi.fn(() => new Promise(done => { resolve = done }))
    supabaseMock.mockResolvedValue(verifiedClient(rpc, owner))
    setActiveLocalAccount(owner)
    const request = requestServerAccountDeletion(owner)
    await vi.waitFor(() => expect(rpc).toHaveBeenCalledOnce())
    setActiveLocalAccount(other)
    const generation = localJournalScopeGeneration()
    resolve({ data: "2026-10-07T00:00:00Z", error: null })
    expect(await request).toMatchObject({ ok: true })
    expect(isAccountDeletionClosed(owner)).toBe(true)
    expect(activeLocalAccount()).toBe(other)
    expect(localJournalScopeGeneration()).toBe(generation)
    setActiveLocalAccount(null)
  })

  it("discards late server admission after deletion instead of publishing a ready profile", async () => {
    const owner = "deletion-late-admission"
    let resolve!: (value: { data: string; error: null }) => void
    const rpc = vi.fn(() => new Promise(done => { resolve = done }))
    supabaseMock.mockResolvedValue(verifiedClient(rpc, owner))
    const admission = loadPrivateProfileSetupStatus({ userId: owner })
    await vi.waitFor(() => expect(rpc).toHaveBeenCalledOnce())
    closeAccountDeletionBoundary(owner, "2026-10-07T00:00:00Z")
    resolve({ data: "ADMITTED", error: null })
    expect(await admission).toMatchObject({ ok: false, ready: false, canComplete: false })
  })

  it("does not claim an admitted or deleted owner when local protection storage is unreadable", async () => {
    const owner = "deletion-service-unknown"
    const rpc = vi.fn()
    supabaseMock.mockResolvedValue(verifiedClient(rpc, owner))
    const read = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("synthetic unavailable") })
    const setup = await loadPrivateProfileSetupStatus({ userId: owner })
    expect(setup).toMatchObject({ ok: false, ready: false, canComplete: false })
    expect(setup.message).not.toContain("삭제를 요청")
    expect(await savePrivateProfile({ ...profileInput, userId: owner })).toMatchObject({ ok: false })
    expect(rpc).not.toHaveBeenCalled()
    read.mockRestore()
  })
})
