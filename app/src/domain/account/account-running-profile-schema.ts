import { z } from "zod"
import { RUNNING_PROFILE_VERSION, runningProfileAnswersSchema } from "../running-profile"

export const RUNNING_PROFILE_NAMESPACE = "trainoracle.account.running-profile.v1"
export const accountRunningProfileDocumentSchema = z.object({
  version: z.literal(3), state: z.literal("ACCOUNT_STATE"), kind: z.literal("RUNNING_PROFILE"),
  data: z.object({ version: z.literal(RUNNING_PROFILE_VERSION), answeredAt: z.iso.datetime(), answers: runningProfileAnswersSchema }).strict(),
}).strict()
export type AccountRunningProfileDocument = z.infer<typeof accountRunningProfileDocumentSchema>
export function validateAccountRunningProfileDocument(value: unknown) {
  return accountRunningProfileDocumentSchema.safeParse(value).success
}
