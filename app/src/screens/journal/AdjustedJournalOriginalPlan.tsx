import type { AdjustedCandidateSession } from "../../domain/adjusted-plan-candidate"
import type { ResolvedAdjustedExplanation } from "../../domain/adjusted-method-snapshot"
import { PrescriptionStructure } from "../plan-beta/PrescriptionStructure"
import { formatTrainingSeconds } from "../plan-beta/labels"
import { WorkoutMemoTool } from "../../components/WorkoutMemoTool"

/** Historical comparison only: no apply/start controls or inferred actual values. */
export function AdjustedJournalOriginalPlan({ session, explanation, context = "journal", date, presentation = "reader", primaryAction }: {
  readonly session: AdjustedCandidateSession
  readonly explanation: ResolvedAdjustedExplanation
  readonly context?: "journal" | "plan" | "preview"
  readonly date?: string
  readonly presentation?: "reader" | "comparison"
  readonly primaryAction?: import("react").ReactNode
}) {
  const prescription = session.prescription
  const execution = prescription.kind === "ADJUSTED_METHOD" ? <>
    <PrescriptionStructure sequence={prescription.snapshot.projection.sequence} />
    {prescription.snapshot.projection.segmentTargets.length > 0 && <div>
      <h4>당시 기록으로 계산한 참고 시간</h4>
      <ul>{prescription.snapshot.projection.segmentTargets.map(target => <li key={target.segmentId}>
        {target.distanceM !== null && target.targetRepSeconds !== null
          ? `${target.distanceM}m당 약 ${formatTrainingSeconds(target.targetRepSeconds)}`
          : target.fixedWorkSeconds !== null
            ? `${formatTrainingSeconds(target.fixedWorkSeconds)} 동안 · 1km당 약 ${formatTrainingSeconds(target.secondsPerKm)} 기준`
            : "거리·시간을 정하지 않은 구간이에요."}
      </li>)}</ul>
      <p>현재 몸 상태에 맞는 속도를 새로 판정한 값은 아니에요.</p>
    </div>}
  </> : null
  return <section aria-label="당시 계획한 훈련">
    <WorkoutMemoTool session={session} date={date} mode={presentation} reviewedExplanation={explanation} primaryAction={primaryAction} state={context === "journal" ? "HISTORICAL" : context === "preview" ? "PREVIEW" : "PLAN"} />
    {prescription.kind === "ADJUSTED_METHOD" && <>
      <details><summary>원본 구간표</summary>{execution}</details>
    </>}
  </section>
}
