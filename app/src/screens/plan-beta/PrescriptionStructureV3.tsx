import type { PrescriptionSequenceV3, SequenceNodeV3, RecoveryStepV3 } from "@impl/prescription/sequence-v3"
import { deriveSequenceV3Totals } from "@impl/prescription/sequence-v3"
import { secondsText } from "../../domain/session-explanation"
import { formatTrainingSeconds } from "./labels"

const modes: Record<RecoveryStepV3["mode"], string> = { WALK: "걷기", JOG: "가벼운 조깅", STAND: "서서 쉬기",
  WALK_OR_JOG: "걷기 또는 조깅", WALK_OR_STAND: "걷기 또는 서서 쉬기", FULL_RECOVERY: "회복 상태에 맞춰 쉬기",
  COACH_DEFINED: "지도자가 정한 방식", ACTIVE_ROLL_ON: "속도를 낮춰 이어 달리기" }
const roles = { WORK: "운동 구간", BUILDUP: "속도를 올리는 구간", PREPARATION: "준비 구간" }
const durationText = (seconds: number) => Number.isInteger(seconds) ? formatTrainingSeconds(seconds) : secondsText(seconds)
const effortText = (cue: string) => cue === "PROGRESSIVE_NOT_ALL_OUT" ? "점차 속도를 올리되 전력질주는 하지 않아요." : cue
function Recovery({ steps }: { readonly steps: readonly RecoveryStepV3[] }) {
  return <ol>{steps.map((step, i) => <li key={i}>{modes[step.mode]} · {"distanceM" in step
    ? `${step.distanceM}m` : step.seconds === null ? "시간 미지정" : durationText(step.seconds)}</li>)}</ol>
}
function Nodes({ nodes, phase }: { readonly nodes: readonly SequenceNodeV3[]; readonly phase: string }) {
  return <ol className="prescription-structure__nodes">{nodes.map(node => <li key={node.id}>
    <strong>{node.label ?? (node.kind === "group" ? node.repeatUnit === "SET" ? "세트" : "반복 구성" : node.role === "PREPARATION" && phase === "정리" ? "정리 구간" : roles[node.role])} · {node.repeatCount}회</strong>
    {node.kind === "group" ? <Nodes nodes={node.children} phase={phase} /> : <p>
      {node.work.kind === "distance" ? node.work.distanceM === null ? "거리 미지정" : `${node.work.distanceM}m`
        : node.work.durationSeconds === null ? "운동 시간 미지정" : durationText(node.work.durationSeconds)}
      {node.target.kind === "RACE_PACE" && node.target.eventDistanceM !== null && ` · ${node.target.eventDistanceM}m 기준 페이스`}
      {node.target.kind === "RACE_PACE" && node.target.eventDistanceM === null && " · 기준 경기 거리 미지정"}
      {node.target.kind === "EFFORT_GUIDANCE" && node.target.cue !== null && ` · ${effortText(node.target.cue)}`}
      {node.target.kind === "EFFORT_GUIDANCE" && node.target.cue === null && " · 구체적인 강도 안내 미지정"}
      {node.target.kind === "SPRINT_REFERENCE" && (node.target.reference === null
        ? " · 단거리 수행 기준 미연결 · 목표 속도를 지정한 구간은 아니에요."
        : " · 단거리 수행 기준 연결됨 · 이 표기만으로 목표 속도가 정해지지는 않아요.")}
    </p>}
    {node.repeatCount > 1 && node.recoveryBetweenRepeats.length > 0 && <div>
      <span>{node.kind === "group" && node.repeatUnit === "SET" ? "세트" : "반복"} 사이마다 아래 순서로 회복 · {node.repeatCount - 1}번</span>
      <Recovery steps={node.recoveryBetweenRepeats} />
    </div>}
    {node.recoveryAfter.length > 0 && <div><span>위 구성을 모두 마친 뒤 한 번</span><Recovery steps={node.recoveryAfter} /></div>}
  </li>)}</ol>
}
export function PrescriptionStructureV3({ sequence, originalDurationMinutes }: {
  readonly sequence: PrescriptionSequenceV3;
  readonly originalDurationMinutes?: { readonly minimum: number; readonly maximum: number };
}) {
  const totals = deriveSequenceV3Totals(sequence)
  const phases = [totals.warmup, totals.main, totals.cooldown]
  const completeTime = phases.every(phase => phase.totalSeconds !== null)
  const totalSeconds = completeTime ? phases.reduce((sum, phase) => sum + phase.totalSeconds!, 0) : null
  return <div className="prescription-structure">
    <p aria-label="계획된 전체 시간">{totalSeconds === null
      ? "전체 시간 미산출 · 시간이 정해지지 않은 구간이 있어요."
      : `계획된 전체 시간 ${Number.isInteger(totalSeconds) ? "" : "약 "}${formatTrainingSeconds(totalSeconds)} · 준비·회복·정리 포함`}</p>
    {originalDurationMinutes && <p aria-label="변경 전 시간과 비교">
      처음 예상한 시간 {originalDurationMinutes.minimum}~{originalDurationMinutes.maximum}분.
      {totalSeconds === null ? " 현재 구성의 전체 시간이 미산출이라 시간 차이는 아직 비교할 수 없어요."
        : totalSeconds > originalDurationMinutes.maximum * 60 ? ` 현재 구성은 처음 예상한 최대 시간보다 약 ${formatTrainingSeconds(totalSeconds - originalDurationMinutes.maximum * 60)} 길어요.`
          : totalSeconds < originalDurationMinutes.minimum * 60 ? ` 현재 구성은 처음 예상한 최소 시간보다 약 ${formatTrainingSeconds(originalDurationMinutes.minimum * 60 - totalSeconds)} 짧아요.`
            : " 현재 구성은 처음 예상한 시간 범위 안에 있어요."}
      {" 시간만 비교한 안내이며 훈련 강도나 효과가 같다는 뜻은 아니에요."}
    </p>}
    {([
    ["준비", sequence.warmup], ["본운동", sequence.main], ["정리", sequence.cooldown],
  ] as const).map(([label, nodes]) => nodes.length ? <section key={label} aria-label={label}><h4>{label}</h4><Nodes nodes={nodes} phase={label} /></section> : null)}</div>
}
