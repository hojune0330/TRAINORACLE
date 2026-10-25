import { useContext, useEffect, useMemo, useRef, useState } from "react"
import { BookOpen, ChevronRight, Library } from "lucide-react"
import { MultiPlanEvidenceContext } from "../../components/MultiPlanEvidenceContext"
import { AppHeading } from "../../components/AppHeading"
import { CategoryCard, CategoryDisclosure } from "../../components/CategoryCard"
import { collectExecutionReviews } from "../../domain/plan-execution-review"
import { readJournalOriginalPlan } from "../../domain/journal-original-plan"
import { loadEntriesForPlanSafety } from "../../domain/journal-store"
import { useLocalToday } from "../../hooks/useLocalToday"
import { onLocalJournalScopeChange } from "../../domain/account/local-journal-ownership"
import { COACHING_READING, ExecutionReviewReader } from "../plan-review/ExecutionReview"
import { OriginalTrainingMethod } from "../plan-review/OriginalTrainingMethod"
import { ExecutionReplan } from "../plan-review/ExecutionReplan"
import type { RetainedMultiAdjustedEvidenceV3 } from "../../domain/selected-multi-adjusted-plan-v3"

export function HomeCoachingSummary({ revision, onOpenDay, onOpenPlan }: {
  readonly revision: number; readonly onOpenDay?: (date: string, entryId?: string) => void; readonly onOpenPlan?: () => void
}) {
  const readMulti = useContext(MultiPlanEvidenceContext)
  const [selected, setSelected] = useState<string | null>(null)
  const [replanEntry, setReplanEntry] = useState<string | null>(null)
  const [visibleCount, setVisibleCount] = useState(2)
  const heading = useRef<HTMLHeadingElement>(null)
  const readerTrigger = useRef<HTMLButtonElement | null>(null)
  const today = useLocalToday()
  useEffect(() => onLocalJournalScopeChange(() => { setSelected(null); setReplanEntry(null); setVisibleCount(2); readerTrigger.current = null }), [])
  const openReader = (id: string, trigger: HTMLButtonElement) => { readerTrigger.current = trigger; setSelected(id) }
  const { source, reviews, total, readRetained } = useMemo(() => {
    const source = loadEntriesForPlanSafety()
    const total = source.status === "complete" ? source.entries.filter(entry => entry.kind === "post-session" && entry.plannedSessionLink && entry.date <= today).length : 0
    let retainedRead:
      | { readonly kind: "pending" }
      | { readonly kind: "loaded"; readonly value: readonly RetainedMultiAdjustedEvidenceV3[] }
      | { readonly kind: "failed"; readonly error: unknown } = { kind: "pending" }
    const readRetained = readMulti ? () => {
      if (retainedRead.kind === "loaded") return retainedRead.value
      if (retainedRead.kind === "failed") throw retainedRead.error
      try {
        const value = readMulti()
        retainedRead = { kind: "loaded", value }
        return value
      } catch (error) {
        retainedRead = { kind: "failed", error }
        throw error
      }
    } : undefined
    return { source, total, readRetained, reviews: collectExecutionReviews(source, entry => readJournalOriginalPlan(entry, undefined, undefined, readRetained), today, { limit: visibleCount }) }
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
    try { originalMethod = <OriginalTrainingMethod date={selectedEntry.plannedSessionLink?.plannedDate} original={readJournalOriginalPlan(selectedEntry, undefined, undefined, readRetained)} /> } catch { /* The report already explains unavailable source evidence. */ }
  }
  return <section className="home-hub__summary home-coaching" aria-labelledby="home-coaching-title">
    <AppHeading as="h2" variant="section" id="home-coaching-title" ref={heading} tabIndex={-1}>{readingFirst ? "훈련법 읽기" : "훈련 코칭"}</AppHeading>
    {source.status !== "complete" ? <p role="status">기록을 모두 읽지 못해 비교를 잠시 보류했어요. 저장 상태를 확인해 주세요.</p>
      : readingFirst ? <CategoryCard className="home-coaching__reading" category="training" icon={BookOpen}
        label="일반 훈련 정보" title={featuredArticle.title}
        onClick={event => openReader(`article:${featuredArticle.id}`, event.currentTarget)} />
        : <>{reviews.slice(0, visibleCount).map((item, index) => <div key={`${item.id}:${index}`} className="home-coaching__item">
          <button type="button" className="home-hub__summary-row" onClick={event => openReader(`record:${item.id}`, event.currentTarget)}><span className="home-hub__summary-copy"><small>{item.date} · {item.slot}{item.recordLabel ? ` · ${item.recordLabel}` : ""}</small><strong>{item.title}</strong></span><ChevronRight size={18} aria-hidden="true" /></button>
          <div className="home-coaching__actions">{onOpenDay && <button type="button" aria-label={item.recordLabel ? `${item.recordLabel} 일지 열기` : "해당 일지"} onClick={() => onOpenDay(item.date, item.id)}>해당 일지</button>}{onOpenPlan && <button type="button" onClick={onOpenPlan}>현재 일정</button>}</div>
        </div>)}{total > visibleCount && <button type="button" className="home-hub__text-action" onClick={() => setVisibleCount(count => count + 10)}>비교 기록 더 보기 · {total - visibleCount}개 남음</button>}{visibleCount > 2 && <button type="button" className="home-hub__text-action" onClick={() => setVisibleCount(2)}>최근 2개만 보기</button>}</>}
    <CategoryDisclosure category="training" icon={Library} title={readingFirst ? "다른 훈련법 읽기" : "훈련을 바꿨을 때 읽어보기"}>
      {(readingFirst ? COACHING_READING.slice(1) : COACHING_READING).map(item => <CategoryCard key={item.id}
        category="training" icon={BookOpen} variant="row" title={item.title}
        onClick={event => openReader(`article:${item.id}`, event.currentTarget)} />)}
    </CategoryDisclosure>
    {(review || article) && <ExecutionReviewReader key={selected} review={review} article={article} originalMethod={originalMethod}
      returnFocusTo={() => readerTrigger.current?.isConnected ? readerTrigger.current : heading.current}
      onReplan={review ? () => setReplanEntry(review.id) : undefined}
      onOpenJournal={review && onOpenDay ? () => onOpenDay(review.date, review.id) : undefined} onOpenPlan={onOpenPlan} onClose={() => setSelected(null)} />}
    {replanEntry && <ExecutionReplan entryId={replanEntry} onClose={() => setReplanEntry(null)} onOpenPlan={onOpenPlan}
      onOpenJournal={replanReview && onOpenDay ? () => onOpenDay(replanReview.date, replanReview.id) : undefined} returnFocusTo={() => heading.current} />}
  </section>
}
