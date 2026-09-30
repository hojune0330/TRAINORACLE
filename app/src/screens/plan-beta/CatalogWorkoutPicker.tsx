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
import { CatalogWorkoutDetail } from "./CatalogWorkoutDetail"
import { formatTotalMinutes } from "./labels"
import "./catalog-workout.css"

const requirementLabels: Record<string, string> = {
  ACCELERATION_AND_DECELERATION_SPACE: "가속하고 속도를 줄일 충분한 공간이 있어요",
  RECENT_LONG_RUN_BASELINE: "최근에도 이 정도 길이의 장거리 달리기를 해봤어요",
  RECENT_THRESHOLD_VOLUME: "최근에도 이 정도 시간의 템포 훈련을 해봤어요",
  BIKE_AVAILABLE: "자전거를 사용할 수 있어요", ELLIPTICAL_AVAILABLE: "일립티컬을 사용할 수 있어요",
  WATER_SAFETY_AND_EQUIPMENT: "수중 운동 장비와 안전한 환경이 있어요",
  SWIMMING_ABILITY_AND_WATER_SAFETY: "이 훈련을 할 수 있는 수영 능력과 안전한 환경이 있어요",
  HILL_SURFACE_GRADE_RETURN: "언덕의 경사·노면과 안전한 복귀 길을 확인했어요",
  CONNECTED_HILL_FLAT_ROUTE: "언덕과 평지를 이어 달릴 안전한 코스가 있어요",
  COMPOUND_TRAINING_EXPERIENCE: "서로 다른 강도를 묶은 복합 훈련 경험이 있어요",
  HIGH_INTENSITY_REPETITION_EXPERIENCE: "짧고 강한 반복 훈련 경험이 있어요",
}
type PickerProps = {
  readonly generated: PlanGenerationSuccess; readonly intake: PlanBetaIntake; readonly records: readonly AthleteRecord[]
  readonly onChange: (next: PlanGenerationSuccess) => void; readonly disabled?: boolean
  readonly onPendingChange?: (pending: boolean) => void
  readonly openRequest?: number | null
}
export function CatalogWorkoutPicker(props: PickerProps) {
  const { generated, disabled = false } = props
  const sessions = generated.candidates[0].sessions.filter(s => s.role !== "REST" && s.prescription.kind === "RPE_TIME_RANGE")
  const first = sessions.find(s => s.role === "QUALITY") ?? sessions[0]
  const [address, setAddress] = React.useState(first ? `${first.day}:${first.slot}` : "")
  const [message, setMessage] = React.useState("")
  const [pending, setPending] = React.useState(false)
  const [resetRevision, setResetRevision] = React.useState(0)
  const panelRef = React.useRef<HTMLDetailsElement>(null)
  const drawHistory = React.useRef(new Map<string, Set<string>>())
  React.useEffect(() => {
    if (props.openRequest != null && panelRef.current) panelRef.current.open = true
  }, [props.openRequest])
  const handlePendingChange = React.useCallback((value: boolean) => {
    setPending(value)
    props.onPendingChange?.(value)
  }, [props.onPendingChange])
  const session = sessions.find(s => `${s.day}:${s.slot}` === address) ?? first
  if (!session || session.prescription.kind !== "RPE_TIME_RANGE") return null
  const actualAddress = `${session.day}:${session.slot}`
  return <details ref={panelRef} className="plan-session-guidance catalog-workout-picker">
    <summary>다른 훈련으로 바꾸기</summary>
    <label>바꿀 일정<select value={actualAddress} disabled={disabled || pending} onChange={e => { setAddress(e.target.value); setMessage("") }}>
      {sessions.map(s => <option key={`${s.day}:${s.slot}`} value={`${s.day}:${s.slot}`}>{s.day}일차 {s.slot === "AM" ? "오전" : "오후"}</option>)}
    </select></label>
    {pending && <small>변경을 적용하거나 취소하면 다른 날짜를 고를 수 있어요.</small>}
    <CatalogWorkoutEditor key={`${generated.pairId}:${actualAddress}:${resetRevision}`} {...props} session={session}
      drawHistory={drawHistory.current}
      onPendingChange={handlePendingChange}
      onCancel={() => { setResetRevision(n => n + 1); setMessage("") }}
      onChange={next => { props.onChange(next); setMessage("계획안에 반영했어요. 날짜와 훈련 횟수는 그대로예요.") }} />
    {message && <p role="status">{message}</p>}
  </details>
}

