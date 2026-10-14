import React, { lazy, Suspense } from "react"
import { X } from "lucide-react"
import { BodyDiagram } from "./BodyDiagram"
import type { BodyPartMetadataV1 } from "../../domain/body-part-metadata"
import { projectBodyHistory, recentCustomBodyParts } from "../../domain/body-history"
import { useCalendarSnapshot } from "../../hooks/useCalendarEntries"
import { useReaderDialog } from "../../hooks/useReaderDialog"
import { useTaskFlowBack } from "../../hooks/useTaskFlowBack"
import { hasPendingBrowserBackLayer } from "../../navigation/browserNavigation"
import { activeLocalAccount, localJournalScopeGeneration } from "../../domain/account/local-journal-ownership"
import { filterOwnerBodyEntries } from "../../domain/account/body-record-scope"
import type { JournalEntry } from "../../domain/journal-schema"
import "./JournalBodyInput.css"

const History = lazy(() => import("../BodyHistory").then(module => ({ default: module.BodyHistory })))
const Original = lazy(() => import("../LogDetail").then(module => ({ default: module.LogDetail })))

export type JournalBodyInputProps = {
  readonly selected: Readonly<Record<string, number>>
  readonly onChange: (next: Record<string, number>) => void
  readonly metadata?: BodyPartMetadataV1 | undefined
  readonly onMetadataChange: (next: BodyPartMetadataV1 | undefined) => void
  readonly initialPartId?: string | undefined
}

/** History is a read-only layer: the underlying form and its unsaved answers stay mounted. */
export function JournalBodyInput(props: JournalBodyInputProps) {
  const snapshot = useCalendarSnapshot()
  const scope = `${activeLocalAccount() ?? "device"}:${localJournalScopeGeneration()}`
  const entries = React.useMemo(() => snapshot.owner === activeLocalAccount() ? filterOwnerBodyEntries(snapshot.entries) : [], [snapshot.entries, snapshot.owner, scope])
  const [historyScope, setHistoryScope] = React.useState<string | null>(null)
  const [focus, setFocus] = React.useState({ id: props.initialPartId, revision: 0 })
  const recent = React.useMemo(() => recentCustomBodyParts(entries), [entries])
  const recentKnownPartIds = React.useMemo(() => projectBodyHistory(entries).parts
    .filter(part => part.kind === "FIXED")
    .sort((left, right) => right.lastRecordedDate.localeCompare(left.lastRecordedDate)
      || (right.records[0]?.savedAt ?? "").localeCompare(left.records[0]?.savedAt ?? ""))
    .slice(0, 3).map(part => part.id), [entries])
  return <>
    <BodyDiagram key={`${scope}:${focus.revision}`} selected={props.selected} onChange={props.onChange}
      metadata={props.metadata} onMetadataChange={props.onMetadataChange} recentCustomParts={recent} recentKnownPartIds={recentKnownPartIds}
      initialPartId={focus.id} onRequestHistory={() => setHistoryScope(scope)} />
    {historyScope === scope && <BodyHistoryDialog key={scope} entries={entries} scopeKey={scope}
      readiness={snapshot.status} onRetry={snapshot.retry} onClose={() => setHistoryScope(null)}
      onRecord={(partId) => {
        setHistoryScope(null)
        setFocus(current => ({ id: partId, revision: current.revision + 1 }))
      }} />}
  </>
}

