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
  EXPERIENCE_LABELS,
} from "./labels"
import { eventDistanceLabel } from "./plan-intake-navigation"

export type IntakeStep = "goal" | "division" | "experience" | "focus" | "template" | "days" | "training-time" | "two-a-day" | "safety"

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
  NOT_PROVIDED: { title: "선택하지 않음/나중에 입력", detail: "지금 정하지 않고 계획을 계속 만들어요" },
}

export const STEP_META: Record<IntakeStep, {
  readonly number: number
  readonly eyebrow: string
  readonly title: string
  /** 한 줄 이하. 긴 설명은 `helpTerm` 물음표 뒤로 숨긴다. */
  readonly copy: string
  readonly helpTerm: TermId
}> = {
  goal: {
    number: 1,
    eyebrow: "목표",
    title: "어떤 달리기를 준비할까요?",
    copy: "나중에 바꿀 수 있어요.",
    helpTerm: "plan-goal",
  },
  division: {
    number: 0,
    eyebrow: "참가 부문",
    title: "대회 부문이 있나요?",
    copy: "계획에 이름만 표시해요. 강도나 안전 판단에는 쓰지 않아요.",
    helpTerm: "competition-division",
  },
  experience: {
    number: 2,
    eyebrow: "경험",
    title: "지금까지 어떻게 달려왔나요?",
    copy: "점수가 아니에요. 한 번 운동 시간을 정하는 데만 써요.",
    helpTerm: "plan-experience",
  },
  focus: {
    number: 0,
    eyebrow: "훈련 종류",
    title: "이번에 어떤 훈련을 넣을까요?",
    copy: "주요 훈련 하나의 종류를 정해요.",
    helpTerm: "energy-system",
  },
  template: {
    number: 0,
    eyebrow: "안내 방식",
    title: "훈련 강도를 어떻게 안내받을까요?",
    copy: "느낌(RPE) 기준은 기록이 없어도 돼요.",
    helpTerm: "rpe",
  },
  days: {
    number: 3,
    eyebrow: "운동할 날",
    title: "일주일에 며칠 움직일 수 있나요?",
    copy: "걷기나 가벼운 조깅 날도 포함해요.",
    helpTerm: "training-days",
  },
  "training-time": {
    number: 0,
    eyebrow: "시간대",
    title: "주로 언제 운동하나요?",
    copy: "주요 훈련을 놓을 칸만 정해요.",
    helpTerm: "training-days",
  },
  "two-a-day": {
    number: 0,
    eyebrow: "하루 두 번",
    title: "하루에 두 번 운동하는 날도 넣을까요?",
    copy: "고르면 훈련일을 오전·오후 두 칸으로 나눠요.",
    helpTerm: "two-a-day",
  },
  safety: {
    number: 4,
    eyebrow: "몸 상태",
    title: "지금 몸은 어때요?",
    copy: "아픈 곳이 있으면 계획 대신 쉬는 안내를 보여드려요.",
    helpTerm: "review",
  },
}

export function answeredSummary(
  draft: Partial<PlanBetaIntake>,
): readonly { readonly step: IntakeStep; readonly label: string }[] {
  const lines: { readonly step: IntakeStep; readonly label: string }[] = []
  if (draft.eventDistanceM !== undefined) lines.push({ step: "goal", label: eventDistanceLabel(draft.eventDistanceM) })
  if (draft.competitionDivision !== undefined && draft.competitionDivision !== "NOT_PROVIDED") {
    lines.push({ step: "division", label: DIVISION_LABELS[draft.competitionDivision].title })
  }
  if (draft.experienceBand !== undefined) lines.push({ step: "experience", label: EXPERIENCE_LABELS[draft.experienceBand].title })
  if (draft.trainingFocus !== undefined) lines.push({ step: "focus", label: ENERGY_INTENT_LABELS[draft.trainingFocus].title.split(" · ")[0] ?? "" })
  if (draft.selectedDetailedTemplateRef !== undefined) {
    lines.push({
      step: "template",
      label: draft.selectedDetailedTemplateRef === null ? "RPE 기준" : "상세 훈련 선택",
    })
  }
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
      return { title: "아침에 운동해요", detail: "주요 훈련을 오전에 먼저 배치해요" }
    case "EVENING":
      return { title: "저녁에 운동해요", detail: "주요 훈련을 오후에 먼저 배치해요" }
    case "VARIES":
      return { title: "날마다 달라요", detail: "주요 훈련은 오전에 기본 배치해요" }
    default:
      return assertNever(preference)
  }
}
