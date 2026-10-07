import { useContext, useEffect, useMemo, useRef, useState } from "react"
import { ChevronRight } from "lucide-react"
import { MultiPlanEvidenceContext } from "../../components/MultiPlanEvidenceContext"
import { AppHeading } from "../../components/AppHeading"
import { collectExecutionReviews } from "../../domain/plan-execution-review"
import { readJournalOriginalPlan } from "../../domain/journal-original-plan"
import { loadEntriesForPlanSafety } from "../../domain/journal-store"
import { useLocalToday } from "../../hooks/useLocalToday"
import { onLocalJournalScopeChange } from "../../domain/account/local-journal-ownership"
import { COACHING_READING, ExecutionReviewReader } from "../plan-review/ExecutionReview"
import { OriginalTrainingMethod } from "../plan-review/OriginalTrainingMethod"
import { ExecutionReplan } from "../plan-review/ExecutionReplan"

export function HomeCoachingSummary({ revision, onOpenDay, onOpenPlan }: {
  readonly revision: number; readonly onOpenDay?: (date: string, entryId?: string) => void; readonly onOpenPlan?: () => void
}) {
  const readMulti = useContext(MultiPlanEvidenceContext)
  const [selected, setSelected] = useState<string | null>(null)
  const [replanEntry, setReplanEntry] = useState<string | null>(null)
  const [visibleCount, setVisibleCount] = useState(2)
  const heading = useRef<HTMLHeadingElement>(null)
  const today = useLocalToday()
  useEffect(() => onLocalJournalScopeChange(() => { setSelected(null); setReplanEntry(null); setVisibleCount(2) }), [])
  const { source, reviews, total } = useMemo(() => {
    const source = loadEntriesForPlanSafety()
    const retained = readMulti?.()
    const total = source.status === "complete" ? source.entries.filter(entry => entry.kind === "post-session" && entry.plannedSessionLink && entry.date <= today).length : 0
    return { source, total, reviews: collectExecutionReviews(source, entry => readJournalOriginalPlan(entry, undefined, undefined, retained), today, { limit: visibleCount }) }
  }, [revision, readMulti, visibleCount, today])
  const review = reviews.find(item => `record:${item.id}` === selected)
  const article = COACHING_READING.find(item => `article:${item.id}` === selected)
  const readingFirst = source.status === "complete" && reviews.length === 0
  const featuredArticle = COACHING_READING[0]
  const replanReview = reviews.find(item => item.id === replanEntry)
  useEffect(() => {
    if (selected?.startsWith("record:") && !review) setSelected(null)
  }, [selected, review])
  const selectedEntry = source.status === "complete" ? source.entries.find(entry => entry.kind === "post-session" && entry.id === review?.id) : undefined
  let originalMethod
  if (selectedEntry?.kind === "post-session" && review?.status !== "CONFLICT") {
    try { originalMethod = <OriginalTrainingMethod original={readJournalOriginalPlan(selectedEntry, undefined, undefined, readMulti?.())} /> } catch { /* The report already explains unavailable source evidence. */ }
  }
  return <section className="home-hub__summary home-coaching" aria-labelledby="home-coaching-title">
    <AppHeading as="h2" variant="section" id="home-coaching-title" ref={heading} tabIndex={-1}>{readingFirst ? "훈련법 읽기" : "훈련 코칭"}</AppHeading>
    {source.status !== "complete" ? <p role="status">기록을 모두 읽지 못해 비교를 잠시 보류했어요. 저장 상태를 확인해 주세요.</p>
      : readingFirst ? <article className="home-coaching__reading">
        <p className="home-coaching__reading-kind">일반 훈련 정보</p>
        <h3>{featuredArticle.title}</h3>
        <p>{featuredArticle.paragraphs[0]}</p>
        <button type="button" className="home-hub__text-action" aria-label={`${featuredArticle.title} 계속 읽기`} onClick={() => setSelected(`article:${featuredArticle.id}`)}>계속 읽기<ChevronRight size={18} aria-hidden="true" /></button>
      </article>
        : <>{reviews.slice(0, visibleCount).map((item, index) => <div key={`${item.id}:${index}`} className="home-coaching__item">
          <button type="button" className="home-hub__summary-row" onClick={() => setSelected(`record:${item.id}`)}><span className="home-hub__summary-copy"><small>{item.date} · {item.slot}{item.recordLabel ? ` · ${item.recordLabel}` : ""}</small><strong>{item.title}</strong></span><ChevronRight size={18} aria-hidden="true" /></button>
          <div className="home-coaching__actions">{onOpenDay && <button type="button" aria-label={item.recordLabel ? `${item.recordLabel} 일지 열기` : "해당 일지"} onClick={() => onOpenDay(item.date, item.id)}>해당 일지</button>}{onOpenPlan && <button type="button" onClick={onOpenPlan}>현재 일정</button>}</div>
        </div>)}{total > visibleCount && <button type="button" className="home-hub__text-action" onClick={() => setVisibleCount(count => count + 10)}>비교 기록 더 보기 · {total - visibleCount}개 남음</button>}{visibleCount > 2 && <button type="button" className="home-hub__text-action" onClick={() => setVisibleCount(2)}>최근 2개만 보기</button>}</>}
    <details><summary>{readingFirst ? "다른 훈련법 읽기" : "훈련을 바꿨을 때 읽어보기"}</summary>{(readingFirst ? COACHING_READING.slice(1) : COACHING_READING).map(item => <button type="button" key={item.id} className="home-hub__summary-row" onClick={() => setSelected(`article:${item.id}`)}><span className="home-hub__summary-copy"><strong>{item.title}</strong><small>{item.summary}</small></span><ChevronRight size={18} aria-hidden="true" /></button>)}</details>
    {(review || article) && <ExecutionReviewReader key={selected} review={review} article={article} originalMethod={originalMethod}
      returnFocusTo={() => heading.current}
      onReplan={review ? () => setReplanEntry(review.id) : undefined}
      onOpenJournal={review && onOpenDay ? () => onOpenDay(review.date, review.id) : undefined} onOpenPlan={onOpenPlan} onClose={() => setSelected(null)} />}
    {replanEntry && <ExecutionReplan entryId={replanEntry} onClose={() => setReplanEntry(null)} onOpenPlan={onOpenPlan}
      onOpenJournal={replanReview && onOpenDay ? () => onOpenDay(replanReview.date, replanReview.id) : undefined} returnFocusTo={() => heading.current} />}
  </section>
}
