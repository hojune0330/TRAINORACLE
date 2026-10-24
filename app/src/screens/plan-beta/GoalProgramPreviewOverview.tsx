import React from "react"
import { ChevronLeft, ChevronRight, Moon, Pause, Play, SlidersHorizontal, Timer } from "lucide-react"
import { resolveCatalogBinding } from "@impl/prescription/catalog-session-binding"
import type { WorkoutCalculatedStep } from "@impl/prescription/all-workout-calculator"
import type { PlanSession } from "@impl/plan-generator/types"
import type { GoalTrainingProgramPreview } from "../../domain/goal-training-program"
import { tenKGoalPaceLabel } from "../../domain/goal-program-calendar"
import { notationDistance, notationEffort } from "../../domain/workout-notation"
import { useCalendarMotion } from "../../hooks/useCalendarMotion"
import { EXPERIENCE_LABELS, EXECUTION_STOP_CUE, formatTrainingSeconds, sessionLabel } from "./labels"
import { projectInstantExecutionSteps } from "./instant-plan-today"
import "./goal-program-preview.css"

type ProgramDisplay = Pick<GoalTrainingProgramPreview, "window" | "days" | "inputs" | "goalMinutes">
export type ScheduleOrigin = "DEFAULT" | "USER" | "RESTORED_ORIGIN_UNKNOWN"
const shortDate = (date: string) => date.slice(5).replace("-", "/")
const duration = (range: { minimum: number; maximum: number } | null) => range
  ? formatTrainingSeconds(range.minimum) + (range.minimum === range.maximum ? "" : "~" + formatTrainingSeconds(range.maximum)) : "시간 확인 필요"
