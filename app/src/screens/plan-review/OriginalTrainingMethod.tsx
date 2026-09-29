import type { OriginalPlanLookup } from "../../domain/plan-execution-review"
import { AdjustedPrescriptionV3 } from "../plan-beta/AdjustedPrescriptionV3"
import { AdjustedJournalOriginalPlan } from "../journal/AdjustedJournalOriginalPlan"
import { DetailedPrescriptionView } from "../plan-beta/DetailedPrescriptionView"
import { prescriptionLabel, sessionLabel } from "../plan-beta/labels"

export function OriginalTrainingMethod({ original }: { readonly original: OriginalPlanLookup }) {
  if (!("session" in original) || !original.session || original.sourceVerificationPending) return null
  return <section><h3>당시 계획한 훈련</h3>
    {original.kind === "matched" ? <><h4>{sessionLabel(original.session)}</h4>{original.session.prescription.kind === "PACE_TARGET"
      ? <DetailedPrescriptionView prescription={original.session.prescription} /> : <p>{prescriptionLabel(original.session)}</p>}</>
      : original.kind === "matched_adjusted" ? <AdjustedJournalOriginalPlan session={original.session} explanation={original.explanation} />
        : <AdjustedPrescriptionV3 session={original.session} explanation={original.explanation} />}
    <p>저장 당시의 계획이에요. 실제로 한 운동과 구분해서 봐 주세요.</p>
  </section>
}
