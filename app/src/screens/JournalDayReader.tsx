import React from "react"
import { JournalPageNavigator } from "../components/JournalPageNavigator"
import type { JournalEntry } from "../domain/journal-schema"
import { projectJournalReader } from "../domain/journal-reader"
import { LogDetail } from "./LogDetail"

type JournalDayReaderProps = {
  readonly date: string
  readonly entries: readonly JournalEntry[]
  readonly onDateChange: (date: string) => void
  readonly onBack: () => void
  readonly onAddEntry?: (date: string) => void
  readonly onEditEntry?: (entry: JournalEntry) => void
}

export function JournalDayReader({
  date,
  entries,
  onDateChange,
  onBack,
  onAddEntry,
  onEditEntry,
}: JournalDayReaderProps) {
  const reader = React.useMemo(
    () => projectJournalReader(entries, date),
    [date, entries],
  )
  const touchStart = React.useRef<{
    readonly x: number
    readonly y: number
    readonly blocked: boolean
  } | null>(null)

  const openPrevious = React.useCallback(() => {
    if (reader.previousDate !== null) onDateChange(reader.previousDate)
  }, [onDateChange, reader.previousDate])
  const openNext = React.useCallback(() => {
    if (reader.nextDate !== null) onDateChange(reader.nextDate)
  }, [onDateChange, reader.nextDate])

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isJournalNavigationBlockedTarget(event.target)) return
      if (event.key === "ArrowLeft") openPrevious()
      if (event.key === "ArrowRight") openNext()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [openNext, openPrevious])

  const controls = (
    <JournalPageNavigator
      position={reader.position}
      total={reader.total}
      onPrevious={reader.previousDate === null ? undefined : openPrevious}
      onNext={reader.nextDate === null ? undefined : openNext}
    />
  )

  return (
    <div
      className="journal-day-reader"
      onTouchStart={(event) => {
        const touch = event.changedTouches[0]
        touchStart.current = touch === undefined ? null : {
          x: touch.clientX,
          y: touch.clientY,
          blocked: isJournalNavigationBlockedTarget(event.target),
        }
      }}
      onTouchEnd={(event) => {
        const start = touchStart.current
        const touch = event.changedTouches[0]
        touchStart.current = null
        if (start === null || touch === undefined || start.blocked || isJournalNavigationBlockedTarget(event.target)) return
        const deltaX = touch.clientX - start.x
        const deltaY = touch.clientY - start.y
        if (Math.abs(deltaX) < 56 || Math.abs(deltaX) <= Math.abs(deltaY) * 1.2) return
        if (deltaX > 0) openPrevious()
        else openNext()
      }}
      onTouchCancel={() => {
        touchStart.current = null
      }}
    >
      <LogDetail
        date={date}
        onBack={onBack}
        onAddEntry={onAddEntry}
        onEditEntry={onEditEntry}
        readerControls={controls}
      />
    </div>
  )
}

function isJournalNavigationBlockedTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target.isContentEditable) return true
  return target.closest("[data-decoration-interaction='true']") !== null
}
