import { ChevronRight, SlidersHorizontal } from "lucide-react"
import type { PlanBetaIntake } from "../../domain/plan-beta-store"
import type { IntakeStep } from "./PlanIntake"
import { ENERGY_INTENT_LABELS, EXPERIENCE_LABELS } from "./labels"
import { DIVISION_LABELS, trainingTimeLabel } from "./plan-intake-meta"
import { customizedFromDefaults, eventDistanceLabel } from "./plan-intake-navigation"

type RefineRow = {
  readonly step: IntakeStep
  readonly label: string
  readonly value: string
  readonly changed: boolean
}

/**
 * 계획을 받은 뒤 조금씩 다듬는 목록. 이전 흐름에서 질문했던 항목이 여기로 옮겨왔다.
 * 각 줄을 탭하면 그 질문 하나만 열리고, 고르면 계획을 다시 만들어 이 화면으로 돌아온다.
 * "기본값" 표시는 사용자가 아직 고르지 않았음을 뜻한다 — 기본값이 강도·시간을 바꾸지는 않는다.
 */
export function PlanRefinePanel({
  intake,
  targetRaceDate,
  onRefine,
  /** 상세 훈련표를 고를 수 있는 조합인지(고를 수 없는 조합에서는 줄을 숨겨 글자 피로를 줄인다). */
  detailedTemplateAvailable,
}: {
  readonly intake: PlanBetaIntake
  readonly targetRaceDate?: string
  readonly onRefine: (step: IntakeStep) => void
  readonly detailedTemplateAvailable: boolean
}) {
  const changed = new Set(customizedFromDefaults(intake))
  const primary: readonly RefineRow[] = [
    { step: "goal", label: "목표", value: eventDistanceLabel(intake.eventDistanceM), changed: true },
    { step: "experience", label: "경험", value: EXPERIENCE_LABELS[intake.experienceBand].short, changed: true },
    {
      step: "days",
      label: "운동할 날",
      value: intake.availableDayCount === "EVERY_DAY" ? "매일" : `주 ${intake.availableDayCount}일`,
      changed: true,
    },
  ]
  const secondary: readonly RefineRow[] = [
    {
      step: "frame-length",
      label: "달력 길이",
      value: `${intake.requestedFrameLength}일`,
      changed: changed.has("requestedFrameLength"),
    },
    {
      step: "focus",
      label: "훈련 종류",
      value: ENERGY_INTENT_LABELS[intake.trainingFocus].title.split(" · ")[0] ?? "",
      changed: changed.has("trainingFocus"),
    },
    ...(detailedTemplateAvailable
      ? [{
          step: "template" as const,
          label: "안내 방식",
          value: intake.selectedDetailedTemplateRef === null ? "느낌(RPE) 기준" : "상세 훈련표",
          changed: changed.has("selectedDetailedTemplateRef"),
        }]
      : []),
    {
      step: "training-time",
      label: "시간대",
      value: trainingTimeLabel(intake.trainingTimePreference).title,
      changed: changed.has("trainingTimePreference"),
    },
    {
      step: "two-a-day",
      label: "하루 두 번",
      value: intake.secondSessionMode === "SINGLE_SESSION_ONLY" ? "안 함" : "함",
      changed: changed.has("secondSessionMode"),
    },
    {
      step: "race-date",
      label: "대회 날짜",
      value: targetRaceDate === undefined || targetRaceDate === "" ? "없음" : targetRaceDate,
      changed: targetRaceDate !== undefined && targetRaceDate !== "",
    },
    {
      step: "division",
      label: "참가 부문",
      value: DIVISION_LABELS[intake.competitionDivision].title,
      changed: changed.has("competitionDivision"),
    },
  ]

  return (
    <details className="plan-refine" data-testid="plan-refine">
      <summary>
        <SlidersHorizontal size={16} aria-hidden="true" />
        <span>
          계획 다듬기
          <small>{changed.size === 0 ? "지금은 기본 설정이에요" : `${changed.size}개 바꿨어요`}</small>
        </span>
        <ChevronRight className="plan-refine__chevron" size={16} aria-hidden="true" />
      </summary>
      <p className="plan-refine__hint">
        바꾸면 계획을 다시 만들어요. 훈련 강도는 바뀌지 않고 배치와 표시만 달라져요.
      </p>
      <ul className="plan-refine__list" aria-label="처음 고른 것">
        {primary.map((row) => <RefineLine key={row.step} row={row} onRefine={onRefine} />)}
      </ul>
      <ul className="plan-refine__list" aria-label="더 다듬기">
        {secondary.map((row) => <RefineLine key={row.step} row={row} onRefine={onRefine} />)}
      </ul>
    </details>
  )
}

function RefineLine({ row, onRefine }: { readonly row: RefineRow; readonly onRefine: (step: IntakeStep) => void }) {
  return (
    <li>
      <button
        type="button"
        className="plan-refine__row"
        data-changed={row.changed ? "true" : undefined}
        onClick={() => onRefine(row.step)}
        aria-label={`${row.label} 바꾸기 · 지금 ${row.value}`}
      >
        <span className="plan-refine__label">{row.label}</span>
        <span className="plan-refine__value">
          {row.value}
          {!row.changed && <small>기본</small>}
        </span>
        <ChevronRight aria-hidden="true" size={16} />
      </button>
    </li>
  )
}
