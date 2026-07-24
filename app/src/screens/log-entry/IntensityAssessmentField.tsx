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

export function useIntensityAssessment(
  initialAssessment?: SessionIntensityAssessment,
): IntensityAssessmentController {
  const [plannedRpe, setPlannedRpe] = React.useState(initialAssessment?.plannedRpe ?? 0)
  const [objectiveComponents, setObjectiveComponents] = React.useState<readonly ObjectiveLoadComponent[]>(
    initialAssessment?.objectiveComponents ?? [],
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
}: {
  readonly controller: IntensityAssessmentController
  readonly reportedRpe: number
}) {
  const summary = summarizeIntensityAssessment(controller.assessment, reportedRpe)

  return (
    <>
      <FormSec lb={`예상 강도 (${controller.plannedRpe > 0 ? `${controller.plannedRpe}/10` : "미선택"})`}>
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
      <FormSec lb={`객관 기록 · ${controller.objectiveComponents.length}개`}>
        <ObjectiveComponentEditor
          disabled={controller.objectiveComponents.length >= 6}
          onAdd={controller.addComponent}
        />
        <IntensitySummaryPanel summary={summary} onRemove={controller.removeComponent} />
      </FormSec>
    </>
  )
}
