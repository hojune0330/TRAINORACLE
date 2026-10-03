import React from "react"
import { ArrowLeft, ArrowRight, ListChecks } from "lucide-react"
import { generateAdjustedNextFrameV3FromDraft, type PlanCurrentCheck } from "../../domain/plan-beta-flow"
import { readPlanBetaStateFromStorage, type PlanBetaStateReadResult } from "../../domain/plan-beta-store"
import type { RetainedAdjustedPlanEvidenceV3 } from "../../domain/selected-adjusted-plan-v3"
import { localAccountScopeSnapshot } from "../../domain/account/local-account-scope"
import { useEligibleAccountPaceRecords } from "../../hooks/useEligibleAccountPaceRecords"
import { isEligiblePaceRecordCurrent } from "../../domain/account/eligible-account-pace-records"
import { todayISO } from "../../domain/journal-store"
import { isoShift } from "../../domain/dates"
import { useActiveContentScroll } from "../../hooks/useActiveContentScroll"
import { matchingAdjustmentEntryV3, type AdjustmentEntryV3, type PlanAdjustmentResolverV3 } from "./adjustment-entry-v3"
import { AdjustedPlanApplyReviewV3 } from "./AdjustedPlanApplyReviewV3"
import { AdjustedPrescriptionV3 } from "./AdjustedPrescriptionV3"
import { candidateLabel, candidateSharedSessionSummary } from "./labels"
import { planErrorMessage } from "./plan-feedback"
import "./AdjustedPlanNextFlow.css"
import { rebindAdjustedCycleRequestV3 } from "../../domain/adjusted-cycle-rebind"
import { catalogCycleDraftSourceStillCurrent } from "../../domain/catalog-cycle-draft"
import { PlanCycleEvidence } from "./PlanCycleEvidence"

