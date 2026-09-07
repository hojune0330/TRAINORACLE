import type { AdjustedCandidateSession } from "../../domain/adjusted-plan-candidate"
import type { ResolvedAdjustedExplanation } from "../../domain/adjusted-method-snapshot"
import { PrescriptionStructure } from "../plan-beta/PrescriptionStructure"
import { DetailedPrescriptionView } from "../plan-beta/DetailedPrescriptionView"
import { formatTrainingSeconds } from "../plan-beta/labels"

/** Historical comparison only: no apply/start controls or inferred actual values. */
export function AdjustedJournalOriginalPlan({ session, explanation, context = "journal" }: {
  readonly session: AdjustedCandidateSession
  readonly explanation: ResolvedAdjustedExplanation
  readonly context?: "journal" | "plan"
}) {
  const prescription = session.prescription
  return <section aria-label="당시 계획한 훈련">
    <p>{context === "journal" ? "이 일지에 연결된 당시 계획이에요. 실제 운동 기록과는 별도로 표시해요."
      : "저장할 때 선택한 훈련 구성이에요. 실제 수행 기록과는 별도로 표시해요."}</p>
    {prescription.kind === "ADJUSTED_METHOD" ? <>
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
      <details><summary>이렇게 구성한 이유</summary>
        <dl>{([
          ["훈련 목적", explanation.purpose], ["에너지 공급", explanation.energySupply],
          ["운동 구성", explanation.workRationale], ["회복 구성", explanation.recoveryRationale],
          ["주기 안에서의 역할", explanation.cycleRole], ["기대하는 변화", explanation.expectedAdaptation],
          ["한계", explanation.limitations], ["기록에서 확인할 점", explanation.observation],
        ] as const).map(([label, text]) => <div key={label}><dt>{label}</dt><dd>{text}</dd></div>)}</dl>
      </details>
    </> : prescription.kind === "PACE_TARGET" ? <DetailedPrescriptionView prescription={prescription} />
      : prescription.kind === "REST" ? <p>운동을 쉬는 날로 계획했어요.</p>
        : <p>예정 시간 {prescription.durationMinutes.minimum}~{prescription.durationMinutes.maximum}분 · RPE {prescription.rpe.minimum}~{prescription.rpe.maximum}</p>}
  </section>
}
