// 계정 화면 — 간편 로그인, 가입 확정, 선택 동기화 설정.
// 공개 게이트가 꺼져 있으면 AppShell이 진입점 자체를 렌더링하지 않는다.
import React from "react"
import { ArrowLeft } from "lucide-react"
import { SectionLb } from "../components/JournalPrimitives"
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
import type { AuthMethod } from "../domain/account/auth-onboarding"
import { koreaServiceDate } from "../domain/account/service-date"
import { loadPrivateProfileSetupStatus } from "../domain/account/account-service"
import { accountConfig } from "../domain/account/config"
import {
  AccountNetworkSettings, AccountSyncPanel, DeviceJournalOwnershipPanel, DeviceTrainingDataPanel, EraseLocalData, SwitchAccountPanel,
} from "./account/index"
import { AccountAuthGateway } from "./account/AccountAuthGateway"
import { BetaAccountSettings } from "./account/BetaAccountSettings"
import { AccountJournalDraftPanel } from "./account/AccountJournalDraftPanel"
import { accountJournalPreviewEnabled } from "../domain/account/account-journal-api"
import { AccountJournalHistory } from "./account/AccountJournalHistory"
import { AccountJournalMigration } from "./account/AccountJournalMigration"
import { mono, primaryBtn, secondaryBtn } from "./account/styles"
import { InstallShortcutSuggestion } from "../components/InstallShortcut"
import { LoungeEntry } from "./account/LoungeEntry"
import { requestVerifiedAccountScopeRefresh } from "../domain/account/verified-account-scope"

type SetupState = "checking" | "not-required" | "saving" | "needs-profile" | "ready" | "failed"

function authenticatedMethod(user: AccountUser): AuthMethod | null {
  return user.provider === "kakao"
    || user.provider === "google"
    || user.provider === "email"
    || user.provider === "phone"
    ? user.provider
    : null
}

