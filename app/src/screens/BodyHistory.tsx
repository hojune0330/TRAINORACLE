import React from "react"
import { ArrowLeft, ChevronRight } from "lucide-react"
import { AppHeading } from "../components/AppHeading"
import type { JournalEntry } from "../domain/journal-schema"
import { projectBodyHistory, type BodyHistoryPart } from "../domain/body-history"
import { useTaskFlowBack } from "../hooks/useTaskFlowBack"
import "./body-history.css"

export type BodyHistoryProps = {
  readonly entries: readonly JournalEntry[]
  readonly scopeKey: string
  readonly onOpenEntry: (entryId: string, date: string) => void
  readonly onRecord: (partId?: string) => void
  readonly showHeading?: boolean
  readonly selectedPartId?: string | null
  readonly onSelectedPartChange?: (partId: string | null) => void
  readonly manageBrowserBack?: boolean
}

type SelectionState = {
  readonly scopeKey: string
  readonly partId: string | null
}

type ScopeSelectionGuard = {
  readonly scopeKey: string
  readonly staleControlledPartId: string | null
}

function dateLabel(date: string): string {
  return date.replaceAll("-", ".")
}

function timeLabel(savedAt: string): string | null {
  const time = Date.parse(savedAt)
  if (!Number.isFinite(time)) return null
  return new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" }).format(time)
}

function sourceLabel(source: "post-session" | "evening"): string {
  return source === "post-session" ? "훈련 일지" : "컨디션·메모"
}

