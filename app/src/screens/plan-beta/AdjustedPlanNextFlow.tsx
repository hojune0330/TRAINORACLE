import React from "react"
import { ArrowLeft, ArrowRight, SlidersHorizontal } from "lucide-react"
import type { PlanAdjustmentResolver } from "../PlanBeta"
import { generateAdjustedNextFrameFromDraft, type PlanCurrentCheck } from "../../domain/plan-beta-flow"
import { readPlanBetaStateFromStorage, type PlanBetaStateReadResult } from "../../domain/plan-beta-store"
import { RETAINED_ADJUSTED_PLAN_EVIDENCE } from "../../domain/adjusted-plan-storage-schema"
import type { RetainedAdjustedPlanEvidence } from "../../domain/adjusted-plan-selection"
import { localAccountScopeSnapshot } from "../../domain/account/local-account-scope"
import { loadAthleteRecords } from "../../domain/athlete-records"
import { todayISO } from "../../domain/journal-store"
import { AdjustedPlanEditFlow } from "./AdjustedPlanEditFlow"
import { matchingAdjustmentEntry } from "./adjustment-entry"
import { candidateLabel, candidateDurationSummary, candidateSharedSessionSummary } from "./labels"
import { planErrorMessage } from "./plan-feedback"
import { AdjustedJournalOriginalPlan } from "../journal/AdjustedJournalOriginalPlan"
import { isoShift } from "../../domain/dates"
import { useActiveContentScroll } from "../../hooks/useActiveContentScroll"
import "./AdjustedPlanNextFlow.css"

type NextDraft = Extract<ReturnType<typeof generateAdjustedNextFrameFromDraft>, { kind: "adjusted_next_frame_draft" }>
export const readOperatingAdjustedEvidence = () => RETAINED_ADJUSTED_PLAN_EVIDENCE

