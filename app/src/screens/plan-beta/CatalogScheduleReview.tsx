import React from "react"
import { catalogRequirementLabels, type CatalogScheduleCondition } from "../../domain/catalog-schedule-conditions"

export function CatalogScheduleReview({ conditions, disabled, onConfirm }: {
  readonly conditions: readonly CatalogScheduleCondition[]
  readonly disabled: boolean
  readonly onConfirm: () => void
}) {
  const [checked, setChecked] = React.useState<readonly string[]>([])
  const requirements = [...new Set(conditions.flatMap(condition => condition.requirements))]
  return <fieldset className="catalog-workout-picker__required catalog-schedule-review" disabled={disabled}>
    <legend>이 날짜에도 운동할 환경이 갖춰져 있나요?</legend>
    <p>훈련 내용은 그대로예요. 아래 날짜에 사용할 장소·장비만 다시 확인해 주세요.</p>
    {requirements.map(requirement => {
      const dates = [...new Set(conditions.filter(condition => condition.requirements.includes(requirement))
        .map(condition => `${condition.date} ${condition.slot === "AM" ? "오전" : "오후"}`))]
      return <label key={requirement}><input type="checkbox" checked={checked.includes(requirement)}
        onChange={event => setChecked(previous => event.target.checked ? [...previous, requirement]
          : previous.filter(value => value !== requirement))} />
        <span>{catalogRequirementLabels[requirement]}<small>{dates.join(" · ")}</small></span>
      </label>
    })}
    <button type="button" className="instant-plan__secondary" disabled={disabled || !requirements.every(requirement => checked.includes(requirement))}
      onClick={() => { if (!disabled && requirements.every(requirement => checked.includes(requirement))) onConfirm() }}>
      이 날짜의 조건 확인
    </button>
  </fieldset>
}
