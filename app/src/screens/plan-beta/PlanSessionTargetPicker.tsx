import React from "react"
import { CalendarDays, ChevronDown } from "lucide-react"
import { isValidIsoDate, isoShift } from "../../domain/dates"
import { samePlanSessionTarget, type PlanSessionTarget } from "../../domain/plan-session-target"

export function PlanSessionTargetPicker({ targets, selected, startDate, onChange }: {
  readonly targets: readonly PlanSessionTarget[]
  readonly selected: PlanSessionTarget | null
  readonly startDate: string
  readonly onChange: (target: PlanSessionTarget) => void
}) {
  const id = React.useId()
  const unavailable = selected !== null && !targets.some(target => samePlanSessionTarget(selected, target))
  const current = unavailable ? null : selected ?? targets[0] ?? null
  if (targets.length < 2 && !unavailable) return null
  return <details className="plan-method-picker">
    <summary><CalendarDays size={16} aria-hidden="true" /><span>상세 훈련을 적용할 날<small>{current === null ? "선택 필요" : targetLabel(current, startDate)}</small></span><ChevronDown className="plan-method-picker__chevron" size={16} aria-hidden="true" /></summary>
    {unavailable && <p role="status">일정이 바뀌었어요. 적용할 날을 다시 골라주세요.</p>}
    <fieldset aria-describedby={`${id}-help`}>
      <legend>개인 페이스로 안내받을 주요 훈련</legend>
      {targets.map(target => <label className="plan-method-picker__option" key={`${target.day}:${target.slot}`}>
        <input type="radio" name={`${id}-target`}
          checked={samePlanSessionTarget(current, target)}
          onChange={() => onChange(target)} />
        <span><strong>{targetLabel(target, startDate)}</strong></span>
      </label>)}
    </fieldset>
    <p id={`${id}-help`}>고른 날의 주요 훈련에 상세 방법을 적용해요. 현재는 계획당 한 번 적용하며, 다른 날의 시간·RPE 안내는 유지해요.</p>
  </details>
}

function targetLabel(target: PlanSessionTarget, startDate: string): string {
  const slot = target.slot === "AM" ? "오전" : "오후"
  if (!isValidIsoDate(startDate)) return `${target.day}일 차 ${slot}`
  const date = isoShift(startDate, target.day - 1)
  const weekday = new Intl.DateTimeFormat("ko-KR", { weekday: "short", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`))
  return `${date.slice(5).replace("-", "/")} (${weekday}) ${slot}`
}