export function Account({ onBack, onOpenImport, onOpenRestore, loungeRequested = false }: {
  readonly onBack?: () => void
  readonly onOpenImport?: () => void
  readonly onOpenRestore?: () => void
  readonly loungeRequested?: boolean
}) {
  const config = accountConfig()
  const today = koreaServiceDate()
  const [user, setUser] = React.useState<AccountUser | null>(null)
  const [loading, setLoading] = React.useState(true)
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
  const sessionBlockedRef = React.useRef(false)

  React.useEffect(() => {
    clearAuthReturnAttemptIdFromUrl()
  }, [])

  React.useEffect(() => {
    let mounted = true
    let unsubscribe: () => void = () => undefined
    let verificationSequence = 0

    const applyVerifiedUser = (nextUser: AccountUser | null) => {
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
            applyVerifiedUser(null)
            setAccountActionNotice({ ok: false, message: "로그인 정보를 다시 확인하지 못했어요." })
          })
      }, { ignoreInitialSession: true })
      const initialSequence = verificationSequence
      const initialUser = sessionBlockedRef.current ? null : await currentUser()
      if (!mounted) return
      if (verificationSequence === initialSequence) applyVerifiedUser(initialUser)
      if (callback !== null && !(emailCallback.handled && emailCallback.requiresPreAuth)) {
        setAuthCallbackNotice({ ok: callback.ok, message: callback.message })
      }
    }
    void bootstrap().catch(() => {
      if (!mounted) return
      setAccountActionNotice({ ok: false, message: "로그인 확인을 마치지 못했어요. 다시 시도해 주세요." })
      setLoading(false)
    })
    return () => { mounted = false; unsubscribe() }
  }, [])

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
    if (emailCallbackAttemptId !== null) {
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
      if (pending !== null) {
        const finalized = await finalizePendingAccountSetup({
          userId: user.id,
          returnAttemptId,
          today,
          config,
        })
        if (finalized.attempted) {
          return {
            ok: finalized.result?.ok ?? false,
            ready: finalized.result?.ok ?? false,
            canComplete: false,
            message: finalized.result?.message ?? "가입 정보를 확인하지 못했어요.",
            pendingAttempted: true,
          }
        }
      }
      const remote = await loadPrivateProfileSetupStatus({
        userId: user.id,
        privacyPolicyVersion: config.privacyPolicy.version,
        termsOfServiceVersion: config.termsOfService.version,
      })
      if (remote.ready) writeCurrentSetupReceipt(user.id, config)
      else clearCurrentSetupReceipt(user.id)
      return { ...remote, pendingAttempted: false }
    })()
    void completion
      .then((result) => {
        if (cancelled || activeUserIdRef.current !== user.id || setupAttemptRef.current !== attemptKey) return
        if (result.ready) {
          setSetupState("ready")
          setSetupNotice(result.message)
          requestVerifiedAccountScopeRefresh()
        } else if (!result.pendingAttempted && result.canComplete) {
          setSetupState("needs-profile")
          setSetupNotice("확인 링크를 새 화면에서 열었어요. 나이와 필수 약관만 다시 확인하면 가입이 끝나요.")
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
    unverifiedAccountSessionOpen,
    deletedAccountSessionOpen,
  ])

  const clearConfirmedLocalSession = (userId: string | null) => {
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
    setBusy(true)
    setAccountActionNotice(null)
    const result = await signOut({ scope: "local" })
    if (result.ok) clearConfirmedLocalSession(signingOutUserId)
    setAccountActionNotice(result)
    setBusy(false)
    return result
  }

  const handleDeletionCompleted = async (): Promise<AuthResult> => {
    const deletingUserId = activeUserIdRef.current ?? user?.id ?? null
    setBusy(true)
    setAccountActionNotice(null)
    const result = await closeDeletedAccountSessions()
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

  return (
    <div style={{ padding: "18px 20px 90px" }}>
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
            {user ? "내 계정" : "로그인 또는 가입"}
          </h1>
        </div>
      </div>

      {accountActionNotice !== null && (
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
      {authCallbackNotice !== null && (
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

      {loading ? (
        <p role="status" style={{ ...mono, fontSize: 12, color: "var(--ink-3)", marginTop: 24 }}>계정 상태를 확인하고 있어요.</p>
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
              setLoading(true)
              setSetupState("checking")
              void currentUser({ throwOnFailure: true })
                .then((verified) => {
                  if (verified?.id !== expectedUserId) throw new Error("AUTH_IDENTITY_MISMATCH")
                  if (isAuthSessionQuarantined()) throw new Error("AUTH_SESSION_QUARANTINED")
                  sessionBlockedRef.current = false
                  activeUserIdRef.current = verified.id
                  setupAttemptRef.current = null
                  setUser(verified)
                  setEmailCallbackAttemptId(null)
                  setLoading(false)
                })
                .catch(() => {
                  try {
                    clearPendingAccountSetupForAttempt(emailCallbackAttemptId)
                  } catch {
                    // 서버로 확인하지 못한 세션은 아래 로그아웃 결과와 무관하게 계정 UI에서 차단한다.
                  }
                  void signOut({ scope: "local" })
                    .catch(() => ({ ok: false, message: "이 기기의 로그아웃을 확인하지 못했어요." }))
                    .then((closed) => {
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
      ) : user === null ? (
        <AccountAuthGateway config={config} today={today} onUnsafeSessionDetected={blockUnverifiedAccountSession} />
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
      ) : setupState === "saving" || setupState === "checking" ? (
        <div style={{ marginTop: 24 }}>
          <p role="status" style={{ fontFamily: "var(--sans)", fontSize: 14, lineHeight: 1.65, margin: 0 }}>
            가입 정보를 안전하게 저장하고 있어요. 이 화면을 잠시 그대로 두세요.
          </p>
        </div>
      ) : setupState === "failed" ? (
        <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 12 }}>
          <h2 style={{ fontFamily: "var(--sans)", fontSize: 18, margin: 0, letterSpacing: 0 }}>가입을 마무리하지 못했어요</h2>
          <p role="alert" style={{ fontFamily: "var(--sans)", fontSize: 13, lineHeight: 1.65, color: "var(--ink-2)", margin: 0 }}>
            {setupNotice} 이 기기의 일지와 훈련 계획은 그대로예요. 가입이 끝날 때까지 동기화는 열지 않아요.
          </p>
          <button type="button" style={primaryBtn} onClick={() => setSetupRetry(value => value + 1)}>다시 확인하기</button>
          <button type="button" style={secondaryBtn} disabled={busy} onClick={() => void handleSignOut()}>로그아웃하고 다시 시작</button>
        </div>
      ) : setupState === "needs-profile" ? (
        <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 14 }}>
          <h2 style={{ fontFamily: "var(--sans)", fontSize: 18, margin: 0, letterSpacing: 0 }}>가입을 한 번만 더 확인해 주세요</h2>
          <p role="status" style={{ fontFamily: "var(--sans)", fontSize: 13, lineHeight: 1.65, color: "var(--ink-2)", margin: 0 }}>
            {setupNotice} 생년월일은 나이 확인에만 사용하고 코치, 분석, 포인트에는 보내지 않아요.
          </p>
          <BetaAccountSettings
            userId={user.id}
            today={today}
            legalDocuments={config}
            completionOnly
            onCompleted={() => {
              writeCurrentSetupReceipt(user.id, config)
              setSetupState("ready")
              setSetupNotice("가입 확인을 마쳤어요.")
              requestVerifiedAccountScopeRefresh()
            }}
          />
          <button type="button" style={secondaryBtn} disabled={busy} onClick={() => void handleSignOut()}>로그아웃하고 다시 시작</button>
        </div>
      ) : setupState === "ready" ? (
        <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ border: "1px solid var(--line)", borderRadius: "var(--r-md)", padding: "14px 16px" }}>
            <div style={{ ...mono, fontSize: 10, color: "var(--ink-3)", letterSpacing: 0 }}>로그인됨</div>
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
          </div>

          {setupNotice !== null && <p role="status" style={{ ...mono, fontSize: 11, margin: 0 }}>{setupNotice}</p>}
          <InstallShortcutSuggestion eligible={setupState === "ready"} returnFocusTo={() => document.querySelector<HTMLElement>('[data-install-shortcut-return="account"]')} />
          {profileSetupComplete && <LoungeEntry key={user.id} userId={user.id} requested={loungeRequested} />}

          <AccountNetworkSettings
            userId={user.id}
            today={today}
            legalDocuments={config}
            profileSetupComplete={profileSetupComplete}
            onDeletionCompleted={handleDeletionCompleted}
          />
          <DeviceJournalOwnershipPanel userId={user.id} />
          <DeviceTrainingDataPanel userId={user.id} />
          <AccountSyncPanel userId={user.id} />
          {accountJournalPreviewEnabled() && <AccountJournalDraftPanel key={user.id} userId={user.id} />}
          {accountJournalPreviewEnabled() && <AccountJournalHistory key={`history-${user.id}`} />}
          {accountJournalPreviewEnabled() && <AccountJournalMigration key={`migration-${user.id}`} userId={user.id} />}

          <SectionLb>기기 데이터 가져오기</SectionLb>
          <div data-testid="import-teaser" style={{ border: "1px solid var(--line)", borderRadius: "var(--r-md)", padding: "12px 14px" }}>
            <div style={{ fontFamily: "var(--sans)", fontSize: 13.5, fontWeight: 600 }}>워치 기록을 파일로 가져올 수 있어요</div>
            <p style={{ fontFamily: "var(--sans)", fontSize: 12, lineHeight: 1.6, color: "var(--ink-2)", margin: "6px 0 0" }}>
              가민 커넥트 등에서 활동을 TCX·GPX로 내보내면 거리·시간·평균 페이스가 채워진 일지 초안이 만들어져요.
            </p>
            {onOpenImport && <button type="button" onClick={onOpenImport} style={{ ...secondaryBtn, marginTop: 10, minHeight: 44 }}>파일 고르기</button>}
          </div>

          <SwitchAccountPanel
            onSignOut={handleSignOut}
            onOpenBackup={onOpenRestore}
            onOutcome={setAccountActionNotice}
          />
          <button type="button" style={secondaryBtn} disabled={busy} onClick={() => void handleSignOut()}>로그아웃</button>
          <p style={{ ...mono, fontSize: 10.5, color: "var(--ink-4)", lineHeight: 1.6, margin: 0 }}>로그아웃해도 이 기기의 일지는 지워지지 않아요.</p>
        </div>
      ) : (
        <div style={{ marginTop: 24 }}>
          <p role="status" style={{ fontFamily: "var(--sans)", fontSize: 14, lineHeight: 1.65, margin: 0 }}>
            가입 정보를 다시 확인하고 있어요. 확인이 끝나기 전에는 계정 기록을 열지 않아요.
          </p>
        </div>
      )}

      {onOpenRestore && !loading && (
        <div style={{ marginTop: 24 }}>
          <SectionLb>내려받은 백업 되돌리기</SectionLb>
          <p style={{ fontFamily: "var(--sans)", fontSize: 12.5, lineHeight: 1.6, color: "var(--ink-2)", margin: "8px 0 0" }}>
            전에 내려받은 일지 백업 파일(JSON)이 있으면 계정 없이도 이 기기로 되돌릴 수 있어요. 지금 있는 일지는 지우지 않아요.
          </p>
          <button type="button" data-testid="open-restore-account" onClick={onOpenRestore} style={{ ...secondaryBtn, marginTop: 10, minHeight: 44 }}>백업 파일 고르기</button>
        </div>
      )}

      {!loading && <EraseLocalData onOpenRestore={onOpenRestore} />}
    </div>
  )
}
