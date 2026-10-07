import React from "react"
import { Shuffle } from "lucide-react"
import { ALL_WORKOUT_CATALOG, calculateCatalogWorkout, type WorkoutCalculationInputs } from "@impl/prescription/all-workout-calculator"
import { catalogRecommendationMethodKey, drawUnseenCatalogMethod, groupEligibleCatalogMethods } from "@impl/prescription/catalog-method-selection"
import { bindCatalogSession, catalogFamilyForIntent, catalogRpe } from "@impl/prescription/catalog-session-binding"
import type { PlanGenerationSuccess } from "@impl/plan-generator/types"
import type { PlanBetaIntake } from "../../domain/plan-beta-store"
import type { AthleteRecord } from "../../domain/athlete-records"
import { formatRecordTime } from "../../domain/athlete-record-display"
import { todayISO } from "../../domain/journal-store"
import { replaceCandidateCatalogWorkout } from "../../domain/catalog-plan-binding"
import { findCatalogConditionReview, type CatalogConditionRequest } from "../../domain/catalog-condition-review"
import { isValidIsoDate, isoShift } from "../../domain/dates"
import { localAccountScopeIsCurrent, localAccountScopeSnapshot } from "../../domain/account/local-account-scope"
import { catalogRequirementLabels as requirementLabels, catalogScheduleConditions, isCatalogEnvironmentRequirement } from "../../domain/catalog-schedule-conditions"
import { CatalogWorkoutDetail } from "./CatalogWorkoutDetail"
import { formatTotalMinutes } from "./labels"
import "./catalog-workout.css"
import { CatalogPaceReferences } from "./CatalogPaceReferences"
import { canonicalPaceDistance, type SegmentPaceReference } from "@impl/prescription/record-pace"

