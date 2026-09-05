// 계정 화면 — 간편 로그인, 가입 확정, 선택 동기화 설정.
// 공개 게이트가 꺼져 있으면 AppShell이 진입점 자체를 렌더링하지 않는다.
import React from "react"
import { ArrowLeft } from "lucide-react"
import { SectionLb } from "../components/JournalPrimitives"
import { currentUser, maskPhoneNumber, onAuthChange, signOut } from "../domain/account/auth"
import type { AccountUser } from "../domain/account/auth"
import {
  finalizePendingAccountSetup,
  hasCurrentSetupReceipt,
  readPendingAccountSetup,
  writeCurrentSetupReceipt,
} from "../domain/account/auth-onboarding"
import { koreaServiceDate } from "../domain/account/service-date"
import { loadPrivateProfileSetupStatus } from "../domain/account/account-service"
import { accountConfig } from "../domain/account/config"
import {
  AccountNetworkSettings, AccountSyncPanel, DeviceJournalOwnershipPanel, DeviceTrainingDataPanel, EraseLocalData, SwitchAccountPanel,
} from "./account/index"
import { AccountAuthGateway } from "./account/AccountAuthGateway"
import { BetaAccountSettings } from "./account/BetaAccountSettings"
import { mono, primaryBtn, secondaryBtn } from "./account/styles"

type SetupState = "checking" | "not-required" | "saving" | "needs-profile" | "ready" | "failed"

export function Account({ onBack, onOpenImport, onOpenRestore }: {
  readonly onBack?: () => void
  readonly onOpenImport?: () => void
  readonly onOpenRestore?: () => void
}) {
  const config = accountConfig()
  const today = koreaServiceDate()
  const [user, setUser] = React.useState<AccountUser | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [busy, setBusy] = React.useState(false)
  const [setupState, setSetupState] = React.useState<SetupState>("checking")
  const [setupNotice, setSetupNotice] = React.useState<string | null>(null)
  const [setupRetry, setSetupRetry] = React.useState(0)
  const setupAttemptRef = React.useRef<string | null>(null)
  const activeUserIdRef = React.useRef<string | null>(null)

  React.useEffect(() => {
    let mounted = true
    let authEventSeen = false
    void currentUser().then((nextUser) => {
      if (mounted && !authEventSeen) {
        activeUserIdRef.current = nextUser?.id ?? null
        setUser(nextUser)
        setLoading(false)
      }
    })
    const unsubscribe = onAuthChange((nextUser) => {
      authEventSeen = true
      const nextUserId = nextUser?.id ?? null
      if (activeUserIdRef.current !== nextUserId) {
        activeUserIdRef.current = nextUserId
        setupAttemptRef.current = null
        setSetupState("checking")
        setSetupNotice(null)
      }
      setUser(nextUser)
      setLoading(false)
    })
    return () => { mounted = false; unsubscribe() }
  }, [])

  React.useEffect(() => {
    if (user === null || config === null) {
      setSetupState("not-required")
      return
    }
    if (hasCurrentSetupReceipt(user.id, config)) {
      setSetupState("ready")
      setSetupNotice(null)
      return
    }
    const pending = readPendingAccountSetup()
    const attemptKey = pending === null
      ? `${user.id}:remote-profile:${config.privacyPolicy.version}:${config.termsOfService.version}:${setupRetry}`
      : `${user.id}:${pending.createdAtMs}:${setupRetry}`
    if (setupAttemptRef.current === attemptKey) return
    setupAttemptRef.current = attemptKey
    let cancelled = false
    setSetupState("saving")
    setSetupNotice(null)
    const completion = pending === null
      ? loadPrivateProfileSetupStatus({
        userId: user.id,
        privacyPolicyVersion: config.privacyPolicy.version,
        termsOfServiceVersion: config.termsOfService.version,
      }).then(result => {
        if (result.ready) writeCurrentSetupReceipt(user.id, config)
        return result
      })
      : finalizePendingAccountSetup({
        userId: user.id,
        today,
        config,
      }).then(({ result }) => ({
        ok: result?.ok ?? false,
        ready: result?.ok ?? false,
        message: result?.message ?? "가입 정보를 확인하지 못했어요.",
      }))
    void completion
      .then((result) => {
        if (cancelled) return
        if (result.ready) {
          setSetupState("ready")
          setSetupNotice(result.message)
        } else if (pending === null && result.ok) {
          setSetupState("needs-profile")
          setSetupNotice("확인 링크를 새 화면에서 열었어요. 나이와 필수 약관만 다시 확인하면 가입이 끝나요.")
        } else {
          setSetupState("failed")
          setSetupNotice(result.message)
        }
      })
      .catch(() => {
        if (cancelled) return
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
  ])

  const handleSignOut = async () => {
    setBusy(true)
    await signOut()
    setupAttemptRef.current = null
    activeUserIdRef.current = null
    setBusy(false)
    setUser(null)
    setSetupState("not-required")
    setSetupNotice(null)
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

      {loading ? (
        <p role="status" style={{ ...mono, fontSize: 12, color: "var(--ink-3)", marginTop: 24 }}>계정 상태를 확인하고 있어요.</p>
      ) : user === null ? (
        <AccountAuthGateway config={config} today={today} />
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
            }}
          />
          <button type="button" style={secondaryBtn} disabled={busy} onClick={() => void handleSignOut()}>로그아웃하고 다시 시작</button>
        </div>
      ) : (
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

          <AccountNetworkSettings
            userId={user.id}
            today={today}
            legalDocuments={config}
            profileSetupComplete={profileSetupComplete}
          />
          <DeviceJournalOwnershipPanel userId={user.id} />
          <DeviceTrainingDataPanel userId={user.id} />
          <AccountSyncPanel userId={user.id} />

          <SectionLb>기기 데이터 가져오기</SectionLb>
          <div data-testid="import-teaser" style={{ border: "1px solid var(--line)", borderRadius: "var(--r-md)", padding: "12px 14px" }}>
            <div style={{ fontFamily: "var(--sans)", fontSize: 13.5, fontWeight: 600 }}>워치 기록을 파일로 가져올 수 있어요</div>
            <p style={{ fontFamily: "var(--sans)", fontSize: 12, lineHeight: 1.6, color: "var(--ink-2)", margin: "6px 0 0" }}>
              가민 커넥트 등에서 활동을 TCX·GPX로 내보내면 거리·시간·평균 페이스가 채워진 일지 초안이 만들어져요.
            </p>
            {onOpenImport && <button type="button" onClick={onOpenImport} style={{ ...secondaryBtn, marginTop: 10, minHeight: 44 }}>파일 고르기</button>}
          </div>

          <SwitchAccountPanel onSignOut={handleSignOut} onOpenBackup={onOpenRestore} />
          <button type="button" style={secondaryBtn} disabled={busy} onClick={() => void handleSignOut()}>로그아웃</button>
          <p style={{ ...mono, fontSize: 10.5, color: "var(--ink-4)", lineHeight: 1.6, margin: 0 }}>로그아웃해도 이 기기의 일지는 지워지지 않아요.</p>
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
