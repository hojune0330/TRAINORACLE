import type { PrescriptionSequence, PrescriptionSequenceNode, SequenceRecovery } from "@impl/prescription/sequence"
import { deriveSequenceTotals } from "@impl/prescription/sequence"
import { secondsText } from "../../domain/session-explanation"

const MODES: Record<SequenceRecovery["mode"], string> = {
  WALK: "걷기", JOG: "가벼운 조깅", STAND: "서서 쉬기", WALK_OR_JOG: "걷기 또는 조깅",
  FULL_RECOVERY: "회복 상태에 맞춰 쉬기", COACH_DEFINED: "지도자가 정한 방식", NOT_APPLICABLE: "별도 회복 없음",
}

export function PrescriptionStructure({ sequence }: { readonly sequence: PrescriptionSequence }) {
  const totals = deriveSequenceTotals(sequence)
  return (
    <div className="prescription-structure">
      {([ ["준비", sequence.warmup], ["본운동", sequence.main], ["정리", sequence.cooldown] ] as const).map(([label, nodes]) => (
        nodes.length === 0 ? null : <div key={label}><h4>{label}</h4><SequenceNodes nodes={nodes} /></div>
      ))}
      <p className="session-explanation__note">
        본운동 거리: {totals.qualityDistanceM === null ? "거리 미지정" : `${totals.qualityDistanceM}m`}
        {" · "}본운동에 연결된 회복: {totals.plannedRecoverySeconds === null ? "시간 미지정" : secondsText(totals.plannedRecoverySeconds)}
      </p>
      {totals.mainSessionTotalExcludingWarmupCooldown === null && <p className="session-explanation__note">거리와 시간을 임의로 환산하지 않아 전체 수행시간은 확정하지 않아요. 준비·정리는 본운동 합계에 더하지 않았어요.</p>}
    </div>
  )
}

function SequenceNodes({ nodes }: { readonly nodes: readonly PrescriptionSequenceNode[] }) {
  return <ol className="prescription-structure__nodes">{nodes.map((node, index) => (
    <li key={node.id}>
      {node.kind === "group" ? <><strong>{node.label ?? "세트"} · {node.repeatCount}회</strong><SequenceNodes nodes={node.children} /></> : (
        <><strong>{node.label ?? "운동 구간"} · {node.repeatCount}회</strong><span>
          {node.work.kind === "distance" ? node.work.distanceM === null ? "거리 미지정" : `${node.work.distanceM}m`
            : node.work.durationSeconds === null ? "운동 구간 시간 미지정" : secondsText(node.work.durationSeconds)}
          {node.target.kind === "EFFORT_GUIDANCE" && node.target.cue !== null && ` · ${node.target.cue}`}
          {node.target.kind === "RACE_PACE" && node.target.eventDistanceM !== null && ` · ${node.target.eventDistanceM}m 기준 페이스`}
        </span></>
      )}
      {node.repeatCount > 1 && node.recoveryBetweenRepeats.mode !== "NOT_APPLICABLE" && <small>{node.kind === "group" ? "세트" : "반복"} 사이: <Recovery recovery={node.recoveryBetweenRepeats} /> · {node.repeatCount - 1}번</small>}
      {index < nodes.length - 1 && node.recoveryAfter.mode !== "NOT_APPLICABLE" && <small>다음 구간 전: <Recovery recovery={node.recoveryAfter} /></small>}
    </li>
  ))}</ol>
}

function Recovery({ recovery }: { readonly recovery: SequenceRecovery }) {
  return <>{recovery.seconds === null ? "시간 미지정" : secondsText(recovery.seconds)} {MODES[recovery.mode]}</>
}
