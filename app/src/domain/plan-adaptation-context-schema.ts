import { z } from "zod"
import { planAdaptationCandidateSchema } from "./plan-beta-schema"

export const contextSchema = z.object({
  version: z.literal(1),
  activeCandidateId: z.string().min(1),
  candidates: z.tuple([planAdaptationCandidateSchema, planAdaptationCandidateSchema]),
}).strict().superRefine((context, refinement) => {
  if (!context.candidates.some(candidate => candidate.candidateId === context.activeCandidateId)) {
    refinement.addIssue({ code: "custom", path: ["activeCandidateId"],
      message: "Active candidate must reference one candidate in this context." })
  }
})
export type PlanAdaptationContext = z.infer<typeof contextSchema>
