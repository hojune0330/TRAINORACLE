import React from "react"
import type { PlanBetaIntake } from "../../domain/plan-beta-store"
import { planBetaStateV3Schema, type PlanBetaStateV3 } from "../../domain/plan-beta-schema"
import { evaluatePlanSafety, generateReplacementPlanFromDraft, selectPlanForActivation, type PlanDraftGeneration } from "../../domain/plan-beta-flow"
import { loadEntriesForPlanSafety, todayISO } from "../../domain/journal-store"
import { activePlanEditEvidenceFingerprint } from "../../domain/active-plan-edit"
import { replaceActivePlanWithDraft } from "../../domain/active-plan-edit-store"
import { planAnchorsStillCurrent } from "../../domain/plan-anchor-reconfirmation"
import { PlanRefinePanel } from "./PlanRefinePanel"
import { PlanIntake, type IntakeStep } from "./PlanIntake"
import { eventGroupForDistance } from "./plan-intake-navigation"
import { planErrorMessage } from "./plan-feedback"
import { PlanSchedulePreview } from "./PlanSchedulePreview"
import { candidateLabel } from "./labels"
import { resolveDetailedPlanTemplateOptions } from "./plan-template-options"
import { usePlanDraftNavigationGuard } from "./usePlanDraftNavigationGuard"
import { onLocalJournalScopeChange } from "../../domain/account/local-journal-ownership"
import { recheckStoredDetailedPrescriptionAuthority } from "../../domain/plan-session-schema"
import { isValidIsoDate } from "../../domain/dates"

type Generated = Extract<PlanDraftGeneration, { kind: "generated" }>

