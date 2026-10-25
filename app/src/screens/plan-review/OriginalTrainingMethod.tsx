import type { OriginalPlanLookup } from "../../domain/plan-execution-review"
import { AdjustedPrescriptionV3 } from "../plan-beta/AdjustedPrescriptionV3"
import { AdjustedJournalOriginalPlan } from "../journal/AdjustedJournalOriginalPlan"
import { WorkoutMemoTool } from "../../components/WorkoutMemoTool"

export function OriginalTrainingMethod({ original, date }: { readonly original: OriginalPlanLookup; readonly date?: string }) {
  if (!("session" in original) || !original.session || original.sourceVerificationPending) return null
  return <section><h3>당시 계획한 훈련</h3>
    {original.kind === "matched" ? <WorkoutMemoTool session={original.session} date={date} state="HISTORICAL" mode="comparison" />
      : original.kind === "matched_adjusted" ? <AdjustedJournalOriginalPlan session={original.session} date={date} explanation={original.explanation} presentation="comparison" />
        : <AdjustedPrescriptionV3 session={original.session} date={date} memoState="HISTORICAL" explanation={original.explanation} presentation="comparison" />}
    <p>저장 당시의 계획이에요. 실제로 한 운동과 구분해서 봐 주세요.</p>
  </section>
}
