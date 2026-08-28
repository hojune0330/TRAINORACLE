import { z } from "zod"
import { canonicalJsonFingerprint } from "@impl/plan-generator/candidate-identity"
import type { PlanSession } from "@impl/plan-generator/types"
import type { PlanBetaState } from "./plan-beta-schema"
import { isValidIsoDate, isoShift } from "./dates"

const fingerprintSchema = z.string().regex(/^sha256:[a-f0-9]{64}$/u)

export type PlannedSessionLink = {
  readonly schemaVersion: 1
  readonly plannedSessionId: string
  readonly planVersionId: string
  readonly candidateFingerprint: string
  readonly sessionContentFingerprint: string
  readonly plannedDate: string
  readonly sessionDay: number
  readonly sessionSlot: "AM" | "PM"
  readonly plannedRole: "REST" | "EASY" | "QUALITY"
  readonly plannedEnergyIntent: PlanSession["plannedEnergyIntent"]
  readonly linkSource: "ATHLETE_SELECTED_FROM_PLAN"
  readonly linkedAt: string
}

const plannedSessionLinkShape = z.object({
  schemaVersion: z.literal(1),
  plannedSessionId: fingerprintSchema,
  planVersionId: fingerprintSchema,
  candidateFingerprint: fingerprintSchema,
  sessionContentFingerprint: fingerprintSchema,
  plannedDate: z.string().refine(isValidIsoDate),
  sessionDay: z.number().int().positive(),
  sessionSlot: z.enum(["AM", "PM"]),
  plannedRole: z.enum(["REST", "EASY", "QUALITY"]),
  plannedEnergyIntent: z.enum([
    "RECOVERY_INTENT",
    "BASE_INTENT",
    "LT_INTENT",
    "VO2_INTENT",
    "GLY_INTENT",
    "ATP_PC_INTENT",
    "MIXED_INTENT",
  ]),
  linkSource: z.literal("ATHLETE_SELECTED_FROM_PLAN"),
  linkedAt: z.string().datetime({ offset: true }),
})

export const plannedSessionLinkSchema: z.ZodType<PlannedSessionLink> = plannedSessionLinkShape
  .superRefine((link, context) => {
    const expectedId = plannedSessionId({
      planVersionId: link.planVersionId,
      candidateFingerprint: link.candidateFingerprint,
      sessionContentFingerprint: link.sessionContentFingerprint,
      plannedDate: link.plannedDate,
      sessionDay: link.sessionDay,
      sessionSlot: link.sessionSlot,
      plannedRole: link.plannedRole,
      plannedEnergyIntent: link.plannedEnergyIntent,
    })
    if (link.plannedSessionId !== expectedId) {
      context.addIssue({
        code: "custom",
        path: ["plannedSessionId"],
        message: "Planned session identity does not match its immutable projection.",
      })
    }
  })

export type PlannedSessionLogDraft = {
  readonly date: string
  readonly link: PlannedSessionLink
}

export function createPlannedSessionLogDraft(
  state: PlanBetaState,
  session: PlanSession,
  linkedAt: string,
): PlannedSessionLogDraft | null {
  const startDate = state.intake.startDate ?? state.generatedAt.slice(0, 10)
  if (!isValidIsoDate(startDate) || !Number.isFinite(Date.parse(linkedAt))) return null
  const storedSession = state.activePlan.sessions.filter(
    (candidate) => candidate.day === session.day && candidate.slot === session.slot,
  )
  if (storedSession.length !== 1 || canonicalJsonFingerprint(
    "trainoracle.planned-session-content.v1",
    storedSession[0],
  ) !== canonicalJsonFingerprint("trainoracle.planned-session-content.v1", session)) return null

  const candidateFingerprint = canonicalJsonFingerprint(
    "trainoracle.plan-candidate-reference.v1",
    state.activePlan.candidateId,
  )
  const planVersionId = canonicalJsonFingerprint("trainoracle.plan-version.v1", {
    candidateFingerprint,
    generatedAt: state.generatedAt,
    startDate,
  })
  const sessionContentFingerprint = canonicalJsonFingerprint(
    "trainoracle.planned-session-content.v1",
    session,
  )
  const plannedDate = isoShift(startDate, session.day - 1)
  const link: PlannedSessionLink = {
    schemaVersion: 1,
    plannedSessionId: plannedSessionId({
      planVersionId,
      candidateFingerprint,
      sessionContentFingerprint,
      plannedDate,
      sessionDay: session.day,
      sessionSlot: session.slot,
      plannedRole: session.role,
      plannedEnergyIntent: session.plannedEnergyIntent,
    }),
    planVersionId,
    candidateFingerprint,
    sessionContentFingerprint,
    plannedDate,
    sessionDay: session.day,
    sessionSlot: session.slot,
    plannedRole: session.role,
    plannedEnergyIntent: session.plannedEnergyIntent,
    linkSource: "ATHLETE_SELECTED_FROM_PLAN",
    linkedAt: new Date(linkedAt).toISOString(),
  }
  return plannedSessionLinkSchema.safeParse(link).success ? { date: plannedDate, link } : null
}

export function samePlannedSessionLink(
  left: PlannedSessionLink | undefined,
  right: PlannedSessionLink | undefined,
): boolean {
  if (left === undefined || right === undefined) return left === right
  return JSON.stringify(left) === JSON.stringify(right)
}

function plannedSessionId(input: {
  readonly planVersionId: string
  readonly candidateFingerprint: string
  readonly sessionContentFingerprint: string
  readonly plannedDate: string
  readonly sessionDay: number
  readonly sessionSlot: "AM" | "PM"
  readonly plannedRole: "REST" | "EASY" | "QUALITY"
  readonly plannedEnergyIntent: PlanSession["plannedEnergyIntent"]
}): string {
  return canonicalJsonFingerprint("trainoracle.planned-session.v1", input)
}
