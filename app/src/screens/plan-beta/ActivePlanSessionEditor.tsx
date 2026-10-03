import React from "react"
import type { WorkoutCalculationInputs } from "@impl/prescription/all-workout-calculator"
import { ALL_WORKOUT_CATALOG } from "@impl/prescription/all-workout-calculator"
import type { PlanBetaStateV3 } from "../../domain/plan-beta-schema"
import type { PlanBetaIntake } from "../../domain/plan-beta-store"
import type { ActivePlanEditAction, ActivePlanEditAddress, ActivePlanEditPreparation, ActivePlanEditProposal, ActivePlanEditTarget } from "../../domain/active-plan-edit"
import type { ActivePlanEditApplyResult, ActivePlanEditSelection } from "../../domain/active-plan-edit-store"
import type { AthleteRecord } from "../../domain/athlete-records"
import { isoShift } from "../../domain/dates"
import { CatalogWorkoutEditor } from "./CatalogWorkoutPicker"
import "./ActivePlanSessionEditor.css"

export type ActivePlanSessionEditorIntent = "schedule" | "workout"

export interface ActivePlanSessionEditorProps {
  readonly state: PlanBetaStateV3
  /** Options come from the current state plus the journal-protection read. Today is included. */
  readonly sourceOptions: readonly ActivePlanEditTarget[]
  readonly entriesReady: boolean
  readonly intent: ActivePlanSessionEditorIntent
  readonly selection?: ActivePlanEditSelection
  readonly contextKey: string
  readonly onRetryEntries: () => void
  readonly onPrepare: (selection: ActivePlanEditSelection) => Promise<ActivePlanEditPreparation>
  readonly onApply: (proposal: ActivePlanEditProposal, confirmsNoKnownRisk: boolean) => Promise<ActivePlanEditApplyResult>
  readonly onClose: () => void
  readonly onApplied: (state: PlanBetaStateV3) => void
  readonly records: readonly AthleteRecord[]
  readonly disabled?: boolean
}

type CatalogChoice = Readonly<{
  catalogId: string
  inputs: WorkoutCalculationInputs
  acceptLonger: boolean
  acceptStronger: boolean
}>

const addressKey = (address: ActivePlanEditAddress) => `${address.day}:${address.slot}`
const sameAddress = (left: ActivePlanEditAddress, right: ActivePlanEditAddress) => addressKey(left) === addressKey(right)
const slotLabel = (slot: "AM" | "PM") => slot === "AM" ? "오전" : "오후"
const roleLabel = (role: string) => role === "QUALITY" ? "주요 훈련" : role === "EASY" ? "저강도 훈련" : role === "REST" ? "휴식" : "훈련"

