import React from "react"
import { ArrowLeft } from "lucide-react"
import { resolveGoalProgramWindow, TEN_K_GOAL_MINUTES, tenKGoalPaceLabel,
  type GoalProgramWindow, type TenKGoalMinutes } from "../../domain/goal-program-calendar"
import { useTaskFlowBack } from "../../hooks/useTaskFlowBack"
import "./instant-plan.css"
import "./instant-plan-entry-steps.css"

export type GoalProgramPreviewRequest = Readonly<{ goalMinutes: TenKGoalMinutes; window: GoalProgramWindow }>

/** Presentation-only entry. The integration must supply a reviewed program before
 * mounting this flow. Selecting dates neither generates training nor activates it.
 * No journal/account reads, browser storage, or current-ability defaults here.
 */
export function GoalProgramEntry({ today, readToday, onPreview, onBack, disabled = false, initialRequest, onDraftChange }: {
  today: string
  readToday?: () => string
  onPreview: (request: GoalProgramPreviewRequest) => void
  onBack: () => void
  disabled?: boolean
  initialRequest?: GoalProgramPreviewRequest
  onDraftChange?: (dirty: boolean) => void
}) {
  const [goal, setGoal] = React.useState<TenKGoalMinutes | null>(initialRequest?.goalMinutes ?? null)
  const [mode, setMode] = React.useState<"TODAY" | "START" | "DEADLINE">(
    initialRequest?.window.deadline ? "DEADLINE" : initialRequest ? "START" : "TODAY")
  const [startDate, setStartDate] = React.useState(initialRequest?.window.startDate ?? today)
  const [deadline, setDeadline] = React.useState(initialRequest?.window.deadline ?? "")
  const [error, setError] = React.useState<string | null>(null)
  const [tooClose, setTooClose] = React.useState(false)
  const heading = React.useRef<HTMLHeadingElement>(null)
  const id = React.useId()
  React.useEffect(() => { onDraftChange?.(goal !== null || mode !== "TODAY" || startDate !== today || deadline !== "") },
    [goal, mode, startDate, deadline, today, onDraftChange])
  React.useLayoutEffect(() => { heading.current?.focus() }, [goal])
  const back = () => { setError(null); setTooClose(false); if (goal === null) onBack(); else setGoal(null) }
  useTaskFlowBack({ enabled: true, busy: disabled, onBack: back })

  const preview = (fromToday = false) => {
    if (disabled || goal === null) return
    const freshToday = readToday?.() ?? today
    const result = resolveGoalProgramWindow(!fromToday && mode === "DEADLINE"
      ? { kind: "DEADLINE", deadline }
      : { kind: "START", startDate: fromToday || mode === "TODAY" ? freshToday : startDate }, freshToday)
    setTooClose(false)
    if (result.kind === "invalid-date") { setError("날짜를 확인해 주세요."); return }
    if (result.kind === "start-in-past") {
      setTooClose(true)
      setError(mode === "DEADLINE"
        ? `9.5일 훈련 세 번을 마치려면 ${result.requiredStartDate}에 시작해야 해요. 남은 기간에 훈련을 몰아넣지는 않아요.`
        : "시작일은 오늘 또는 이후 날짜로 골라 주세요.")
      return
    }
    setError(null)
    onPreview({ goalMinutes: goal, window: result.window })
  }

  return <section className="instant-plan" aria-labelledby={`${id}-heading`}>
    <button type="button" className="instant-plan__step-back" disabled={disabled} onClick={back}>
      <ArrowLeft size={18} aria-hidden="true" />{goal === null ? "뒤로" : "목표 다시 선택"}
    </button>
    <h2 id={`${id}-heading`} ref={heading} tabIndex={-1} className="instant-plan__step-heading">
      {goal === null ? "10km, 몇 분을 목표로 할까요?" : "언제 시작할까요?"}
    </h2>
    {goal === null ? <>
      <div className="instant-plan__step-choices instant-plan__basis-choices app-choice-group" role="group" aria-label="10km 목표 선택">
        {TEN_K_GOAL_MINUTES.map(value => <button type="button" key={value} disabled={disabled}
          className="instant-plan__step-choice app-choice-control app-choice-control--answer"
          aria-label={`${value}분 목표`} onClick={() => setGoal(value)}>
          <span>{value}분</span><span className="instant-plan__hint">1km에 {tenKGoalPaceLabel(value).replace("/km", "")}</span>
        </button>)}
      </div>
    </> : <form noValidate onSubmit={event => { event.preventDefault(); preview() }} className="instant-plan__step">
      <p>10km {goal}분 목표 · 한 달 · 9.5일 × 3</p>
      <fieldset disabled={disabled} className="instant-plan__fields">
        <legend>훈련표 날짜</legend>
        <div className="instant-plan__step-choices instant-plan__basis-choices app-choice-group">
          {([["TODAY", "오늘부터"], ["START", "시작일 선택"], ["DEADLINE", "대회 날짜에 맞추기"]] as const).map(([value, label]) =>
            <button type="button" className="instant-plan__step-choice app-choice-control" key={value} aria-pressed={mode === value}
              onClick={() => { setMode(value); setError(null); setTooClose(false) }}>{label}</button>)}
        </div>
        {mode !== "TODAY" && <div className="instant-plan__field">
          <label htmlFor={`${id}-date`}>{mode === "START" ? "시작일" : "대회 날짜"}</label>
          <input id={`${id}-date`} type="date" min={readToday?.() ?? today}
            value={mode === "START" ? startDate : deadline} aria-invalid={!!error}
            aria-describedby={error ? `${id}-error` : undefined}
            onChange={event => {
              if (mode === "START") setStartDate(event.target.value); else setDeadline(event.target.value)
              setError(null); setTooClose(false)
            }} />
        </div>}
        {mode === "DEADLINE" && <p className="instant-plan__hint">대회 전 훈련량은 자동으로 줄이지 않아요.</p>}
      </fieldset>
      {error && <p id={`${id}-error`} role="alert">{error}</p>}
      {tooClose && <button type="button" className="instant-plan__button" disabled={disabled} onClick={() => preview(true)}>
        오늘을 시작일로 선택
      </button>}
      {!tooClose && <button type="submit" className="instant-plan__button" disabled={disabled}>다음</button>}
    </form>}
  </section>
}
