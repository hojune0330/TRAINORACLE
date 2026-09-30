import { readJournalOriginalPlan } from "../../domain/journal-original-plan"
import type { PlannedSessionLink } from "../../domain/planned-session-link"
import { sessionWorkoutName, sessionWorkoutNotation } from "../../domain/workout-notation"
import "./planned-repetition-editor.css"

export function PlannedWorkoutContext({ entryId, date, link }: {
  readonly entryId: string; readonly date: string; readonly link: PlannedSessionLink
}) {
  const original = readJournalOriginalPlan({ id: entryId, date, plannedSessionLink: link })
  if (!("session" in original) || !original.session || original.sourceVerificationPending) {
    return <p className="planned-workout-context" role="status">원래 훈련 내용을 확인하지 못했어요. 실제로 한 운동만 기록해 주세요.</p>
  }
  return <section className="planned-workout-context" aria-label="기록할 훈련의 원래 계획">
    <strong>{sessionWorkoutName(original.session)}</strong>
    <p>{sessionWorkoutNotation(original.session)}</p>
  </section>
}
