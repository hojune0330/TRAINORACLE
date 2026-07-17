import type { ObjectiveLoadComponent, SessionIntensityAssessment } from "./intensity-assessment"

export type IntensityCoverage = "COMBINED" | "SUBJECTIVE_ONLY" | "OBJECTIVE_ONLY" | "MISSING"

export type ObjectiveFact =
  | {
      readonly text: string
      readonly provenance: "EXPLICIT"
    }
  | {
      readonly text: string
      readonly provenance: "DERIVED"
      readonly derivationRuleId: string
      readonly derivedFrom: readonly string[]
    }

export type ObjectiveComponentSummary = {
  readonly componentId: string
  readonly kind: ObjectiveLoadComponent["kind"]
  readonly label: string
  readonly facts: readonly ObjectiveFact[]
}

export type IntensitySummary = {
  readonly coverage: IntensityCoverage
  readonly plannedRpe?: number
  readonly reportedRpe?: number
  readonly objectiveComponents: readonly ObjectiveComponentSummary[]
}

function percent(numerator: number, denominator: number): string {
  return `${Math.round((numerator / denominator) * 100)}%`
}

function density(workSeconds: number, recoverySeconds: number): string {
  return percent(workSeconds, workSeconds + recoverySeconds)
}

function explicit(text: string): ObjectiveFact {
  return { text, provenance: "EXPLICIT" }
}

function derived(text: string, derivationRuleId: string, derivedFrom: readonly string[]): ObjectiveFact {
  return { text, provenance: "DERIVED", derivationRuleId, derivedFrom }
}

function summarizeComponent(component: ObjectiveLoadComponent): ObjectiveComponentSummary {
  switch (component.kind) {
    case "RUNNING":
      return {
        componentId: component.componentId,
        kind: component.kind,
        label: "달리기",
        facts: [
          explicit(`거리 ${component.distanceKm}km`),
          ...(component.referencePaceSecondsPerKm === undefined
            ? []
            : [derived(
                `개인 기준 페이스 대비 ${percent(component.referencePaceSecondsPerKm, component.actualPaceSecondsPerKm)}`,
                "INTENSITY_RUNNING_PACE_RATIO_V1",
                ["referencePaceSecondsPerKm", "actualPaceSecondsPerKm"],
              )]),
          ...(component.typicalDistanceKm === undefined
            ? []
            : [derived(
                `평소 거리 대비 ${percent(component.distanceKm, component.typicalDistanceKm)}`,
                "INTENSITY_RUNNING_DISTANCE_RATIO_V1",
                ["distanceKm", "typicalDistanceKm"],
              )]),
        ],
      }
    case "INTERVALS":
      return {
        componentId: component.componentId,
        kind: component.kind,
        label: "인터벌",
        facts: [
          explicit(`${component.repetitions}회 · 운동 ${component.workSeconds}초 / 회복 ${component.recoverySeconds}초`),
          derived(
            `운동 비중 ${density(component.workSeconds, component.recoverySeconds)}`,
            "INTENSITY_INTERVAL_WORK_DENSITY_V1",
            ["workSeconds", "recoverySeconds"],
          ),
          ...(component.referencePaceSecondsPerKm === undefined || component.actualPaceSecondsPerKm === undefined
            ? []
            : [derived(
                `개인 기준 페이스 대비 ${percent(component.referencePaceSecondsPerKm, component.actualPaceSecondsPerKm)}`,
                "INTENSITY_INTERVAL_PACE_RATIO_V1",
                ["referencePaceSecondsPerKm", "actualPaceSecondsPerKm"],
              )]),
        ],
      }
    case "STRENGTH":
      return {
        componentId: component.componentId,
        kind: component.kind,
        label: "근력",
        facts: [
          explicit(`${component.exerciseType} · ${component.sets}세트 × ${component.repetitions}회`),
          ...(component.loadPercent1Rm === undefined ? [] : [explicit(`${component.loadPercent1Rm}% 1RM`)]),
          ...(component.repsInReserve === undefined ? [] : [explicit(`RIR ${component.repsInReserve}`)]),
        ],
      }
    case "PLYOMETRIC":
      return {
        componentId: component.componentId,
        kind: component.kind,
        label: "플라이오",
        facts: [
          explicit(`${component.exerciseType} · ${component.contacts}회 접지`),
          ...(component.typicalContacts === undefined
            ? []
            : [derived(
                `평소 접지 수 대비 ${percent(component.contacts, component.typicalContacts)}`,
                "INTENSITY_PLYOMETRIC_CONTACT_RATIO_V1",
                ["contacts", "typicalContacts"],
              )]),
        ],
      }
    case "HILLS":
      return {
        componentId: component.componentId,
        kind: component.kind,
        label: "언덕",
        facts: [
          explicit(`${component.repetitions}회 · 운동 ${component.workSeconds}초 / 회복 ${component.recoverySeconds}초`),
          derived(
            `운동 비중 ${density(component.workSeconds, component.recoverySeconds)}`,
            "INTENSITY_HILL_WORK_DENSITY_V1",
            ["workSeconds", "recoverySeconds"],
          ),
          ...(component.gradePercent === undefined ? [] : [explicit(`경사 ${component.gradePercent}%`)]),
        ],
      }
    case "CROSS_TRAINING":
      return {
        componentId: component.componentId,
        kind: component.kind,
        label: "대체유산소",
        facts: [
          explicit(`${component.modality} · ${component.durationMin}분`),
          ...(component.averageHeartRatePercentMax === undefined
            ? []
            : [explicit(`평균 심박 ${component.averageHeartRatePercentMax}% HRmax`)]),
        ],
      }
  }
}

export function summarizeIntensityAssessment(
  assessment: SessionIntensityAssessment | undefined,
  reportedRpe: number,
): IntensitySummary {
  const plannedRpe = assessment?.plannedRpe
  const normalizedReportedRpe = reportedRpe > 0 ? reportedRpe : undefined
  const objectiveComponents = assessment?.objectiveComponents.map(summarizeComponent) ?? []
  const hasSubjective = plannedRpe !== undefined || normalizedReportedRpe !== undefined
  const hasObjective = objectiveComponents.length > 0
  const coverage: IntensityCoverage = hasSubjective
    ? (hasObjective ? "COMBINED" : "SUBJECTIVE_ONLY")
    : (hasObjective ? "OBJECTIVE_ONLY" : "MISSING")

  return {
    coverage,
    ...(plannedRpe === undefined ? {} : { plannedRpe }),
    ...(normalizedReportedRpe === undefined ? {} : { reportedRpe: normalizedReportedRpe }),
    objectiveComponents,
  }
}