export function BodyHistory({
  entries,
  scopeKey,
  onOpenEntry,
  onRecord,
  showHeading = true,
  selectedPartId,
  onSelectedPartChange,
  manageBrowserBack = true,
}: BodyHistoryProps) {
  const headingId = React.useId()
  const [localSelection, setLocalSelection] = React.useState<SelectionState>({ scopeKey, partId: null })
  const [selectionGuard, setSelectionGuard] = React.useState<ScopeSelectionGuard>({
    scopeKey,
    staleControlledPartId: null,
  })
  const partButtons = React.useRef(new Map<string, HTMLButtonElement>())
  const focusReturnPartId = React.useRef<string | null>(null)
  const detailHeading = React.useRef<HTMLHeadingElement>(null)
  const isControlled = selectedPartId !== undefined
  const scopeChanged = selectionGuard.scopeKey !== scopeKey
  const staleControlledSelection = isControlled
    && selectionGuard.staleControlledPartId !== null
    && selectionGuard.staleControlledPartId === selectedPartId
  const activePartId = scopeChanged || staleControlledSelection
    ? null
    : isControlled ? selectedPartId ?? null
      : localSelection.scopeKey === scopeKey ? localSelection.partId : null
  const history = React.useMemo(() => projectBodyHistory(entries), [entries])
  const selectedPart = history.parts.find(part => part.id === activePartId) ?? null

  const changeSelection = React.useCallback((partId: string | null) => {
    if (partId === null && activePartId !== null) focusReturnPartId.current = activePartId
    setSelectionGuard({ scopeKey, staleControlledPartId: null })
    if (!isControlled) setLocalSelection({ scopeKey, partId })
    onSelectedPartChange?.(partId)
  }, [activePartId, isControlled, onSelectedPartChange, scopeKey])

  React.useEffect(() => {
    if (scopeChanged) {
      focusReturnPartId.current = null
      setLocalSelection({ scopeKey, partId: null })
      setSelectionGuard({
        scopeKey,
        staleControlledPartId: isControlled ? selectedPartId ?? null : null,
      })
      onSelectedPartChange?.(null)
      return
    }
    if (selectionGuard.staleControlledPartId !== null
      && selectionGuard.staleControlledPartId !== selectedPartId) {
      setSelectionGuard({ scopeKey, staleControlledPartId: null })
    }
  }, [isControlled, onSelectedPartChange, scopeChanged, scopeKey, selectedPartId, selectionGuard])

  React.useEffect(() => {
    if (!scopeChanged && activePartId !== null && selectedPart === null) changeSelection(null)
  }, [activePartId, changeSelection, scopeChanged, selectedPart])

  React.useLayoutEffect(() => {
    if (activePartId !== null && selectedPart !== null) {
      detailHeading.current?.focus({ preventScroll: true })
      return
    }
    if (activePartId === null && focusReturnPartId.current !== null) {
      partButtons.current.get(focusReturnPartId.current)?.focus({ preventScroll: true })
      focusReturnPartId.current = null
    }
  }, [activePartId, selectedPart])

  useTaskFlowBack({
    enabled: manageBrowserBack && activePartId !== null && selectedPart !== null,
    onBack: () => changeSelection(null),
  })

  const writeToday = (part?: BodyHistoryPart) => {
    onRecord(part?.kind === "LEGACY_OTHER" ? undefined : part?.id)
  }

  return (
    <section
      className="body-history"
      aria-labelledby={showHeading ? headingId : undefined}
      aria-label={showHeading ? undefined : "몸 기록"}
    >
      {showHeading && (
        <AppHeading id={headingId} as="h1" variant="screen" accent className="body-history__screen-heading">
          몸 기록
        </AppHeading>
      )}

      {selectedPart === null ? (
        <>
          <button type="button" className="body-history__primary" onClick={() => writeToday()}>
            <span>오늘 상태 남기기</span>
            <ChevronRight aria-hidden="true" size={18} />
          </button>
          {history.parts.length > 0 && (
            <section className="body-history__part-list" aria-label="기록한 부위">
              <h2 className="body-history__section-heading">기록한 부위</h2>
              <ul>
                {history.parts.map(part => (
                  <li key={part.id}>
                    <button
                      ref={node => {
                        if (node) partButtons.current.set(part.id, node)
                        else partButtons.current.delete(part.id)
                      }}
                      type="button"
                      className="body-history__part app-choice-control"
                      aria-label={part.label + ", 마지막 기록 " + dateLabel(part.lastRecordedDate)}
                      onClick={() => changeSelection(part.id)}
                    >
                      <span className="body-history__part-name">{part.label}</span>
                      <span className="body-history__last-date">마지막 기록 · {dateLabel(part.lastRecordedDate)}</span>
                      <ChevronRight aria-hidden="true" size={18} />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      ) : (
        <div className="body-history__detail">
          <button type="button" className="body-history__back app-choice-control" onClick={() => changeSelection(null)}>
            <ArrowLeft aria-hidden="true" size={18} />
            <span>부위 목록</span>
          </button>
          <AppHeading
            ref={detailHeading}
            id={headingId}
            as={showHeading ? "h2" : "h3"}
            variant="section"
            className="body-history__part-heading"
            tabIndex={-1}
          >
            {selectedPart.label}
          </AppHeading>
          <button type="button" className="body-history__primary" onClick={() => writeToday(selectedPart)}>
            <span>오늘 상태 남기기</span>
            <ChevronRight aria-hidden="true" size={18} />
          </button>
          <ol className="body-history__records" aria-label={selectedPart.label + " 날짜별 기록"}>
            {selectedPart.records.map(record => (
              <li className="body-history__record" key={record.key}>
                <div className="body-history__record-head">
                  <time className="body-history__date" dateTime={record.date}>{dateLabel(record.date)}</time>
                  <span className="body-history__source">{sourceLabel(record.source)}</span>
                  <strong className="body-history__severity">정도 {record.severity}/5</strong>
                </div>
                {record.labelSnapshot !== undefined && record.labelSnapshot !== selectedPart.label && (
                  <p className="body-history__snapshot">기록 이름 · {record.labelSnapshot}</p>
                )}
                {record.note !== undefined && record.note !== "" && (
                  <p className="body-history__note">{record.note}</p>
                )}
                {timeLabel(record.savedAt) !== null && (
                  <p className="body-history__saved-time">저장 시간 · {timeLabel(record.savedAt)}</p>
                )}
                <button
                  type="button"
                  className="body-history__source-link"
                  onClick={() => onOpenEntry(record.entryId, record.date)}
                >
                  원본 일지 보기
                  <ChevronRight aria-hidden="true" size={17} />
                </button>
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  )
}
