import React from "react"
import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  currentUser: vi.fn(), loadSetup: vi.fn(), pending: null as import("../domain/account/auth-onboarding").PendingAccountSetup | null,
  recovery: false, quarantined: false, mounts: vi.fn(), currentAttempt: vi.fn(), finalize: vi.fn(), scopeRefresh: vi.fn(),
}))
vi.mock("../domain/account/auth", () => ({ currentUser: mocks.currentUser, authReturnAttemptId: () => null,
  clearAuthReturnAttemptIdFromUrl: vi.fn(), onAuthChange: () => () => {}, signOut: vi.fn(), maskPhoneNumber: (s: string) => s }))
vi.mock("../domain/account/auth-onboarding", () => ({ readPendingAccountSetup: () => mocks.pending,
  clearCurrentSetupReceipt: vi.fn(), clearPendingAccountSetup: vi.fn(), clearPendingAccountSetupForAttempt: vi.fn(),
  writeCurrentSetupReceipt: vi.fn(), finalizePendingAccountSetup: mocks.finalize }))
vi.mock("../domain/account/email-auth-callback", () => ({ consumeCapturedEmailAuthCallback: async () => ({ handled: false }) }))
vi.mock("../domain/account/oauth-auth-callback", () => ({ consumeCapturedOAuthAuthCallback: async () => ({ handled: false }) }))
vi.mock("../domain/account/account-service", () => ({ loadPrivateProfileSetupStatus: mocks.loadSetup }))
vi.mock("../domain/account/account-settings", () => ({ isCurrentAccountAuthAttempt: mocks.currentAttempt }))
vi.mock("../domain/account/auth-session-quarantine", () => ({ isAuthSessionQuarantined: () => mocks.quarantined, subscribeAuthSessionQuarantine: () => () => {} }))
vi.mock("../domain/account/password-auth", () => ({ hasPasswordRecoveryCallback: () => mocks.recovery,
  isPasswordRecoveryActive: () => mocks.recovery, onPasswordAuthStateChange: () => () => {} }))
vi.mock("../domain/account/config", () => ({ accountConfig: () => ({ passwordAuthEnabled: true,
  privacyPolicy: { url: "https://example.test/privacy", version: "2026-11-04" },
  termsOfService: { url: "https://example.test/terms", version: "2026-11-04" } }) }))
vi.mock("../domain/account/service-date", () => ({ koreaServiceDate: () => "2026-11-14" }))
vi.mock("../domain/account/account-journal-api", () => ({ accountJournalPreviewEnabled: () => false }))
vi.mock("../domain/account/verified-account-scope", () => ({ requestVerifiedAccountScopeRefresh: mocks.scopeRefresh }))
vi.mock("../hooks/useActiveContentScroll", () => ({ useActiveContentScroll: vi.fn() }))
vi.mock("../domain/coaching-self-hosted", () => ({ coachingEndpoint: () => "https://example.test/coaching" }))
vi.mock("../components/SelfHostedCoachingPanel", () => ({ SelfHostedCoachingPanel: () => { mocks.mounts("ai"); return <div data-testid="ai" /> } }))
vi.mock("../components/InstallShortcut", () => ({ InstallShortcutSuggestion: () => null }))
vi.mock("./DeviceConnections", () => ({ DeviceConnections: () => null }))
vi.mock("./account/LoungeEntry", () => ({ LoungeEntry: () => null }))
vi.mock("./account/AccountAuthGateway", () => ({ AccountAuthGateway: () => <div data-testid="signup-gateway" /> }))
vi.mock("./account/PasswordAuthCallbackPanel", () => ({ PasswordAuthCallbackPanel: () => <div data-testid="recovery" /> }))
vi.mock("./account/AccountLoginMethods", () => ({ AccountLoginMethods: () => <div data-testid="password-methods" /> }))
vi.mock("./account/AccountLegalReconsent", () => ({ AccountLegalReconsent: () => <div data-testid="legal-reconsent" /> }))
vi.mock("./account/AccountDataRightsPanel", () => ({ AccountDataRightsPanel: () => { mocks.mounts("rights"); return <div data-testid="rights" /> } }))
vi.mock("./account/BetaAccountSettings", () => ({ BetaAccountSettings: ({ completionOnly, dataRightsOnly }: { completionOnly?: boolean; dataRightsOnly?: boolean }) => {
  if (dataRightsOnly) { mocks.mounts("delete"); return <div data-testid="delete" /> }
  return completionOnly ? <div data-testid="dob">생년월일</div> : null
} }))
vi.mock("./account/AccountJournalDraftPanel", () => ({ AccountJournalDraftPanel: () => null }))
vi.mock("./account/AccountJournalHistory", () => ({ AccountJournalHistory: () => null }))
vi.mock("./account/AccountJournalMigration", () => ({ AccountJournalMigration: () => null }))
vi.mock("./account/index", () => ({ AccountNetworkSettings: () => null, AccountSyncPanel: () => null,
  DeviceJournalOwnershipPanel: () => null, DeviceTrainingDataPanel: () => null,
  SwitchAccountPanel: () => { mocks.mounts("local-backup"); return <div data-testid="local-backup" /> } }))

