import { TREADMILL_RULES } from '../../domain/minigame/treadmill'
import type { TreadmillCommand, TreadmillState } from '../../domain/minigame/treadmill'

export type ActionCue = { kind: 'jump' | 'dash' | 'wait'; text: string; detail: string }
/** Report the engine result, never treat a requested action as a successful one. */
export function actionFeedback(before: TreadmillState, after: TreadmillState, command: TreadmillCommand): ActionCue | null {
  if (before.mode !== 'running' || (command.type !== 'jump' && command.type !== 'dash')) return null
  if (after.stats.jumps > before.stats.jumps) return { kind: 'jump', text: '점프!', detail: `에너지 −${before.jumpCost}` }
  if (after.stats.dashes > before.stats.dashes) return { kind: 'dash', text: '대시!', detail: `에너지 −${TREADMILL_RULES.dashCost}` }
  if (before.countdown > 0) return { kind: 'wait', text: '출발 준비 중', detail: '카운트가 끝나면 움직여요' }
  if (command.type === 'dash' && before.cooldown > 0) return { kind: 'wait', text: '대시 충전 중', detail: `${before.cooldown.toFixed(1)}초 뒤 다시 눌러요` }
  if (command.type === 'jump' && (before.y > 0 || before.velocityY !== 0)) return { kind: 'wait', text: '아직 공중이에요', detail: '착지한 뒤 다시 점프해요' }
  const cost = command.type === 'jump' ? before.jumpCost : TREADMILL_RULES.dashCost
  if (before.energy < cost) return { kind: 'wait', text: '에너지가 부족해요', detail: `손을 떼고 회복 · ${cost} 필요` }
  return null
}
