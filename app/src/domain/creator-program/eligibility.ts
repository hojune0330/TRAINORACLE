import type { InstantPlanEntry } from "../instant-plan-contract"
import {
  creatorCopyProvenanceSchema,
  creatorProgramVersionSchema,
  type CreatorProgramIdentity,
  type CreatorProgramVersion,
} from "./schema"

export type CreatorProgramEvaluation =
  | { readonly kind: "INVALID_PROGRAM" }
  | {
    readonly kind: "ELIGIBLE" | "NEEDS_INPUT" | "VERSION_MISMATCH" | "WITHDRAWN" | "RECALLED"
      | "NOT_REVIEWED" | "GRANT_REQUIRED" | "UNSUPPORTED_ENTRY" | "UNSUPPORTED_EVENT"
    readonly program: CreatorProgramVersion
  }

/** Metadata/rights gate only. ELIGIBLE never authorizes a prescription or save. */
export function evaluateCreatorProgram(
  input: unknown,
  entry?: InstantPlanEntry,
  expectedIdentity?: CreatorProgramIdentity,
): CreatorProgramEvaluation {
  const parsed = creatorProgramVersionSchema.safeParse(input)
  if (!parsed.success) return { kind: "INVALID_PROGRAM" }
  const program = parsed.data
  const result = (kind: Exclude<CreatorProgramEvaluation["kind"], "INVALID_PROGRAM">): CreatorProgramEvaluation =>
    ({ kind, program })
  if (expectedIdentity && (program.programId !== expectedIdentity.programId || program.version !== expectedIdentity.version)) {
    return result("VERSION_MISMATCH")
  }
  if (program.lifecycle.status === "RECALLED") return result("RECALLED")
  if (program.lifecycle.status === "WITHDRAWN" || program.grant?.status === "WITHDRAWN") return result("WITHDRAWN")
  if (!program.grant || !program.grant.publicListing || !program.grant.personalUse) return result("GRANT_REQUIRED")
  if (!program.review || program.review.status !== "REVIEWED") return result("NOT_REVIEWED")
  if (!entry) return result("NEEDS_INPUT")
  if (entry.eventDistanceM !== program.eventDistanceM) return result("UNSUPPORTED_EVENT")
  if (!program.applicability.some(applicability => applicability.kind === entry.kind)) return result("UNSUPPORTED_ENTRY")
  return result("ELIGIBLE")
}

export type ExistingCreatorCopyEvaluation = {
  readonly kind: "KEEP_EXISTING" | "HIDE_FUTURE_CONTENT" | "PAUSE_FOR_REVIEW" | "SOURCE_UNAVAILABLE" | "IDENTITY_MISMATCH"
  readonly preservePerformedHistory: true
  readonly reason: "ACTIVE" | "WITHDRAWN" | "RECALLED" | "SOURCE_UNAVAILABLE" | "IDENTITY_MISMATCH" | "GRANT_CHANGED" | "NOT_REVIEWED"
}

/** Does not mutate the personal copy or erase past training; caller owns lifecycle actions. */
export function evaluateExistingCreatorCopy(input: unknown, provenance: unknown): ExistingCreatorCopyEvaluation {
  const parsed = creatorProgramVersionSchema.safeParse(input)
  const copied = creatorCopyProvenanceSchema.safeParse(provenance)
  const result = (
    kind: ExistingCreatorCopyEvaluation["kind"],
    reason: ExistingCreatorCopyEvaluation["reason"],
  ): ExistingCreatorCopyEvaluation => ({ kind, preservePerformedHistory: true, reason })
  if (!parsed.success || !copied.success) return result("SOURCE_UNAVAILABLE", "SOURCE_UNAVAILABLE")
  const program = parsed.data
  const copy = copied.data
  if (program.programId !== copy.programId || program.version !== copy.version) {
    return result("IDENTITY_MISMATCH", "IDENTITY_MISMATCH")
  }
  if (program.lifecycle.status === "RECALLED") return result("PAUSE_FOR_REVIEW", "RECALLED")
  if (!program.grant || program.grant.grantId !== copy.grantId) return result("PAUSE_FOR_REVIEW", "GRANT_CHANGED")
  if (program.lifecycle.status === "WITHDRAWN" || program.grant.status === "WITHDRAWN") {
    return result(copy.existingCopyPolicy === "RETAIN_PERSONAL_COPY" ? "KEEP_EXISTING" : "HIDE_FUTURE_CONTENT", "WITHDRAWN")
  }
  if (!program.grant.personalUse) return result("PAUSE_FOR_REVIEW", "GRANT_CHANGED")
  if (program.review?.status !== "REVIEWED") return result("PAUSE_FOR_REVIEW", "NOT_REVIEWED")
  return result("KEEP_EXISTING", "ACTIVE")
}
