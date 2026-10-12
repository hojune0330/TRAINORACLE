import React from "react"
import { act, cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  currentUser: vi.fn(),
  signOut: vi.fn(),
  clearPending: vi.fn(),
  clearPendingForAttempt: vi.fn(),
  clearReceipt: vi.fn(),
  consumeEmailCallback: vi.fn(),
  loadSetup: vi.fn(),
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
  finalizePendingAccountSetup: vi.fn(),
  hasCurrentSetupReceipt: () => true,
  readPendingAccountSetup: () => null,
  writeCurrentSetupReceipt: vi.fn(),
}))

vi.mock("../domain/account/email-auth-callback", () => ({
  consumeCapturedEmailAuthCallback: mocks.consumeEmailCallback,
}))

vi.mock("../domain/account/oauth-auth-callback", () => ({
  consumeCapturedOAuthAuthCallback: vi.fn().mockResolvedValue({ handled: false }),
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

vi.mock("../domain/account/service-date", () => ({ koreaServiceDate: () => "2026-10-03" }))
vi.mock("../domain/account/account-journal-api", () => ({ accountJournalPreviewEnabled: () => false }))
vi.mock("../components/InstallShortcut", () => ({ InstallShortcutSuggestion: () => null }))
vi.mock("./account/LoungeEntry", () => ({ LoungeEntry: () => null }))
vi.mock("./account/BetaAccountSettings", () => ({ BetaAccountSettings: () => null }))
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
import { activeLocalAccount, localJournalScopeGeneration, setActiveLocalAccount } from "../domain/account/local-journal-ownership"

beforeEach(() => {
  localStorage.clear()
  setActiveLocalAccount(null)
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
  mocks.gatewayEmailResult = null
  mocks.authListener = null
})

afterEach(() => cleanup())

describe("Account session exit", () => {
  it("does not mount private account controls before server admission is ready", async () => {
    let resolveSetup!: (value: { ok: boolean; ready: boolean; message: string }) => void
    mocks.loadSetup.mockImplementation(() => new Promise(resolve => { resolveSetup = resolve }))

    render(<Account />)

    expect(await screen.findByText("가입 정보를 안전하게 저장하고 있어요. 이 화면을 잠시 그대로 두세요.")).toBeVisible()
    expect(screen.queryByRole("button", { name: "합성 삭제 완료" })).not.toBeInTheDocument()

    resolveSetup({ ok: true, ready: true, message: "준비됨" })
    expect(await screen.findByRole("button", { name: "합성 삭제 완료" })).toBeVisible()
  })

  it("keeps the signed-in account and setup hints when local sign-out fails", async () => {
    mocks.signOut.mockResolvedValue({ ok: false, message: "로그아웃에 실패했어요." })
    render(<Account />)

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
    render(<Account />)

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
    render(<Account />)

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
    render(<Account />)
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
    render(<Account />)
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
    render(<Account />)
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
    render(<Account />)
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
    render(<Account />)
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

    render(<Account />)
    await userEvent.click(await screen.findByRole("button", { name: "합성 이메일 확인 완료" }))

    expect(await screen.findByRole("heading", { name: "로그인 확인을 마치지 못했어요" })).toBeVisible()
    expect(screen.queryByRole("heading", { name: "내 계정" })).not.toBeInTheDocument()
    expect(mocks.clearPendingForAttempt).toHaveBeenCalledWith(attemptId)
    expect(mocks.signOut).toHaveBeenNthCalledWith(1, { scope: "local" })

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

    render(<Account />)
    await userEvent.click(await screen.findByRole("button", { name: "합성 이메일 확인 완료" }))

    expect(await screen.findByRole("heading", { name: "로그인 확인을 마치지 못했어요" })).toBeVisible()
    expect(screen.queryByTestId("guest-auth-gateway")).not.toBeInTheDocument()
  })
})
