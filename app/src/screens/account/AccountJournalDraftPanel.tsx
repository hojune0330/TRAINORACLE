import React from "react"
import { Plus, RefreshCw, Save } from "lucide-react"
import { createAccountJournalDraftBuffer, type AccountJournalDraft, type AccountJournalDraftView } from "../../domain/account/account-journal-draft-buffer"
import { requestAccountJournal } from "../../domain/account/account-journal-api"
import { flushAccountJournalDraft } from "../../domain/account/account-journal-sync"
import { activeLocalAccount, onLocalJournalScopeChange } from "../../domain/account/local-journal-ownership"
import { koreaServiceDate } from "../../domain/account/service-date"
import { secondaryBtn } from "./styles"

const messages = {
  SAVED: "계정에 초안이 저장됐어요.",
  PENDING: "계정 저장을 확인하지 못했어요. 이 기기에 보관한 초안을 다시 전송해 주세요.",
  CONFLICT: "다른 기기의 수정과 겹쳤어요. 덮어쓰지 않고 이 기기의 내용도 보관했어요.",
  STALE: "계정이 바뀌어 저장을 중단했어요.",
}

export function AccountJournalDraftPanel({ userId }: { readonly userId: string }) {
  const [buffer] = React.useState(createAccountJournalDraftBuffer)
  const [consent, setConsent] = React.useState(false)
  const [items, setItems] = React.useState<AccountJournalDraftView[]>([])
  const [selected, setSelected] = React.useState<string | null>(null)
  const [draft, setDraft] = React.useState<AccountJournalDraft | null>(null)
  const [notice, setNotice] = React.useState("계정 초안은 기존 훈련 일지와 별도로 보관돼요.")
  const [busy, setBusy] = React.useState(false)
  const alive = React.useRef(true)
  const writes = React.useRef(Promise.resolve())
  const writeFailed = React.useRef(false)
  const pendingWrites = React.useRef(0)
  const editorSequence = React.useRef(0)
  const current = () => alive.current && activeLocalAccount() === userId
  const send = (request: Parameters<typeof requestAccountJournal>[1]) => requestAccountJournal(userId, request, current)

  React.useEffect(() => {
    alive.current = true
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (pendingWrites.current > 0 || writeFailed.current) { event.preventDefault(); event.returnValue = "" }
    }
    window.addEventListener("beforeunload", beforeUnload)
    const unsubscribe = onLocalJournalScopeChange(() => {
      if (activeLocalAccount() !== userId) {
        alive.current = false
        buffer.logout(userId)
        setDraft(null); setItems([]); setSelected(null); setConsent(false)
      }
    })
    return () => {
      alive.current = false
      unsubscribe()
      window.removeEventListener("beforeunload", beforeUnload)
      void writes.current.finally(() => { if (!alive.current) buffer.close() })
    }
  }, [buffer, userId])

  async function refresh() {
    if (!consent || !current()) return
    setBusy(true)
    try {
      await writes.current
      if (writeFailed.current) {
        if (current()) setNotice("아직 보관하지 못한 입력이 있어요. 현재 내용을 별도 초안으로 보관한 뒤 불러와 주세요.")
        return
      }
      const local = await buffer.list(userId)
      if (!current()) return
      setItems(local)
      for (const item of local) {
        if (item.state !== "DRAFT_ACKNOWLEDGED" && item.state !== "CONFLICT") {
          await flushAccountJournalDraft(buffer, userId, item.documentId, send, current)
        }
      }
      let cursor: string | undefined
      const seen = new Set<string>()
      do {
        const result = await send({ action: "list", ...(cursor ? { cursor } : {}) })
        if (!current()) return
        if (!result.ok || result.data.kind !== "list") throw new Error("Unavailable")
        for (const item of result.data.documents) {
          await buffer.importRemote(userId, item.documentId, item.document, item.revision)
        }
        cursor = result.data.nextCursor ?? undefined
        if (cursor && seen.has(cursor)) throw new Error("Repeated cursor")
        if (cursor) seen.add(cursor)
      } while (cursor)
      const loaded = await buffer.list(userId)
      if (current()) {
        setItems(loaded)
        const selectedItem = loaded.find(item => item.documentId === selected)
        if (selectedItem) { editorSequence.current = selectedItem.localSequence; setDraft(selectedItem.draft) }
        setNotice("계정 초안 목록을 불러왔어요. 열어서 내용을 확인하세요.")
      }
    } catch {
      if (current()) setNotice("계정 목록을 모두 불러오지 못했어요. 기존 초안은 지우지 않았어요. 다시 불러와 주세요.")
    } finally { if (current()) setBusy(false) }
  }

  function change(next: AccountJournalDraft, id = selected) {
    if (!id || !current()) return
    setDraft(next)
    setNotice("이 기기에 초안을 보관하고 있어요. 계정 저장은 아직 완료되지 않았어요.")
    pendingWrites.current += 1
    writes.current = writes.current.then(async () => {
      if (activeLocalAccount() !== userId) return
      await buffer.saveDraft(userId, id, next, editorSequence.current)
      editorSequence.current += 1
      writeFailed.current = false
      if (current()) setNotice("이 기기에 초안을 보관했어요. ‘계정에 저장’을 눌러 주세요.")
    }).catch(() => {
      writeFailed.current = true
      if (current()) setNotice("이 기기에 저장하지 못했거나 다른 창에서 수정됐어요. 화면을 닫지 말고 내용을 별도 초안으로 보관해 주세요.")
    }).finally(() => { pendingWrites.current -= 1 })
  }

  async function save() {
    if (!selected || !draft || !consent || busy) return
    setBusy(true)
    try {
      change(draft)
      await writes.current
      if (!current() || writeFailed.current) return
      const result = await flushAccountJournalDraft(buffer, userId, selected, send, current)
      const loaded = await buffer.list(userId)
      if (current()) { setNotice(messages[result]); setItems(loaded) }
    } catch { if (current()) setNotice("저장을 완료하지 못했어요. 작성 내용을 유지하고 다시 시도해 주세요.") }
    finally { if (current()) setBusy(false) }
  }

  async function open(id: string) {
    setBusy(true)
    try {
      await writes.current
      if (writeFailed.current) return
      const item = await buffer.read(userId, id)
      if (current() && item) {
        setSelected(id); setDraft(item.draft)
        editorSequence.current = item.localSequence
        setNotice(item.state === "CONFLICT" ? messages.CONFLICT : item.state === "DRAFT_ACKNOWLEDGED" ? messages.SAVED : messages.PENDING)
      }
    } catch { if (current()) setNotice("초안을 열지 못했어요. 현재 내용은 그대로 유지했어요.") }
    finally { if (current()) setBusy(false) }
  }

  async function create(copy = false) {
    await writes.current
    if (!current() || (writeFailed.current && !copy)) return
    const id = crypto.randomUUID()
    const next: AccountJournalDraft = copy && draft ? { ...draft } : {
      version: 1, state: "DRAFT", visibility: "PRIVATE", date: koreaServiceDate(), title: "", body: "",
    }
    setSelected(id)
    editorSequence.current = 0
    change(next, id)
  }

  return <section aria-label="계정 초안" style={{ borderTop: "1px solid var(--line)", paddingTop: 16 }}>
    <h2 style={{ fontSize: 18, margin: "0 0 8px" }}>계정 초안 · 시험 기능</h2>
    <p>암호화해 계정에 보관하고 다시 로그인해 열 수 있어요. 서비스는 복구를 위해 내용을 복호화할 수 있어요. 비밀 초안은 공유·분석에 사용하지 않아요.</p>
    <label style={{ display: "flex", gap: 8, alignItems: "center", minHeight: 44 }}>
      <input type="checkbox" checked={consent} disabled={busy} onChange={event => setConsent(event.target.checked)} />
      이 방식으로 초안을 계정에 보관할게요
    </label>
    {consent && <>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <button type="button" style={secondaryBtn} disabled={busy} onClick={() => void refresh()}><RefreshCw size={16} aria-hidden="true" /> 계정 초안 불러오기</button>
        <button type="button" style={secondaryBtn} disabled={busy} onClick={() => void create()}><Plus size={16} aria-hidden="true" /> 새 초안</button>
      </div>
      <ul>{items.map(item => <li key={item.documentId}><button type="button" disabled={busy} style={{ ...secondaryBtn, minHeight: 44, overflowWrap: "anywhere" }} onClick={() => void open(item.documentId)}>{item.draft.date} · {item.draft.title || "제목 없는 초안"}{item.state === "CONFLICT" ? " · 수정 충돌" : ""}</button></li>)}</ul>
      {draft && <div style={{ display: "grid", gap: 12 }}>
        <label>날짜<input style={{ display: "block", minHeight: 44, maxWidth: "100%" }} type="date" value={draft.date} disabled={busy} onChange={event => change({ ...draft, date: event.target.value })} /></label>
        <label>제목<input style={{ display: "block", minHeight: 44, width: "100%", boxSizing: "border-box" }} maxLength={200} value={draft.title} disabled={busy} onChange={event => change({ ...draft, title: event.target.value })} /></label>
        <label>내용<textarea aria-label="내용" style={{ display: "block", width: "100%", minHeight: 180, boxSizing: "border-box", font: "inherit" }} maxLength={100000} value={draft.body} disabled={busy} onChange={event => change({ ...draft, body: event.target.value })} /></label>
        <label>초안 종류<select style={{ display: "block", minHeight: 44 }} value={draft.visibility} disabled={busy} onChange={event => change({ ...draft, visibility: event.target.value === "PRIVATE" ? "PRIVATE" : "PERSONAL" })}><option value="PRIVATE">비밀 초안</option><option value="PERSONAL">일반 초안 (현재는 나만 열람)</option></select></label>
        <button type="button" style={secondaryBtn} disabled={busy} onClick={() => void save()}><Save size={16} aria-hidden="true" /> 계정에 저장</button>
        <button type="button" style={secondaryBtn} disabled={busy} onClick={() => void create(true)}>현재 내용을 별도 초안으로 보관</button>
      </div>}
    </>}
    <p role="status" aria-live="polite">{notice}</p>
  </section>
}
