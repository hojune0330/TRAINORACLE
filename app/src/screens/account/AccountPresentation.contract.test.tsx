import { readFileSync } from "node:fs"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { AccountAuthGateway } from "./AccountAuthGateway"
import { AccountSyncPanel } from "./AccountSyncPanel"
import { CoachSupportPanel } from "./CoachSupportPanel"
import { PrivateMemoVault } from "./PrivateMemoVault"
import { SwitchAccountPanel } from "./SwitchAccountPanel"
import { inputStyle, primaryBtn } from "./styles"

const config = {
  url: "https://example.supabase.co",
  anonKey: "synthetic-public-key",
  kakaoAuthEnabled: false,
  phoneAuthEnabled: true,
  privacyPolicy: { url: "https://trainoracle.example/privacy", version: "2026-09-12" },
  termsOfService: { url: "https://trainoracle.example/terms", version: "2026-09-12" },
}

beforeEach(() => {
  window.localStorage.clear()
  window.sessionStorage.clear()
  vi.stubEnv("VITE_FEATURE_ACCOUNT_JOURNAL", "false")
  vi.stubEnv("VITE_KILL_ACCOUNT_JOURNAL", "false")
})

afterEach(() => {
  cleanup()
  vi.unstubAllEnvs()
})

describe("DS-06 account presentation fixtures", () => {
  it("loads the account stylesheet in production and keeps controls touch-safe and reflowable", () => {
    const main = readFileSync("src/main.tsx", "utf8")
    const css = readFileSync("src/styles/account-auth.css", "utf8")
    const accountButtonRule = css.match(/\.account-panel :where\(button\)\s*\{[^}]*\}/u)?.[0] ?? ""
    const accountControlRule = css.match(/\.account-panel__control\s*\{[^}]*\}/u)?.[0] ?? ""

    expect(main).toContain('import "./styles/account-auth.css"')
    expect(inputStyle.minHeight).toBe("var(--app-touch-min)")
    expect(primaryBtn.minHeight).toBe(48)
    expect(accountButtonRule).toContain("min-height: var(--app-touch-min)")
    expect(accountControlRule).toContain("min-height: var(--app-touch-min)")
    expect(css).toMatch(/@media \(max-width: 380px\)[\s\S]*?\.account-panel__actions--split,[\s\S]*?grid-template-columns: minmax\(0, 1fr\)/u)
  })

  it("keeps a failed synthetic email request visible as an error without clearing the input", async () => {
    const send = vi.fn().mockResolvedValue({ ok: false, message: "합성 이메일 오류" })
    const user = userEvent.setup()
    render(<AccountAuthGateway config={config} today="2026-09-12" onRequestEmailOtp={send} />)

    await user.click(screen.getByRole("button", { name: "이메일로 계속하기" }))
    fireEvent.change(screen.getByLabelText("생년월일"), { target: { value: "2000-01-01" } })
    await user.click(screen.getByRole("checkbox", { name: /필수 약관에 모두 동의/u }))
    await user.click(screen.getByRole("button", { name: "이메일 입력하기" }))
    await user.type(screen.getByLabelText("이메일"), "runner@example.com")
    await user.click(screen.getByRole("button", { name: "확인 이메일 받기" }))

    expect(send).toHaveBeenCalledWith("runner@example.com")
    expect(screen.getByLabelText("이메일")).toHaveValue("runner@example.com")
    expect(screen.getByRole("status")).toHaveAttribute("data-state", "error")
  })

  it("marks synthetic phone delivery success and verification handoff as distinct states", async () => {
    const send = vi.fn().mockResolvedValue({ ok: true, message: "합성 문자 전송 완료" })
    const verify = vi.fn().mockResolvedValue({ ok: true, message: "합성 로그인 완료" })
    const user = userEvent.setup()
    render(
      <AccountAuthGateway
        config={config}
        today="2026-09-12"
        onRequestPhoneOtp={send}
        onVerifyPhoneOtp={verify}
      />,
    )

    await user.click(screen.getByRole("button", { name: "휴대전화로 계속하기" }))
    fireEvent.change(screen.getByLabelText("생년월일"), { target: { value: "2000-01-01" } })
    await user.click(screen.getByRole("checkbox", { name: /필수 약관에 모두 동의/u }))
    await user.click(screen.getByRole("button", { name: "휴대전화 번호 입력하기" }))
    await user.type(screen.getByLabelText("휴대전화 번호"), "010-1234-5678")
    await user.click(screen.getByRole("button", { name: "문자로 인증번호 받기" }))
    expect(screen.getByRole("status")).toHaveAttribute("data-state", "success")

    await user.type(screen.getByLabelText(/010-\*{4}-5678로 보낸 번호/u), "123456")
    await user.click(screen.getByRole("button", { name: "로그인 완료하기" }))
    expect(verify).toHaveBeenCalledWith("010-1234-5678", "123456")
    expect(screen.getByRole("status")).toHaveAttribute("data-state", "pending")
  })

  it("distinguishes informational, failed-preview, and completed synthetic sync states", async () => {
    const view = render(<AccountSyncPanel userId="synthetic-athlete" enabled={false} />)
    expect(screen.getByRole("status")).toHaveAttribute("data-state", "info")
    view.unmount()

    const preview = vi.fn().mockResolvedValue({ ok: false, message: "합성 미리보기 오류" })
    const user = userEvent.setup()
    render(<AccountSyncPanel userId="synthetic-athlete" enabled onPreview={preview} />)
    await user.click(screen.getByRole("checkbox", { name: "동기화 켜기" }))
    await user.click(screen.getByRole("button", { name: "합칠 내용 미리보기" }))
    expect(screen.getByRole("status")).toHaveAttribute("data-state", "error")
    cleanup()
    window.localStorage.clear()

    const successfulPreview = vi.fn().mockResolvedValue({
      ok: true,
      message: "합성 미리보기 완료",
      localCount: 1,
      remoteJournalCount: 2,
      remotePrivateCount: 0,
    })
    const sync = vi.fn().mockResolvedValue({
      ok: true,
      message: "합성 동기화 완료",
      pulled: 2,
      pushed: 1,
      deleted: 0,
      total: 3,
    })
    render(<AccountSyncPanel userId="synthetic-athlete" enabled onPreview={successfulPreview} onSync={sync} />)
    await user.click(screen.getByRole("checkbox", { name: "동기화 켜기" }))
    await user.click(screen.getByRole("button", { name: "합칠 내용 미리보기" }))
    await user.click(await screen.findByRole("button", { name: "확인한 내용 합치기" }))
    expect(screen.getByRole("status")).toHaveAttribute("data-state", "success")
  })

  it("keeps local validation and injected account actions out of the network path", async () => {
    const saveCode = vi.fn()
    const user = userEvent.setup()
    const view = render(<PrivateMemoVault onSaveCode={saveCode} />)
    await user.type(screen.getByLabelText("기존 복구 코드"), "synthetic-invalid-code")
    await user.click(screen.getByRole("button", { name: "이 세션에서 메모 열기" }))
    expect(saveCode).not.toHaveBeenCalled()
    expect(screen.getByRole("status")).toHaveAttribute("data-state", "error")
    view.unmount()

    const createInvitation = vi.fn().mockResolvedValue({ ok: true, message: "합성 초대 생성", code: "TEST-CODE-ONLY" })
    render(
      <CoachSupportPanel
        userId="synthetic-athlete"
        today="2026-09-12"
        onCreateInvitation={createInvitation}
        onAcceptInvitation={vi.fn()}
      />,
    )
    fireEvent.change(screen.getByLabelText("시즌 종료일"), { target: { value: "2026-12-31" } })
    await user.click(screen.getByRole("button", { name: "코치·지원자 초대 코드 만들기" }))
    expect(createInvitation).toHaveBeenCalledWith("synthetic-athlete", "2026-12-31")
    expect(screen.getByText("합성 초대 생성")).toHaveAttribute("data-state", "success")
  })

  it("keeps a synthetic account-switch failure in the error state", async () => {
    window.localStorage.setItem("trainoracle.sync.owner.v1", "synthetic-athlete")
    const user = userEvent.setup()
    render(
      <SwitchAccountPanel
        onSignOut={vi.fn()}
        onRelease={() => ({ ok: false, message: "합성 연결 해제 오류" })}
      />,
    )

    await user.click(screen.getByTestId("switch-account-start"))
    await user.click(screen.getByTestId("switch-account-confirm"))
    expect(screen.getByTestId("switch-account-result")).toHaveAttribute("data-state", "error")
    expect(screen.getByTestId("switch-account-result")).toHaveAttribute("role", "status")
  })
})
