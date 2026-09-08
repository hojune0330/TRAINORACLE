import React from "react"
import { History, RotateCcw } from "lucide-react"
import { accountJournalDeletedDocuments, accountJournalRecordHistory, accountJournalRecordsEnabled,
  readAccountJournalRecordVersion, restoreAccountJournalVersion } from "../../domain/account/account-journal-record-service"
import { readAccountJournalPrivateEntry } from "../../domain/account/account-journal-projection"
import { activeLocalAccount, onLocalJournalScopeChange } from "../../domain/account/local-journal-ownership"
import { secondaryBtn } from "./styles"

type HistoryResult = NonNullable<Awaited<ReturnType<typeof accountJournalRecordHistory>>>
export function AccountJournalHistory({ entryId }: { readonly entryId?: string }) {
  const [rows, setRows] = React.useState<{ history: HistoryResult; currentRevision: number }[]>([])
  const [opened, setOpened] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  const [message, setMessage] = React.useState("")
  const requestEpoch = React.useRef(0)
  React.useEffect(() => onLocalJournalScopeChange(() => {
    requestEpoch.current += 1
    setRows([]); setOpened(false); setBusy(false); setMessage("")
  }), [])
  if (!accountJournalRecordsEnabled() || entryId && !readAccountJournalPrivateEntry(entryId)) return null
  const load = async () => {
    const epoch = ++requestEpoch.current
    const owner = activeLocalAccount()
    setBusy(true)
    try {
      const current = entryId ? await readAccountJournalRecordVersion(entryId) : null
      const targets = entryId ? current ? [current] : [] : accountJournalDeletedDocuments()
      if (entryId && !current) throw new Error("Unavailable")
      const next: typeof rows = []
      for (const target of targets) {
        const history = await accountJournalRecordHistory(target.documentId)
        if (!history) throw new Error("Unavailable")
        if (history.versions.length) next.push({ history, currentRevision: target.revision })
      }
      if (owner !== activeLocalAccount() || epoch !== requestEpoch.current) return
      setRows(next); setOpened(true); setMessage(next.length ? "이전 내용을 확인한 뒤 되돌릴 수 있어요." : "30일 안에 되돌릴 수 있는 내용이 없어요.")
    } catch { if (owner === activeLocalAccount() && epoch === requestEpoch.current) setMessage("이전 내용을 불러오지 못했어요. 다시 시도해 주세요.") }
    finally { if (owner === activeLocalAccount() && epoch === requestEpoch.current) setBusy(false) }
  }
  const restore = async (documentId: string, sourceRevision: number, expectedRevision: number) => {
    const epoch = ++requestEpoch.current
    const owner = activeLocalAccount()
    setBusy(true)
    const ok = await restoreAccountJournalVersion(documentId, sourceRevision, expectedRevision)
    if (owner !== activeLocalAccount() || epoch !== requestEpoch.current) return
    setMessage(ok ? "계정의 일지를 이전 내용으로 되돌렸어요. 수정 이력은 유지돼요." : "되돌리지 못했어요. 다른 기기에서 수정됐거나 보관 기간이 지났을 수 있어요. 다시 불러와 주세요.")
    setBusy(false)
    if (ok) setRows([])
  }
  return <section style={{ borderTop: "1px solid var(--line)", padding: "8px 0" }}>
    <button type="button" style={secondaryBtn} disabled={busy} onClick={() => void load()}><History size={16} aria-hidden="true" />{entryId ? "수정 이력 · 30일" : "계정 휴지통 · 30일"}</button>
    {opened && rows.map(row => <div key={row.history.documentId}>{row.history.versions.map(version => {
      const entry = version.document.entry
      const text = entry.kind === "evening" ? entry.note : entry.memo
      return <details key={version.revision}>
        <summary style={{ minHeight: 44, padding: 8 }}>{entry.date} · {entry.kind === "evening" ? "하루 마무리" : entry.kind === "race" ? "경기 일지" : entry.title || "훈련 일지"} · 수정본 {version.revision}</summary>
        {entry.kind === "post-session" && <p>
          거리 {entry.distanceKm ? `${entry.distanceKm}km` : "미기록"} · 시간 {entry.durationMin ? `${entry.durationMin}분` : "미기록"} · RPE {entry.rpe > 0 ? entry.rpe : "미기록"}
        </p>}
        {entry.kind === "race" && <p>경기 기록: {entry.record || "미기록"}</p>}
        <p>{entry.memoPurpose === "PRIVATE_SELF_ONLY" ? "나만의 메모 · 공유와 분석에서 제외" : "훈련 메모"}</p>
        <p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{text || "메모 없음"}</p>
        <p>되돌리면 메모뿐 아니라 이 수정본의 일지 항목 전체가 적용돼요.</p>
        <p>보관 기한: {new Date(version.expiresAt).toLocaleString("ko-KR")}</p>
        <button type="button" style={secondaryBtn} disabled={busy} onClick={() => void restore(row.history.documentId, version.revision, row.currentRevision)}><RotateCcw size={16} aria-hidden="true" />이 내용으로 되돌리기</button>
      </details>
    })}</div>)}
    {message && <p role="status">{message}</p>}
  </section>
}
