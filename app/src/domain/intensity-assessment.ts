import { z } from "zod"

export const OBJECTIVE_COMPONENT_KIND = {
  running: "RUNNING",
  intervals: "INTERVALS",
  strength: "STRENGTH",
  plyometric: "PLYOMETRIC",
  hills: "HILLS",
  crossTraining: "CROSS_TRAINING",
} as const

type ComponentBase = {
  readonly componentId: string
}

export type RunningLoadComponent = ComponentBase & {
  readonly kind: "RUNNING"
  readonly distanceKm: number
  readonly actualPaceSecondsPerKm: number
  readonly typicalDistanceKm?: number
  readonly referencePaceSecondsPerKm?: number
}

export type IntervalLoadComponent = ComponentBase & {
  readonly kind: "INTERVALS"
  readonly repetitions: number
  readonly workSeconds: number
  readonly recoverySeconds: number
  readonly actualPaceSecondsPerKm?: number
  readonly referencePaceSecondsPerKm?: number
}

export type StrengthLoadComponent = ComponentBase & {
  readonly kind: "STRENGTH"
  readonly exerciseType: string
  readonly sets: number
  readonly repetitions: number
  readonly loadPercent1Rm?: number
  readonly repsInReserve?: number
}

export type PlyometricLoadComponent = ComponentBase & {
  readonly kind: "PLYOMETRIC"
  readonly exerciseType: string
  readonly contacts: number
  readonly typicalContacts?: number
}

export type HillLoadComponent = ComponentBase & {
  readonly kind: "HILLS"
  readonly repetitions: number
  readonly workSeconds: number
  readonly recoverySeconds: number
  readonly gradePercent?: number
}

export type CrossTrainingLoadComponent = ComponentBase & {
  readonly kind: "CROSS_TRAINING"
  readonly modality: string
  readonly durationMin: number
  readonly averageHeartRatePercentMax?: number
}

export type ObjectiveLoadComponent =
  | RunningLoadComponent
  | IntervalLoadComponent
  | StrengthLoadComponent
  | PlyometricLoadComponent
  | HillLoadComponent
  | CrossTrainingLoadComponent

export type SessionIntensityAssessment = {
  readonly schemaVersion: 1
  readonly plannedRpe?: number
  readonly objectiveComponents: readonly ObjectiveLoadComponent[]
}

const componentIdSchema = z.string().trim().min(1).max(64)
const positiveCountSchema = z.number().int().positive().max(2_000)
const positiveSecondsSchema = z.number().int().positive().max(21_600)
const paceSchema = z.number().int().min(30).max(3_600)
const shortLabelSchema = z.string().trim().min(1).max(80)

const runningSchema: z.ZodType<RunningLoadComponent> = z.object({
  componentId: componentIdSchema,
  kind: z.literal(OBJECTIVE_COMPONENT_KIND.running),
  distanceKm: z.number().positive().max(1_000),
  actualPaceSecondsPerKm: paceSchema,
  typicalDistanceKm: z.number().positive().max(1_000).optional(),
  referencePaceSecondsPerKm: paceSchema.optional(),
}).strict()

const intervalSchema: z.ZodType<IntervalLoadComponent> = z.object({
  componentId: componentIdSchema,
  kind: z.literal(OBJECTIVE_COMPONENT_KIND.intervals),
  repetitions: positiveCountSchema.max(200),
  workSeconds: positiveSecondsSchema,
  recoverySeconds: positiveSecondsSchema,
  actualPaceSecondsPerKm: paceSchema.optional(),
  referencePaceSecondsPerKm: paceSchema.optional(),
}).strict().superRefine((component, context) => {
  const hasActualPace = component.actualPaceSecondsPerKm !== undefined
  const hasReferencePace = component.referencePaceSecondsPerKm !== undefined
  if (hasActualPace !== hasReferencePace) {
    context.addIssue({
      code: "custom",
      message: "Actual and reference pace must be provided together.",
      path: [hasActualPace ? "referencePaceSecondsPerKm" : "actualPaceSecondsPerKm"],
    })
  }
})

const strengthSchema: z.ZodType<StrengthLoadComponent> = z.object({
  componentId: componentIdSchema,
  kind: z.literal(OBJECTIVE_COMPONENT_KIND.strength),
  exerciseType: shortLabelSchema,
  sets: positiveCountSchema.max(50),
  repetitions: positiveCountSchema.max(500),
  loadPercent1Rm: z.number().positive().max(150).optional(),
  repsInReserve: z.number().int().min(0).max(10).optional(),
}).strict()

const plyometricSchema: z.ZodType<PlyometricLoadComponent> = z.object({
  componentId: componentIdSchema,
  kind: z.literal(OBJECTIVE_COMPONENT_KIND.plyometric),
  exerciseType: shortLabelSchema,
  contacts: positiveCountSchema,
  typicalContacts: positiveCountSchema.optional(),
}).strict()

const hillSchema: z.ZodType<HillLoadComponent> = z.object({
  componentId: componentIdSchema,
  kind: z.literal(OBJECTIVE_COMPONENT_KIND.hills),
  repetitions: positiveCountSchema.max(200),
  workSeconds: positiveSecondsSchema,
  recoverySeconds: positiveSecondsSchema,
  gradePercent: z.number().positive().max(60).optional(),
}).strict()

const crossTrainingSchema: z.ZodType<CrossTrainingLoadComponent> = z.object({
  componentId: componentIdSchema,
  kind: z.literal(OBJECTIVE_COMPONENT_KIND.crossTraining),
  modality: shortLabelSchema,
  durationMin: z.number().positive().max(1_440),
  averageHeartRatePercentMax: z.number().positive().max(100).optional(),
}).strict()

export const objectiveLoadComponentSchema: z.ZodType<ObjectiveLoadComponent> = z.union([
  runningSchema,
  intervalSchema,
  strengthSchema,
  plyometricSchema,
  hillSchema,
  crossTrainingSchema,
])

export const sessionIntensityAssessmentSchema: z.ZodType<SessionIntensityAssessment> = z.object({
  schemaVersion: z.literal(1),
  plannedRpe: z.number().int().min(1).max(10).optional(),
  objectiveComponents: z.array(objectiveLoadComponentSchema).max(6),
}).strict().superRefine((assessment, context) => {
  const ids = new Set<string>()
  for (const [index, component] of assessment.objectiveComponents.entries()) {
    if (ids.has(component.componentId)) {
      context.addIssue({
        code: "custom",
        message: "Objective component IDs must be unique within a session.",
        path: ["objectiveComponents", index, "componentId"],
      })
    }
    ids.add(component.componentId)
  }
})

export function parseSessionIntensityAssessment(value: unknown): SessionIntensityAssessment | null {
  const result = sessionIntensityAssessmentSchema.safeParse(value)
  return result.success ? result.data : null
}

export { summarizeIntensityAssessment } from "./intensity-summary"
export type { IntensityCoverage, IntensitySummary, ObjectiveComponentSummary } from "./intensity-summary"
