import React from "react"
import { act, cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  currentUser: vi.fn(),
  isCurrentAttempt: vi.fn(),
  signOut: vi.fn(),
  clearPending: vi.fn(),
  clearPendingForAttempt: vi.fn(),
  clearReceipt: vi.fn(),
  consumeEmailCallback: vi.fn(),
  loadSetup: vi.fn(),
  finalize: vi.fn(),
  pending: null as import("../domain/account/auth-onboarding").PendingAccountSetup | null,
  passwordCallback: false, passwordActive: false, passwordComplete: vi.fn(),
  oauthResult: { handled: false } as { handled: boolean; ok?: boolean; message?: string },
  authListener: null as null | ((user: { id: string; email: string | null; phone: null; provider: "email" } | null) => void),
  gatewayEmailResult: null as null | {
    handled: true
    ok: boolean
    message: string
    verifiedUserId?: string
    unsafeSessionOpen?: boolean
  },
}))

vi.mock("../domain/account/auth", () => ({
  authReturnAttemptId: () => null,
  clearAuthReturnAttemptIdFromUrl: vi.fn(),
  currentUser: mocks.currentUser,
  maskPhoneNumber: (value: string) => value,
  onAuthChange: (listener: NonNullable<typeof mocks.authListener>) => {
    mocks.authListener = listener
    return () => { mocks.authListener = null }
  },
  signOut: mocks.signOut,
}))

vi.mock("../domain/account/auth-onboarding", () => ({
  clearCurrentSetupReceipt: mocks.clearReceipt,
  clearPendingAccountSetup: mocks.clearPending,
  clearPendingAccountSetupForAttempt: mocks.clearPendingForAttempt,
  finalizePendingAccountSetup: mocks.finalize,
  hasCurrentSetupReceipt: () => true,
  readPendingAccountSetup: () => mocks.pending,
  writeCurrentSetupReceipt: vi.fn(),
}))

vi.mock("../domain/account/email-auth-callback", () => ({
  consumeCapturedEmailAuthCallback: mocks.consumeEmailCallback,
}))

vi.mock("../domain/account/password-auth", () => ({
  PASSWORD_MIN_LENGTH: 6, PASSWORD_MAX_LENGTH: 1024,
  hasPasswordRecoveryCallback: () => mocks.passwordCallback,
  isPasswordRecoveryActive: () => mocks.passwordActive,
  onPasswordAuthStateChange: () => () => {},
  completePasswordAuthCallback: mocks.passwordComplete,
  signInWithEmailPassword: vi.fn(), signUpWithEmailPassword: vi.fn(), requestPasswordRecovery: vi.fn(), resendPasswordSignupEmail: vi.fn(), updateRecoveredPassword: vi.fn(), cancelPasswordRecovery: vi.fn(),
}))

vi.mock("../domain/account/oauth-auth-callback", () => ({
  consumeCapturedOAuthAuthCallback: vi.fn(async () => mocks.oauthResult),
}))

vi.mock("../domain/account/account-service", () => ({
  loadPrivateProfileSetupStatus: mocks.loadSetup,
}))

vi.mock("../domain/account/config", () => ({
  accountConfig: () => ({
    url: "https://example.supabase.co",
    anonKey: "synthetic-public-key",
    kakaoAuthEnabled: true,
    googleAuthEnabled: true,
    emailAuthEnabled: true,
    phoneAuthEnabled: false,
    privacyPolicy: { url: "https://example.test/privacy", version: "2026-08-26" },
    termsOfService: { url: "https://example.test/terms", version: "2026-08-26" },
  }),
}))

vi.mock("../domain/account/account-settings", async importOriginal => ({
  ...await importOriginal<typeof import("../domain/account/account-settings")>(),
  isCurrentAccountAuthAttempt: mocks.isCurrentAttempt,
}))

