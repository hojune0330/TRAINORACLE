import type { SoloDefense } from './solo-defense'
import { FACILITIES } from './solo-defense'
import { bestSoloRecord } from './solo-party-storage'
import type { SoloRecord } from './solo-party-storage'

// Feedback-loop reference, independently implemented (no upstream code/assets copied):
// clupasq/word-mastermind @ d3580e1, assets/client-app.js submitWord/board.
// Preserve each attempt's actual outcome so the next choice has evidence.
export function beginDefenseReview(s: SoloDefense) {
  return { wave: s.wave, totals: { ...s.totals }, falls: s.runner.falls,
    facilities: s.facilities.map((f, i) => f ? `${i + 1}번 ${FACILITIES[f.kind].name} ${f.level}단계` : `${i + 1}번 비어 있음`) }
}
export type DefenseReview = { wave: number; killed: number; passed: number; unresolved: number; falls: number; pushed: number; collected: number; facilities: string[] }
export function finishDefenseReview(start: ReturnType<typeof beginDefenseReview>, end: SoloDefense): DefenseReview | null {
  if (!((end.phase === 'prepare' && end.wave === start.wave + 1) || (end.phase === 'finished' && end.wave === start.wave))) return null
  return { wave: start.wave, killed: end.totals.killed - start.totals.killed, passed: end.totals.passed - start.totals.passed,
    unresolved: end.totals.unresolved - start.totals.unresolved, falls: end.runner.falls - start.falls,
    pushed: end.totals.pushed - start.totals.pushed, collected: end.totals.collected - start.totals.collected, facilities: start.facilities }
}
/** No invented baseline: exclude this run, other modes and incompatible rule versions. */
export function previousBestMessage(records: SoloRecord[], current: SoloRecord) {
  const best = bestSoloRecord(records.filter(r => r.id !== current.id && r.version === current.version), current.mode)
  if (!best) return '첫 완주 기록이에요. 다음 판부터 같은 종목의 이전 최고 기록과 비교해요.'
  if (current.mode === 'defense') {
    const d = current.missed - best.missed
    return d === 0 ? `이전 최고와 놓친 적이 같아요. 낙하 ${best.falls} → ${current.falls}회.`
      : `이전 최고보다 ${Math.abs(d)}마리 ${d < 0 ? '더 막았어요' : '더 놓쳤어요'}. 놓친 적 ${best.missed} → ${current.missed}마리.`
  }
  return `이전 최고와 비교 · 승점 ${best.wins} → ${current.wins}/4 · 밀어냄 ${best.success} → ${current.success}회 · 낙하 ${best.falls} → ${current.falls}회.`
}
