import React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
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
  const touchStart = React.useRef<{ readonly x: number; readonly y: number } | null>(null)

  const openPrevious = React.useCallback(() => {
    if (reader.previousDate !== null) onDateChange(reader.previousDate)
  }, [onDateChange, reader.previousDate])
  const openNext = React.useCallback(() => {
    if (reader.nextDate !== null) onDateChange(reader.nextDate)
  }, [onDateChange, reader.nextDate])

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isEditingText(event.target)) return
      if (event.key === "ArrowLeft") openPrevious()
      if (event.key === "ArrowRight") openNext()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [openNext, openPrevious])

  const controls = (
    <nav className="journal-reader-nav" aria-label="날짜별 일지 넘기기">
      <button type="button" onClick={openPrevious} disabled={reader.previousDate === null}>
        <ChevronLeft aria-hidden="true" size={18} />
        <span>이전 일지</span>
      </button>
      <div className="journal-reader-position">
        <strong>오늘의 한 페이지</strong>
        <span>{reader.position} / {reader.total}</span>
      </div>
      <button type="button" onClick={openNext} disabled={reader.nextDate === null}>
        <span>다음 일지</span>
        <ChevronRight aria-hidden="true" size={18} />
      </button>
    </nav>
  )

  return (
    <div
      className="journal-day-reader"
      onTouchStart={(event) => {
        const touch = event.changedTouches[0]
        touchStart.current = touch === undefined ? null : { x: touch.clientX, y: touch.clientY }
      }}
      onTouchEnd={(event) => {
        const start = touchStart.current
        const touch = event.changedTouches[0]
        touchStart.current = null
        if (start === null || touch === undefined) return
        const deltaX = touch.clientX - start.x
        const deltaY = touch.clientY - start.y
        if (Math.abs(deltaX) < 56 || Math.abs(deltaX) <= Math.abs(deltaY) * 1.2) return
        if (deltaX > 0) openPrevious()
        else openNext()
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

function isEditingText(target: EventTarget | null): boolean {
  return target instanceof HTMLInputElement
    || target instanceof HTMLTextAreaElement
    || (target instanceof HTMLElement && target.isContentEditable)
}
