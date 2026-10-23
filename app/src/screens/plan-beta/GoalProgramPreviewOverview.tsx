import React from "react"
import { ArrowRight, ChevronLeft, ChevronRight, Footprints, Pause, Play, SlidersHorizontal, Timer } from "lucide-react"
import { resolveCatalogBinding } from "@impl/prescription/catalog-session-binding"
import type { WorkoutCalculatedStep } from "@impl/prescription/all-workout-calculator"
import type { GoalTrainingProgramPreview } from "../../domain/goal-training-program"
import { summarizeGoalTrainingProgram } from "../../domain/goal-training-program-summary"
import { tenKGoalPaceLabel } from "../../domain/goal-program-calendar"
import { notationDistance, notationEffort } from "../../domain/workout-notation"
import { useTaskStepMotion } from "../../hooks/useTaskStepMotion"
import { EXPERIENCE_LABELS, EXECUTION_STOP_CUE, formatTrainingSeconds, sessionExecutionSteps, sessionLabel } from "./labels"
import "./goal-program-preview.css"

const shortDate = (date: string) => date.slice(5).replace("-", "/")
const duration = (range: { minimum: number; maximum: number } | null) => range
  ? `${formatTrainingSeconds(range.minimum)}${range.minimum === range.maximum ? "" : `~${formatTrainingSeconds(range.maximum)}`}` : "시간 확인 필요"
const phaseName = { warmup: "준비", main: "본운동", cooldown: "정리" }
const stepInstruction = (step: WorkoutCalculatedStep) => notationEffort(step.instruction, "PLAIN").replace(/10000m/g, "10km").replace(/ RP\b/g, " 속도")
function stepName(step: WorkoutCalculatedStep): string {
  const modes: Record<string, string> = { RUN: "달리기", RUNNING: "달리기", JOG: "조깅", WALK: "걷기", STAND: "서서 쉬기",
    WALK_OR_JOG: "걷기 또는 조깅", WALK_OR_STAND: "걷거나 서서 쉬기", ACTIVE_ROLL_ON: "달리며 회복" }
  return modes[step.modality] ?? (step.kind === "RECOVERY" ? "회복" : step.kind === "BUILDUP" ? "가속 달리기" : phaseName[step.phase])
}

