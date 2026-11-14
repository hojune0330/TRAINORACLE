import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { AccountAuthGateway } from "./AccountAuthGateway"
import { requestBrowserBackLayer } from "../../navigation/browserNavigation"

const config = {
  url: "https://example.supabase.co",
  anonKey: "public-anon-key",
  kakaoAuthEnabled: true,
  googleAuthEnabled: true,
  emailAuthEnabled: true,
  phoneAuthEnabled: false,
  privacyPolicy: { url: "https://trainoracle.example/privacy", version: "2026-08-25" },
  termsOfService: { url: "https://trainoracle.example/terms", version: "2026-08-25" },
}

beforeEach(() => sessionStorage.clear())
afterEach(cleanup)

describe("mobile-first account authentication gateway", () => {
  it("starts Google signup first without recording birth or consent facts", async () => {
    const social = vi.fn().mockResolvedValue({ ok: true, message: "redirect" })
    render(<AccountAuthGateway config={config} today="2026-08-25" onSocialSignIn={social} />)
    await userEvent.click(screen.getByRole("button", { name: "회원가입" }))
    await userEvent.click(screen.getByRole("button", { name: "Google로 회원가입" }))
    expect(social).toHaveBeenCalledWith("google", expect.stringMatching(/^[a-f0-9]{32}$/u))
    expect(screen.queryByLabelText("생년월일")).toBeNull()
    expect(screen.queryByRole("checkbox")).toBeNull()
    expect(JSON.parse(sessionStorage.getItem("trainoracle.account.pending-setup.v1") ?? "{}")).toMatchObject({
      schemaVersion: 5, flow: "AUTH_ONLY", entryMode: "signup", method: "google", phase: "AUTH_STARTED",
      birthDate: null, privacyPolicyVersion: null, termsOfServiceVersion: null,
    })
    await userEvent.click(screen.getByRole("button", { name: "로그인" }))
    expect(screen.getByRole("button", { name: "Google로 로그인" })).toBeVisible()
    expect(sessionStorage.length).toBe(0)
  })

  it("formats eight typed birth-date digits without requiring a calendar picker", async () => {
    render(<AccountAuthGateway config={config} today="2026-08-25" />)

    await userEvent.click(screen.getByRole("button", { name: "이메일로 로그인" }))
    const birthDate = screen.getByLabelText("생년월일")
    await userEvent.type(birthDate, "2000")
    expect(screen.getByRole("button", { name: "이메일 입력하기" })).toBeDisabled()
    await userEvent.type(birthDate, "0101")

    expect(birthDate).toHaveValue("2000-01-01")
    expect(screen.getByRole("button", { name: "이메일 입력하기" })).toBeEnabled()
  })

  it("shows Kakao, Google, and email as online-first options without a local-mode exit", () => {
    render(<AccountAuthGateway config={config} today="2026-08-25" />)

    expect(screen.getByRole("button", { name: "카카오로 로그인" })).toBeVisible()
    expect(screen.getByRole("button", { name: "Google로 로그인" })).toBeVisible()
    expect(screen.getByRole("button", { name: "이메일로 로그인" })).toBeVisible()
    expect(screen.queryByRole("button", { name: "휴대전화로 로그인" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "계정 없이 계속 사용" })).not.toBeInTheDocument()
    expect(screen.getByText("가입할 때 쓴 계정으로 로그인하세요.")).toBeVisible()
    expect(screen.getByText(/가입만으로 기록이 업로드되지는 않아요/u)).toBeVisible()
  })

  it("preserves email answers when returning within the unchanged protected email flow", async () => {
    const social = vi.fn()
    render(<AccountAuthGateway config={config} today="2026-08-25" onSocialSignIn={social} />)
    await userEvent.click(screen.getByRole("button", { name: "이메일로 로그인" }))
    fireEvent.change(screen.getByLabelText("생년월일"), { target: { value: "2000-01-01" } })
    await userEvent.click(screen.getByRole("checkbox", { name: /개인정보 처리방침.*확인/u }))
    await userEvent.click(screen.getByRole("checkbox", { name: /이용약관.*동의/u }))
    act(() => { expect(requestBrowserBackLayer()).toBe(true) })
    expect(await screen.findByText("가입할 때 쓴 계정으로 로그인하세요.")).toBeVisible()
    await userEvent.click(screen.getByRole("button", { name: "이메일로 로그인" }))
    expect(screen.getByLabelText("생년월일")).toHaveValue("2000-01-01")
    expect(screen.getByRole("checkbox", { name: /이용약관.*동의/u })).toBeChecked()
    expect(social).not.toHaveBeenCalled()
  })

  it("hides Kakao when the provider has not been released", () => {
    render(<AccountAuthGateway config={{ ...config, kakaoAuthEnabled: false }} today="2026-08-25" />)

    expect(screen.queryByRole("button", { name: "카카오로 로그인" })).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Google로 로그인" })).toBeVisible()
    expect(screen.getByRole("button", { name: "이메일로 로그인" })).toBeVisible()
  })

  it("hides Google and email independently when their operational gates are closed", () => {
    render(<AccountAuthGateway config={{ ...config, googleAuthEnabled: false, emailAuthEnabled: false }} today="2026-08-25" />)

    expect(screen.queryByRole("button", { name: "Google로 로그인" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "이메일로 로그인" })).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "카카오로 로그인" })).toBeVisible()
  })

  it("uses Korean phone OTP only when the separately gated method is enabled", async () => {
    const send = vi.fn().mockResolvedValue({ ok: true, message: "문자를 보냈어요." })
    const verify = vi.fn().mockImplementation(async (_phone: string, _code: string, attemptId: string) => {
      const pending = JSON.parse(sessionStorage.getItem("trainoracle.account.pending-setup.v1") ?? "{}") as Record<string, unknown>
      sessionStorage.setItem("trainoracle.account.pending-setup.v1", JSON.stringify({
        ...pending,
        phase: "AUTH_VERIFIED",
        verifiedUserId: "athlete-phone",
        verifiedMethod: "phone",
        verifiedSessionId: "11111111-1111-4111-8111-111111111111",
      }))
      return { ok: true, message: "로그인", verifiedUserId: "athlete-phone", attemptId }
    })
    render(
      <AccountAuthGateway
        config={{ ...config, phoneAuthEnabled: true }}
        today="2026-08-25"
        onRequestPhoneOtp={send}
        onVerifyPhoneOtp={verify}
      />,
    )

    await userEvent.click(screen.getByRole("button", { name: "휴대전화로 로그인" }))
    fireEvent.change(screen.getByLabelText("생년월일"), { target: { value: "2000-01-01" } })
    await userEvent.click(screen.getByRole("checkbox", { name: /개인정보 처리방침.*확인/u }))
    await userEvent.click(screen.getByRole("checkbox", { name: /이용약관.*동의/u }))
    await userEvent.click(screen.getByRole("button", { name: "휴대전화 번호 입력하기" }))
    await userEvent.type(screen.getByLabelText("휴대전화 번호"), "010-1234-5678")
    await userEvent.click(screen.getByRole("button", { name: "문자로 인증번호 받기" }))
    await userEvent.type(screen.getByLabelText(/010-\*{4}-5678로 보낸 번호/u), "123456")
    await userEvent.click(screen.getByRole("button", { name: "로그인 완료하기" }))

    expect(send).toHaveBeenCalledWith("010-1234-5678", expect.stringMatching(/^[a-f0-9]{32}$/u))
    expect(verify).toHaveBeenCalledWith("010-1234-5678", "123456", expect.stringMatching(/^[a-f0-9]{32}$/u))
    expect(screen.getByRole("button", { name: /다시 받기 \(60초\)/u })).toBeDisabled()
  })

  it("keeps the under-14 admission check in the protected email path", async () => {
    const send = vi.fn()
    render(<AccountAuthGateway config={config} today="2026-08-25" onRequestEmailOtp={send} />)
    await userEvent.click(screen.getByRole("button", { name: "이메일로 로그인" }))
    fireEvent.change(screen.getByLabelText("생년월일"), { target: { value: "2013-08-25" } })
    await userEvent.click(screen.getByRole("button", { name: "이메일 입력하기" }))
    expect(send).not.toHaveBeenCalled()
    expect(screen.getByRole("status")).toHaveTextContent("온라인 계정은 만 14세부터")
    expect(screen.getByRole("button", { name: "생년월일 다시 확인" })).toBeVisible()
    expect(sessionStorage.length).toBe(0)
  })

  it("starts Kakao login immediately with authentication-only proof", async () => {
    const socialSignIn = vi.fn().mockResolvedValue({ ok: true, message: "redirect" })
    render(<AccountAuthGateway config={config} today="2026-08-25" onSocialSignIn={socialSignIn} />)
    await userEvent.click(screen.getByRole("button", { name: "카카오로 로그인" }))
    expect(socialSignIn).toHaveBeenCalledWith("kakao", expect.stringMatching(/^[a-f0-9]{32}$/u))
    expect(screen.queryByLabelText("생년월일")).toBeNull()
    expect(JSON.parse(sessionStorage.getItem("trainoracle.account.pending-setup.v1") ?? "{}")).toMatchObject({
      schemaVersion: 5, flow: "AUTH_ONLY", entryMode: "login", method: "kakao", phase: "AUTH_STARTED",
      birthDate: null, privacyPolicyVersion: null, termsOfServiceVersion: null,
    })
  })

  it("keeps only the newest explicit social attempt and clears the replaced intent", async () => {
    const socialSignIn = vi.fn().mockResolvedValue({ ok: true, message: "redirect" })
    render(<AccountAuthGateway config={config} today="2026-08-25" onSocialSignIn={socialSignIn} />)
    await userEvent.click(screen.getByRole("button", { name: "Google로 로그인" }))
    const first = JSON.parse(sessionStorage.getItem("trainoracle.account.pending-setup.v1") ?? "{}")
    await userEvent.click(screen.getByRole("button", { name: "카카오로 로그인" }))
    const second = JSON.parse(sessionStorage.getItem("trainoracle.account.pending-setup.v1") ?? "{}")
    expect(first.attemptId).not.toBe(second.attemptId)
    expect(second.method).toBe("kakao")
    expect(second.birthDate).toBeNull()
    expect(socialSignIn).toHaveBeenCalledTimes(2)
  })

  it("uses a passwordless email confirmation link after the same age and consent gate", async () => {
    const send = vi.fn().mockResolvedValue({ ok: true, message: "확인 링크를 보냈어요." })
    render(
      <AccountAuthGateway
        config={config}
        today="2026-08-25"
        onRequestEmailOtp={send}
      />,
    )

    await userEvent.click(screen.getByRole("button", { name: "이메일로 로그인" }))
    fireEvent.change(screen.getByLabelText("생년월일"), { target: { value: "2000-01-01" } })
    await userEvent.click(screen.getByRole("checkbox", { name: /개인정보 처리방침.*확인/u }))
    await userEvent.click(screen.getByRole("checkbox", { name: /이용약관.*동의/u }))
    await userEvent.click(screen.getByRole("button", { name: "이메일 입력하기" }))
    await userEvent.type(screen.getByLabelText("이메일"), "runner@example.com")
    await userEvent.click(screen.getByRole("button", { name: "확인 이메일 받기" }))

    expect(send).toHaveBeenCalledWith("runner@example.com", expect.stringMatching(/^[a-f0-9]{32}$/u))
    expect(screen.getByRole("heading", { name: "이메일에서 확인 링크를 열어 주세요" })).toBeVisible()
    expect(screen.getByRole("button", { name: "확인 이메일 다시 받기" })).toBeVisible()
    expect(screen.queryByText(/6자리/u)).not.toBeInTheDocument()
  })

  it("rechecks age and legal consent before consuming an email link opened in a new tab", async () => {
    const consume = vi.fn().mockResolvedValue({
      handled: true,
      ok: true,
      message: "확인 완료",
      verifiedUserId: "athlete-email",
      pendingBound: true,
    })
    const attempt = "c".repeat(32)
    const view = render(
      <AccountAuthGateway
        config={config}
        today="2026-08-25"
        emailCallbackAttemptId={attempt}
        onConsumeEmailCallback={consume}
      />,
    )

    fireEvent.change(screen.getByLabelText("생년월일"), { target: { value: "2013-08-25" } })
    await userEvent.type(screen.getByLabelText("확인 링크를 받은 내 이메일"), "runner@example.com")
    await userEvent.click(screen.getByRole("button", { name: "확인하고 로그인하기" }))
    expect(consume).not.toHaveBeenCalled()
    expect(screen.getByText(/온라인 계정은 만 14세부터/u)).toBeVisible()

    view.unmount()
    render(
      <AccountAuthGateway
        config={config}
        today="2026-08-25"
        emailCallbackAttemptId={attempt}
        onConsumeEmailCallback={consume}
      />,
    )
    fireEvent.change(screen.getByLabelText("생년월일"), { target: { value: "2000-01-01" } })
    await userEvent.type(screen.getByLabelText("확인 링크를 받은 내 이메일"), "runner@example.com")
    await userEvent.click(screen.getByRole("checkbox", { name: /개인정보 처리방침.*확인/u }))
    await userEvent.click(screen.getByRole("checkbox", { name: /이용약관.*동의/u }))
    await userEvent.click(screen.getByRole("button", { name: "확인하고 로그인하기" }))
    expect(consume).toHaveBeenCalledOnce()
    expect(JSON.parse(sessionStorage.getItem("trainoracle.account.pending-setup.v1") ?? "{}")).toMatchObject({
      expectedEmail: "runner@example.com",
      phase: "AUTH_STARTED",
    })
  })

  it("recovers the button and explains a provider exception without losing local data", async () => {
    const socialSignIn = vi.fn().mockRejectedValue(new Error("provider unavailable"))
    render(<AccountAuthGateway config={config} today="2026-08-25" onSocialSignIn={socialSignIn} />)

    await userEvent.click(screen.getByRole("button", { name: "Google로 로그인" }))

    expect(screen.getByRole("status")).toHaveTextContent("간편 로그인을 시작하지 못했어요")
    expect(screen.getByRole("button", { name: "Google로 로그인" })).toBeEnabled()
    expect(sessionStorage.length).toBe(0)
  })

  it("clears birth-date and consent facts when an email send fails", async () => {
    const send = vi.fn().mockResolvedValue({ ok: false, message: "전송 실패" })
    render(<AccountAuthGateway config={config} today="2026-08-25" onRequestEmailOtp={send} />)

    await userEvent.click(screen.getByRole("button", { name: "이메일로 로그인" }))
    fireEvent.change(screen.getByLabelText("생년월일"), { target: { value: "2000-01-01" } })
    await userEvent.click(screen.getByRole("checkbox", { name: /개인정보 처리방침.*확인/u }))
    await userEvent.click(screen.getByRole("checkbox", { name: /이용약관.*동의/u }))
    await userEvent.click(screen.getByRole("button", { name: "이메일 입력하기" }))
    await userEvent.type(screen.getByLabelText("이메일"), "runner@example.com")
    await userEvent.click(screen.getByRole("button", { name: "확인 이메일 받기" }))

    expect(screen.getByRole("status")).toHaveTextContent("전송 실패")
    expect(sessionStorage.length).toBe(0)
  })

  it("invalidates the pending phone setup when code verification fails", async () => {
    const send = vi.fn().mockResolvedValue({ ok: true, message: "문자를 보냈어요." })
    const verify = vi.fn().mockResolvedValue({ ok: false, message: "코드 오류" })
    render(
      <AccountAuthGateway
        config={{ ...config, phoneAuthEnabled: true }}
        today="2026-08-25"
        onRequestPhoneOtp={send}
        onVerifyPhoneOtp={verify}
      />,
    )

    await userEvent.click(screen.getByRole("button", { name: "휴대전화로 로그인" }))
    fireEvent.change(screen.getByLabelText("생년월일"), { target: { value: "2000-01-01" } })
    await userEvent.click(screen.getByRole("checkbox", { name: /개인정보 처리방침.*확인/u }))
    await userEvent.click(screen.getByRole("checkbox", { name: /이용약관.*동의/u }))
    await userEvent.click(screen.getByRole("button", { name: "휴대전화 번호 입력하기" }))
    await userEvent.type(screen.getByLabelText("휴대전화 번호"), "010-1234-5678")
    await userEvent.click(screen.getByRole("button", { name: "문자로 인증번호 받기" }))
    await userEvent.type(screen.getByLabelText(/010-\*{4}-5678로 보낸 번호/u), "000000")
    await userEvent.click(screen.getByRole("button", { name: "로그인 완료하기" }))

    expect(screen.getByRole("status")).toHaveTextContent("코드 오류")
    expect(sessionStorage.length).toBe(0)
  })
})


describe("social auth preparation failure", () => {
  it("recovers after blocked session storage without starting OAuth or inventing facts", async () => {
    const social = vi.fn()
    const write = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("storage blocked") })
    try {
      render(<AccountAuthGateway config={config} today="2026-08-25" onSocialSignIn={social} />)
      await userEvent.click(screen.getByRole("button", { name: "Google로 로그인" }))
      expect(screen.getByRole("button", { name: "Google로 로그인" })).toBeEnabled()
      expect(screen.getByRole("status")).toHaveTextContent("간편 로그인을 시작하지 못했어요")
      expect(social).not.toHaveBeenCalled()
      expect(screen.queryByLabelText("생년월일")).toBeNull()
    } finally { write.mockRestore() }
  })
})
