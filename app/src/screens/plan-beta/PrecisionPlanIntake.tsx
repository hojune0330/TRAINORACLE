import React from "react"
import { ArrowLeft, ArrowRight, CalendarDays, Pencil, SlidersHorizontal } from "lucide-react"
import { AppHeading } from "../../components/AppHeading"
import type { PlanBetaIntake } from "../../domain/plan-beta-store"
import type { InstantPlanEntry } from "../../domain/instant-plan-contract"
import { formatRecordTime } from "../../domain/athlete-record-display"
import { isValidIsoDate } from "../../domain/dates"
import { todayISO } from "../../domain/journal-store"
import { useTaskFlowBack } from "../../hooks/useTaskFlowBack"
import { useAutoAdvanceActivation } from "../../hooks/useAutoAdvanceActivation"
import { EXPERIENCE_LABELS, ENERGY_INTENT_LABELS } from "./labels"
import { trainingTimeLabel } from "./plan-intake-meta"
import { PlanIntake } from "./PlanIntake"
import type { IntakeStep } from "./PlanIntake"
import { QUICK_INTAKE_DEFAULTS } from "./plan-intake-navigation"
import {
  precisionOriginLabel,
  type PrecisionPlanField,
  type PrecisionPlanOrigin,
  type PrecisionPlanOrigins,
} from "./precision-plan-intake"
import "./PrecisionPlanIntake.css"

export type { PrecisionPlanField, PrecisionPlanOrigin, PrecisionPlanOrigins } from "./precision-plan-intake"
export { completePrecisionOrigins, precisionOriginLabel, restoredPrecisionOrigins } from "./precision-plan-intake"

type ChapterId = "records" | "schedule" | "workout"
type PrecisionQuestion = IntakeStep | "start-date"
type Screen = { readonly kind: "chapters" } | { readonly kind: "question"; readonly chapter: ChapterId; readonly question: PrecisionQuestion } | { readonly kind: "review" }

const CHAPTERS: readonly { readonly id: ChapterId; readonly title: string; readonly description: string; readonly questions: readonly PrecisionQuestion[] }[] = [
  { id: "records", title: "목표와 기록", description: "경험과 대회 날짜를 살펴봐요.", questions: ["experience", "race-date"] },
  { id: "schedule", title: "훈련 일정", description: "훈련일과 달력 길이, 운동 시간대를 정해요.", questions: ["start-date", "frame-length", "days", "training-time", "two-a-day"] },
  { id: "workout", title: "훈련 구성", description: "훈련 목적과 상세 페이스 안내를 골라요.", questions: ["focus", "template"] },
]

const OPTIONAL_QUESTIONS = new Set<PrecisionQuestion>([
  "race-date", "start-date", "frame-length", "training-time", "two-a-day", "focus", "template",
])

const QUESTION_FIELDS: Partial<Record<PrecisionQuestion, PrecisionPlanField>> = {
  experience: "experienceBand", "frame-length": "requestedFrameLength",
  days: "availableDayCount", "training-time": "trainingTimePreference", "two-a-day": "secondSessionMode",
  focus: "trainingFocus", template: "selectedDetailedTemplateRef", "start-date": "startDate", "race-date": "targetRaceDate",
}

export type PrecisionPlanIntakeProps = {
  readonly draft: Partial<PlanBetaIntake>
  readonly instantEntry?: InstantPlanEntry
  readonly origins: PrecisionPlanOrigins
  readonly startDate: string
  readonly onStartDateChange: (value: string) => void
  readonly targetRaceDate: string
  readonly onTargetRaceDateChange: (value: string) => void
  readonly onDraftChange: (nextDraft: Partial<PlanBetaIntake>, nextOrigins: PrecisionPlanOrigins) => void
  readonly onEditEntry: () => void
  readonly onManageRecords: () => void
  readonly onOpenNotationReader: () => void
  readonly onComplete: (nextDraft: Partial<PlanBetaIntake>, nextOrigins: PrecisionPlanOrigins) => void
  readonly onCancel: () => void
  readonly disabled?: boolean
  readonly active?: boolean
  readonly answerActivation?: Pick<React.HTMLAttributes<HTMLElement>, "onClickCapture" | "onKeyDownCapture">
}

