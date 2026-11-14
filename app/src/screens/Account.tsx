// 계정 화면 — 간편 로그인, 가입 확정, 선택 동기화 설정.
// 공개 게이트가 꺼져 있으면 AppShell이 진입점 자체를 렌더링하지 않는다.
import React from "react"
import { ArrowLeft } from "lucide-react"
import { DeviceConnections } from "./DeviceConnections"
import type { OpenGarminJournalRecord, StorageConnectionReadiness } from "../components/GarminConnectionPanel"
import { useActiveContentScroll } from "../hooks/useActiveContentScroll"
import { isBrowserPopScrollRestoration } from "../navigation/browserNavigation"
import {
  authReturnAttemptId,
  clearAuthReturnAttemptIdFromUrl,
  currentUser,
  maskPhoneNumber,
  onAuthChange,
  signOut,
} from "../domain/account/auth"
import type { AccountUser, AuthResult } from "../domain/account/auth"
import {
  clearCurrentSetupReceipt,
  clearPendingAccountSetup,
  clearPendingAccountSetupForAttempt,
  finalizePendingAccountSetup,
  readPendingAccountSetup,
  writeCurrentSetupReceipt,
} from "../domain/account/auth-onboarding"
import { consumeCapturedEmailAuthCallback } from "../domain/account/email-auth-callback"
import { consumeCapturedOAuthAuthCallback } from "../domain/account/oauth-auth-callback"
import { closeDeletedAccountSessions } from "../domain/account/account-session-exit"
import {
  isAuthSessionQuarantined,
  subscribeAuthSessionQuarantine,
} from "../domain/account/auth-session-quarantine"
import type { AuthMethod, AuthReturnIntent, PendingAccountSetup } from "../domain/account/auth-onboarding"
import { koreaServiceDate } from "../domain/account/service-date"
import { loadPrivateProfileSetupStatus, type PrivateProfileSetupStatus } from "../domain/account/account-service"
import { accountConfig } from "../domain/account/config"
import {
  AccountNetworkSettings, AccountSyncPanel, DeviceJournalOwnershipPanel, DeviceTrainingDataPanel, SwitchAccountPanel,
} from "./account/index"
import { AccountAuthGateway } from "./account/AccountAuthGateway"
import { PasswordAuthCallbackPanel } from "./account/PasswordAuthCallbackPanel"
import { AccountLoginMethods } from "./account/AccountLoginMethods"
import { AccountLegalReconsent } from "./account/AccountLegalReconsent"
import { isCurrentAccountAuthAttempt } from "../domain/account/account-settings"
import { hasPasswordRecoveryCallback, isPasswordRecoveryActive, onPasswordAuthStateChange } from "../domain/account/password-auth"
import type { AccountEntryMode } from "../components/AccountEntryButton"
import { BetaAccountSettings } from "./account/BetaAccountSettings"
import { AccountDataRightsPanel } from "./account/AccountDataRightsPanel"
import { AccountJournalDraftPanel } from "./account/AccountJournalDraftPanel"
import { accountJournalPreviewEnabled } from "../domain/account/account-journal-api"
import { AccountJournalHistory } from "./account/AccountJournalHistory"
import { AccountJournalMigration } from "./account/AccountJournalMigration"
import { mono, primaryBtn, secondaryBtn } from "./account/styles"
import { InstallShortcutSuggestion } from "../components/InstallShortcut"
import { LoungeEntry } from "./account/LoungeEntry"
import { requestVerifiedAccountScopeRefresh } from "../domain/account/verified-account-scope"
import { isAccountDeletionClosed, onAccountDeletionBoundaryChange } from "../domain/account/account-deletion-boundary"
import { activeLocalAccount, setActiveLocalAccount } from "../domain/account/local-journal-ownership"
import { setAccountAuthState } from "../domain/account/account-auth-state"
import { SelfHostedCoachingPanel } from "../components/SelfHostedCoachingPanel"
import { coachingEndpoint } from "../domain/coaching-self-hosted"

type SetupState = "checking" | "not-required" | "saving" | "needs-profile" | "ready" | "failed"
export type AccountSurface = "auth" | "manage" | "data-rights"
export type AccountAdmissionReady = { userId: string; attemptId: string; returnIntent: AuthReturnIntent; entryMode: AccountEntryMode }

function authenticatedMethod(user: AccountUser): AuthMethod | null {
  return user.provider === "kakao"
    || user.provider === "google"
    || user.provider === "email"
    || user.provider === "phone"
    ? user.provider
    : null
}