function BodyHistoryDialog({ entries, scopeKey, readiness, onRetry, onClose, onRecord }: {
  readonly entries: readonly JournalEntry[]
  readonly scopeKey: string
  readonly readiness: string
  readonly onRetry?: (() => void) | undefined
  readonly onClose: () => void
  readonly onRecord: (partId?: string) => void
}) {
  const dialog = React.useRef<HTMLDialogElement>(null)
  const heading = React.useId()
  const [selectedPartId, setSelectedPartId] = React.useState<string | null>(null)
  const [originalId, setOriginalId] = React.useState<string | null>(null)
  const [closeRequested, setCloseRequested] = React.useState(false)
  const originalContent = React.useRef<HTMLDivElement>(null)
  const originalOpener = React.useRef<HTMLElement | null>(null)
  const historyScrollTop = React.useRef(0)
  const returnToSource = React.useRef(false)
  const pendingRecord = React.useRef<{ partId?: string } | null>(null)
  const close = useReaderDialog(dialog, () => {
    const pending = pendingRecord.current
    pendingRecord.current = null
    onClose()
    if (pending) onRecord(pending.partId)
  })
  const original = entries.find(entry => entry.id === originalId)
  const backToHistory = React.useCallback(() => {
    returnToSource.current = true
    setOriginalId(null)
  }, [])
  const back = () => {
    if (originalId !== null) backToHistory()
    else if (selectedPartId !== null) setSelectedPartId(null)
    else close()
  }
  useTaskFlowBack({
    enabled: !closeRequested && (originalId !== null || selectedPartId !== null),
    onBack: back,
  })
  const requestClose = () => setCloseRequested(true)
  // Dispose the inner Back sentinel before closing the native reader. Its
  // asynchronous POP must never consume the underlying unfinished form.
  React.useEffect(() => {
    if (!closeRequested) return
    let active = true
    const finish = () => {
      if (active && !hasPendingBrowserBackLayer()) close()
    }
    window.addEventListener("popstate", finish)
    queueMicrotask(finish)
    return () => { active = false; window.removeEventListener("popstate", finish) }
  }, [closeRequested, close])
  React.useLayoutEffect(() => {
    if (originalId !== null) {
      originalContent.current?.focus({ preventScroll: true })
      if (dialog.current) dialog.current.scrollTop = 0
    } else if (returnToSource.current) {
      if (dialog.current) dialog.current.scrollTop = historyScrollTop.current
      originalOpener.current?.focus({ preventScroll: true })
      returnToSource.current = false
    }
  }, [originalId])
  return <dialog ref={dialog} className="body-record-dialog" aria-labelledby={heading}
    onCancel={event => { event.preventDefault(); back() }}>
    <header className="body-record-dialog__header">
      <h2 id={heading}>몸 기록</h2>
      <button type="button" aria-label="몸 기록 닫기" onClick={requestClose}><X size={20} aria-hidden="true" /></button>
    </header>
    <div className="body-record-dialog__content">
      {readiness !== "READY" && <div role={readiness === "ERROR" ? "alert" : "status"}>
        <p>{readiness === "LOADING" ? "기록을 불러오고 있어요." : "최신 기록을 확인하지 못했어요."}</p>
        {onRetry && <button type="button" className="app-choice-control" onClick={onRetry}>다시 불러오기</button>}
      </div>}
      <div hidden={originalId !== null}>
        {(readiness === "READY" || entries.length > 0) && <Suspense fallback={<p role="status">몸 기록을 여는 중이에요.</p>}>
          <History entries={entries} scopeKey={scopeKey} showHeading={false} manageBrowserBack={false}
            recordActionLabel="이 일지에 상태 남기기"
            selectedPartId={selectedPartId} onSelectedPartChange={setSelectedPartId}
            onOpenEntry={id => {
              originalOpener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
              historyScrollTop.current = dialog.current?.scrollTop ?? 0
              setOriginalId(id)
            }} onRecord={partId => { pendingRecord.current = partId === undefined ? {} : { partId }; requestClose() }} />
        </Suspense>}
      </div>
      {originalId !== null && <div ref={originalContent} tabIndex={-1} aria-label="몸 기록의 원본 일지">
        {original ? <Suspense fallback={<p role="status">일지를 여는 중이에요.</p>}>
          <Original key={`${scopeKey}:${original.id}`} date={original.date} initialEntryId={original.id}
            entries={entries} readOnly onBack={backToHistory} />
        </Suspense> : <>
          <p role="status">이 일지를 확인할 수 없어요.</p>
          <button type="button" className="app-choice-control" onClick={backToHistory}>몸 기록으로 돌아가기</button>
        </>}
      </div>}
    </div>
  </dialog>
}
