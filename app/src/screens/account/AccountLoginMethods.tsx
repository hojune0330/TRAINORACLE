import React from "react"
import { loadAccountAuthMethods, updateAccountPassword, requestAccountPasswordReauthentication } from "../../domain/account/account-settings"
import "./account-settings.css"

const defaultActions = { loadAccountAuthMethods, updateAccountPassword, requestAccountPasswordReauthentication }
export type AccountLoginMethodsProps = {
  readonly userId: string
  readonly email?: string
  readonly onLoginRequired?: () => void
  readonly actions?: typeof defaultActions
}
const providerNames: Record<string, string> = { google: "Google", kakao: "카카오", email: "이메일", phone: "전화번호" }

export function AccountLoginMethods({ userId, email, onLoginRequired, actions = defaultActions }: AccountLoginMethodsProps) {
  const [methods, setMethods] = React.useState<Awaited<ReturnType<typeof loadAccountAuthMethods>> | null>(null)
  const [message, setMessage] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [currentPassword, setCurrentPassword] = React.useState("")
  const [nonce, setNonce] = React.useState("")
  const [visible, setVisible] = React.useState(false)
  const [reauth, setReauth] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  const generation = React.useRef(0)
  const clear = () => { setPassword(""); setCurrentPassword(""); setNonce(""); setVisible(false); setReauth(false) }
  React.useEffect(() => {
    const id = ++generation.current
    clear(); setMethods(null); setMessage(""); setBusy(false)
    void actions.loadAccountAuthMethods(userId).then(result => {
      if (generation.current === id) { setMethods(result); if (!result.ok) setMessage(result.message) }
    }).catch(() => { if (generation.current === id) setMessage("로그인 수단을 불러오지 못했어요. 잠시 후 다시 열어 주세요.") })
    return () => { generation.current++ }
  }, [userId, actions])
  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (busy || !methods?.ok || password.length < 8 || (methods.hasPassword && !currentPassword)) return
    const id = generation.current
    setBusy(true); setMessage("")
    try {
      const result = await actions.updateAccountPassword({ userId, password, currentPassword: currentPassword || undefined, nonce: nonce || undefined })
      if (generation.current !== id) return
      setMessage(result.message)
      if (result.state === "LOGIN_REQUIRED") { clear(); onLoginRequired?.() }
      else if (result.ok) { clear(); setMethods({ ...methods, hasPassword: true }) }
      else if (result.state === "REAUTH_REQUIRED") setReauth(true)
    } catch { if (generation.current === id) setMessage("비밀번호를 저장하지 못했어요. 다시 시도해 주세요.") }
    finally { if (generation.current === id) setBusy(false) }
  }
  const requestCode = async () => {
    if (busy) return
    const id = generation.current
    setBusy(true)
    try {
      const result = await actions.requestAccountPasswordReauthentication(userId)
      if (generation.current === id) setMessage(result.message)
    } catch { if (generation.current === id) setMessage("인증 코드를 보내지 못했어요. 다시 시도해 주세요.") }
    finally { if (generation.current === id) setBusy(false) }
  }
  return <section className="account-settings" aria-label="로그인 수단 관리">
    <h2>로그인 수단</h2>
    {email && <p className="account-settings__hint">{email}</p>}
    {!methods && !message && <p role="status">로그인 수단을 확인하고 있어요.</p>}
    {methods?.ok && <>
      <ul>{methods.providers.map(provider => <li key={provider}>{providerNames[provider] ?? provider}</li>)}{methods.hasPassword && <li>이메일·비밀번호</li>}</ul>
      <form onSubmit={submit}>
        <h3>{methods.hasPassword ? "비밀번호 변경" : "이 계정에 비밀번호 추가"}</h3>
        <p className="account-settings__hint">현재 계정을 그대로 사용해요. 비밀번호는 8자 이상 입력해 주세요.</p>
        {methods.hasPassword && <label>현재 비밀번호<input type={visible ? "text" : "password"} autoComplete="current-password" value={currentPassword} onChange={event => setCurrentPassword(event.target.value)} disabled={busy} required /></label>}
        <label>새 비밀번호<input type={visible ? "text" : "password"} autoComplete="new-password" minLength={8} value={password} onChange={event => setPassword(event.target.value)} disabled={busy} required /></label>
        <button type="button" className="account-settings__secondary" aria-pressed={visible} onClick={() => setVisible(!visible)}>{visible ? "비밀번호 숨기기" : "비밀번호 보기"}</button>
        {reauth && <div className="account-settings__reauth"><p>계정을 확인한 뒤 비밀번호를 저장할 수 있어요.</p><button type="button" disabled={busy} onClick={() => void requestCode()}>인증 코드 보내기</button><label>인증 코드<input autoComplete="one-time-code" value={nonce} onChange={event => setNonce(event.target.value)} disabled={busy} required /></label></div>}
        <div className="account-settings__actions"><button type="submit" disabled={busy || password.length < 8 || (reauth && !nonce.trim())}>{busy ? "처리 중…" : "비밀번호 저장"}</button><button type="button" className="account-settings__secondary" disabled={busy} onClick={() => { clear(); setMessage("") }}>취소</button></div>
      </form>
    </>}
    {message && <p role="status">{message}</p>}
  </section>
}
