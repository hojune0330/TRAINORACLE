import type { PetId } from './pet-catalog'
import { NEW_PLAY } from './pet-new-friends'

export type PlayStyle = 'roll' | 'fetch' | 'hide'
export const PET_PLAY: Record<PetId, { style: PlayStyle; motion: 'slide' | 'hop' | 'waddle'; travelMs: number; petting: string; invite: string }> = {
  ...NEW_PLAY,
  otter: { style: 'roll', motion: 'slide', travelMs: 850, petting: '볼을 살살 쓸어 줘', invite: '공을 굴려 줘. 내가 다시 보낼게!' },
  seal: { style: 'roll', motion: 'slide', travelMs: 1100, petting: '등을 천천히 토닥여 줘', invite: '배로 공을 받아 볼게. 살살 굴려 줘.' },
  'red-panda': { style: 'roll', motion: 'hop', travelMs: 950, petting: '꼬리 옆을 쓱쓱 해 줘', invite: '내 꼬리 옆으로 공을 굴려 줘!' },
  duck: { style: 'roll', motion: 'waddle', travelMs: 850, petting: '머리 위를 살살 쓸어 줘', invite: '종종종! 공을 보내 주면 따라갈게.' },
  hedgehog: { style: 'roll', motion: 'slide', travelMs: 1200, petting: '앞쪽을 천천히 쓰다듬어 줘', invite: '조금만 굴려 줘. 가까이 오면 받을게.' },
  mouse: { style: 'hide', motion: 'hop', travelMs: 850, petting: '작은 볼을 살짝 쓸어 줘', invite: '쿠션 뒤에 공 숨길게. 어디 있는지 봐 봐!' },
  rabbit: { style: 'roll', motion: 'hop', travelMs: 950, petting: '귀 옆을 살살 쓸어 줘', invite: '공 옆으로 폴짝 뛰어 볼래. 굴려 줘!' },
  puppy: { style: 'fetch', motion: 'hop', travelMs: 1050, petting: '등을 쓱쓱 쓰다듬어 줘', invite: '공을 어디로 보낼까? 내가 가져올게!' },
  chinchilla: { style: 'hide', motion: 'hop', travelMs: 950, petting: '폭신한 등을 토닥여 줘', invite: '푹신한 쿠션 뒤에 공을 숨겨 볼까?' },
  'guinea-pig': { style: 'roll', motion: 'waddle', travelMs: 1100, petting: '등을 천천히 쓸어 줘', invite: '가까이 굴려 줘. 짧은 발로 받아 볼게.' },
  penguin: { style: 'roll', motion: 'waddle', travelMs: 1150, petting: '머리 위를 살살 토닥여 줘', invite: '날개로 톡 보내 줄게. 공을 굴려 줘!' },
  tortoise: { style: 'roll', motion: 'slide', travelMs: 1500, petting: '고개 옆을 천천히 쓸어 줘', invite: '멈춘 공은 내가 밀어 줄게. 천천히 놀자.' },
}

export type RoomPoint = { x: number; y: number }
export function inDropZone(point: RoomPoint, center: RoomPoint, radius = 17) {
  return Math.hypot(point.x - center.x, point.y - center.y) <= radius
}

/** One deliberate pass, then a reversal. Jitter and repeated moves in one direction do not count. */
export function petStroke(anchor: number, next: number, previousDirection: number) {
  const delta = next - anchor
  const direction = Math.sign(delta)
  return Math.abs(delta) >= 14 && direction !== previousDirection ? { anchor: next, direction } : null
}
