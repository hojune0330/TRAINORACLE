import { describe, expect, it, vi } from "vitest"
import { closeDeletedAccountSessions } from "./account-session-exit"

describe("deleted account session exit", () => {
  it("confirms every-device logout only after global sign-out succeeds", async () => {
    const onSignOut = vi.fn().mockResolvedValue({ ok: true, message: "provider success" })

    const result = await closeDeletedAccountSessions(onSignOut)

    expect(onSignOut).toHaveBeenCalledTimes(1)
    expect(onSignOut).toHaveBeenCalledWith({ scope: "global" })
    expect(result).toEqual({
      ok: true,
      localSessionClosed: true,
      message: "계정 삭제 요청을 저장했고 모든 기기에서 로그아웃했어요.",
    })
  })

  it("falls back to this browser without claiming other devices were logged out", async () => {
    const onSignOut = vi.fn()
      .mockResolvedValueOnce({ ok: false, message: "global failed" })
      .mockResolvedValueOnce({ ok: true, message: "local success" })

    const result = await closeDeletedAccountSessions(onSignOut)

    expect(onSignOut.mock.calls).toEqual([[{ scope: "global" }], [{ scope: "local" }]])
    expect(result.ok).toBe(false)
    expect(result.localSessionClosed).toBe(true)
    expect(result.message).toContain("다른 기기의 로그아웃은 확인하지 못했어요")
    expect(result.message).not.toContain("모든 기기에서 로그아웃했어요")
  })

  it("keeps the local account state when neither sign-out can be confirmed", async () => {
    const onSignOut = vi.fn()
      .mockRejectedValueOnce(new Error("global exception"))
      .mockResolvedValueOnce({ ok: false, message: "local failed" })

    const result = await closeDeletedAccountSessions(onSignOut)

    expect(onSignOut.mock.calls).toEqual([[{ scope: "global" }], [{ scope: "local" }]])
    expect(result.ok).toBe(false)
    expect(result.localSessionClosed).toBe(false)
    expect(result.message).toContain("로그아웃을 확인하지 못했어요")
  })
})
