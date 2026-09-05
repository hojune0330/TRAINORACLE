import React from "react"
import { ChevronDown, SlidersHorizontal } from "lucide-react"
import type { PlanBetaIntake } from "../../domain/plan-beta-store"
import { sameDetailedTemplateReference } from "../../domain/plan-method-selection"
import type { DetailedPlanTemplateOption } from "./plan-template-options"
import type { RepeatPreference } from "@impl/prescription/method-recommendation"

export function PlanMethodPicker({ options, selected, onChange, repeatPreference = "NEUTRAL", onRepeatPreferenceChange }: {
  readonly options: readonly DetailedPlanTemplateOption[]
  readonly selected: PlanBetaIntake["selectedDetailedTemplateRef"]
  readonly onChange: (reference: PlanBetaIntake["selectedDetailedTemplateRef"]) => void
  readonly repeatPreference?: RepeatPreference
  readonly onRepeatPreferenceChange?: (preference: RepeatPreference) => void
}) {
  const id = React.useId()
  const [showAll, setShowAll] = React.useState(false)
  const current = options.find(option => sameDetailedTemplateReference(option.ref, selected))
  const coverage = options[0]?.historyCoverage
  const initialOptions = options.filter((option, index) => option.recommended ?? index < 2)
  const shownOptions = showAll ? options : options.filter(option => initialOptions.includes(option) || option === current)
  const eligibleFamilyCount = new Set(options.flatMap(option => option.method === undefined ? [] : [option.method.familyId])).size
  return (
    <details className="plan-method-picker">
      <summary>
        <SlidersHorizontal size={16} aria-hidden="true" />
        <span>훈련 방법 선택<small>{selected === null ? "시간·RPE 기준" : current?.mainSummary ?? "선택한 상세 훈련 확인 필요"}</small></span>
        <ChevronDown className="plan-method-picker__chevron" size={16} aria-hidden="true" />
      </summary>
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
      <fieldset aria-describedby={`${id}-help`}>
        <legend>본운동 안내 방식과 방법</legend>
        <label className="plan-method-picker__option">
          <input type="radio" name={`${id}-method`} checked={selected === null} onChange={() => onChange(null)} />
          <span><strong>시간·RPE 기준으로 받기</strong><small>경기 기록 없이 운동 시간과 체감 강도를 안내해요. 반복 구간과 목표 페이스는 정하지 않아요.</small></span>
        </label>
        {shownOptions.map(option => (
          <label className="plan-method-picker__option" key={`${option.ref.templateId}@${option.ref.version}`}>
            <input type="radio" name={`${id}-method`}
              checked={sameDetailedTemplateReference(selected, option.ref)}
              onChange={() => onChange(option.ref)} />
            <span><strong>{option.mainSummary}</strong><small>{option.recoverySummary}</small><small>현재 {option.targetEventDistanceM}m 기록의 경기 페이스</small>{option.recommendationReason !== undefined && <small>{option.recommendationReason}</small>}
              {option.observedPerformedCount !== undefined && option.historyCoverage !== null && <>
                <small>보관된 계획 세션: {option.selectedCount === undefined ? "" : `선택 ${option.selectedCount}회 · `}자기보고 완료 {option.observedPerformedCount}회</small>
                <small>진행 중인 계획의 이력은 포함되지 않아요. 계획 세션의 자기보고 완료 집계이며, 실제 방법·수치대로 수행했는지는 측정하지 않았어요. 미기록은 미수행을 뜻하지 않아요.</small>
              </>}
            </span>
          </label>
        ))}
      </fieldset>
      {options.length > initialOptions.length && <button type="button" className="plan-text-action" onClick={() => setShowAll(value => !value)}>
        {showAll ? "추천 훈련만 보기" : `다른 훈련 보기 (${options.length - initialOptions.length})`}
      </button>}
      {coverage === null && <p role="status">보관된 계획 이력을 읽지 못해 추천 횟수를 표시하지 않았어요. 저장된 원본은 변경하지 않았어요.</p>}
      {coverage !== undefined && coverage !== null && <details>
        <summary>추천에 참고한 이력</summary>
        <p>보관된 계획 {coverage.retainedPlans}개 중 같은 종목 {coverage.matchingPlans}개를 확인했어요. 전체 종목을 합쳐 최근 18개 계획까지 보관해요.</p>
        {coverage.earliestArchive !== null && coverage.latestArchive !== null && <p>계획 보관 날짜 (UTC): {coverage.earliestArchive.slice(0, 10)} ~ {coverage.latestArchive.slice(0, 10)}</p>}
        <p>실제 훈련 날짜와 연속 관찰 기간은 이 요약으로 확인할 수 없어요. 24주 전체 훈련 이력이 아니에요.</p>
        <p>완료 여부 미기록 {coverage.missingOutcomes}건 · 방법을 확인할 수 없는 참조 {coverage.unmappedReferences}건 · 종목을 알 수 없는 과거 계획 {coverage.unknownEventPlans}개</p>
        <p>미기록은 운동하지 않았다는 뜻이 아니에요. 방법을 확인할 수 없는 참조는 추천 횟수에서 제외해요.</p>
      </details>}
      <p id={`${id}-help`}>상세 방법을 바꾸면 기준 기록을 다시 확인해요. 변경한 방법은 한 주요 훈련에 적용하며, 다른 날의 훈련을 추가하지 않아요.</p>
      {options.length < 2 && <p className="plan-method-picker__limit">{options.length === 0
        ? "이 조건에서 선택할 수 있는 상세 방법은 아직 없어요. 시간·RPE 기준으로 계획을 받을 수 있어요."
        : "이 조건에서 제공하는 상세 방법은 현재 1개예요. 시간·RPE 기준은 다른 상세 방법으로 세지 않아요."}</p>}
    </details>
  )
}