const phaseName = { warmup: "준비", main: "본운동", cooldown: "정리" }
function stepName(step: WorkoutCalculatedStep): string {
  if (step.kind === "BUILDUP") return "가속 달리기"
  const modes: Record<string, string> = { RUN: "달리기", RUNNING: "달리기", JOG: "조깅", WALK: "걷기", STAND: "서서 쉬기",
    WALK_OR_JOG: "걷기 또는 조깅", WALK_OR_STAND: "걷거나 서서 쉬기", ACTIVE_ROLL_ON: "달리며 회복" }
  return modes[step.modality] ?? (step.kind === "RECOVERY" ? "회복" : phaseName[step.phase])
}
function stepInstruction(step: WorkoutCalculatedStep): string {
  const text = notationEffort(step.instruction, "PLAIN").replace(/10000m/g, "10km").replace(/ RP\b/g, " 속도")
  // Omit only an exact generated recovery amount already printed in the title.
  if (step.kind === "RECOVERY" && step.distanceM === null && step.seconds?.minimum === step.seconds?.maximum
    && text === stepName(step) + " " + step.seconds?.minimum + "초") return ""
  return text
}

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
export function GoalProgramSession({ session, date, label, disabled = false, stepIndex = 0, onStepChange }: {
  session: PlanSession; date: string; label: string; disabled?: boolean; stepIndex?: number; onStepChange: (index: number) => void
}) {
  const binding = session.prescription.kind === "RPE_TIME_RANGE" ? session.prescription.catalogWorkout : undefined
  const calculation = React.useMemo(() => binding ? resolveCatalogBinding(binding) : null, [binding])
  const steps = calculation?.steps ?? []
  const activeIndex = Math.min(stepIndex, Math.max(0, steps.length - 1))
  const [playing, setPlaying] = React.useState(false)
  const { reduced } = useCalendarMotion()
  React.useEffect(() => { setPlaying(false) }, [date, binding])
  React.useEffect(() => {
    if (!playing || reduced || disabled || steps.length < 2) return
    const timer = window.setTimeout(() => {
      if (activeIndex >= steps.length - 1) setPlaying(false)
      else onStepChange(activeIndex + 1)
    }, 1800)
    return () => window.clearTimeout(timer)
  }, [playing, reduced, disabled, activeIndex, steps.length, onStepChange])
  React.useEffect(() => {
    if (reduced || disabled) setPlaying(false)
    const stop = () => { if (document.hidden) setPlaying(false) }
    document.addEventListener("visibilitychange", stop)
    return () => document.removeEventListener("visibilitychange", stop)
  }, [reduced, disabled])
  const choose = (index: number) => { if (activeIndex !== index) { setPlaying(false); onStepChange(index) } }
  if (session.role === "REST") return <section className="goal-preview__session goal-preview__rest-day" aria-label="선택한 날짜의 휴식">
    <Moon size={24} aria-hidden="true" /><h3>{shortDate(date)} · 휴식</h3><p>이 날짜에는 훈련이 배치되지 않았어요.</p>
  </section>
  return <section className="goal-preview__session" data-reduced-motion={reduced || undefined} aria-label="선택한 훈련 구간">
    <div className="goal-preview__session-heading"><div><span>{label} · {shortDate(date)} · {session.slot === "AM" ? "오전" : "오후"}</span>
      <h3>{sessionLabel(session, true)}</h3></div>{calculation && <span className="goal-preview__duration"><Timer size={16} aria-hidden="true" />총 {duration(calculation.totals.seconds)}</span>}</div>
    {binding && !calculation ? <p role="alert">이 훈련의 구간을 확인하지 못했어요. 확인되지 않은 시간이나 속도는 표시하지 않아요.</p> : steps.length ? <>
      <ol className="goal-preview__sequence" aria-label="전체 훈련 순서">{steps.map((step, index) => <li key={step.key}>
        <button type="button" disabled={disabled} aria-pressed={activeIndex === index} onClick={() => choose(index)}>
          <span className="goal-preview__step-number" aria-hidden="true">{index + 1}</span><span>
            <strong>{stepName(step)} · {duration(step.seconds)}{step.distanceM !== null && " · " + notationDistance(step.distanceM)}</strong>
            {step.paceSecondsPerKm && <small>{step.targetModel === "GOAL_RACE_REFERENCE" ? "목표 기록 기준" : step.targetModel === "ACTUAL_RACE_REFERENCE" ? "실제 기록 기준" : "구간 속도"} · 1km {duration(step.paceSecondsPerKm)}</small>}
            {stepInstruction(step) && <small>{stepInstruction(step)}</small>}
          </span><span className="goal-preview__phase">{step.kind === "RECOVERY" ? "회복" : phaseName[step.phase]}</span>
        </button></li>)}</ol>
      <details className="goal-program__details goal-preview__replay" onToggle={event => { if (!event.currentTarget.open) setPlaying(false) }}><summary>구간 순서 재생</summary>
        <p className="goal-preview__caption">순서만 짧게 보여줘요. 운동 타이머는 아니에요.</p>
        <div className="goal-preview__playback">
          <button type="button" disabled={disabled || activeIndex === 0} aria-label="이전 구간" onClick={() => choose(activeIndex - 1)}><ChevronLeft size={20} aria-hidden="true" /></button>
          {!reduced && <button type="button" disabled={disabled || steps.length < 2} onClick={() => { if (!playing && activeIndex === steps.length - 1) onStepChange(0); setPlaying(!playing) }}>{playing ? <Pause size={17} aria-hidden="true" /> : <Play size={17} aria-hidden="true" />}{playing ? "미리보기 멈추기" : "순서 미리보기"}</button>}
          <button type="button" disabled={disabled || activeIndex === steps.length - 1} aria-label="다음 구간" onClick={() => choose(activeIndex + 1)}><ChevronRight size={20} aria-hidden="true" /></button>
        </div><p role="status" className="goal-preview__caption">{activeIndex + 1} / {steps.length}구간 · {steps[activeIndex] && stepName(steps[activeIndex])}</p>
      </details>
      {steps.some(step => step.targetModel === "GOAL_RACE_REFERENCE" || step.targetModel === "ACTUAL_RACE_REFERENCE") && <p className="goal-preview__caption">힘들면 속도를 낮추거나 중단하세요. 실제 힘든 정도(RPE)는 따로 기록해요.</p>}
      <p className="goal-preview__caption">{EXECUTION_STOP_CUE}</p>
    </> : <>
      {session.prescription.kind === "RPE_TIME_RANGE" && session.role === "QUALITY" && <p>시간·힘든 정도 안내예요. 반복 횟수와 회복 시간은 아직 정하지 않았어요. 총 시간을 계속 강하게 달리는 시간으로 쓰지 마세요.</p>}
      {projectInstantExecutionSteps(session).map((step, index) => <p key={index}><strong>{step.label}</strong> · {step.instruction}</p>)}
    </>}
  </section>
}
