import { z } from "zod"
import { canonicalJsonFingerprint } from "@impl/plan-generator/candidate-identity"

export const PERIODIZATION_FRAME_COUNT = 18 as const
export const PERIODIZATION_MESOCYCLE_FRAME_COUNT = 3 as const

export const periodizationPhaseSchema = z.enum([
  "BASE",
  "DEVELOPMENT",
  "COMPETITION_SPECIFIC",
  "TAPER_PEAK",
])

export const periodizationContextSchema = z.object({
  schemaVersion: z.literal(1),
  programLineageId: z.string().regex(/^sha256:[a-f0-9]{64}$/u),
  macrocycleOrdinal: z.number().int().positive(),
  frameOrdinal: z.number().int().min(1).max(PERIODIZATION_FRAME_COUNT),
  mesocycleOrdinal: z.number().int().min(1).max(6),
  phase: periodizationPhaseSchema,
  frameLengthDays: z.literal(9.5),
  targetFrameCount: z.literal(PERIODIZATION_FRAME_COUNT),
  startedAt: z.string().datetime({ offset: true }),
  frameStartedAt: z.string().datetime({ offset: true }),
  source: z.enum(["NEW_PLAN", "ROLLED_FORWARD"]),
}).strict().superRefine((context, refinement) => {
  if (context.mesocycleOrdinal !== Math.ceil(context.frameOrdinal / PERIODIZATION_MESOCYCLE_FRAME_COUNT)) {
    refinement.addIssue({
      code: "custom",
      path: ["mesocycleOrdinal"],
      message: "Mesocycle position must follow the three-frame display grouping.",
    })
  }
  if (context.phase !== periodizationPhaseFor(context.frameOrdinal)) {
    refinement.addIssue({
      code: "custom",
      path: ["phase"],
      message: "Macrocycle phase must follow the owner-approved 18-frame direction.",
    })
  }
})

export type PeriodizationContext = z.infer<typeof periodizationContextSchema>
export type PeriodizationPhase = z.infer<typeof periodizationPhaseSchema>

export function createInitialPeriodizationContext(
  candidateId: string,
  startedAt: string,
): PeriodizationContext | null {
  if (!isCanonicalTimestamp(startedAt) || candidateId.trim() === "") return null
  const candidateFingerprint = canonicalJsonFingerprint(
    "trainoracle.periodization-initial-candidate.v1",
    candidateId,
  )
  return parseContext({
    schemaVersion: 1,
    programLineageId: canonicalJsonFingerprint("trainoracle.periodization-program.v1", {
      candidateFingerprint,
      startedAt,
    }),
    macrocycleOrdinal: 1,
    frameOrdinal: 1,
    mesocycleOrdinal: 1,
    phase: "BASE",
    frameLengthDays: 9.5,
    targetFrameCount: PERIODIZATION_FRAME_COUNT,
    startedAt,
    frameStartedAt: startedAt,
    source: "NEW_PLAN",
  })
}

export function advancePeriodizationContext(
  previous: PeriodizationContext,
  frameStartedAt: string,
): PeriodizationContext | null {
  if (!isCanonicalTimestamp(frameStartedAt)
      || Date.parse(frameStartedAt) < Date.parse(previous.frameStartedAt)) return null
  const startsNextMacrocycle = previous.frameOrdinal === PERIODIZATION_FRAME_COUNT
  const frameOrdinal = startsNextMacrocycle ? 1 : previous.frameOrdinal + 1
  return parseContext({
    ...previous,
    macrocycleOrdinal: startsNextMacrocycle
      ? previous.macrocycleOrdinal + 1
      : previous.macrocycleOrdinal,
    frameOrdinal,
    mesocycleOrdinal: Math.ceil(frameOrdinal / PERIODIZATION_MESOCYCLE_FRAME_COUNT),
    phase: periodizationPhaseFor(frameOrdinal),
    frameStartedAt,
    source: "ROLLED_FORWARD",
  })
}

export function periodizationPhaseFor(frameOrdinal: number): PeriodizationPhase {
  if (frameOrdinal <= 6) return "BASE"
  if (frameOrdinal <= 11) return "DEVELOPMENT"
  if (frameOrdinal <= 16) return "COMPETITION_SPECIFIC"
  return "TAPER_PEAK"
}

export const PERIODIZATION_PHASE_LABELS: Readonly<Record<PeriodizationPhase, string>> = {
  BASE: "기초를 쌓는 구간",
  DEVELOPMENT: "여러 능력을 발전시키는 구간",
  COMPETITION_SPECIFIC: "경기와 가까운 훈련 구간",
  TAPER_PEAK: "경기 전 피로를 줄이는 구간",
}

function parseContext(candidate: unknown): PeriodizationContext | null {
  const parsed = periodizationContextSchema.safeParse(candidate)
  return parsed.success ? parsed.data : null
}

function isCanonicalTimestamp(value: string): boolean {
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value
}
