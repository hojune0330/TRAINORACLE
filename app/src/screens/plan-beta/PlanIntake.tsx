import React from "react"
import { ArrowLeft, CalendarDays, ChevronRight, Medal } from "lucide-react"
import {
  EXPERIENCE_BANDS,
  TRAINING_TIME_PREFERENCES,
} from "@impl/plan-generator/types"
import type {
  ExperienceBand,
  PlannedEnergyIntent,
  SecondSessionMode,
  TrainingTimePreference,
} from "@impl/plan-generator/types"
import { TermHelp } from "../../components/TermHelp"
import { InfoDisclosure } from "../../components/InfoDisclosure"
import { isValidIsoDate, isoShift } from "../../domain/dates"
import { todayISO } from "../../domain/journal-store"
import { COMPETITION_DIVISIONS } from "../../domain/plan-beta-schema"
import type { CompetitionDivision } from "../../domain/plan-beta-schema"
import type { PlanBetaIntake } from "../../domain/plan-beta-store"
import {
  ENERGY_INTENT_LABELS,
  EXPERIENCE_LABELS,
} from "./labels"
import { PlanChoice as Choice } from "./PlanChoice"
import { IntakeCalendarPeek } from "./IntakeCalendarPeek"
import { answeredSummary, DIVISION_LABELS, STEP_META, trainingTimeLabel } from "./plan-intake-meta"
import type { IntakeStep as MetaIntakeStep } from "./plan-intake-meta"
import {
  QUICK_STEP_ORDER,
  RECOMMENDED_ANSWERS,
  visibleIntakeSteps,
} from "./plan-intake-navigation"
import { resolveDetailedPlanTemplateOptions } from "./plan-template-options"
import { PlanSupportCoverage } from "./PlanSupportCoverage"

export type IntakeStep = MetaIntakeStep | "frame-length" | "race-date" | "preview"

type IntakeDraft = Partial<PlanBetaIntake>

