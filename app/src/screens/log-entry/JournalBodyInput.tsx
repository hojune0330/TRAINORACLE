import React, { lazy, Suspense } from "react"
import { X } from "lucide-react"
import { BodyDiagram } from "./BodyDiagram"
import type { BodyPartMetadataV1 } from "../../domain/body-part-metadata"
import { recentCustomBodyParts } from "../../domain/body-history"
import { useCalendarSnapshot } from "../../hooks/useCalendarEntries"
import { useReaderDialog } from "../../hooks/useReaderDialog"
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
  return <>
    <BodyDiagram key={`${scope}:${focus.revision}`} selected={props.selected} onChange={props.onChange}
      metadata={props.metadata} onMetadataChange={props.onMetadataChange} recentCustomParts={recent}
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
  const [originalId, setOriginalId] = React.useState<string | null>(null)
  const pendingRecord = React.useRef<{ partId?: string } | null>(null)
  const close = useReaderDialog(dialog, () => {
    const pending = pendingRecord.current
    pendingRecord.current = null
    onClose()
    if (pending) onRecord(pending.partId)
  })
  const original = entries.find(entry => entry.id === originalId)
  return <dialog ref={dialog} className="body-record-dialog" aria-labelledby={heading}
    onCancel={event => { event.preventDefault(); close() }}>
    <header className="body-record-dialog__header">
      <h2 id={heading}>몸 기록</h2>
      <button type="button" aria-label="몸 기록 닫기" onClick={close}><X size={20} aria-hidden="true" /></button>
    </header>
    <div className="body-record-dialog__content">
      {readiness !== "READY" && <div role={readiness === "ERROR" ? "alert" : "status"}>
        <p>{readiness === "LOADING" ? "기록을 불러오고 있어요." : "최신 기록을 확인하지 못했어요."}</p>
        {onRetry && <button type="button" className="app-choice-control" onClick={onRetry}>다시 불러오기</button>}
      </div>}
      {(readiness === "READY" || entries.length > 0) && <Suspense fallback={<p role="status">몸 기록을 여는 중이에요.</p>}>
        <History entries={entries} scopeKey={scopeKey} showHeading={false} manageBrowserBack={false}
          onOpenEntry={id => setOriginalId(id)} onRecord={partId => { pendingRecord.current = partId === undefined ? {} : { partId }; close() }} />
      </Suspense>}
    </div>
    {original && <BodyOriginalDialog key={`${scopeKey}:${original.id}`} entry={original} entries={entries} onClose={() => setOriginalId(null)} />}
  </dialog>
}

function BodyOriginalDialog({ entry, entries, onClose }: {
  readonly entry: JournalEntry
  readonly entries: readonly JournalEntry[]
  readonly onClose: () => void
}) {
  const dialog = React.useRef<HTMLDialogElement>(null)
  const close = useReaderDialog(dialog, onClose)
  return <dialog ref={dialog} className="body-record-dialog" aria-label="몸 기록의 원본 일지"
    onCancel={event => { event.preventDefault(); close() }}>
    <div className="body-record-dialog__content">
      <Suspense fallback={<p role="status">일지를 여는 중이에요.</p>}>
        <Original date={entry.date} initialEntryId={entry.id} entries={entries} readOnly onBack={close} />
      </Suspense>
    </div>
  </dialog>
}
