import React from "react"
import { PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH, completePasswordAuthCallback, updateRecoveredPassword, cancelPasswordRecovery, type PasswordAuthResult } from "../../domain/account/password-auth"

const defaultActions = { complete: completePasswordAuthCallback, update: updateRecoveredPassword, cancel: cancelPasswordRecovery }
/** Recovery stays outside account admission until the domain confirms session closure. */
export function PasswordAuthCallbackPanel({ onLoginRequired, onSignedIn, actions = defaultActions }: {
  onLoginRequired: (message: string) => void; onSignedIn?: (userId: string) => Promise<boolean>; actions?: typeof defaultActions
}) {
  const [state, setState] = React.useState<"checking" | "ready" | "error">("checking")
  const [notice, setNotice] = React.useState<string | null>(null), [busy, setBusy] = React.useState(false)
  const [recoveryEmail, setRecoveryEmail] = React.useState<string | null>(null)
  const [password, setPassword] = React.useState(""), [showPassword, setShowPassword] = React.useState(false)
  const mounted = React.useRef(true), locked = React.useRef(false), sequence = React.useRef(0)
  const clearSecrets = () => { setPassword(""); setShowPassword(false) }
  const apply = React.useRef((result: PasswordAuthResult) => {})
  apply.current = result => {
    setNotice(result.message)
    if (result.ok && (result.state === "PASSWORD_LOGIN_REQUIRED" || result.state === "PASSWORD_UPDATED")) onLoginRequired(result.message)
    else if (result.ok && result.state === "SIGNED_IN" && result.verifiedUserId && onSignedIn) {
      setState("checking")
      const current = sequence.current
      void onSignedIn(result.verifiedUserId).then(accepted => {
        if (!mounted.current || current !== sequence.current || accepted) return
        setState("error"); setNotice("로그인한 계정을 다시 확인하지 못했어요. 로그인 화면에서 다시 시도해 주세요.")
      }).catch(() => {
        if (mounted.current && current === sequence.current) { setState("error"); setNotice("로그인한 계정을 다시 확인하지 못했어요. 로그인 화면에서 다시 시도해 주세요.") }
      })
    }
    else if (result.ok && result.state === "RECOVERY_READY" && result.recoveryEmail) { setRecoveryEmail(result.recoveryEmail); setState("ready") }
    else if (!result.ok && result.retryable === true && !result.unsafeSessionOpen && recoveryEmail) setState("ready")
    else setState("error")
  }
  React.useEffect(() => {
    mounted.current = true; const current = ++sequence.current
    void actions.complete().then(result => { if (mounted.current && current === sequence.current) apply.current(result) })
      .catch(() => { if (mounted.current && current === sequence.current) { setState("error"); setNotice("이메일 확인을 마치지 못했어요. 로그인 화면에서 다시 시작해 주세요.") } })
    return () => { mounted.current = false; sequence.current += 1 }
  }, [actions])
  const run = async (action: () => Promise<PasswordAuthResult>) => {
    if (locked.current) return
    locked.current = true; setBusy(true); const current = ++sequence.current
    try {
      const request = action(); clearSecrets()
      const result = await request
      if (mounted.current && current === sequence.current) apply.current(result)
    } catch { if (mounted.current && current === sequence.current) { clearSecrets(); setNotice("변경 결과를 확인하지 못했어요. 로그인 화면으로 돌아가 다시 시도해 주세요."); setState("error") } }
    finally { if (mounted.current && current === sequence.current) { locked.current = false; setBusy(false) } }
  }
  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    if (locked.current) return
    if (password.length < PASSWORD_MIN_LENGTH) { setNotice(`비밀번호는 ${PASSWORD_MIN_LENGTH}자 이상 입력해 주세요.`); return }
    const secret = password
    void run(() => actions.update(secret))
  }
  return <section className="account-auth account-password" aria-label="이메일 확인과 비밀번호 재설정" aria-busy={state === "checking" || busy}>
    <h2>{state === "checking" ? "이메일 확인 중" : state === "ready" ? "새 비밀번호 설정" : "이메일 확인을 마치지 못했어요"}</h2>
    {state === "checking" && <p role="status">이메일 링크를 안전하게 확인하고 있어요.</p>}
    {state === "ready" && <>
      <p><strong>변경할 계정: {recoveryEmail}</strong></p>
      <p>새 비밀번호를 저장한 뒤 로그인 화면에서 다시 로그인해 주세요.</p>
      <form onSubmit={submit}>
        <div className="account-auth__field-group"><label htmlFor="recovered-password">새 비밀번호</label><input id="recovered-password" name="newPassword" type={showPassword ? "text" : "password"} autoComplete="new-password" autoCapitalize="none" spellCheck={false} minLength={PASSWORD_MIN_LENGTH} maxLength={PASSWORD_MAX_LENGTH} value={password} disabled={busy} onChange={event => setPassword(event.target.value)} required /><small>{PASSWORD_MIN_LENGTH}자 이상 입력해 주세요.</small></div>
        <label className="account-password__show"><input type="checkbox" checked={showPassword} disabled={busy} onChange={event => setShowPassword(event.target.checked)} />비밀번호 보기</label>
        <button className="account-auth__primary" type="submit" disabled={busy}>{busy ? "저장하는 중…" : "새 비밀번호 저장"}</button>
      </form>
    </>}
    {notice && <p role="status">{notice}</p>}
    {state !== "checking" && <button className="account-auth__text-action" type="button" disabled={busy} onClick={() => void run(actions.cancel)}>로그인 화면으로 돌아가기</button>}
  </section>
}