import { Account } from "./Account"

const user = { id: "surface-test-owner", email: "runner@example.test", phone: null, provider: "email" }
const ready = { ok: true, ready: true, canComplete: false, requiredAction: "none", message: "준비됨" }
beforeEach(() => {
  vi.clearAllMocks(); localStorage.clear(); sessionStorage.clear()
  mocks.currentUser.mockReset().mockResolvedValue(user)
  mocks.loadSetup.mockReset().mockResolvedValue(ready)
  mocks.currentAttempt.mockReset().mockResolvedValue(true)
  mocks.finalize.mockReset()
  mocks.pending = null; mocks.recovery = false; mocks.quarantined = false
})
afterEach(cleanup)

describe("separate account surfaces", () => {
  it("announces a confirmed legacy admission once before the scope refresh can remount Account", async () => {
    mocks.pending = { schemaVersion: 4, method: "phone", returnIntent: "connection", attemptId: "a".repeat(32),
      phase: "AUTH_VERIFIED", createdAtMs: Date.now(), verifiedUserId: user.id, verifiedMethod: "phone",
      verifiedSessionId: "test-session", expectedEmail: null, birthDate: "2000-01-01",
      privacyPolicyVersion: "2026-11-04", termsOfServiceVersion: "2026-11-04" }
    mocks.loadSetup.mockResolvedValue({ ...ready, ready: false, canComplete: true, requiredAction: "profile" })
    const events: string[] = []
    const onAdmissionReady = vi.fn(() => { events.push("admission") })
    mocks.scopeRefresh.mockImplementation(() => { events.push("refresh") })
    mocks.finalize.mockImplementation(async ({ onConfirmed }: { onConfirmed: (pending: import("../domain/account/auth-onboarding").PendingAccountSetup | null) => Promise<void | boolean> }) => {
      await onConfirmed(mocks.pending)
      mocks.pending = null
      return { attempted: true, result: { ok: true, message: "saved" } }
    })
    render(<Account surface="auth" onAdmissionReady={onAdmissionReady} />)
    await waitFor(() => expect(mocks.scopeRefresh).toHaveBeenCalledOnce())
    expect(events).toEqual(["admission", "refresh"])
    expect(onAdmissionReady).toHaveBeenCalledExactlyOnceWith({ userId: user.id, attemptId: "a".repeat(32), returnIntent: "connection", entryMode: "signup" })
    expect(mocks.currentAttempt).toHaveBeenCalledWith(user.id, "test-session")
  })

  it("a replacement ready Account consumes retained legacy proof once", async () => {
    mocks.pending = { schemaVersion: 4, method: "phone", returnIntent: "connection", attemptId: "a".repeat(32),
      phase: "AUTH_VERIFIED", createdAtMs: Date.now(), verifiedUserId: user.id, verifiedMethod: "phone",
      verifiedSessionId: "test-session", expectedEmail: null, birthDate: "2000-01-01",
      privacyPolicyVersion: "2026-11-04", termsOfServiceVersion: "2026-11-04" }
    const onAdmissionReady = vi.fn()
    const view = render(<Account surface="auth" onAdmissionReady={onAdmissionReady} />)
    await waitFor(() => expect(onAdmissionReady).toHaveBeenCalledOnce())
    expect(onAdmissionReady).toHaveBeenCalledWith({ userId: user.id, attemptId: "a".repeat(32), returnIntent: "connection", entryMode: "signup" })
    view.rerender(<Account surface="auth" onAdmissionReady={onAdmissionReady} />)
    expect(onAdmissionReady).toHaveBeenCalledOnce()
    expect(mocks.finalize).not.toHaveBeenCalled()
  })

  it.each([
    { name: "failed", status: { ...ready, ok: false, ready: false, requiredAction: "blocked", message: "확인 실패" }, settled: "계정을 확인하지 못했어요" },
    { name: "needs-profile", status: { ...ready, ready: false, canComplete: true, requiredAction: "complete-profile" }, settled: "회원가입 마무리" },
    { name: "ready", status: ready, settled: "로그인 완료" },
  ])("auth $name never mounts data management controls", async ({ status, settled }) => {
    mocks.loadSetup.mockResolvedValue(status)
    render(<Account surface="auth" onOpenRestore={vi.fn()} />)
    expect(await screen.findByRole("heading", { name: settled })).toBeVisible()
    expect(mocks.mounts).not.toHaveBeenCalled()
    expect(screen.queryByRole("button", { name: "내 자료 관리" })).toBeNull()
  })

  it("management exposes password methods and an explicit data-rights entry", async () => {
    render(<Account surface="manage" />)
    expect(await screen.findByTestId("password-methods")).toBeVisible()
    expect(screen.queryByTestId("rights")).toBeNull()
    await userEvent.click(screen.getByRole("button", { name: "내 자료 관리" }))
    expect(await screen.findByTestId("rights")).toBeVisible()
    expect(screen.getByTestId("delete")).toBeVisible()
    expect(screen.queryByTestId("password-methods")).toBeNull()
  })

  it.each([
    { requiredAction: "complete-profile", canComplete: true, ok: true },
    { requiredAction: "legal-reconsent", canComplete: true, ok: true },
    { requiredAction: "blocked", canComplete: false, ok: false },
  ])("verified data-rights remains reachable for $requiredAction", async status => {
    mocks.loadSetup.mockResolvedValue({ ...ready, ...status, ready: false })
    render(<Account surface="data-rights" />)
    expect(await screen.findByTestId("rights")).toBeVisible()
    expect(screen.getByTestId("delete")).toBeVisible()
    expect(screen.queryByTestId("dob")).toBeNull()
  })

  it("legal reconsent never asks for birth date again", async () => {
    mocks.loadSetup.mockResolvedValue({ ...ready, ready: false, canComplete: true, requiredAction: "legal-reconsent" })
    render(<Account surface="auth" />)
    expect(await screen.findByTestId("legal-reconsent")).toBeVisible()
    expect(screen.queryByTestId("dob")).toBeNull()
    expect(screen.queryByText(/생년월일/)).toBeNull()
  })

  it.each(["loading", "recovery", "unverified"])("%s hides data rights", async mode => {
    if (mode === "loading") mocks.currentUser.mockImplementation(() => new Promise(() => {}))
    if (mode === "recovery") mocks.recovery = true
    if (mode === "unverified") mocks.quarantined = true
    render(<Account surface="data-rights" />)
    if (mode === "loading") expect(screen.getByText("계정 상태를 확인하고 있어요.")).toBeVisible()
    if (mode === "recovery") expect(await screen.findByTestId("recovery")).toBeVisible()
    if (mode === "unverified") expect(await screen.findByRole("heading", { name: "로그인 확인을 마치지 못했어요" })).toBeVisible()
    expect(mocks.mounts).not.toHaveBeenCalled()
  })

  it("network verification failure offers retry without a signup form", async () => {
    mocks.currentUser.mockRejectedValue(new Error("offline"))
    render(<Account surface="auth" />)
    expect(await screen.findByRole("button", { name: "다시 확인하기" })).toBeVisible()
    expect(screen.queryByTestId("signup-gateway")).toBeNull()
    expect(screen.queryByTestId("dob")).toBeNull()
  })

  it.each(["matching", "stale-session", "different-owner", "different-method", "no-session", "started", "absent"])("admission callback requires matching verified pending intent: %s", async variant => {
    mocks.pending = { schemaVersion: 5, flow: "AUTH_ONLY", entryMode: "login", returnIntent: "connection",
      attemptId: "a".repeat(32), method: "password", phase: "AUTH_VERIFIED", createdAtMs: Date.now(),
      verifiedUserId: user.id, verifiedMethod: "password", verifiedSessionId: "test-session", expectedEmail: user.email,
      birthDate: null, privacyPolicyVersion: null, termsOfServiceVersion: null,
    }
    if (variant === "different-owner") mocks.pending = { ...mocks.pending, verifiedUserId: "other-owner" }
    if (variant === "different-method") mocks.pending = { ...mocks.pending, verifiedMethod: "google" }
    if (variant === "no-session") mocks.pending = { ...mocks.pending, verifiedSessionId: null }
    if (variant === "started") mocks.pending = { ...mocks.pending, phase: "AUTH_STARTED" }
    if (variant === "absent") mocks.pending = null
    if (variant === "stale-session") mocks.currentAttempt.mockResolvedValue(false)
    const onAdmissionReady = vi.fn()
    const view = render(<Account surface="auth" onAdmissionReady={onAdmissionReady} />)
    await screen.findByRole("heading", { name: "로그인 완료" })
    if (variant === "matching") {
      await waitFor(() => expect(onAdmissionReady).toHaveBeenCalledOnce())
      expect(mocks.currentAttempt).toHaveBeenCalledWith(user.id, "test-session")
      expect(onAdmissionReady).toHaveBeenCalledWith({ userId: user.id, attemptId: "a".repeat(32), returnIntent: "connection", entryMode: "login" })
      view.rerender(<Account surface="auth" onAdmissionReady={onAdmissionReady} />)
      expect(onAdmissionReady).toHaveBeenCalledOnce()
    } else {
      if (variant === "stale-session") await waitFor(() => expect(mocks.currentAttempt).toHaveResolvedWith(false))
      expect(onAdmissionReady).not.toHaveBeenCalled()
    }
  })
})