/** New-plan drafts do not clear/archive the active plan until explicit acceptance. */
export function ActivePlanRebuildEditor({ state, onCancel, onApplied, onManageRecords }: {
  state: PlanBetaStateV3; onCancel: () => void; onApplied: (state: PlanBetaStateV3) => void; onManageRecords?: () => void;
}) {
  const [draft, setDraft] = React.useState<PlanBetaIntake>(() => ({ ...state.intake, startDate: todayISO() }))
  const [step, setStep] = React.useState<IntakeStep | null>(null)
  const [noRisk, setNoRisk] = React.useState(false)
  const [generated, setGenerated] = React.useState<Generated | null>(null)
  const [candidateId, setCandidateId] = React.useState<string | null>(null)
  const [message, setMessage] = React.useState("")
  const [recordReviewNeeded, setRecordReviewNeeded] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  const [uncertain, setUncertain] = React.useState(false)
  const [raceDate, setRaceDate] = React.useState("")
  const [evidenceFingerprint, setEvidenceFingerprint] = React.useState("")
  const heading = React.useRef<HTMLHeadingElement>(null)
  React.useLayoutEffect(() => { heading.current?.focus() }, [])
  const revision = React.useRef(0)
  const alive = React.useRef(true)
  const scopeInvalid = React.useRef(false)
  const stateFingerprint = JSON.stringify(state)
  const previousStateFingerprint = React.useRef(stateFingerprint)
  React.useEffect(() => {
    alive.current = true
    const stop = onLocalJournalScopeChange(() => { scopeInvalid.current = true; revision.current += 1; setGenerated(null); setNoRisk(false); setRecordReviewNeeded(false); setMessage("계정이 바뀌었어요. 현재 계획을 다시 열어 주세요.") })
    return () => { alive.current = false; revision.current += 1; stop() }
  }, [])
  usePlanDraftNavigationGuard(true)
  const invalidate = () => { revision.current += 1; setGenerated(null); setCandidateId(null); setMessage(""); setRecordReviewNeeded(false) }
  const update = (next: PlanBetaIntake) => { invalidate(); setDraft(next); setStep(null) }
  React.useEffect(() => {
    // A refreshed active plan is a new editing context; never apply a draft based on the old one.
    if (previousStateFingerprint.current === stateFingerprint) return
    previousStateFingerprint.current = stateFingerprint
    revision.current += 1
    setGenerated(null)
    setCandidateId(null)
    setNoRisk(false)
    setRecordReviewNeeded(false)
    setEvidenceFingerprint("")
    setMessage("현재 계획이 바뀌었어요. 최신 계획을 다시 확인해 주세요.")
  }, [stateFingerprint])
  const sourceAnchor = state.activePlan.sessions.find(s => s.prescription.kind === "PACE_TARGET")
  const recordId = sourceAnchor?.prescription.kind === "PACE_TARGET" ? sourceAnchor.prescription.selectedAnchor.anchorId : undefined
  const reuseSourceAnchor = draft.selectedDetailedTemplateRef !== null && draft.eventDistanceM === state.intake.eventDistanceM && sourceAnchor !== undefined
  const generate = () => {
    invalidate()
    if (!noRisk || scopeInvalid.current) { setMessage("지금 몸 상태를 확인해 주세요."); return }
    const today = todayISO()
    const startDate = draft.startDate
    if (!startDate || !isValidIsoDate(startDate) || !isValidIsoDate(today) || startDate < today) {
      setMessage("새 계획의 시작 날짜를 오늘 또는 이후 날짜로 선택해 주세요.")
      return
    }
    const safety = evaluatePlanSafety("NO_KNOWN_RISK", new Date())
    // A newly selected effort-only plan does not reuse the old plan's pace evidence.
    const anchorCurrent = !reuseSourceAnchor || sourceAnchor !== undefined
      && safety.kind === "passed" && recheckStoredDetailedPrescriptionAuthority({ operation: "START",
        prescription: sourceAnchor.prescription, evaluatedAt: new Date().toISOString(), safetyGate: safety.gate }).kind === "permitted"
    if (!anchorCurrent) {
      setRecordReviewNeeded(true)
      setMessage("현재 계획의 기준 기록을 확인할 수 없어요. 기록을 다시 확인한 뒤 새 계획을 만들어 주세요.")
      return
    }
    const read = loadEntriesForPlanSafety()
    if (read.status !== "complete") { setMessage("기록을 모두 불러온 뒤 새 계획을 만들 수 있어요."); return }
    const result = generateReplacementPlanFromDraft({ ...draft, startDate, ...(raceDate ? { targetRaceDate: raceDate } : {}) }, "NO_KNOWN_RISK",
      reuseSourceAnchor && recordId ? { selectedRecordId: recordId } : undefined)
    if (result.kind === "generated") {
      if (draft.selectedDetailedTemplateRef && result.prescriptionBinding.kind !== "bound") {
        setRecordReviewNeeded(true)
        setMessage("선택한 상세 훈련에 쓸 현재 경기 기록을 먼저 확인해 주세요."); return
      }
      setGenerated(result); setCandidateId(result.generated.candidates[0]?.candidateId ?? null)
      setEvidenceFingerprint(activePlanEditEvidenceFingerprint(read.entries))
    } else setMessage(result.kind === "preview_only" ? "대회 날짜를 포함한 계획은 아직 저장할 수 없어요. 날짜 없는 새 계획안은 만들 수 있어요."
      : result.kind === "blocked" ? "몸 상태나 기록 확인이 먼저예요. 기존 계획은 그대로예요." : planErrorMessage(result.code))
  }
  const apply = async () => {
    if (!generated || !candidateId || busy || uncertain || !noRisk || scopeInvalid.current) return
    const candidate = generated.generated.candidates.find(c => c.candidateId === candidateId)
    if (!candidate || !planAnchorsStillCurrent(candidate, new Date())) { setMessage("기준 기록이 바뀌었어요. 새 계획안을 다시 확인해 주세요."); return }
    const selected = selectPlanForActivation(candidateId, generated.generated, generated.gate, { ...generated.intake, startDate: draft.startDate }, generated.athleteEvidence)
    if (selected.kind !== "selected") { setMessage(planErrorMessage(selected.code)); return }
    const parsed = planBetaStateV3Schema.safeParse(selected.state)
    if (!parsed.success) { setMessage("새 계획안 저장 형식을 확인하지 못했어요."); return }
    const openingRevision = revision.current
    setBusy(true); setMessage("")
    try {
      const result = await replaceActivePlanWithDraft({ before: state, after: parsed.data, evidenceFingerprint,
        confirmsNoKnownRisk: noRisk, freshDraft: () => alive.current && !scopeInvalid.current && openingRevision === revision.current
          && planAnchorsStillCurrent(candidate, new Date()) })
      if (!alive.current) return
      if (result.kind === "applied") onApplied(result.state)
      else { setMessage(result.message); setUncertain(result.kind === "uncertain") }
    } catch {
      if (alive.current) {
        setMessage("저장 결과를 확인하지 못했어요. 다시 적용하지 말고 현재 계획을 확인해 주세요.")
        setUncertain(true)
      }
    } finally { if (alive.current) setBusy(false) }
  }
  if (step) return <PlanIntake step={step} draft={draft} refining onBack={() => setStep(null)}
    onGoal={eventDistanceM => update({ ...draft, eventDistanceM, eventGroup: eventGroupForDistance(eventDistanceM),
      selectedDetailedTemplateRef: draft.eventDistanceM === eventDistanceM ? draft.selectedDetailedTemplateRef : null })}
    onDivision={competitionDivision => update({ ...draft, competitionDivision })}
    onExperience={experienceBand => update({ ...draft, experienceBand })}
    onFocus={trainingFocus => update({ ...draft, trainingFocus, selectedDetailedTemplateRef: null })}
    onTemplate={selectedDetailedTemplateRef => update({ ...draft, selectedDetailedTemplateRef })}
    onDays={availableDayCount => update({ ...draft, availableDayCount })}
    onFrameLength={requestedFrameLength => update({ ...draft, requestedFrameLength })}
    onTrainingTime={trainingTimePreference => update({ ...draft, trainingTimePreference })}
    onSecondSession={secondSessionMode => update({ ...draft, secondSessionMode })}
    targetRaceDate={raceDate} onTargetRaceDateChange={value => { invalidate(); setRaceDate(value) }}
    onRaceDate={value => { invalidate(); setRaceDate(value ?? ""); setStep(null) }}
    onManageRecords={() => { setStep(null); if (onManageRecords) onManageRecords(); else setMessage("기준 기록은 기록 화면에서 먼저 확인해 주세요. 기존 계획은 그대로예요.") }} onOpenNotationReader={() => { setStep(null); setMessage("훈련표 표기는 계획의 자세히 보기에서 확인할 수 있어요.") }}
    onSafety={check => { invalidate(); setNoRisk(check === "NO_KNOWN_RISK"); setStep(null) }} onContinue={() => setStep(null)} />
  const candidate = generated?.generated.candidates.find(c => c.candidateId === candidateId)
  return <section className="active-plan-edit-hub" role="region" aria-labelledby="active-plan-rebuild-heading">
    <header className="active-plan-edit-hub__header"><h2 id="active-plan-rebuild-heading" ref={heading} tabIndex={-1}>새 계획 만들기</h2><button type="button" disabled={busy} onClick={onCancel}>취소</button></header>
    <p>기존 조건을 가져왔어요. 바꿀 항목만 고르세요. 적용 전까지 지금 계획과 일지는 그대로예요.</p>
    <label>시작 날짜<input type="date" required value={draft.startDate ?? ""} disabled={busy || uncertain}
      min={todayISO()} onChange={e => update({ ...draft, startDate: e.target.value })} /></label>
    <PlanRefinePanel intake={draft} targetRaceDate={raceDate} detailedTemplateAvailable={resolveDetailedPlanTemplateOptions(draft).length > 0}
      onRefine={next => { if (!busy && !uncertain) setStep(next) }} />
    {raceDate && <div role="status">
      <p>대회 날짜가 포함된 새 계획은 현재 미리보기까지만 지원해요. 날짜를 빼면 새 계획을 확인하고 적용할 수 있어요.</p>
      <button type="button" disabled={busy || uncertain} onClick={() => { invalidate(); setRaceDate("") }}>대회 날짜 없이 만들기</button>
    </div>}
    <label><input type="checkbox" checked={noRisk} disabled={busy || uncertain} onChange={e => { invalidate(); setNoRisk(e.target.checked) }} />지금 통증이나 몸 상태 이상이 없어요</label>
    <button type="button" disabled={!noRisk || busy || uncertain} onClick={generate}>새 계획안 보기</button>
    {generated && <>
      <label>훈련 구성<select value={candidateId ?? ""} disabled={busy || uncertain} onChange={e => setCandidateId(e.target.value)}>
        {generated.generated.candidates.map(c => <option key={c.candidateId} value={c.candidateId}>{candidateLabel(c.kind, c.selectedEnergyIntent, true).title}</option>)}
      </select></label>
      {candidate && <PlanSchedulePreview sessions={candidate.sessions} startDate={draft.startDate ?? todayISO()} frameLengthDays={draft.requestedFrameLength} />}
      <p>새 계획으로 시작하면 현재 계획의 원본과 진행 기록은 이전 계획에 보관해요.</p>
      <button type="button" disabled={busy || uncertain || !noRisk} onClick={() => void apply()}>{busy ? "새 계획 저장 중" : "이 새 계획으로 시작"}</button>
    </>}
    {message && <p role="alert">{message}</p>}
    {recordReviewNeeded && onManageRecords && <button type="button" disabled={busy || uncertain} onClick={() => { invalidate(); onManageRecords() }}>기준 기록 확인하기</button>}
  </section>
}
