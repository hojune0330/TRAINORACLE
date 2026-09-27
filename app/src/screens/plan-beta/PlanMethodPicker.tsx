import React from "react"
import { ChevronDown, SlidersHorizontal, RefreshCw, Undo2, Redo2, RotateCcw } from "lucide-react"
import type { PlanBetaIntake } from "../../domain/plan-beta-store"
import { sameDetailedTemplateReference } from "../../domain/plan-method-selection"
import type { DetailedPlanTemplateOption } from "./plan-template-options"
import type { RepeatPreference } from "@impl/prescription/method-recommendation"
import { deriveSequenceTotals } from "@impl/prescription/sequence"
import { activeWorkoutRepeatLevels, sameWorkoutMethod } from "../../domain/workout-method-identity"
import { createWorkoutPreviewHistory, pushWorkoutPreview, undoWorkoutPreview, redoWorkoutPreview } from "../../domain/workout-preview-history"

type Props = {
  readonly options: readonly DetailedPlanTemplateOption[]
  readonly selected: PlanBetaIntake["selectedDetailedTemplateRef"]
  readonly onChange: (reference: PlanBetaIntake["selectedDetailedTemplateRef"]) => void
  readonly repeatPreference?: RepeatPreference
  readonly onRepeatPreferenceChange?: (preference: RepeatPreference) => void
  readonly contextKey?: string
  readonly onPendingChange?: (pending: boolean) => void
}
export function PlanMethodPicker(props: Props) {
  const [expanded, setExpanded] = React.useState(false)
  const key = JSON.stringify([props.contextKey ?? "", props.selected, props.options.map(o => [o.ref, o.sequence ?? null])
    .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))])
  return <MethodPreview key={key} {...props} expanded={expanded} onExpandedChange={setExpanded} />
}
function MethodPreview({ options, selected, onChange, repeatPreference = "NEUTRAL", onRepeatPreferenceChange, onPendingChange, expanded, onExpandedChange }: Props & {
  readonly expanded: boolean; readonly onExpandedChange: (expanded: boolean) => void;
}) {
  const id = React.useId()
  const [showAll, setShowAll] = React.useState(false)
  const [history, setHistory] = React.useState(() => createWorkoutPreviewHistory(selected))
  const [seen, setSeen] = React.useState(() => selected ? [selected] : [])
  const methodChoices = React.useRef<HTMLFieldSetElement>(null)
  const previewRef = history.present
  const dirty = !sameDetailedTemplateReference(previewRef, selected) && !(previewRef === null && selected === null)
  const current = options.find(option => sameDetailedTemplateReference(option.ref, previewRef))
  const choose = (reference: Props["selected"]) => {
    setHistory(previous => sameDetailedTemplateReference(previous.present, reference) || (previous.present === null && reference === null)
      ? previous : pushWorkoutPreview(previous, reference))
    if (reference) setSeen(previous => previous.some(ref => sameDetailedTemplateReference(ref, reference)) ? previous : [...previous, reference])
  }
  const submitted = React.useRef(false)
  const [submitError, setSubmitError] = React.useState(false)
  React.useLayoutEffect(() => { onPendingChange?.(dirty); return () => onPendingChange?.(false) }, [dirty, onPendingChange])
  const distinct = options.flatMap(option => {
    try {
      if (!option.sequence) return []
      deriveSequenceTotals(option.sequence)
      return [{ option, activeLevels: activeWorkoutRepeatLevels(option.sequence.main) }]
    }
    catch { return [] }
  }).sort((a, b) => b.activeLevels - a.activeLevels || JSON.stringify(a.option.ref).localeCompare(JSON.stringify(b.option.ref)))
    .reduce<DetailedPlanTemplateOption[]>((all, { option }) => {
    try { if (!all.some(old => old.sequence && sameWorkoutMethod(old.sequence, option.sequence!))) all.push(option) }
    catch { /* Malformed evidence does not become another method. */ }
    return all
  }, [])
  const methodIndex = (reference: Props["selected"]) => {
    const exact = distinct.findIndex(option => sameDetailedTemplateReference(option.ref, reference))
    const item = options.find(option => sameDetailedTemplateReference(option.ref, reference))
    return exact >= 0 ? exact : item?.sequence
      ? distinct.findIndex(option => option.sequence && sameWorkoutMethod(item.sequence!, option.sequence)) : -1
  }
  const seenIndices = new Set(seen.map(methodIndex)), currentIndex = methodIndex(previewRef)
  const next = distinct.length > 1 ? distinct.find((_, index) => index !== currentIndex && !seenIndices.has(index)) : undefined
  const exhausted = distinct.length > 1 && !next
  const coverage = options[0]?.historyCoverage
  const initialOptions = options.filter((option, index) => option.recommended ?? index < 2)
  const shownOptions = showAll ? options : options.filter(option => initialOptions.includes(option) || option === current)
  const eligibleFamilyCount = new Set(options.flatMap(option => option.method === undefined ? [] : [option.method.familyId])).size
  return (
    <details className="plan-method-picker" open={expanded} onToggle={event => onExpandedChange(event.currentTarget.open)}>
      <summary>
        <SlidersHorizontal size={16} aria-hidden="true" />
        <span>훈련 방법 선택<small>{previewRef === null ? "시간과 체감 강도 안내" : current?.mainSummary ?? "선택한 상세 훈련 확인 필요"}</small></span>
        <ChevronDown className="plan-method-picker__chevron" size={16} aria-hidden="true" />
      </summary>
      {current && <section className="plan-method-picker__preview" aria-label="훈련 미리보기" key={JSON.stringify(current.ref)}>
        <strong>{current.mainSummary}</strong><p>{current.recoverySummary}</p>
        <p>현재 {current.targetEventDistanceM}m 기록을 확인하면 목표 시간을 계산해요.</p>
        <details><summary>준비·정리와 추천 이유</summary><p>{current.preparationSummary}</p>
          {current.recommendationReason && <p>{current.recommendationReason}</p>}</details>
      </section>}
      <div className="plan-method-picker__tools">
        {(next || exhausted) && <button type="button" onClick={() => {
          if (next) choose(next.ref)
          else { setShowAll(true); methodChoices.current?.scrollIntoView({ block: "nearest" }) }
        }}><RefreshCw size={18} aria-hidden="true" />{next ? "다른 훈련" : "본 방법 다시 보기"}</button>}
        <button type="button" title="되돌리기" aria-label="되돌리기" disabled={!history.past.length} onClick={() => setHistory(undoWorkoutPreview)}><Undo2 size={18} aria-hidden="true" /></button>
        <button type="button" title="다시 하기" aria-label="다시 하기" disabled={!history.future.length} onClick={() => setHistory(redoWorkoutPreview)}><Redo2 size={18} aria-hidden="true" /></button>
        <button type="button" title="처음 선택으로" aria-label="처음 선택으로" disabled={!dirty} onClick={() => choose(selected)}><RotateCcw size={18} aria-hidden="true" /></button>
      </div>
      {exhausted && <p className="plan-method-picker__limit">선택 가능한 방법을 모두 봤어요.</p>}
      {dirty && <div className="plan-method-picker__pending">
        <p role="status">미리보기예요. 아직 계획은 바뀌지 않았어요.</p>
        <button type="button" className="plan-primary" onClick={() => {
          if (submitted.current || (previewRef !== null && !options.some(o => sameDetailedTemplateReference(o.ref, previewRef)))) return
          submitted.current = true
          try { onChange(previewRef) } catch { submitted.current = false; setSubmitError(true) }
        }}>이 훈련으로 변경</button>
        {submitError && <p role="alert">훈련을 변경하지 못했어요. 미리보기는 남아 있으니 다시 눌러 주세요.</p>}
      </div>}
      {eligibleFamilyCount > 1 && onRepeatPreferenceChange !== undefined && <fieldset>
        <legend>추천 선호 (선택)</legend>
        {([
          ["NEUTRAL", "선호 없음"],
          ["PREFER_VARIETY", "덜 해본 방법 선호"],
          ["PREFER_REPEAT", "해본 방법 선호"],
        ] as const).map(([preference, label]) => <label className="plan-method-picker__option" key={preference}>
          <input type="radio" name={`${id}-preference`} checked={repeatPreference === preference}
            onChange={() => onRepeatPreferenceChange(preference)} />
          <span>{label}</span>
        </label>)}
      </fieldset>}
      <fieldset ref={methodChoices} aria-describedby={`${id}-help`}>
        <legend>받고 싶은 훈련</legend>
        <label className="plan-method-picker__option">
          <input type="radio" name={`${id}-method`} checked={previewRef === null} onChange={() => choose(null)} />
          <span><strong>시간과 체감 강도로 안내받기</strong><small>목표 페이스 없이 운동 시간과 힘든 정도를 안내해요.</small></span>
        </label>
        {shownOptions.map(option => (
          <label className="plan-method-picker__option" key={`${option.ref.templateId}@${option.ref.version}`}>
            <input type="radio" name={`${id}-method`}
              checked={sameDetailedTemplateReference(previewRef, option.ref)}
              onChange={() => choose(option.ref)} />
            <span><strong>{option.mainSummary}</strong><small>{option.recoverySummary}</small></span>
          </label>
        ))}
      </fieldset>
      {options.length > initialOptions.length && <button type="button" className="plan-text-action" onClick={() => setShowAll(value => !value)}>
        {showAll ? "추천 훈련만 보기" : `다른 훈련 보기 (${options.length - initialOptions.length})`}
      </button>}
      {coverage === null && <p role="status">보관된 계획 이력을 읽지 못해 추천 횟수를 표시하지 않았어요. 저장된 원본은 변경하지 않았어요.</p>}
      {coverage !== undefined && coverage !== null && <details className="plan-method-picker__history">
        <summary>추천에 참고한 이력</summary>
        <p>보관된 계획 {coverage.retainedPlans}개 중 같은 종목 {coverage.matchingPlans}개를 확인했어요. 전체 종목을 합쳐 최근 18개 계획까지 보관해요.</p>
        {coverage.earliestArchive !== null && coverage.latestArchive !== null && <p>계획 보관 날짜 (UTC): {coverage.earliestArchive.slice(0, 10)} ~ {coverage.latestArchive.slice(0, 10)}</p>}
        <p>실제 훈련 날짜와 연속 관찰 기간은 이 요약으로 확인할 수 없어요. 24주 전체 훈련 이력이 아니에요.</p>
        <p>완료 여부 미기록 {coverage.missingOutcomes}건 · 방법을 확인할 수 없는 참조 {coverage.unmappedReferences}건 · 종목을 알 수 없는 과거 계획 {coverage.unknownEventPlans}개</p>
        <p>미기록은 운동하지 않았다는 뜻이 아니에요. 방법을 확인할 수 없는 참조는 추천 횟수에서 제외해요.</p>
        {options.map(option => option.observedPerformedCount === undefined ? null : <p key={JSON.stringify(option.ref)}>
          {option.mainSummary}: {option.selectedCount === undefined ? "" : `선택 ${option.selectedCount}회 · `}자기보고 완료 {option.observedPerformedCount}회</p>)}
        <p>진행 중인 계획의 이력은 포함되지 않아요. 실제 방법·수치대로 수행했는지를 측정한 결과는 아니에요.</p>
      </details>}
      <details id={`${id}-help`}><summary>훈련을 바꾸면 어떻게 되나요?</summary><p>상세 방법을 바꾸면 기준 기록을 다시 확인해요. 변경한 방법은 한 주요 훈련에 적용하며, 다른 날의 훈련을 추가하지 않아요.</p></details>
      {distinct.length < 2 && <p className="plan-method-picker__limit">{options.length === 0
        ? "이 조건에서 선택할 수 있는 상세 방법은 아직 없어요. 시간과 체감 강도로 안내받을 수 있어요."
        : "지금 선택할 수 있는 상세 방법은 1개예요. 다른 방법은 준비 중이에요."}</p>}
    </details>
  )
}
