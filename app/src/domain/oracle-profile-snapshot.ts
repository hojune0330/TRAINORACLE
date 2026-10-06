import { z } from "zod"
import {
  ORACLE_AXES, ORACLE_CHARACTER_VERSION, ORACLE_QUESTION_VERSION, ORACLE_SCORE_VERSION,
  buildOracleProfile, oracleResponsesSchema, type OracleAxisId,
} from "./oracle-profile-v2"

const axisIds = ORACLE_AXES.map(axis => axis.id) as [OracleAxisId, ...OracleAxisId[]]
export const oracleProfileRevisionSchema = z.object({
  version: z.literal("ORACLE_PROFILE_REVISION_V2"),
  revision: z.number().int().positive(),
  answeredAt: z.iso.datetime(),
  questionVersion: z.literal(ORACLE_QUESTION_VERSION),
  scoreVersion: z.literal(ORACLE_SCORE_VERSION),
  characterVersion: z.literal(ORACLE_CHARACTER_VERSION),
  answers: oracleResponsesSchema,
  selectedCharacter: z.enum(axisIds).nullable(),
}).strict().superRefine((value, context) => {
  if (value.selectedCharacter !== null && !buildOracleProfile(value.answers).candidates.some(c => c.id === value.selectedCharacter)) {
    context.addIssue({ code: "custom", path: ["selectedCharacter"], message: "Character requires current response evidence" })
  }
})
export type OracleProfileRevision = z.infer<typeof oracleProfileRevisionSchema>

/** The caller owns account/CAS checks. This pure function is not an authorization gate. */
export function makeOracleProfileRevision(input: {
  revision: number; answeredAt: string; answers: unknown; selectedCharacter?: OracleAxisId | null
}): OracleProfileRevision {
  return oracleProfileRevisionSchema.parse({
    version: "ORACLE_PROFILE_REVISION_V2", revision: input.revision, answeredAt: input.answeredAt,
    questionVersion: ORACLE_QUESTION_VERSION, scoreVersion: ORACLE_SCORE_VERSION,
    characterVersion: ORACLE_CHARACTER_VERSION, answers: input.answers,
    selectedCharacter: input.selectedCharacter ?? null,
  })
}

export const oracleProfileReadingSchema = z.object({
  version: z.literal("ORACLE_PROFILE_READING_V2"),
  savedAt: z.iso.datetime(),
  source: oracleProfileRevisionSchema,
}).strict().refine(value => Date.parse(value.savedAt) >= Date.parse(value.source.answeredAt), {
  path: ["savedAt"], message: "Cannot save before the response revision exists",
})
export type OracleProfileReading = z.infer<typeof oracleProfileReadingSchema>

export function saveOracleProfileReading(revision: OracleProfileRevision, savedAt: string): OracleProfileReading {
  return oracleProfileReadingSchema.parse({ version: "ORACLE_PROFILE_READING_V2", savedAt, source: revision })
}

export type OracleProfileReadingAccess =
  | { state: "LOADING" | "FAILED" | "DELETED" }
  | { state: "READY"; currentRevision: number }

/** Unknown versions fail closed instead of being reinterpreted by the latest formula. */
export function readOracleProfileReading(input: unknown, access: OracleProfileReadingAccess) {
  if (access.state !== "READY") return { state: access.state, result: null } as const
  if (!Number.isSafeInteger(access.currentRevision) || access.currentRevision < 1) {
    return { state: "FAILED", result: null } as const
  }
  const parsed = oracleProfileReadingSchema.safeParse(input)
  if (!parsed.success) return { state: "UNSUPPORTED", result: null } as const
  const source = parsed.data.source
  if (source.revision > access.currentRevision) return { state: "FAILED", result: null } as const
  return {
    state: source.revision === access.currentRevision ? "CURRENT" : "HISTORICAL",
    result: buildOracleProfile(source.answers, source.selectedCharacter),
    sourceRevision: source.revision, answeredAt: source.answeredAt,
  } as const
}
