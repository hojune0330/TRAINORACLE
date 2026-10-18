import { CARE_LABEL, petById, type CareAction, type PetId, type PetPose } from './pet-catalog'
import type { PetBond } from './pet-engine'

export type PetMemory = { key: string; date: string; title: string; note: string; pose: PetPose }
const ordered = (days: string[]) => [...days].sort()
// Date-only saves cannot distinguish care before vs after adoption on that same day.
// Count from the following day so the action that earned adoption is never reused.
export const adoptedCareDays = (bond: PetBond) => bond.adoptedOn ? ordered(bond.caredDays.filter(day => day > bond.adoptedOn!)) : []

/** Cards are derived from actual saved actions. They never invent sleep hours or streaks. */
export function memoriesFor(id: PetId, bond: PetBond): PetMemory[] {
  const name = petById(id).name
  const cards: PetMemory[] = [{ key: 'met', date: bond.metOn, title: '처음 만난 날', note: `${name}이 우리 방에 놀러 왔어요.`, pose: 'awake' }]
  const firsts: { action: CareAction; title: string; note: string; pose: PetPose }[] = [
    { action: 'pet', title: '처음 쓰다듬은 날', note: '조심조심 손을 내밀었어요.', pose: 'happy' },
    { action: 'feed', title: '첫 간식', note: '바로 옆에서 오물오물 먹었어요.', pose: 'eating' },
    { action: 'play', title: '처음 같이 논 날', note: '공을 주고받으며 놀았어요.', pose: 'playing' },
    { action: 'bed', title: '처음 잠자리를 펴 준 날', note: '이불을 펴고 같이 쉬기로 했어요.', pose: 'sleeping' },
  ]
  for (const first of firsts) {
    const date = ordered(bond.actions[first.action])[0]
    if (date) cards.push({ key: first.action, date, title: first.title, note: first.note, pose: first.pose })
  }
  if (bond.adoptedOn) {
    cards.push({ key: 'adopted', date: bond.adoptedOn, title: '우리 집 식구가 된 날', note: '앞으로도 이 방에서 함께 지내요.', pose: 'happy' })
    const days = adoptedCareDays(bond)
    for (const milestone of [7, 30, 100]) {
      const date = days[milestone - 1]
      if (date) cards.push({ key: `family-${milestone}`, date, title: `입양 뒤 ${milestone}일을 돌봤어요`, note: '쉬어 간 날이 있어도 함께한 날은 남아요.', pose: milestone === 7 ? 'playing' : milestone === 30 ? 'sleeping' : 'happy' })
    }
  }
  return cards.sort((a, b) => a.date.localeCompare(b.date))
}

export function nextMemory(bond: PetBond): { done: number; target: number } | null {
  if (!bond.adoptedOn) return null
  const done = adoptedCareDays(bond).length
  const target = [7, 30, 100].find(value => value > done)
  return target ? { done, target } : null
}

export function nextCare(id: PetId, bond: PetBond, today: string): { action: CareAction; text: string } | null {
  if (bond.adoptedOn) return null
  const mission = petById(id).missions.find(item => bond.actions[item.action].length < item.days && !bond.actions[item.action].includes(today))
  if (!mission) return null
  return { action: mission.action, text: `${CARE_LABEL[mission.action]} · ${bond.actions[mission.action].length}/${mission.days}일` }
}