type EditorProps = Omit<PickerProps, "generated" | "onChange"> & {
  readonly generated?: PlanGenerationSuccess
  readonly onChange?: (next: PlanGenerationSuccess) => void
  readonly onSelect?: (id: string, inputs: WorkoutCalculationInputs, acceptLonger: boolean) => void
  readonly canSelect?: (id: string, inputs: WorkoutCalculationInputs, acceptLonger: boolean) => boolean
  readonly applyDisabled?: boolean
  readonly session: PlanGenerationSuccess["candidates"][number]["sessions"][number]
  readonly onCancel: () => void
  readonly drawHistory: Map<string, Set<string>>
}
export function CatalogWorkoutEditor({ generated, intake, records, onChange, onSelect, canSelect, applyDisabled,
  onPendingChange, session, onCancel, drawHistory, disabled = false }: EditorProps) {
  const binding = session.prescription.kind === "RPE_TIME_RANGE" ? session.prescription.catalogWorkout : undefined
  const pool = ALL_WORKOUT_CATALOG.filter(e => e.family === catalogFamilyForIntent(session.plannedEnergyIntent)
    && e.eventDistances.includes(intake.eventDistanceM) && e.experience.includes(intake.experienceBand) && e.hold === null)
    .filter(e => {
      if (session.role !== "EASY" || session.prescription.kind !== "RPE_TIME_RANGE") return true
      const workout = calculateCatalogWorkout(e.id, { eventDistanceM: intake.eventDistanceM, experience: intake.experienceBand,
        availableSeconds: null, confirmedRequirements: [], segmentPaces: [], fiveK: null })
      return workout && catalogRpe(workout).maximum <= (binding?.originalEnvelope.rpe.maximum ?? session.prescription.rpe.maximum)
    })
  const [choice, setChoice] = React.useState(binding?.catalogId ?? pool[0]?.id ?? "")
  const [recordId, setRecordId] = React.useState(binding?.inputs.fiveK?.recordId ?? "")
  const [confirmed, setConfirmed] = React.useState<string[]>([...(binding?.inputs.confirmedRequirements ?? [])])
  const [seconds, setSeconds] = React.useState<Record<string, string>>(() => Object.fromEntries((binding?.inputs.segmentSeconds ?? []).map(s => [s.segmentId, String(s.seconds)])))
  const [recoveries, setRecoveries] = React.useState<Record<string, string>>(() => Object.fromEntries((binding?.inputs.recoverySeconds ?? []).map(s => [s.segmentId, String(s.seconds)])))
  const [durationDecision, setDurationDecision] = React.useState<{ key: string; accepted: boolean } | null>(null)
  const draft = JSON.stringify([choice, recordId, confirmed, seconds, recoveries])
  const originalDraft = React.useRef(draft)
  const configurationChanged = draft !== originalDraft.current
  const pending = configurationChanged || durationDecision !== null
  React.useEffect(() => { onPendingChange?.(pending) }, [pending, onPendingChange])
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
    confirmedRequirements: confirmed, segmentPaces: choice === binding?.catalogId ? binding.inputs.segmentPaces : [],
    fiveK: !configurationChanged && binding?.inputs.fiveK ? binding.inputs.fiveK
      : record?.achievedOn ? { recordId: record.id, seconds: record.performanceSeconds, achievedAt: record.achievedOn, evaluatedAt: todayISO() } : null,
    segmentSeconds: Object.entries(seconds).filter(([, v]) => v !== "").map(([segmentId, v]) => ({ segmentId, seconds: Number(v) })),
    recoverySeconds: Object.entries(recoveries).filter(([, v]) => v !== "").map(([segmentId, v]) => ({ segmentId, seconds: Number(v) })),
  }
  const preview = calculateCatalogWorkout(entry.id, inputs)
  const withoutTimes = calculateCatalogWorkout(entry.id, { ...inputs, segmentSeconds: [], recoverySeconds: [] })
  const missing = withoutTimes?.steps.filter(s => s.seconds === null).filter((s, i, all) => all.findIndex(x => x.segmentId === s.segmentId) === i) ?? []
  const durationKey = preview?.totals.seconds ? `${entry.id}:${preview.fingerprint}` : null
  const longer = preview?.totals.seconds && preview.totals.seconds.maximum > inputs.availableSeconds!
  const acceptLonger = longer && durationKey !== null && (durationDecision?.key === durationKey
    ? durationDecision.accepted
    : durationDecision === null && !configurationChanged && pairedPrescriptions.every(p => preview.totals.seconds!.maximum
      <= (p.catalogWorkout?.originalEnvelope.durationMinutes.maximum ?? p.durationMinutes.maximum) * 60
      || p.catalogWorkout?.acceptedDurationSeconds === preview.totals.seconds!.maximum))
  const unavailable = preview?.unavailable.filter(code => code !== "TIME_BUDGET_EXCEEDED" || !acceptLonger) ?? []
  const next = preview && generated ? replaceCandidateCatalogWorkout(generated, session, entry.id, inputs, !!acceptLonger) : null
  const canApply = generated ? next !== null : !!preview && !!onSelect
    && bindCatalogSession(session, entry.id, inputs, !!acceptLonger) !== null
    && (canSelect?.(entry.id, inputs, !!acceptLonger) ?? false)
  const nextRpe = preview?.steps.some(s => s.phase === "main" && s.kind === "WORK") ? catalogRpe(preview) : null
  const stronger = nextRpe && nextRpe.maximum > session.prescription.rpe.maximum
  const eligibleDraws = pool.filter(e => {
    const immediateInputs = { ...inputs, confirmedRequirements: [], segmentPaces: [], segmentSeconds: [], recoverySeconds: [] }
    const calculation = calculateCatalogWorkout(e.id, immediateInputs)
    return calculation !== null && calculation.unavailable.length === 0
      && (generated ? replaceCandidateCatalogWorkout(generated, session, e.id, immediateInputs) !== null
        : bindCatalogSession(session, e.id, immediateInputs) !== null && (canSelect?.(e.id, immediateInputs, false) ?? false))
  })
  const alternatives = [...groupEligibleCatalogMethods(eligibleDraws).keys()].filter(key => key !== catalogRecommendationMethodKey(entry))
  const drawScope = JSON.stringify([session.day, session.slot, intake.eventDistanceM, intake.experienceBand,
    inputs.availableSeconds, inputs.fiveK, eligibleDraws.map(e => e.id)])
  const reset = (id: string) => { setChoice(id); setConfirmed([]); setSeconds({}); setRecoveries({}); setDurationDecision(null) }
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
    {["LT", "VO2", "MIX"].includes(entry.family) && <label>참고 페이스에 사용할 5km 기록<select value={recordId} disabled={disabled} onChange={e => { setRecordId(e.target.value); setSeconds({}); setDurationDecision(null) }}>
      <option value="">기록 없이 체감 강도로</option>
      {recordId && !record && <option value={recordId}>이 계획에 저장된 기준 기록</option>}
      {records.filter(r => r.eventDistanceM === 5000 && r.purpose !== "RACE_GOAL" && r.verificationState !== "UNVERIFIED").map(r => <option key={r.id} value={r.id}>{r.achievedOn} · {formatRecordTime(r.performanceSeconds)}</option>)}
    </select></label>}
    {entry.requirements.map(r => <label key={r}><input type="checkbox" checked={confirmed.includes(r)} disabled={disabled}
      onChange={e => setConfirmed(e.target.checked ? [...confirmed, r] : confirmed.filter(x => x !== r))} />{requirementLabels[r] ?? "별도 운동 조건을 확인해 주세요."}</label>)}
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
    {stronger && nextRpe && <p role="status">지금 훈련 RPE {session.prescription.rpe.minimum}~{session.prescription.rpe.maximum} → 새 훈련 RPE {nextRpe.minimum}~{nextRpe.maximum}. 더 강한 구성이에요. 아래 버튼을 누르면 이 강도로 바뀌어요.</p>}
    {longer && preview?.totals.seconds && <label><input type="checkbox" checked={!!acceptLonger} disabled={disabled}
      onChange={e => durationKey !== null && setDurationDecision({ key: durationKey, accepted: e.target.checked })} />준비·회복·정리까지 최대 {formatTotalMinutes(preview.totals.seconds.maximum / 60)} 걸려요. {generated ? "더 짧았던 계획안도 이 시간으로 바꿀게요." : "이 시간으로 바꿀게요."}</label>}
    {!preview && <p role="status">입력한 시간을 확인해 주세요. 0보다 큰 초 단위 숫자로 입력해요.</p>}
    {unavailable.length ? <p role="status">{[...new Set(unavailable.map(reason))].join(" ")}</p> : null}
    {preview && !canApply && !unavailable.length && (pending || !binding) && <p role="status">이 일정에는 적용할 수 없는 구성이에요. 같은 목적의 다른 훈련을 골라 주세요.</p>}
    {preview?.unresolved.includes("RECORD_NOT_CURRENT") && <p role="status">오래된 기록이라 참고 페이스에 사용하지 않았어요.</p>}
    <div className="catalog-workout-picker__actions">
      <button type="button" disabled={disabled || applyDisabled || !canApply || !pending && !!binding} onClick={() => {
        if (next) onChange?.(next)
        else if (canApply) onSelect?.(entry.id, inputs, !!acceptLonger)
      }}>이 구성으로 바꾸기</button>
      {pending && <button type="button" disabled={disabled} onClick={onCancel}>변경 취소</button>}
    </div>
    {pending && <p role="status">아직 계획에 적용하지 않았어요.</p>}
  </div>
}
