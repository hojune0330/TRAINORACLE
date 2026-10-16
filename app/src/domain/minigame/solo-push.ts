import { command, newRound, step } from '../../../../game-server/engine.mjs'
import type { EngineRound } from '../../../../game-server/engine.mjs'
import type { ArenaStanding } from '../../screens/treadmill/arena-types'

export type SoloPush = { mode: 'push' | 'survival'; round: 1 | 2; phase: 'ready' | 'playing' | 'between' | 'finished'; game: EngineRound; results: ArenaStanding[][]; botThink: number }
export function newSoloPush(mode: SoloPush['mode'] = 'push'): SoloPush {
  return { mode, round: 1, phase: 'ready', game: newRound(['you', 'bot'], 1, undefined, mode), results: [], botThink: 0 }
}
export function startSoloPush(s: SoloPush) {
  if (s.phase !== 'ready' && s.phase !== 'between') return
  if (s.phase === 'between') s.round = 2
  s.game = newRound(['you', 'bot'], s.round, undefined, s.mode); s.botThink = 0; s.phase = 'playing'
}
export function pushInput(s: SoloPush, run: boolean, action?: 'jump' | 'dash') {
  if (s.phase === 'playing') command(s.game, 'you', { run, action })
}
/** Same collision/energy/KO/respawn engine as friends. Bot acts only every 180ms, with normal costs. */
export function advanceSoloPush(s: SoloPush, dt: number, run: boolean) {
  if (s.phase !== 'playing') return
  const g = s.game
  command(g, 'you', { run })
  s.botThink -= dt
  if (s.botThink <= 0) {
    s.botThink = .18
    const bot = g.players[1]!, you = g.players[0]!
    const ahead = g.hazards.find(h => h.x > bot.x && h.x - bot.x < .13)
    const action = ahead && bot.energy >= 24 ? 'jump'
      : s.mode === 'push' && Math.abs(you.x - bot.x) < .1 && you.y < 25 ? 'dash' : undefined
    command(g, 'bot', { run: bot.energy > 12 && bot.x < (s.mode === 'survival' ? .6 : Math.min(.7, Math.max(.3, you.x + .025))), action })
  }
  step(g, dt)
  if (g.phase === 'finished') {
    s.results.push(g.standings.map(p => ({ ...p })))
    s.phase = s.round === 1 ? 'between' : 'finished'
  }
}
export function pushSeriesPoints(results: ArenaStanding[][], id: string) {
  return results.reduce((sum, round) => {
    const me = round.find(p => p.id === id)
    return sum + (me?.rank === 1 ? round.every(p => p.rank === 1) ? 1 : 2 : 0)
  }, 0)
}
