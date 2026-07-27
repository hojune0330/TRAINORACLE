import { ArrowLeft, ChevronRight } from "lucide-react"
import {
  EXPERIENCE_BANDS,
  PLAN_EVENT_GROUPS,
  PLANNED_ENERGY_INTENTS,
} from "@impl/plan-generator/types"
import type {
  ExperienceBand,
  PlanEventGroup,
  PlannedEnergyIntent,
  SecondSessionMode,
} from "@impl/plan-generator/types"
import { TermHelp } from "../../components/TermHelp"
import type { TermId } from "../../domain/glossary"
import type { PlanBetaIntake } from "../../domain/plan-beta-store"
import {
  ENERGY_INTENT_LABELS,
  EVENT_LABELS,
  EXPERIENCE_LABELS,
} from "./labels"

export type IntakeStep = "goal" | "experience" | "focus" | "days" | "frame" | "two-a-day" | "safety"

type IntakeDraft = Partial<PlanBetaIntake>

type PlanIntakeProps = {
  readonly step: IntakeStep
  readonly draft: IntakeDraft
  readonly onBack: () => void
  readonly onGoal: (goal: PlanEventGroup) => void
  readonly onExperience: (band: ExperienceBand) => void
  readonly onFocus: (focus: PlannedEnergyIntent) => void
  readonly onDays: (days: PlanBetaIntake["availableDayCount"]) => void
  readonly onFrame: (days: 7 | 9 | 10) => void
  readonly onSecondSession: (mode: SecondSessionMode) => void
  readonly onOpenNotationReader: () => void
  readonly onSafety: (
    currentCheck: "NO_KNOWN_RISK" | "REVIEW_REQUIRED",
  ) => void
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
    copy: "달리기뿐 아니라 걷기, 가벼운 조깅, 자전거 같은 회복 운동을 하는 날도 포함해 골라주세요. 완전히 쉬는 날은 빼세요.",
    helpTerm: "training-days",
  },
  frame: {
    number: 5,
    eyebrow: "FRAME",
    title: "첫 훈련 계획을 며칠로 만들까요?",
    copy: "처음이라면 9일을 권장해요. 7일을 고르면 짧게 시작하고, 끝난 뒤에는 이번 선택과 진행 기록을 바탕으로 다음 주기를 이어 만듭니다.",
    helpTerm: "plan-frame",
  },
  "two-a-day": {
    number: 6,
    eyebrow: "SECOND SESSION",
    title: "하루에 두 번 운동하는 날도 넣을까요?",
    copy: "선택하면 일부 날에 오전 기본 훈련과 오후 회복 운동을 나눠 보여줘요. 오후 운동은 RPE 1~2이고, 고강도 두 번이나 놓친 운동 보충은 만들지 않아요.",
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
  onFrame,
  onSecondSession,
  onOpenNotationReader,
  onSafety,
}: PlanIntakeProps) {
  const meta = STEP_META[step]
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
        {step === "frame" && (
          ([9, 10, 7] as const).map((days) => (
            <Choice
              key={days}
              title={`${days}일 계획${days === 9 ? " · 처음 시작할 때 권장" : ""}`}
              detail={days === 7
                ? "이번에는 7일만 보고, 끝나면 새 계획 생성"
                : days === 9
                  ? "TrainOracle이 첫 계획에 사용하는 기본 길이"
                  : "같은 훈련 횟수를 더 긴 기간에 나눠 배치"}
              selected={draft.requestedFrameLength === days}
              onClick={() => onFrame(days)}
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
              detail="오전 기본 훈련과 오후 RPE 1~2 회복 운동만 나눠 보여줘요"
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
        <button
          className="plan-text-action plan-notation-entry"
          type="button"
          onClick={onOpenNotationReader}
        >
          훈련표 표기 읽기
        </button>
      )}
    </section>
  )
}

function Choice({
  title,
  detail,
  selected,
  onClick,
}: {
  readonly title: string
  readonly detail: string
  readonly selected: boolean
  readonly onClick: () => void
}) {
  return (
    <button
      className="plan-choice"
      type="button"
      aria-pressed={selected}
      onClick={onClick}
    >
      <span>
        <strong>{title}</strong>
        <small>{detail}</small>
      </span>
      <ChevronRight aria-hidden="true" size={18} />
    </button>
  )
}
