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
import { assertNever } from "@impl/shared/assert-never"
import { TermHelp } from "../../components/TermHelp"
import type { TermId } from "../../domain/glossary"
import type { PlanBetaIntake } from "../../domain/plan-beta-store"
import {
  ENERGY_INTENT_LABELS,
  EVENT_LABELS,
  EXPERIENCE_LABELS,
} from "./labels"
import { PlanChoice as Choice } from "./PlanChoice"

export type IntakeStep = "goal" | "experience" | "focus" | "days" | "training-time" | "two-a-day" | "safety"

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

const STEP_META: Record<IntakeStep, {
  readonly number: number
  readonly eyebrow: string
  readonly title: string
  readonly copy: string
  readonly helpTerm: TermId
}> = {
  goal: {
    number: 1,
    eyebrow: "GOAL",
    title: "준비할 달리기를 골라주세요",
    copy: "고른 목표는 계획에 준비 종목을 표시하는 데 사용해요. 이번 베타는 종목별 세부 훈련이나 개인 페이스를 계산하지 않아요.",
    helpTerm: "plan-goal",
  },
  experience: {
    number: 2,
    eyebrow: "EXPERIENCE",
    title: "지금까지 어떤 방식으로 달려왔나요?",
    copy: "실력 점수가 아니에요. 고른 경험에 따라 한 번의 훈련 시간을 다르게 잡아요.",
    helpTerm: "plan-experience",
  },
  focus: {
    number: 3,
    eyebrow: "TRAINING FOCUS",
    title: "이번 주기에 어떤 훈련을 더 넣고 싶나요?",
    copy: "고른 목적은 고강도 날의 종류와 RPE 안내를 정해요. 반복 횟수·거리·페이스·회복 시간은 아직 정하지 않아요.",
    helpTerm: "energy-system",
  },
  days: {
    number: 4,
    eyebrow: "AVAILABLE DAYS",
    title: "이번 계획에서 운동할 수 있는 날은 며칠인가요?",
    copy: "달리기뿐 아니라 걷기, 가벼운 조깅, 자전거 같은 회복 운동을 하는 날도 포함해 골라주세요. 고른 날 수를 9.5일 기본 틀의 운동 가능한 날짜에 배치해요. N이 작을수록 계획의 하루 훈련 시간이 늘어날 수 있고, 현재 베타는 여러 날짜 배치 방식 중 이 기본 배치 하나만 제공해요.",
    helpTerm: "training-days",
  },
  "training-time": {
    number: 5,
    eyebrow: "TRAINING TIME",
    title: "주로 언제 운동하나요?",
    copy: "품질 훈련을 보기 편한 시간대에 놓는 데만 사용해요. 운동 능력을 평가하거나 훈련 강도를 바꾸지 않아요.",
    helpTerm: "training-days",
  },
  "two-a-day": {
    number: 6,
    eyebrow: "SECOND SESSION",
    title: "하루에 두 번 운동하는 날도 넣을까요?",
    copy: "일부 날에 오전과 오후 두 칸을 나눠 보여줘요. 집중 훈련은 고른 시간대에, 다른 칸은 가벼운 훈련이나 회복으로 안내해요.",
    helpTerm: "two-a-day",
  },
  safety: {
    number: 7,
    eyebrow: "CURRENT CHECK",
    title: "계획을 만들기 전에 지금 몸 상태를 확인할게요",
    copy: "통증이나 몸 이상이 있으면 계획을 만들지 않아요. 지도자·보호자 또는 의료진과 직접 상의해 주세요. 이 질문은 진단이나 의료 허가가 아닙니다.",
    helpTerm: "review",
  },
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
      <div className="plan-choice-list">
        {step === "goal" && (
          PLAN_EVENT_GROUPS.map((value) => (
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
              title="일부 날은 하루 두 번 운동"
              detail="오전과 오후를 나눠 보여줘요 · 집중 훈련은 고른 시간대에 배치"
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
      {step === "goal" && (
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
      )}
    </section>
  )
}

/**
 * "지금까지" 요약 스트립(WORK_ORDER_UX2 §3-1): 답이 생긴 단계만 한 줄씩 쌓는다.
 * 답이 없는 단계는 렌더링하지 않는다(undefined 미노출 — §2-3 원칙).
 */
function answeredSummary(draft: IntakeDraft): readonly { readonly step: IntakeStep; readonly label: string }[] {
  const lines: { readonly step: IntakeStep; readonly label: string }[] = []
  if (draft.eventGroup !== undefined) lines.push({ step: "goal", label: EVENT_LABELS[draft.eventGroup].title })
  if (draft.experienceBand !== undefined) lines.push({ step: "experience", label: EXPERIENCE_LABELS[draft.experienceBand].title })
  if (draft.trainingFocus !== undefined) lines.push({ step: "focus", label: ENERGY_INTENT_LABELS[draft.trainingFocus].title.split(" · ")[0] ?? "" })
  if (draft.availableDayCount !== undefined) {
    lines.push({
      step: "days",
      label: draft.availableDayCount === "EVERY_DAY" ? "매일" : `${draft.availableDayCount}일`,
    })
  }
  if (draft.trainingTimePreference !== undefined) {
    lines.push({
      step: "training-time",
      label: trainingTimeLabel(draft.trainingTimePreference).title,
    })
  }
  if (draft.secondSessionMode !== undefined) {
    lines.push({
      step: "two-a-day",
      label: draft.secondSessionMode === "SINGLE_SESSION_ONLY" ? "하루 한 번" : "하루 두 번 가능",
    })
  }
  return lines
}

function trainingTimeLabel(preference: TrainingTimePreference): {
  readonly title: string
  readonly detail: string
} {
  switch (preference) {
    case "MORNING":
      return { title: "아침에 운동해요", detail: "품질 훈련을 오전에 먼저 보여줘요" }
    case "EVENING":
      return { title: "저녁에 운동해요", detail: "품질 훈련을 오후에 먼저 보여줘요" }
    case "VARIES":
      return { title: "날마다 달라요", detail: "품질 훈련을 오전에 기본으로 보여줘요" }
    default:
      return assertNever(preference)
  }
}