type PickerProps = {
  readonly generated: PlanGenerationSuccess; readonly intake: PlanBetaIntake; readonly records: readonly AthleteRecord[]
  readonly onChange: (next: PlanGenerationSuccess, reviewedAddress?: { day: number; slot: "AM" | "PM" }) => void; readonly disabled?: boolean
  readonly onPendingChange?: (pending: boolean) => void
  readonly openRequest?: number | null
  readonly conditionRequest?: CatalogConditionRequest | null
  readonly startDate?: string
  readonly reviewedConditionKeys?: readonly string[]
  readonly inline?: boolean
}
export type CatalogWorkoutEditorProps = Omit<PickerProps, "generated" | "onChange"> & {
  readonly generated?: PlanGenerationSuccess
  readonly onChange?: (next: PlanGenerationSuccess) => void
  readonly onSelect?: (id: string, inputs: WorkoutCalculationInputs, acceptLonger: boolean, acceptStronger: boolean) => void
  readonly canSelect?: (id: string, inputs: WorkoutCalculationInputs, acceptLonger: boolean, acceptStronger: boolean) => boolean
  readonly preferredCatalogId?: string | null
  readonly environmentReviewRequired?: boolean
  readonly onDraftChange?: () => void
  readonly selectionMode?: "DRAFT" | "SAVED_PLAN"
  readonly applyDisabled?: boolean
  readonly session: PlanGenerationSuccess["candidates"][number]["sessions"][number]
  readonly onCancel: () => void
  readonly drawHistory: Map<string, Set<string>>
}
export function CatalogWorkoutPicker(props: PickerProps) {
  const { generated, disabled = false } = props
  const sessions = generated.candidates[0].sessions.filter(s => s.role !== "REST" && s.prescription.kind === "RPE_TIME_RANGE")
  const first = sessions.find(s => s.role === "QUALITY") ?? sessions[0]
  const [address, setAddress] = React.useState(first ? `${first.day}:${first.slot}` : "")
  const [message, setMessage] = React.useState("")
  const [pending, setPending] = React.useState(false)
  const [resetRevision, setResetRevision] = React.useState(0)
  const [preferredReview, setPreferredReview] = React.useState<CatalogConditionRequest | null>(null)
  const handledConditionRequest = React.useRef<CatalogConditionRequest | null>(null)
  const panelRef = React.useRef<HTMLDetailsElement>(null)
  const drawHistory = React.useRef(new Map<string, Set<string>>())
  React.useEffect(() => {
    if (props.openRequest != null && panelRef.current) panelRef.current.open = true
  }, [props.openRequest])
  React.useEffect(() => {
    const request = props.conditionRequest
    if (!request || request === handledConditionRequest.current) return
    handledConditionRequest.current = request
    if (disabled || pending || request.startDate !== props.startDate || !localAccountScopeIsCurrent(request.accountScope)) return
    const current = findCatalogConditionReview(generated, props.intake)
    if (!current || current.pairId !== request.pairId || current.day !== request.day
      || current.slot !== request.slot || current.catalogId !== request.catalogId || current.catalogFingerprint !== request.catalogFingerprint) return
    setAddress(`${request.day}:${request.slot}`)
    setPreferredReview(request)
    setResetRevision(value => value + 1)
    setMessage("")
    if (panelRef.current) panelRef.current.open = true
  }, [props.conditionRequest, props.startDate, generated, props.intake, disabled, pending])
  const handlePendingChange = React.useCallback((value: boolean) => {
    setPending(value)
    props.onPendingChange?.(value)
  }, [props.onPendingChange])
  const session = sessions.find(s => `${s.day}:${s.slot}` === address) ?? first
  if (!session || session.prescription.kind !== "RPE_TIME_RANGE") return null
  const actualAddress = `${session.day}:${session.slot}`
  const content = <>
    <label>바꿀 일정<select value={actualAddress} disabled={disabled || pending} onChange={e => { setAddress(e.target.value); setPreferredReview(null); setMessage("") }}>
      {sessions.map(s => <option key={`${s.day}:${s.slot}`} value={`${s.day}:${s.slot}`}>{props.startDate && isValidIsoDate(props.startDate)
        ? `${isoShift(props.startDate, s.day - 1)} · ` : ""}{s.day}일차 {s.slot === "AM" ? "오전" : "오후"}</option>)}
    </select></label>
    {pending && <small>변경을 적용하거나 취소하면 다른 날짜를 고를 수 있어요.</small>}
    <CatalogWorkoutEditor key={`${generated.pairId}:${actualAddress}:${resetRevision}`} {...props} session={session}
      environmentReviewRequired={props.reviewedConditionKeys === undefined || props.startDate === undefined ? undefined
        : catalogScheduleConditions(generated, props.startDate, localAccountScopeSnapshot()).some(condition =>
          condition.day === session.day && condition.slot === session.slot && !props.reviewedConditionKeys!.includes(condition.key))}
      preferredCatalogId={preferredReview?.pairId === generated.pairId && `${preferredReview.day}:${preferredReview.slot}` === actualAddress
        && preferredReview.startDate === props.startDate && localAccountScopeIsCurrent(preferredReview.accountScope) ? preferredReview.catalogId : null}
      drawHistory={drawHistory.current}
      onPendingChange={handlePendingChange}
      onCancel={() => { setResetRevision(n => n + 1); setMessage("") }}
      onChange={next => { props.onChange(next, { day: session.day, slot: session.slot }); setResetRevision(value => value + 1); setMessage("계획안에 반영했어요. 날짜와 훈련 횟수는 그대로예요.") }} />
    {message && <p role="status">{message}</p>}
  </>
  return props.inline ? <section className="catalog-workout-picker" aria-label="다른 훈련으로 바꾸기">{content}</section>
    : <details ref={panelRef} className="plan-session-guidance catalog-workout-picker">
      <summary>다른 훈련으로 바꾸기</summary>{content}
    </details>
}

