import React from "react"
import { Check, ArrowRight } from "lucide-react"
import { applyInitialMainConditions, applyInitialMainManual, reviewInitialMainConditions } from "../../domain/initial-main-conditions"
import type { InitialMainInput, InitialMainAlternative } from "../../domain/initial-main-conditions"
import type { WorkoutCalculationInputs } from "@impl/prescription/all-workout-calculator"
import { calculatedWorkoutSequence } from "@impl/prescription/all-workout-calculator"
import { sequenceNotation } from "../../domain/workout-notation"
import { formatTrainingSeconds } from "./labels"
import { catalogRequirementLabels } from "../../domain/catalog-schedule-conditions"
import { CatalogWorkoutDetail } from "./CatalogWorkoutDetail"
import { CatalogWorkoutEditor } from "./CatalogWorkoutPicker"
import "./catalog-workout.css"
import { localJournalScopeGeneration } from "../../domain/account/local-journal-ownership"

export type InitialMainConditionsProps = {
  readonly input: InitialMainInput
  readonly disabled?: boolean
  /** Parent must recheck fresh input inside its draft mutation lock. Does not save. */
  readonly onApply: (reviewKey: string, confirmedRequirements: readonly string[]) => void
  readonly onApplyManual?: (reviewKey: string, address: { day: number; slot: "AM" | "PM" },
    catalogId: string, inputs: WorkoutCalculationInputs, acceptLongerDuration: boolean) => void
  /** Explicitly regenerate with this purpose, retaining the actual experience. */
  readonly onChooseAlternative?: (alternative: InitialMainAlternative) => void
  readonly onPendingChange?: (pending: boolean) => void
}