export function ActivePlanSessionEditor({ state, sourceOptions, entriesReady, intent, selection, contextKey,
  onRetryEntries, onPrepare, onApply, onClose, onApplied, records, disabled = false }: ActivePlanSessionEditorProps) {
  const initialSource = selection?.source ?? sourceOptions[0]?.address
  const [source, setSource] = React.useState<ActivePlanEditAddress | undefined>(initialSource)
  const [action, setAction] = React.useState<Exclude<ActivePlanEditAction, "PACE_REFERENCE">>(selection?.action ?? (intent === "schedule" ? "SWAP" : "DURATION"))
  const [target, setTarget] = React.useState<ActivePlanEditAddress | undefined>(selection?.target)
  const [maximumMinutes, setMaximumMinutes] = React.useState(selection?.maximumMinutes?.toString() ?? "")
  const [catalogChoice, setCatalogChoice] = React.useState<CatalogChoice | null>(selection?.catalogId && selection.inputs
    ? { catalogId: selection.catalogId, inputs: selection.inputs, acceptLonger: !!selection.acceptLonger, acceptStronger: !!selection.acceptStronger }
    : null)
  const [sourceUnstartedConfirmed, setSourceUnstartedConfirmed] = React.useState(false)
  const [targetUnstartedConfirmed, setTargetUnstartedConfirmed] = React.useState(false)
  const [noFixedFutureCommitments, setNoFixedFutureCommitments] = React.useState(false)
  const [confirmsNoKnownRisk, setConfirmsNoKnownRisk] = React.useState(false)
  const [preparation, setPreparation] = React.useState<ActivePlanEditPreparation | null>(null)
  const [confirmedTargets, setConfirmedTargets] = React.useState<readonly ActivePlanEditTarget[]>([])
  const [busy, setBusy] = React.useState(false)
  const [uncertain, setUncertain] = React.useState(false)
  const [message, setMessage] = React.useState("")
  const [applied, setApplied] = React.useState(false)
  const [catalogEditorRevision, setCatalogEditorRevision] = React.useState(0)
  const headingRef = React.useRef<HTMLHeadingElement>(null)
  const openerRef = React.useRef<HTMLElement | null>(null)
  const requestRevision = React.useRef(0)
  const drawHistory = React.useRef(new Map<string, Set<string>>())

  React.useLayoutEffect(() => {
    const active = document.activeElement
    openerRef.current = active instanceof HTMLElement ? active : null
    headingRef.current?.focus()
    return () => openerRef.current?.focus()
  }, [])

  const stateFingerprint = JSON.stringify([state.activePlan.candidateId, state.activePlan.sessions, state.progress])
  const optionsFingerprint = JSON.stringify(sourceOptions)
  const selectionFingerprint = JSON.stringify(selection ?? null)
  React.useEffect(() => {
    requestRevision.current += 1
    setSource(selection?.source ?? sourceOptions[0]?.address)
    setAction(selection?.action ?? (intent === "schedule" ? "SWAP" : sourceOptions[0]?.actions.includes("DURATION") ? "DURATION" : "CATALOG"))
    setPreparation(null)
    setConfirmedTargets([])
    setSourceUnstartedConfirmed(false)
    setTargetUnstartedConfirmed(false)
    setNoFixedFutureCommitments(false)
    setConfirmsNoKnownRisk(false)
    setCatalogChoice(null)
    setMaximumMinutes("")
    setTarget(undefined)
    setMessage("")
    setApplied(false)
    setUncertain(false)
  }, [contextKey, stateFingerprint, optionsFingerprint, selectionFingerprint, intent])

  const selectedOption = sourceOptions.find(option => source !== undefined && sameAddress(option.address, source))
  const selectedSession = state.activePlan.sessions.find(session => source !== undefined && sameAddress(session, source))
  const selectedTargetOption = confirmedTargets.find(option => source !== undefined && sameAddress(option.address, source)) ?? selectedOption
  const swapTargets = selectedTargetOption?.swapTargets ?? []
  const isSchedule = intent === "schedule"
  const actionAllowed = action === "SWAP" ? selectedOption !== undefined : selectedOption?.actions.includes(action) ?? false
  const durationRange = selectedSession?.prescription.kind === "RPE_TIME_RANGE"
    ? selectedSession.prescription.durationMinutes : null
  const parsedMaximum = maximumMinutes.trim() === "" ? null : Number(maximumMinutes)
  const durationValid = durationRange !== null && parsedMaximum !== null && Number.isFinite(parsedMaximum)
    && parsedMaximum >= durationRange.minimum && parsedMaximum < durationRange.maximum
  const unstartedConfirmed = sourceUnstartedConfirmed && (action !== "SWAP" || target === undefined || targetUnstartedConfirmed)
  const formReady = entriesReady && !disabled && !uncertain && selectedSession !== undefined && selectedOption !== undefined
    && actionAllowed && unstartedConfirmed
    && (action !== "SWAP" || noFixedFutureCommitments && (target === undefined
      || swapTargets.some(address => sameAddress(address, target)) && targetUnstartedConfirmed))
    && (action !== "DURATION" || durationValid)
    && (action !== "CATALOG" || catalogChoice !== null)

  const invalidatePreview = () => {
    requestRevision.current += 1
    setPreparation(null)
    setConfirmsNoKnownRisk(false)
    setMessage("")
  }

  const updateSource = (key: string) => {
    const option = sourceOptions.find(item => addressKey(item.address) === key)
    if (!option) return
    setSource(option.address)
    setAction(isSchedule ? "SWAP" : option.actions.includes("DURATION") ? "DURATION" : "CATALOG")
    setTarget(undefined)
    setConfirmedTargets([])
    setCatalogChoice(null)
    setMaximumMinutes("")
    setSourceUnstartedConfirmed(false)
    setTargetUnstartedConfirmed(false)
    setNoFixedFutureCommitments(false)
    setConfirmedTargets([])
    invalidatePreview()
  }

  const selectionForPreparation = (): ActivePlanEditSelection | null => {
    if (!source || !unstartedConfirmed) return null
    const common = { source, action, unstartedConfirmed, noFixedFutureCommitments: isSchedule && action === "SWAP" ? noFixedFutureCommitments : false }
    if (action === "SWAP") return noFixedFutureCommitments && (target === undefined || targetUnstartedConfirmed)
      ? { ...common, ...(target ? { target } : {}) } : null
    if (action === "DURATION") return durationValid ? { ...common, maximumMinutes: parsedMaximum! } : null
    if (action === "CATALOG" && catalogChoice) return {
      ...common,
      catalogId: catalogChoice.catalogId,
      inputs: catalogChoice.inputs,
      acceptLonger: catalogChoice.acceptLonger,
      acceptStronger: catalogChoice.acceptStronger,
    }
    return null
  }

  const prepare = async () => {
    if (uncertain) return
    const request = selectionForPreparation()
    if (!request) return
    const revision = ++requestRevision.current
    setBusy(true)
    setMessage("")
    setPreparation(null)
    setConfirmsNoKnownRisk(false)
    try {
      const result = await onPrepare(request)
      if (revision === requestRevision.current) {
        setPreparation(result)
        setConfirmedTargets(result.permittedTargets)
      }
    } catch {
      if (revision === requestRevision.current) setMessage("현재 계획을 확인하지 못했어요. 다시 읽은 뒤 미리보기를 열어 주세요.")
    } finally {
      if (revision === requestRevision.current) setBusy(false)
    }
  }

  const apply = async () => {
    if (preparation?.kind !== "ready" || !confirmsNoKnownRisk || busy || applied || uncertain) return
    setBusy(true)
    setMessage("")
    try {
      const result = await onApply(preparation.proposal, true)
      if (result.kind === "applied") {
        setApplied(true)
        onApplied(result.state)
        onClose()
      } else {
        setPreparation(null)
        setConfirmsNoKnownRisk(false)
        setUncertain(result.kind === "uncertain")
        setMessage(result.message)
      }
    } catch {
      setPreparation(null)
      setConfirmsNoKnownRisk(false)
      setUncertain(true)
      setMessage("저장 상태를 확인하지 못했어요. 현재 계획을 다시 읽어 주세요.")
    } finally {
      setBusy(false)
    }
  }

  const cancel = () => {
    requestRevision.current += 1
    onClose()
    openerRef.current?.focus()
  }

  const changedAddresses = preparation?.kind === "ready"
    ? [preparation.proposal.source, ...(preparation.proposal.target ? [preparation.proposal.target] : [])]
    : []
  const beforePreview = preparation?.kind === "ready"
    ? preparation.proposal.beforeSessions.filter(session => changedAddresses.some(address => sameAddress(address, session))) : []
  const afterPreview = preparation?.kind === "ready"
    ? preparation.proposal.afterSessions.filter(session => changedAddresses.some(address => sameAddress(address, session))) : []

  return (
    <section className="active-plan-session-editor" role="region" aria-labelledby="active-plan-session-editor-heading">
      <header className="active-plan-session-editor__header">
        <div>
          <h2 id="active-plan-session-editor-heading" ref={headingRef} tabIndex={-1}>이 훈련 수정</h2>
          <p>현재 계획은 미리보기에서 확인한 뒤 한 번에 적용해요.</p>
        </div>
        <button type="button" className="active-plan-session-editor__back" onClick={cancel} disabled={busy}>닫기</button>
      </header>

      {!entriesReady ? (
        <div className="active-plan-session-editor__read-state" role="status">
          <p>현재 계획과 연결된 기록을 확인하고 있어요.</p>
          <button type="button" onClick={onRetryEntries} disabled={busy}>다시 읽기</button>
        </div>
      ) : uncertain ? (
        <div className="active-plan-session-editor__read-state" role="status">
          <p>저장 결과를 확인하지 못했어요. 다시 적용하지 말고 현재 계획을 읽어 주세요.</p>
          <button type="button" onClick={onRetryEntries} disabled={busy}>현재 계획 다시 읽기</button>
        </div>
      ) : sourceOptions.length === 0 ? (
        <div className="active-plan-session-editor__read-state" role="status">
          <p>오늘 이후에 수정할 수 있는 훈련을 찾지 못했어요. 연결된 기록을 확인한 뒤 다시 시도해 주세요.</p>
          <button type="button" onClick={onRetryEntries} disabled={busy}>기록 다시 읽기</button>
        </div>
      ) : (
        <>
          <label className="active-plan-session-editor__field">수정할 훈련
            <select value={source ? addressKey(source) : ""} disabled={busy || disabled || uncertain} onChange={event => updateSource(event.target.value)}>
              {sourceOptions.map(option => <option key={addressKey(option.address)} value={addressKey(option.address)}>
                {option.date} · {slotLabel(option.address.slot)} · {roleLabel(option.role)}
              </option>)}
            </select>
          </label>

          {isSchedule ? (
            <>
              <label className="active-plan-session-editor__field">바꿀 날짜의 기존 훈련
                <select value={target ? addressKey(target) : ""} disabled={busy || disabled || !sourceUnstartedConfirmed || !noFixedFutureCommitments} onChange={event => {
                  const value = swapTargets.find(address => addressKey(address) === event.target.value)
                  setTarget(value)
                  setTargetUnstartedConfirmed(false)
                  invalidatePreview()
                }}>
                  <option value="">같은 시간대의 날짜를 선택해 주세요</option>
                  {swapTargets.map(address => {
                    const session = state.activePlan.sessions.find(item => sameAddress(item, address))
                    const date = preparation?.kind === "ready"
                      ? preparation.permittedTargets.find(item => sameAddress(item.address, address))?.date
                      : undefined
                    const sessionDate = date ?? (state.intake.startDate ? isoShift(state.intake.startDate, address.day - 1) : `${address.day}일차`)
                    return <option key={addressKey(address)} value={addressKey(address)}>
                      {sessionDate} · {slotLabel(address.slot)} · {roleLabel(session?.role ?? "")}
                    </option>
                  })}
                </select>
              </label>
              <label className="active-plan-session-editor__check">
                <input type="checkbox" checked={sourceUnstartedConfirmed} disabled={busy || disabled}
                  onChange={event => { setSourceUnstartedConfirmed(event.target.checked); setTarget(undefined); setTargetUnstartedConfirmed(false); setConfirmedTargets([]); invalidatePreview() }} />
                옮길 훈련은 아직 시작하지 않았어요.
              </label>
              {target && <label className="active-plan-session-editor__check">
                <input type="checkbox" checked={targetUnstartedConfirmed} disabled={busy || disabled}
                  onChange={event => { setTargetUnstartedConfirmed(event.target.checked); invalidatePreview() }} />
                바꿀 훈련도 아직 시작하지 않았어요.
              </label>}
              <label className="active-plan-session-editor__check">
                <input type="checkbox" checked={noFixedFutureCommitments} disabled={busy || disabled}
                  onChange={event => { setNoFixedFutureCommitments(event.target.checked); setTarget(undefined); setConfirmedTargets([]); invalidatePreview() }} />
                바꿀 날짜에 고정된 일정이 없어요.
              </label>
            </>
          ) : (
            <>
              <div className="active-plan-session-editor__mode" role="group" aria-label="훈련 변경 방법">
                {selectedOption?.actions.includes("DURATION") && <button type="button" aria-pressed={action === "DURATION"} disabled={busy || disabled || !unstartedConfirmed}
                  onClick={() => { setAction("DURATION"); setCatalogChoice(null); invalidatePreview() }}>시간 줄이기</button>}
                {selectedOption?.actions.includes("CATALOG") && <button type="button" aria-pressed={action === "CATALOG"} disabled={busy || disabled || !unstartedConfirmed}
                  onClick={() => { setAction("CATALOG"); setMaximumMinutes(""); invalidatePreview() }}>훈련 구성 바꾸기</button>}
              </div>
              {action === "DURATION" && durationRange && <label className="active-plan-session-editor__field">새 최대 시간 · 분
                <input type="number" inputMode="numeric" min={durationRange.minimum} max={durationRange.maximum}
                  value={maximumMinutes} disabled={busy || disabled || !unstartedConfirmed}
                  onChange={event => { setMaximumMinutes(event.target.value); invalidatePreview() }} />
                <span>현재 범위 {durationRange.minimum}–{durationRange.maximum}분 안에서 입력해요.</span>
              </label>}
              {action === "CATALOG" && selectedSession?.prescription.kind === "RPE_TIME_RANGE" && (
                  <CatalogWorkoutEditor
                  key={`${contextKey}:${state.activePlan.candidateId}:${addressKey(selectedSession)}:${catalogEditorRevision}`}
                  intake={state.intake as PlanBetaIntake}
                  records={records}
                  session={selectedSession}
                  selectionMode="SAVED_PLAN"
                  drawHistory={drawHistory.current}
                  disabled={busy || disabled || !unstartedConfirmed}
                  applyDisabled={busy || disabled || !unstartedConfirmed}
                  onDraftChange={() => { setCatalogChoice(null); invalidatePreview() }}
                  onCancel={() => { setCatalogChoice(null); setCatalogEditorRevision(value => value + 1); invalidatePreview() }}
                  // Stage only: the picker checks the binding and consents; onPrepare/onApply
                  // re-read the plan and journal guards before any stored plan changes.
                  canSelect={() => entriesReady && !busy && !disabled && !uncertain
                    && unstartedConfirmed && (selectedOption?.actions.includes("CATALOG") ?? false)}
                  onSelect={(catalogId, inputs, acceptLonger, acceptStronger) => {
                    setCatalogChoice({ catalogId, inputs, acceptLonger, acceptStronger })
                    invalidatePreview()
                  }}
                />
              )}
              {action === "CATALOG" && (!selectedSession || selectedSession.prescription.kind !== "RPE_TIME_RANGE") && (
                <p role="status">이 훈련의 내용을 바꾸는 경로를 열 수 없어요.</p>
              )}
              <label className="active-plan-session-editor__check">
                <input type="checkbox" checked={sourceUnstartedConfirmed} disabled={busy || disabled}
                  onChange={event => { setSourceUnstartedConfirmed(event.target.checked); invalidatePreview() }} />
                이 훈련은 아직 시작하지 않았어요.
              </label>
            </>
          )}

          {message && <p className="active-plan-session-editor__message" role="alert">{message}</p>}
          {preparation?.kind === "blocked" && !(action === "SWAP" && target === undefined && preparation.reasonCode === "TARGET_UNAVAILABLE")
            && <p className="active-plan-session-editor__message" role="status">{preparation.message}</p>}
          {preparation?.kind === "ready" && (
            <section className="active-plan-session-editor__preview" aria-labelledby="active-plan-session-preview-heading">
              <h3 id="active-plan-session-preview-heading">변경안 미리보기</h3>
              <div className="active-plan-session-editor__comparison">
                <div><h4>변경 전</h4>{beforePreview.map(session => <SessionSummary key={addressKey(session)} session={session} />)}</div>
                <div><h4>변경 후</h4>{afterPreview.map(session => <SessionSummary key={addressKey(session)} session={session} />)}</div>
              </div>
              <label className="active-plan-session-editor__check active-plan-session-editor__safety-check">
                <input type="checkbox" checked={confirmsNoKnownRisk} disabled={busy || disabled}
                  onChange={event => setConfirmsNoKnownRisk(event.target.checked)} />
                지금 통증이나 몸 상태 이상이 없어요.
              </label>
              <button type="button" className="active-plan-session-editor__apply" disabled={busy || disabled || !confirmsNoKnownRisk || applied} onClick={() => void apply()}>
                변경안 적용하기
              </button>
            </section>
          )}
          <div className="active-plan-session-editor__actions">
            <button type="button" disabled={!formReady || busy} onClick={() => void prepare()}>
              {busy ? "현재 계획 확인 중…" : action === "SWAP" && target === undefined ? "바꿀 날짜 보기" : "변경안 미리보기"}
            </button>
            <button type="button" onClick={cancel} disabled={busy}>취소</button>
          </div>
        </>
      )}
    </section>
  )
}

function SessionSummary({ session }: { readonly session: ActivePlanEditProposal["beforeSessions"][number] }) {
  const duration = session.prescription.kind === "RPE_TIME_RANGE" ? session.prescription.durationMinutes : null
  const rpe = session.prescription.kind === "RPE_TIME_RANGE" ? session.prescription.rpe : null
  const catalog = session.prescription.kind === "RPE_TIME_RANGE" ? session.prescription.catalogWorkout : undefined
  const name = catalog ? ALL_WORKOUT_CATALOG.find(workout => workout.id === catalog.catalogId)?.name : undefined
  const label = session.prescription.kind === "REST" ? "휴식"
    : duration ? `${duration.minimum}–${duration.maximum}분` : "훈련 내용 확인"
  return <p className="active-plan-session-editor__session-summary">
    {name && <strong>{name}<br /></strong>}
    {session.day}일차 · {slotLabel(session.slot)} · {roleLabel(session.role)} · {label}
    {rpe && <> · RPE {rpe.minimum}–{rpe.maximum}</>}
  </p>
}
