import React from "react"
import { ACCOUNT_PLAN_EVENT, accountPlansEnabled } from "../../domain/account/account-plan-service"
import { ensureAccountPlanHistory } from "../../domain/account/account-plan-domain"
import type { PostSessionEntry } from "../../domain/journal-schema"
import { PLAN_EXECUTION_CHANGE_LABELS } from "../../domain/journal-schema"
import { readJournalOriginalPlan } from "../../domain/journal-original-plan"
import { onLocalJournalScopeChange } from "../../domain/account/local-journal-ownership"
import { loadEntriesForPlanSafety } from "../../domain/journal-store"
import { collectSessionExplanationEvidence } from "../../domain/session-explanation-evidence"
import { SessionExplanationEntry } from "../plan-beta/SessionExplanation"
import { AdjustedJournalOriginalPlan } from "./AdjustedJournalOriginalPlan"
import { AdjustedPrescriptionV3 } from "../plan-beta/AdjustedPrescriptionV3"
import { MultiPlanEvidenceContext } from "../../components/MultiPlanEvidenceContext"
import { collectExecutionReviews } from "../../domain/plan-execution-review"
import { todayISO } from "../../domain/journal-store"
import { ExecutionReviewContent } from "../plan-review/ExecutionReview"

export function JournalOriginalPlan({ entry }: { readonly entry: PostSessionEntry }) {
  const readMultiEvidence = React.useContext(MultiPlanEvidenceContext)
  const [lookup, setLookup] = React.useState<ReturnType<typeof readJournalOriginalPlan> | null>(null)
  const details = React.useRef<HTMLDetailsElement>(null)
  const pending = React.useRef(0)
  const [loading, setLoading] = React.useState(false)
  React.useEffect(() => {
    pending.current++; setLoading(false)
    setLookup(null)
    if (details.current) details.current.open = false
  }, [entry.id, entry.date, entry.activitySlot, entry.plannedSessionLink, readMultiEvidence])
  React.useEffect(() => {
    const clear = () => { pending.current++; setLoading(false); setLookup(null); if (details.current) details.current.open = false }
    const unsubscribe = onLocalJournalScopeChange(clear)
    window.addEventListener("storage", clear)
    return () => { pending.current++; unsubscribe(); window.removeEventListener("storage", clear) }
  }, [])
  React.useEffect(() => {
    const refresh = () => { if (details.current?.open) setLookup(readJournalOriginalPlan(entry, undefined, undefined, readMultiEvidence?.())) }
    window.addEventListener(ACCOUNT_PLAN_EVENT, refresh)
    return () => window.removeEventListener(ACCOUNT_PLAN_EVENT, refresh)
  }, [entry, readMultiEvidence])
  if (entry.plannedSessionLink === undefined) return null
  const matched = lookup?.kind === "matched" ? lookup : null
  const source = lookup ? loadEntriesForPlanSafety() : null
  const review = lookup && source ? collectExecutionReviews(source, candidate => candidate.id === entry.id
    ? lookup : readJournalOriginalPlan(candidate, undefined, undefined, readMultiEvidence?.()), todayISO(), { journalId: entry.id }).find(item => item.id === entry.id) : undefined
  const originalMethod = lookup && "session" in lookup && !loading ? <section className="journal-original-plan__method"><h3>당시 계획한 훈련 방법</h3>{matched !== null ? <>
    <p>{matched.source === "ARCHIVED" ? "그때 보관한 계획의 훈련이에요." : "이 일지와 연결된 현재 계획의 훈련이에요."}</p>
    <SessionExplanationEntry session={matched.session} date={entry.plannedSessionLink.plannedDate} memoState="HISTORICAL" returnLabel="일지로 돌아가기" context={{
      kind: "SAVED", plan: matched.state.activePlan, generatedAt: matched.state.generatedAt,
      receipt: matched.state.version === 3 ? matched.state.explanationReceipt : undefined,
      frameOrdinal: matched.state.version === 3 ? matched.state.periodization?.frameOrdinal : undefined,
    }} loadEvidence={session => {
      const journal = loadEntriesForPlanSafety()
      return journal.status === "complete"
        ? collectSessionExplanationEvidence(journal.entries, matched.state, session) : null
    }} />
  </> : lookup.kind === "matched_adjusted" ? <AdjustedJournalOriginalPlan session={lookup.session} date={entry.plannedSessionLink.plannedDate} explanation={lookup.explanation} />
    : lookup.kind === "matched_adjusted_v3" || lookup.kind === "matched_multi_adjusted_v3"
      ? <AdjustedPrescriptionV3 session={lookup.session} date={entry.plannedSessionLink.plannedDate} memoState="HISTORICAL" explanation={lookup.explanation} /> : null}</section> : null
  return <details className="journal-original-plan" ref={details} onToggle={event => {
    if (event.target !== event.currentTarget) return
    if (!event.currentTarget.open) { pending.current++; setLoading(false); setLookup(null); return }
    try {
      const result = readJournalOriginalPlan(entry, undefined, undefined, readMultiEvidence?.())
      setLookup(result)
      if (accountPlansEnabled() && (result.kind === "unavailable" || result.kind === "missing")) {
        const request = ++pending.current
        setLoading(true)
        void ensureAccountPlanHistory().then(ready => {
          if (request !== pending.current || !details.current?.open) return
          setLookup(ready ? readJournalOriginalPlan(entry, undefined, undefined, readMultiEvidence?.()) : { kind: "unavailable" })
        }).catch(() => {
          if (request === pending.current && details.current?.open) setLookup({ kind: "unavailable" })
        }).finally(() => { if (request === pending.current) setLoading(false) })
      }
    }
    catch { setLookup({ kind: "unavailable" }) }
  }}>
    <summary>계획한 훈련과 비교하기</summary>
    {entry.planExecutionChange && <p>내가 남긴 변경: {PLAN_EXECUTION_CHANGE_LABELS[entry.planExecutionChange]}</p>}
    {loading && <p role="status">이 일지와 연결된 과거 계획을 확인하고 있어요.</p>}
    {source && source.status !== "complete" && !loading && <p role="status">기록을 모두 읽지 못해 비교를 잠시 보류했어요. 저장 상태를 확인해 주세요.</p>}
    {review && !loading ? <><h3>{review.title}</h3><ExecutionReviewContent review={review} originalMethod={originalMethod} /></> : originalMethod}
    {lookup && "sourceVerificationPending" in lookup && lookup.sourceVerificationPending
      && <p role="status">출처 검증 대기 · 당시 원본만 표시해요. 현재 훈련 실행을 승인하는 근거는 아니에요.</p>}
    {lookup !== null && !("session" in lookup) && !loading && <p>{lookup.kind === "missing"
      ? "이 일지와 연결된 계획 원본을 찾지 못했어요. 예전 요약 기록만으로 훈련 내용을 다시 만들지는 않아요."
      : "연결된 계획을 읽지 못했어요. 저장된 데이터는 변경하지 않았어요."}</p>}
  </details>
}