type PlanIntakeProps = {
  readonly step: IntakeStep
  readonly motion?: "initial" | "forward" | "backward" | "replace"
  readonly draft: IntakeDraft
  readonly questionRef?: React.RefObject<HTMLDivElement>
  /** true면 "다듬기"에서 열린 단일 질문 — 진행 표시·달력 미리보기를 숨기고 뒤로 가기 문구를 바꾼다. */
  readonly refining?: boolean
  readonly onBack: () => void
  readonly onGoal: (distanceM: PlanBetaIntake["eventDistanceM"]) => void
  readonly onDivision: (division: CompetitionDivision) => void
  readonly onExperience: (band: ExperienceBand) => void
  readonly onFocus: (focus: PlannedEnergyIntent) => void
  readonly onTemplate: (template: PlanBetaIntake["selectedDetailedTemplateRef"]) => void
  readonly onDays: (days: PlanBetaIntake["availableDayCount"]) => void
  readonly onFrameLength: (length: PlanBetaIntake["requestedFrameLength"]) => void
  readonly onTrainingTime: (preference: TrainingTimePreference) => void
  readonly onSecondSession: (mode: SecondSessionMode) => void
  readonly targetRaceDate?: string
  readonly onTargetRaceDateChange?: (value: string) => void
  readonly onRaceDate?: (targetRaceDate?: string) => void
  readonly onManageRecords: () => void
  readonly onOpenNotationReader: () => void
  readonly onSafety: (
    currentCheck: "NO_KNOWN_RISK" | "REVIEW_REQUIRED",
  ) => void
  readonly onContinue: () => void
  /** "지금까지" 요약 줄을 탭하면 해당 단계로 점프(WORK_ORDER_UX2 §3-1) */
  readonly onJump?: (step: IntakeStep) => void
}
export function PlanIntake({
  step,
  motion = "initial",
  draft,
  questionRef,
  refining = false,
  onBack,
  onGoal,
  onDivision,
  onExperience,
  onFocus,
  onTemplate,
  onDays,
  onFrameLength,
  onTrainingTime,
  onSecondSession,
  targetRaceDate = "",
  onTargetRaceDateChange,
  onRaceDate,
  onManageRecords,
  onOpenNotationReader,
  onSafety,
  onContinue,
  onJump,
}: PlanIntakeProps) {
  const meta = step === "preview"
    ? {
        eyebrow: "확인",
        title: "이대로 계획을 만들까요?",
        copy: "아직 계획이 아니에요. 만든 뒤에 바꿀 수 있어요.",
        helpTerm: null,
      }
    : step === "frame-length"
    ? {
        eyebrow: "계획 길이",
        title: "며칠짜리 달력을 받을까요?",
        copy: "7일은 끝나면 다음 계획으로 이어져요.",
        helpTerm: "plan-frame" as const,
      }
    : step === "race-date"
    ? {
        eyebrow: "대회 날짜",
        title: "대회 날짜가 있나요?",
        copy: "없어도 괜찮아요. 있으면 그 날이 달력에 표시돼요.",
        helpTerm: null,
      }
    : STEP_META[step]
  const visibleSteps = visibleIntakeSteps(draft.eventGroup)
  const isQuickStep = (QUICK_STEP_ORDER as readonly IntakeStep[]).includes(step)
  const currentStepIndex = visibleSteps.indexOf(step)
  const stepNumber = currentStepIndex < 0 ? visibleSteps.length : currentStepIndex + 1
  const showProgress = !refining && isQuickStep
  const summaryLabels = new Map<IntakeStep, string>(
    answeredSummary(draft)
      .filter(({ step: answeredStep }) => (QUICK_STEP_ORDER as readonly IntakeStep[]).includes(answeredStep))
      .map(({ step: answeredStep, label }) => [answeredStep, label]),
  )
  const answeredSteps = visibleSteps.flatMap((answeredStep) => {
    const label = summaryLabels.get(answeredStep)
    return label === undefined ? [] : [{ step: answeredStep, label }]
  })
  const detailedTemplates = resolveDetailedPlanTemplateOptions(draft)
  return (
    <section
      className="plan-intake active-stage-content"
      data-flow-direction={motion}
      data-refining={refining ? "true" : undefined}
      aria-labelledby="plan-intake-title"
    >
      <button className="plan-back" type="button" onClick={onBack}>
        <ArrowLeft aria-hidden="true" size={17} />
        {refining ? "계획으로" : "이전"}
      </button>
      {showProgress && (
        <div className="plan-progress" aria-label={`계획 질문 ${stepNumber}/${visibleSteps.length}`}>
          <span>{stepNumber}/{visibleSteps.length}</span>
          <i style={{ width: `${stepNumber * (100 / visibleSteps.length)}%` }} />
        </div>
      )}
      {showProgress && <IntakeCalendarPeek draft={draft} />}
      {showProgress && answeredSteps.length > 0 && (
        <div className="plan-intake__summary" aria-label="지금까지">
          {answeredSteps.map(({ step: answeredStep, label }) => (
            <button
              key={answeredStep}
              type="button"
              className="plan-intake__summary-line"
              onClick={() => onJump?.(answeredStep)}
            >
              <span>{label}</span>
              <ChevronRight aria-hidden="true" size={14} />
            </button>
          ))}
        </div>
      )}
      <div ref={questionRef} className="plan-eyebrow active-content-scroll-target">{meta.eyebrow}</div>
      <div className="plan-heading-row">
        <h1 id="plan-intake-title">{meta.title}</h1>
        {meta.helpTerm !== null && <TermHelp term={meta.helpTerm} />}
      </div>
      <p className="plan-copy">{meta.copy}</p>
      {step === "preview" && (
        <>
          <dl className="plan-shape-preview" aria-label="미리보기 기준">
            <div>
              <dt>목표</dt>
              <dd>{eventDistanceLabelSafe(draft.eventDistanceM)}</dd>
            </div>
            <div>
              <dt>경험</dt>
              <dd>
                {draft.experienceBand === undefined
                  ? "아직 선택되지 않음"
                  : EXPERIENCE_LABELS[draft.experienceBand].title}
              </dd>
            </div>
          </dl>
          <button
            className="plan-select-action plan-preview-action"
            type="button"
            disabled={draft.eventDistanceM === undefined || draft.experienceBand === undefined}
            onClick={onContinue}
          >
            계획 만들기
            <ChevronRight aria-hidden="true" size={18} />
          </button>
        </>
      )}
      {step !== "preview" && (
        <div
          className={`plan-choice-list${isQuickStep || step === "division" || step === "focus" ? " plan-choice-list--cards" : ""}${step === "goal" ? " plan-choice-list--goals" : ""}`}
          role={step === "goal" ? "group" : undefined}
          aria-label={step === "goal" ? "계획 종목 선택" : undefined}
        >
        {step === "goal" && (
          SUPPORTED_GOAL_ORDER.map((event) => (
            <Choice
              key={event.distanceM}
              title={event.title}
              detail=""
              selected={draft.eventDistanceM === event.distanceM}
              recommended={event.distanceM === RECOMMENDED_ANSWERS.eventDistanceM}
              onClick={() => onGoal(event.distanceM)}
            />
          ))
        )}
        {step === "division" && (
          COMPETITION_DIVISIONS.map((value) => (
            <Choice
              key={value}
              title={DIVISION_LABELS[value].title}
              detail={DIVISION_LABELS[value].detail}
              selected={draft.competitionDivision === value}
              recommended={value === "NO_REGISTERED_DIVISION"}
              onClick={() => onDivision(value)}
            />
          ))
        )}
        {step === "experience" && (
          EXPERIENCE_BANDS.map((value) => (
            <Choice
              key={value}
              title={EXPERIENCE_LABELS[value].title}
              detail={EXPERIENCE_LABELS[value].detail}
              selected={draft.experienceBand === value}
              recommended={value === RECOMMENDED_ANSWERS.experienceBand}
              onClick={() => onExperience(value)}
            />
          ))
        )}
        {step === "focus" && (
          FOCUS_ORDER.map((value) => (
            <Choice
              key={value}
              title={ENERGY_INTENT_LABELS[value].title}
              detail={ENERGY_INTENT_LABELS[value].detail}
              selected={draft.trainingFocus === value}
              recommended={value === RECOMMENDED_ANSWERS.trainingFocus}
              onClick={() => onFocus(value)}
            />
          ))
        )}
        {step === "template" && (
          <>
            <Choice
              title="RPE 기준으로 받기"
              detail="기록 없이 바로 · 힘든 정도(1~10)와 시간"
              selected={draft.selectedDetailedTemplateRef === null}
              recommended
              onClick={() => onTemplate(null)}
            />
            {detailedTemplates.map((detailedTemplate, index) => (
              <div key={`${detailedTemplate.ref.templateId}@${detailedTemplate.ref.version}`}>
                <Choice
                  title={detailedTemplates.length > 1
                    ? `${detailedTemplate.targetEventDistanceM}m 상세 훈련 ${index + 1}`
                    : `${detailedTemplate.targetEventDistanceM}m 경기 페이스 상세 훈련 포함`}
                  detail={`${detailedTemplate.mainSummary} · 내 기록으로 목표 시간 계산`}
                  selected={draft.selectedDetailedTemplateRef?.templateId === detailedTemplate.ref.templateId
                    && draft.selectedDetailedTemplateRef.version === detailedTemplate.ref.version}
                  onClick={() => onTemplate(detailedTemplate.ref)}
                />
                <details className="plan-detailed-prescription">
                  <summary>준비·정리와 훈련 표기 보기</summary>
                  <p>{detailedTemplate.preparationSummary}</p>
                  <p><code>{detailedTemplate.notation}</code><TermHelp term="training-notation" /></p>
                  <p>현재 기록을 직접 확인한 뒤 한 주요 훈련에 적용해요. 다른 날의 반복 수나 훈련량을 자동으로 늘리지 않아요.</p>
                </details>
              </div>
            ))}
            {detailedTemplates.length === 0 && (
              <p className="plan-choice-note" role="status">
                {draft.experienceBand !== "EXPERIENCED"
                  ? "이 경험 범위엔 상세 훈련표가 아직 없어요. RPE 기준으로 받아요."
                  : "이 종목·훈련 종류엔 상세 훈련표가 없어요. RPE 기준으로 받아요."}
              </p>
            )}
            <PlanSupportCoverage experienceBand={draft.experienceBand} />
          </>
        )}
        {step === "days" && (
          ([3, 4, 5, 6, "EVERY_DAY"] as const).map((days) => (
            <Choice
              key={days}
              title={days === "EVERY_DAY" ? "매일" : `${days}일`}
              detail={days === "EVERY_DAY"
                ? "쉬는 날도 달력에 따로 보여요"
                : `나머지 ${7 - days}일은 쉬어요`}
              selected={draft.availableDayCount === days}
              recommended={days === RECOMMENDED_ANSWERS.availableDayCount}
              onClick={() => onDays(days)}
            />
          ))
        )}
        {step === "frame-length" && (
          ([7, 9, 10] as const).map((length) => (
            <Choice
              key={length}
              title={length === 7 ? "7일만 먼저 받기" : `${length}일 계획 받기`}
              detail={length === 7
                ? "끝나면 다음 계획으로 이어서"
                : "한 번에 받아요"}
              selected={draft.requestedFrameLength === length}
              recommended={length === RECOMMENDED_ANSWERS.requestedFrameLength}
              onClick={() => onFrameLength(length)}
            />
          ))
        )}
        {step === "training-time" && (
          TRAINING_TIME_PREFERENCES.map((preference) => (
            <Choice
              key={preference}
              title={trainingTimeLabel(preference).title}
              detail={trainingTimeLabel(preference).detail}
              selected={draft.trainingTimePreference === preference}
              recommended={preference === RECOMMENDED_ANSWERS.trainingTimePreference}
              onClick={() => onTrainingTime(preference)}
            />
          ))
        )}
        {step === "two-a-day" && (
          <>
            <Choice
              title="하루 한 번 운동"
              detail="하루에 운동 하나"
              selected={draft.secondSessionMode === "SINGLE_SESSION_ONLY"}
              recommended
              onClick={() => onSecondSession("SINGLE_SESSION_ONLY")}
            />
            <Choice
              title="하루 두 번 운동할게요"
              detail="오전·오후 두 칸. 힘든 훈련은 하나만"
              selected={draft.secondSessionMode === "RECOVERY_PM_ALLOWED"}
              onClick={() => onSecondSession("RECOVERY_PM_ALLOWED")}
            />
          </>
        )}
        {step === "race-date" && (
          <RaceDateChoice
            value={targetRaceDate}
            onChange={(value) => onTargetRaceDateChange?.(value)}
            onContinueWithoutDate={() => onRaceDate?.()}
            onPreview={() => onRaceDate?.(targetRaceDate)}
          />
        )}
        {step === "safety" && (
          <>
            <Choice
              title="통증은 없고 몸 상태는 평소와 같아요"
              detail="바로 계획을 만들어요"
              selected={false}
              onClick={() => onSafety("NO_KNOWN_RISK")}
            />
            <Choice
              title="통증·부상·몸 이상이 있거나 잘 모르겠어요"
              detail="계획 대신 쉬는 안내와 다음 할 일을 보여드려요"
              selected={false}
              onClick={() => onSafety("REVIEW_REQUIRED")}
            />
          </>
        )}
        </div>
      )}
      {step === "safety" && !refining && (
        <p className="plan-choice-note plan-choice-note--muted">
          이 질문은 진단이나 의료 허가가 아니에요.
          <TermHelp term="review" />
        </p>
      )}
      {step === "goal" && !refining && (
        <details className="plan-support-more">
          <summary>경기 기록이 있나요?</summary>
          <div className="plan-support-actions">
            <button
              className="plan-text-action plan-records-entry"
              type="button"
              onClick={onManageRecords}
            >
              <Medal aria-hidden="true" size={17} />
              내 경기 기록 관리
            </button>
            <button
              className="plan-text-action plan-notation-entry"
              type="button"
              onClick={onOpenNotationReader}
            >
              훈련표 표기 읽기
            </button>
          </div>
          <p className="plan-records-note">
            기록을 저장해도 계획의 페이스·거리·반복은 자동으로 바뀌지 않아요.
          </p>
        </details>
      )}
    </section>
  )
}

