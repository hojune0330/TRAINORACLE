import type { AdjustedPlanCandidateV3 } from "../../domain/adjusted-plan-candidate"
import type { ReviewedAdjustedExplanationV3 } from "../../domain/adjusted-method-snapshot-v3"
import { PrescriptionStructureV3 } from "./PrescriptionStructureV3"
import { DetailedPrescriptionView } from "./DetailedPrescriptionView"
import { formatTrainingSeconds } from "./labels"
import type { SelectedMultiAdjustedPlanV3 } from "../../domain/selected-multi-adjusted-plan-v3"

export function AdjustedPrescriptionV3({ session, explanation }: {
  readonly session: AdjustedPlanCandidateV3["sessions"][number] | SelectedMultiAdjustedPlanV3["activePlan"]["sessions"][number]; readonly explanation?: ReviewedAdjustedExplanationV3;
}) {
  const p = session.prescription
  if (p.kind === "PACE_TARGET") return <DetailedPrescriptionView prescription={p} />
  if (p.kind === "REST") return <p>운동을 쉬는 날이에요.</p>
  if (p.kind !== "ADJUSTED_METHOD_V3") return <p>{p.durationMinutes.minimum}~{p.durationMinutes.maximum}분 · RPE {p.rpe.minimum}~{p.rpe.maximum}</p>
  return <>
    <PrescriptionStructureV3 sequence={p.projection.sequence} />
    {p.projection.segmentTargets.length > 0 && <><h4>저장 당시 기록으로 계산한 참고 시간</h4>
    <ul>{p.projection.segmentTargets.map(target => <li key={target.segmentId}>
      {target.distanceM !== null && target.targetRepSeconds !== null ? `${target.distanceM}m당 약 ${formatTrainingSeconds(target.targetRepSeconds)}`
        : target.fixedWorkSeconds !== null ? `${formatTrainingSeconds(target.fixedWorkSeconds)} 동안 · 1km당 약 ${formatTrainingSeconds(target.secondsPerKm)} 기준`
          : "거리·시간을 지정하지 않은 구간"}</li>)}</ul>
    <p>현재 몸 상태를 다시 판단한 값은 아니에요.</p></>}
    {explanation ? <details><summary>이 훈련을 하는 이유</summary><dl>{([
      ["목적", explanation.purpose], ["에너지 공급", explanation.energySupply], ["운동 구성", explanation.workRationale],
      ["회복 구성", explanation.recoveryRationale], ["주기 역할", explanation.cycleRole], ["기대하는 변화", explanation.expectedAdaptation],
      ["한계", explanation.limitations], ["기록에서 확인할 점", explanation.observation],
    ] as const).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></details>
      : <p>저장된 훈련 방법은 확인할 수 있지만, 연결된 설명을 읽지 못했어요.</p>}
  </>
}
