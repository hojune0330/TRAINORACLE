import type { PrescriptionSequenceV3, SequenceNodeV3, RecoveryStepV3 } from "@impl/prescription/sequence-v3"
import { secondsText } from "../../domain/session-explanation"

const modes: Record<RecoveryStepV3["mode"], string> = { WALK: "걷기", JOG: "가벼운 조깅", STAND: "서서 쉬기",
  WALK_OR_JOG: "걷기 또는 조깅", WALK_OR_STAND: "걷기 또는 서서 쉬기", FULL_RECOVERY: "회복 상태에 맞춰 쉬기",
  COACH_DEFINED: "지도자가 정한 방식", ACTIVE_ROLL_ON: "속도를 낮춰 이어 달리기" }
const roles = { WORK: "운동 구간", BUILDUP: "속도를 올리는 구간", PREPARATION: "준비 구간" }
function Recovery({ steps }: { readonly steps: readonly RecoveryStepV3[] }) {
  return <ol>{steps.map((step, i) => <li key={i}>{modes[step.mode]} · {"distanceM" in step
    ? `${step.distanceM}m` : step.seconds === null ? "시간 미지정" : secondsText(step.seconds)}</li>)}</ol>
}
function Nodes({ nodes }: { readonly nodes: readonly SequenceNodeV3[] }) {
  return <ol className="prescription-structure__nodes">{nodes.map(node => <li key={node.id}>
    <strong>{node.label ?? (node.kind === "group" ? node.repeatUnit === "SET" ? "세트" : "반복 구성" : roles[node.role])} · {node.repeatCount}회</strong>
    {node.kind === "group" ? <Nodes nodes={node.children} /> : <p>
      {node.work.kind === "distance" ? node.work.distanceM === null ? "거리 미지정" : `${node.work.distanceM}m`
        : node.work.durationSeconds === null ? "운동 시간 미지정" : secondsText(node.work.durationSeconds)}
      {node.target.kind === "RACE_PACE" && node.target.eventDistanceM !== null && ` · ${node.target.eventDistanceM}m 기준 페이스`}
      {node.target.kind === "EFFORT_GUIDANCE" && node.target.cue !== null && ` · ${node.target.cue}`}
    </p>}
    {node.repeatCount > 1 && node.recoveryBetweenRepeats.length > 0 && <div>
      <span>{node.kind === "group" && node.repeatUnit === "SET" ? "세트" : "반복"} 사이마다 아래 순서로 회복 · {node.repeatCount - 1}번</span>
      <Recovery steps={node.recoveryBetweenRepeats} />
    </div>}
    {node.recoveryAfter.length > 0 && <div><span>위 구성을 모두 마친 뒤 한 번</span><Recovery steps={node.recoveryAfter} /></div>}
  </li>)}</ol>
}
export function PrescriptionStructureV3({ sequence }: { readonly sequence: PrescriptionSequenceV3 }) {
  return <div className="prescription-structure">{([
    ["준비", sequence.warmup], ["본운동", sequence.main], ["정리", sequence.cooldown],
  ] as const).map(([label, nodes]) => nodes.length ? <section key={label} aria-label={label}><h4>{label}</h4><Nodes nodes={nodes} /></section> : null)}</div>
}
