import type { PlanMethodObservation } from "../../domain/plan-method-observations"
import { formatTrainingSeconds } from "./labels"

export function PlanMethodObservationDetails({ observation, comparison }: { readonly observation: PlanMethodObservation; readonly comparison?: string }) {
  if (observation.status === "MISSING") return <p>이 훈련과 연결된 일지가 아직 없어요. 미기록을 0이나 훈련 실패로 계산하지 않아요.</p>
  if (observation.status === "CONFLICTING") return <p>같은 훈련에 서로 다른 일지가 연결되어 있어요. 일지를 확인하기 전에는 실제 수치를 하나로 정하지 않아요.</p>
  const { actual } = observation
  const result = observation.results[0]
  return <div>
    <p>{observation.occurrence.plannedDate} · {observation.occurrence.sessionSlot === "AM" ? "오전" : "오후"}</p>
    {result?.outcome === "PARTIAL" && <p>계획의 일부를 수행한 기록</p>}
    {result?.relation === "MODIFIED" && <p>계획을 바꿔 수행한 기록</p>}
    {result?.outcome === "RESTED" && <p>휴식으로 기록했어요.</p>}
    {result?.outcome === "SKIPPED" && <p>건너뛴 훈련으로 기록했어요.</p>}
    {observation.status === "DUPLICATE" && <p>같은 일지가 중복되어 한 번만 집계했어요.</p>}
    <dl>
      <dt>직접 기록한 거리</dt><dd>{actual.distanceKm === null ? "미기록" : `${actual.distanceKm}km`}</dd>
      <dt>직접 기록한 시간</dt><dd>{actual.durationMin === null ? "미기록" : `${actual.durationMin}분`}</dd>
      <dt>직접 기록한 페이스</dt><dd>{actual.secondsPerKm === null ? "미기록" : `${formatTrainingSeconds(actual.secondsPerKm)}/km`}</dd>
      <dt>체감 강도</dt><dd>{actual.rpe === null ? "비교할 수 있는 RPE 미기록" : `직접 기록한 RPE ${actual.rpe}`}</dd>
    </dl>
    {comparison !== undefined && <p>{comparison}</p>}
    <p>반복별 기록과 회복 구간은 확인하지 않았어요. 완료 표시만으로 계획의 방법·수치를 그대로 수행했다고 판단하지 않아요.</p>
  </div>
}
