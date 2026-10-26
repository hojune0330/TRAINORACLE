import React from "react"
import { Moon, SlidersHorizontal, Timer } from "lucide-react"
import { resolveCatalogBinding } from "@impl/prescription/catalog-session-binding"
import type { PlanSession } from "@impl/plan-generator/types"
import type { GoalTrainingProgramPreview } from "../../domain/goal-training-program"
import { tenKGoalPaceLabel } from "../../domain/goal-program-calendar"
import { buildWorkoutVisualGuide } from "../../domain/workout-visual-guide"
import type { WorkoutMemoContext } from "../../domain/workout-memo"
import { VisualTrainingGuide } from "../../components/VisualTrainingGuide"
import { EXPERIENCE_LABELS, EXECUTION_STOP_CUE, formatTrainingSeconds, sessionLabel } from "./labels"
import { projectInstantExecutionSteps } from "./instant-plan-today"
import "./goal-program-preview.css"

type ProgramDisplay = Pick<GoalTrainingProgramPreview, "window" | "days" | "inputs" | "goalMinutes">
export type ScheduleOrigin = "DEFAULT" | "USER" | "RESTORED_ORIGIN_UNKNOWN"
const shortDate = (date: string) => date.slice(5).replace("-", "/")
const duration = (range: { minimum: number; maximum: number } | null) => range
  ? formatTrainingSeconds(range.minimum) + (range.minimum === range.maximum ? "" : "~" + formatTrainingSeconds(range.maximum)) : "시간 확인 필요"

/** Actual source days; defaults never become a personal recommendation. */
export function GoalProgramPreviewOverview({ source, disabled = false, onEditSchedule, onEditBasis,
  scheduleOrigin = "RESTORED_ORIGIN_UNKNOWN", status = "미리보기 · 아직 시작하지 않았어요" }: {
  source: ProgramDisplay; disabled?: boolean; onEditSchedule?: () => void; onEditBasis?: () => void
  scheduleOrigin?: ScheduleOrigin; status?: string
}) {
  const workouts = source.days.filter(day => day.session.role !== "REST")
  const quality = workouts.filter(day => day.session.role === "QUALITY").length
  const easy = workouts.filter(day => day.session.role === "EASY").length
  const rest = source.days.filter(day => day.session.role === "REST").length
  return <section className="goal-preview" aria-label="계획 구성">
    <div className="goal-preview__topline"><span>{status}</span><span>{source.window.startDate} ~ {shortDate(source.window.endDate)}</span></div>
    <p className="goal-preview__summary"><strong>훈련 {workouts.length}회</strong><span>주요 {quality}회 · 쉬운 훈련 {easy}회 · 휴식 {rest}일</span></p>
    <div className="goal-preview__conditions">
      <p>9.5일마다 {source.inputs.availableDayCount === "EVERY_DAY" ? "매일" : source.inputs.availableDayCount + "일 훈련"}
        {scheduleOrigin === "DEFAULT" && <span className="goal-preview__origin">훈련일 기본값</span>}</p>
      {onEditSchedule && <button type="button" data-goal-edit="schedule" className="goal-preview__edit" onClick={onEditSchedule} disabled={disabled}><SlidersHorizontal size={16} aria-hidden="true" />훈련 횟수 바꾸기</button>}
    </div>
    <div className="goal-preview__conditions"><p>{source.inputs.goalPaceConfirmed ? "목표 속도 · 1km " + tenKGoalPaceLabel(source.goalMinutes).replace("/km", "") : "시간·힘든 정도 기준"}</p>
      {onEditBasis && <button type="button" data-goal-edit="basis" className="goal-preview__edit" onClick={onEditBasis} disabled={disabled}>훈련 방식 바꾸기</button>}</div>
    <details className="goal-program__details goal-preview__reason"><summary>계획을 만든 기준</summary>
      <p>선택한 경험 · {EXPERIENCE_LABELS[source.inputs.experienceBand].title}</p>
      <p>달리기 경험과 훈련할 날 수에 맞춰 기존 훈련 구성을 배치했어요. 한 달 기본 훈련은 9.5일씩 세 번이며 하루 최대 한 번 달려요.</p>
      <p>{scheduleOrigin === "DEFAULT" ? "훈련일은 처음 설정된 3일이에요. 개인에게 필요한 횟수를 계산한 값은 아니에요." : scheduleOrigin === "USER" ? "훈련할 날 수는 직접 선택한 값이에요." : "이 훈련표를 만들 때 사용한 설정이에요. 이전 값이 직접 선택인지 기본값인지는 확인할 수 없어요."}</p>
      <p>10km {source.goalMinutes}분은 입력한 목표예요. 현재 실력이나 달성 가능성을 계산한 값은 아니에요.{source.inputs.goalPaceConfirmed && " 목표 속도는 속도가 적힌 구간에만 적용해요."}</p>
      {!source.inputs.goalPaceConfirmed && <p>시간 기준 훈련은 목표 기록만 바꿔도 훈련량이 늘거나 줄지 않아요. 경험과 훈련할 날 수를 바꾸면 구성이 달라질 수 있어요.</p>}
    </details>
    {source.window.deadline && <p className="goal-preview__deadline">대회 날짜 · {source.window.deadline}. 대회 전 훈련량은 자동으로 줄이지 않아요.</p>}
  </section>
}

