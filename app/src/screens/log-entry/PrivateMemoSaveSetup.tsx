import React from "react"
import { KeyRound, ChevronDown, ChevronUp } from "lucide-react"
import { createRecoveryCode, isValidRecoveryCode } from "../../domain/account/private-note-crypto"
import { loadSessionRecoveryCode, subscribeSessionRecoveryCode } from "../../domain/account/private-note-sync"
import { hasRetainedPrivateMemos, preparePrivateMemoCode } from "../../domain/private-memo-preparation"
import { inputStyle } from "./input-style"

const buttonStyle: React.CSSProperties = { minHeight: 44, padding: "8px 10px", border: "1px solid var(--line)", background: "var(--surface)", color: "var(--ink)", font: "inherit", display: "inline-flex", alignItems: "center", gap: 6 }

export function PrivateMemoSaveSetup({ onReady, requested = false }: { readonly onReady: () => void; readonly requested?: boolean }) {
  const recoveryCode = React.useSyncExternalStore(subscribeSessionRecoveryCode, loadSessionRecoveryCode, () => null)
  const [code, setCode] = React.useState("")
  const [additional, setAdditional] = React.useState("")
  const [repair, setRepair] = React.useState(false)
  const [created, setCreated] = React.useState(false)
  const [kept, setKept] = React.useState(false)
  const [open, setOpen] = React.useState(requested)
  const [busy, setBusy] = React.useState(false)
  const [notice, setNotice] = React.useState<string | null>(null)
  const mounted = React.useRef(true)
  const busyRef = React.useRef(false)
  const heading = React.useRef<HTMLButtonElement>(null)
  const id = React.useId()
  React.useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  React.useEffect(() => {
    if (requested && recoveryCode === null) setOpen(true)
  }, [requested, recoveryCode])
  React.useEffect(() => {
    if (!open || recoveryCode !== null) return
    if (requested) heading.current?.focus({ preventScroll: true })
    heading.current?.scrollIntoView?.({ block: "nearest", behavior: "auto" })
  }, [open, recoveryCode, requested])

  const create = () => {
    try {
      if (hasRetainedPrivateMemos()) {
        setNotice("기존 메모 또는 휴지통에 암호화된 메모가 있어요. 보관한 기존 복구 코드를 입력해 주세요.")
        return
      }
      setCode(createRecoveryCode()); setCreated(true); setKept(false); setRepair(false); setAdditional(""); setNotice(null)
    } catch { setNotice("기존 메모 보관 상태를 확인하지 못했어요. 새 코드를 만들지 않았어요. 기록을 지우지 말고 다시 시도해 주세요.") }
  }
  const prepare = async () => {
    if (busyRef.current || ((created || repair) && !kept)) return
    const primary = code.trim().toUpperCase()
    const second = repair ? additional.trim().toUpperCase() : undefined
    if (!isValidRecoveryCode(primary) || (second !== undefined && !isValidRecoveryCode(second))) {
      setNotice("복구 코드 전체를 확인해 주세요."); return
    }
    busyRef.current = true
    setBusy(true); setNotice(null)
    const result = await preparePrivateMemoCode(primary, second, () => mounted.current)
    if (mounted.current) {
      if (result === "READY") {
        setCode(""); setAdditional(""); setOpen(false); setRepair(false); setCreated(false); setKept(false); onReady()
      } else {
        setNotice(result === "RETRY_WITH_BOTH_CODES"
          ? "코드 정리를 끝내지 못했어요. 일부 메모는 첫 번째 코드로 바뀌었을 수 있어요. 두 코드를 모두 보관하고 같은 코드로 다시 시도해 주세요."
          : "복구 코드가 기존 메모와 맞지 않거나 보관 상태가 바뀌었어요. 기록은 바꾸지 않았어요. 코드를 확인하거나, 예전에 다른 코드도 썼다면 아래에서 함께 입력해 주세요.")
      }
      setBusy(false)
    }
    busyRef.current = false
  }

  if (recoveryCode !== null) return <p role="status" style={{ fontSize: 13 }}>암호화 준비가 됐어요. 아래 저장 버튼을 눌러 메모와 기록을 저장해 주세요.</p>
  return <section aria-label="나만의 메모 저장 준비" style={{ marginBlock: 12, fontSize: 13, lineHeight: 1.6 }}>
    <button ref={heading} type="button" aria-expanded={open} aria-controls={id + "-panel"} onClick={() => setOpen(value => !value)} style={buttonStyle}>
      <KeyRound size={16} aria-hidden="true" /> 나만의 메모 저장 준비 {open ? <ChevronUp size={16} aria-hidden="true" /> : <ChevronDown size={16} aria-hidden="true" />}
    </button>
    {open && <div id={id + "-panel"} style={{ paddingBlock: 10 }}>
      <p>로그인 없이 쓰는 비밀 메모는 복구 코드로 암호화해 이 기기에 저장해요. 코드를 잃으면 운영자도 메모를 복구할 수 없어요. 작성한 글은 아직 저장 전이에요.</p>
      <fieldset disabled={busy} style={{ border: 0, padding: 0, margin: 0, minWidth: 0, display: "grid", gap: 8 }}>
        <button type="button" onClick={create} style={buttonStyle}>처음 사용해요 · 코드 만들기</button>
        <label htmlFor={id}>{created ? "보관할 복구 코드" : "기존 복구 코드"}</label>
        <input id={id} value={code} readOnly={created} type={created ? "text" : "password"} autoComplete="off" spellCheck={false} onChange={event => setCode(event.target.value)} style={{ ...inputStyle(), fontSize: 16 }} />
        {!created && <button type="button" style={buttonStyle} aria-expanded={repair} onClick={() => { setRepair(value => !value); setKept(false); setAdditional("") }}>서로 다른 코드를 쓴 메모 복구</button>}
        {repair && <>
          <p>두 코드로 현재 메모와 휴지통의 메모를 확인한 뒤, 첫 번째 코드로 모아요. 내용을 확인하지 못하면 시작하지 않아요. 완료 전에는 두 코드 모두 보관해 주세요.</p>
          <label htmlFor={id + "-additional"}>다른 복구 코드</label>
          <input id={id + "-additional"} type="password" value={additional} autoComplete="off" spellCheck={false} onChange={event => setAdditional(event.target.value)} style={{ ...inputStyle(), fontSize: 16 }} />
        </>}
        {(created || repair) && <label style={{ display: "flex", gap: 8, alignItems: "center", minHeight: 44 }}><input type="checkbox" checked={kept} onChange={event => setKept(event.target.checked)} /> {repair ? "두 코드를 모두 보관했고 첫 번째 코드로 모을게요" : "복구 코드를 따로 보관했어요"}</label>}
        {created && <button type="button" style={buttonStyle} onClick={() => { setCreated(false); setKept(false); setCode(""); setNotice(null) }}>기존 코드 입력하기</button>}
        <button type="button" disabled={code.trim() === "" || ((created || repair) && !kept) || (repair && additional.trim() === "")} onClick={() => void prepare()} style={{ ...buttonStyle, background: "var(--ink)", color: "var(--bg)" }}>{busy ? "확인 중" : repair ? "확인하고 첫 번째 코드로 모으기" : "이 코드로 저장 준비"}</button>
      </fieldset>
      {notice && <p role="alert">{notice}</p>}
    </div>}
  </section>
}
