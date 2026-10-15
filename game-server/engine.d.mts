import type { ArenaRound, ArenaPlayer } from '../app/src/screens/treadmill/arena-types'
export type Rules = { duration: number; countdown: number; respawn: number; protection: number; creditWindow: number }
export type EngineRound = Omit<ArenaRound, 'players' | 'hazards'> & {
  rules: Rules; nextHazard: number; hazardId: number;
  players: (ArenaPlayer & { inputAge: number; attacked: boolean; lastHit: { id: string; time: number } | null })[];
  hazards: (ArenaRound['hazards'][number] & { checked: string[] })[];
}
export const RULES: Readonly<Rules>
export function newRound(ids: string[], round?: number, rules?: Rules, mode?: 'push' | 'survival'): EngineRound
export function command(state: EngineRound, id: string, input: { run?: boolean; action?: 'jump' | 'dash' }): void
export function step(state: EngineRound, dt: number): void
export function finish(state: EngineRound, interrupted?: boolean): void
export function publicRound(state: EngineRound): ArenaRound