export function Account({ onBack, onOpenImport, onOpenFileImport, onOpenJournalRecord, onOpenRestore, onOpenJournal, onOpenPlan, loungeRequested = false, initialAuthMode = "login", surface = "auth", returnIntent = null, onAdmissionReady }: {
  readonly surface?: AccountSurface
  readonly returnIntent?: AuthReturnIntent
  readonly onAdmissionReady?: (event: AccountAdmissionReady) => void
  readonly initialAuthMode?: AccountEntryMode
  readonly onBack?: () => void
  readonly onOpenImport?: () => void
  readonly onOpenFileImport?: () => void
  readonly onOpenJournalRecord?: OpenGarminJournalRecord
  readonly onOpenRestore?: () => void
  readonly onOpenJournal?: () => void
  readonly onOpenPlan?: () => void
  readonly loungeRequested?: boolean
}) {
  const config = accountConfig()
  const today = koreaServiceDate()
  const [passwordFlowActive, setPasswordFlowActive] = React.useState(() => hasPasswordRecoveryCallback() || isPasswordRecoveryActive())
  const [passwordNotice, setPasswordNotice] = React.useState<string | null>(null)
  const [authMode, setAuthMode] = React.useState<AccountEntryMode>(initialAuthMode)
  const [user, setUser] = React.useState<AccountUser | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [sessionVerificationFailed, setSessionVerificationFailed] = React.useState(false)
  const [sessionRetry, setSessionRetry] = React.useState(0)
  const [currentSurface, setCurrentSurface] = React.useState(surface)
  const accountEntryRef = React.useRef<HTMLDivElement>(null)
  // Keep the page title in view on auth entry and login/signup switches.
  // The shared hook preserves browser-pop restoration and active editing.
  useActiveContentScroll(currentSurface === "auth" ? `${currentSurface}:${authMode}` : null, accountEntryRef)
  const [requiredAction, setRequiredAction] = React.useState<PrivateProfileSetupStatus["requiredAction"]>("blocked")
  const admissionProof = React.useRef<PendingAccountSetup | null>(null)
  const notifiedAttempt = React.useRef<string | null>(null)
  const [busy, setBusy] = React.useState(false)
  const [setupState, setSetupState] = React.useState<SetupState>("checking")
  const [setupNotice, setSetupNotice] = React.useState<string | null>(null)
  const [accountActionNotice, setAccountActionNotice] = React.useState<AuthResult | null>(null)
  const [authCallbackNotice, setAuthCallbackNotice] = React.useState<AuthResult | null>(null)
  const [emailCallbackAttemptId, setEmailCallbackAttemptId] = React.useState<string | null>(null)
  const [deletedAccountSessionOpen, setDeletedAccountSessionOpen] = React.useState(false)
  const [unverifiedAccountSessionOpen, setUnverifiedAccountSessionOpen] = React.useState(false)
  const [setupRetry, setSetupRetry] = React.useState(0)
  const [returnAttemptId] = React.useState(() => authReturnAttemptId())
  const setupAttemptRef = React.useRef<string | null>(null)
  const activeUserIdRef = React.useRef<string | null>(null)
  const accountSessionGenerationRef = React.useRef(0)
  const sessionBlockedRef = React.useRef(false)
  const watchSectionRef = React.useRef<HTMLDivElement>(null)
  const storageSectionRef = React.useRef<HTMLDivElement>(null)
  const restoredReader = React.useRef(isBrowserPopScrollRestoration())
  const [storageState, setStorageState] = React.useState<{ owner: string; state: StorageConnectionReadiness } | null>(null)
  const receiveStorageStatus = React.useCallback((state: StorageConnectionReadiness) => {
    if (user && activeUserIdRef.current === user.id) setStorageState({ owner: user.id, state })
  }, [user?.id])
  const [connectionFocusRevision, focusConnection] = React.useReducer(value => value + 1, 0)
  const [storageFocusRevision, focusStorage] = React.useReducer(value => value + 1, 0)
  useActiveContentScroll(!loading && user && setupState === "ready" && (!restoredReader.current || connectionFocusRevision > 0)
    ? user.id + ":watch:" + connectionFocusRevision : null, watchSectionRef, watchSectionRef)
  useActiveContentScroll(storageFocusRevision ? "storage:" + storageFocusRevision : null, storageSectionRef, storageSectionRef)
  const openStorageSettings = () => {
    const disclosure = storageSectionRef.current?.querySelector("details")
    if (disclosure) { disclosure.open = true; focusStorage() }
  }

  React.useEffect(() => {
    clearAuthReturnAttemptIdFromUrl()
  }, [])
  React.useEffect(() => { setCurrentSurface(surface) }, [surface])

  const notifyAdmission = async (pending: PendingAccountSetup | null, isCurrent: () => boolean) => {
    if (!isCurrent()) return false
    if (currentSurface !== "auth") return true
    if (!user || passwordFlowActive || sessionVerificationFailed
      || isAuthSessionQuarantined() || isPasswordRecoveryActive() || !pending || pending.phase !== "AUTH_VERIFIED"
      || pending.verifiedUserId !== user.id || pending.verifiedMethod !== pending.method
      || !pending.verifiedSessionId) return false
    if (notifiedAttempt.current === pending.attemptId) return true
    if (readPendingAccountSetup()?.attemptId !== pending.attemptId) return false
    const generation = accountSessionGenerationRef.current
    const current = await isCurrentAccountAuthAttempt(user.id, pending.verifiedSessionId)
    if (!current || !isCurrent() || generation !== accountSessionGenerationRef.current || activeUserIdRef.current !== user.id
      || readPendingAccountSetup()?.attemptId !== pending.attemptId) return false
    if (notifiedAttempt.current === pending.attemptId) return true
    notifiedAttempt.current = pending.attemptId
    clearPendingAccountSetupForAttempt(pending.attemptId)
    const intent = pending.returnIntent ?? returnIntent
    if (intent === "account" || intent === "data-rights") setCurrentSurface(intent === "account" ? "manage" : "data-rights")
    onAdmissionReady?.({ userId: user.id, attemptId: pending.attemptId, returnIntent: intent,
      entryMode: pending.schemaVersion === 5 ? pending.entryMode : "signup" })
    return true
  }

  React.useEffect(() => {
    if (setupState !== "ready") return
    let cancelled = false
    void notifyAdmission(admissionProof.current, () => !cancelled)
    return () => { cancelled = true }
  }, [currentSurface, setupState, user?.id, passwordFlowActive, sessionVerificationFailed, returnIntent, onAdmissionReady])

  React.useEffect(() => onPasswordAuthStateChange(() => {
    if (hasPasswordRecoveryCallback() || isPasswordRecoveryActive()) setPasswordFlowActive(true)
  }), [])

  React.useEffect(() => {
    if (passwordFlowActive) {
      activeUserIdRef.current = null; setupAttemptRef.current = null
      setUser(null); setSetupState("not-required"); setLoading(false)
      return
    }
    let mounted = true
    let unsubscribe: () => void = () => undefined
    let verificationSequence = 0
    setSessionVerificationFailed(false)
    setLoading(true)

    const applyVerifiedUser = (nextUser: AccountUser | null) => {
      setSessionVerificationFailed(false)
      if (nextUser !== null && isAccountDeletionClosed(nextUser.id)) {
        activeUserIdRef.current = nextUser.id
        setupAttemptRef.current = null
        setUser(null)
        setDeletedAccountSessionOpen(true)
        setLoading(false)
        return
      }
      if (nextUser !== null && (sessionBlockedRef.current || isAuthSessionQuarantined())) {
        activeUserIdRef.current = null
        setupAttemptRef.current = null
        setUser(null)
        setUnverifiedAccountSessionOpen(true)
        setLoading(false)
        return
      }
      const nextUserId = nextUser?.id ?? null
      if (activeUserIdRef.current !== nextUserId) {
        if (nextUserId !== null) {
          setAccountActionNotice(null)
          setDeletedAccountSessionOpen(false)
        }
        activeUserIdRef.current = nextUser?.id ?? null
        setupAttemptRef.current = null
        setSetupState("checking")
        setSetupNotice(null)
      }
      setUser(nextUser)
      setLoading(false)
    }

    const bootstrap = async () => {
      const emailCallback = await consumeCapturedEmailAuthCallback()
      const oauthCallback = await consumeCapturedOAuthAuthCallback()
      const callback = emailCallback.handled ? emailCallback : oauthCallback.handled ? oauthCallback : null
      if (mounted && callback?.unsafeSessionOpen) {
        sessionBlockedRef.current = true
        activeUserIdRef.current = null
        setupAttemptRef.current = null
        setUser(null)
        setUnverifiedAccountSessionOpen(true)
      }
      if (mounted && emailCallback.handled && emailCallback.requiresPreAuth && emailCallback.attemptId !== undefined) {
        setEmailCallbackAttemptId(emailCallback.attemptId)
      }
      if (!mounted) return
      const requiresPreAuth = emailCallback.handled && emailCallback.requiresPreAuth
      if (isAuthSessionQuarantined() && !requiresPreAuth) {
        sessionBlockedRef.current = true
        activeUserIdRef.current = null
        setupAttemptRef.current = null
        setUser(null)
        setUnverifiedAccountSessionOpen(true)
        setLoading(false)
      }
      unsubscribe = onAuthChange((sessionHint) => {
        const sequence = ++verificationSequence
        // Any new non-null session hint supersedes an older deletion cleanup,
        // including A->B->A before the server identity checks settle.
        if (sessionHint !== null) accountSessionGenerationRef.current += 1
        if (sessionHint === null) {
          applyVerifiedUser(null)
          return
        }
        // Auth events are local hints. Verify the identity with the auth server
        // before changing the account whose private admission state is loaded.
        void currentUser({ throwOnFailure: true })
          .then((verified) => {
            if (!mounted || sequence !== verificationSequence) return
            applyVerifiedUser(verified?.id === sessionHint.id ? verified : null)
          })
          .catch(() => {
            if (!mounted || sequence !== verificationSequence) return
            setSessionVerificationFailed(true)
            setLoading(false)
            setAccountActionNotice({ ok: false, message: "로그인 정보를 다시 확인하지 못했어요." })
          })
      }, { ignoreInitialSession: true })
      const initialSequence = verificationSequence
      let initialUser: AccountUser | null
      try { initialUser = sessionBlockedRef.current ? null : await currentUser({ throwOnFailure: true }) }
      catch {
        if (mounted && verificationSequence === initialSequence) { setSessionVerificationFailed(true); setLoading(false) }
        return
      }
      if (!mounted) return
      if (verificationSequence === initialSequence) applyVerifiedUser(initialUser)
      if (callback !== null && !(emailCallback.handled && emailCallback.requiresPreAuth)) {
        setAuthCallbackNotice({ ok: callback.ok, message: callback.message })
      }
    }
    void bootstrap().catch(() => {
      if (!mounted) return
      setSessionVerificationFailed(true)
      setAccountActionNotice({ ok: false, message: "로그인 확인을 마치지 못했어요. 다시 시도해 주세요." })
      setLoading(false)
    })
    return () => { mounted = false; unsubscribe() }
  }, [passwordFlowActive, sessionRetry])

  React.useEffect(() => onAccountDeletionBoundaryChange(owner => {
    if (activeUserIdRef.current !== owner) return
    // Unmount every private control immediately, not after logout settles.
    setupAttemptRef.current = null
    setUser(null)
    setSetupState("not-required")
    setSetupNotice(null)
    setDeletedAccountSessionOpen(true)
    setLoading(false)
  }), [])

  React.useEffect(() => subscribeAuthSessionQuarantine((quarantined) => {
    if (!quarantined || activeUserIdRef.current === null) return
    sessionBlockedRef.current = true
    activeUserIdRef.current = null
    setupAttemptRef.current = null
    setUser(null)
    setSetupState("not-required")
    setSetupNotice(null)
    setUnverifiedAccountSessionOpen(true)
    setLoading(false)
  }), [])

  React.useEffect(() => {
    if (passwordFlowActive || sessionVerificationFailed || emailCallbackAttemptId !== null) {
      setSetupState("not-required")
      return
    }
    if (user === null || config === null || unverifiedAccountSessionOpen || deletedAccountSessionOpen) {
      setSetupState("not-required")
      return
    }
    const pending = readPendingAccountSetup()
    const attemptKey = pending === null
      ? `${user.id}:remote-profile:${config.privacyPolicy.version}:${config.termsOfService.version}:${setupRetry}`
      : `${user.id}:${pending.attemptId}:${authenticatedMethod(user) ?? "unknown"}:${returnAttemptId ?? "no-return"}:${setupRetry}`
    if (setupAttemptRef.current === attemptKey) return
    setupAttemptRef.current = attemptKey
    let cancelled = false
    setSetupState("saving")
    setSetupNotice(null)
    const completion = (async () => {
      const remote = await loadPrivateProfileSetupStatus({
        userId: user.id,
        privacyPolicyVersion: config.privacyPolicy.version,
        termsOfServiceVersion: config.termsOfService.version,
      })
      if (cancelled || activeUserIdRef.current !== user.id) return { ...remote, pendingAttempted: false }
      if (remote.ready) {
        admissionProof.current = pending
        writeCurrentSetupReceipt(user.id, config)
        if (pending !== null && currentSurface !== "auth") clearPendingAccountSetupForAttempt(pending.attemptId)
        return { ...remote, pendingAttempted: false }
      }
      clearCurrentSetupReceipt(user.id)
      if (!remote.canComplete) return { ...remote, pendingAttempted: false }
      // Email/phone legacy enrollment already contains explicitly supplied facts.
      // Social auth-only attempts must collect those facts after admission lookup.
      if (pending !== null && pending.schemaVersion === 4) {
        const finalized = await finalizePendingAccountSetup({
          userId: user.id,
          returnAttemptId,
          today,
          config,
          onConfirmed: completed => notifyAdmission(completed, () => !cancelled && setupAttemptRef.current === attemptKey),
        })
        if (finalized.attempted) {
          return {
            ok: finalized.result?.ok ?? false,
            ready: finalized.result?.ok ?? false,
            canComplete: false,
            requiredAction: finalized.result?.ok ? "none" as const : "blocked" as const,
            message: finalized.result?.message ?? "가입 정보를 확인하지 못했어요.",
            pendingAttempted: true,
          }
        }
      }
      return { ...remote, pendingAttempted: false }
    })()
    void completion
      .then((result) => {
        if (cancelled || activeUserIdRef.current !== user.id || setupAttemptRef.current !== attemptKey) return
        setRequiredAction(result.requiredAction)
        if (result.ready) {
          setSetupState("ready")
          setSetupNotice(result.message)
          // Reading an already-ready profile must not request another scope
          // reset: AppShell remounts this screen on scope changes. Only a new
          // enrollment completion needs to wake the admission coordinator.
          if (result.pendingAttempted) requestVerifiedAccountScopeRefresh()
        } else if (!result.pendingAttempted && result.canComplete) {
          setSetupState("needs-profile")
          setSetupNotice(result.message)
        } else {
          setSetupState("failed")
          setSetupNotice(result.message)
        }
      })
      .catch(() => {
        if (cancelled || activeUserIdRef.current !== user.id || setupAttemptRef.current !== attemptKey) return
        setSetupState("failed")
        setSetupNotice("가입 확인 정보를 불러오지 못했어요.")
      })
    return () => { cancelled = true }
  }, [
    user?.id,
    config?.privacyPolicy.version,
    config?.termsOfService.version,
    setupRetry,
    today,
    returnAttemptId,
    emailCallbackAttemptId,
    passwordFlowActive,
    unverifiedAccountSessionOpen,
    deletedAccountSessionOpen,
    currentSurface,
    sessionVerificationFailed,
  ])

  const clearConfirmedLocalSession = (userId: string | null) => {
    accountSessionGenerationRef.current += 1
    admissionProof.current = null
    notifiedAttempt.current = null
    try {
      clearPendingAccountSetup()
    } catch {
      // 인증 세션이 닫힌 뒤 브라우저 저장소 정리 실패가 UI 로그아웃을 되돌리면 안 된다.
    }
    if (userId !== null) {
      try {
        clearCurrentSetupReceipt(userId)
      } catch {
        // 완료 표시는 서버 입장 상태로 다시 검증되므로 오래된 로컬 힌트를 신뢰하지 않는다.
      }
    }
    setupAttemptRef.current = null
    activeUserIdRef.current = null
    sessionBlockedRef.current = false
    setDeletedAccountSessionOpen(false)
    setUnverifiedAccountSessionOpen(false)
    setUser(null)
    setSetupState("not-required")
    setSetupNotice(null)
  }

  const handleSignOut = async (): Promise<AuthResult> => {
    const signingOutUserId = activeUserIdRef.current ?? user?.id ?? null
    const signOutGeneration = accountSessionGenerationRef.current
    const isCurrentSignOutSession = () => accountSessionGenerationRef.current === signOutGeneration
      && (activeUserIdRef.current === signingOutUserId || activeUserIdRef.current === null)
    setBusy(true)
    setAccountActionNotice(null)
    const result = await signOut(signingOutUserId === null
      ? { scope: "local" }
      : { scope: "local", expectedUserId: signingOutUserId, isCurrent: isCurrentSignOutSession })
    if (!isCurrentSignOutSession()) {
      setBusy(false)
      return { ok: false, message: "현재 계정이 바뀌어 로그아웃을 중단했어요." }
    }
    if (result.ok) {
      clearConfirmedLocalSession(signingOutUserId)
    }
    setAccountActionNotice(result)
    setBusy(false)
    return result
  }

  const handleDeletionCompleted = async (deletingUserId: string): Promise<AuthResult> => {
    if (activeUserIdRef.current !== deletingUserId) {
      return { ok: false, message: "삭제 요청한 계정의 접근은 막았어요. 현재 계정은 바꾸지 않았어요." }
    }
    if (activeLocalAccount() === deletingUserId) {
      setActiveLocalAccount(null)
      setAccountAuthState("FAILED")
    }
    setupAttemptRef.current = null
    setUser(null)
    setSetupState("not-required")
    setSetupNotice(null)
    setDeletedAccountSessionOpen(true)
    setBusy(true)
    setAccountActionNotice(null)
    const deletionGeneration = accountSessionGenerationRef.current
    const isCurrentDeletionSession = () => accountSessionGenerationRef.current === deletionGeneration
      && (activeUserIdRef.current === deletingUserId || activeUserIdRef.current === null)
    const result = await closeDeletedAccountSessions(options => {
      // An A->B switch while global logout waits must not sign B out in fallback.
      if (!isCurrentDeletionSession() || activeUserIdRef.current !== deletingUserId) {
        return Promise.resolve({ ok: false, message: "현재 계정이 바뀌어 로그아웃을 중단했어요." })
      }
      return signOut({ ...options, expectedUserId: deletingUserId, isCurrent: isCurrentDeletionSession })
    })
    if (!isCurrentDeletionSession()) {
      setBusy(false)
      return { ok: false, message: "삭제 요청한 계정의 접근은 막았어요. 현재 계정은 바꾸지 않았어요." }
    }
    if (result.localSessionClosed) {
      clearConfirmedLocalSession(deletingUserId)
    } else {
      // 서버 삭제 요청이 성공한 계정으로 다른 계정 기능을 계속 누르지 못하게 막는다.
      setDeletedAccountSessionOpen(true)
    }
    const notice = { ok: result.ok, message: result.message }
    setAccountActionNotice(notice)
    setBusy(false)
    return notice
  }

  const blockUnverifiedAccountSession = () => {
    sessionBlockedRef.current = true
    activeUserIdRef.current = null
    setupAttemptRef.current = null
    setUser(null)
    setSetupState("not-required")
    setSetupNotice(null)
    setEmailCallbackAttemptId(null)
    setUnverifiedAccountSessionOpen(true)
  }

  if (config === null) return null
  const profileSetupComplete = setupState === "ready"
  const finishSetup = () => {
    admissionProof.current = readPendingAccountSetup()
    writeCurrentSetupReceipt(user!.id, config)
    setSetupState("checking")
    setSetupRetry(value => value + 1)
    requestVerifiedAccountScopeRefresh()
  }

  const acceptPasswordSession = async (expectedUserId: string): Promise<boolean> => {
    const sequence = accountSessionGenerationRef.current
    setLoading(true)
    try {
      const verified = await currentUser({ throwOnFailure: true })
      if (sequence !== accountSessionGenerationRef.current) return false
      if (verified?.id !== expectedUserId || isAuthSessionQuarantined() || isAccountDeletionClosed(expectedUserId)
        || hasPasswordRecoveryCallback() || isPasswordRecoveryActive()) throw Error("AUTH_IDENTITY_UNCONFIRMED")
      sessionBlockedRef.current = false; activeUserIdRef.current = verified.id; setupAttemptRef.current = null
      setUser(verified); setUnverifiedAccountSessionOpen(false); setPasswordNotice(null); setAuthCallbackNotice(null)
      setPasswordFlowActive(false); setSetupState("checking"); setLoading(false)
      return true
    } catch {
      if (sequence === accountSessionGenerationRef.current) {
        setLoading(false); setAccountActionNotice({ ok: false, message: "로그인한 계정을 다시 확인하지 못했어요. 잠시 후 다시 시도해 주세요." })
      }
      return false
    }
  }

  return (
    <div ref={accountEntryRef} style={{ padding: "18px 20px 90px" }} aria-busy={loading || busy || setupState === "checking" || setupState === "saving"}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            aria-label="뒤로"
            data-install-shortcut-return="account"
            style={{ ...secondaryBtn, width: 44, minWidth: 44, minHeight: 44, padding: 0 }}
          ><ArrowLeft aria-hidden="true" size={19} /></button>
        )}
        <div>
          <div style={{ ...mono, fontSize: 9.5, color: "var(--ink-3)", letterSpacing: 0 }}>TRAINORACLE ACCOUNT</div>
          <h1 style={{ fontFamily: "var(--sans)", fontSize: 20, fontWeight: 600, margin: "4px 0 0", letterSpacing: 0 }}>
            {user ? currentSurface === "data-rights" ? "내 자료 관리" : currentSurface === "manage" ? "내 계정" : setupState === "ready" ? "로그인 완료" : "가입 확인" : authMode === "signup" ? "회원가입" : "로그인"}
          </h1>
        </div>
      </div>

      {!passwordFlowActive && accountActionNotice !== null && (
        <p
          role={accountActionNotice.ok ? "status" : "alert"}
          aria-live="polite"
          data-state={accountActionNotice.ok ? "success" : "error"}
          data-testid="account-action-result"
          style={{ ...mono, fontSize: 11, lineHeight: 1.6, margin: "14px 0 0" }}
        >
          {accountActionNotice.message}
        </p>
      )}
      {!passwordFlowActive && authCallbackNotice !== null && !authCallbackNotice.ok && (
        <p
          role={authCallbackNotice.ok ? "status" : "alert"}
          aria-live="polite"
          data-state={authCallbackNotice.ok ? "success" : "error"}
          data-testid="auth-callback-result"
          style={{ ...mono, fontSize: 11, lineHeight: 1.6, margin: "14px 0 0" }}
        >
          {authCallbackNotice.message}
        </p>
      )}

      {passwordFlowActive ? <PasswordAuthCallbackPanel onSignedIn={acceptPasswordSession} onLoginRequired={message => {
        if (hasPasswordRecoveryCallback() || isPasswordRecoveryActive() || isAuthSessionQuarantined()) return
        sessionBlockedRef.current = false; activeUserIdRef.current = null; setupAttemptRef.current = null
        setUser(null); setUnverifiedAccountSessionOpen(false); setAuthCallbackNotice(null)
        setAuthMode("login"); setPasswordNotice(message); setPasswordFlowActive(false); setLoading(true)
      }} /> : loading ? (
        <p role="status" style={{ ...mono, fontSize: 12, color: "var(--ink-3)", marginTop: 24 }}>계정 상태를 확인하고 있어요.</p>
      ) : sessionVerificationFailed ? (
        <div style={{ marginTop: 24 }}><p role="alert">계정 상태를 확인하지 못했어요. 연결을 확인한 뒤 다시 시도해 주세요.</p>
          <button type="button" style={primaryBtn} onClick={() => setSessionRetry(value => value + 1)}>다시 확인하기</button></div>
      ) : unverifiedAccountSessionOpen ? (
        <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 12 }}>
          <h2 style={{ fontFamily: "var(--sans)", fontSize: 18, margin: 0, letterSpacing: 0 }}>로그인 확인을 마치지 못했어요</h2>
          <p role="alert" style={{ fontFamily: "var(--sans)", fontSize: 13, lineHeight: 1.65, color: "var(--ink-2)", margin: 0 }}>
            계정 기능을 잠시 막았어요. 이 기기의 일지와 훈련 계획은 그대로예요.
          </p>
          <button type="button" style={primaryBtn} disabled={busy} onClick={() => void handleSignOut()}>
            이 기기에서 다시 로그아웃
          </button>
        </div>
      ) : emailCallbackAttemptId !== null ? (
        <AccountAuthGateway
          returnIntent={returnIntent}
          mode={authMode}
          onModeChange={setAuthMode}
          config={config}
          today={today}
          emailCallbackAttemptId={emailCallbackAttemptId}
          onUnsafeSessionDetected={blockUnverifiedAccountSession}
          onEmailCallbackFinished={(result) => {
            if (result.handled) setAuthCallbackNotice({ ok: result.ok, message: result.message })
            if (result.handled && result.unsafeSessionOpen) {
              blockUnverifiedAccountSession()
              return
            }
            if (result.handled && result.ok && result.verifiedUserId !== undefined) {
              const expectedUserId = result.verifiedUserId
              const sequence = accountSessionGenerationRef.current
              setLoading(true)
              setSetupState("checking")
              void currentUser({ throwOnFailure: true })
                .then((verified) => {
                  if (sequence !== accountSessionGenerationRef.current) return
                  if (verified?.id !== expectedUserId) throw new Error("AUTH_IDENTITY_MISMATCH")
                  if (isAuthSessionQuarantined() || isAccountDeletionClosed(expectedUserId)) throw new Error("AUTH_SESSION_QUARANTINED")
                  sessionBlockedRef.current = false
                  activeUserIdRef.current = verified.id
                  setupAttemptRef.current = null
                  setUser(verified)
                  setEmailCallbackAttemptId(null)
                  setLoading(false)
                })
                .catch(() => {
                  if (sequence !== accountSessionGenerationRef.current) return
                  try {
                    clearPendingAccountSetupForAttempt(emailCallbackAttemptId)
                  } catch {
                    // 서버로 확인하지 못한 세션은 아래 로그아웃 결과와 무관하게 계정 UI에서 차단한다.
                  }
                  void signOut({ scope: "local", expectedUserId, isCurrent: () => sequence === accountSessionGenerationRef.current })
                    .catch(() => ({ ok: false, message: "이 기기의 로그아웃을 확인하지 못했어요." }))
                    .then((closed) => {
                      if (sequence !== accountSessionGenerationRef.current) return
                      setEmailCallbackAttemptId(null)
                      if (closed.ok) {
                        clearConfirmedLocalSession(expectedUserId)
                        setAuthCallbackNotice({ ok: false, message: "로그인한 계정을 다시 확인하지 못해 이 기기에서 로그아웃했어요. 처음부터 다시 진행해 주세요." })
                      } else {
                        sessionBlockedRef.current = true
                        activeUserIdRef.current = null
                        setupAttemptRef.current = null
                        setUser(null)
                        setSetupState("not-required")
                        setSetupNotice(null)
                        setUnverifiedAccountSessionOpen(true)
                        setAuthCallbackNotice({ ok: false, message: "로그인한 계정을 확인하지 못했고 이 기기의 로그아웃도 확인하지 못했어요." })
                      }
                      setLoading(false)
                    })
                })
            } else if (!result.handled || !result.requiresPreAuth) {
              setEmailCallbackAttemptId(null)
            }
          }}
        />
      ) : deletedAccountSessionOpen ? (
        <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 12 }}>
          <h2 style={{ fontFamily: "var(--sans)", fontSize: 18, margin: 0, letterSpacing: 0 }}>계정 삭제 요청을 저장했어요</h2>
          <p role="alert" style={{ fontFamily: "var(--sans)", fontSize: 13, lineHeight: 1.65, color: "var(--ink-2)", margin: 0 }}>
            서버의 계정 접근은 막혔어요. 이 브라우저의 로그아웃만 아직 확인하지 못했어요.
          </p>
          <button type="button" style={primaryBtn} disabled={busy} onClick={() => void handleSignOut()}>
            이 기기에서 다시 로그아웃
          </button>
        </div>
      ) : user === null ? (
        <>
          <AccountAuthGateway config={config} today={today} mode={authMode} onModeChange={setAuthMode} passwordNotice={passwordNotice} returnIntent={returnIntent}
            onUnsafeSessionDetected={blockUnverifiedAccountSession} onPasswordSignedIn={expectedUserId => { void acceptPasswordSession(expectedUserId) }} />
          <p className="account-automatic-connection-benefit">Garmin 연결은 로그인 후 선택할 수 있어요.</p>
        </>
      ) : setupState === "saving" || setupState === "checking" ? (
        <div style={{ marginTop: 24 }}>
          <p role="status" style={{ fontFamily: "var(--sans)", fontSize: 14, lineHeight: 1.65, margin: 0 }}>
            로그인한 계정의 가입 상태를 확인하고 있어요.
          </p>
        </div>
      ) : currentSurface === "data-rights" ? (
        <div style={{ marginTop: 24 }}>
          <AccountDataRightsPanel key={`rights-${user.id}`} userId={user.id} />
          <BetaAccountSettings key={`delete-${user.id}`} userId={user.id} today={today}
            legalDocuments={config} dataRightsOnly onDeletionCompleted={() => handleDeletionCompleted(user.id)} />
          <button type="button" style={secondaryBtn} onClick={() => setCurrentSurface("manage")}>내 계정으로</button>
        </div>
      ) : setupState === "failed" ? (
        <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 12 }}>
          <h2 style={{ fontFamily: "var(--sans)", fontSize: 18, margin: 0, letterSpacing: 0 }}>계정을 확인하지 못했어요</h2>
          <p role="alert" style={{ fontFamily: "var(--sans)", fontSize: 13, lineHeight: 1.65, color: "var(--ink-2)", margin: 0 }}>
            {setupNotice} 이 기기의 일지와 훈련 계획은 그대로예요. 계정 확인 전까지 동기화는 대기해요.
          </p>
          <button type="button" style={primaryBtn} onClick={() => setSetupRetry(value => value + 1)}>다시 확인하기</button>
          <button type="button" style={secondaryBtn} disabled={busy} onClick={() => void handleSignOut()}>로그아웃하고 다시 시작</button>
          {currentSurface === "manage" && <button type="button" style={secondaryBtn} onClick={() => setCurrentSurface("data-rights")}>내 자료 관리</button>}
        </div>
      ) : setupState === "needs-profile" ? (
        <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 14 }}>
          <h2 style={{ fontFamily: "var(--sans)", fontSize: 18, margin: 0, letterSpacing: 0 }}>{requiredAction === "legal-reconsent" ? "변경된 약관 확인" : "회원가입 마무리"}</h2>
          <p role="status" style={{ fontFamily: "var(--sans)", fontSize: 13, lineHeight: 1.65, color: "var(--ink-2)", margin: 0 }}>
            {setupNotice} {requiredAction !== "legal-reconsent" && "생년월일은 나이 확인에만 사용해요."}
          </p>
          {requiredAction === "legal-reconsent" ? <AccountLegalReconsent userId={user.id} config={config} onComplete={finishSetup} /> : <BetaAccountSettings
            userId={user.id}
            today={today}
            legalDocuments={config}
            completionOnly
            onCompleted={finishSetup}
          />}
          <button type="button" style={secondaryBtn} disabled={busy} onClick={() => void handleSignOut()}>로그아웃하고 다시 시작</button>
          {currentSurface === "manage" && <button type="button" style={secondaryBtn} onClick={() => setCurrentSurface("data-rights")}>내 자료 관리</button>}
      </div>
      ) : setupState === "ready" && currentSurface === "auth" ? (
        <div style={{ marginTop: 24, display: "grid", gap: 12 }}>
          <p role="status">{authMode === "signup" ? "가입을 마쳤어요." : "로그인했어요."}</p>
          {onOpenImport && <button type="button" style={primaryBtn} onClick={onOpenImport}>워치 연결하기</button>}
          {onBack && <button type="button" style={secondaryBtn} onClick={onBack}>나중에</button>}
        </div>
      ) : setupState === "ready" ? (
        <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 16 }}>
          <div ref={watchSectionRef} tabIndex={-1} className="account-watch-entry" aria-label="내 워치와 운동 기록">
          <section className="account-session-status" aria-label="트레인오라클 로그인 상태">
            <div className="account-session-status__heading"><strong>트레인오라클 로그인됨</strong>
              <button type="button" style={secondaryBtn} disabled={busy} onClick={() => void handleSignOut()}>로그아웃</button>
            </div>
            <div style={{ fontFamily: "var(--sans)", fontSize: 15, fontWeight: 600, marginTop: 4, letterSpacing: 0 }}>
              {user.email ?? (user.phone ? maskPhoneNumber(user.phone) : "연락처 미공개")}
            </div>
            {user.provider && (
              <div style={{ ...mono, fontSize: 10, color: "var(--ink-4)", marginTop: 2, letterSpacing: 0 }}>
                {user.provider === "kakao"
                  ? "카카오 간편 로그인"
                  : user.provider === "google"
                    ? "Google 간편 로그인"
                    : user.provider === "phone"
                      ? "휴대전화 문자 인증"
                      : "이메일 인증"}
              </div>
            )}
            <p>로그아웃은 이 기기에만 적용돼요.</p>
          </section>
          {onOpenImport && <DeviceConnections key={user.id} ownerId={user.id} inlineSetup onOpenImport={onOpenFileImport ?? onOpenImport}
            onOpenJournalRecord={onOpenJournalRecord} onOpenStorageSettings={openStorageSettings}
            storageReadiness={storageState?.owner === user.id ? storageState.state : "checking"} />}
          {onOpenImport && <p style={{ fontSize: 12, color: "var(--ink-3)" }}>자동 수신은 Garmin 연결에서 해제할 수 있어요.</p>}
          </div>

          {setupNotice !== null && <p role="status" style={{ ...mono, fontSize: 11, margin: 0 }}>{setupNotice}</p>}
          <InstallShortcutSuggestion eligible={setupState === "ready"} returnFocusTo={() => document.querySelector<HTMLElement>('[data-install-shortcut-return="account"]')} />
          {profileSetupComplete && <LoungeEntry key={user.id} userId={user.id} requested={loungeRequested} />}
          {config.passwordAuthEnabled && <AccountLoginMethods key={`methods-${user.id}`} userId={user.id} email={user.email ?? undefined}
            onLoginRequired={() => { clearConfirmedLocalSession(user.id); setAuthMode("login"); setPasswordNotice("비밀번호를 저장했어요. 새 비밀번호로 로그인해 주세요.") }} />}
          <button type="button" style={secondaryBtn} onClick={() => setCurrentSurface("data-rights")}>내 자료 관리</button>

          <AccountNetworkSettings
            includeDataRights={false}
            userId={user.id}
            today={today}
            legalDocuments={config}
            profileSetupComplete={profileSetupComplete}
            onDeletionCompleted={() => handleDeletionCompleted(user.id)}
            storageSectionRef={storageSectionRef}
            onStorageStatus={receiveStorageStatus}
            onStorageGranted={() => { if (activeUserIdRef.current === user.id) focusConnection() }}
          />
          <DeviceJournalOwnershipPanel userId={user.id} />
          <DeviceTrainingDataPanel userId={user.id} />
          <AccountSyncPanel userId={user.id} />
          {accountJournalPreviewEnabled() && <AccountJournalDraftPanel key={user.id} userId={user.id} />}
          {accountJournalPreviewEnabled() && <AccountJournalHistory key={`history-${user.id}`} />}
          {accountJournalPreviewEnabled() && <AccountJournalMigration key={`migration-${user.id}`} userId={user.id} />}

          <SwitchAccountPanel
            onSignOut={handleSignOut}
            onOpenBackup={onOpenRestore}
            onOutcome={setAccountActionNotice}
          />
        </div>
      ) : (
        <div style={{ marginTop: 24 }}>
          <p role="status" style={{ fontFamily: "var(--sans)", fontSize: 14, lineHeight: 1.65, margin: 0 }}>
            가입 정보를 다시 확인하고 있어요. 확인이 끝나기 전에는 계정 기록을 열지 않아요.
          </p>
        </div>
      )}

      {currentSurface === "manage" && profileSetupComplete && !sessionVerificationFailed && !passwordFlowActive && !loading && user !== null && !unverifiedAccountSessionOpen && !deletedAccountSessionOpen
        && coachingEndpoint() && (
        <SelfHostedCoachingPanel key={`coaching-rights-${user.id}`} ownerId={user.id} mode="manage"
          onReviewJournal={() => onOpenJournal?.()} onReviewPlan={() => onOpenPlan?.()} />
      )}

    </div>
  )
}
