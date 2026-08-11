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
import { accountConfig } from "../domain/account/config"
import {
  AccountNetworkSettings, AccountSyncPanel, EraseLocalData, SwitchAccountPanel,
} from "./account/index"
import { inputStyle, mono, primaryBtn, secondaryBtn } from "./account/styles"

export function Account({ onBack, onOpenImport, onOpenRestore }: {
  readonly onBack?: () => void
  /** 기기 데이터 가져오기 화면으로 이동 — 계정·승인 없이 지금 되는 경로 */
  readonly onOpenImport?: () => void
  /** 백업 되돌리기 화면으로 이동 — 로그인 여부와 무관하게 쓸 수 있다 */
  readonly onOpenRestore?: () => void
}) {
  const [user, setUser] = React.useState<AccountUser | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [step, setStep] = React.useState<"email" | "code">("email")
  const [email, setEmail] = React.useState("")
  const [code, setCode] = React.useState("")
  const [busy, setBusy] = React.useState(false)
  const [notice, setNotice] = React.useState<string | null>(null)
  const [privacyAcknowledged, setPrivacyAcknowledged] = React.useState(false)
  const [termsAcknowledged, setTermsAcknowledged] = React.useState(false)

  React.useEffect(() => {
    let mounted = true
    void currentUser().then((u) => {
      if (mounted) { setUser(u); setLoading(false) }
    })
    const unsubscribe = onAuthChange((u) => { setUser(u) })
    return () => { mounted = false; unsubscribe() }
  }, [])

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
    setBusy(false); setStep("email"); setCode("")
  }

  const config = accountConfig()
  if (config === null) return null
  const legalAcknowledged = privacyAcknowledged && termsAcknowledged

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
            일지는 지금 이 기기에만 있어요. 브라우저 정리·기기 변경 때 지워질 수
            있으니, <b>계정에 연동해서 일지와 데이터를 지켜 주세요.</b>
          </p>
          <p style={{ fontFamily: "var(--sans)", fontSize: 12.5, lineHeight: 1.6, color: "var(--ink-3)", margin: 0 }}>
            비밀번호 없이 이메일 인증 코드로 가입하고 로그인해요.
            로그인해도 <b>일지가 자동으로 올라가지 않아요</b> — 동기화는 직접 켜야 시작돼요.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 8, border: "1px solid var(--line)", borderRadius: 8, padding: "12px 14px" }}>
            <p style={{ fontFamily: "var(--sans)", fontSize: 12, lineHeight: 1.55, color: "var(--ink-2)", margin: 0 }}>
              가입하기 전에 아래 안내를 읽고 확인해 주세요.
            </p>
            <label style={{ display: "flex", alignItems: "flex-start", gap: 8, fontFamily: "var(--sans)", fontSize: 12, lineHeight: 1.55, color: "var(--ink-2)" }}>
              <input type="checkbox" checked={privacyAcknowledged} onChange={(event) => setPrivacyAcknowledged(event.target.checked)} />
              <span><a href={config.privacyPolicy.url} target="_blank" rel="noreferrer">개인정보 처리방침</a>을 읽었어요.</span>
            </label>
            <label style={{ display: "flex", alignItems: "flex-start", gap: 8, fontFamily: "var(--sans)", fontSize: 12, lineHeight: 1.55, color: "var(--ink-2)" }}>
              <input type="checkbox" checked={termsAcknowledged} onChange={(event) => setTermsAcknowledged(event.target.checked)} />
              <span><a href={config.termsOfService.url} target="_blank" rel="noreferrer">이용약관</a>을 읽었어요.</span>
            </label>
          </div>

          {step === "email" ? (
            <>
              <label style={{ ...mono, fontSize: 11, color: "var(--ink-3)" }} htmlFor="account-email">이메일</label>
              <input
                id="account-email" type="email" inputMode="email" autoComplete="email"
                value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com" style={inputStyle}
              />
              <button type="button" style={primaryBtn} disabled={busy || !legalAcknowledged} onClick={() => void handleSendOtp()}>
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
              <button type="button" style={primaryBtn} disabled={busy || !legalAcknowledged} onClick={() => void handleVerify()}>
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
          <button type="button" style={secondaryBtn} disabled={busy || !legalAcknowledged} onClick={() => void handleGoogle()}>
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

          <AccountNetworkSettings
            userId={user.id}
            today={new Date().toISOString().slice(0, 10)}
            legalDocuments={config}
            initialPrivacyAcknowledged={privacyAcknowledged}
            initialTermsAcknowledged={termsAcknowledged}
          />

          <AccountSyncPanel userId={user.id} />

          <SectionLb>기기 데이터 가져오기</SectionLb>
          <div
            data-testid="import-teaser"
            style={{ border: "1px solid var(--line)", borderRadius: 10, padding: "12px 14px" }}
          >
            <div style={{ fontFamily: "var(--sans)", fontSize: 13.5, fontWeight: 600 }}>
              워치에 쌓인 기록, 파일로 지금 가져올 수 있어요
            </div>
            <p style={{ fontFamily: "var(--sans)", fontSize: 12, lineHeight: 1.6, color: "var(--ink-2)", margin: "6px 0 0" }}>
              가민 커넥트 등에서 활동을 TCX·GPX로 내보내면 거리·시간·평균 페이스가
              자동으로 채워진 일지 초안이 만들어져요. <b>기록 탭 → 워치 기록 불러오기</b>에
              있어요.
            </p>
            {onOpenImport && (
              <button
                type="button"
                onClick={onOpenImport}
                style={{ ...secondaryBtn, marginTop: 10, minHeight: 44 }}
              >
                지금 파일로 가져오기
              </button>
            )}
            <p style={{ ...mono, fontSize: 10, color: "var(--ink-4)", lineHeight: 1.65, margin: "10px 0 0" }}>
              계정 연결로 자동 수집하는 기능은 각 서비스의 승인·계약 조건 때문에
              시점을 약속할 수 없어요. 연동은 언제나 읽기 전용이에요.
            </p>
          </div>

          {/*
            로그아웃 위에 둔다. 계정을 바꾸려는 사람이 먼저 만나는 것이
            '전부 지우기'가 되어서는 안 된다 (Q4).
          */}
          <SwitchAccountPanel onSignOut={handleSignOut} onOpenBackup={onOpenRestore} />

          <button type="button" style={secondaryBtn} disabled={busy} onClick={() => void handleSignOut()}>
            로그아웃
          </button>
          <p style={{ ...mono, fontSize: 10.5, color: "var(--ink-4)", lineHeight: 1.6, margin: 0 }}>
            로그아웃해도 이 기기의 일지는 지워지지 않아요.
          </p>
        </div>
      )}

      {/* 로그인 여부와 무관하게 노출한다 — 브라우저를 지우고 온 사람은 로그아웃 상태다. */}
      {onOpenRestore && !loading && (
        <div style={{ marginTop: 24 }}>
          <SectionLb>내려받은 백업 되돌리기</SectionLb>
          <p style={{ fontFamily: "var(--sans)", fontSize: 12.5, lineHeight: 1.6, color: "var(--ink-2)", margin: "8px 0 0" }}>
            전에 내려받아 둔 일지 백업 파일(JSON)이 있으면 계정 없이도 이 기기로
            되돌릴 수 있어요. <b>지금 있는 일지는 지우지 않아요.</b>
          </p>
          <button
            type="button" data-testid="open-restore-account"
            onClick={onOpenRestore}
            style={{ ...secondaryBtn, marginTop: 10, minHeight: 44 }}
          >
            백업 파일 고르기
          </button>
        </div>
      )}

      {!loading && <EraseLocalData onOpenRestore={onOpenRestore} />}
    </div>
  )
}