/** 훈련 종류: "골고루(MIX)"를 맨 앞에. 회복만은 맨 뒤. 값은 그대로. */
const FOCUS_ORDER = [
  "MIXED_INTENT",
  "BASE_INTENT",
  "LT_INTENT",
  "VO2_INTENT",
  "GLY_INTENT",
  "ATP_PC_INTENT",
  "RECOVERY_INTENT",
] as const satisfies readonly PlannedEnergyIntent[]

/** 초보자가 많이 고르는 순서로 정렬: 5km/10km 먼저, 트랙 종목은 뒤로. 값은 그대로. */
const SUPPORTED_GOAL_ORDER = [
  { distanceM: 5000, title: "5000m", detail: "5km · 처음 시작하기 좋아요" },
  { distanceM: 10000, title: "10km", detail: "첫 대회로 많이 골라요" },
  { distanceM: 21097, title: "하프마라톤", detail: "21.1km" },
  { distanceM: 42195, title: "마라톤", detail: "42.2km" },
  { distanceM: 800, title: "800m", detail: "트랙 두 바퀴" },
  { distanceM: 1500, title: "1500m", detail: "트랙 중거리" },
  { distanceM: 3000, title: "3000m", detail: "트랙 중장거리" },
] as const satisfies readonly {
  readonly distanceM: PlanBetaIntake["eventDistanceM"]
  readonly title: string
  readonly detail: string
}[]