export function CatalogWorkoutEditor({ generated, intake, records, onChange, onSelect, canSelect, onDraftChange, applyDisabled,
  onPendingChange, session, onCancel, drawHistory, preferredCatalogId, startDate, environmentReviewRequired, selectionMode, disabled = false }: CatalogWorkoutEditorProps) {
  const editingSavedPlan = !generated && selectionMode !== "DRAFT"
  const binding = session.prescription.kind === "RPE_TIME_RANGE" ? session.prescription.catalogWorkout : undefined
  const pool = ALL_WORKOUT_CATALOG.filter(e => e.family === catalogFamilyForIntent(session.plannedEnergyIntent)
    && e.eventDistances.some(distance => canonicalPaceDistance(distance) === canonicalPaceDistance(intake.eventDistanceM))
    && e.experience.includes(intake.experienceBand) && e.hold === null)
    .filter(e => {
      if (session.role !== "EASY" || session.prescription.kind !== "RPE_TIME_RANGE") return true
      const workout = calculateCatalogWorkout(e.id, { eventDistanceM: intake.eventDistanceM, experience: intake.experienceBand,
        availableSeconds: null, confirmedRequirements: [], segmentPaces: [], fiveK: null })
      return workout && catalogRpe(workout).maximum <= (binding?.originalEnvelope.rpe.maximum ?? session.prescription.rpe.maximum)
    })
  const [choice, setChoice] = React.useState(binding?.catalogId ?? pool.find(e => e.id === preferredCatalogId)?.id ?? pool[0]?.id ?? "")
  const [recordId, setRecordId] = React.useState(binding?.inputs.fiveK?.recordId ?? "")
  const [paceReferences, setPaceReferences] = React.useState<readonly SegmentPaceReference[] | undefined>(binding?.inputs.paceReferences)
  const accountScope = localAccountScopeSnapshot()
  const [seconds, setSeconds] = React.useState<Record<string, string>>(() => Object.fromEntries((binding?.inputs.segmentSeconds ?? []).map(s => [s.segmentId, String(s.seconds)])))
  const [recoveries, setRecoveries] = React.useState<Record<string, string>>(() => Object.fromEntries((binding?.inputs.recoverySeconds ?? []).map(s => [s.segmentId, String(s.seconds)])))
  const [durationDecision, setDurationDecision] = React.useState<{ key: string; accepted: boolean } | null>(null)
  const draft = JSON.stringify([choice, recordId, seconds, recoveries, paceReferences])
  const originalDraft = React.useRef(draft)
  const confirmationContext = JSON.stringify([startDate ?? null, accountScope, session.day, session.slot,
    binding?.calculationFingerprint ?? null, intake.eventDistanceM, intake.experienceBand, draft])
  const [confirmation, setConfirmation] = React.useState(() => ({
    context: confirmationContext, requirements: [...(binding?.inputs.confirmedRequirements ?? [])]
      .filter(requirement => !environmentReviewRequired || !isCatalogEnvironmentRequirement(requirement)),
    userEdited: false, needsRecheck: environmentReviewRequired === true,
  }))
  // Revoke the answer on a context change, rather than hiding it until an old date returns.
  if (confirmation.context !== confirmationContext) setConfirmation({ ...confirmation, context: confirmationContext,
    requirements: confirmation.requirements.filter(requirement => !isCatalogEnvironmentRequirement(requirement)),
    needsRecheck: confirmation.needsRecheck || confirmation.requirements.some(isCatalogEnvironmentRequirement),
  })
  const configurationChanged = draft !== originalDraft.current || confirmation.userEdited
  const parentReviewedBinding = !!binding && !configurationChanged && environmentReviewRequired === false
  const confirmed = parentReviewedBinding ? [...binding.inputs.confirmedRequirements]
    : confirmation.context === confirmationContext ? confirmation.requirements
      : confirmation.requirements.filter(requirement => !isCatalogEnvironmentRequirement(requirement))
  const setConfirmed = (requirements: string[]) => setConfirmation({ context: confirmationContext, requirements, userEdited: true, needsRecheck: false })
  const environmentDateChanged = confirmation.needsRecheck && !parentReviewedBinding
  const [acceptStronger, setAcceptStronger] = React.useState(false)
  const calculationDraft = JSON.stringify([draft, confirmed, confirmationContext])
  const decisionDraft = JSON.stringify([calculationDraft, durationDecision, acceptStronger])
  const reportedDraft = React.useRef(decisionDraft)
  const pending = configurationChanged || durationDecision !== null
  React.useEffect(() => { setAcceptStronger(false) }, [calculationDraft])
  React.useEffect(() => { onPendingChange?.(pending) }, [pending, onPendingChange])
  React.useEffect(() => {
    if (reportedDraft.current === decisionDraft) return
    reportedDraft.current = decisionDraft
    onDraftChange?.()
  }, [decisionDraft, onDraftChange])
  React.useEffect(() => () => onPendingChange?.(false), [onPendingChange])
  const entry = pool.find(e => e.id === choice)
  if (session.prescription.kind !== "RPE_TIME_RANGE") return null
  if (!entry) return <p role="status">{pool.length === 0
    ? "이 종목·경험 수준에 맞는 대체 훈련이 아직 없어요. 현재 훈련은 그대로예요."
    : "이 구성은 현재 조건에서 고를 수 없어요. 현재 훈련은 그대로예요. 다른 날짜를 확인해 주세요."}</p>
  const pairedPrescriptions = generated?.candidates.flatMap(candidate => {
    const target = candidate.sessions.find(s => s.day === session.day && s.slot === session.slot)
    return target?.prescription.kind === "RPE_TIME_RANGE" ? [target.prescription] : []
  }) ?? [session.prescription]
  const pairedBudgetSeconds = Math.min(...pairedPrescriptions.map(p =>
    (p.catalogWorkout?.originalEnvelope.durationMinutes.maximum ?? p.durationMinutes.maximum) * 60))
  const record = records.find(r => r.id === recordId && r.eventDistanceM === 5000 && r.purpose !== "RACE_GOAL" && r.verificationState !== "UNVERIFIED")
  const inputs: WorkoutCalculationInputs = { eventDistanceM: intake.eventDistanceM, experience: intake.experienceBand,
    availableSeconds: pairedBudgetSeconds,
    confirmedRequirements: confirmed, segmentPaces: choice === binding?.catalogId
      ? binding.inputs.segmentPaces.filter(p => !paceReferences?.some(r => r.segmentId === p.segmentId)) : [],
    fiveK: !configurationChanged && binding?.inputs.fiveK ? binding.inputs.fiveK
      : record?.achievedOn ? { recordId: record.id, seconds: record.performanceSeconds, achievedAt: record.achievedOn, evaluatedAt: todayISO() } : null,
    segmentSeconds: Object.entries(seconds).filter(([, v]) => v !== "").map(([segmentId, v]) => ({ segmentId, seconds: Number(v) })),
    recoverySeconds: Object.entries(recoveries).filter(([, v]) => v !== "").map(([segmentId, v]) => ({ segmentId, seconds: Number(v) })),
    ...(paceReferences === undefined ? {} : { paceReferences }),
  }
  const preview = calculateCatalogWorkout(entry.id, inputs)
  const withoutTimes = calculateCatalogWorkout(entry.id, { ...inputs, segmentSeconds: [], recoverySeconds: [] })
  const missing = withoutTimes?.steps.filter(s => s.seconds === null).filter((s, i, all) => all.findIndex(x => x.segmentId === s.segmentId) === i) ?? []
  const durationKey = preview?.totals.seconds ? `${entry.id}:${preview.fingerprint}` : null
  const currentSessionMaximum = session.prescription.durationMinutes.maximum
  const originalMaximum = binding?.originalEnvelope.durationMinutes.maximum ?? currentSessionMaximum
  const activeConsentLimit = Math.min(currentSessionMaximum, originalMaximum) * 60
  const longer = preview?.totals.seconds && preview.totals.seconds.maximum > (editingSavedPlan ? activeConsentLimit : inputs.availableSeconds!)
  const acceptLonger = longer && durationKey !== null && (durationDecision?.key === durationKey
    ? durationDecision.accepted
    : durationDecision === null && !!generated && !configurationChanged && pairedPrescriptions.every(p => preview.totals.seconds!.maximum
      <= (p.catalogWorkout?.originalEnvelope.durationMinutes.maximum ?? p.durationMinutes.maximum) * 60
      || p.catalogWorkout?.acceptedDurationSeconds === preview.totals.seconds!.maximum))
  const unavailable = preview?.unavailable.filter(code => code !== "TIME_BUDGET_EXCEEDED" || !acceptLonger) ?? []
  const next = preview && generated ? replaceCandidateCatalogWorkout(generated, session, entry.id, inputs, !!acceptLonger) : null
  const nextRpe = preview?.steps.some(s => s.phase === "main" && s.kind === "WORK") ? catalogRpe(preview) : null
  const stronger = nextRpe && nextRpe.maximum > session.prescription.rpe.maximum
  const acceptedStronger = !stronger || !editingSavedPlan || acceptStronger
  const canApply = generated ? next !== null : !!preview && !!onSelect
    && bindCatalogSession(session, entry.id, inputs, !!acceptLonger) !== null
    && (!longer || !!acceptLonger)
    && acceptedStronger
    && (canSelect?.(entry.id, inputs, !!acceptLonger, !!stronger) ?? false)
  const eligibleDraws = pool.filter(e => {
    const immediateInputs = { ...inputs, confirmedRequirements: [], segmentPaces: [], segmentSeconds: [], recoverySeconds: [], paceReferences: [] }
    const calculation = calculateCatalogWorkout(e.id, immediateInputs)
    return calculation !== null && calculation.unavailable.length === 0
      && (generated ? replaceCandidateCatalogWorkout(generated, session, e.id, immediateInputs) !== null
        : bindCatalogSession(session, e.id, immediateInputs) !== null && (canSelect?.(e.id, immediateInputs, false, false) ?? false))
  })
  const alternatives = [...groupEligibleCatalogMethods(eligibleDraws).keys()].filter(key => key !== catalogRecommendationMethodKey(entry))
  const drawScope = JSON.stringify([session.day, session.slot, intake.eventDistanceM, intake.experienceBand,
    inputs.availableSeconds, inputs.fiveK, eligibleDraws.map(e => e.id)])
  const reset = (id: string) => { setChoice(id); setConfirmed([]); setSeconds({}); setRecoveries({}); setPaceReferences(undefined); setDurationDecision(null) }
  const reason = (code: string) => requirementLabels[code] ? "운동 환경·경험 확인이 필요해요."
    : code === "TIME_BUDGET_EXCEEDED" ? "처음 계획보다 긴 구성이에요. 아래에서 시간을 확인하거나 다른 구성을 골라 주세요."
      : code === "TIME_BUDGET_UNCONFIRMED" ? "미정 구간을 정하면 전체 시간을 계산해요."
        : code === "EXPERIENCE_SCOPE" ? "현재 선택한 훈련 경험에 맞는 다른 구성을 골라 주세요." : "현재 계획의 조건에 맞지 않는 구성이에요."
  return <div className="catalog-workout-picker__editor">
    <button type="button" disabled={disabled || alternatives.length === 0} onClick={() => {
      if (!alternatives.length) return
      const result = drawUnseenCatalogMethod(eligibleDraws, entry, drawHistory.get(drawScope) ?? new Set())
      if (!result) return
      drawHistory.set(drawScope, new Set(result.seen))
      reset(result.entry.id)
    }}><Shuffle size={17} aria-hidden="true" /> 같은 목적의 다른 훈련</button>
    {alternatives.length === 0 && <p>지금 바로 바꿀 수 있는 다른 구성이 없어요. 아래 목록에서는 필요한 조건을 확인하고 직접 고를 수 있어요.</p>}
    <label>훈련 구성<select value={entry.id} disabled={disabled} onChange={e => reset(e.target.value)}>
      {pool.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
    </select></label>
    {["LT", "VO2", "MIX"].includes(entry.family) && <details><summary>전체 구간의 공통 기록 바꾸기</summary><label>참고 페이스에 사용할 5km 기록<select value={recordId} disabled={disabled} onChange={e => { setRecordId(e.target.value); setPaceReferences([]); setSeconds({}); setDurationDecision(null) }}>
      <option value="">기록 없이 체감 강도로</option>
      {recordId && !record && <option value={recordId}>이 계획에 저장된 기준 기록</option>}
      {records.filter(r => r.eventDistanceM === 5000 && r.purpose !== "RACE_GOAL" && r.verificationState !== "UNVERIFIED").map(r => <option key={r.id} value={r.id}>{r.achievedOn} · {formatRecordTime(r.performanceSeconds)}</option>)}
    </select></label><p>구간별로 고른 기준은 해제되고, 적용 가능한 구간에 이 기록을 사용해요.</p></details>}
    <CatalogPaceReferences catalogId={entry.id} inputs={inputs} records={records} disabled={disabled} onChange={(segmentId, value) => {
      setPaceReferences(previous => [...(previous ?? []).filter(r => r.segmentId !== segmentId), ...(value ? [value] : [])])
      setSeconds(previous => Object.fromEntries(Object.entries(previous).filter(([key]) => key !== segmentId)))
      setDurationDecision(null)
    }} />
    {entry.requirements.map(r => <label key={r}><input type="checkbox" checked={confirmed.includes(r)} disabled={disabled}
      onChange={e => setConfirmed(e.target.checked ? [...confirmed, r] : confirmed.filter(x => x !== r))} />{requirementLabels[r] ?? "별도 운동 조건을 확인해 주세요."}</label>)}
    {environmentDateChanged && <p role="status">날짜나 훈련 조건을 다시 확인해야 해요. 입력한 시간은 그대로 남아 있어요.</p>}
    {missing.length > 0 && <fieldset className="catalog-workout-picker__required"><legend>이 훈련을 적용하려면 구간 시간을 정해 주세요</legend>
      <p>같은 구간의 반복에 적용해요. 경기 기록으로 계산할 수 없는 구간은 직접 정해요.</p>
      {missing.map(s => <label key={s.segmentId}>{s.kind === "RECOVERY" ? `회복 ${s.distanceM ? `${s.distanceM}m` : "구간"}` : `${s.distanceM}m 운동 구간`} · 초
        <input type="number" inputMode="decimal" min="0.01" max="86400" step="any" disabled={disabled}
          value={(s.kind === "RECOVERY" ? recoveries : seconds)[s.segmentId] ?? ""}
          onChange={e => { (s.kind === "RECOVERY" ? setRecoveries : setSeconds)(previous => ({ ...previous, [s.segmentId]: e.target.value })) }} />
      </label>)}
    </fieldset>}
    {preview && <CatalogWorkoutDetail workout={preview} />}
    {recordId && !record && configurationChanged && <p role="status">기준 기록을 찾을 수 없어 새 구성의 페이스 계산에 사용하지 않았어요.</p>}
    {stronger && nextRpe && (editingSavedPlan ? <label><input type="checkbox" checked={acceptStronger} disabled={disabled}
      onChange={e => setAcceptStronger(e.target.checked)} />지금 훈련 RPE {session.prescription.rpe.minimum}~{session.prescription.rpe.maximum}에서 새 훈련 RPE {nextRpe.minimum}~{nextRpe.maximum}으로 더 강해지는 변경을 확인하고 동의해요.</label>
      : <p role="status">지금 훈련 RPE {session.prescription.rpe.minimum}~{session.prescription.rpe.maximum} → 새 훈련 RPE {nextRpe.minimum}~{nextRpe.maximum}. 더 강한 구성이에요. 아래 버튼을 누르면 이 강도로 바뀌어요.</p>)}
    {longer && preview?.totals.seconds && <label><input type="checkbox" checked={!!acceptLonger} disabled={disabled}
      onChange={e => durationKey !== null && setDurationDecision({ key: durationKey, accepted: e.target.checked })} />준비·회복·정리까지 최대 {formatTotalMinutes(preview.totals.seconds.maximum / 60)} 걸려요. {generated ? "더 짧았던 계획안도 이 시간으로 바꿀게요." : currentSessionMaximum <= originalMaximum ? "현재 계획보다 긴 구성임을 확인하고 동의해요." : "처음 안내한 시간보다 긴 구성임을 확인하고 동의해요."}</label>}
    {!preview && <p role="status">입력한 시간을 확인해 주세요. 0보다 큰 초 단위 숫자로 입력해요.</p>}
    {unavailable.length ? <p role="status">{[...new Set(unavailable.map(reason))].join(" ")}</p> : null}
    {preview && !canApply && !unavailable.length && (pending || !binding) && <p role="status">이 일정에는 적용할 수 없는 구성이에요. 같은 목적의 다른 훈련을 골라 주세요.</p>}
    {preview?.unresolved.includes("RECORD_NOT_CURRENT") && <p role="status">오래된 기록이라 참고 페이스에 사용하지 않았어요.</p>}
    <div className="catalog-workout-picker__actions">
      <button type="button" disabled={disabled || applyDisabled || !canApply || !pending && !!binding} onClick={() => {
        if (disabled || applyDisabled || !canApply || !localAccountScopeIsCurrent(accountScope)
          || startDate !== undefined && !isValidIsoDate(startDate)) return
        if (next) onChange?.(next)
        else if (canApply) onSelect?.(entry.id, inputs, !!acceptLonger, !!stronger)
      }}>이 구성으로 바꾸기</button>
      {pending && <button type="button" disabled={disabled} onClick={onCancel}>변경 취소</button>}
    </div>
    {pending && <p role="status">아직 계획에 적용하지 않았어요.</p>}
  </div>
}