vi.mock("../domain/account/service-date", () => ({ koreaServiceDate: () => "2026-10-03" }))
vi.mock("../domain/account/account-journal-api", () => ({ accountJournalPreviewEnabled: () => false }))
vi.mock("../components/InstallShortcut", () => ({ InstallShortcutSuggestion: () => null }))
vi.mock("./account/LoungeEntry", () => ({ LoungeEntry: () => null }))
vi.mock("./account/BetaAccountSettings", () => ({ BetaAccountSettings: ({ completionOnly, dataRightsOnly }: { completionOnly?: boolean; dataRightsOnly?: boolean }) => completionOnly ? <p data-testid="required-signup-fields">생년월일·필수 동의</p> : dataRightsOnly ? <p>합성 계정 삭제 관리</p> : null }))
vi.mock("./account/AccountAuthGateway", () => ({
  AccountAuthGateway: ({ emailCallbackAttemptId, onEmailCallbackFinished }: {
    emailCallbackAttemptId?: string | null
    onEmailCallbackFinished?: (result: NonNullable<typeof mocks.gatewayEmailResult>) => void
  }) => emailCallbackAttemptId
    ? (
        <button type="button" onClick={() => {
          if (mocks.gatewayEmailResult !== null) onEmailCallbackFinished?.(mocks.gatewayEmailResult)
        }}>
          합성 이메일 확인 완료
        </button>
      )
    : <div data-testid="guest-auth-gateway">guest</div>,
}))
vi.mock("./account/AccountJournalDraftPanel", () => ({ AccountJournalDraftPanel: () => null }))
vi.mock("./account/AccountJournalHistory", () => ({ AccountJournalHistory: () => null }))
vi.mock("./account/AccountJournalMigration", () => ({ AccountJournalMigration: () => null }))
vi.mock("./account/index", () => ({
  AccountNetworkSettings: ({ onDeletionCompleted }: {
    onDeletionCompleted?: () => Promise<{ ok: boolean; message: string }>
  }) => (
    <button type="button" onClick={() => void onDeletionCompleted?.()}>
      합성 삭제 완료
    </button>
  ),
  AccountSyncPanel: () => null,
  DeviceJournalOwnershipPanel: () => null,
  DeviceTrainingDataPanel: () => null,
  EraseLocalData: () => null,
  SwitchAccountPanel: () => null,
}))

import { Account } from "./Account"
import { closeAccountDeletionBoundary } from "../domain/account/account-deletion-boundary"
import { activeLocalAccount, localJournalScopeGeneration, onLocalJournalScopeChange, setActiveLocalAccount } from "../domain/account/local-journal-ownership"
import { startVerifiedAccountScope } from "../domain/account/verified-account-scope"

beforeEach(() => {
  localStorage.clear()
  setActiveLocalAccount(null)
  mocks.isCurrentAttempt.mockReset(); mocks.isCurrentAttempt.mockResolvedValue(true)
  mocks.currentUser.mockReset()
  mocks.currentUser.mockResolvedValue({
    id: "athlete-a",
    email: "runner@example.com",
    phone: null,
    provider: "email",
  })
  mocks.signOut.mockReset()
  mocks.clearPending.mockReset()
  mocks.clearPendingForAttempt.mockReset()
  mocks.clearReceipt.mockReset()
  mocks.consumeEmailCallback.mockReset()
  mocks.consumeEmailCallback.mockResolvedValue({ handled: false })
  mocks.loadSetup.mockReset()
  mocks.loadSetup.mockResolvedValue({ ok: true, ready: true, message: "준비됨" })
  mocks.passwordCallback = false; mocks.passwordActive = false
  mocks.passwordComplete.mockReset(); mocks.passwordComplete.mockResolvedValue({ ok: true, state: "RECOVERY_READY", recoveryEmail: "verified@example.com", message: "새 비밀번호를 입력해 주세요." })
  mocks.pending = null
  mocks.oauthResult = { handled: false }
  mocks.finalize.mockReset(); mocks.finalize.mockResolvedValue({ attempted: false, result: null })
  mocks.gatewayEmailResult = null
  mocks.authListener = null
})

afterEach(() => cleanup())