function eventDistanceLabelSafe(distanceM: PlanBetaIntake["eventDistanceM"] | undefined): string {
  if (distanceM === undefined) return "아직 선택되지 않음"
  return SUPPORTED_GOAL_ORDER.find((event) => event.distanceM === distanceM)?.title ?? `${distanceM}m`
}

function RaceDateChoice({
  value,
  onChange,
  onContinueWithoutDate,
  onPreview,
}: {
  readonly value: string
  readonly onChange: (value: string) => void
  readonly onContinueWithoutDate: () => void
  readonly onPreview: () => void
}) {
  const today = todayISO()
  const validFutureDate = isValidIsoDate(value) && value > today
  const describedBy = value !== "" && !validFutureDate
    ? "plan-race-date-help plan-race-date-error"
    : "plan-race-date-help"

  return (
    <div className="plan-race-date">
      <label htmlFor="plan-target-race-date">
        <span><CalendarDays aria-hidden="true" size={17} /> 목표 경기 날짜</span>
        <input
          id="plan-target-race-date"
          type="date"
          min={isoShift(today, 1)}
          value={value}
          aria-invalid={value !== "" && !validFutureDate}
          aria-describedby={describedBy}
          onChange={(event) => onChange(event.target.value)}
        />
      </label>
      <small id="plan-race-date-help">
        날짜는 이 화면에서만 쓰고 저장하지 않아요.
      </small>
      {value !== "" && !validFutureDate && (
        <p id="plan-race-date-error" role="alert">
          오늘보다 뒤의 실제 날짜를 골라주세요.
        </p>
      )}
      <div className="plan-race-date__actions">
        <button className="plan-select-action" type="button" onClick={onContinueWithoutDate}>
          날짜 없이 계획안 보기
          <ChevronRight aria-hidden="true" size={18} />
        </button>
        <button
          className="plan-secondary-action"
          type="button"
          disabled={!validFutureDate}
          onClick={onPreview}
        >
          이 날짜로 배치 미리보기
        </button>
      </div>
    </div>
  )
}
