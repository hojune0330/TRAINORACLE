import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { AccountAuthGateway } from "./AccountAuthGateway"

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
  it("formats eight typed birth-date digits without requiring a calendar picker", async () => {
    render(<AccountAuthGateway config={config} today="2026-08-25" />)

    await userEvent.click(screen.getByRole("button", { name: "이메일로 계속하기" }))
    const birthDate = screen.getByLabelText("생년월일")
    await userEvent.type(birthDate, "2000")
    expect(screen.getByRole("button", { name: "이메일 입력하기" })).toBeDisabled()
    await userEvent.type(birthDate, "0101")

    expect(birthDate).toHaveValue("2000-01-01")
    expect(screen.getByRole("button", { name: "이메일 입력하기" })).toBeEnabled()
  })

  it("shows Kakao, Google, and email as online-first options without a local-mode exit", () => {
    render(<AccountAuthGateway config={config} today="2026-08-25" />)

    expect(screen.getByRole("button", { name: "카카오로 계속하기" })).toBeVisible()
    expect(screen.getByRole("button", { name: "Google로 계속하기" })).toBeVisible()
    expect(screen.getByRole("button", { name: "이메일로 계속하기" })).toBeVisible()
    expect(screen.queryByRole("button", { name: "휴대전화로 계속하기" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "계정 없이 계속 사용" })).not.toBeInTheDocument()
    expect(screen.getByText(/로그인하면 기록이 안전하게 남아요/u)).toBeVisible()
    expect(screen.getByText(/로그인한 상태로 쓰는 걸 권해요/u)).toBeVisible()
  })

  it("hides Kakao when the provider has not been released", () => {
    render(<AccountAuthGateway config={{ ...config, kakaoAuthEnabled: false }} today="2026-08-25" />)

    expect(screen.queryByRole("button", { name: "카카오로 계속하기" })).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Google로 계속하기" })).toBeVisible()
    expect(screen.getByRole("button", { name: "이메일로 계속하기" })).toBeVisible()
  })

  it("hides Google and email independently when their operational gates are closed", () => {
    render(<AccountAuthGateway config={{ ...config, googleAuthEnabled: false, emailAuthEnabled: false }} today="2026-08-25" />)

    expect(screen.queryByRole("button", { name: "Google로 계속하기" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "이메일로 계속하기" })).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "카카오로 계속하기" })).toBeVisible()
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

    await userEvent.click(screen.getByRole("button", { name: "휴대전화로 계속하기" }))
    fireEvent.change(screen.getByLabelText("생년월일"), { target: { value: "2000-01-01" } })
    await userEvent.click(screen.getByRole("checkbox", { name: /필수 약관에 모두 동의/u }))
    await userEvent.click(screen.getByRole("button", { name: "휴대전화 번호 입력하기" }))
    await userEvent.type(screen.getByLabelText("휴대전화 번호"), "010-1234-5678")
    await userEvent.click(screen.getByRole("button", { name: "문자로 인증번호 받기" }))
    await userEvent.type(screen.getByLabelText(/010-\*{4}-5678로 보낸 번호/u), "123456")
    await userEvent.click(screen.getByRole("button", { name: "로그인 완료하기" }))

    expect(send).toHaveBeenCalledWith("010-1234-5678", expect.stringMatching(/^[a-f0-9]{32}$/u))
    expect(verify).toHaveBeenCalledWith("010-1234-5678", "123456", expect.stringMatching(/^[a-f0-9]{32}$/u))
    expect(screen.getByRole("button", { name: /다시 받기 \(60초\)/u })).toBeDisabled()
  })

  it("blocks an under-14 user before any Kakao network call", async () => {
    const socialSignIn = vi.fn()
    render(<AccountAuthGateway config={config} today="2026-08-25" onSocialSignIn={socialSignIn} />)

    await userEvent.click(screen.getByRole("button", { name: "카카오로 계속하기" }))
    fireEvent.change(screen.getByLabelText("생년월일"), { target: { value: "2013-08-25" } })
    await userEvent.click(screen.getByRole("button", { name: "카카오로 계속하기" }))

    expect(socialSignIn).not.toHaveBeenCalled()
    expect(screen.getByRole("status")).toHaveTextContent("온라인 계정은 만 14세부터")
    expect(screen.queryByRole("button", { name: "계정 없이 계속 사용" })).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "생년월일 다시 확인" })).toBeVisible()
    expect(sessionStorage.length).toBe(0)
  })

  it("records the approved pre-auth facts before starting Kakao", async () => {
    const socialSignIn = vi.fn().mockResolvedValue({ ok: true, message: "redirect" })
    render(<AccountAuthGateway config={config} today="2026-08-25" onSocialSignIn={socialSignIn} />)

    await userEvent.click(screen.getByRole("button", { name: "카카오로 계속하기" }))
    fireEvent.change(screen.getByLabelText("생년월일"), { target: { value: "2000-01-01" } })
    await userEvent.click(screen.getByRole("checkbox", { name: /필수 약관에 모두 동의/u }))
    await userEvent.click(screen.getByRole("button", { name: "카카오로 계속하기" }))

    expect(socialSignIn).toHaveBeenCalledWith("kakao", expect.stringMatching(/^[a-f0-9]{32}$/u))
    const pending = JSON.parse(sessionStorage.getItem("trainoracle.account.pending-setup.v1") ?? "{}") as Record<string, unknown>
    expect(pending).toMatchObject({
      schemaVersion: 4,
      method: "kakao",
      phase: "AUTH_STARTED",
      privacyPolicyVersion: "2026-08-25",
    })
  })

  it("invalidates an already-started attempt when its birth date is edited", async () => {
    const socialSignIn = vi.fn().mockResolvedValue({ ok: true, message: "redirect" })
    render(<AccountAuthGateway config={config} today="2026-08-25" onSocialSignIn={socialSignIn} />)

    await userEvent.click(screen.getByRole("button", { name: "Google로 계속하기" }))
    fireEvent.change(screen.getByLabelText("생년월일"), { target: { value: "2000-01-01" } })
    await userEvent.click(screen.getByRole("checkbox", { name: /필수 약관에 모두 동의/u }))
    await userEvent.click(screen.getByRole("button", { name: "Google로 계속하기" }))
    expect(sessionStorage.length).toBe(1)

    fireEvent.change(screen.getByLabelText("생년월일"), { target: { value: "2000-01-02" } })
    expect(sessionStorage.length).toBe(0)
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

    await userEvent.click(screen.getByRole("button", { name: "이메일로 계속하기" }))
    fireEvent.change(screen.getByLabelText("생년월일"), { target: { value: "2000-01-01" } })
    await userEvent.click(screen.getByRole("checkbox", { name: /필수 약관에 모두 동의/u }))
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
    await userEvent.click(screen.getByRole("checkbox", { name: /필수 약관에 모두 동의/u }))
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

    await userEvent.click(screen.getByRole("button", { name: "Google로 계속하기" }))
    fireEvent.change(screen.getByLabelText("생년월일"), { target: { value: "2000-01-01" } })
    await userEvent.click(screen.getByRole("checkbox", { name: /필수 약관에 모두 동의/u }))
    await userEvent.click(screen.getByRole("button", { name: "Google로 계속하기" }))

    expect(screen.getByRole("status")).toHaveTextContent("간편 로그인을 시작하지 못했어요")
    expect(screen.getByRole("button", { name: "Google로 계속하기" })).toBeEnabled()
    expect(sessionStorage.length).toBe(0)
  })

  it("clears birth-date and consent facts when an email send fails", async () => {
    const send = vi.fn().mockResolvedValue({ ok: false, message: "전송 실패" })
    render(<AccountAuthGateway config={config} today="2026-08-25" onRequestEmailOtp={send} />)

    await userEvent.click(screen.getByRole("button", { name: "이메일로 계속하기" }))
    fireEvent.change(screen.getByLabelText("생년월일"), { target: { value: "2000-01-01" } })
    await userEvent.click(screen.getByRole("checkbox", { name: /필수 약관에 모두 동의/u }))
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

    await userEvent.click(screen.getByRole("button", { name: "휴대전화로 계속하기" }))
    fireEvent.change(screen.getByLabelText("생년월일"), { target: { value: "2000-01-01" } })
    await userEvent.click(screen.getByRole("checkbox", { name: /필수 약관에 모두 동의/u }))
    await userEvent.click(screen.getByRole("button", { name: "휴대전화 번호 입력하기" }))
    await userEvent.type(screen.getByLabelText("휴대전화 번호"), "010-1234-5678")
    await userEvent.click(screen.getByRole("button", { name: "문자로 인증번호 받기" }))
    await userEvent.type(screen.getByLabelText(/010-\*{4}-5678로 보낸 번호/u), "000000")
    await userEvent.click(screen.getByRole("button", { name: "로그인 완료하기" }))

    expect(screen.getByRole("status")).toHaveTextContent("코드 오류")
    expect(sessionStorage.length).toBe(0)
  })
})