/** Shared read-only prescription for preview and saved programs. Not a training timer. */
export function GoalProgramSession({ session, date, label, disabled = false, stepIndex = 0, onStepChange, state = "PLAN" }: {
  session: PlanSession; date: string; label: string; disabled?: boolean; stepIndex?: number; onStepChange: (index: number) => void; state?: WorkoutMemoContext["state"]
}) {
  const binding = session.prescription.kind === "RPE_TIME_RANGE" ? session.prescription.catalogWorkout : undefined
  const calculation = React.useMemo(() => binding ? resolveCatalogBinding(binding) : null, [binding])
  const guide = React.useMemo(() => buildWorkoutVisualGuide(session, { date, state }, { detail: true }), [session, date, state])
  const previousGuide = React.useRef(guide?.id)
  React.useEffect(() => {
    if (previousGuide.current === guide?.id) return
    previousGuide.current = guide?.id
    onStepChange(0)
  }, [guide?.id, onStepChange])
  if (session.role === "REST") return <section className="goal-preview__session goal-preview__rest-day" aria-label="선택한 날짜의 휴식">
    <Moon size={24} aria-hidden="true" /><h3>{shortDate(date)} · 휴식</h3><p>이 날짜에는 훈련이 배치되지 않았어요.</p>
  </section>
  return <section className="goal-preview__session" aria-label="선택한 훈련 구간">
    <div className="goal-preview__session-heading"><div><span>{label} · {shortDate(date)} · {session.slot === "AM" ? "오전" : "오후"}</span>
      <h3>{sessionLabel(session, true)}</h3></div>{calculation && <span className="goal-preview__duration"><Timer size={16} aria-hidden="true" />총 {duration(calculation.totals.seconds)}</span>}</div>
    {binding && !calculation ? <p role="alert">이 훈련의 구간을 확인하지 못했어요. 확인되지 않은 시간이나 속도는 표시하지 않아요.</p> : guide ? <>
      <VisualTrainingGuide guide={guide} selectedIndex={stepIndex} onSelect={onStepChange} disabled={disabled} />
      {calculation?.steps.some(step => step.targetModel === "GOAL_RACE_REFERENCE" || step.targetModel === "ACTUAL_RACE_REFERENCE") && <p className="goal-preview__caption">힘들면 속도를 낮추거나 중단하세요. 실제 힘든 정도(RPE)는 따로 기록해요.</p>}
      <p className="goal-preview__caption">{EXECUTION_STOP_CUE}</p>
    </> : <>
      {session.prescription.kind === "RPE_TIME_RANGE" && session.role === "QUALITY" && <p>시간·힘든 정도 안내예요. 반복 횟수와 회복 시간은 아직 정하지 않았어요. 총 시간을 계속 강하게 달리는 시간으로 쓰지 마세요.</p>}
      {projectInstantExecutionSteps(session).map((step, index) => <p key={index}><strong>{step.label}</strong> · {step.instruction}</p>)}
    </>}
  </section>
}