type NextDraft = Extract<ReturnType<typeof generateAdjustedNextFrameV3FromDraft>, { kind: "adjusted_next_frame_v3_draft" }>
export function AdjustedPlanNextFlowV3({ loaded, resolver, readEvidence, onBack, onSaved }: {
  readonly loaded: Extract<PlanBetaStateReadResult, { kind: "adjusted_v3_loaded" }>
  readonly resolver?: PlanAdjustmentResolverV3
  readonly readEvidence: () => readonly RetainedAdjustedPlanEvidenceV3[]
  readonly onBack: () => void
  readonly onSaved: () => void
}) {
  const [account] = React.useState(localAccountScopeSnapshot), [predecessor] = React.useState(loaded.state.contentFingerprint)
  const [startDate, setStartDate] = React.useState(todayISO)
  const [check, setCheck] = React.useState<PlanCurrentCheck | null>(null)
  const [recordId, setRecordId] = React.useState("")
  const { records } = useEligibleAccountPaceRecords()
  const selectedRecord = React.useRef<(typeof records)[number] | null>(null)
  const recordCurrent = () => !recordId || selectedRecord.current?.id === recordId && isEligiblePaceRecordCurrent(selectedRecord.current)
  const [draft, setDraft] = React.useState<NextDraft | null>(null)
  const [entry, setEntry] = React.useState<AdjustmentEntryV3 | null>(null)
  const [error, setError] = React.useState<string | null>(null), mounted = React.useRef(true)
  const heading = React.useRef<HTMLHeadingElement>(null), id = React.useId()
  useActiveContentScroll(entry ? null : draft ? "v3-compare" : "v3-prepare", heading, heading)
  React.useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  const currentView = () => mounted.current && account === localAccountScopeSnapshot() && loaded.state.contentFingerprint === predecessor
  const current = () => {
    if (!currentView() || !recordCurrent()) return false
    const read = readPlanBetaStateFromStorage([], readEvidence())
    return read.kind === "adjusted_v3_loaded" && read.state.contentFingerprint === predecessor
  }
  const evidenceCurrent = () => currentView() && recordCurrent() && draft !== null
    && catalogCycleDraftSourceStillCurrent(loaded.state, draft.cycleDraft, { version: 5, retained: readEvidence() })
  if (entry !== null) return <AdjustedPlanApplyReviewV3 {...entry} expectedPredecessorFingerprint={predecessor}
    cycleDraft={draft?.cycleDraft} isCurrentDraft={evidenceCurrent} onCancel={() => setEntry(null)} onSaved={onSaved} />
  const open = (candidateId: string) => {
    if (!current()) { setError(planErrorMessage("STALE_BASE")); return }
    if (!draft || check === null) return
    const matched = matchingAdjustmentEntryV3(resolver, { ...draft.draft, currentCheck: check,
      candidateId, startDate: draft.continuity.nextStartDate })
    if (!matched) { setError("이 후보에 적용할 훈련 구성과 근거를 확인하지 못했어요. 현재 일정은 그대로예요."); return }
    const prepared = draft.detailedContinuity[draft.draft.generated.candidates.findIndex(c => c.candidateId === candidateId)]
    if (prepared?.kind !== "prepared" || !evidenceCurrent()) { setError(planErrorMessage("CYCLE_EVIDENCE_CHANGED")); return }
    const readReview = matched.readAdjustmentReview ?? (() => matched.readReview())
    const rebound = rebindAdjustedCycleRequestV3(prepared, matched.seed, readReview)
    if (rebound.kind !== "rebound") { setError("이전 수정 구성의 현재 검토 근거를 확인하지 못했어요. 다른 훈련으로 대신 저장하지 않아요."); return }
    setError(null); setEntry({ ...matched, seed: rebound.request, readReview: () => readReview(rebound.receipt) })
  }
  return <section className="adjusted-next-flow" aria-labelledby={`${id}-title`}>
    <button type="button" onClick={onBack}><ArrowLeft size={18} aria-hidden="true" />현재 일정으로</button>
    <h1 ref={heading} tabIndex={-1} id={`${id}-title`}>{draft ? "다음 계획을 비교해 주세요" : "다음 훈련 주기 준비"}</h1>
    <p>비교하는 동안 현재 일정은 그대로예요. 마지막 저장에서만 이전 원본을 보관하고 다음 일정으로 전환해요.</p>
    {draft === null ? <form onSubmit={event => {
      event.preventDefault(); setError(null)
      if (check === null) return
      if (!current()) { setError(planErrorMessage("STALE_BASE")); return }
      const generated = generateAdjustedNextFrameV3FromDraft({ draft: { ...loaded.state.selection.intake, startDate },
        currentCheck: check, expectedPredecessorFingerprint: predecessor,
        ...(recordId ? { prescriptionSelection: { selectedRecordId: recordId } } : {}) }, readEvidence())
      if (generated.kind === "adjusted_next_frame_v3_draft") setDraft(generated)
      else setError(planErrorMessage("code" in generated ? generated.code : "ADJUSTED_NEXT_FRAME_UNAVAILABLE"))
    }}>
      <label htmlFor={`${id}-date`}>다음 계획 시작일</label>
      <input id={`${id}-date`} type="date" required min={todayISO()} value={startDate} onChange={e => setStartDate(e.target.value)} />
      <fieldset><legend>지금 몸 상태는 어떤가요?</legend>
        <label><input type="radio" name={`${id}-check`} checked={check === "NO_KNOWN_RISK"}
          onChange={() => setCheck("NO_KNOWN_RISK")} />알고 있는 통증이나 이상이 없어요</label>
        <label><input type="radio" name={`${id}-check`} checked={check === "REVIEW_REQUIRED"}
          onChange={() => setCheck("REVIEW_REQUIRED")} />통증·이상이 있거나 잘 모르겠어요</label>
      </fieldset>
      <label htmlFor={`${id}-record`}>추천 페이스에 사용할 경기 기록</label>
      <select id={`${id}-record`} value={recordId} onChange={e => {
        setRecordId(e.target.value); selectedRecord.current = records.find(record => record.id === e.target.value) ?? null
      }}>
        <option value="">기록을 사용하지 않음</option>
        {records.map(r => <option key={r.id} value={r.id}>{r.eventDistanceM}m · {r.performanceSeconds}초</option>)}
      </select>
      <p>선택한 기록의 날짜·종목·출처를 다시 확인해요. 현재 사용할 수 없는 기록으로 개인 페이스를 만들지 않아요.</p>
      <button type="submit" disabled={check === null}><ArrowRight size={18} aria-hidden="true" />다음 계획 비교하기</button>
    </form> : <>
      <p>{draft.continuity.nextStartDate} 시작 · 이전 주기 미기록 {draft.continuity.missingRequiredOutcomes}회</p>
      <p>연결된 일지 {draft.cycleResponse.linkedResultCount}건 · 겹친 기록 {draft.cycleResponse.conflictCount}건 · 연결 미확인 {draft.cycleResponse.rejectedLinkCount}건</p>
      <PlanCycleEvidence response={draft.cycleResponse} />
      <p>현재 수정된 MAIN을 유지해요. 일지의 RPE를 처방 목표로 바꾸지 않아요.</p>
      <p>미기록은 완료로 계산하지 않아요. 이전 기록만으로 강도·양·횟수를 자동으로 늘리지 않아요.</p>
      <button type="button" onClick={() => { setDraft(null); setError(null) }}><ArrowLeft size={18} aria-hidden="true" />시작일·기록 다시 선택</button>
      {draft.draft.generated.candidates.map((candidate, index) => {
        const label = candidateLabel(candidate.kind, candidate.selectedEnergyIntent)
        const continuity = draft.detailedContinuity[index]
        return <section key={candidate.candidateId} aria-label={label.title} className="adjusted-next-candidate">
          <h2>{label.title}</h2><p>{label.detail}</p><p>{candidateSharedSessionSummary(candidate)}</p>
          <details><summary>날짜별 훈련 확인</summary>{candidate.sessions.map(session => <section key={`${session.day}-${session.slot}`}>
            <h3>{isoShift(draft.continuity.nextStartDate, session.day - 1)} · {session.slot === "AM" ? "오전" : "오후"}</h3>
            <AdjustedPrescriptionV3 session={continuity?.kind === "prepared"
              ? loaded.state.selection.activePlan.sessions.find(s => continuity.rows.some(r => r.target.day === session.day
                && r.target.slot === session.slot && r.source.day === s.day && r.source.slot === s.slot)) ?? session : session}
              explanation={loaded.explanation} />
          </section>)}</details>
          <button type="button" disabled={!resolver} onClick={() => open(candidate.candidateId)}>
            <ListChecks size={18} aria-hidden="true" />{label.title} 구성 확인</button>
        </section>
      })}
      {!resolver && <p role="status">검토된 상세 구성을 연결하는 중이에요. 지금은 비교만 할 수 있고 현재 일정은 유지돼요.</p>}
    </>}
    {error && <p role="alert">{error}</p>}
  </section>
}