describe("Account session exit", () => {
  it("settles the signed-in screen after the shell remounts it for a verified account scope", async () => {
    // Use the real scope coordinator and the shell's keyed remount contract.
    // A bounded harness turns the former admission -> refresh -> remount loop
    // into a visible failure instead of letting the regression run forever.
    function SignedInShell() {
      const [revision, setRevision] = React.useState(0)
      React.useEffect(() => {
        let changes = 0
        const stopScope = onLocalJournalScopeChange(() => setRevision(++changes))
        const stopAuth = startVerifiedAccountScope(() => {}, {
          currentUser: mocks.currentUser,
          onAuthChange: () => () => {},
          loadPrivateProfileSetupStatus: mocks.loadSetup,
          setActiveLocalAccount,
          setAccountAuthState: () => {},
          isQuarantined: () => false,
          subscribeQuarantine: () => () => {},
        })
        return () => { stopScope(); stopAuth() }
      }, [])
      return revision < 8 ? <Account surface="manage" key={revision} onOpenImport={() => {}} /> : <p role="alert">계정 화면 반복</p>
    }
    render(<SignedInShell />)
    await waitFor(() => expect(activeLocalAccount()).toBe("athlete-a"))
    expect(await screen.findByRole("heading", { name: "내 워치와 운동 기록" })).toBeVisible()
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 100)) })
    expect(screen.queryByText("계정 화면 반복")).toBeNull()
    expect(screen.getByRole("button", { name: "로그아웃" })).toBeVisible()
    expect(mocks.loadSetup.mock.calls.length).toBeLessThanOrEqual(4)
  })

  it("does not mount private account controls before server admission is ready", async () => {
    let resolveSetup!: (value: { ok: boolean; ready: boolean; message: string }) => void
    mocks.loadSetup.mockImplementation(() => new Promise(resolve => { resolveSetup = resolve }))
    const openImport = vi.fn()

    render(<Account surface="manage" onOpenImport={openImport} />)

    expect(await screen.findByText("로그인한 계정의 가입 상태를 확인하고 있어요.")).toBeVisible()
    await waitFor(() => expect(mocks.loadSetup).toHaveBeenCalled())
    expect(screen.queryByRole("button", { name: "합성 삭제 완료" })).not.toBeInTheDocument()
    expect(screen.queryByRole("heading", { name: "내 워치와 운동 기록" })).not.toBeInTheDocument()

    await act(async () => { resolveSetup({ ok: true, ready: true, message: "준비됨" }) })
    const management = await screen.findByRole("button", { name: "합성 삭제 완료" })
    expect(management).toBeVisible()
    const automaticEntry = screen.getByRole("heading", { name: "내 워치와 운동 기록" })
    expect(automaticEntry.compareDocumentPosition(management) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(screen.getByRole("button", { name: "로그아웃" }).compareDocumentPosition(automaticEntry) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    await waitFor(() => expect(automaticEntry.closest(".account-watch-entry")).toHaveFocus())
    expect(screen.queryByTestId("import-teaser")).toBeNull()
    await userEvent.click(screen.getByRole("button", { name: "워치 파일 가져오기" }))
    expect(openImport).toHaveBeenCalledOnce()
  })

  it("introduces automatic connection before login without replacing the authentication steps", async () => {
    mocks.currentUser.mockResolvedValue(null)
    render(<Account surface="auth" onOpenImport={vi.fn()} />)
    expect(await screen.findByTestId("guest-auth-gateway")).toBeVisible()
    expect(screen.getByText("Garmin 연결은 로그인 후 선택할 수 있어요.")).toBeVisible()
    expect(screen.queryByRole("button", { name: "운동 가져오기" })).toBeNull()
  })

  it("keeps the signed-in account and setup hints when local sign-out fails", async () => {
    mocks.signOut.mockResolvedValue({ ok: false, message: "로그아웃에 실패했어요." })
    render(<Account surface="manage" />)

    const logout = await screen.findByRole("button", { name: "로그아웃" })
    mocks.clearPending.mockClear()
    mocks.clearReceipt.mockClear()
    await userEvent.click(logout)

    expect(screen.getByRole("heading", { name: "내 계정" })).toBeVisible()
    expect(screen.getByTestId("account-action-result")).toHaveAttribute("data-state", "error")
    expect(mocks.signOut).toHaveBeenCalledWith({ scope: "local", expectedUserId: "athlete-a", isCurrent: expect.any(Function) })
    expect(mocks.clearPending).not.toHaveBeenCalled()
    expect(mocks.clearReceipt).not.toHaveBeenCalled()
  })

  it("clears local setup state only after local sign-out succeeds", async () => {
    mocks.signOut.mockResolvedValue({ ok: true, message: "로그아웃되었어요." })
    render(<Account surface="manage" />)

    const logout = await screen.findByRole("button", { name: "로그아웃" })
    mocks.clearPending.mockClear()
    mocks.clearReceipt.mockClear()
    await userEvent.click(logout)

    expect(await screen.findByTestId("guest-auth-gateway")).toBeVisible()
    expect(mocks.clearPending).toHaveBeenCalledOnce()
    expect(mocks.clearReceipt).toHaveBeenCalledWith("athlete-a")
    expect(screen.getByTestId("account-action-result")).toHaveAttribute("data-state", "success")
  })

  it("blocks deleted-account controls when global and local sign-out both fail", async () => {
    mocks.signOut
      .mockResolvedValueOnce({ ok: false, message: "global failed" })
      .mockResolvedValueOnce({ ok: false, message: "local failed" })
    render(<Account surface="manage" />)

    await userEvent.click(await screen.findByRole("button", { name: "합성 삭제 완료" }))

    expect(await screen.findByRole("heading", { name: "계정 삭제 요청을 저장했어요" })).toBeVisible()
    expect(screen.getByRole("button", { name: "이 기기에서 다시 로그아웃" })).toBeVisible()
    expect(screen.queryByRole("button", { name: "합성 삭제 완료" })).not.toBeInTheDocument()
    expect(mocks.signOut.mock.calls).toEqual([
      [{ scope: "global", expectedUserId: "athlete-a", isCurrent: expect.any(Function) }],
      [{ scope: "local", expectedUserId: "athlete-a", isCurrent: expect.any(Function) }],
    ])
    expect(mocks.clearReceipt).not.toHaveBeenCalled()
    await waitFor(() => expect(screen.getByTestId("account-action-result"))
      .toHaveTextContent("로그아웃을 확인하지 못했어요"))
  })

  it("closes private controls and the local scope before a pending deletion logout finishes", async () => {
    let finish!: (result: { ok: boolean; message: string }) => void
    mocks.signOut.mockImplementationOnce(() => new Promise(done => { finish = done }))
      .mockResolvedValueOnce({ ok: false, message: "local failed" })
    render(<Account surface="manage" />)
    const deleted = await screen.findByRole("button", { name: "합성 삭제 완료" })
    setActiveLocalAccount("athlete-a")
    const generation = localJournalScopeGeneration()
    await userEvent.click(deleted)
    expect(screen.getByRole("heading", { name: "계정 삭제 요청을 저장했어요" })).toBeVisible()
    expect(screen.queryByRole("button", { name: "합성 삭제 완료" })).not.toBeInTheDocument()
    expect(activeLocalAccount()).toBeNull()
    expect(localJournalScopeGeneration()).toBeGreaterThan(generation)
    finish({ ok: false, message: "global failed" })
    await waitFor(() => expect(mocks.signOut).toHaveBeenCalledTimes(2))
    expect(await screen.findByRole("button", { name: "이 기기에서 다시 로그아웃" })).toBeVisible()
  })

  it("does not clear B or sign B out when A's deletion logout fails after account switching", async () => {
    let finish!: (result: { ok: boolean; message: string }) => void
    mocks.signOut.mockImplementationOnce(() => new Promise(done => { finish = done }))
    render(<Account surface="manage" />)
    await userEvent.click(await screen.findByRole("button", { name: "합성 삭제 완료" }))
    const b = { id: "ui-delete-other-b", email: "synthetic-b@example.test", phone: null, provider: "email" as const }
    mocks.currentUser.mockResolvedValue(b)
    await act(async () => { mocks.authListener?.(b) })
    expect(await screen.findByRole("button", { name: "합성 삭제 완료" })).toBeVisible()
    setActiveLocalAccount(b.id)
    finish({ ok: false, message: "global failed" })
    await waitFor(() => expect(screen.getByRole("button", { name: "로그아웃" })).not.toBeDisabled())
    expect(mocks.signOut).toHaveBeenCalledTimes(1)
    expect(activeLocalAccount()).toBe(b.id)
    expect(mocks.clearReceipt).not.toHaveBeenCalledWith(b.id)
    expect(screen.queryByRole("heading", { name: "계정 삭제 요청을 저장했어요" })).not.toBeInTheDocument()
  })

  it("cannot mount deleted A again from a late verified auth event after B", async () => {
    const a = { id: "ui-confirmed-deleted-a", email: "synthetic-a@example.test", phone: null, provider: "email" as const }
    const b = { ...a, id: "ui-confirmed-normal-b" }
    mocks.currentUser.mockResolvedValue(a)
    render(<Account surface="manage" />)
    await screen.findByRole("button", { name: "합성 삭제 완료" })
    await act(async () => { closeAccountDeletionBoundary(a.id, "2026-10-07T00:00:00Z") })
    expect(screen.queryByRole("button", { name: "합성 삭제 완료" })).not.toBeInTheDocument()
    mocks.currentUser.mockResolvedValue(b)
    await act(async () => { mocks.authListener?.(b) })
    expect(await screen.findByRole("button", { name: "합성 삭제 완료" })).toBeVisible()
    mocks.currentUser.mockResolvedValue(a)
    await act(async () => { mocks.authListener?.(a) })
    expect(await screen.findByRole("heading", { name: "계정 삭제 요청을 저장했어요" })).toBeVisible()
    expect(screen.queryByRole("button", { name: "합성 삭제 완료" })).not.toBeInTheDocument()
  })

  it("does not reuse A's deletion logout guard after an A to B to A session exchange", async () => {
    let finish!: (result: { ok: boolean; message: string }) => void
    mocks.signOut.mockImplementationOnce(() => new Promise(done => { finish = done }))
    render(<Account surface="manage" />)
    await userEvent.click(await screen.findByRole("button", { name: "합성 삭제 완료" }))
    const deletionOptions = mocks.signOut.mock.calls[0]?.[0] as { expectedUserId: string; isCurrent: () => boolean }
    expect(deletionOptions.expectedUserId).toBe("athlete-a")
    expect(deletionOptions.isCurrent()).toBe(true)
    const b = { id: "ui-logout-generation-b", email: "synthetic-b@example.test", phone: null, provider: "email" as const }
    mocks.currentUser.mockResolvedValue(b)
    await act(async () => { mocks.authListener?.(b) })
    await screen.findByRole("button", { name: "합성 삭제 완료" })
    const a = { ...b, id: "athlete-a" }
    mocks.currentUser.mockResolvedValue(a)
    await act(async () => { mocks.authListener?.(a) })
    await screen.findByRole("button", { name: "합성 삭제 완료" })
    expect(deletionOptions.isCurrent()).toBe(false)
    finish({ ok: false, message: "global failed" })
    await waitFor(() => expect(screen.getByRole("button", { name: "로그아웃" })).not.toBeDisabled())
    expect(mocks.signOut).toHaveBeenCalledTimes(1)
    expect(mocks.clearReceipt).not.toHaveBeenCalled()
    expect(screen.queryByRole("heading", { name: "계정 삭제 요청을 저장했어요" })).not.toBeInTheDocument()
  })

  it("does not clear B when a deleted-account local logout retry completes late", async () => {
    let finishRetry!: (result: { ok: boolean; message: string }) => void
    mocks.signOut
      .mockResolvedValueOnce({ ok: false, message: "global failed" })
      .mockResolvedValueOnce({ ok: false, message: "local failed" })
      .mockImplementationOnce(() => new Promise(done => { finishRetry = done }))
    render(<Account surface="manage" />)
    await userEvent.click(await screen.findByRole("button", { name: "합성 삭제 완료" }))
    await userEvent.click(await screen.findByRole("button", { name: "이 기기에서 다시 로그아웃" }))
    const retryOptions = mocks.signOut.mock.calls[2]?.[0] as { expectedUserId: string; isCurrent: () => boolean }
    expect(retryOptions.expectedUserId).toBe("athlete-a")
    expect(retryOptions.isCurrent()).toBe(true)
    const b = { id: "ui-local-retry-other-b", email: "synthetic-b@example.test", phone: null, provider: "email" as const }
    mocks.currentUser.mockResolvedValue(b)
    await act(async () => { mocks.authListener?.(b) })
    expect(await screen.findByRole("button", { name: "합성 삭제 완료" })).toBeVisible()
    expect(retryOptions.isCurrent()).toBe(false)
    finishRetry({ ok: true, message: "로그아웃되었어요." })
    await waitFor(() => expect(screen.getByRole("button", { name: "로그아웃" })).not.toBeDisabled())
    expect(mocks.clearReceipt).not.toHaveBeenCalledWith(b.id)
    expect(screen.queryByTestId("guest-auth-gateway")).not.toBeInTheDocument()
  })

  it("blocks account controls when email verification installs a session that cannot be rechecked or signed out", async () => {
    const attemptId = "a".repeat(32)
    mocks.consumeEmailCallback.mockResolvedValue({
      handled: true,
      ok: false,
      message: "가입 정보를 다시 확인해 주세요.",
      requiresPreAuth: true,
      attemptId,
    })
    mocks.gatewayEmailResult = {
      handled: true,
      ok: true,
      message: "이메일 확인을 마쳤어요.",
      verifiedUserId: "athlete-email",
    }
    mocks.currentUser
      .mockResolvedValueOnce(null)
      .mockRejectedValueOnce(new Error("server recheck failed"))
    mocks.signOut
      .mockResolvedValueOnce({ ok: false, message: "로그아웃에 실패했어요." })
      .mockResolvedValueOnce({ ok: true, message: "로그아웃되었어요." })

    render(<Account surface="manage" />)
    await userEvent.click(await screen.findByRole("button", { name: "합성 이메일 확인 완료" }))

    expect(await screen.findByRole("heading", { name: "로그인 확인을 마치지 못했어요" })).toBeVisible()
    expect(screen.queryByRole("heading", { name: "내 계정" })).not.toBeInTheDocument()
    expect(mocks.clearPendingForAttempt).toHaveBeenCalledWith(attemptId)
    expect(mocks.signOut).toHaveBeenNthCalledWith(1, { scope: "local", expectedUserId: "athlete-email", isCurrent: expect.any(Function) })

    await userEvent.click(screen.getByRole("button", { name: "이 기기에서 다시 로그아웃" }))
    expect(await screen.findByTestId("guest-auth-gateway")).toBeVisible()
    expect(mocks.signOut).toHaveBeenNthCalledWith(2, { scope: "local" })
  })

  it("blocks account controls when a callback reports that its cleanup sign-out failed", async () => {
    const attemptId = "b".repeat(32)
    mocks.consumeEmailCallback.mockResolvedValue({
      handled: true,
      ok: false,
      message: "가입 정보를 다시 확인해 주세요.",
      requiresPreAuth: true,
      attemptId,
    })
    mocks.gatewayEmailResult = {
      handled: true,
      ok: false,
      message: "로그아웃을 확인하지 못했어요.",
      unsafeSessionOpen: true,
    }
    mocks.currentUser.mockResolvedValueOnce(null)

    render(<Account surface="manage" />)
    await userEvent.click(await screen.findByRole("button", { name: "합성 이메일 확인 완료" }))

    expect(await screen.findByRole("heading", { name: "로그인 확인을 마치지 못했어요" })).toBeVisible()
    expect(screen.queryByTestId("guest-auth-gateway")).not.toBeInTheDocument()
  })
})