export function PrecisionPlanIntake(props: PrecisionPlanIntakeProps) {
  const { draft, origins, disabled = false, active = true } = props
  const [screen, setScreen] = React.useState<Screen>({ kind: "question", chapter: "records", question: "experience" })
  const today = todayISO()
  React.useEffect(() => {
    if (screen.kind !== "question" || !active) return
    document.getElementById("plan-intake-title")?.focus({ preventScroll: true })
  }, [screen, active])
  const questionKey = screen.kind === "question" ? `${screen.chapter}:${screen.question}` : screen.kind
  const localAnswerActivation = useAutoAdvanceActivation(questionKey)
  const answerActivation = React.useMemo(() => ({
    onClickCapture: (event: React.MouseEvent<HTMLElement>) => {
      props.answerActivation?.onClickCapture?.(event)
      if (!event.defaultPrevented) localAnswerActivation.onClickCapture(event)
    },
    onKeyDownCapture: (event: React.KeyboardEvent<HTMLElement>) => {
      props.answerActivation?.onKeyDownCapture?.(event)
      if (!event.defaultPrevented) localAnswerActivation.onKeyDownCapture(event)
    },
  }), [props.answerActivation, localAnswerActivation])

  const jumpToChapter = (chapter: ChapterId) => {
    const first = CHAPTERS.find(item => item.id === chapter)?.questions[0]
    if (first) setScreen({ kind: "question", chapter, question: first })
  }
  const jumpToField = (field: PrecisionPlanField) => {
    if (field === "eventDistanceM" || field === "eventGroup") {
      props.onEditEntry()
      return
    }
    const questionByField: Partial<Record<PrecisionPlanField, PrecisionQuestion>> = {
      experienceBand: "experience", targetRaceDate: "race-date", startDate: "start-date",
      requestedFrameLength: "frame-length", availableDayCount: "days", trainingTimePreference: "training-time",
      secondSessionMode: "two-a-day", trainingFocus: "focus", selectedDetailedTemplateRef: "template",
    }
    const question = questionByField[field]
    if (!question) return
    const chapter = CHAPTERS.find(item => item.questions.includes(question))
    if (chapter) setScreen({ kind: "question", chapter: chapter.id, question })
  }
  const nextInChapter = (chapter: ChapterId, question: PrecisionQuestion) => {
    const chapterIndex = CHAPTERS.findIndex(item => item.id === chapter)
    const questions = CHAPTERS[chapterIndex]?.questions ?? []
    const index = questions.indexOf(question)
    const next = questions[index + 1]
    if (next !== undefined) {
      setScreen({ kind: "question", chapter, question: next })
      return
    }
    const nextChapter = CHAPTERS[chapterIndex + 1]
    const first = nextChapter?.questions[0]
    setScreen(nextChapter && first ? { kind: "question", chapter: nextChapter.id, question: first } : { kind: "review" })
  }
  const previous = () => {
    if (screen.kind === "review") {
      const last = CHAPTERS.at(-1)
      const finalQuestion = last?.questions.at(-1)
      if (last && finalQuestion) setScreen({ kind: "question", chapter: last.id, question: finalQuestion })
      return
    }
    if (screen.kind === "chapters") {
      props.onCancel()
      return
    }
    const chapterIndex = CHAPTERS.findIndex(item => item.id === screen.chapter)
    const questions = CHAPTERS[chapterIndex]?.questions ?? []
    const index = questions.indexOf(screen.question)
    if (index > 0) {
      setScreen({ kind: "question", chapter: screen.chapter, question: questions[index - 1]! })
      return
    }
    const previousChapter = CHAPTERS[chapterIndex - 1]
    const finalQuestion = previousChapter?.questions.at(-1)
    if (previousChapter && finalQuestion) setScreen({ kind: "question", chapter: previousChapter.id, question: finalQuestion })
    else props.onCancel()
  }
  useTaskFlowBack({ enabled: active, busy: disabled, onBack: previous })

  const update = <K extends PrecisionPlanField>(field: K, value: K extends keyof PlanBetaIntake ? PlanBetaIntake[K] : string, origin: PrecisionPlanOrigin = "USER") => {
    const nextDraft: Partial<PlanBetaIntake> = { ...draft }
    const nextOrigins: Partial<Record<PrecisionPlanField, PrecisionPlanOrigin>> = { ...origins, [field]: origin }
    if (field === "targetRaceDate" || field === "startDate") {
      if (field === "targetRaceDate") props.onTargetRaceDateChange(value as string)
      else props.onStartDateChange(value as string)
    } else {
      ;(nextDraft as Record<string, unknown>)[field] = value
    }
    props.onDraftChange(nextDraft, nextOrigins)
  }

  const skipQuestion = (chapter: ChapterId, question: PrecisionQuestion) => {
    const field = QUESTION_FIELDS[question]
    if (question === "race-date") {
      update("targetRaceDate", "", "DEFAULT")
    } else if (question === "start-date") {
      update("startDate", today, "DEFAULT")
    } else if (question === "focus") {
      props.onDraftChange({ ...draft, trainingFocus: QUICK_INTAKE_DEFAULTS.trainingFocus, selectedDetailedTemplateRef: null },
        { ...origins, trainingFocus: "DEFAULT", selectedDetailedTemplateRef: "DEFAULT" })
    } else if (field !== undefined) {
      const defaults: Partial<PlanBetaIntake> = {
        competitionDivision: "NOT_PROVIDED", requestedFrameLength: QUICK_INTAKE_DEFAULTS.requestedFrameLength,
        trainingTimePreference: QUICK_INTAKE_DEFAULTS.trainingTimePreference, secondSessionMode: QUICK_INTAKE_DEFAULTS.secondSessionMode,
        trainingFocus: QUICK_INTAKE_DEFAULTS.trainingFocus, selectedDetailedTemplateRef: null,
      }
      const value = defaults[field as keyof PlanBetaIntake]
      if (value !== undefined) update(field as keyof PlanBetaIntake, value as never, "DEFAULT")
    }
    nextInChapter(chapter, question)
  }

  const setAnswered = (question: PrecisionQuestion, patch: Partial<PlanBetaIntake>, resetTemplate = false) => {
    const nextDraft = { ...draft, ...patch }
    const nextOrigins: Partial<Record<PrecisionPlanField, PrecisionPlanOrigin>> = { ...origins }
    const field = QUESTION_FIELDS[question]
    if (field !== undefined) nextOrigins[field] = "USER"
    if (resetTemplate) {
      nextDraft.selectedDetailedTemplateRef = null
      nextOrigins.selectedDetailedTemplateRef = "DEFAULT"
    }
    props.onDraftChange(nextDraft, nextOrigins)
    if (screen.kind === "question") nextInChapter(screen.chapter, question)
  }

  const keepCurrentAndContinue = (chapter: ChapterId, question: PrecisionQuestion) => nextInChapter(chapter, question)

  if (screen.kind === "chapters") {
    return <section className="precision-intake" aria-labelledby="precision-intake-title">
      <header className="precision-intake__header">
        <button className="plan-back" type="button" disabled={disabled} onClick={props.onCancel}>
          <ArrowLeft aria-hidden="true" size={17} />간편 입력으로
        </button>
        <div className="precision-intake__title-row">
          <AppHeading as="h1" variant="screen" id="precision-intake-title">정밀 설정</AppHeading>
          <SlidersHorizontal aria-hidden="true" size={19} />
        </div>
        <p>필요한 카드만 열어 한 장씩 고르세요. 건너뛴 항목은 기본 설정으로 둘 수 있어요.</p>
      </header>
      <section className="precision-intake__entry" aria-label="목표와 기록 입력">
        <div><strong>목표 종목·기록</strong><span>{draft.eventDistanceM === undefined ? "종목을 먼저 선택해 주세요" : `${draft.eventDistanceM}m 목표`}</span></div>
        <button type="button" className="app-choice-control" disabled={disabled} onClick={props.onEditEntry}>
          종목·기록 확인 <Pencil aria-hidden="true" size={15} />
        </button>
        <div className="precision-intake__support">
          <button type="button" className="plan-text-action" disabled={disabled} onClick={props.onManageRecords}>내 경기 기록 관리</button>
          <button type="button" className="plan-text-action" disabled={disabled} onClick={props.onOpenNotationReader}>훈련표 표기 읽기</button>
        </div>
      </section>
      <div className="precision-intake__chapters" role="group" aria-label="정밀 설정 장">
        {CHAPTERS.map((chapter, index) => <button key={chapter.id} type="button" className="precision-intake__chapter"
          disabled={disabled} aria-label={`${chapter.title} 설정 열기`} onClick={() => jumpToChapter(chapter.id)}>
          <span className="precision-intake__chapter-index">{index + 1}</span>
          <span className="precision-intake__chapter-copy"><strong>{chapter.title}</strong><small>{chapter.description}</small></span>
          <ArrowRight aria-hidden="true" size={17} />
        </button>)}
      </div>
      <div className="precision-intake__footer">
        <button type="button" className="app-choice-control" disabled={disabled} onClick={() => setScreen({ kind: "review" })}>설정 확인</button>
      </div>
    </section>
  }

  if (screen.kind === "review") {
    const validStartDate = isValidIsoDate(props.startDate) && props.startDate >= today
    const validRaceDate = props.targetRaceDate === "" || isValidIsoDate(props.targetRaceDate) && props.targetRaceDate > today
    return <section className="precision-intake" aria-labelledby="precision-review-title">
      <button className="plan-back" type="button" disabled={disabled} onClick={() => setScreen({ kind: "chapters" })}>
        <ArrowLeft aria-hidden="true" size={17} />설정 목차
      </button>
      <AppHeading as="h1" variant="screen" id="precision-review-title">계획 기준 확인</AppHeading>
      <p className="precision-intake__review-note">이 항목을 확인한 다음 몸 상태를 확인해요. 아직 계획은 만들거나 저장하지 않았어요.</p>
      {!validStartDate && <p role="alert" className="precision-intake__error">시작 날짜를 오늘 또는 이후로 확인해 주세요.</p>}
      {!validRaceDate && <p role="alert" className="precision-intake__error">대회 날짜를 오늘보다 뒤의 실제 날짜로 확인해 주세요.</p>}
      <PrecisionPlanSummary draft={draft} instantEntry={props.instantEntry} origins={origins} startDate={props.startDate} targetRaceDate={props.targetRaceDate}
        onJump={jumpToField} />
      <div className="precision-intake__footer">
        <button type="button" className="app-choice-control" disabled={disabled} onClick={props.onCancel}>취소</button>
        <button type="button" className="app-choice-control app-choice-control--primary" disabled={disabled
          || draft.eventDistanceM === undefined || draft.experienceBand === undefined || draft.availableDayCount === undefined
          || !validStartDate || !validRaceDate}
          onClick={() => props.onComplete(draft, origins)}>
          몸 상태 확인으로 <ArrowRight aria-hidden="true" size={17} />
        </button>
      </div>
    </section>
  }

  const { chapter, question } = screen
  const existingValue = question === "start-date" ? props.startDate : question === "race-date" ? props.targetRaceDate
    : question === "experience" ? draft.experienceBand
      : question === "frame-length" ? draft.requestedFrameLength : question === "days" ? draft.availableDayCount
        : question === "training-time" ? draft.trainingTimePreference : question === "two-a-day" ? draft.secondSessionMode
          : question === "focus" ? draft.trainingFocus : question === "template" ? draft.selectedDetailedTemplateRef : undefined
  const canKeep = question === "start-date" ? isValidIsoDate(props.startDate) && props.startDate >= today
    : question === "race-date" ? true : existingValue !== undefined
  const chapterName = CHAPTERS.find(item => item.id === chapter)?.title ?? "정밀 설정"

  if (question === "start-date") {
    const valid = isValidIsoDate(props.startDate) && props.startDate >= today
    return <section className="precision-intake" aria-labelledby="precision-question-title">
      <button className="plan-back" type="button" disabled={disabled} onClick={() => setScreen({ kind: "chapters" })}><ArrowLeft aria-hidden="true" size={17} />설정 목차</button>
      <nav className="precision-intake__jumpbar" aria-label="정밀 설정 장 이동">
        {CHAPTERS.map((item, index) => <button key={item.id} type="button" className="plan-text-action"
          aria-current={item.id === chapter ? "step" : undefined} disabled={disabled} onClick={() => jumpToChapter(item.id)}>
          {item.title} {index + 1}/{CHAPTERS.length}
        </button>)}
        <button type="button" className="plan-text-action" disabled={disabled} onClick={() => setScreen({ kind: "review" })}>선택한 조건</button>
      </nav>
      <p className="precision-intake__eyebrow">{chapterName} · 시작 날짜</p>
      <AppHeading as="h1" variant="screen" id="precision-question-title">언제부터 계획을 시작할까요?</AppHeading>
      <label className="precision-intake__date-field" htmlFor="precision-start-date">
        <span><CalendarDays aria-hidden="true" size={17} /> 계획 시작 날짜</span>
        <input id="precision-start-date" type="date" min={today} value={props.startDate} disabled={disabled}
          aria-invalid={!valid} onChange={event => update("startDate", event.target.value)} />
      </label>
      {!valid && <p role="alert" className="precision-intake__error">오늘 또는 이후의 실제 날짜를 골라주세요.</p>}
      <div className="precision-intake__footer">
        <button type="button" className="app-choice-control" disabled={disabled} onClick={() => skipQuestion(chapter, question)}>오늘부터 · 기본값</button>
        <button type="button" className="app-choice-control app-choice-control--primary" disabled={disabled || !valid}
          onClick={() => keepCurrentAndContinue(chapter, question)}>이 날짜로 계속</button>
      </div>
    </section>
  }

  const isOptional = OPTIONAL_QUESTIONS.has(question)
  const chapterQuestions = CHAPTERS.find(item => item.id === chapter)?.questions ?? []
  const chapterPosition = chapterQuestions.indexOf(question) + 1
  return <section className="precision-intake" aria-labelledby="plan-intake-title">
    <div className="precision-intake__question-nav">
      <button className="plan-back" type="button" disabled={disabled} onClick={() => setScreen({ kind: "chapters" })}><ArrowLeft aria-hidden="true" size={17} />설정 목차</button>
      <span>이번 단계 질문 {chapterPosition}/{chapterQuestions.length}</span>
    </div>
    <nav className="precision-intake__jumpbar" aria-label="정밀 설정 장 이동">
      {CHAPTERS.map((item, index) => <button key={item.id} type="button" className="plan-text-action"
        aria-current={item.id === chapter ? "step" : undefined} disabled={disabled} onClick={() => jumpToChapter(item.id)}>
        {item.title} {index + 1}/{CHAPTERS.length}
      </button>)}
      <button type="button" className="plan-text-action" disabled={disabled} onClick={() => setScreen({ kind: "review" })}>선택한 조건</button>
    </nav>
    <PlanIntake
      key={`${chapter}:${question}`}
      step={question as IntakeStep}
      draft={draft}
      refining
      canGoBack={false}
      answerActivation={answerActivation}
      onBack={() => undefined}
      onGoal={() => undefined}
      onDivision={() => undefined}
      onExperience={value => {
        const changed = draft.experienceBand !== value
        setAnswered(question, { experienceBand: value }, changed && value !== "EXPERIENCED")
      }}
      onFocus={value => setAnswered(question, { trainingFocus: value }, draft.trainingFocus !== value)}
      onTemplate={value => setAnswered(question, { selectedDetailedTemplateRef: value })}
      onDays={value => setAnswered(question, { availableDayCount: value })}
      onFrameLength={value => setAnswered(question, { requestedFrameLength: value })}
      onTrainingTime={value => setAnswered(question, { trainingTimePreference: value })}
      onSecondSession={value => setAnswered(question, { secondSessionMode: value })}
      targetRaceDate={props.targetRaceDate}
      deferGeneration
      onTargetRaceDateChange={value => update("targetRaceDate", value)}
      onRaceDate={value => {
        if (value === undefined) update("targetRaceDate", "", "DEFAULT")
        else update("targetRaceDate", value, "USER")
        nextInChapter(chapter, question)
      }}
      onManageRecords={props.onManageRecords}
      onOpenNotationReader={props.onOpenNotationReader}
      onSafety={() => undefined}
      onContinue={() => undefined}
    />
    {question !== "race-date" && <div className="precision-intake__question-actions">
      {isOptional && <button type="button" className="plan-text-action" disabled={disabled} onClick={() => skipQuestion(chapter, question)}>
        {skipLabel(question)}으로 건너뛰기
      </button>}
      {canKeep && <button type="button" className="app-choice-control" disabled={disabled} onClick={() => keepCurrentAndContinue(chapter, question)}>
        현재 값 유지하고 계속
      </button>}
    </div>}
    {question === "experience" && !canKeep && <p className="precision-intake__required">경험은 계획을 만들기 전에 선택해 주세요.</p>}
    {question === "days" && !canKeep && <p className="precision-intake__required">훈련할 날은 계획을 만들기 전에 선택해 주세요.</p>}
  </section>
}

