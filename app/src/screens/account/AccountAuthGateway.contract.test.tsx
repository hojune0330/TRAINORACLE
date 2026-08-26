import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { AccountAuthGateway } from "./AccountAuthGateway"

const config = {
  url: "https://example.supabase.co",
  anonKey: "public-anon-key",
  kakaoAuthEnabled: true,
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

  it("shows Kakao, Google, email, and an honest local-only exit on the first screen", () => {
    render(<AccountAuthGateway config={config} today="2026-08-25" onLocalContinue={vi.fn()} />)

    expect(screen.getByRole("button", { name: "카카오로 계속하기" })).toBeVisible()
    expect(screen.getByRole("button", { name: "Google로 계속하기" })).toBeVisible()
    expect(screen.getByRole("button", { name: "이메일로 계속하기" })).toBeVisible()
    expect(screen.queryByRole("button", { name: "휴대전화로 계속하기" })).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "계정 없이 계속 사용" })).toBeVisible()
  })

  it("hides Kakao when the provider has not been released", () => {
    render(<AccountAuthGateway config={{ ...config, kakaoAuthEnabled: false }} today="2026-08-25" onLocalContinue={vi.fn()} />)

    expect(screen.queryByRole("button", { name: "카카오로 계속하기" })).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Google로 계속하기" })).toBeVisible()
    expect(screen.getByRole("button", { name: "이메일로 계속하기" })).toBeVisible()
  })

  it("uses Korean phone OTP only when the separately gated method is enabled", async () => {
    const send = vi.fn().mockResolvedValue({ ok: true, message: "문자를 보냈어요." })
    const verify = vi.fn().mockResolvedValue({ ok: true, message: "로그인" })
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

    expect(send).toHaveBeenCalledWith("010-1234-5678")
    expect(verify).toHaveBeenCalledWith("010-1234-5678", "123456")
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
    expect(sessionStorage.length).toBe(0)
  })

  it("records the approved pre-auth facts before starting Kakao", async () => {
    const socialSignIn = vi.fn().mockResolvedValue({ ok: true, message: "redirect" })
    render(<AccountAuthGateway config={config} today="2026-08-25" onSocialSignIn={socialSignIn} />)

    await userEvent.click(screen.getByRole("button", { name: "카카오로 계속하기" }))
    fireEvent.change(screen.getByLabelText("생년월일"), { target: { value: "2000-01-01" } })
    await userEvent.click(screen.getByRole("checkbox", { name: /필수 약관에 모두 동의/u }))
    await userEvent.click(screen.getByRole("button", { name: "카카오로 계속하기" }))

    expect(socialSignIn).toHaveBeenCalledWith("kakao")
    expect(sessionStorage.getItem("trainoracle.account.pending-setup.v1")).toContain("2026-08-25")
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

    expect(send).toHaveBeenCalledWith("runner@example.com")
    expect(screen.getByRole("heading", { name: "이메일에서 확인 링크를 열어 주세요" })).toBeVisible()
    expect(screen.getByRole("button", { name: "확인 이메일 다시 받기" })).toBeVisible()
    expect(screen.queryByText(/6자리/u)).not.toBeInTheDocument()
  })

  it("recovers the button and explains a provider exception without losing local use", async () => {
    const socialSignIn = vi.fn().mockRejectedValue(new Error("provider unavailable"))
    render(<AccountAuthGateway config={config} today="2026-08-25" onSocialSignIn={socialSignIn} onLocalContinue={vi.fn()} />)

    await userEvent.click(screen.getByRole("button", { name: "Google로 계속하기" }))
    fireEvent.change(screen.getByLabelText("생년월일"), { target: { value: "2000-01-01" } })
    await userEvent.click(screen.getByRole("checkbox", { name: /필수 약관에 모두 동의/u }))
    await userEvent.click(screen.getByRole("button", { name: "Google로 계속하기" }))

    expect(screen.getByRole("status")).toHaveTextContent("간편 로그인을 시작하지 못했어요")
    expect(screen.getByRole("button", { name: "Google로 계속하기" })).toBeEnabled()
  })
})
