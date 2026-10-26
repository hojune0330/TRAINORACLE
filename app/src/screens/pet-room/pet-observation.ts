import { z } from 'zod'
import { PET_IDS, petById, type PetId } from './pet-catalog'
import type { PetHome } from './pet-engine'
import { PET_PLAY } from './pet-play'

export const OBSERVATION_ITEM_IDS = ['ball', 'box', 'cushion', 'plush', 'large-blanket', 'tent'] as const
export type ObservationItemId = typeof OBSERVATION_ITEM_IDS[number]
export const OBSERVATION_SLOT_IDS = ['bedside', 'window', 'corner'] as const
export type ObservationSlotId = typeof OBSERVATION_SLOT_IDS[number]
export const OBSERVATION_ITEMS: readonly { id: ObservationItemId; label: string; unlockDays: number; description: string }[] = [
  { id: 'ball', label: '작은 공', unlockDays: 0, description: '굴리거나 안고 잘 수 있는 공이에요.' },
  { id: 'box', label: '종이 상자', unlockDays: 0, description: '안에 들어가거나 가장자리에 기댈 수 있어요.' },
  { id: 'cushion', label: '낮은 쿠션', unlockDays: 0, description: '머리를 올리거나 옆으로 밀 수도 있어요.' },
  { id: 'plush', label: '작은 인형', unlockDays: 3, description: '안고 자거나 침대로 옮길 수 있어요.' },
  { id: 'large-blanket', label: '큰 이불', unlockDays: 7, description: '친구 둘이 함께 덮을 만큼 넓어요.' },
  { id: 'tent', label: '작은 천막', unlockDays: 14, description: '안에 숨거나 입구에 누울 수 있어요.' },
]
export const OBSERVATION_SLOTS: readonly { id: ObservationSlotId; label: string }[] = [
  { id: 'bedside', label: '침대 옆' }, { id: 'window', label: '창가' }, { id: 'corner', label: '방 구석' },
]
export type ObservationScene = { id: string; title: string; petId: PetId; itemId: ObservationItemId; partnerId?: PetId; rarity: 'ordinary' | 'unexpected' | 'rare'; description: string }
export const OBSERVATION_SCENES: readonly ObservationScene[] = [
  { id: 'otter-ball', title: '공을 안고 쿨쿨', petId: 'otter', itemId: 'ball', rarity: 'ordinary', description: '동글이가 두 손으로 공을 안고 자고 있어요.' },
  { id: 'otter-seal-ball', title: '같은 공 위에 앞발', petId: 'otter', itemId: 'ball', partnerId: 'seal', rarity: 'rare', description: '동글이와 말랑이가 같은 공 위에 앞발을 올리고 잤어요.' },
  { id: 'cat-box', title: '침대보다 상자', petId: 'cat', itemId: 'box', rarity: 'ordinary', description: '고양이가 침대 대신 상자 안에 들어가 잤어요.' },
  { id: 'cat-box-paws', title: '꼬리와 한쪽 발만 빼꼼', petId: 'cat', itemId: 'box', rarity: 'rare', description: '상자 밖으로 꼬리와 한쪽 발만 나와 있어요.' },
  { id: 'seal-cushion', title: '쿠션에 턱 올리기', petId: 'seal', itemId: 'cushion', rarity: 'ordinary', description: '말랑이가 낮은 쿠션에 턱을 올리고 잤어요.' },
  { id: 'seal-flat', title: '쿠션은 옆에 둘래', petId: 'seal', itemId: 'cushion', rarity: 'rare', description: '말랑이가 쿠션을 옆으로 밀고 바닥에 납작하게 누웠어요.' },
  { id: 'red-panda-tail', title: '내 꼬리가 베개', petId: 'red-panda', itemId: 'cushion', rarity: 'ordinary', description: '단풍이가 쿠션 옆에서 자기 꼬리를 베고 잤어요.' },
  { id: 'red-panda-tent', title: '꼬리로 닫은 천막', petId: 'red-panda', itemId: 'tent', rarity: 'rare', description: '단풍이가 천막 입구를 꼬리로 가린 채 자고 있어요.' },
  { id: 'rabbit-blanket', title: '이불 끝의 작은 자리', petId: 'rabbit', itemId: 'large-blanket', rarity: 'ordinary', description: '보리가 큰 이불 끝에 몸을 모으고 잤어요.' },
  { id: 'rabbit-hedgehog-blanket', title: '이불 양쪽에 나란히', petId: 'rabbit', itemId: 'large-blanket', partnerId: 'hedgehog', rarity: 'rare', description: '보리와 밤톨이가 큰 이불 양쪽 끝에서 함께 잤어요.' },
  { id: 'puppy-plush', title: '인형도 침대로', petId: 'puppy', itemId: 'plush', rarity: 'ordinary', description: '두부가 인형을 물고 침대로 옮겼어요.' },
  { id: 'puppy-plush-hug', title: '인형을 꼭 안고', petId: 'puppy', itemId: 'plush', rarity: 'rare', description: '두부가 인형에 턱을 올리고 앞발로 꼭 감싸고 잤어요.' },
]

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(day => {
  const date = new Date(`${day}T12:00:00Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === day
})
const placementsSchema = z.object({ bedside: z.enum(OBSERVATION_ITEM_IDS).nullable(), window: z.enum(OBSERVATION_ITEM_IDS).nullable(), corner: z.enum(OBSERVATION_ITEM_IDS).nullable() }).strict()
const resultSchema = z.object({
  id: z.string().min(1).max(150), petIds: z.array(z.enum(PET_IDS)).max(2), itemId: z.enum(OBSERVATION_ITEM_IDS), slot: z.enum(OBSERVATION_SLOT_IDS),
  status: z.enum(['used', 'untouched']), sceneId: z.string().max(100).nullable(), description: z.string().min(1).max(200),
}).strict()
const nightSchema = z.object({
  id: dateSchema, bedDay: dateSchema, wakeDate: dateSchema, roster: z.array(z.enum(PET_IDS)).min(1).max(3), placements: placementsSchema,
  results: z.array(resultSchema).max(3), observedOn: dateSchema.nullable(),
}).strict()
export type ObservationPlacements = z.infer<typeof placementsSchema>
export type ObservationResult = z.infer<typeof resultSchema>
export type ObservationNight = z.infer<typeof nightSchema>
export type ObservationState = { placements: ObservationPlacements; nights: ObservationNight[]; activeNightId: string | null; photos: string[] }
export const freshObservationState = (): ObservationState => ({ placements: { bedside: 'ball', window: 'box', corner: null }, nights: [], activeNightId: null, photos: [] })
export const observationSchema = z.object({
  placements: placementsSchema, nights: z.array(nightSchema).max(36600), activeNightId: dateSchema.nullable(), photos: z.array(z.string().min(1).max(150)).max(109800),
}).strict().default(freshObservationState)
export const observationState = (home: Pick<PetHome, 'observation'>): ObservationState => home.observation ?? freshObservationState()
export const bedtimeDays = (home: PetHome): number => new Set(Object.values(home.pets).flatMap(pet => pet?.actions.bed ?? [])).size
export const observationSlotCount = (home: PetHome): number => bedtimeDays(home) >= 7 ? 3 : 2
export const isObservationItemUnlocked = (home: PetHome, id: ObservationItemId): boolean => {
  const item = OBSERVATION_ITEMS.find(item => item.id === id)
  return !!item && bedtimeDays(home) >= item.unlockDays
}
export const activeObservationNight = (home: PetHome): ObservationNight | null => {
  const state = observationState(home)
  return state.nights.find(night => night.id === state.activeNightId) ?? null
}
export function defaultObservationWakeDate(now = new Date()): string {
  const date = new Date(now)
  if (date.getHours() >= 18) date.setDate(date.getDate() + 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
export function placeObservationItem(home: PetHome, slot: ObservationSlotId, item: ObservationItemId | null): PetHome {
  if (home.sleeping || home.morning || !OBSERVATION_SLOT_IDS.includes(slot) || slot === 'corner' && observationSlotCount(home) < 3
    || item !== null && !isObservationItemUnlocked(home, item)) return home
  const state = observationState(home)
  if (state.placements[slot] === item) return home
  const placements = { ...state.placements }
  // One owned object, one place. Moving it does not clone it.
  for (const key of OBSERVATION_SLOT_IDS) if (item !== null && placements[key] === item) placements[key] = null
  placements[slot] = item
  return { ...home, observation: { ...state, placements } }
}

type Preference = { liked: ObservationItemId[]; lessInterested: ObservationItemId[]; place: ObservationSlotId }
const preferences: Partial<Record<PetId, Preference>> = {
  otter: { liked: ['ball', 'cushion'], lessInterested: ['tent'], place: 'bedside' },
  cat: { liked: ['box', 'tent'], lessInterested: ['large-blanket'], place: 'window' },
  seal: { liked: ['cushion', 'ball'], lessInterested: ['box'], place: 'bedside' },
  'red-panda': { liked: ['cushion', 'tent'], lessInterested: ['plush'], place: 'corner' },
  rabbit: { liked: ['large-blanket', 'cushion'], lessInterested: ['ball'], place: 'corner' },
  puppy: { liked: ['ball', 'plush'], lessInterested: ['tent'], place: 'bedside' },
}
export function observationPreference(id: PetId): Preference {
  const style = PET_PLAY[id].style
  return preferences[id] ?? (style === 'fetch' ? { liked: ['ball', 'plush'], lessInterested: ['tent'], place: 'bedside' }
    : style === 'hide' ? { liked: ['box', 'tent'], lessInterested: ['large-blanket'], place: 'corner' }
      : { liked: ['ball', 'cushion'], lessInterested: ['tent'], place: 'window' })
}
export function observationUseChance(id: PetId, item: ObservationItemId, slot: ObservationSlotId): number {
  const preference = observationPreference(id)
  return Math.min(.8, (preference.liked.includes(item) ? .65 : preference.lessInterested.includes(item) ? .1 : .35) + (preference.place === slot ? .1 : 0))
}
function hash(value: string): number {
  let n = 2166136261
  for (let i = 0; i < value.length; i++) n = Math.imul(n ^ value.charCodeAt(i), 16777619)
  return n >>> 0
}
const draw = (seed: string, key: string) => hash(`${seed}:${key}`) / 0x100000000
export function observedItemStats(home: PetHome, petId: PetId, itemId: ObservationItemId): { offered: number; used: number; usedDates: string[] } {
  const nights = observationState(home).nights.filter(night => night.observedOn && night.roster.includes(petId) && Object.values(night.placements).includes(itemId))
  const usedDates = [...new Set(nights.filter(night => night.results.some(result => result.status === 'used' && result.itemId === itemId && result.petIds.includes(petId))).map(night => night.wakeDate))]
  return { offered: nights.length, used: usedDates.length, usedDates }
}
function ordinaryDescription(pet: PetId, item: ObservationItemId): string {
  const name = petById(pet).name
  const action: Record<ObservationItemId, string> = {
    ball: '공을 앞에 놓고 쉬었어요.', box: '상자 가장자리에 기대어 쉬었어요.', cushion: '쿠션에 몸을 기대고 잤어요.',
    plush: '인형을 옆에 두고 잤어요.', 'large-blanket': '큰 이불 끝에 몸을 모으고 잤어요.', tent: '천막 입구에 누워 쉬었어요.',
  }
  return `${name}: ${action[item]}`
}

/** No health inputs. Called before bedtime credit is added; all results are frozen in one write. */
export function prepareObservationNight(home: PetHome, bedDay: string, wakeDate: string, present: PetId[]): PetHome {
  const state = observationState(home)
  if (!dateSchema.safeParse(bedDay).success || !dateSchema.safeParse(wakeDate).success || wakeDate < bedDay
    || state.nights.some(night => night.wakeDate === wakeDate) || state.nights.some(night => !night.observedOn)
    || !present.includes(home.selected) || present.some(id => !home.pets[id])) return home
  const seed = `${home.seed}:observation:${bedDay}:${wakeDate}`
  // Match the preparation panel: selected friend, then the other visible companions.
  const roster = [home.selected, ...[...new Set(present)].filter(id => id !== home.selected)].slice(0, 3)
  const placements = { ...state.placements }
  if (observationSlotCount(home) < 3) placements.corner = null
  for (const slot of OBSERVATION_SLOT_IDS) if (placements[slot] && !isObservationItemUnlocked(home, placements[slot]!)) placements[slot] = null
  const available = OBSERVATION_SLOT_IDS.filter(slot => placements[slot] !== null)
  const results: ObservationResult[] = []
  const consumed = new Set<PetId>()
  for (const petId of roster) {
    if (consumed.has(petId) || !available.length) continue
    const ranked = [...available].sort((a, b) => draw(seed, `${petId}:slot:${a}`) - draw(seed, `${petId}:slot:${b}`))
    const slot = ranked[0]!
    available.splice(available.indexOf(slot), 1)
    const itemId = placements[slot]!
    const firstGuarantee = state.nights.length === 0 && petId === home.selected
    const used = firstGuarantee || draw(seed, `${petId}:use:${itemId}:${slot}`) < observationUseChance(petId, itemId, slot)
    consumed.add(petId)
    let scene: ObservationScene | undefined
    if (used) {
      const candidates = OBSERVATION_SCENES.filter(scene => scene.petId === petId && scene.itemId === itemId)
      const prior = observedItemStats(home, petId, itemId).usedDates.length
      const rare = candidates.find(scene => scene.rarity === 'rare' && (!scene.partnerId || roster.includes(scene.partnerId) && !consumed.has(scene.partnerId)))
      if (!firstGuarantee && prior >= 2 && rare && draw(seed, `${petId}:rare:${itemId}`) < .05) scene = rare
      else scene = candidates.find(scene => scene.rarity === 'ordinary' || scene.rarity === 'unexpected')
    }
    if (scene?.partnerId) consumed.add(scene.partnerId)
    results.push({ id: `${wakeDate}:${slot}`, petIds: used ? [petId, ...(scene?.partnerId ? [scene.partnerId] : [])] : [], itemId, slot, status: used ? 'used' : 'untouched', sceneId: scene?.id ?? null,
      description: used ? scene?.description ?? ordinaryDescription(petId, itemId) : `${OBSERVATION_ITEMS.find(item => item.id === itemId)!.label}: 놓아 둔 자리에 그대로 있어요.` })
  }
  for (const slot of available) {
    const itemId = placements[slot]!
    results.push({ id: `${wakeDate}:${slot}`, petIds: [], itemId, slot, status: 'untouched', sceneId: null, description: `${OBSERVATION_ITEMS.find(item => item.id === itemId)!.label}: 놓아 둔 자리에 그대로 있어요.` })
  }
  const night: ObservationNight = { id: wakeDate, bedDay, wakeDate, roster, placements, results, observedOn: null }
  return { ...home, observation: { ...state, activeNightId: night.id, nights: [...state.nights, night] } }
}
export function revealObservationNight(home: PetHome, day: string): PetHome {
  const night = activeObservationNight(home)
  if (!night || night.observedOn || !dateSchema.safeParse(day).success || day < night.wakeDate) return home
  const state = observationState(home)
  return { ...home, observation: { ...state, nights: state.nights.map(item => item.id === night.id ? { ...item, observedOn: day } : item) } }
}
export function photographObservation(home: PetHome, resultId: string): PetHome {
  const state = observationState(home)
  if (state.photos.includes(resultId) || !state.nights.some(night => night.observedOn && night.results.some(result => result.id === resultId && result.status === 'used'))) return home
  return { ...home, observation: { ...state, photos: [...state.photos, resultId] } }
}

/** Extra referential checks keep corrupted observations from replacing a valid saved home. */
export function validObservationState(home: PetHome): boolean {
  const state = observationState(home)
  if (new Set(state.nights.map(night => night.id)).size !== state.nights.length || new Set(state.photos).size !== state.photos.length
    || state.activeNightId !== null && !state.nights.some(night => night.id === state.activeNightId)) return false
  const slots = Object.values(state.placements).filter(Boolean)
  if (new Set(slots).size !== slots.length) return false
  const validPhotoIds = new Set<string>()
  let pending = 0
  for (const night of state.nights) {
    if (night.id !== night.wakeDate || night.wakeDate < night.bedDay || night.observedOn && night.observedOn < night.wakeDate
      || new Set(night.roster).size !== night.roster.length || night.roster.some(id => !home.pets[id])) return false
    if (!night.observedOn) {
      pending++
      if (night.id !== state.activeNightId || !home.sleeping || home.sleeping.day !== night.bedDay
        || night.roster.some(id => !home.sleeping!.pets.includes(id))) return false
    }
    const assigned = night.results.flatMap(result => result.petIds)
    const placed = Object.values(night.placements).filter(Boolean)
    if (new Set(assigned).size !== assigned.length || new Set(placed).size !== placed.length
      || new Set(night.results.map(result => result.slot)).size !== night.results.length || night.results.length !== placed.length) return false
    for (const result of night.results) {
      if (result.id !== `${night.id}:${result.slot}` || result.itemId !== night.placements[result.slot] || result.petIds.some(id => !night.roster.includes(id))
        || result.status === 'used' && !result.petIds.length || result.status === 'untouched' && (result.petIds.length > 0 || result.sceneId !== null)) return false
      if (result.sceneId) {
        const scene = OBSERVATION_SCENES.find(scene => scene.id === result.sceneId)
        if (!scene || scene.itemId !== result.itemId || result.petIds[0] !== scene.petId || scene.partnerId !== result.petIds[1]) return false
      } else if (result.petIds.length > 1) return false
      if (night.observedOn && result.status === 'used') validPhotoIds.add(result.id)
    }
  }
  return pending <= 1 && state.photos.every(id => validPhotoIds.has(id))
}
