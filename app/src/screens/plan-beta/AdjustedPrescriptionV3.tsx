import type { AdjustedPlanCandidateV3 } from "../../domain/adjusted-plan-candidate"
import type { ReviewedAdjustedExplanationV3 } from "../../domain/adjusted-method-snapshot-v3"
import { PrescriptionStructureV3 } from "./PrescriptionStructureV3"
import { formatTrainingSeconds } from "./labels"
import type { SelectedMultiAdjustedPlanV3 } from "../../domain/selected-multi-adjusted-plan-v3"
import { WorkoutMemoTool } from "../../components/WorkoutMemoTool"
import type { WorkoutMemoContext } from "../../domain/workout-memo"

export function AdjustedPrescriptionV3({ session, explanation, date, memoState, presentation = "reader", primaryAction, hideDate = false }: {
  readonly session: AdjustedPlanCandidateV3["sessions"][number] | SelectedMultiAdjustedPlanV3["activePlan"]["sessions"][number]; readonly explanation?: ReviewedAdjustedExplanationV3;
  readonly showName?: boolean;
  readonly date?: string;
  readonly memoState?: WorkoutMemoContext["state"];
  readonly presentation?: "reader" | "comparison";
  readonly primaryAction?: import("react").ReactNode;
  readonly hideDate?: boolean;
}) {
  const p = session.prescription
  const memo = <WorkoutMemoTool session={session} date={date} state={memoState} mode={presentation} reviewedExplanation={explanation} primaryAction={primaryAction} hideDate={hideDate} />
  if (p.kind !== "ADJUSTED_METHOD_V3") return memo
  const execution = <>
    <PrescriptionStructureV3 sequence={p.projection.sequence}
      originalDurationMinutes={"originalPrescription" in p.projection && p.projection.originalPrescription.kind === "RPE_TIME_RANGE"
        ? p.projection.originalPrescription.durationMinutes : undefined} />
    {p.projection.segmentTargets.length > 0 && <><h4>저장 당시 기록으로 계산한 참고 시간</h4>
    <ul>{p.projection.segmentTargets.map(target => <li key={target.segmentId}>
      {target.distanceM !== null && target.targetRepSeconds !== null ? `${target.distanceM}m당 약 ${formatTrainingSeconds(target.targetRepSeconds)}`
        : target.fixedWorkSeconds !== null ? `${formatTrainingSeconds(target.fixedWorkSeconds)} 동안 · 1km당 약 ${formatTrainingSeconds(target.secondsPerKm)} 기준`
          : "거리·시간을 지정하지 않은 구간"}</li>)}</ul>
    <p>현재 몸 상태를 다시 판단한 값은 아니에요.</p></>}
  </>
  return <>
    {memo}
    <details><summary>원본 구간표</summary>{execution}</details>
  </>
}
