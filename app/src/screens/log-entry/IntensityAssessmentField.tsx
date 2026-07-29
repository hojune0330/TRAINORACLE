import React from "react"
import { summarizeIntensityAssessment } from "../../domain/intensity-assessment"
import type { ObjectiveLoadComponent, SessionIntensityAssessment } from "../../domain/intensity-assessment"
import { IntensitySummaryPanel } from "./IntensitySummaryPanel"
import { ObjectiveComponentEditor } from "./ObjectiveComponentEditor"
import { FormSec } from "./shared"

export type IntensityAssessmentController = {
  readonly plannedRpe: number
  readonly objectiveComponents: readonly ObjectiveLoadComponent[]
  readonly assessment: SessionIntensityAssessment | undefined
  readonly setPlannedRpe: (value: number) => void
  readonly addComponent: (component: ObjectiveLoadComponent) => void
  readonly removeComponent: (componentId: string) => void
}

export function useIntensityAssessment(initial?: SessionIntensityAssessment): IntensityAssessmentController {
  const [plannedRpe, setPlannedRpe] = React.useState(() => initial?.plannedRpe ?? 0)
  const [objectiveComponents, setObjectiveComponents] = React.useState<readonly ObjectiveLoadComponent[]>(
    () => initial?.objectiveComponents.map((component) => ({ ...component })) ?? [],
  )
  const assessment: SessionIntensityAssessment | undefined = plannedRpe === 0 && objectiveComponents.length === 0
    ? undefined
    : {
        schemaVersion: 1,
        ...(plannedRpe === 0 ? {} : { plannedRpe }),
        objectiveComponents,
      }

  return {
    plannedRpe,
    objectiveComponents,
    assessment,
    setPlannedRpe,
    addComponent: (component) => setObjectiveComponents((current) => [...current, component]),
    removeComponent: (componentId) => setObjectiveComponents((current) => current.filter((component) => component.componentId !== componentId)),
  }
}

export function IntensityAssessmentField({
  controller,
  reportedRpe,
  onSectionTouch,
}: {
  readonly controller: IntensityAssessmentController
  readonly reportedRpe: number
  /**
   * 구획을 건드렸다고 화면에 알린다. 이 화면이 아니라 **앞 구획** 을 접는 데
   * 쓰인다 (오너 결정 "건드릴 때"). 안 주면 아무 일도 안 일어난다.
   */
  readonly onSectionTouch?: (sectionId: string) => void
}) {
  const summary = summarizeIntensityAssessment(controller.assessment, reportedRpe)
  const touchOf = (sectionId: string) => onSectionTouch === undefined
    ? undefined
    : () => onSectionTouch(sectionId)

  return (
    <>
      <FormSec
        lb={`예상 강도 (${controller.plannedRpe > 0 ? `${controller.plannedRpe}/10` : "미선택"})`}
        onTouch={touchOf("planned-rpe")}
      >
        <div className="journal-ten-scale" style={{ display: "grid", gap: 0, border: "1px solid var(--ink)" }}>
          {Array.from({ length: 10 }, (_, index) => index + 1).map((value) => (
            <button
              key={value}
              type="button"
              aria-label={`예상 강도 ${value}`}
              aria-pressed={controller.plannedRpe === value}
              onClick={() => controller.setPlannedRpe(controller.plannedRpe === value ? 0 : value)}
              style={{
                minHeight: 44, padding: "12px 0", border: 0, cursor: "pointer",
                background: controller.plannedRpe === value ? "var(--ink)" : "transparent",
                color: controller.plannedRpe === value ? "var(--bg)" : "var(--ink)",
                fontFamily: "var(--mono)", fontSize: 12, fontWeight: 500,
                borderRight: value < 10 ? "1px solid var(--line)" : 0,
              }}
            >{value}</button>
          ))}
        </div>
      </FormSec>
      {/*
        객관 기록은 아무것도 안 넣어도 393px 다 — 훈련 후 일지 길이의 29%.
        필수 입력이 아니므로 닫힌 상태로 시작한다. (작업지시서 UX1 §2-2)
        이미 넣은 항목이 있으면 autoOpenWhen 이 펼친다.
        닫혀 있어도 children 은 DOM 에 남는다. 지우면 저장된 값이 사라진다.
      */}
      <FormSec
        lb={`객관 기록 · ${controller.objectiveComponents.length}개`}
        collapsible
        defaultOpen={false}
        autoOpenWhen={controller.objectiveComponents.length > 0}
        expandHint="+ 추가"
        onTouch={touchOf("objective")}
      >
        <ObjectiveComponentEditor
          disabled={controller.objectiveComponents.length >= 6}
          onAdd={controller.addComponent}
        />
        <IntensitySummaryPanel summary={summary} onRemove={controller.removeComponent} />
      </FormSec>
    </>
  )
}