export function InitialMainConditions({ input, disabled = false, onApply, onApplyManual, onChooseAlternative, onPendingChange }: InitialMainConditionsProps) {
  const accountGeneration = localJournalScopeGeneration()
  // Checkbox and preview edits do not change this source-bound review. Applying
  // still recomputes from fresh input; an account switch revokes the render memo.
  const review = React.useMemo(() => reviewInitialMainConditions(input), [input, accountGeneration])
  const key = review?.key ?? null
  const [answer, setAnswer] = React.useState<{ key: string | null; checked: readonly string[] }>({ key, checked: [] })
  const [message, setMessage] = React.useState("")
  const [manualPending, setManualPending] = React.useState(false)
  const [cancelRevision, setCancelRevision] = React.useState(0)
  const [manualAddress, setManualAddress] = React.useState("")
  const [previewAddress, setPreviewAddress] = React.useState("")
  const drawHistory = React.useRef(new Map<string, Set<string>>())
  const reportManualPending = React.useCallback((value: boolean) => setManualPending(value), [])
  // Permanently revoke old answers, including a date changed away and then back.
  if (answer.key !== key) { setAnswer({ key, checked: [] }); setMessage("") }
  const checked = answer.key === key ? answer.checked : []
  const pending = checked.length > 0 || manualPending
  React.useEffect(() => { onPendingChange?.(pending) }, [pending, onPendingChange])
  React.useEffect(() => () => onPendingChange?.(false), [onPendingChange])
  if (!review || !review.offers.length && !review.fallbacks.length) return null
  const requirements = [...new Set(review.offers.flatMap(offer => offer.requirements))]
  const alternatives = review.fallbacks.flatMap(fallback => fallback.alternatives)
    .filter((alternative, index, all) => all.findIndex(other => other.trainingFocus === alternative.trainingFocus) === index)
  const manualFallbacks = review.fallbacks.filter(fallback => fallback.manualCatalogIds.length > 0)
  const selectedManual = manualFallbacks.find(row => `${row.day}:${row.slot}` === manualAddress) ?? manualFallbacks[0]
  const preview = review.offers.find(row => `${row.day}:${row.slot}` === previewAddress) ?? review.offers[0]
  return <section className="catalog-workout-picker" aria-label="첫 주요 훈련 조건">
    {review.offers.length > 0 && <>
      <h3>짧은 고출력 훈련 · 장소 확인</h3>
      <ul aria-label="확인할 주요 훈련">{review.offers.map(offer => {
        const sequence = calculatedWorkoutSequence(offer.workout), total = offer.workout.totals.seconds!
        return <li key={`${offer.day}:${offer.slot}`}>
        <h4>{offer.date} {offer.slot === "AM" ? "오전" : "오후"} · {offer.name}</h4>
        {sequence && <code>{sequenceNotation(sequence)}</code>}
        <small style={{ display: "block" }}>준비·회복·정리 포함 약 {formatTrainingSeconds(total.maximum)}
          {offer.longerThanOriginal ? " · 처음 안내보다 긴 구성" : ""}</small>
      </li>})}</ul>
      <fieldset className="catalog-workout-picker__required catalog-schedule-review" disabled={disabled || manualPending}>
        <legend>아래 날짜의 장소·장비를 확인해 주세요</legend>
        {requirements.map(requirement => <label key={requirement}>
          <input type="checkbox" checked={checked.includes(requirement)} onChange={event => {
            setAnswer({ key, checked: event.target.checked ? [...checked, requirement] : checked.filter(value => value !== requirement) })
            setMessage("")
          }} />
          <span>{catalogRequirementLabels[requirement]}<small>{review.offers.filter(offer => offer.requirements.includes(requirement))
            .map(offer => `${offer.date} ${offer.slot === "AM" ? "오전" : "오후"}`).join(" · ")}</small></span>
        </label>)}
        <div className="catalog-workout-picker__actions">
          <button type="button" className="instant-plan__secondary" disabled={disabled || !requirements.every(requirement => checked.includes(requirement))}
            onClick={() => {
              if (disabled || !applyInitialMainConditions(input, review.key, checked)) {
                setAnswer({ key, checked: [] }); setMessage("계획 조건이 달라졌어요. 날짜와 장소를 다시 확인해 주세요."); return
              }
              onApply(review.key, [...checked])
            }}><Check size={16} aria-hidden="true" />이 훈련으로 적용</button>
          {pending && <button type="button" className="instant-plan__secondary" disabled={disabled}
            onClick={() => { setAnswer({ key, checked: [] }); setMessage("") }}>변경 취소</button>}
        </div>
      </fieldset>
      {preview && <details>
        <summary>상세 훈련 미리보기</summary>
        <label>확인할 훈련<select value={`${preview.day}:${preview.slot}`} onChange={event => setPreviewAddress(event.target.value)}>
          {review.offers.map(offer => <option key={`${offer.day}:${offer.slot}`} value={`${offer.day}:${offer.slot}`}>
            {offer.date} {offer.slot === "AM" ? "오전" : "오후"} · {offer.name}
          </option>)}
        </select></label>
        <CatalogWorkoutDetail workout={preview.workout} />
      </details>}
    </>}
    {review.fallbacks.length > 0 && <>
      <p role="status">{review.fallbacks.some(fallback => fallback.reason === "BEGINNER_GLY_NOT_ADOPTED")
        ? "처음 시작하는 분께 맞는 해당계 세부 훈련은 아직 준비 중이에요. 다른 목적의 계획도 볼 수 있어요."
        : review.fallbacks.some(fallback => fallback.reason === "EXPLICIT_SEGMENT_TIME_REQUIRED")
          ? "몇 초에 달릴지 정하면 반복·회복까지 자세히 볼 수 있어요."
          : "아직 자세한 반복 구성을 제공하지 못하는 조건이에요."}</p>
      <p>{review.fallbacks.map(fallback => `${fallback.date} ${fallback.slot === "AM" ? "오전" : "오후"}`).join(" · ")}</p>
      {onApplyManual && selectedManual && [selectedManual].map(fallback => {
        const session = input.generated.candidates[0].sessions.find(session => session.day === fallback.day && session.slot === fallback.slot)!
        return <details key={`${fallback.day}:${fallback.slot}`}>
          <summary>{fallback.date} {fallback.slot === "AM" ? "오전" : "오후"} · 구간 시간 정하기</summary>
          <label>시간을 정할 일정<select value={`${fallback.day}:${fallback.slot}`} disabled={disabled || pending}
            onChange={event => setManualAddress(event.target.value)}>
            {manualFallbacks.map(row => <option key={`${row.day}:${row.slot}`} value={`${row.day}:${row.slot}`}>
              {row.date} {row.slot === "AM" ? "오전" : "오후"}
            </option>)}
          </select></label>
          <CatalogWorkoutEditor key={`${input.generated.pairId}:${fallback.day}:${fallback.slot}:${cancelRevision}`}
            intake={input.intake} records={[]} session={session} startDate={input.context.startDate} selectionMode="DRAFT"
            disabled={disabled || checked.length > 0} drawHistory={drawHistory.current}
            preferredCatalogId={fallback.manualCatalogIds[0]} onPendingChange={reportManualPending}
            onCancel={() => { setCancelRevision(value => value + 1); setManualPending(false) }}
            canSelect={(id, inputs, longer) => applyInitialMainManual(input, review.key, fallback, id, inputs, longer) !== null}
            onSelect={(id, inputs, longer) => {
              if (!disabled && applyInitialMainManual(input, review.key, fallback, id, inputs, longer))
                onApplyManual(review.key, { day: fallback.day, slot: fallback.slot }, id, inputs, longer)
            }} />
        </details>
      })}
      {onChooseAlternative && alternatives.map(alternative => <button key={alternative.trainingFocus} type="button"
        className="instant-plan__secondary" disabled={disabled || pending} onClick={() => {
          const current = reviewInitialMainConditions(input)
          if (!disabled && !pending && current?.key === review.key) onChooseAlternative(alternative)
        }}><ArrowRight size={16} aria-hidden="true" />{alternative.trainingFocus === "VO2_INTENT" ? "심폐 반복" : "템포"} 목적으로 새 계획 보기</button>)}
    </>}
    {message && <p role="alert">{message}</p>}
  </section>
}
