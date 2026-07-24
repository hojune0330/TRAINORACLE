import { ArrowLeft, ChevronRight } from "lucide-react"
import {
  EXPERIENCE_BANDS,
  PLAN_EVENT_GROUPS,
} from "@impl/plan-generator/types"
import type {
  ExperienceBand,
  PlanEventGroup,
} from "@impl/plan-generator/types"
import type { PlanBetaIntake } from "../../domain/plan-beta-store"
import { EVENT_LABELS, EXPERIENCE_LABELS } from "./labels"

export type IntakeStep = "goal" | "experience" | "days" | "frame" | "safety"

type IntakeDraft = Partial<PlanBetaIntake>

type PlanIntakeProps = {
  readonly step: IntakeStep
  readonly draft: IntakeDraft
  readonly onBack: () => void
  readonly onGoal: (goal: PlanEventGroup) => void
  readonly onExperience: (band: ExperienceBand) => void
  readonly onDays: (days: 3 | 4 | 5) => void
  readonly onFrame: (days: 7 | 9 | 10) => void
  readonly onSafety: (
    currentCheck: "NO_KNOWN_RISK" | "REVIEW_REQUIRED",
  ) => void
}

const STEP_META: Record<IntakeStep, {
  readonly number: number
  readonly eyebrow: string
  readonly title: string
  readonly copy: string
}> = {
  goal: {
    number: 1,
    eyebrow: "GOAL",
    title: "어떤 훈련을 원하세요?",
    copy: "기록이 없어도 목표부터 고를 수 있어요.",
  },
  experience: {
    number: 2,
    eyebrow: "EXPERIENCE",
    title: "현재 경험과 가까운 것은?",
    copy: "실력 평가가 아니에요. 시작 강도를 낮추는 선택이에요.",
  },
  days: {
    number: 3,
    eyebrow: "AVAILABLE DAYS",
    title: "한 주기에서 며칠이 편한가요?",
    copy: "선택하지 않은 날은 휴식 또는 회복일로 남겨요.",
  },
  frame: {
    number: 4,
    eyebrow: "FRAME",
    title: "첫 계획 길이를 골라주세요",
    copy: "9일을 권장해요. 7일은 다음 계획과 이어집니다.",
  },
  safety: {
    number: 5,
    eyebrow: "CURRENT CHECK",
    title: "지금 몸 상태를 확인할게요",
    copy: "의료 판단이 아니에요.\n계획 전 위험 신호만 확인해요.",
  },
}

export function PlanIntake({
  step,
  draft,
  onBack,
  onGoal,
  onExperience,
  onDays,
  onFrame,
  onSafety,
}: PlanIntakeProps) {
  const meta = STEP_META[step]
  return (
    <section className="plan-intake" aria-labelledby="plan-intake-title">
      <button className="plan-back" type="button" onClick={onBack}>
        <ArrowLeft aria-hidden="true" size={17} />
        이전
      </button>
      <div className="plan-progress" aria-label={`계획 질문 ${meta.number}/5`}>
        <span>{meta.number}/5</span>
        <i style={{ width: `${meta.number * 20}%` }} />
      </div>
      <div className="plan-eyebrow">{meta.eyebrow}</div>
      <h1 id="plan-intake-title">{meta.title}</h1>
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
        {step === "days" && (
          ([3, 4, 5] as const).map((days) => (
            <Choice
              key={days}
              title={`${days}일`}
              detail={days === 3 ? "회복 여유를 넉넉히" : days === 4 ? "훈련과 회복을 균형 있게" : "달리는 날을 조금 더 자주"}
              selected={draft.availableDayCount === days}
              onClick={() => onDays(days)}
            />
          ))
        )}
        {step === "frame" && (
          ([9, 10, 7] as const).map((days) => (
            <Choice
              key={days}
              title={`${days}일 계획${days === 9 ? " · 권장" : ""}`}
              detail={days === 7 ? "짧게 시작하고 다음 주기에 연결" : days === 9 ? "기본 훈련과 회복 리듬" : "회복 간격을 조금 더 넉넉히"}
              selected={draft.requestedFrameLength === days}
              onClick={() => onFrame(days)}
            />
          ))
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
              detail="계획을 만들지 않고 사람의 확인으로 연결"
              selected={false}
              onClick={() => onSafety("REVIEW_REQUIRED")}
            />
          </>
        )}
      </div>
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