describe("auth-first admission", () => {
  const authOnly = () => ({ schemaVersion: 5 as const, flow: "AUTH_ONLY" as const, entryMode: "login" as const, method: "google" as const,
    attemptId: "a".repeat(32), phase: "AUTH_VERIFIED" as const, verifiedUserId: "athlete-a", verifiedMethod: "google" as const,
    verifiedSessionId: "11111111-1111-4111-8111-111111111111", expectedEmail: null, birthDate: null, privacyPolicyVersion: null, termsOfServiceVersion: null, createdAtMs: Date.now() })
  it("opens an existing admitted account with no extra signup fields or profile write", async () => {
    mocks.pending = authOnly()
    render(<Account surface="auth" />)
    expect(await screen.findByRole("heading", { name: "로그인 완료" })).toBeVisible()
    expect(screen.queryByTestId("required-signup-fields")).toBeNull()
    expect(mocks.finalize).not.toHaveBeenCalled()
    await waitFor(() => expect(mocks.clearPendingForAttempt).toHaveBeenCalledWith("a".repeat(32)))
  })
  it("shows new-member completion after auth without mounting account rights", async () => {
    mocks.pending = authOnly()
    mocks.loadSetup.mockResolvedValue({ ok: true, ready: false, canComplete: true, message: "아직 가입을 마치지 않았어요. 나이와 필수 약관을 확인해 주세요." })
    render(<Account surface="auth" />)
    expect(await screen.findByTestId("required-signup-fields")).toBeVisible()
    expect(screen.getByText(/아직 가입을 마치지 않았어요/u)).toBeVisible()
    expect(screen.queryByText(/확인 링크를 새 화면/u)).toBeNull()
    expect(screen.queryByText("계정 자료 관리")).toBeNull()
    expect(screen.queryByRole("heading", { name: "내 자료 내려받기", hidden: true })).toBeNull()
    expect(screen.queryByText("합성 계정 삭제 관리")).toBeNull()
    expect(mocks.finalize).not.toHaveBeenCalled()
  })
  it("rechecks current server status on retry without stale callback success or duplicate enrollment", async () => {
    mocks.pending = authOnly()
    mocks.oauthResult = { handled: true, ok: true, message: "간편 로그인을 확인했어요." }
    mocks.loadSetup.mockResolvedValueOnce({ ok: false, ready: false, canComplete: false, message: "이 로그인 방식은 잠시 닫혀 있어요." })
      .mockResolvedValue({ ok: true, ready: true, canComplete: false, message: "가입 확인을 마쳤어요." })
    render(<Account surface="auth" />)
    expect(await screen.findByRole("heading", { name: "계정을 확인하지 못했어요" })).toBeVisible()
    expect(screen.queryByText("간편 로그인을 확인했어요.")).toBeNull()
    await userEvent.click(screen.getByRole("button", { name: "다시 확인하기" }))
    expect(await screen.findByRole("heading", { name: "로그인 완료" })).toBeVisible()
    expect(mocks.loadSetup).toHaveBeenCalledTimes(2)
    expect(mocks.finalize).not.toHaveBeenCalled()
  })
})


