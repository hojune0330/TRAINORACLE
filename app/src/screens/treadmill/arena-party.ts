import type { ArenaMode, ArenaSnapshot } from './arena-types'

export const PARTY_MODES = {
  push: { name: '밀어내기', goal: '가까이서 대시해 상대를 떨어뜨리세요.', ranking: '밀어냄 많은 순 → 낙하 적은 순', icon: 'track-island' },
  survival: { name: '장애물 생존', goal: '연속 장애물을 넘으며 낙하를 줄이세요. 서로 밀리지 않아요.', ranking: '낙하 적은 순 → 점프 회피 많은 순', icon: 'jump-pad' },
} as const
export const PARTY_REACTIONS = { hello: '반가워요!', nice: '멋진 플레이!', again: '한 판 더!', thanks: '고마워요!' } as const

/** Only matches shared by the current pair count. Ties never become wins. */
export function roomSeries(snapshot: ArenaSnapshot) {
  const rounds = snapshot.history.filter(r => snapshot.members.length === 2 && snapshot.members.every(m => r.standings.some(p => p.id === m.id)))
  return { rounds: rounds.length, players: snapshot.members.map(m => ({ id: m.id, name: m.name,
    wins: rounds.filter(r => r.standings.find(p => p.id === m.id)?.rank === 1 && r.standings.some(p => p.rank > 1)).length,
    ties: rounds.filter(r => r.standings.every(p => p.rank === 1)).length,
  })) }
}
export const modeOf = (mode?: ArenaMode) => mode === 'survival' ? 'survival' : 'push'
