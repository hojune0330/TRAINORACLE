import { z } from "zod"

export const fatigueVectorSchema = z.object({
  neural: z.number().min(0).max(10),
  metabolic: z.number().min(0).max(10),
  muscular: z.number().min(0).max(10),
  impact: z.number().min(0).max(10),
  subjective: z.number().min(0).max(10),
})

export const fatigueEvidenceSchema = z.object({
  observedAt: z.string().datetime({ offset: true }),
  source: z.literal("SELF_REPORTED_SLIDERS"),
  uncertainty: z.literal("HIGH_SUBJECTIVE_ONLY"),
  containsPrivateRawText: z.literal(false),
})

export type FatigueVector = z.infer<typeof fatigueVectorSchema>
export type FatigueEvidence = z.infer<typeof fatigueEvidenceSchema>

export type ExperimentalFatigueComposite = {
  readonly score: number
  readonly label: "실험 기능 · 참고용"
  readonly observedAt: string
  readonly source: "SELF_REPORTED_SLIDERS"
  readonly uncertainty: "직접 고른 값만 평균해 불확실성이 커요. 안전 판정이나 의료 판단이 아니에요."
}

export function fatigueVector(candidate: unknown): FatigueVector {
  return fatigueVectorSchema.parse(candidate)
}

export function fatigueEvidence(candidate: unknown): FatigueEvidence {
  return fatigueEvidenceSchema.parse(candidate)
}

export function experimentalFatigueComposite(
  vector: FatigueVector,
  evidence: FatigueEvidence | null,
  optedIn: boolean,
): ExperimentalFatigueComposite | null {
  if (!optedIn || evidence === null) return null
  const values = [vector.neural, vector.metabolic, vector.muscular, vector.impact, vector.subjective]
  const score = Math.round(values.reduce((sum, value) => sum + value, 0) / values.length)
  return {
    score,
    label: "실험 기능 · 참고용",
    observedAt: evidence.observedAt,
    source: evidence.source,
    uncertainty: "직접 고른 값만 평균해 불확실성이 커요. 안전 판정이나 의료 판단이 아니에요.",
  }
}
