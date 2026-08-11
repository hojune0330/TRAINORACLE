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
import type { PlanBetaIntake } from "../../domain/plan-beta-store"
import {
  ENERGY_INTENT_LABELS,
  EVENT_LABELS,
  EXPERIENCE_LABELS,
} from "./labels"
import { PlanChoice as Choice } from "./PlanChoice"
import { answeredSummary, STEP_META, trainingTimeLabel } from "./plan-intake-meta"
import type { IntakeStep } from "./plan-intake-meta"

export type { IntakeStep } from "./plan-intake-meta"

type IntakeDraft = Partial<PlanBetaIntake>

type PlanIntakeProps = {
  readonly step: IntakeStep
  readonly draft: IntakeDraft
  readonly onBack: () => void
  readonly onGoal: (goal: PlanEventGroup) => void
  readonly onExperience: (band: ExperienceBand) => void
  readonly onFocus: (focus: PlannedEnergyIntent) => void
  readonly onDays: (days: PlanBetaIntake["availableDayCount"]) => void
  readonly onTrainingTime: (preference: TrainingTimePreference) => void
  readonly onSecondSession: (mode: SecondSessionMode) => void
  readonly onManageRecords: () => void
  readonly onOpenNotationReader: () => void
  readonly onSafety: (
    currentCheck: "NO_KNOWN_RISK" | "REVIEW_REQUIRED",
  ) => void
  /** "지금까지" 요약 줄을 탭하면 해당 단계로 점프(WORK_ORDER_UX2 §3-1) */
  readonly onJump?: (step: IntakeStep) => void
}
export function PlanIntake({
  step,
  draft,
  onBack,
  onGoal,
  onExperience,
  onFocus,
  onDays,
  onTrainingTime,
  onSecondSession,
  onManageRecords,
  onOpenNotationReader,
  onSafety,
  onJump,
}: PlanIntakeProps) {
  const meta = STEP_META[step]
  const answeredSteps = answeredSummary(draft)
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
      <div className="plan-progress" aria-label={`계획 질문 ${meta.number}/7`}>
        <span>{meta.number}/7</span>
        <i style={{ width: `${meta.number * (100 / 7)}%` }} />
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
        <TermHelp term={meta.helpTerm} />
      </div>
      <p className="plan-copy">{meta.copy}</p>
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
              detail="고른 모든 훈련일에 오전 주 훈련과 오후 회복 움직임을 보여줘요. 고강도 두 개를 자동으로 넣지는 않아요"
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
