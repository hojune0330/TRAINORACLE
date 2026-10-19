import { NEW_PET_IDS, NEW_PETS } from './pet-new-friends'
export const LEGACY_PET_IDS = ['otter', 'seal', 'red-panda', 'duck', 'hedgehog', 'mouse', 'rabbit', 'puppy', 'chinchilla', 'guinea-pig', 'penguin', 'tortoise'] as const
export const PET_IDS = [...LEGACY_PET_IDS, ...NEW_PET_IDS] as const
export type PetId = typeof PET_IDS[number]
export const CARE_ACTIONS = ['pet', 'feed', 'play', 'bed'] as const
export type CareAction = typeof CARE_ACTIONS[number]
export type PetPose = 'awake' | 'happy' | 'eating' | 'playing' | 'sleeping' | 'waking'
export const POSE_FRAME: Record<PetPose, number> = { awake: 0, happy: 1, eating: 2, playing: 3, sleeping: 4, waking: 5 }
export const CARE_LABEL: Record<CareAction, string> = { pet: '쓰다듬기', feed: '간식 주기', play: '공놀이 하기', bed: '잠자리 준비하기' }
export interface PetDefinition {
  id: PetId
  name: string
  animal: string
  hello: string
  favorite: string
  accent: string
  missions: readonly { action: CareAction; days: number }[]
}
export const PETS: readonly PetDefinition[] = [
  { id: 'otter', name: '동글', animal: '수달', hello: '공 가져왔어. 같이 놀자!', favorite: '데굴데굴 공놀이', accent: '#e8bc94', missions: [{ action: 'play', days: 7 }, { action: 'pet', days: 5 }, { action: 'bed', days: 5 }] },
  { id: 'seal', name: '말랑', animal: '물범', hello: '여기 푹신하다. 옆에 앉아도 돼?', favorite: '토닥토닥 쓰다듬기', accent: '#bed9e5', missions: [{ action: 'pet', days: 7 }, { action: 'feed', days: 5 }, { action: 'bed', days: 5 }] },
  { id: 'red-panda', name: '단풍', animal: '레서판다', hello: '내 꼬리 옆에 자리 있어 ㅎㅎ', favorite: '간식 먹고 쉬기', accent: '#e6a481', missions: [{ action: 'feed', days: 7 }, { action: 'play', days: 5 }, { action: 'bed', days: 5 }] },
  { id: 'duck', name: '삐약', animal: '아기오리', hello: '종종종! 너 보러 왔어.', favorite: '함께 공 굴리기', accent: '#f3d887', missions: [{ action: 'play', days: 7 }, { action: 'feed', days: 5 }, { action: 'bed', days: 5 }] },
  { id: 'hedgehog', name: '밤톨', animal: '고슴도치', hello: '조금 낯가려. 천천히 친해지자.', favorite: '조용히 토닥이기', accent: '#d5b69a', missions: [{ action: 'pet', days: 7 }, { action: 'feed', days: 5 }, { action: 'bed', days: 7 }] },
  { id: 'mouse', name: '콩알', animal: '생쥐', hello: '작아도 공은 잘 굴려! 봐 봐.', favorite: '작은 공 쫓아가기', accent: '#d8b798', missions: [{ action: 'play', days: 7 }, { action: 'pet', days: 5 }, { action: 'bed', days: 5 }] },
  { id: 'rabbit', name: '보리', animal: '토끼', hello: '네 옆은 조용해서 좋아.', favorite: '귀 옆 쓰다듬기', accent: '#c6bdbe', missions: [{ action: 'pet', days: 7 }, { action: 'play', days: 5 }, { action: 'bed', days: 7 }] },
  { id: 'puppy', name: '두부', animal: '강아지', hello: '왔어? 나 꼬리 흔들면서 기다렸어!', favorite: '공 물고 오기', accent: '#efd0ac', missions: [{ action: 'play', days: 7 }, { action: 'pet', days: 7 }, { action: 'bed', days: 5 }] },
  { id: 'chinchilla', name: '포포', animal: '친칠라', hello: '내 꼬리 폭신하지? 옆에 앉자.', favorite: '등 토닥이기', accent: '#d6c7e4', missions: [{ action: 'pet', days: 7 }, { action: 'feed', days: 5 }, { action: 'bed', days: 7 }] },
  { id: 'guinea-pig', name: '모찌', animal: '기니피그', hello: '오물오물… 네 간식도 있어?', favorite: '작은 간식 한 입', accent: '#eed9ae', missions: [{ action: 'feed', days: 7 }, { action: 'pet', days: 5 }, { action: 'bed', days: 5 }] },
  { id: 'penguin', name: '몽실', animal: '펭귄', hello: '뒤뚱뒤뚱. 나도 같이 놀래!', favorite: '공 굴리며 뒤뚱걷기', accent: '#bfcedd', missions: [{ action: 'play', days: 7 }, { action: 'feed', days: 5 }, { action: 'bed', days: 7 }] },
  { id: 'tortoise', name: '느루', animal: '거북이', hello: '천천히 왔어. 오래 같이 있자.', favorite: '일찍 잠자리 펴기', accent: '#c1d7b1', missions: [{ action: 'bed', days: 7 }, { action: 'pet', days: 5 }, { action: 'feed', days: 5 }] },
  ...NEW_PETS,
]
export const petById = (id: PetId): PetDefinition => PETS.find(pet => pet.id === id)!
export const petAsset = (id: PetId) => `${import.meta.env.BASE_URL}games/${(LEGACY_PET_IDS as readonly string[]).includes(id) ? 'pet-room-v1' : 'pet-friends-v2'}/pets/${id}.webp`
