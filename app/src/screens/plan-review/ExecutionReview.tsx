import { useCallback, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react"
import { createPortal } from "react-dom"
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react"
import { useReaderDialog } from "../../hooks/useReaderDialog"
import { useJournalPageTurn } from "../../hooks/useJournalPageTurn"
import { useOrderedStepMotion } from "../../hooks/useOrderedStepMotion"
import type { ExecutionReview as Review } from "../../domain/plan-execution-review"
import "../../styles/plan-day-reader.css"
import "../../styles/execution-review.css"

export const COACHING_READING = [
  { id: "different", title: "계획과 다르게 운동했다면?", summary: "무엇이 달라졌는지부터 나눠 봐요.", paragraphs: [
    "거리나 반복 수만 보지 않고 운동 강도, 운동 구간, 사이 회복을 따로 살펴봐요. 같은 거리를 뛰어도 연속 달리기와 회복을 넣은 반복 달리기는 구성이 달라요.",
    "먼저 완료·일부 수행·휴식 중 실제 결과를 남기고, 가능하면 운동 구성을 추가해 주세요. 기록하지 않은 항목은 못 했다고 판단하지 않아요.",
    "변경 이유를 알 수 없으면 확인이 먼저예요. 계획과 달랐다는 사실만으로 다음 운동을 더 세게 하거나 전부 취소하지 않아요.",
  ] },
  { id: "missed", title: "못 한 훈련을 내일 더 해야 할까요?", summary: "남은 일정부터 확인해요.", paragraphs: [
    "빠진 훈련은 자동으로 다음 날에 붙이지 않아요. 내일 이미 예정된 훈련과 겹치면 원래 계획과 다른 구성이 되기 때문이에요.",
    "쉬었는지, 일부를 했는지, 다른 운동으로 바꿨는지 구분해 주세요. 통증으로 멈췄다면 일정 조정보다 몸 상태 확인이 먼저예요.",
    "일정을 바꿀 때는 바뀌는 날짜와 훈련을 먼저 비교해야 해요. 설명을 읽거나 기록을 추가하는 것만으로 기존 계획이 수정되지는 않아요.",
  ] },
] as const

function ReviewMetrics({ review, compact = false }: { readonly review: Review; readonly compact?: boolean }) {
  const metrics = compact ? review.metrics.slice(0, 2) : review.metrics
  if (metrics.length === 0) return null
  return <dl className="execution-review__metrics" data-compact={compact || undefined}>{metrics.map(metric => <div key={metric.label}>
    <dt>{metric.label}</dt><dd><span><small>기록</small><strong>{metric.actual}</strong></span>
      {metric.planned && <span><small>계획</small><strong>{metric.planned}</strong></span>}</dd>
  </div>)}</dl>
}

function ReviewSummary({ review }: { readonly review: Review }) {
  return <><p className="execution-review__lead">{review.summary}</p>
    {review.awaitingDeviceData && <p className="execution-review__status" role="status">워치 기록을 기다리고 있어요.</p>}
    {review.timingChange && <p className="execution-review__muted">{review.timingChange}</p>}
    <ReviewMetrics review={review} compact />
    {review.metrics.some(metric => metric.planned !== undefined) && <p className="execution-review__muted">목표와 기록을 나란히 표시해요. 같은 구성을 했는지는 아직 확인되지 않았어요.</p>}
    <p className="execution-review__next">{review.next}</p>
    <p className="execution-review__muted">읽기만 해서는 일정이 바뀌지 않아요.</p></>
}

function ExerciseRows({ exercise }: { readonly exercise: Review["actualExercises"][number] }) {
  return <div><h4>{exercise.kind}</h4><ul>{exercise.rows.slice(0, 2).map((row, index) => <li key={index}>{row}</li>)}</ul>
    {exercise.rows.length > 2 && <details><summary>나머지 구간 {exercise.rows.length - 2}개</summary><ul>{exercise.rows.slice(2).map((row, index) => <li key={index}>{row}</li>)}</ul></details>}
  </div>
}

function ReviewEvidence({ review }: { readonly review: Review }) {
  return <section><h3>실제로 남긴 기록</h3><ReviewMetrics review={review} />
    {review.repetitionComparison?.kind === "compared" && <section>
      <h4>반복·회복 비교</h4>
      <ul>{review.repetitionComparison.facts.slice(0, 3).map(fact => <li key={fact}>{fact}</li>)}</ul>
      {review.repetitionComparison.facts.length > 3 && <details><summary>구간별 차이 더 보기</summary>
        <ul>{review.repetitionComparison.facts.slice(3).map(fact => <li key={fact}>{fact}</li>)}</ul>
      </details>}
    </section>}
    {review.actualExercises.slice(0, 2).map((exercise, index) => <ExerciseRows key={index} exercise={exercise} />)}
    {review.actualExercises.length > 2 && <details><summary>다른 운동 {review.actualExercises.length - 2}개</summary>{review.actualExercises.slice(2).map((exercise, index) => <ExerciseRows key={index} exercise={exercise} />)}</details>}
    {review.metrics.length === 0 && review.actualExercises.length === 0 && <p>{review.summary}</p>}
    {review.actualExercises.length > 0 && <p className="execution-review__muted">본인이 입력한 구성이에요. 계획 구간과 자동으로 맞추지 않아요.</p>}
  </section>
}

function ReviewReasons({ review }: { readonly review: Review }) {
  return <><section><h3>이렇게 안내하는 이유</h3><p>{review.explanation}</p></section>
    {review.facts.length > 0 && <details><summary>사용한 기록</summary><ul>{review.facts.map(fact => <li key={fact}>{fact}</li>)}</ul></details>}
    <details><summary>아직 판단하지 않은 내용</summary><ul>{review.unknowns.map(item => <li key={item}>{item}</li>)}</ul>
      <p>메모 원문은 읽지 않아요. 이 화면만으로 회복 완료나 체력 변화를 판단하지 않아요.</p></details></>
}

export function ExecutionReviewContent({ review, originalMethod }: { readonly review: Review; readonly originalMethod?: ReactNode }) {
  return <div className="execution-review"><ReviewSummary review={review} />
    <div className="execution-review__comparison">{originalMethod}<ReviewEvidence review={review} /></div>
    <details><summary>이렇게 안내하는 이유</summary><ReviewReasons review={review} /></details>
  </div>
}

const VIEWS = ["summary", "evidence", "reason"] as const
type ReviewView = typeof VIEWS[number]
const VIEW_LABELS: Record<ReviewView, string> = { summary: "요약", evidence: "계획·기록", reason: "이유" }

export function ExecutionReviewReader({ review, article, originalMethod, onOpenJournal, onOpenPlan, onReplan, onClose, returnFocusTo }: {
  readonly review?: Review
  readonly article?: typeof COACHING_READING[number]
  readonly originalMethod?: ReactNode
  readonly onOpenJournal?: () => void
  readonly onOpenPlan?: () => void
  readonly onReplan?: () => void
  readonly onClose: () => void
  readonly returnFocusTo?: () => HTMLElement | null
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const body = useRef<HTMLDivElement>(null)
  const [view, setView] = useState<ReviewView>("summary")
  const [visited, setVisited] = useState<ReadonlySet<ReviewView>>(() => new Set(["summary"]))
  const tabId = useId()
  const scrollPositions = useRef<Record<ReviewView, number>>({ summary: 0, evidence: 0, reason: 0 })
  const motion = useOrderedStepMotion(view, VIEWS)
  const viewIndex = VIEWS.indexOf(view)
  const changeView = useCallback((next: ReviewView) => {
    if (next === view) return
    scrollPositions.current[view] = body.current?.scrollTop ?? 0
    setVisited(current => new Set([...current, next]))
    setView(next)
  }, [view])
  useLayoutEffect(() => { if (body.current) body.current.scrollTop = scrollPositions.current[view] }, [view])
  const turn = useJournalPageTurn({ keyboard: false,
    onPrevious: review && viewIndex > 0 ? () => { if (!window.getSelection()?.toString()) changeView(VIEWS[viewIndex - 1]!) } : undefined,
    onNext: review && viewIndex < VIEWS.length - 1 ? () => { if (!window.getSelection()?.toString()) changeView(VIEWS[viewIndex + 1]!) } : undefined,
  })
  const afterClose = useRef<(() => void) | undefined>(undefined)
  const close = useReaderDialog(dialog, () => {
    const action = afterClose.current
    afterClose.current = undefined
    onClose()
    action?.()
  }, returnFocusTo)
  const journalFirst = review && ["SAFETY_REVIEW", "SOURCE_UNAVAILABLE", "CONFLICT"].includes(review.status)
  return createPortal(<dialog ref={dialog} className="plan-day-reader execution-review-reader" aria-labelledby={`${tabId}-title`} onCancel={event => { event.preventDefault(); close() }}>
    <header className="plan-day-reader__header"><button type="button" onClick={close} aria-label="훈련 코칭으로 돌아가기"><ArrowLeft size={20} aria-hidden="true" /></button>
      <div><span>{review ? `${review.date} · ${review.slot}${review.recordLabel ? ` · ${review.recordLabel}` : ""}` : "훈련 코칭 · 일반 안내"}</span><h2 id={`${tabId}-title`}>{review?.title ?? article?.title}</h2></div>
    </header>
    {review && <div className="execution-review__navigation">
      <div className="execution-review__tabs app-choice-group" role="tablist" aria-label="훈련 비교 내용">{VIEWS.map((item, index) => <button className="app-choice-control" type="button" role="tab" key={item}
        id={`${tabId}-${item}`} aria-controls={`${tabId}-${item}-panel`} aria-selected={view === item} tabIndex={view === item ? 0 : -1}
        onClick={() => changeView(item)} onKeyDown={event => {
          const next = event.key === "ArrowRight" ? (index + 1) % VIEWS.length : event.key === "ArrowLeft" ? (index + VIEWS.length - 1) % VIEWS.length
            : event.key === "Home" ? 0 : event.key === "End" ? VIEWS.length - 1 : null
          if (next === null) return
          event.preventDefault(); changeView(VIEWS[next]!); document.getElementById(`${tabId}-${VIEWS[next]}`)?.focus()
        }}>{VIEW_LABELS[item]}</button>)}</div>
      <div className="execution-review__page-arrows">
        <button type="button" disabled={viewIndex === 0} aria-label="이전 내용" title="이전 내용" onClick={() => changeView(VIEWS[viewIndex - 1]!)}><ChevronLeft size={18} aria-hidden="true" /></button>
        <button type="button" disabled={viewIndex === VIEWS.length - 1} aria-label="다음 내용" title="다음 내용" onClick={() => changeView(VIEWS[viewIndex + 1]!)}><ChevronRight size={18} aria-hidden="true" /></button>
      </div>
    </div>}
    <div ref={body} className="plan-day-reader__body" {...turn.touchHandlers}><div className="plan-day-reader__content execution-review">
      {review ? VIEWS.map(item => <div key={item} hidden={view !== item} className={view === item ? "active-stage-content" : undefined} data-flow-direction={motion} role="tabpanel" tabIndex={0}
        id={`${tabId}-${item}-panel`} aria-labelledby={`${tabId}-${item}`}>
        {visited.has(item) && (item === "summary" ? <ReviewSummary review={review} />
          : item === "evidence" ? <div className="execution-review__comparison">{originalMethod}<ReviewEvidence review={review} /></div>
            : <ReviewReasons review={review} />)}
      </div>) : <>{article?.paragraphs.map(text => <p key={text}>{text}</p>)}<p className="execution-review__muted">일반 안내예요. 개인의 훈련이나 몸 상태를 분석한 결과는 아니에요.</p></>}
    </div></div>
    {review && (onOpenJournal || onOpenPlan || onReplan) && <nav className="execution-review__actions" aria-label="기록 확인 후 다음 행동">
      {onOpenJournal && <button type="button" data-primary={journalFirst || (!onOpenPlan && !onReplan)} onClick={() => { afterClose.current = onOpenJournal; close() }}>일지 확인</button>}
      {onOpenPlan && <button type="button" data-primary={journalFirst ? !onOpenJournal : !onReplan} onClick={() => { afterClose.current = onOpenPlan; close() }}>현재 일정</button>}
      {onReplan && !journalFirst && <button type="button" data-primary="true" onClick={() => { afterClose.current = onReplan; close() }}>남은 일정 조정</button>}
    </nav>}
  </dialog>, document.body)
}