describe("password recovery account boundary", () => {
  it("renders only recovery before quarantine or normal admission despite a cached account hint", async () => {
    mocks.passwordCallback = true; mocks.passwordActive = true
    render(<Account surface="auth" />)
    expect(await screen.findByLabelText("새 비밀번호")).toBeVisible()
    expect(screen.queryByTestId("required-signup-fields")).toBeNull()
    expect(screen.queryByRole("button", { name: "합성 삭제 완료" })).toBeNull()
    expect(mocks.loadSetup).not.toHaveBeenCalled()
    expect(mocks.currentUser).not.toHaveBeenCalled()
  })
})


describe("signup callback admission", () => {
  it("continues a verified signup callback directly to required new-member information", async () => {
    mocks.passwordCallback = true
    mocks.passwordComplete.mockImplementation(async () => {
      mocks.passwordCallback = false
      return { ok: true, state: "SIGNED_IN", verifiedUserId: "athlete-a", message: "확인했어요." }
    })
    mocks.loadSetup.mockResolvedValue({ ok: true, ready: false, canComplete: true, message: "가입을 마무리해 주세요." })
    render(<Account surface="auth" />)
    expect(await screen.findByTestId("required-signup-fields")).toBeVisible()
    expect(screen.queryByTestId("guest-auth-gateway")).toBeNull()
    expect(mocks.currentUser).toHaveBeenCalledWith({ throwOnFailure: true })
    expect(mocks.loadSetup).toHaveBeenCalled()
  })
  it("does not admit a substituted account after a signup callback", async () => {
    mocks.passwordCallback = true
    mocks.passwordComplete.mockImplementation(async () => {
      mocks.passwordCallback = false
      return { ok: true, state: "SIGNED_IN", verifiedUserId: "athlete-a", message: "확인했어요." }
    })
    mocks.currentUser.mockResolvedValue({ id: "athlete-b", email: "other@example.com", phone: null, provider: "email" })
    render(<Account surface="auth" />)
    expect(await screen.findByRole("heading", { name: "이메일 확인을 마치지 못했어요" })).toBeVisible()
    expect(mocks.loadSetup).not.toHaveBeenCalled()
    expect(screen.queryByTestId("required-signup-fields")).toBeNull()
  })
})