export function PrecisionPlanSummary({ draft, instantEntry, origins, startDate, targetRaceDate, onJump }: {
  readonly draft: Partial<PlanBetaIntake>
  readonly instantEntry?: InstantPlanEntry
  readonly origins: PrecisionPlanOrigins
  readonly startDate?: string
  readonly targetRaceDate?: string
  readonly onJump?: (field: PrecisionPlanField) => void
}) {
  const rows = [
    { chapter: "records" as const, label: "기록 기준", value: recordBasisLabel(instantEntry) },
    { chapter: "records" as const, label: "목표 종목", value: draft.eventDistanceM === undefined ? "종목 미선택" : `${draft.eventDistanceM}m`, field: "eventDistanceM" as const },
    { chapter: "records" as const, label: "달리기 경험", value: draft.experienceBand ? EXPERIENCE_LABELS[draft.experienceBand].title : "선택 필요", field: "experienceBand" as const },
    { chapter: "records" as const, label: "대회 날짜", value: targetRaceDate || "설정하지 않음", field: "targetRaceDate" as const },
    { chapter: "schedule" as const, label: "시작 날짜", value: startDate || "오늘부터", field: "startDate" as const },
    { chapter: "schedule" as const, label: "달력 길이", value: draft.requestedFrameLength === undefined ? defaultLabel("requestedFrameLength") : `${draft.requestedFrameLength}일`, field: "requestedFrameLength" as const },
    { chapter: "schedule" as const, label: "훈련하는 날", value: draft.availableDayCount === undefined ? "선택 필요" : draft.availableDayCount === "EVERY_DAY" ? "매일" : `${draft.availableDayCount}일`, field: "availableDayCount" as const },
    { chapter: "schedule" as const, label: "주 운동 시간", value: draft.trainingTimePreference ? trainingTimeLabel(draft.trainingTimePreference).title : defaultLabel("trainingTimePreference"), field: "trainingTimePreference" as const },
    { chapter: "schedule" as const, label: "하루 두 번", value: draft.secondSessionMode ? draft.secondSessionMode === "SINGLE_SESSION_ONLY" ? "하루 한 번" : "하루 두 번 가능" : defaultLabel("secondSessionMode"), field: "secondSessionMode" as const },
    { chapter: "workout" as const, label: "훈련 목적", value: draft.trainingFocus ? ENERGY_INTENT_LABELS[draft.trainingFocus].title.split(" · ")[0] ?? "" : defaultLabel("trainingFocus"), field: "trainingFocus" as const },
    { chapter: "workout" as const, label: "훈련 구성·페이스", value: draft.selectedDetailedTemplateRef === undefined ? defaultLabel("selectedDetailedTemplateRef") : draft.selectedDetailedTemplateRef === null ? "직접 고르지 않음" : "선택한 상세 훈련표", field: "selectedDetailedTemplateRef" as const },
  ]
  return <div className="precision-intake__summary" aria-label="계획 설정과 출처">
    {rows.map(row => {
      const present = row.field === "startDate" ? Boolean(startDate)
        : row.field === "targetRaceDate" ? Boolean(targetRaceDate)
          : row.field !== undefined && draft[row.field as keyof PlanBetaIntake] !== undefined
      const inferredOrigin: PrecisionPlanOrigin | undefined = present ? "RESTORED_ORIGIN_UNKNOWN"
        : row.field === "experienceBand" || row.field === "availableDayCount" ? undefined : "DEFAULT"
      const origin = row.field ? origins[row.field] ?? inferredOrigin : undefined
      return <div className="precision-intake__summary-row" key={row.label}>
      <span>{row.label}</span>
      <strong>{row.value}</strong>
      <small>{row.field ? precisionOriginLabel(origin) : "기존 입력"}</small>
      {onJump && row.field && <button type="button" className="plan-text-action" aria-label={`${row.label} 설정으로 이동`} onClick={() => onJump(row.field)}><Pencil aria-hidden="true" size={14} />수정</button>}
    </div>})}
  </div>
}

