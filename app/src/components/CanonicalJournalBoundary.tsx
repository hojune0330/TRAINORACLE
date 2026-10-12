import { useCallback, useEffect, useRef, useState, type ReactNode } from "react"
import { ShieldCheck } from "lucide-react"
import {
  acknowledgeCanonicalJournalStorage,
  canonicalJournalStorageStatus,
  initializeCanonicalJournalStorage,
  type CanonicalJournalStorageStatus,
} from "../domain/canonical-journal-storage"
import { LOCAL_JOURNALS_CHANGED } from "../domain/journal-change-events"
import { purgeExpiredTrash } from "../domain/journal-trash"
import { retryPermanentJournalOriginalCleanup } from "../domain/journal-original-retention"
import "./canonical-journal-boundary.css"

type State = CanonicalJournalStorageStatus | { status: "checking" }

/** Keep the mounted form intact while a cross-tab conflict blocks new writes. */
export function CanonicalJournalBoundary({ children }: { readonly children: ReactNode }) {
  const [state, setState] = useState<State>({ status: "checking" })
  const [opened, setOpened] = useState(false)
  const [busy, setBusy] = useState(false)
  const dialog = useRef<HTMLDialogElement>(null)
  const generation = useRef(0)
  const mounted = useRef(false)
  const purged = useRef(false)
  const cleaning = useRef(false)
  const stateRef = useRef(state)
  stateRef.current = state

  const accept = useCallback((next: CanonicalJournalStorageStatus) => {
    if (!mounted.current) return
    let confirmed = next
    if (next.status === "ready") {
      if (!purged.current) {
        purged.current = true
        cleaning.current = true
        let cleanupComplete = false
        try {
          purgeExpiredTrash()
          cleanupComplete = retryPermanentJournalOriginalCleanup(window.localStorage)
        } catch { /* Keep the failure visible and retry the same approved cleanup. */ }
        // A partial cleanup can leave a durable fence. Do not open past it.
        try { confirmed = canonicalJournalStorageStatus(window.localStorage) }
        catch { confirmed = { status: "unavailable", reason: "STORAGE_UNAVAILABLE" } }
        if (!cleanupComplete && confirmed.status === "ready") confirmed = { status: "unavailable", reason: "WRITE_UNCONFIRMED" }
        if (confirmed.status !== "ready") purged.current = false
        cleaning.current = false
      }
    }
    setState(previous => JSON.stringify(previous) === JSON.stringify(confirmed) ? previous : confirmed)
    if (confirmed.status === "ready") setOpened(true)
  }, [])

  const initialize = useCallback(async () => {
    const request = ++generation.current
    setBusy(true)
    try {
      const result = await initializeCanonicalJournalStorage(window.localStorage, window.sessionStorage)
      if (generation.current === request) accept(result)
    } catch {
      if (generation.current === request) accept({ status: "unavailable", reason: "STORAGE_UNAVAILABLE" })
    } finally {
      if (mounted.current && generation.current === request) setBusy(false)
    }
  }, [accept])

  useEffect(() => {
    mounted.current = true
    void initialize()
    const recheck = () => {
      // Never interrupt an unfinished migration with a transient partial snapshot.
      if (stateRef.current.status === "checking" || cleaning.current) return
      try { accept(canonicalJournalStorageStatus(window.localStorage)) }
      catch { accept({ status: "unavailable", reason: "STORAGE_UNAVAILABLE" }) }
    }
    window.addEventListener("storage", recheck)
    window.addEventListener("focus", recheck)
    window.addEventListener("pageshow", recheck)
    window.addEventListener(LOCAL_JOURNALS_CHANGED, recheck)
    return () => {
      mounted.current = false
      generation.current++
      window.removeEventListener("storage", recheck)
      window.removeEventListener("focus", recheck)
      window.removeEventListener("pageshow", recheck)
      window.removeEventListener(LOCAL_JOURNALS_CHANGED, recheck)
    }
  }, [accept, initialize])

  const blocked = state.status !== "ready"
  useEffect(() => {
    if (!opened || !blocked) return
    const element = dialog.current
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    if (element && !element.open) element.showModal()
    return () => {
      if (element?.open) element.close()
      if (opener?.isConnected) opener.focus({ preventScroll: true })
    }
  }, [opened, blocked])

  const keepCurrent = async () => {
    if (busy || state.status !== "conflict" || !state.conflictToken) return
    const token = state.conflictToken
    const request = ++generation.current
    setBusy(true)
    try {
      const acknowledged = await acknowledgeCanonicalJournalStorage(window.localStorage, token)
      // A first migration can stop at a conflict before tab-only credentials
      // were copied. Complete that same verified step before opening the app.
      const result = acknowledged.status === "ready"
        ? await initializeCanonicalJournalStorage(window.localStorage, window.sessionStorage)
        : acknowledged
      if (request === generation.current) accept(result)
    } catch {
      if (request === generation.current) accept({ status: "unavailable", reason: "STORAGE_UNAVAILABLE" })
    } finally {
      if (mounted.current && request === generation.current) setBusy(false)
    }
  }

  const conflict = state.status === "conflict"
  const checking = state.status === "checking"
  const content = <section className="canonical-journal-boundary" aria-busy={busy}>
    <ShieldCheck size={32} aria-hidden="true" />
    <h1 id="journal-storage-title">{checking ? "기록을 안전하게 옮기고 있어요" : conflict ? "이전 앱에서 기록이 바뀌었어요" : "기록을 확인하지 못했어요"}</h1>
    <p id="journal-storage-description">{checking
      ? "기존 기록을 보존한 뒤 열어드릴게요."
      : conflict
        ? "현재 기록은 그대로예요. 이전 앱의 변경분은 따로 보관하고, 자동으로 합치지 않아요."
        : "안전을 위해 새 기록 저장을 멈췄어요. 다시 확인해 주세요."}</p>
    {!checking && <div className="canonical-journal-boundary__actions">
      {conflict && <button type="button" className="canonical-journal-boundary__primary" disabled={busy} onClick={() => void keepCurrent()}>현재 기록으로 계속</button>}
      <button type="button" className={conflict ? "canonical-journal-boundary__secondary" : "canonical-journal-boundary__primary"} disabled={busy} onClick={() => void initialize()}>다시 확인</button>
    </div>}
    {!checking && <details>
      <summary>자세히 보기</summary>
      {conflict
        ? <p>이전 앱을 닫고 최신 앱을 사용해 주세요. 계속을 눌러도 이전 기록을 현재 기록에 덮어쓰거나 지우지 않아요. 작성 중이던 내용은 이 화면 뒤에 그대로 있어요.</p>
        : <p>최신 브라우저에서 다시 열고, 기기 저장 공간을 확인해 주세요. 해결되지 않으면 앱 데이터나 브라우저 기록을 지우지 말고 문의해 주세요.</p>}
    </details>}
  </section>

  return <>
    {opened && children}
    {!opened && <main aria-labelledby="journal-storage-title">{content}</main>}
    {opened && blocked && <dialog ref={dialog} className="canonical-journal-dialog" aria-labelledby="journal-storage-title" aria-describedby="journal-storage-description" onCancel={event => event.preventDefault()}>{content}</dialog>}
  </>
}
