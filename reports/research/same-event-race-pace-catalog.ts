import { canonicalJsonFingerprint } from "../../impl/src/plan-generator/candidate-identity"
import type { WorkoutCatalogEntry } from "../../impl/src/prescription/all-workout-calculator"
import type { SequenceNodeV3 } from "../../impl/src/prescription/sequence-v3"

const events = [[10000, "10km"], [21097.5, "하프"], [42195, "마라톤"]] as const
const structures = [
  ["P-INTRO-LT-S", "INTRO", "2 × 4min"],
  ["P-LT-S", "TIMED", "3 × 7min"],
  ["X-LT-01", "DISTANCE", "5 × 1km"],
] as const
const reviewRef = "specs/reconstruct/SAME_EVENT_RACE_PACE_BINDING_CONTRACT.md"

/** Reuse exact adopted work/recovery structures; never infer LT from race duration. */
export function buildSameEventRacePaceCatalog(sources: readonly WorkoutCatalogEntry[]): WorkoutCatalogEntry[] {
  return events.flatMap(([eventDistanceM, label]) => structures.map(([sourceId, format, notation]) => {
    const source = sources.find(entry => entry.id === sourceId)
    if (!source?.sequence) throw Error(`RACE_PACE_SOURCE_MISSING:${sourceId}`)
    const id = `RP-${eventDistanceM === 21097.5 ? "HALF" : eventDistanceM}-${format}`
    const mapMain = (nodes: readonly SequenceNodeV3[]): readonly SequenceNodeV3[] => nodes.map(node =>
      node.kind === "group" ? { ...node, children: mapMain(node.children) } : {
        ...node, target: { kind: "EFFORT_GUIDANCE", cue: `${label} 경기 평균 페이스 연습. 힘들면 낮추거나 중단하며 체감 강도는 따로 기록해요.` },
      })
    const row = {
      id, name: `${label} 페이스 연습 · ${notation}`, family: "MIX", methodGroup: `MIX:RACE_PACE:${format}`,
      sourceFingerprint: source.fingerprint,
      sequence: { ...source.sequence, id, main: mapMain(source.sequence.main) },
      segments: source.segments.map(segment => ({ ...segment, intent: "RACE_PACE", referenceEventDistanceM: eventDistanceM })),
      eventDistances: [eventDistanceM], experience: [...source.experience], requirements: [...source.requirements], hold: null,
      explanation: {
        purpose: `${label}에서 사용할 평균 속도를 구간별로 고르게 맞추는 연습이에요. 별도의 역치 측정이나 경기력 검사가 아니에요.`,
        energySupply: "산화 대사와 해당과정 등은 함께 작동해요. 경기 평균 페이스만으로 개인의 역치나 에너지 기여율을 알 수 없어요.",
        work: `${notation} 구성은 기존 ${sourceId}의 운동 길이와 반복 수를 그대로 사용해요. 달리는 속도만 같은 종목의 선택한 기록에서 계산해요. 시간형은 시간이 끝나면 구간을 마쳐요.`,
        recovery: "기존 구성의 반복 사이 60초 조깅을 유지해요. 다음 구간을 준비하는 구분이며 완전 회복을 보장하지 않아요. 기록이 빨라져도 회복을 줄이지 않아요.",
        tradeoff: "익숙한 경기 속도를 확인하기 쉽지만, 이 구성을 했다는 사실만으로 해당 경기 거리를 완주하거나 목표를 달성할 수 있다고 판단할 수 없어요.",
        expected: "정해진 구간에서 목표 속도를 고르게 유지하는 연습이 목적이에요. 역치 향상이나 특정 기록 단축을 보장하지 않아요.",
        limitations: ["실제 기록과 목표기록은 구분해요. 목표는 현재 능력을 뜻하지 않아요.", "RPE 안내는 경기 기록에서 측정한 값이 아니에요. 실제 체감 강도와 수행 결과를 별도로 남겨요.", "다른 종목 예상 기록, 언덕, 가속 구간에는 이 환산을 적용하지 않아요."],
        observation: "당시 목표 페이스, 실제 구간 시간, 반복·회복의 변경과 체감 강도를 비교해요. 차이만으로 특정 능력이 부족하다고 진단하지 않아요.",
      },
      sourceRefs: [reviewRef, ...source.sourceRefs],
      version: "1.0.0", reviewRef,
    }
    return { ...row, fingerprint: canonicalJsonFingerprint("trainoracle.same-event-race-pace.v1", row) }
  }))
}