/** A read-only view of the generated plan. Selecting and replaying never starts a workout. */
export function GoalProgramPreviewOverview({ source, disabled = false, onEditSchedule, onEditBasis }: {
  source: GoalTrainingProgramPreview
  disabled?: boolean
  onEditSchedule: () => void
  onEditBasis: () => void
}) {
  const summary = React.useMemo(() => summarizeGoalTrainingProgram(source), [source])
  const [cycle, setCycle] = React.useState(1)
  const [selectedDate, setSelectedDate] = React.useState("")
  const [stepIndex, setStepIndex] = React.useState(0)
  const [playing, setPlaying] = React.useState(false)
  const surface = React.useRef<HTMLElement>(null)
  const workouts = source.days.filter(day => day.session.role !== "REST")
  const easyCount = workouts.filter(day => day.session.role === "EASY").length
  const qualityCount = workouts.filter(day => day.session.role === "QUALITY").length
  const restCount = source.days.filter(day => day.session.role === "REST").length
  const cycleDays = workouts.filter(day => day.cycle === cycle)
  const selected = cycleDays.find(day => day.date === selectedDate) ?? cycleDays[0]
  const selectedSummary = summary.frames.find(frame => frame.cycle === cycle)?.workouts
    .find(workout => workout.day === selected?.session.day && workout.slot === selected.session.slot)
  const binding = selected?.session.prescription.kind === "RPE_TIME_RANGE" ? selected.session.prescription.catalogWorkout : undefined
  const calculation = React.useMemo(() => binding ? resolveCatalogBinding(binding) : null, [binding])
  const steps = calculation?.steps ?? []
  const activeIndex = Math.min(stepIndex, Math.max(0, steps.length - 1))
  const activeStep = steps[activeIndex]
  const reduced = useTaskStepMotion(`${cycle}:${selected?.date ?? ""}:${activeIndex}`, surface)
  React.useEffect(() => { setStepIndex(0); setPlaying(false) }, [source, selected?.date])
  React.useEffect(() => {
    if (!playing || reduced || disabled || steps.length < 2) return
    const timer = window.setTimeout(() => {
      if (activeIndex >= steps.length - 1) setPlaying(false)
      else setStepIndex(activeIndex + 1)
    }, 1800)
    return () => window.clearTimeout(timer)
  }, [playing, reduced, disabled, activeIndex, steps.length])
  React.useEffect(() => {
    if (reduced || disabled) setPlaying(false)
    const stop = () => { if (document.hidden) setPlaying(false) }
    document.addEventListener("visibilitychange", stop)
    return () => document.removeEventListener("visibilitychange", stop)
  }, [reduced, disabled])
  const chooseStep = (index: number) => { setPlaying(false); setStepIndex(index) }

  return <div className="goal-preview" data-reduced-motion={reduced || undefined}>
    <section className="goal-preview__overview" aria-label="계획 구성">
      <div className="goal-preview__topline"><span className="goal-preview__badge">미리보기 · 아직 시작하지 않았어요</span>
        <span>{source.window.startDate} ~ {shortDate(source.window.endDate)}</span></div>
      <div className="goal-preview__headline"><div><span>이번 한 달에</span><h3>총 <b>{workouts.length}회</b> 달려요</h3></div>
        <Footprints size={40} aria-hidden="true" /></div>
      <div className="goal-preview__composition" aria-hidden="true">
        <span className="goal-preview__quality" style={{ flex: qualityCount }} />
        <span className="goal-preview__easy" style={{ flex: easyCount }} />
        <span className="goal-preview__rest" style={{ flex: restCount }} />
      </div>
      <dl className="goal-preview__counts">
        <div><dt>주요 훈련</dt><dd>{qualityCount}<small>회</small></dd></div>
        <div><dt>쉬운 훈련</dt><dd>{easyCount}<small>회</small></dd></div>
        <div><dt>휴식</dt><dd>{restCount}<small>일</small></dd></div>
      </dl>
      <p className="goal-preview__basis">9.5일마다 {source.inputs.availableDayCount === "EVERY_DAY" ? "매일" : `${source.inputs.availableDayCount}일`} 훈련하는 설정이에요. 하루에는 최대 한 번 달려요.</p>
      <button type="button" className="goal-preview__edit" onClick={onEditSchedule} disabled={disabled}>
        <SlidersHorizontal size={17} aria-hidden="true" />훈련 횟수 바꾸기<ArrowRight size={17} aria-hidden="true" />
      </button>
    </section>

    <div className="goal-preview__basis-row"><div><strong>{source.inputs.goalPaceConfirmed ? "목표 속도로 연습" : "시간 기준으로 훈련"}</strong>
      <p>{source.inputs.goalPaceConfirmed ? `목표 속도 · 1km에 ${tenKGoalPaceLabel(source.goalMinutes).replace("/km", "")} · 속도가 적힌 구간에서만 따라요` : "각 날짜의 시간·힘든 정도를 따라요."}</p></div>
      <button type="button" onClick={onEditBasis} disabled={disabled} aria-label="훈련 방식 바꾸기">바꾸기</button></div>
    <details className="goal-program__details goal-preview__reason"><summary>어떤 조건을 반영했나요?</summary>
      <p>달리기 경험: {EXPERIENCE_LABELS[source.inputs.experienceBand].title}</p>
      <p>주요 훈련과 쉬운 훈련을 나눠 배치했어요. 주요 훈련의 실제 구간과 회복 시간을 아래에서 볼 수 있어요.</p>
      <p>10km {source.goalMinutes}분은 입력한 목표예요. 현재 실력이나 달성 가능성을 계산한 값은 아니에요.</p>
    </details>
    {source.window.deadline && <p className="goal-preview__deadline">대회 날짜 · {source.window.deadline}<br />대회 전 훈련량은 자동으로 줄이지 않아요.</p>}

    <section className="goal-preview__explore" aria-label="차수별 훈련 살펴보기">
      <div><h3>어떻게 달릴지 살펴봐요</h3><p className="goal-program__muted">한 달 기본 훈련 · 9.5일 × 3</p></div>
      <div className="goal-preview__cycles" role="group" aria-label="훈련 차수 선택">
        {source.frames.map(frame => {
          const start = source.window.halfDays[frame.halfDayOffset]
          return <button type="button" key={frame.cycle} aria-pressed={cycle === frame.cycle} disabled={disabled}
            onClick={() => { setCycle(frame.cycle); setSelectedDate(""); setPlaying(false); setStepIndex(0) }}>
            <strong>{frame.cycle}차</strong><span>{start ? `${shortDate(start.date)}${start.slot === "PM" ? " 오후" : ""}부터` : "9.5일"}</span>
          </button>
        })}
      </div>
      <div className="goal-preview__workouts" role="group" aria-label={`${cycle}차 훈련 선택`}>
        {cycleDays.map((day, index) => <button type="button" key={day.date} disabled={disabled}
          aria-pressed={selected?.date === day.date} onClick={() => { setSelectedDate(day.date); setStepIndex(0); setPlaying(false) }}>
          <span className="goal-preview__date">{shortDate(day.date)}<small>{day.session.slot === "AM" ? "오전" : "오후"}</small></span>
          <span><small className={day.session.role === "QUALITY" ? "goal-preview__quality-label" : ""}>{day.session.role === "QUALITY" ? "주요 훈련" : "쉬운 훈련"}{cycle === 1 && index === 0 ? " · 첫 훈련" : ""}</small>
            <strong>{sessionLabel(day.session, true)}</strong></span><ChevronRight size={18} aria-hidden="true" />
        </button>)}
      </div>
      {selected && <section className="goal-preview__session" ref={surface} aria-label="선택한 훈련 구간">
        <div className="goal-preview__session-heading"><div><span>{shortDate(selected.date)} · {selected.session.slot === "AM" ? "오전" : "오후"}</span>
          <h3>{sessionLabel(selected.session, true)}</h3></div><span className="goal-preview__duration"><Timer size={16} aria-hidden="true" />{duration(selectedSummary?.totalSeconds ?? null)}</span></div>
        {activeStep ? <>
          <div className="goal-preview__step" data-task-motion-surface>
            <span>{activeIndex + 1} / {steps.length}구간 · {phaseName[activeStep.phase]}</span>
            <strong>{stepName(activeStep)} <b>{duration(activeStep.seconds)}</b></strong>
            {activeStep.distanceM !== null && <span>{notationDistance(activeStep.distanceM)}</span>}
            {activeStep.paceSecondsPerKm && <p>{activeStep.targetModel === "GOAL_RACE_REFERENCE" ? "목표 기준" : "구간 속도"} · 1km에 {duration(activeStep.paceSecondsPerKm)}</p>}
            <p>{stepInstruction(activeStep)}</p>
          </div>
          <div className="goal-preview__track" aria-hidden="true"><Footprints size={24}
            style={{ left: `${steps.length > 1 ? activeIndex / (steps.length - 1) * 90 : 0}%` }} /></div>
          <div className="goal-preview__playback">
            <button type="button" disabled={disabled || activeIndex === 0} aria-label="이전 구간" onClick={() => chooseStep(activeIndex - 1)}><ChevronLeft size={20} aria-hidden="true" /></button>
            {!reduced && <button type="button" disabled={disabled || steps.length < 2} onClick={() => {
              if (!playing && activeIndex === steps.length - 1) setStepIndex(0)
              setPlaying(!playing)
            }}>{playing ? <Pause size={17} aria-hidden="true" /> : <Play size={17} aria-hidden="true" />}{playing ? "미리보기 멈추기" : "순서 미리보기"}</button>}
            <button type="button" disabled={disabled || activeIndex === steps.length - 1} aria-label="다음 구간" onClick={() => chooseStep(activeIndex + 1)}><ChevronRight size={20} aria-hidden="true" /></button>
          </div>
          <p className="goal-preview__caption">구간 순서만 보여줘요. 실제 훈련 시간으로 재생하지 않아요.</p>
          <details className="goal-program__details"><summary>전체 {steps.length}구간 보기</summary>
            <ol className="goal-preview__all-steps">{steps.map((step, index) => <li key={step.key}>
              <button type="button" disabled={disabled} aria-pressed={activeIndex === index} onClick={() => chooseStep(index)}>
                <span>{index + 1}. {stepName(step)} · {duration(step.seconds)}</span>
                <small>{step.distanceM !== null && `${notationDistance(step.distanceM)} · `}{step.paceSecondsPerKm && `1km에 ${duration(step.paceSecondsPerKm)} · `}{stepInstruction(step)}</small>
              </button></li>)}</ol>
          </details>
          {steps.some(step => step.targetModel === "GOAL_RACE_REFERENCE") && <p className="goal-preview__caption">힘들면 속도를 낮추거나 중단하세요. 실제 힘든 정도(RPE)는 따로 기록해요.</p>}
          <p className="goal-preview__caption">전체 구간 합계 {duration(calculation?.totals.seconds ?? null)}. {EXECUTION_STOP_CUE}</p>
        </> : <>
          {selectedSummary?.catalogState === "UNAVAILABLE" ? <p role="alert">이 훈련의 구간을 확인하지 못했어요. 전체 훈련표에서 내용을 확인해 주세요.</p> :
            sessionExecutionSteps(selected.session, true).map((step, index) => <p key={index}><strong>{step.title}</strong> · {step.detail}</p>)}
        </>}
      </section>}
    </section>
  </div>
}