export function AdjustedPlanNextFlow({ loaded, adjustmentResolver, readEvidence = readOperatingAdjustedEvidence,
  onBack, onSaved }: {
  readonly loaded: Extract<PlanBetaStateReadResult, { kind: "adjusted_loaded" }>
  readonly adjustmentResolver?: PlanAdjustmentResolver
  readonly readEvidence?: () => readonly RetainedAdjustedPlanEvidence[]
  readonly onBack: () => void
  readonly onSaved: () => void
}) {
  const [account] = React.useState(localAccountScopeSnapshot)
  const [predecessor] = React.useState(loaded.state.contentFingerprint)
  const [startDate, setStartDate] = React.useState(todayISO)
  const [check, setCheck] = React.useState<PlanCurrentCheck | null>(null)
  const [recordId, setRecordId] = React.useState("")
  const [records] = React.useState(() => loadAthleteRecords())
  const [draft, setDraft] = React.useState<NextDraft | null>(null)
  const [entry, setEntry] = React.useState<ReturnType<typeof matchingAdjustmentEntry>>(null)
  const [error, setError] = React.useState<string | null>(null)
  const heading = React.useRef<HTMLHeadingElement>(null)
  useActiveContentScroll(entry ? null : draft ? "compare" : "prepare", heading, heading)
  const mounted = React.useRef(true)
  React.useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  const currentView = () => mounted.current && account === localAccountScopeSnapshot()
    && loaded.state.contentFingerprint === predecessor
  const current = () => {
    if (!currentView()) return false
    const read = readPlanBetaStateFromStorage(readEvidence())
    return read.kind === "adjusted_loaded" && read.state.contentFingerprint === predecessor
  }
  if (entry !== null) return <AdjustedPlanEditFlow {...entry} expectedPredecessorFingerprint={predecessor}
    isCurrentDraft={currentView} onCancel={() => setEntry(null)} onSaved={onSaved} />

  const openEditor = (candidateId: string) => {
    if (!current()) { setError(planErrorMessage("STALE_BASE")); return }
    if (!draft || check === null) return
    const result = matchingAdjustmentEntry(adjustmentResolver, { ...draft.draft, currentCheck: check,
      candidateId, startDate: draft.continuity.nextStartDate })
    if (!result) { setError("이 후보의 조정 구성과 검토 근거를 확인하지 못했어요. 현재 계획은 그대로예요."); return }
    setError(null); setEntry(result)
  }
  return <section className="adjusted-next-flow" aria-labelledby="adjusted-next-title">
    <button type="button" className="plan-back" onClick={onBack}><ArrowLeft size={18} aria-hidden="true" />현재 일정으로</button>
    <h1 id="adjusted-next-title" ref={heading} tabIndex={-1}>{draft ? "다음 계획을 비교해 주세요" : "다음 훈련 주기 준비"}</h1>
    <p>아직 현재 계획을 바꾸지 않았어요. 마지막 저장을 누르면 이전 계획을 보관하고 다음 계획으로 전환해요.</p>
    {draft === null ? <form onSubmit={event => {
      event.preventDefault(); setError(null)
      if (check === null) return
      if (!current()) { setError(planErrorMessage("STALE_BASE")); return }
      const result = generateAdjustedNextFrameFromDraft({ draft: { ...loaded.state.selection.intake, startDate },
        currentCheck: check, expectedPredecessorFingerprint: predecessor,
        ...(recordId ? { prescriptionSelection: { selectedRecordId: recordId } } : {}) }, readEvidence())
      if (result.kind === "adjusted_next_frame_draft") setDraft(result)
      else setError(planErrorMessage("code" in result ? result.code : "ADJUSTED_NEXT_FRAME_UNAVAILABLE"))
    }}>
      <label htmlFor="adjusted-next-date">다음 계획 시작일</label>
      <input id="adjusted-next-date" type="date" required min={todayISO()} value={startDate} onChange={event => setStartDate(event.target.value)} />
      <fieldset><legend>지금 몸 상태는 어떤가요?</legend>
        <label><input type="radio" name="next-body-check" checked={check === "NO_KNOWN_RISK"}
          onChange={() => setCheck("NO_KNOWN_RISK")} />알고 있는 통증이나 이상이 없어요</label>
        <label><input type="radio" name="next-body-check" checked={check === "REVIEW_REQUIRED"}
          onChange={() => setCheck("REVIEW_REQUIRED")} />통증·이상이 있거나 잘 모르겠어요</label>
      </fieldset>
      <label htmlFor="adjusted-next-record">추천 페이스에 사용할 경기 기록</label>
      <select id="adjusted-next-record" value={recordId} onChange={event => setRecordId(event.target.value)}>
        <option value="">기록을 사용하지 않음</option>
        {records.map(record => <option key={record.id} value={record.id}>{record.eventDistanceM}m · {record.performanceSeconds}초</option>)}
      </select>
      <p>선택한 기록도 날짜·종목·출처를 다시 확인해요. 확인되지 않으면 개인 페이스를 만들지 않아요.</p>
      <button type="submit" disabled={check === null}><ArrowRight size={18} aria-hidden="true" />다음 계획 비교하기</button>
    </form> : <>
      <p>{draft.continuity.nextStartDate} 시작 · 이전 주기에서 미기록 {draft.continuity.missingRequiredOutcomes}회</p>
      <button type="button" onClick={() => { setDraft(null); setError(null) }}><ArrowLeft size={18} aria-hidden="true" />시작일·기록 다시 선택</button>
      {draft.draft.generated.candidates.map(candidate => {
        const label = candidateLabel(candidate.kind, candidate.selectedEnergyIntent)
        return <section key={candidate.candidateId} aria-label={label.title} className="adjusted-next-candidate">
          <h2>{label.title}</h2><p>{label.detail}</p>
          <p>{candidateSharedSessionSummary(candidate)}</p><p>{candidateDurationSummary(candidate)}</p>
          <details><summary>날짜별 훈련 확인</summary>{candidate.sessions.map(session => <section key={`${session.day}-${session.slot}`}>
            <h3>{isoShift(draft.continuity.nextStartDate, session.day - 1)} · {session.slot === "AM" ? "오전" : "오후"}</h3>
            <AdjustedJournalOriginalPlan session={session} explanation={loaded.explanation} context="preview" />
          </section>)}</details>
          <button type="button" onClick={() => openEditor(candidate.candidateId)} disabled={!adjustmentResolver}>
            <SlidersHorizontal size={18} aria-hidden="true" />{label.title} 조정하기</button>
        </section>
      })}
      {!adjustmentResolver && <p role="status">다음 계획의 조정 기능은 검토된 구성 연결을 준비 중이에요. 비교해도 현재 계획은 바뀌지 않아요.</p>}
    </>}
    {error && <p role="alert">{error}</p>}
  </section>
}
