import type { PlanContinuityInput, PlanProgressState } from "@impl/plan-generator/types"
import { canonicalJsonFingerprint } from "@impl/plan-generator/candidate-identity"
import { readStoredAdjustedPlanState, RETAINED_ADJUSTED_PLAN_EVIDENCE } from "./adjusted-plan-storage-schema"
import type { RetainedAdjustedPlanEvidence } from "./selected-adjusted-plan-content"
import { evaluatePlanSafety, type PlanCurrentCheck } from "./plan-beta-flow"
import { advancePeriodizationContext } from "./periodization-lineage"
import { isoShift, isValidIsoDate } from "./dates"
import { todayISO } from "./journal-store"
import { hasCanonicalJsonTree } from "./plan-beta-schema"

const rejected = (code: string) => ({ kind: "rejected" as const, code })
const states: readonly PlanProgressState[] = ["COMPLETED", "RESTED", "SKIPPED", "PAIN_CHECKIN"]

/** Read-only preparation. Re-run under the eventual successor mutation lock;
 * this fingerprint binds context, not permission to write or change workload. */
export function prepareAdjustedNextFrame(input: {
  readonly previous: unknown
  readonly expectedFingerprint: string
  readonly nextStartDate: string
  readonly currentCheck: PlanCurrentCheck
}, retained: readonly RetainedAdjustedPlanEvidence[] = RETAINED_ADJUSTED_PLAN_EVIDENCE,
evaluatedAt = new Date()) {
  try {
    if (!hasCanonicalJsonTree(input) || Reflect.ownKeys(input).length !== 4
      || !Reflect.ownKeys(input).every(key => typeof key === "string"
        && ["previous", "expectedFingerprint", "nextStartDate", "currentCheck"].includes(key))) return rejected("INVALID_CONTINUITY_INPUT")
    const read = readStoredAdjustedPlanState(input.previous, retained, evaluatedAt)
    if (read.kind !== "loaded") return rejected("INVALID_STORED_PLAN")
    const previous = read.state
    if (previous.contentFingerprint !== input.expectedFingerprint) return rejected("STALE_BASE")
    const localDate = todayISO(evaluatedAt)
    if (!isValidIsoDate(input.nextStartDate) || input.nextStartDate < localDate) return rejected("INVALID_NEXT_START_DATE")
    const safety = evaluatePlanSafety(input.currentCheck, evaluatedAt)
    if (safety.kind !== "passed") return rejected(safety.code)
    if (previous.progress.some(item => item.state === "PAIN_CHECKIN")) return rejected("ACTIVE_HOLD")
    const plan = previous.selection
    const start = plan.intake.startDate
    if (start === undefined || localDate < start) return rejected("FRAME_NOT_STARTED")
    const frame = plan.activePlan.frame
    const visibleDays = Math.ceil("projectionLengthDays" in frame
      ? (frame.projectionLengthDays ?? frame.lengthDays) : frame.lengthDays)
    const visible = plan.activePlan.sessions.filter(session => session.day <= visibleDays)
    if (visible.length === 0) return rejected("INVALID_STORED_PLAN")
    const required = visible.filter(session => session.role !== "REST")
    const visibleProgress = previous.progress.filter(item => visible.some(session =>
      session.day === item.sessionDay && session.slot === item.sessionSlot))
    const missing = required.filter(session => !visibleProgress.some(item =>
      item.sessionDay === session.day && item.sessionSlot === session.slot))
    const lastDate = isoShift(start, Math.max(...visible.map(session => session.day)) - 1)
    if (missing.length > 0 && localDate <= lastDate) return rejected("INCOMPLETE_FRAME")
    const periodization = advancePeriodizationContext(plan.periodization, evaluatedAt.toISOString())
    if (periodization === null) return rejected("INVALID_PERIODIZATION")
    const continuity: PlanContinuityInput = {
      previousCandidateKind: plan.activePlan.candidateKind,
      progressStateCounts: states.map(state => ({ state, count: visibleProgress.filter(item => item.state === state).length })),
    }
    const content = {
      kind: "ADJUSTED_NEXT_FRAME_CONTEXT" as const,
      predecessorFingerprint: previous.contentFingerprint,
      predecessorSelectionFingerprint: plan.contentFingerprint,
      preparedAt: evaluatedAt.toISOString(), nextStartDate: input.nextStartDate,
      completionBasis: missing.length === 0 ? "EXPLICIT_OUTCOMES" as const : "DISPLAYED_FRAME_ELAPSED" as const,
      missingRequiredOutcomes: missing.length, continuity, periodization,
      executionAuthority: "NONE" as const, storageState: "NOT_SAVED" as const,
    }
    return { kind: "prepared" as const, context: Object.freeze({ ...content,
      contentFingerprint: canonicalJsonFingerprint("trainoracle.adjusted-next-frame-context.v1", content) }) }
  } catch { return rejected("INVALID_CONTINUITY_INPUT") }
}
