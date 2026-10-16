export type ArenaMode = 'push' | 'survival'
export type ArenaReaction = 'hello' | 'nice' | 'again' | 'thanks'
export type ArenaPlayer = {
  id: string; slot: number; x: number; y: number; vy: number; vx: number; energy: number; running: boolean;
  kos: number; falls: number; dodges: number; state: 'alive' | 'respawning'; respawnAt: number;
  protectedUntil: number; hitUntil: number; dashUntil: number; cooldownUntil: number;
}
export type ArenaStanding = { id: string; rank: number; kos: number; falls: number; dodges: number }
export type ArenaRound = {
  round: number; mode?: ArenaMode; phase: 'countdown' | 'playing' | 'finished' | 'interrupted'; time: number; duration: number;
  players: ArenaPlayer[]; hazards: { id: number; x: number; kind: 'hurdle' | 'rock' }[]; standings: ArenaStanding[];
}
export type ArenaSnapshot = { type: 'state'; room: string; host: string;
  partyVersion?: number; mode?: ArenaMode;
  members: { id: string; name: string; ready: boolean; connected: boolean; partyVersion?: number; vote?: ArenaMode | null; reaction?: ArenaReaction }[]; game: ArenaRound | null;
  history: { round: number; mode?: ArenaMode; standings: (ArenaStanding & { name: string })[] }[] }
export const arenaInvitation = () => {
  const room = new URLSearchParams(location.hash.slice(1)).get('arena')
  return room && /^[A-Za-z0-9_-]{24}$/.test(room) ? room : null
}
// Public endpoint only: no API key, account session or health data.
export const arenaEndpoint = () => String(import.meta.env.VITE_FRIEND_ARENA_URL ?? '')
