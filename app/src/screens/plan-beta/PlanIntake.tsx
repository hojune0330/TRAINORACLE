import { useState } from "react"
import { ArrowLeft, ChevronRight, Medal } from "lucide-react"
import {
  EXPERIENCE_BANDS,
  PLAN_EVENT_GROUPS,
  PLANNED_ENERGY_INTENTS,
  TRAINING_TIME_PREFERENCES,
} from "@impl/plan-generator/types"
import type {
  ExperienceBand,
  PlanEventGroup,
  PlannedEnergyIntent,
  SecondSessionMode,
  TrainingTimePreference,
} from "@impl/plan-generator/types"
import { TermHelp } from "../../components/TermHelp"
import { COMPETITION_DIVISIONS } from "../../domain/plan-beta-schema"
import type { CompetitionDivision } from "../../domain/plan-beta-schema"
import type { PlanBetaIntake } from "../../domain/plan-beta-store"
import {
  ENERGY_INTENT_LABELS,
  EVENT_LABELS,
  EXPERIENCE_LABELS,
} from "./labels"
import { PlanChoice as Choice } from "./PlanChoice"
import { answeredSummary, DIVISION_LABELS, STEP_META, trainingTimeLabel } from "./plan-intake-meta"
import type { IntakeStep as MetaIntakeStep } from "./plan-intake-meta"
import {
  unansweredRefinements,
  visibleIntakeSteps,
} from "./plan-intake-navigation"
import type { RefinementStep } from "./plan-intake-navigation"

export type IntakeStep = MetaIntakeStep | "frame-length" | "preview"

type IntakeDraft = Partial<PlanBetaIntake>

const PREVIEW_REFINEMENTS: readonly {
  readonly step: RefinementStep
  readonly label: string
}[] = [
  { step: "days", label: "훈련일" },
  { step: "frame-length", label: "첫 계획 길이 7·9·10일" },
  { step: "focus", label: "훈련 목적" },
  { step: "training-time", label: "주로 하는 시간" },
  { step: "two-a-day", label: "하루 한 번/두 번 선택" },
]

type PlanIntakeProps = {
  readonly step: IntakeStep
  readonly draft: IntakeDraft
  readonly onBack: () => void
  readonly onGoal: (goal: PlanEventGroup) => void
  readonly onDivision: (division: CompetitionDivision) => void
  readonly onExperience: (band: ExperienceBand) => void
  readonly onFocus: (focus: PlannedEnergyIntent) => void
  readonly onDays: (days: PlanBetaIntake["availableDayCount"]) => void
  readonly onFrameLength: (length: PlanBetaIntake["requestedFrameLength"]) => void
  readonly onTrainingTime: (preference: TrainingTimePreference) => void
  readonly onSecondSession: (mode: SecondSessionMode) => void
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
  draft,
  onBack,
  onGoal,
  onDivision,
  onExperience,
  onFocus,
  onDays,
  onFrameLength,
  onTrainingTime,
  onSecondSession,
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
  const answeredSteps = visibleSteps.flatMap((answeredStep) => {
    const label = summaryLabels.get(answeredStep)
    return label === undefined ? [] : [{ step: answeredStep, label }]
  })
  const [showTenKm, setShowTenKm] = useState(false)
  const eventGroups = showTenKm
    ? PLAN_EVENT_GROUPS
    : PLAN_EVENT_GROUPS.filter((value) => value !== "TEN_K")
  return (
    <section className="plan-intake" aria-labelledby="plan-intake-title">
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
      <div className="plan-eyebrow">{meta.eyebrow}</div>
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
                {draft.eventGroup === undefined
                  ? "아직 선택되지 않음"
                  : EVENT_LABELS[draft.eventGroup].title}
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
              <dd>부담이 다른 후보 A와 B를 나란히 비교</dd>
            </div>
          </dl>
          <div className="plan-preview-boundary">
            <strong>아직 계획이 아니에요.</strong>
            <p>
              {remainingRefinements.length === 0
                ? "남은 선택 0개 · 저장된 선택을 그대로 다시 사용할 수 있어요. 후보는 아직 만들지 않았어요."
                : `남은 선택 ${remainingRefinements.length}개 · ${remainingRefinements
                    .map(({ label }) => label)
                    .join(" · ")}`}
            </p>
            <small>
              이 미리보기는 저장되지 않으며 실제 후보를 만들 때 안전 확인을 다시 적용해요.
            </small>
          </div>
          <button
            className="plan-select-action plan-preview-action"
            type="button"
            disabled={draft.eventGroup === undefined || draft.experienceBand === undefined}
            onClick={onContinue}
          >
            {remainingRefinements.length === 0 ? "계획 후보 만들기" : "내 계획 완성하기"}
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
          eventGroups.map((value) => (
            <Choice
              key={value}
              title={EVENT_LABELS[value].title}
              detail={EVENT_LABELS[value].detail}
              selected={draft.eventGroup === value}
              onClick={() => onGoal(value)}
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
          PLANNED_ENERGY_INTENTS.filter((value) => value !== "MIXED_INTENT").map((value) => (
            <Choice
              key={value}
              title={ENERGY_INTENT_LABELS[value].title}
              detail={ENERGY_INTENT_LABELS[value].detail}
              selected={draft.trainingFocus === value}
              onClick={() => onFocus(value)}
            />
          ))
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
              detail="고른 선호 시간에 주 훈련·품질 세션을 배치하고, 다른 시간에는 쉬운 훈련이나 회복 움직임을 보여줘요. 고강도 두 개를 자동으로 넣지는 않아요"
              selected={draft.secondSessionMode === "RECOVERY_PM_ALLOWED"}
              onClick={() => onSecondSession("RECOVERY_PM_ALLOWED")}
            />
          </>
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
      {step === "goal" && !showTenKm && (
        <button
          className="plan-text-action"
          type="button"
          onClick={() => setShowTenKm(true)}
        >
          10km 계획 보기
        </button>
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
