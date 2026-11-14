import React from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { AccountLoginMethods } from "./AccountLoginMethods"

afterEach(cleanup)
describe("account password management", () => {
  it("returns to login after a successful update ends the session", async () => {
    const actions = {
      loadAccountAuthMethods: vi.fn().mockResolvedValue({ ok: true, providers: ["email"], hasPassword: true, message: "" }),
      updateAccountPassword: vi.fn().mockResolvedValue({ ok: true, state: "LOGIN_REQUIRED", message: "다시 로그인해 주세요" }),
      requestAccountPasswordReauthentication: vi.fn(),
    }
    const onLoginRequired = vi.fn()
    render(<AccountLoginMethods userId="owner" actions={actions} onLoginRequired={onLoginRequired} />)
    await screen.findByLabelText("현재 비밀번호")
    fireEvent.change(screen.getByLabelText("현재 비밀번호"), { target: { value: "oldpassword" } })
    fireEvent.change(screen.getByLabelText("새 비밀번호"), { target: { value: "newpassword" } })
    fireEvent.click(screen.getByRole("button", { name: "비밀번호 저장" }))
    await screen.findByText("다시 로그인해 주세요")
    expect(onLoginRequired).toHaveBeenCalledOnce()
    expect(screen.getByLabelText("현재 비밀번호")).toHaveValue("")
    expect(screen.getByLabelText("새 비밀번호")).toHaveValue("")
  })
  it("keeps the existing password available for the nonce retry", async () => {
    const actions = {
      loadAccountAuthMethods: vi.fn().mockResolvedValue({ ok: true, providers: ["email"], hasPassword: true, message: "" }),
      updateAccountPassword: vi.fn().mockResolvedValueOnce({ ok: false, state: "REAUTH_REQUIRED", message: "확인이 필요해요" }).mockResolvedValueOnce({ ok: true, state: "UPDATED", message: "저장했어요" }),
      requestAccountPasswordReauthentication: vi.fn(),
    }
    render(<AccountLoginMethods userId="owner" actions={actions} />)
    await screen.findByLabelText("현재 비밀번호")
    fireEvent.change(screen.getByLabelText("현재 비밀번호"), { target: { value: "oldpassword" } })
    fireEvent.change(screen.getByLabelText("새 비밀번호"), { target: { value: "newpassword" } })
    fireEvent.click(screen.getByRole("button", { name: "비밀번호 저장" }))
    await screen.findByLabelText("인증 코드")
    expect(screen.getByLabelText("현재 비밀번호")).toHaveValue("oldpassword")
    fireEvent.change(screen.getByLabelText("인증 코드"), { target: { value: "123456" } })
    fireEvent.click(screen.getByRole("button", { name: "비밀번호 저장" }))
    await screen.findByText("저장했어요")
    expect(actions.updateAccountPassword).toHaveBeenLastCalledWith({ userId: "owner", password: "newpassword", currentPassword: "oldpassword", nonce: "123456" })
    expect(screen.getByLabelText("현재 비밀번호")).toHaveValue("")
    expect(screen.getByLabelText("새 비밀번호")).toHaveValue("")
  })
  it("requires an explicit code request after reauthentication and clears secrets on success", async () => {
    const actions = {
      loadAccountAuthMethods: vi.fn().mockResolvedValue({ ok: true, providers: ["google"], hasPassword: false, message: "" }),
      updateAccountPassword: vi.fn().mockResolvedValueOnce({ ok: false, state: "REAUTH_REQUIRED", message: "확인이 필요해요" }).mockResolvedValueOnce({ ok: true, state: "UPDATED", message: "저장했어요" }),
      requestAccountPasswordReauthentication: vi.fn().mockResolvedValue({ ok: true, message: "코드를 보냈어요" }),
    }
    render(<AccountLoginMethods userId="owner" actions={actions} />)
    await screen.findByText("Google")
    fireEvent.change(screen.getByLabelText("새 비밀번호"), { target: { value: "newpassword" } })
    fireEvent.click(screen.getByRole("button", { name: "비밀번호 저장" }))
    await screen.findByLabelText("인증 코드")
    expect(actions.requestAccountPasswordReauthentication).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole("button", { name: "인증 코드 보내기" }))
    await screen.findByText("코드를 보냈어요")
    fireEvent.change(screen.getByLabelText("인증 코드"), { target: { value: "123456" } })
    fireEvent.click(screen.getByRole("button", { name: "비밀번호 저장" }))
    await screen.findByText("저장했어요")
    expect(actions.updateAccountPassword).toHaveBeenLastCalledWith({ userId: "owner", password: "newpassword", currentPassword: undefined, nonce: "123456" })
    expect(screen.getByLabelText("새 비밀번호")).toHaveValue("")
    expect(screen.queryByLabelText("인증 코드")).toBeNull()
  })
  it("cancels secrets and ignores a load that completes after switching accounts", async () => {
    let resolve!: (value: unknown) => void
    const actions = { loadAccountAuthMethods: vi.fn().mockImplementationOnce(() => new Promise(r => { resolve = r })).mockResolvedValue({ ok: true, providers: ["kakao"], hasPassword: true, message: "" }), updateAccountPassword: vi.fn(), requestAccountPasswordReauthentication: vi.fn() }
    const { rerender } = render(<AccountLoginMethods userId="old" actions={actions} />)
    rerender(<AccountLoginMethods userId="new" actions={actions} />)
    await screen.findByText("카카오")
    resolve({ ok: true, providers: ["google"], hasPassword: false, message: "" })
    await waitFor(() => expect(screen.queryByText("Google")).toBeNull())
    fireEvent.change(screen.getByLabelText("현재 비밀번호"), { target: { value: "oldsecret" } })
    fireEvent.change(screen.getByLabelText("새 비밀번호"), { target: { value: "newsecret" } })
    fireEvent.click(screen.getByRole("button", { name: "취소" }))
    expect(screen.getByLabelText("현재 비밀번호")).toHaveValue("")
    expect(screen.getByLabelText("새 비밀번호")).toHaveValue("")
    expect(actions.updateAccountPassword).not.toHaveBeenCalled()
  })
})