function recordBasisLabel(entry: InstantPlanEntry | undefined): string {
  if (!entry || entry.kind === "NO_RECORD") return entry ? `${entry.eventDistanceM}m · 저장 기록 없음` : "기록 기준 확인 필요"
  const prefix = entry.kind === "GOAL_ONLY" ? "목표 기준 · 현재 실력 아님" : "현재 기록"
  const date = entry.kind === "CURRENT_RECORD" ? entry.achievedOn ?? "날짜 미입력" : "목표 기록"
  return `${prefix} · ${entry.eventDistanceM}m · ${formatRecordTime(entry.performanceSeconds)} · ${date}`
}

function defaultLabel(field: keyof typeof QUICK_INTAKE_DEFAULTS): string {
  switch (field) {
    case "requestedFrameLength": return `${QUICK_INTAKE_DEFAULTS.requestedFrameLength}일`
    case "trainingTimePreference": return trainingTimeLabel(QUICK_INTAKE_DEFAULTS.trainingTimePreference).title
    case "secondSessionMode": return "하루 한 번"
    case "trainingFocus": return ENERGY_INTENT_LABELS[QUICK_INTAKE_DEFAULTS.trainingFocus].title.split(" · ")[0] ?? ""
    case "selectedDetailedTemplateRef": return "시간·힘든 정도"
    default: return "기본 설정"
  }
}

function skipLabel(question: PrecisionQuestion): string {
  switch (question) {
    case "race-date": return "날짜 없이 계속"
    case "start-date": return "오늘부터 · 기본값"
    case "frame-length": return `${QUICK_INTAKE_DEFAULTS.requestedFrameLength}일 기본값`
    case "training-time": return `${trainingTimeLabel(QUICK_INTAKE_DEFAULTS.trainingTimePreference).title} 기본값`
    case "two-a-day": return "하루 한 번 · 기본값"
    case "focus": return `${ENERGY_INTENT_LABELS[QUICK_INTAKE_DEFAULTS.trainingFocus].title.split(" · ")[0]} 기본값`
    case "template": return "시간·힘든 정도 · 기본값"
    default: return "기본 설정"
  }
}
