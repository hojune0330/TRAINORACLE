import React from "react"
import { cleanup, render, screen, waitFor } from "@testing-library/react"
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
  onAuthChange: () => () => undefined,
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

beforeEach(() => {
  localStorage.clear()
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
    expect(mocks.signOut).toHaveBeenCalledWith({ scope: "local" })
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
    expect(mocks.signOut.mock.calls).toEqual([[{ scope: "global" }], [{ scope: "local" }]])
    expect(mocks.clearReceipt).not.toHaveBeenCalled()
    await waitFor(() => expect(screen.getByTestId("account-action-result"))
      .toHaveTextContent("로그아웃을 확인하지 못했어요"))
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
