import { ChevronLeft, ChevronRight } from "lucide-react"

type JournalPageNavigatorProps = {
  readonly position: number
  readonly total: number
  readonly onPrevious: (() => void) | undefined
  readonly onNext: (() => void) | undefined
}

export function JournalPageNavigator({ position, total, onPrevious, onNext }: JournalPageNavigatorProps) {
  const progress = total <= 0 ? 0 : Math.min(100, Math.max(0, (position / total) * 100))
  return (
    <nav className="journal-reader-nav" aria-label="날짜별 일지 넘기기">
      <button type="button" onClick={onPrevious} disabled={onPrevious === undefined}>
        <ChevronLeft aria-hidden="true" size={18} />
        <span>이전 일지</span>
      </button>
      <div className="journal-reader-position">
        <strong>오늘의 한 페이지</strong>
        <span>{position} / {total}</span>
        <i className="journal-reader-position__track" aria-hidden="true">
          <b style={{ width: `${progress}%` }} />
        </i>
      </div>
      <button type="button" onClick={onNext} disabled={onNext === undefined}>
        <span>다음 일지</span>
        <ChevronRight aria-hidden="true" size={18} />
      </button>
    </nav>
  )
}
