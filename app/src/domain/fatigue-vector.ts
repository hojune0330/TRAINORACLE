import { z } from "zod"

const fatigueVectorSchema = z.object({
  neural: z.number().min(0).max(10),
  metabolic: z.number().min(0).max(10),
  muscular: z.number().min(0).max(10),
  impact: z.number().min(0).max(10),
  subjective: z.number().min(0).max(10),
})

export type FatigueVector = z.infer<typeof fatigueVectorSchema>

export type ExperimentalFatigueComposite = {
  readonly score: number
  readonly label: "실험 기능 · 참고용"
  readonly uncertainty: "이 점수는 안전 판정이나 의료 판단이 아니에요."
}

export function fatigueVector(candidate: unknown): FatigueVector {
  return fatigueVectorSchema.parse(candidate)
}

export function experimentalFatigueComposite(
  vector: FatigueVector,
  optedIn: boolean,
): ExperimentalFatigueComposite | null {
  if (!optedIn) return null
  const values = [vector.neural, vector.metabolic, vector.muscular, vector.impact, vector.subjective]
  const score = Math.round(values.reduce((sum, value) => sum + value, 0) / values.length)
  return {
    score,
    label: "실험 기능 · 참고용",
    uncertainty: "이 점수는 안전 판정이나 의료 판단이 아니에요.",
  }
}
