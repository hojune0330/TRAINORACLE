import type {
  ExperienceBand,
  PlanEventGroup,
  PlannedEnergyIntent,
  TrainingTimePreference,
} from "@impl/plan-generator/types"
import { assertNever } from "@impl/shared/assert-never"
import type { PlanBetaIntake } from "../../domain/plan-beta-store"
import type { CompetitionDivision } from "../../domain/plan-beta-schema"
import type { TermId } from "../../domain/glossary"
import {
  ENERGY_INTENT_LABELS,
  EVENT_LABELS,
  EXPERIENCE_LABELS,
} from "./labels"

export type IntakeStep = "goal" | "division" | "experience" | "focus" | "days" | "training-time" | "two-a-day" | "safety"

export const DIVISION_LABELS: Record<CompetitionDivision, {
  readonly title: string
  readonly detail: string
}> = {
  ELEMENTARY: { title: "초등부", detail: "현재 대회에서 초등부로 참가하거나 준비 중" },
  MIDDLE_SCHOOL: { title: "중등부", detail: "현재 대회에서 중등부로 참가하거나 준비 중" },
  HIGH_SCHOOL: { title: "고등부", detail: "현재 대회에서 고등부로 참가하거나 준비 중" },
  COLLEGE: { title: "대학부", detail: "현재 대회에서 대학부로 참가하거나 준비 중" },
  OPEN: { title: "일반부", detail: "현재 대회에서 일반부로 참가하거나 준비 중" },
  MASTERS: { title: "생활체육·마스터즈", detail: "연령대·동호인 부문 대회를 준비 중" },
  NO_REGISTERED_DIVISION: { title: "정해진 참가 부문이 없어요", detail: "대회 등록 없이 혼자 훈련하거나 아직 부문을 정하지 않음" },
  NOT_PROVIDED: { title: "참가 부문 미기록", detail: "이전 계획에는 참가 부문을 기록하지 않았어요" },
}

export const STEP_META: Record<IntakeStep, {
  readonly number: number
  readonly eyebrow: string
  readonly title: string
  readonly copy: string
  readonly helpTerm: TermId
}> = {
  goal: {
    number: 1,
    eyebrow: "목표 종목",
    title: "준비할 달리기를 골라주세요",
    copy: "고른 목표는 계획에 준비 종목을 표시하는 데 사용해요. 이번 베타는 종목별 세부 훈련이나 개인 페이스를 계산하지 않아요.",
    helpTerm: "plan-goal",
  },
  division: {
    number: 2,
    eyebrow: "현재 참가 부문",
    title: "현재 참가하거나 준비 중인 부문이 있나요?",
    copy: "대회마다 이름과 참가 기준이 다를 수 있어요. 이 선택은 계획에 구분을 표시하는 데만 쓰며 나이·성숙도·미성년 여부·훈련 강도·의료 판단에 사용하지 않아요.",
    helpTerm: "competition-division",
  },
  experience: {
    number: 3,
    eyebrow: "훈련 경험",
    title: "지금까지 어떤 방식으로 달려왔나요?",
    copy: "실력 점수가 아니에요. 고른 경험에 따라 한 번의 훈련 시간을 다르게 잡아요.",
    helpTerm: "plan-experience",
  },
  focus: {
    number: 4,
    eyebrow: "이번 목표",
    title: "이번 주기에 어떤 훈련을 더 넣고 싶나요?",
    copy: "고른 목적은 고강도 날의 종류와 RPE 안내를 정해요. 반복 횟수·거리·페이스·회복 시간은 아직 정하지 않아요.",
    helpTerm: "energy-system",
  },
  days: {
    number: 5,
    eyebrow: "가능한 날",
    title: "이번 계획에서 운동할 수 있는 날은 며칠인가요?",
    copy: "달리기뿐 아니라 걷기, 가벼운 조깅, 자전거 같은 회복 운동을 하는 날도 포함해 골라주세요. 고른 날 수를 9.5일 기본 틀의 운동 가능한 날짜에 배치해요. N이 작을수록 계획의 하루 훈련 시간이 늘어날 수 있고, 현재 베타는 여러 날짜 배치 방식 중 이 기본 배치 하나만 제공해요.",
    helpTerm: "training-days",
  },
  "training-time": {
    number: 6,
    eyebrow: "주로 하는 시간",
    title: "주로 언제 운동하나요?",
    copy: "품질 훈련을 보기 편한 시간대에 놓는 데만 사용해요. 운동 능력을 평가하거나 훈련 강도를 바꾸지 않아요.",
    helpTerm: "training-days",
  },
  "two-a-day": {
    number: 7,
    eyebrow: "하루 두 번 훈련",
    title: "하루에 두 번 운동하는 날도 넣을까요?",
    copy: "고른 모든 훈련일을 오전과 오후 두 칸으로 나눠 보여줘요. 집중 훈련은 고른 시간대에, 다른 칸은 가벼운 훈련이나 회복으로 안내해요.",
    helpTerm: "two-a-day",
  },
  safety: {
    number: 8,
    eyebrow: "지금 몸 상태",
    title: "계획을 만들기 전에 지금 몸 상태를 확인할게요",
    copy: "통증이나 몸 이상이 있으면 계획을 만들지 않아요. 지도자·보호자 또는 의료진과 직접 상의해 주세요. 이 질문은 진단이나 의료 허가가 아닙니다.",
    helpTerm: "review",
  },
}

export function answeredSummary(
  draft: Partial<PlanBetaIntake>,
): readonly { readonly step: IntakeStep; readonly label: string }[] {
  const lines: { readonly step: IntakeStep; readonly label: string }[] = []
  if (draft.eventGroup !== undefined) lines.push({ step: "goal", label: EVENT_LABELS[draft.eventGroup].title })
  if (draft.competitionDivision !== undefined && draft.competitionDivision !== "NOT_PROVIDED") {
    lines.push({ step: "division", label: DIVISION_LABELS[draft.competitionDivision].title })
  }
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

export function trainingTimeLabel(preference: TrainingTimePreference): {
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
