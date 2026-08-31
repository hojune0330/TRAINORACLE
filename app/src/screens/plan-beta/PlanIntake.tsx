import React from "react"
import { ArrowLeft, CalendarDays, ChevronRight, Medal } from "lucide-react"
import {
  EXPERIENCE_BANDS,
  PLANNED_ENERGY_INTENTS,
  TRAINING_TIME_PREFERENCES,
} from "@impl/plan-generator/types"
import type {
  ExperienceBand,
  PlannedEnergyIntent,
  SecondSessionMode,
  TrainingTimePreference,
} from "@impl/plan-generator/types"
import { TermHelp } from "../../components/TermHelp"
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
import { answeredSummary, DIVISION_LABELS, STEP_META, trainingTimeLabel } from "./plan-intake-meta"
import type { IntakeStep as MetaIntakeStep } from "./plan-intake-meta"
import {
  unansweredRefinements,
  eventDistanceLabel,
  SUPPORTED_PLAN_EVENTS,
  visibleIntakeSteps,
} from "./plan-intake-navigation"
import type { RefinementStep } from "./plan-intake-navigation"
import { resolveDetailedPlanTemplateOptions } from "./plan-template-options"

export type IntakeStep = MetaIntakeStep | "frame-length" | "race-date" | "preview"

type IntakeDraft = Partial<PlanBetaIntake>

const PREVIEW_REFINEMENTS: readonly {
  readonly step: RefinementStep
  readonly label: string
}[] = [
  { step: "days", label: "훈련일" },
  { step: "frame-length", label: "첫 계획 길이 7·9·10일" },
  { step: "focus", label: "훈련 목적" },
  { step: "template", label: "훈련 상세 방식" },
  { step: "training-time", label: "주로 하는 시간" },
  { step: "two-a-day", label: "하루 한 번/두 번 선택" },
]

