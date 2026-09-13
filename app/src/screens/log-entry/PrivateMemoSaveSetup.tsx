import React from "react"
import { KeyRound } from "lucide-react"
import { createRecoveryCode, decryptPrivateNote, isValidRecoveryCode } from "../../domain/account/private-note-crypto"
import { loadSessionRecoveryCode, saveSessionRecoveryCode } from "../../domain/account/private-note-sync"
import { activeLocalAccount, LOCAL_JOURNAL_OWNERSHIP_KEY } from "../../domain/account/local-journal-ownership"
import { journalStorage } from "../../domain/journal-local-storage"
import { loadEntries, loadJournalEntriesSnapshot } from "../../domain/journal-store"
import { loadPrivateMemoVault } from "../../domain/private-memo-vault"
import { readVaultJournalStorageSnapshot } from "../../domain/private-memo-vault-storage"
import { inputStyle } from "./input-style"

// This only prepares the existing local encryption path; it never saves the form.
export function PrivateMemoSaveSetup({ onReady }: { readonly onReady: () => void }) {
  const [code, setCode] = React.useState("")
  const [created, setCreated] = React.useState(false)
  const [kept, setKept] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  const [notice, setNotice] = React.useState<string | null>(null)
  const [ready, setReady] = React.useState(() => loadSessionRecoveryCode() !== null)
  const id = React.useId()
  const mounted = React.useRef(true)
  React.useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])

  const records = () => {
    const storage = journalStorage()
    const snapshot = storage === null ? null : readVaultJournalStorageSnapshot(storage)
    const ownership = storage?.getItem(LOCAL_JOURNAL_OWNERSHIP_KEY)
    const vault = storage === null ? null : loadPrivateMemoVault(storage)
    const journal = loadJournalEntriesSnapshot()
    if (storage === null || snapshot === null || vault === null || journal.readStatus !== "complete"
      || journal.raw !== snapshot.journal) throw new Error("storage-unavailable")
    const visible = new Set(loadEntries().map(entry => entry.id))
    // Unknown/hidden/orphan ciphertext is not an empty vault or eligible for verification.
    if (Object.keys(vault.records).some(id => !visible.has(id))) throw new Error("vault-scope-unresolved")
    const current = readVaultJournalStorageSnapshot(storage)
    if (!current || current.vault !== snapshot.vault || current.journal !== snapshot.journal
      || storage.getItem(LOCAL_JOURNAL_OWNERSHIP_KEY) !== ownership) throw new Error("storage-changed")
    return { storage, snapshot, ownership, encrypted: Object.values(vault.records) }
  }
  const create = () => {
    try {
      if (records().encrypted.length > 0) {
        setNotice("이미 암호화된 메모가 있어요. 보관한 기존 복구 코드를 입력해 주세요. 새 코드로 기존 메모를 열 수는 없어요.")
        return
      }
      setCode(createRecoveryCode()); setCreated(true); setKept(false); setNotice(null)
    } catch {
      setNotice("이 브라우저에서 암호화 준비를 완료하지 못했어요. 입력한 메모는 그대로 남아 있어요.")
    }
  }
  const prepare = async () => {
    if (busy || (created && !kept)) return
    const normalized = code.trim().toUpperCase()
    if (!isValidRecoveryCode(normalized)) { setNotice("복구 코드 전체를 확인해 주세요."); return }
    const owner = activeLocalAccount()
    const previousCode = loadSessionRecoveryCode()
    setBusy(true); setNotice(null)
    try {
      // A valid-looking but wrong code must not replace the key for existing notes.
      const checked = records()
      const verifyCurrent = () => {
        const current = readVaultJournalStorageSnapshot(checked.storage)
        if (!mounted.current || activeLocalAccount() !== owner || !current
          || current.vault !== checked.snapshot.vault || current.journal !== checked.snapshot.journal
          || checked.storage.getItem(LOCAL_JOURNAL_OWNERSHIP_KEY) !== checked.ownership
          || loadSessionRecoveryCode() !== previousCode) throw new Error("storage-changed")
      }
      for (const record of checked.encrypted) {
        verifyCurrent()
        await decryptPrivateNote(record.encrypted, normalized)
        verifyCurrent()
      }
      verifyCurrent()
      if (!saveSessionRecoveryCode(normalized)) throw new Error("session-unavailable")
      setReady(true); setCode(""); onReady()
    } catch {
      if (mounted.current) setNotice("복구 코드가 기존 메모와 맞지 않거나 브라우저에서 준비를 완료하지 못했어요. 코드를 확인해 주세요. 기존 기록과 입력 내용은 바꾸지 않았어요.")
    } finally {
      if (mounted.current) setBusy(false)
    }
  }

  if (ready) return <p role="status">암호화 준비가 됐어요. 아래 저장 버튼을 눌러 메모와 기록을 저장해 주세요.</p>
  return <section aria-label="나만의 메모 저장 준비" style={{ marginBlock: 12, padding: 12, border: "1px solid var(--line)", fontSize: 13, lineHeight: 1.6 }}>
    <strong>나만의 메모 저장 준비</strong>
    <p>로그인 없이 쓰는 나만의 메모는 복구 코드로 암호화해 이 기기에 저장해요. 이 화면에서 준비할 수 있어요. 작성한 내용은 아직 저장 전이에요.</p>
    <p>처음이라면 코드를 만들고 안전한 곳에 보관해 주세요. 나중에 메모를 다시 열 때 필요하며, 잃어버리면 운영자도 복구할 수 없어요.</p>
    <fieldset disabled={busy} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
      <button type="button" onClick={create} style={{ minHeight: 44 }}><KeyRound size={16} aria-hidden="true" /> 처음 사용해요 · 코드 만들기</button>
      <label htmlFor={id} style={{ display: "block", marginTop: 8 }}>{created ? "보관할 복구 코드" : "기존 복구 코드"}</label>
      <input id={id} value={code} readOnly={created} type={created ? "text" : "password"} autoComplete="off" spellCheck={false}
        onChange={event => setCode(event.target.value)} style={{ ...inputStyle(), fontSize: 16 }} />
      {created && <>
        <label style={{ display: "flex", gap: 8, alignItems: "center", minHeight: 44 }}>
          <input type="checkbox" checked={kept} onChange={event => setKept(event.target.checked)} /> 복구 코드를 따로 보관했어요
        </label>
        <button type="button" style={{ minHeight: 44 }} onClick={() => { setCreated(false); setKept(false); setCode(""); setNotice(null) }}>기존 코드 입력하기</button>
      </>}
      <button type="button" disabled={code.trim() === "" || (created && !kept)} onClick={() => void prepare()} style={{ minHeight: 44 }}>
        {busy ? "확인 중" : "이 코드로 저장 준비"}
      </button>
    </fieldset>
    {notice && <p role="alert">{notice}</p>}
  </section>
}
