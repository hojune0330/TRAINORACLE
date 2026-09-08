import React from "react"
import { RefreshCw } from "lucide-react"
import { activeLocalAccount } from "../domain/account/local-journal-ownership"
import { listAccountJournalConflicts, reviewAccountJournalConflict, resolveAccountJournalConflict,
  listAccountJournalRecoveryRecords, readAccountJournalConflictArchive,
  type AccountJournalConflictReview } from "../domain/account/account-journal-record-service"
import type { AccountJournalRecord } from "../domain/account/account-journal-record-schema"
import type { ConflictChoice } from "../domain/account/account-journal-draft-buffer"

const buttonStyle: React.CSSProperties = { minHeight: 44, padding: "8px 12px", whiteSpace: "normal" }

function Version({ label, record }: { label: string; record: AccountJournalRecord | null }) {
  const entry = record?.entry
  return <section aria-label={label} style={{ minWidth: 0, borderTop: "1px solid var(--line)", padding: "12px 0" }}>
    <h4 style={{ fontSize: "var(--fs-body)", margin: "0 0 8px" }}>{label}</h4>
    {!entry ? <p>서버에서 삭제된 일지</p> : <>
      <p>{entry.date} · {{ "post-session": "훈련 일지", morning: "아침 점검", evening: "저녁 점검", race: "대회 기록" }[entry.kind]} · {entry.memoPurpose === "PRIVATE_SELF_ONLY" ? "비밀 글" : "일반 글"}</p>
      <p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{entry.kind === "evening" ? entry.note : entry.memo}</p>
      <details><summary style={{ minHeight: 44 }}>기록 전체 내용</summary>
        <pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", fontFamily: "inherit", fontSize: "var(--fs-caption)" }}>{JSON.stringify(entry, null, 2)}</pre>
      </details>
    </>}
  </section>
}

export function AccountJournalConflictResolver() {
  const owner = React.useSyncExternalStore(callback => {
    window.addEventListener("trainoracle:journal-scope-changed", callback)
    return () => window.removeEventListener("trainoracle:journal-scope-changed", callback)
  }, activeLocalAccount, () => null)
  return owner ? <Resolver key={owner} owner={owner} /> : null
}

