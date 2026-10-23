import { PET_IDS, type CareAction, type PetId } from './pet-catalog'
import type { PetHome } from './pet-engine'

export const ROOM_DECOR_IDS = ['paw-frame', 'sprout-pot', 'toy-basket', 'moon-cushion'] as const
export type RoomDecorId = typeof ROOM_DECOR_IDS[number]
export const ROOM_DECOR: Record<RoomDecorId, { name: string; action: CareAction; requirement: string; memory: string; reply: string }> = {
  'paw-frame': { name: '발도장 액자', action: 'pet', requirement: '친구를 처음 쓰다듬으면 받아요', memory: '처음 쓰다듬은 날', reply: '우리 처음 친해진 날이네 ㅎㅎ' },
  'sprout-pot': { name: '새싹 화분', action: 'feed', requirement: '첫 간식을 주면 받아요', memory: '첫 간식을 준 날', reply: '간식 먹던 자리 옆에 두자!' },
  'toy-basket': { name: '장난감 바구니', action: 'play', requirement: '처음 같이 놀면 받아요', memory: '처음 같이 논 날', reply: '다 놀면 여기에 넣어 둘게.' },
  'moon-cushion': { name: '달 쿠션', action: 'bed', requirement: '처음 불 끄고 재우면 받아요', memory: '처음 잠자리를 펴 준 날', reply: '오늘도 이 쿠션 옆에서 잘래.' },
}
export type RoomKeepsake = { id: RoomDecorId; petId: PetId; date: string }
/** Derive ownership only from saved care. Opening an activity earns nothing. */
export function roomKeepsakes(home: PetHome): RoomKeepsake[] {
  return ROOM_DECOR_IDS.flatMap(id => {
    const first = PET_IDS.flatMap(petId => (home.pets[petId]?.actions[ROOM_DECOR[id].action] ?? []).map(date => ({ petId, date })))
      .sort((a, b) => a.date.localeCompare(b.date) || PET_IDS.indexOf(a.petId) - PET_IDS.indexOf(b.petId))[0]
    return first ? [{ id, ...first }] : []
  })
}
