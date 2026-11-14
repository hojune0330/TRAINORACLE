import React from "react"
import type { AccountEntryMode } from "../../components/AccountEntryButton"
import {
  PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH, signInWithEmailPassword, signUpWithEmailPassword,
  requestPasswordRecovery, resendPasswordSignupEmail, type PasswordAuthResult,
} from "../../domain/account/password-auth"
import { createPendingAccountAuthAttempt, writePendingAccountSetup, markPendingAccountAuthStarted, normalizeAuthEmail } from "../../domain/account/auth-onboarding"
import { useTaskFlowBack } from "../../hooks/useTaskFlowBack"

type PasswordActions = {
  login: typeof signInWithEmailPassword; signup: typeof signUpWithEmailPassword
  requestRecovery: typeof requestPasswordRecovery; resend: typeof resendPasswordSignupEmail
}
const defaultActions: PasswordActions = { login: signInWithEmailPassword, signup: signUpWithEmailPassword, requestRecovery: requestPasswordRecovery, resend: resendPasswordSignupEmail }
type Step = "entry" | "confirmation" | "reset-email" | "reset-sent"

/** Password values live only in this mounted form, never in onboarding storage. */
export function PasswordAuthPanel({ mode, disabled = false, initialNotice = null, onBusyChange, onSignedIn, onRequireLogin, onUnsafeSessionDetected, actions = defaultActions }: {
  mode: AccountEntryMode; disabled?: boolean; initialNotice?: string | null
  onBusyChange?: (busy: boolean) => void; onSignedIn?: (userId: string) => void; onRequireLogin?: (message: string) => void; onUnsafeSessionDetected?: () => void; actions?: PasswordActions
}) {
  const [email, setEmail] = React.useState(""), [password, setPassword] = React.useState(""), [confirmation, setConfirmation] = React.useState("")
  const [showPassword, setShowPassword] = React.useState(false), [step, setStep] = React.useState<Step>("entry")
  const [busy, setBusy] = React.useState(false), [notice, setNotice] = React.useState<string | null>(initialNotice)
  const [error, setError] = React.useState(false)
  const operation = React.useRef(0), locked = React.useRef(false), mounted = React.useRef(true)
  const clearSecrets = () => { setPassword(""); setConfirmation(""); setShowPassword(false) }
  React.useEffect(() => { mounted.current = true; return () => { mounted.current = false; operation.current += 1 } }, [])
  const backToEntry = () => { if (locked.current) return; clearSecrets(); setStep("entry"); setNotice(null); setError(false) }
  useTaskFlowBack({ enabled: step !== "entry", busy, onBack: backToEntry })
  const run = async (action: () => Promise<PasswordAuthResult>, complete: (result: PasswordAuthResult) => void) => {
    if (locked.current || disabled) return
    locked.current = true; const sequence = ++operation.current
    setBusy(true); onBusyChange?.(true); setNotice(null); setError(false)
    try {
      const request = action()
      clearSecrets()
      const result = await request
      if (!mounted.current || sequence !== operation.current) return
      setNotice(result.message); setError(!result.ok)
      locked.current = false; setBusy(false); onBusyChange?.(false)
      if (result.unsafeSessionOpen) onUnsafeSessionDetected?.()
      if (result.ok) complete(result)
    } catch {
      if (mounted.current && sequence === operation.current) { clearSecrets(); setNotice("진행하지 못했어요. 입력 내용을 확인하고 다시 시도해 주세요."); setError(true) }
    } finally {
      if (mounted.current && sequence === operation.current) { locked.current = false; setBusy(false); onBusyChange?.(false) }
    }
  }
  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    if (locked.current || disabled) return
    const address = normalizeAuthEmail(email)
    if (!address) { setNotice("이메일 주소를 확인해 주세요."); setError(true); return }
    if (!password) { setNotice("비밀번호를 입력해 주세요."); setError(true); return }
    if (mode === "signup" && password.length < PASSWORD_MIN_LENGTH) { setNotice(`비밀번호는 ${PASSWORD_MIN_LENGTH}자 이상 입력해 주세요.`); setError(true); return }
    if (mode === "signup" && password !== confirmation) { setNotice("비밀번호가 서로 달라요. 다시 확인해 주세요."); setError(true); return }
    const secret = password
    void run(() => {
      const pending = createPendingAccountAuthAttempt({ method: "password", entryMode: mode, expectedEmail: address })
      writePendingAccountSetup(pending)
      if (!markPendingAccountAuthStarted(pending.attemptId)) throw Error("AUTH_ATTEMPT_NOT_STARTED")
      return (mode === "signup" ? actions.signup : actions.login)(address, secret, pending.attemptId)
    }, result => {
      if (result.state === "SIGNED_IN" && result.verifiedUserId) onSignedIn?.(result.verifiedUserId)
      else if (result.state === "EMAIL_CONFIRMATION_REQUIRED") setStep("confirmation")
      else if (result.state === "PASSWORD_LOGIN_REQUIRED") { setStep("entry"); onRequireLogin?.(result.message) }
    })
  }
  const muted = busy || disabled
  return <div className="account-password" aria-label={mode === "signup" ? "이메일 회원가입" : "이메일 로그인"} aria-busy={busy}>
    {step === "entry" ? <form onSubmit={submit}>
      <div className="account-auth__field-group">
        <label htmlFor="password-auth-email">이메일</label>
        <input id="password-auth-email" name="email" type="email" autoComplete="username" autoCapitalize="none" spellCheck={false} value={email} disabled={muted} onChange={event => setEmail(event.target.value)} required />
      </div>
      <div className="account-auth__field-group">
        <label htmlFor="password-auth-password">비밀번호</label>
        <input id="password-auth-password" name="password" type={showPassword ? "text" : "password"} autoComplete={mode === "signup" ? "new-password" : "current-password"} maxLength={PASSWORD_MAX_LENGTH} value={password} disabled={muted} onChange={event => setPassword(event.target.value)} required />
        {mode === "signup" && <small>{PASSWORD_MIN_LENGTH}자 이상 입력해 주세요.</small>}
      </div>
      {mode === "signup" && <div className="account-auth__field-group">
        <label htmlFor="password-auth-confirmation">비밀번호 확인</label>
        <input id="password-auth-confirmation" name="passwordConfirmation" type={showPassword ? "text" : "password"} autoComplete="new-password" maxLength={PASSWORD_MAX_LENGTH} value={confirmation} disabled={muted} onChange={event => setConfirmation(event.target.value)} required />
      </div>}
      <label className="account-password__show"><input type="checkbox" checked={showPassword} disabled={muted} onChange={event => setShowPassword(event.target.checked)} />비밀번호 보기</label>
      <button className="account-auth__primary" type="submit" disabled={muted}>{busy ? "확인하는 중…" : mode === "signup" ? "회원가입" : "로그인"}</button>
      {mode === "login" && <button className="account-auth__text-action" type="button" disabled={muted} onClick={() => { clearSecrets(); setStep("reset-email"); setNotice(null); setError(false) }}>비밀번호 찾기</button>}
      {mode === "signup" && <p className="account-auth__privacy-note">이메일 확인 뒤 나이와 필수 약관을 확인하면 가입이 완료돼요. 간편 로그인으로 가입했다면 같은 방법으로 로그인해 주세요.</p>}
    </form> : step === "confirmation" ? <>
      <h2>이메일을 확인해 주세요</h2>
      <p>확인 메일의 링크를 열어 가입을 이어가세요. 메일이 안 보이면 스팸함도 확인해 주세요.</p>
      <button className="account-auth__text-action" type="button" disabled={muted} onClick={() => void run(() => actions.resend(email), () => {})}>확인 이메일 다시 보내기</button>
      <button className="account-auth__text-action" type="button" disabled={muted} onClick={backToEntry}>이메일 다시 입력</button>
    </> : <>
      <h2>{step === "reset-sent" ? "재설정 안내를 확인해 주세요" : "비밀번호 찾기"}</h2>
      {step === "reset-email" ? <form onSubmit={event => { event.preventDefault(); const address = normalizeAuthEmail(email); if (!address) { setNotice("이메일 주소를 확인해 주세요."); setError(true); return }; void run(() => actions.requestRecovery(address), result => { if (result.state === "RECOVERY_EMAIL_SENT") setStep("reset-sent") }) }}>
        <div className="account-auth__field-group"><label htmlFor="password-reset-email">가입한 이메일</label><input id="password-reset-email" name="email" type="email" autoComplete="username" autoCapitalize="none" value={email} disabled={muted} onChange={event => setEmail(event.target.value)} required /></div>
        <button className="account-auth__primary" type="submit" disabled={muted}>{busy ? "보내는 중…" : "비밀번호 재설정 이메일 받기"}</button>
      </form> : <p>해당 주소로 안내를 보낼 수 있다면 메일을 보내드려요. 받은편지함과 스팸함을 확인하고, 필요하면 이메일을 다시 입력해 주세요.</p>}
      {step === "reset-sent" && <button className="account-auth__text-action" type="button" disabled={muted} onClick={() => { setStep("reset-email"); setNotice(null) }}>이메일 다시 입력</button>}
      <button className="account-auth__text-action" type="button" disabled={muted} onClick={backToEntry}>로그인으로 돌아가기</button>
    </>}
    {notice && <p role="status" className="account-auth__notice" data-state={error ? "error" : "pending"}>{notice}</p>}
  </div>
}