function Resolver({ owner }: { owner: string }) {
  const [items, setItems] = React.useState<Awaited<ReturnType<typeof listAccountJournalConflicts>>>([])
  const [review, setReview] = React.useState<AccountJournalConflictReview | null>(null)
  const [archives, setArchives] = React.useState<Awaited<ReturnType<typeof listAccountJournalRecoveryRecords>>>([])
  const [recovery, setRecovery] = React.useState<Awaited<ReturnType<typeof readAccountJournalConflictArchive>>>(null)
  const [choice, setChoice] = React.useState<ConflictChoice | null>(null)
  const [busy, setBusy] = React.useState(false)
  const [message, setMessage] = React.useState("")
  const alive = React.useRef(true)
  const pending = React.useRef(false)
  const current = () => alive.current && activeLocalAccount() === owner
  React.useEffect(() => {
    alive.current = true
    const refresh = () => {
      void listAccountJournalConflicts().then(value => { if (current()) setItems(value.filter(item => item.ownerId === owner)) })
        .catch(() => { if (current()) setMessage("충돌 목록을 불러오지 못했어요.") })
      void listAccountJournalRecoveryRecords().then(value => { if (current()) setArchives(value.filter(item => item.ownerId === owner)) })
        .catch(() => { if (current()) setMessage("보존본 목록을 불러오지 못했어요.") })
    }
    refresh()
    window.addEventListener("trainoracle:account-journals-changed", refresh)
    return () => { alive.current = false; window.removeEventListener("trainoracle:account-journals-changed", refresh) }
  }, [owner])

  async function recover(documentId: string) {
    if (pending.current) return
    pending.current = true; setBusy(true); setRecovery(null)
    try {
      const value = await readAccountJournalConflictArchive(owner, documentId)
      if (!current()) return
      setRecovery(value)
      if (!value) setMessage("보존본을 읽지 못했어요. 원본은 삭제하지 않았어요.")
    } catch { if (current()) setMessage("보존본을 읽지 못했어요.") }
    finally { pending.current = false; if (current()) setBusy(false) }
  }

  async function open(documentId: string) {
    if (pending.current) return
    pending.current = true; setBusy(true); setReview(null); setChoice(null); setMessage("")
    try {
      const value = await reviewAccountJournalConflict(documentId)
      if (!current()) return
      setReview(value)
      if (!value) setMessage("최신 내용을 확인하지 못했어요. 연결과 로그인을 확인한 뒤 다시 시도해 주세요.")
    } catch { if (current()) setMessage("충돌 내용을 불러오지 못했어요. 두 내용은 보존되어 있어요.") }
    finally { pending.current = false; if (current()) setBusy(false) }
  }

  async function resolve() {
    if (!review || !choice || pending.current) return
    pending.current = true; setBusy(true); setMessage("")
    try {
      const result = await resolveAccountJournalConflict(review, choice)
      if (!current()) return
      if (result === "ACCOUNT" || result === "PENDING") {
        setReview(null); setChoice(null)
        setMessage(result === "ACCOUNT" ? "선택을 반영했어요. 두 수정본은 이 기기에 암호화해 보존했어요."
          : "선택한 내용은 기기에 보관했어요. 계정 저장은 연결 대기 중이에요.")
        const next = await listAccountJournalConflicts()
        if (current()) setItems(next)
      } else {
        setChoice(null); setReview(null)
        setMessage(result === "REVIEW_REQUIRED" ? "내용이 바뀌었어요. 두 버전을 다시 불러와 확인해 주세요." : "선택을 반영하지 못했어요. 최신 내용을 다시 확인해 주세요.")
      }
    } catch { if (current()) setMessage("선택을 확인하지 못했어요. 최신 내용을 다시 확인해 주세요.") }
    finally { pending.current = false; if (current()) setBusy(false) }
  }

  return <div style={{ color: "var(--ink)", fontSize: "var(--fs-body)", overflowWrap: "anywhere" }} aria-busy={busy}>
    {items.map(item => <button key={item.documentId} type="button" style={buttonStyle} disabled={busy}
      onClick={() => void open(item.documentId)}>{item.date} 충돌 확인</button>)}
    {archives.map(item => <button key={item.documentId} type="button" style={buttonStyle} disabled={busy}
      onClick={() => void recover(item.documentId)}>{item.date} 보존본 {item.count}건 보기</button>)}
    {(busy || message) && <p role="status">{busy ? "최신 내용을 확인하고 있어요." : message}</p>}
    {review && <div>
      <p>서버 수정본 {review.remoteRevision} · 기기 수정본 {review.localSequence}</p>
      <Version label="이 기기 내용" record={review.local} />
      <Version label="계정의 최신 내용" record={review.remote} />
      <fieldset disabled={busy} style={{ border: 0, padding: 0, margin: 0 }}>
        <legend>반영할 내용</legend>
        {review.remote ? <>
          <label style={{ display: "block", minHeight: 44 }}><input type="radio" name="conflict-choice" checked={choice === "LOCAL"} onChange={() => setChoice("LOCAL")} /> 이 기기 내용 사용</label>
          <label style={{ display: "block", minHeight: 44 }}><input type="radio" name="conflict-choice" checked={choice === "REMOTE"} onChange={() => setChoice("REMOTE")} /> 계정의 최신 내용 사용</label>
        </> : <>
          <p>이 기기 내용은 보존됩니다. 삭제된 일지는 자동으로 복원하지 않습니다.</p>
          <label style={{ display: "block", minHeight: 44 }}><input type="radio" name="conflict-choice" checked={choice === "DELETE"} onChange={() => setChoice("DELETE")} /> 서버 삭제 반영</label>
        </>}
        <button type="button" style={buttonStyle} disabled={!choice} onClick={() => void resolve()}>선택한 내용 반영</button>
        <button type="button" style={buttonStyle} aria-label="최신 충돌 내용 다시 불러오기" title="최신 충돌 내용 다시 불러오기" onClick={() => void open(review.documentId)}><RefreshCw size={16} /></button>
      </fieldset>
    </div>}
    {recovery && <section aria-label="충돌 보존본">
      <h3 style={{ fontSize: "var(--fs-body)" }}>충돌 보존본</h3>
      {recovery.map((version, index) => <details key={index}>
        <summary style={{ minHeight: 44 }}>기기 {version.localSequence} · 서버 {version.remoteRevision} · {version.createdAt ? new Date(version.createdAt).toLocaleString("ko-KR") : "보관 시각 미확인"}</summary>
        <p>기기 기준 서버 수정본: {version.localServerRevision ?? "미확인"}</p>
        <Version label="보존된 기기 내용" record={version.local} />
        <Version label="보존된 계정 내용" record={version.remote} />
        {version.pending && <Version label="전송 당시 내용" record={version.pending.draft} />}
      </details>)}
      <button type="button" style={buttonStyle} onClick={() => setRecovery(null)}>보존본 닫기</button>
    </section>}
  </div>
}
