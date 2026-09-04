import type { PostSessionEntry } from "./journal-schema"
import type { PlannedSessionLink } from "./planned-session-link"

type PlannedOutcome = NonNullable<PostSessionEntry["activityOutcome"]>
type ActivitySlot = Exclude<NonNullable<PostSessionEntry["activitySlot"]>, "SINGLE">

/** A completed result follows the linked plan only when its AM/PM slot agrees too. */
export function derivePlanExecutionRelation(
  activityOutcome: PlannedOutcome,
  activitySlot: ActivitySlot | undefined,
  plannedSessionLink: PlannedSessionLink | undefined,
): "AS_PLANNED" | "MODIFIED" | "NOT_APPLICABLE" | "UNKNOWN" {
  if (plannedSessionLink === undefined) return "NOT_APPLICABLE"
  if (activityOutcome !== "COMPLETED") return "MODIFIED"
  if (activitySlot === "UNSPECIFIED" || activitySlot === undefined) return "UNKNOWN"
  return activitySlot === plannedSessionLink.sessionSlot ? "AS_PLANNED" : "MODIFIED"
}
