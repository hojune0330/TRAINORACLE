// 계정 화면 — 회원가입/간편 로그인 + 일지 동기화.
// feature flag OFF(accountFeatureEnabled() === false)면 AppShell이 이 화면
// 진입점 자체를 렌더링하지 않는다.
//
// 원칙:
//  - 로그인해도 자동 업로드 없음 — "동기화 켜기"는 명시적 옵트인.
//  - 메모 원문은 기본 업로드 제외. 토글을 켠 경우에만 포함(기본 OFF).
//  - 모든 실패 메시지는 "로컬 일지는 안전"을 명시.
import React from "react"
import { SectionLb } from "../components/JournalPrimitives"
import {
  currentUser, onAuthChange, requestEmailOtp, signInWithGoogle, signOut, verifyEmailOtp,
} from "../domain/account/auth"
import type { AccountUser } from "../domain/account/auth"
import { loadSyncConsent, saveSyncConsent, syncNow } from "../domain/account/sync"
import type { SyncConsent } from "../domain/account/sync"
import { localOnlyCount } from "../domain/journal-store"

const mono: React.CSSProperties = { fontFamily: "var(--mono)" }
const inputStyle: React.CSSProperties = {
  width: "100%", boxSizing: "border-box", minHeight: 44,
  padding: "10px 12px", fontSize: 16, fontFamily: "var(--mono)",
  border: "1px solid var(--line)", borderRadius: 8,
  background: "var(--paper, #fff)", color: "var(--ink)",
}
const primaryBtn: React.CSSProperties = {
  width: "100%", minHeight: 48, fontSize: 15, fontWeight: 600,
  fontFamily: "var(--sans)", border: "1px solid var(--ink)",
  borderRadius: 8, background: "var(--ink)", color: "var(--bg, #fff)",
  cursor: "pointer",
}
const secondaryBtn: React.CSSProperties = {
  ...primaryBtn, background: "transparent", color: "var(--ink)",
  border: "1px solid var(--line)", fontWeight: 500,
}

type OtpStep = "email" | "code"

