import React from "react"
import type { PostSessionEntry } from "../../domain/journal-schema"
import { readJournalOriginalPlan } from "../../domain/journal-original-plan"
import { onLocalJournalScopeChange } from "../../domain/account/local-journal-ownership"
import { loadEntriesForPlanSafety } from "../../domain/journal-store"
import { collectSessionExplanationEvidence } from "../../domain/session-explanation-evidence"
import { SessionExplanationEntry } from "../plan-beta/SessionExplanation"
import { AdjustedJournalOriginalPlan } from "./AdjustedJournalOriginalPlan"
import { AdjustedPrescriptionV3 } from "../plan-beta/AdjustedPrescriptionV3"

export function JournalOriginalPlan({ entry }: { readonly entry: PostSessionEntry }) {
  const [lookup, setLookup] = React.useState<ReturnType<typeof readJournalOriginalPlan> | null>(null)
  const details = React.useRef<HTMLDetailsElement>(null)
  React.useEffect(() => {
    setLookup(null)
    if (details.current) details.current.open = false
  }, [entry.id, entry.date, entry.activitySlot, entry.plannedSessionLink])
  React.useEffect(() => {
    const clear = () => { setLookup(null); if (details.current) details.current.open = false }
    const unsubscribe = onLocalJournalScopeChange(clear)
    window.addEventListener("storage", clear)
    return () => { unsubscribe(); window.removeEventListener("storage", clear) }
  }, [])
  if (entry.plannedSessionLink === undefined) return null
  const matched = lookup?.kind === "matched" ? lookup : null
  return <details className="journal-original-plan" ref={details} onToggle={event => {
    setLookup(event.currentTarget.open ? readJournalOriginalPlan(entry) : null)
  }}>
    <summary>계획한 훈련과 비교하기</summary>
    {matched !== null ? <>
      <p>{matched.source === "ARCHIVED" ? "그때 보관한 계획의 훈련이에요." : "이 일지와 연결된 현재 계획의 훈련이에요."} 실제 기록과 계획한 내용을 나눠서 확인할 수 있어요.</p>
      <SessionExplanationEntry session={matched.session} returnLabel="일지로 돌아가기" context={{
        kind: "SAVED", plan: matched.state.activePlan, generatedAt: matched.state.generatedAt,
        receipt: matched.state.version === 3 ? matched.state.explanationReceipt : undefined,
        frameOrdinal: matched.state.version === 3 ? matched.state.periodization?.frameOrdinal : undefined,
      }} loadEvidence={session => {
        const journal = loadEntriesForPlanSafety()
        return journal.status === "complete"
          ? collectSessionExplanationEvidence(journal.entries, matched.state, session) : null
      }} />
    </> : lookup?.kind === "matched_adjusted" ? <AdjustedJournalOriginalPlan session={lookup.session} explanation={lookup.explanation} />
      : lookup?.kind === "matched_adjusted_v3" ? <>
        <p>이 일지에 연결된 당시 계획이에요. 실제 운동 기록과는 별도로 표시해요.</p>
        <AdjustedPrescriptionV3 session={lookup.session} explanation={lookup.explanation} />
      </>
      : lookup !== null && <p>{lookup.kind === "missing"
      ? "이 일지와 연결된 계획 원본이 기기에 없어요. 예전 요약 기록만으로 훈련 내용을 다시 만들지는 않아요."
      : "연결된 계획을 읽지 못했어요. 저장된 데이터는 변경하지 않았어요."}</p>}
  </details>
}
