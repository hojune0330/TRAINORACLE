import React from "react"
import type { AccountConfig } from "../../domain/account/config"
import { reacceptAccountTerms } from "../../domain/account/account-settings"
import "./account-settings.css"

const defaultActions = { reacceptAccountTerms }
export function AccountLegalReconsent({ userId, config, onComplete, actions = defaultActions }: {
  readonly userId: string
  readonly config: AccountConfig
  readonly onComplete: () => void
  readonly actions?: typeof defaultActions
}) {
  const [privacy, setPrivacy] = React.useState(false)
  const [terms, setTerms] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  const [message, setMessage] = React.useState("")
  const generation = React.useRef(0)
  React.useEffect(() => { generation.current++; setPrivacy(false); setTerms(false); setMessage(""); setBusy(false); return () => { generation.current++ } }, [userId, config.privacyPolicy.version, config.termsOfService.version])
  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!privacy || !terms || busy) return
    const id = generation.current
    setBusy(true); setMessage("")
    try {
      const result = await actions.reacceptAccountTerms(userId, config)
      if (id !== generation.current) return
      setMessage(result.message)
      if (result.ok) onComplete()
    } catch { if (id === generation.current) setMessage("동의를 저장하지 못했어요. 다시 시도해 주세요.") }
    finally { if (id === generation.current) setBusy(false) }
  }
  return <section className="account-settings" aria-label="이용약관 다시 동의">
    <h2>변경된 이용 안내를 확인해 주세요</h2>
    <p>계속 이용하려면 아래 내용을 읽고 각각 동의해 주세요.</p>
    <form onSubmit={submit}>
      <a href={config.privacyPolicy.url} target="_blank" rel="noopener noreferrer">개인정보처리방침 읽기 (새 창)</a>
      <label className="account-settings__check"><input type="checkbox" checked={privacy} disabled={busy} onChange={event => setPrivacy(event.target.checked)} />[필수] 개인정보처리방침에 동의해요</label>
      <a href={config.termsOfService.url} target="_blank" rel="noopener noreferrer">이용약관 읽기 (새 창)</a>
      <label className="account-settings__check"><input type="checkbox" checked={terms} disabled={busy} onChange={event => setTerms(event.target.checked)} />[필수] 이용약관에 동의해요</label>
      <button type="submit" disabled={!privacy || !terms || busy}>{busy ? "저장 중…" : "동의하고 계속하기"}</button>
    </form>
    {message && <p role="status">{message}</p>}
  </section>
}