export function Account({ onBack }: { readonly onBack?: () => void }) {
  const [user, setUser] = React.useState<AccountUser | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [step, setStep] = React.useState<OtpStep>("email")
  const [email, setEmail] = React.useState("")
  const [code, setCode] = React.useState("")
  const [busy, setBusy] = React.useState(false)
  const [notice, setNotice] = React.useState<string | null>(null)
  const [consent, setConsent] = React.useState<SyncConsent>(() => loadSyncConsent())
  const [syncMessage, setSyncMessage] = React.useState<string | null>(null)

  React.useEffect(() => {
    let mounted = true
    void currentUser().then((u) => {
      if (mounted) { setUser(u); setLoading(false) }
    })
    const unsubscribe = onAuthChange((u) => { setUser(u) })
    return () => { mounted = false; unsubscribe() }
  }, [])

  const updateConsent = (next: SyncConsent) => {
    setConsent(next)
    saveSyncConsent(next)
  }

  const handleSendOtp = async () => {
    setBusy(true); setNotice(null)
    const result = await requestEmailOtp(email)
    setBusy(false); setNotice(result.message)
    if (result.ok) setStep("code")
  }
  const handleVerify = async () => {
    setBusy(true); setNotice(null)
    const result = await verifyEmailOtp(email, code)
    setBusy(false); setNotice(result.ok ? null : result.message)
  }
  const handleGoogle = async () => {
    setBusy(true); setNotice(null)
    const result = await signInWithGoogle()
    setBusy(false)
    if (!result.ok) setNotice(result.message)
  }
  const handleSignOut = async () => {
    setBusy(true)
    await signOut()
    setBusy(false); setStep("email"); setCode(""); setSyncMessage(null)
  }
  const handleSync = async () => {
    if (user === null) return
    setBusy(true); setSyncMessage(null)
    const outcome = await syncNow(user.id)
    setBusy(false)
    setSyncMessage(
      outcome.ok
        ? `${outcome.message} (서버에서 ${outcome.pulled}개 확인 · ${outcome.pushed}개 백업 · 총 ${outcome.total}개)`
        : outcome.message,
    )
  }

  return (
    <div style={{ padding: "18px 20px 90px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {onBack && (
          <button
            type="button" onClick={onBack} aria-label="뒤로"
            style={{ ...secondaryBtn, width: 44, minWidth: 44, minHeight: 44, fontSize: 18 }}
          >←</button>
        )}
        <div>
          <div style={{ ...mono, fontSize: 9.5, color: "var(--ink-3)", letterSpacing: "0.14em", textTransform: "uppercase" }}>
            ACCOUNT · 계정과 백업
          </div>
          <h1 style={{ fontFamily: "var(--sans)", fontSize: 20, fontWeight: 500, margin: "4px 0 0" }}>
            {user ? "내 계정" : "로그인 / 가입"}
          </h1>
        </div>
      </div>

      {loading ? (
        <p style={{ ...mono, fontSize: 12, color: "var(--ink-3)", marginTop: 24 }}>확인 중…</p>
      ) : user === null ? (
        <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 12 }}>
          <p style={{ fontFamily: "var(--sans)", fontSize: 13, lineHeight: 1.6, color: "var(--ink-2)", margin: 0 }}>
            비밀번호 없이 이메일 인증 코드로 가입하고 로그인해요.
            로그인해도 <b>일지가 자동으로 올라가지 않아요</b> — 동기화는 아래에서 직접 켜야 시작돼요.
          </p>

          {step === "email" ? (
            <>
              <label style={{ ...mono, fontSize: 11, color: "var(--ink-3)" }} htmlFor="account-email">이메일</label>
              <input
                id="account-email" type="email" inputMode="email" autoComplete="email"
                value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com" style={inputStyle}
              />
              <button type="button" style={primaryBtn} disabled={busy} onClick={() => void handleSendOtp()}>
                {busy ? "보내는 중…" : "인증 코드 받기"}
              </button>
            </>
          ) : (
            <>
              <label style={{ ...mono, fontSize: 11, color: "var(--ink-3)" }} htmlFor="account-code">
                {email} 로 보낸 6자리 코드
              </label>
              <input
                id="account-code" inputMode="numeric" autoComplete="one-time-code"
                value={code} onChange={(e) => setCode(e.target.value)}
                placeholder="000000" style={inputStyle}
              />
              <button type="button" style={primaryBtn} disabled={busy} onClick={() => void handleVerify()}>
                {busy ? "확인 중…" : "코드 확인하고 로그인"}
              </button>
              <button type="button" style={secondaryBtn} disabled={busy} onClick={() => { setStep("email"); setCode("") }}>
                이메일 다시 입력
              </button>
            </>
          )}

          <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "4px 0" }}>
            <div style={{ flex: 1, height: 1, background: "var(--line)" }} />
            <span style={{ ...mono, fontSize: 10, color: "var(--ink-4)" }}>또는</span>
            <div style={{ flex: 1, height: 1, background: "var(--line)" }} />
          </div>
          <button type="button" style={secondaryBtn} disabled={busy} onClick={() => void handleGoogle()}>
            Google로 계속하기
          </button>

          {notice && (
            <p role="status" style={{ ...mono, fontSize: 12, color: "var(--ink-2)", margin: 0 }}>{notice}</p>
          )}
        </div>
      ) : (
        <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ border: "1px solid var(--line)", borderRadius: 10, padding: "14px 16px" }}>
            <div style={{ ...mono, fontSize: 10, color: "var(--ink-3)", letterSpacing: "0.08em" }}>로그인됨</div>
            <div style={{ fontFamily: "var(--sans)", fontSize: 15, fontWeight: 500, marginTop: 4 }}>
              {user.email ?? "이메일 미공개"}
            </div>
            {user.provider && (
              <div style={{ ...mono, fontSize: 10, color: "var(--ink-4)", marginTop: 2 }}>
                {user.provider === "google" ? "Google 간편 로그인" : "이메일 인증"}
              </div>
            )}
          </div>

          <SectionLb>일지 동기화</SectionLb>
          <p style={{ fontFamily: "var(--sans)", fontSize: 12.5, lineHeight: 1.6, color: "var(--ink-2)", margin: 0 }}>
            이 기기에 있는 일지 {localOnlyCount()}개를 계정에 백업하고, 다른 기기의
            일지와 합쳐요. 같은 일지는 <b>더 최근에 저장한 쪽</b>이 남아요.
          </p>

          <label style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 44, cursor: "pointer" }}>
            <input
              type="checkbox" checked={consent.enabled}
              onChange={(e) => updateConsent({ ...consent, enabled: e.target.checked })}
              style={{ width: 20, height: 20 }}
            />
            <span style={{ fontFamily: "var(--sans)", fontSize: 14 }}>동기화 켜기 (직접 눌러야 시작돼요)</span>
          </label>

          <label style={{ display: "flex", alignItems: "flex-start", gap: 10, minHeight: 44, cursor: "pointer", opacity: consent.enabled ? 1 : 0.45 }}>
            <input
              type="checkbox" checked={consent.includeMemos} disabled={!consent.enabled}
              onChange={(e) => updateConsent({ ...consent, includeMemos: e.target.checked })}
              style={{ width: 20, height: 20, marginTop: 2 }}
            />
            <span style={{ fontFamily: "var(--sans)", fontSize: 13, lineHeight: 1.5 }}>
              메모·노트 원문도 함께 백업
              <br /><span style={{ ...mono, fontSize: 10.5, color: "var(--ink-4)" }}>
                기본은 제외예요. 끄면 숫자 기록만 올라가요.
              </span>
            </span>
          </label>

          <button
            type="button" style={primaryBtn}
            disabled={busy || !consent.enabled}
            onClick={() => void handleSync()}
          >
            {busy ? "동기화 중…" : "지금 동기화"}
          </button>
          {syncMessage && (
            <p role="status" style={{ ...mono, fontSize: 12, color: "var(--ink-2)", margin: 0 }}>{syncMessage}</p>
          )}

          <button type="button" style={secondaryBtn} disabled={busy} onClick={() => void handleSignOut()}>
            로그아웃
          </button>
          <p style={{ ...mono, fontSize: 10.5, color: "var(--ink-4)", lineHeight: 1.6, margin: 0 }}>
            로그아웃해도 이 기기의 일지는 지워지지 않아요.
          </p>
        </div>
      )}
    </div>
  )
}
