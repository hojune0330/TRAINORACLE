import { afterEach, describe, expect, it, vi } from "vitest"
import { authReturnUrl, signInWithProvider } from "./auth"

const { supabaseMock } = vi.hoisted(() => ({ supabaseMock: vi.fn() }))
vi.mock("./supabase-client", () => ({ supabase: supabaseMock }))

afterEach(() => {
  vi.clearAllMocks()
})

describe("simple social authentication", () => {
  it("returns to the account screen without losing the deployed subpath", () => {
    expect(authReturnUrl("https://hojune0330.github.io/TRAINORACLE/?from=plan#token"))
      .toBe("https://hojune0330.github.io/TRAINORACLE/?from=plan&account=1")
  })

  it.each(["kakao", "google"] as const)("starts %s through the same Supabase OAuth boundary", async (provider) => {
    const signInWithOAuth = vi.fn().mockResolvedValue({ error: null })
    supabaseMock.mockResolvedValue({ auth: { signInWithOAuth } })

    await expect(signInWithProvider(provider)).resolves.toMatchObject({ ok: true })
    expect(signInWithOAuth).toHaveBeenCalledWith({
      provider,
      options: { redirectTo: expect.stringContaining("account=1") },
    })
  })

  it("fails closed when the provider cannot be started", async () => {
    const signInWithOAuth = vi.fn().mockResolvedValue({ error: new Error("provider disabled") })
    supabaseMock.mockResolvedValue({ auth: { signInWithOAuth } })

    await expect(signInWithProvider("kakao")).resolves.toEqual({
      ok: false,
      message: "카카오 로그인을 시작하지 못했어요.",
    })
  })
})
