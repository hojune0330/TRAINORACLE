import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react"

type JournalPageNavigatorProps = {
  readonly position: number
  readonly total: number
  readonly onPrevious: (() => void) | undefined
  readonly onNext: (() => void) | undefined
  readonly onBack?: () => void
  readonly backDestination?: "home" | "journal" | "rewards"
}

export function JournalPageNavigator({ position, total, onPrevious, onNext, onBack, backDestination = "journal" }: JournalPageNavigatorProps) {
  const progress = total <= 0 ? 0 : Math.min(100, Math.max(0, (position / total) * 100))
  const backLabel = backDestination === "home" ? "홈" : backDestination === "rewards" ? "꾸미기" : "일지"
  const backDescription = backDestination === "home" ? "홈으로 돌아가기"
    : backDestination === "rewards" ? "일지 꾸미기·포인트로 돌아가기" : "일지 목록으로 돌아가기"
  return (
    <nav className="journal-reader-nav" aria-label="날짜별 일지 넘기기" data-with-back={onBack === undefined ? undefined : "true"}>
      {onBack === undefined ? (
        <button type="button" className="journal-reader-nav__edge" onClick={onPrevious} disabled={onPrevious === undefined}>
          <ChevronLeft aria-hidden="true" size={18} />
          <span>이전 일지</span>
        </button>
      ) : (
        <button type="button" className="journal-reader-nav__back" onClick={onBack} aria-label={backDescription}>
          <ArrowLeft aria-hidden="true" size={18} />
          <span>{backLabel}</span>
        </button>
      )}
      <div className="journal-reader-position">
        <strong>하루 일지</strong>
        <span>{position} / {total}</span>
        <i className="journal-reader-position__track" aria-hidden="true">
          <b style={{ width: `${progress}%` }} />
        </i>
      </div>
      {onBack === undefined ? (
        <button type="button" className="journal-reader-nav__edge" onClick={onNext} disabled={onNext === undefined}>
          <span>다음 일지</span>
          <ChevronRight aria-hidden="true" size={18} />
        </button>
      ) : (
        <div className="journal-reader-nav__turn-buttons">
          <button type="button" onClick={onPrevious} disabled={onPrevious === undefined} aria-label="이전 일지">
            <ChevronLeft aria-hidden="true" size={18} />
          </button>
          <button type="button" onClick={onNext} disabled={onNext === undefined} aria-label="다음 일지">
            <ChevronRight aria-hidden="true" size={18} />
          </button>
        </div>
      )}
    </nav>
  )
}
