import React from "react"
import { JournalPageNavigator } from "../components/JournalPageNavigator"
import type { JournalEntry } from "../domain/journal-schema"
import { projectJournalReader } from "../domain/journal-reader"
import { useActiveContentScroll } from "../hooks/useActiveContentScroll"
import { useJournalPageTurn } from "../hooks/useJournalPageTurn"
import { LogDetail } from "./LogDetail"

type JournalDayReaderProps = {
  readonly date: string
  readonly entries: readonly JournalEntry[]
  readonly onDateChange: (date: string) => void
  readonly onBack: () => void
  readonly backDestination?: "home" | "journal" | "rewards"
  readonly onAddEntry?: (date: string) => void
  readonly onEditEntry?: (entry: JournalEntry) => void
}

export function JournalDayReader({
  date,
  entries,
  onDateChange,
  onBack,
  backDestination,
  onAddEntry,
  onEditEntry,
}: JournalDayReaderProps) {
  const reader = React.useMemo(
    () => projectJournalReader(entries, date),
    [date, entries],
  )
  const readerTopRef = React.useRef<HTMLDivElement>(null)

  const openPrevious = React.useCallback(() => {
    if (reader.previousDate !== null) onDateChange(reader.previousDate)
  }, [onDateChange, reader.previousDate])
  const openNext = React.useCallback(() => {
    if (reader.nextDate !== null) onDateChange(reader.nextDate)
  }, [onDateChange, reader.nextDate])
  const pageTurn = useJournalPageTurn({
    onPrevious: reader.previousDate === null ? undefined : openPrevious,
    onNext: reader.nextDate === null ? undefined : openNext,
  })
  // Return to the whole reader, not an inner paper node. Aligning the inner
  // page could leave a partially clipped header above short journal pages.
  useActiveContentScroll(date, readerTopRef)

  const controls = (
    <JournalPageNavigator
      position={reader.position}
      total={reader.total}
      onPrevious={reader.previousDate === null ? undefined : pageTurn.goPrevious}
      onNext={reader.nextDate === null ? undefined : pageTurn.goNext}
      onBack={onBack}
      backDestination={backDestination}
    />
  )

  return (
    <div
      ref={readerTopRef}
      className="journal-day-reader journal-page-turn-surface"
      data-page-turn-direction={pageTurn.direction}
      data-swipe-active={pageTurn.isDragging ? "true" : undefined}
      style={{ "--journal-swipe-offset": `${pageTurn.dragOffset}px` } as React.CSSProperties}
      {...pageTurn.touchHandlers}
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
