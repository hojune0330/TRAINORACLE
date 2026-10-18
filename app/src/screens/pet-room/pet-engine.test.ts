import { describe, expect, it } from 'vitest'
import { PET_IDS, petById } from './pet-catalog'
import { adoptPet, atHome, canAdopt, careFor, createHome, finishMorning, invitePet, loadHome, parseHome, persistHome, petHomeKey, refreshVisitors, restAgain, sleepTogether, wakeTogether, type PetHome } from './pet-engine'
import { memoriesFor, nextMemory } from './pet-memories'

const day = '2026-10-18'
const dateAt = (n: number) => new Date(Date.UTC(2026, 9, 18 + n)).toISOString().slice(0, 10)
function storage() {
  const values = new Map<string, string>()
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, raw: string) => { values.set(key, raw) } }
}
describe('random visitors and earned adoption', () => {
  it('saves the draw across reloads and introduces all twelve animals before repeats', () => {
    const store = storage()
    let home = createHome(day, 20261018)
    expect(new Set(home.visitors).size).toBe(3)
    const saved = persistHome(store, 'guest', home, null)
    expect(saved.ok).toBe(true)
    expect(loadHome(store, 'guest', day, 999).home.visitors).toEqual(home.visitors)
    const seen = new Set(home.visitors)
    for (let i = 1; i <= 3; i++) {
      home = refreshVisitors(home, dateAt(i))
      expect(home.visitors.some(id => seen.has(id))).toBe(false)
      home.visitors.forEach(id => seen.add(id))
    }
    expect([...seen].sort()).toEqual([...PET_IDS].sort())
    expect(refreshVisitors(home, day)).toBe(home)
    expect(createHome(day, 111).visitors).not.toEqual(createHome(day, 222).visitors)
  })
  it('counts care at most once per day, keeps breaks, and unlocks exactly on day thirty', () => {
    let home = createHome(day, 7)
    const id = home.selected
    for (let i = 0; i < 29; i++) home = careFor(home, id, 'pet', dateAt(i * 2))
    expect(canAdopt(home, id)).toBe(false)
    expect(adoptPet(home, id, dateAt(58))).toBe(home)
    const repeat = careFor(home, id, 'pet', dateAt(56))
    expect(repeat).toBe(home)
    home = careFor(home, id, 'pet', dateAt(58))
    expect(home.pets[id]?.caredDays).toHaveLength(30)
    expect(canAdopt(home, id)).toBe(true)
    home = adoptPet(home, id, dateAt(58))
    expect(home.pets[id]?.adoptedOn).toBe(dateAt(58))
    const later = refreshVisitors(home, '2027-01-01')
    expect(atHome(later)).toContain(id)
    expect(later.pets[id]?.caredDays).toHaveLength(30)
    expect(later.visitors).not.toContain(id)
    expect(careFor(later, id, 'play', '2027-01-01').pets[id]?.caredDays).toHaveLength(31)
  })
  it('offers the mission route before thirty days, requiring all three missions', () => {
    for (const seed of [1, 42, 51, 99, 1024]) {
      let home = createHome(day, seed)
      const id = home.selected
      for (const mission of petById(id).missions) {
        for (let i = 0; i < mission.days - 1; i++) home = careFor(home, id, mission.action, dateAt(i))
      }
      expect(canAdopt(home, id)).toBe(false)
      for (const mission of petById(id).missions) home = careFor(home, id, mission.action, dateAt(mission.days - 1))
      expect(home.pets[id]!.caredDays.length).toBeLessThan(30)
      expect(canAdopt(home, id)).toBe(true)
    }
  })
  it('invites known visitors without rerolling the daily draw or granting progress', () => {
    const first = createHome(day, 77)
    const id = first.selected
    const home = refreshVisitors(first, dateAt(1))
    expect(home.visitors).not.toContain(id)
    const next = invitePet(home, id)
    expect(atHome(next)).toContain(id)
    expect(next.visitors).toEqual(home.visitors)
    expect(next.pets[id]!.caredDays).toHaveLength(0)
    const unknown = PET_IDS.find(pet => !next.pets[pet])!
    expect(invitePet(next, unknown)).toBe(next)
  })
  it('persists bedtime without guessing sleep, and counts one bedtime preparation per date', () => {
    const first = createHome(day, 101)
    const night = sleepTogether(first, day)
    const reloaded = parseHome(JSON.stringify(night))!
    expect(reloaded.sleeping?.pets).toEqual(atHome(first))
    expect(refreshVisitors(reloaded, dateAt(1))).toBe(reloaded)
    expect(careFor(night, first.selected, 'play', day)).toBe(night)
    const again = restAgain(wakeTogether(night, day))
    expect(again.pets[first.selected]!.actions.bed).toEqual([day])
    expect(again).not.toHaveProperty('sleepH')
  })
  it('migrates existing saves and keeps the same companions through a persisted morning', () => {
    const oldHome = createHome(day, 123)
    const { morning: _morning, ...oldFormat } = sleepTogether(oldHome, day)
    const night = parseHome(JSON.stringify(oldFormat))!
    expect(night.morning).toBeNull()
    const morning = wakeTogether(night, dateAt(1))
    const reloaded = parseHome(JSON.stringify(morning))!
    expect(reloaded.selected).toBe(night.selected)
    expect(reloaded.morning?.pets).toEqual(night.sleeping?.pets)
    expect(reloaded.pets).toEqual(night.pets)
    expect(refreshVisitors(reloaded, dateAt(2))).toBe(reloaded)
    expect(careFor(reloaded, reloaded.selected, 'feed', dateAt(1))).toBe(reloaded)
    expect(sleepTogether(reloaded, dateAt(1))).toBe(reloaded)
    const resting = restAgain(reloaded)
    expect(resting.sleeping).toEqual(night.sleeping)
    expect(resting.pets).toEqual(night.pets)
    const daytime = finishMorning(reloaded, dateAt(1))
    expect(daytime.morning).toBeNull()
    expect(daytime.visitors).not.toContain(night.selected)
    expect(daytime.selected).toBe(night.selected)
    expect(atHome(daytime)).toContain(night.selected)
    expect(daytime.pets[night.selected]).toEqual(night.pets[night.selected])
  })
  it('earns memory cards from real actions and distinct care days after adoption, allowing breaks', () => {
    let home = createHome(day, 7)
    const id = home.selected
    for (const action of ['pet', 'feed', 'play', 'bed'] as const) home = careFor(home, id, action, day)
    const firstCards = memoriesFor(id, home.pets[id]!)
    expect(firstCards.map(card => card.key)).toEqual(['met', 'pet', 'feed', 'play', 'bed'])
    expect(firstCards.every(card => card.date === day)).toBe(true)
    // Previous care must not be counted again as post-adoption care.
    home.pets[id]!.adoptedOn = dateAt(1)
    home = careFor(home, id, 'pet', dateAt(1))
    expect(nextMemory(home.pets[id]!)).toEqual({ done: 0, target: 7 })
    for (let i = 0; i < 6; i++) home = careFor(home, id, 'pet', dateAt(2 + i * 2))
    expect(nextMemory(home.pets[id]!)).toEqual({ done: 6, target: 7 })
    home = careFor(home, id, 'feed', dateAt(12))
    expect(nextMemory(home.pets[id]!)).toEqual({ done: 6, target: 7 })
    home = careFor(home, id, 'pet', dateAt(14))
    const before = JSON.stringify(home)
    const cards = memoriesFor(id, home.pets[id]!)
    expect(cards.find(card => card.key === 'family-7')?.date).toBe(dateAt(14))
    expect(cards.some(card => card.key === 'family-30')).toBe(false)
    expect(nextMemory(home.pets[id]!)).toEqual({ done: 7, target: 30 })
    expect(JSON.stringify(home)).toBe(before)
  })
  it('rejects corrupt saves, stale writes and quota errors without replacing the saved home', () => {
    const store = storage()
    const first = createHome(day, 22)
    const saved = persistHome(store, 'guest', first, null)
    if (!saved.ok) throw Error('fixture failed')
    const before = store.getItem(petHomeKey('guest'))
    expect(persistHome(store, 'guest', first, null).ok).toBe(false)
    expect(persistHome({ getItem: store.getItem, setItem: () => { throw Error('quota') } }, 'guest', first, before).ok).toBe(false)
    expect(store.getItem(petHomeKey('guest'))).toBe(before)
    store.setItem(petHomeKey('guest'), '{broken')
    expect(loadHome(store, 'guest', day, 2).error).not.toBeNull()
    expect(store.getItem(petHomeKey('guest'))).toBe('{broken')
    expect(persistHome(store, 'guest', first, '{broken').ok).toBe(false)
    const invalid = { ...first, pets: {} } as PetHome
    expect(parseHome(JSON.stringify(invalid))).toBeNull()
    expect(persistHome(store, 'guest', invalid, '{broken').ok).toBe(false)
  })
  it('keeps guest and account homes separate', () => {
    const store = storage()
    const guest = createHome(day, 33)
    expect(persistHome(store, 'guest', careFor(guest, guest.selected, 'feed', day), null).ok).toBe(true)
    const account = loadHome(store, 'account-a', day, 99)
    expect(account.raw).toBeNull()
    expect(Object.values(account.home.pets).every(pet => pet!.caredDays.length === 0)).toBe(true)
  })
})