type PlanIntakeProps = {
  readonly step: IntakeStep
  readonly motion?: "initial" | "forward" | "backward" | "replace"
  readonly draft: IntakeDraft
  readonly questionRef?: React.RefObject<HTMLDivElement>
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
        eyebrow: "방향 확인",
        title: "계획 형태 미리보기",
        copy: "선택한 종목과 훈련 경험으로 어떤 정보를 더 정할지 먼저 보여드려요. 일정이나 훈련 처방은 아직 만들지 않았어요.",
        helpTerm: null,
      }
    : step === "frame-length"
    ? {
        eyebrow: "계획 길이",
        title: "이번에 며칠 계획을 받을까요?",
        copy: "7일은 먼저 7일만 받고 다음 계획으로 이어집니다. 9일과 10일은 고른 날짜 수만큼 한 번에 받습니다.",
        helpTerm: "plan-option" as const,
      }
    : step === "race-date"
    ? {
        eyebrow: "목표 경기 날짜",
        title: "목표 경기 날짜가 있나요? (선택)",
        copy: "날짜 없이도 일반 계획안 두 개를 바로 만들 수 있어요. 날짜를 고르면 저장하거나 훈련량·강도를 바꾸지 않고 이 화면에서 적용 가능 여부만 미리 확인해요.",
        helpTerm: null,
      }
    : STEP_META[step]
  const visibleSteps = visibleIntakeSteps(draft.eventGroup)
  const unanswered = unansweredRefinements(draft)
  const remainingRefinements = PREVIEW_REFINEMENTS.filter(({ step: refinementStep }) => (
    unanswered.includes(refinementStep)
  ))
  const currentStepIndex = visibleSteps.indexOf(step === "preview" ? "safety" : step)
  const stepNumber = currentStepIndex < 0 ? 1 : currentStepIndex + 1
  const summaryLabels = new Map<IntakeStep, string>(
    answeredSummary(draft).map(({ step: answeredStep, label }) => [answeredStep, label]),
  )
  if (draft.requestedFrameLength !== undefined) {
    summaryLabels.set("frame-length", `${draft.requestedFrameLength}일 계획`)
  }
  if (targetRaceDate !== "") {
    summaryLabels.set("race-date", `목표 경기 ${targetRaceDate}`)
  }
  const answeredSteps = visibleSteps.flatMap((answeredStep) => {
    const label = summaryLabels.get(answeredStep)
    return label === undefined ? [] : [{ step: answeredStep, label }]
  })
  const detailedTemplates = resolveDetailedPlanTemplateOptions(draft)
  return (
    <section
      className="plan-intake active-stage-content"
      data-flow-direction={motion}
      aria-labelledby="plan-intake-title"
    >
      <button className="plan-back" type="button" onClick={onBack}>
        <ArrowLeft aria-hidden="true" size={17} />
        이전
      </button>
      <div className="plan-progress" aria-label={`계획 질문 ${stepNumber}/${visibleSteps.length}`}>
        <span>{stepNumber}/{visibleSteps.length}</span>
        <i style={{ width: `${stepNumber * (100 / visibleSteps.length)}%` }} />
      </div>
      {answeredSteps.length > 0 && (
        <div className="plan-intake__summary" aria-label="지금까지">
          <span className="plan-intake__summary-label">지금까지</span>
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
              <dt>준비 종목</dt>
              <dd>
                {eventDistanceLabel(draft.eventDistanceM)}
              </dd>
            </div>
            <div>
              <dt>훈련 경험</dt>
              <dd>
                {draft.experienceBand === undefined
                  ? "아직 선택되지 않음"
                  : EXPERIENCE_LABELS[draft.experienceBand].title}
              </dd>
            </div>
            <div>
              <dt>비교 방식</dt>
              <dd>쉬운 훈련 시간이 다른 계획안 A와 B를 나란히 비교</dd>
            </div>
          </dl>
          <div className="plan-preview-boundary">
            <strong>아직 계획이 아니에요.</strong>
            <p>
              {remainingRefinements.length === 0
                ? "남은 선택 0개 · 저장된 선택을 그대로 다시 사용할 수 있어요. 계획안은 아직 만들지 않았어요."
                : `남은 선택 ${remainingRefinements.length}개 · ${remainingRefinements
                    .map(({ label }) => label)
                    .join(" · ")}`}
            </p>
            <small>
              이 미리보기는 저장되지 않으며 실제 계획안을 만들 때 안전 확인을 다시 적용해요.
            </small>
          </div>
          <button
            className="plan-select-action plan-preview-action"
            type="button"
            disabled={draft.eventDistanceM === undefined || draft.experienceBand === undefined}
            onClick={onContinue}
          >
            {remainingRefinements.length === 0 ? "계획안 만들기" : "내 계획 완성하기"}
            <ChevronRight aria-hidden="true" size={18} />
          </button>
        </>
      )}
      {step !== "preview" && (
        <div
          className="plan-choice-list"
          role={step === "goal" ? "group" : undefined}
          aria-label={step === "goal" ? "계획 종목 선택" : undefined}
        >
        {step === "goal" && (
          SUPPORTED_PLAN_EVENTS.map((event) => (
            <Choice
              key={event.distanceM}
              title={event.title}
              detail={event.detail}
              selected={draft.eventDistanceM === event.distanceM}
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
              onClick={() => onExperience(value)}
            />
          ))
        )}
        {step === "focus" && (
          PLANNED_ENERGY_INTENTS.map((value) => (
            <Choice
              key={value}
              title={ENERGY_INTENT_LABELS[value].title}
              detail={ENERGY_INTENT_LABELS[value].detail}
              selected={draft.trainingFocus === value}
              onClick={() => onFocus(value)}
            />
          ))
        )}
        {step === "template" && (
          <>
            <Choice
              title="RPE 기준으로 받기"
              detail="경기 기록 없이도 시작 · 각 훈련의 체감 강도와 시간을 안내"
              selected={draft.selectedDetailedTemplateRef === null}
              onClick={() => onTemplate(null)}
            />
            {detailedTemplates.map((detailedTemplate, index) => (
              <Choice
                key={`${detailedTemplate.ref.templateId}@${detailedTemplate.ref.version}`}
                title={detailedTemplates.length > 1
                  ? `${detailedTemplate.targetEventDistanceM}m 상세 훈련 ${index + 1}`
                  : `${detailedTemplate.targetEventDistanceM}m 경기 페이스 상세 훈련 포함`}
                detail={`${detailedTemplate.notation} · 같은 종목의 현재 기록을 직접 확인하면 반복 목표 시간을 계산`}
                selected={draft.selectedDetailedTemplateRef?.templateId === detailedTemplate.ref.templateId
                  && draft.selectedDetailedTemplateRef.version === detailedTemplate.ref.version}
                onClick={() => onTemplate(detailedTemplate.ref)}
              />
            ))}
            {detailedTemplates.length === 0 && (
              <p className="plan-choice-note" role="status">
                지금 고른 종목·훈련 목적에는 활성화된 상세 훈련표가 없어요. RPE 기준 계획은 그대로 받을 수 있어요.
              </p>
            )}
          </>
        )}
        {step === "days" && (
          ([3, 4, 5, 6, "EVERY_DAY"] as const).map((days) => (
            <Choice
              key={days}
              title={days === "EVERY_DAY" ? "매일" : `${days}일`}
              detail={days === "EVERY_DAY"
                ? "매일 움직일 수 있어요 · 완전 휴식일도 계획에서 따로 보여요"
                : `운동 ${days}일 · 고르지 않은 날은 완전 휴식`}
              selected={draft.availableDayCount === days}
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
                ? "첫 7일을 받고, 끝나면 다음 계획으로 이어서 받아요"
                : `${length}일 분량을 한 번에 받아요`}
              selected={draft.requestedFrameLength === length}
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
              onClick={() => onTrainingTime(preference)}
            />
          ))
        )}
        {step === "two-a-day" && (
          <>
            <Choice
              title="하루 한 번 운동"
              detail="하루에 한 가지 운동만 계획에 넣어요"
              selected={draft.secondSessionMode === "SINGLE_SESSION_ONLY"}
              onClick={() => onSecondSession("SINGLE_SESSION_ONLY")}
            />
            <Choice
              title="하루 두 번 운동할게요"
              detail="고른 시간대에 주요 훈련을 배치하고 다른 시간에는 쉬운 훈련이나 회복 운동을 안내해요. 주요 훈련 두 개를 자동으로 넣지는 않아요"
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
              detail="이 응답은 의료적 허가를 뜻하지 않아요"
              selected={false}
              onClick={() => onSafety("NO_KNOWN_RISK")}
            />
            <Choice
              title="통증·부상·몸 이상이 있거나 잘 모르겠어요"
              detail="계획은 멈춤 · 앱이 사람에게 자동으로 연결하지 않음"
              selected={false}
              onClick={() => onSafety("REVIEW_REQUIRED")}
            />
          </>
        )}
        </div>
      )}
      {step === "goal" && (
        <>
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
            경기 기록을 저장해도 지금 계획의 페이스·거리·반복은 자동으로 바뀌지 않아요.
          </p>
        </>
      )}
    </section>
  )
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
        입력한 날짜는 이 미리보기에서만 사용하고 기기나 계정에 저장하지 않아요.
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
