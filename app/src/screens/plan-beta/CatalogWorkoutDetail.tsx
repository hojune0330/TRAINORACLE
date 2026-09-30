import { ALL_WORKOUT_CATALOG, calculatedWorkoutSequence, type CalculatedWorkout } from "@impl/prescription/all-workout-calculator"
import { PrescriptionStructureV3 } from "./PrescriptionStructureV3"
import { notationNumber, notationTime, notationDistance } from "../../domain/workout-notation"
import { formatTrainingSeconds } from "./labels"
import type { PlannedEnergyIntent } from "@impl/plan-generator/types"

const intents: Record<string, PlannedEnergyIntent> = { BASE: "BASE_INTENT", LT: "LT_INTENT", VO2: "VO2_INTENT", GLY: "GLY_INTENT",
  "ATP-PC": "ATP_PC_INTENT", MIX: "MIXED_INTENT", REC: "RECOVERY_INTENT" }

export function CatalogWorkoutDetail({ workout, evidence = false }: { readonly workout: CalculatedWorkout; readonly evidence?: boolean }) {
  const entry = ALL_WORKOUT_CATALOG.find(e => e.id === workout.catalogId)!
  const sequence = calculatedWorkoutSequence(workout)
  if (evidence) return <div className="session-explanation__sequence">
    {([
      ["훈련 목적", entry.explanation.purpose], ["에너지 공급", entry.explanation.energySupply],
      ["이렇게 나눈 이유", entry.explanation.work], ["회복을 둔 이유", entry.explanation.recovery],
      ["기대할 점", entry.explanation.expected], ["부담", entry.explanation.tradeoff],
      ["일지에서 확인할 것", entry.explanation.observation],
    ] as const).map(([label, text]) => <section key={label}><h3>{label}</h3><p>{text}</p></section>)}
    <section><h3>적용의 한계</h3><ul>{entry.explanation.limitations.map(text => <li key={text}>{text}</li>)}</ul></section>
    <details><summary>사용한 기록과 출처</summary>
      {workout.unresolved.includes("RECORD_NOT_CURRENT") && <p>오래된 경기 기록은 이번 참고 페이스 계산에 사용하지 않았어요.</p>}
      <p>{workout.steps.some(s => s.referenceRecordId) ? "직접 고른 5km 기록을 해당 구간의 참고 페이스 계산에 사용했어요. 다른 구간이나 회복 시간을 기록에 맞춰 자동으로 늘리지는 않았어요." : "선택한 목적·경험 수준과 훈련 구성을 사용했어요. 개인 경기 기록으로 페이스를 계산하지는 않았어요."}</p>
      <p>연구·코칭 자료를 바탕으로 구성한 훈련안이에요. 자료에 이 숫자의 훈련이 그대로 실렸다는 뜻은 아니에요.</p>
      <ul>{entry.sourceRefs.filter(ref => ref.startsWith("https://")).map((ref, index) => <li key={ref}><a href={ref} target="_blank" rel="noreferrer">근거 자료 {index + 1}</a></li>)}</ul>
    </details>
  </div>
  const targets = workout.steps.filter(s => s.phase === "main" && s.kind !== "RECOVERY")
    .filter((s, i, all) => all.findIndex(other => other.segmentId === s.segmentId) === i)
  const timedDistanceRecoveries = workout.steps.filter(s => s.kind === "RECOVERY" && s.distanceM !== null && s.seconds !== null)
    .filter((s, i, all) => all.findIndex(other => other.segmentId === s.segmentId) === i)
  return <div>
    <p>{workout.totals.workOccurrences}개 운동 구간{workout.totals.mainDistanceM !== null ? ` · 본운동 ${notationDistance(workout.totals.mainDistanceM)}` : ""}</p>
    {sequence && <PrescriptionStructureV3 sequence={sequence} intent={intents[entry.family]} compact collapseSupport hideTotals />}
    <dl>{targets.map(s => <div key={s.segmentId}>
      <dt>{s.distanceM !== null ? notationDistance(s.distanceM) : s.seconds ? notationTime(s.seconds.minimum) : "운동 구간"}</dt>
      <dd>{s.distanceM !== null && s.seconds ? `${notationNumber(s.seconds.minimum)}${s.seconds.minimum === s.seconds.maximum ? "" : `~${notationNumber(s.seconds.maximum)}`}초 · ` : ""}{s.instruction}</dd>
    </div>)}</dl>
    {timedDistanceRecoveries.length > 0 && <dl>{timedDistanceRecoveries.map(s => <div key={s.segmentId}>
      <dt>거리 회복 · {notationDistance(s.distanceM!)}</dt><dd>{s.instruction}</dd>
    </div>)}</dl>}
    <p>{workout.totals.seconds ? `준비·회복·정리 포함 약 ${formatTrainingSeconds(workout.totals.seconds.minimum)}${workout.totals.seconds.minimum === workout.totals.seconds.maximum ? "" : `~${formatTrainingSeconds(workout.totals.seconds.maximum)}`}` : "구간 시간을 정하면 총시간을 보여드려요."}</p>
  </div>
}
