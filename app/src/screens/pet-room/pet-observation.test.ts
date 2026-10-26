import { describe, expect, it } from 'vitest'
import { PET_IDS, type PetId } from './pet-catalog'
import { createHome, finishMorning, loadHome, parseHome, persistHome, petHomeKey, restAgain, sleepTogether, wakeTogether, type PetHome } from './pet-engine'
import { OBSERVATION_ITEMS, OBSERVATION_SCENES, activeObservationNight, bedtimeDays, defaultObservationWakeDate, isObservationItemUnlocked, observationPreference, observationSlotCount, observationUseChance, observedItemStats, photographObservation, placeObservationItem } from './pet-observation'

const day = '2026-10-26'
const tomorrow = '2026-10-27'
const dateAt = (offset: number) => new Date(Date.UTC(2026, 9, 26 + offset)).toISOString().slice(0, 10)
function homeWith(ids: PetId[], seed = 131): PetHome {
  const home = createHome(day, seed)
  const bond = home.pets[home.selected]!
  return { ...home, selected: ids[0]!, visitors: ids.slice(0, 3), pets: Object.fromEntries(ids.map(id => [id, { ...structuredClone(bond), adoptedOn: day }])), invited: null }
}
function bedCredits(home: PetHome, count: number): PetHome {
  const dates = Array.from({ length: count }, (_, i) => dateAt(-count + i))
  return { ...home, pets: Object.fromEntries(Object.entries(home.pets).map(([id, pet]) => [id, { ...pet!, actions: { ...pet!.actions, bed: dates }, caredDays: dates }])) }
}
function store() {
  const values = new Map<string, string>()
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, raw: string) => { values.set(key, raw) } }
}

describe('nightly pet observation', () => {
  it('adds empty observation state to old v2 homes without inventing past discoveries', () => {
    const home = bedCredits(homeWith(['otter', 'seal']), 14)
    const { observation: _observation, ...old } = home
    const loaded = parseHome(JSON.stringify(old))!
    expect(loaded.pets).toEqual(home.pets)
    expect(loaded.observation.nights).toEqual([])
    expect(loaded.observation.photos).toEqual([])
    expect(bedtimeDays(loaded)).toBe(14)
    expect(isObservationItemUnlocked(loaded, 'tent')).toBe(true)
  })

  it('unlocks items and the third place from distinct bedtime days, not pet count or streaks', () => {
    const home = homeWith(['otter', 'seal', 'puppy'])
    expect(OBSERVATION_ITEMS.filter(item => isObservationItemUnlocked(home, item.id)).map(item => item.id)).toEqual(['ball', 'box', 'cushion'])
    expect(isObservationItemUnlocked(bedCredits(home, 2), 'plush')).toBe(false)
    expect(isObservationItemUnlocked(bedCredits(home, 3), 'plush')).toBe(true)
    expect(observationSlotCount(bedCredits(home, 6))).toBe(2)
    expect(observationSlotCount(bedCredits(home, 7))).toBe(3)
    expect(isObservationItemUnlocked(bedCredits(home, 13), 'tent')).toBe(false)
    expect(bedtimeDays(bedCredits(home, 14))).toBe(14)
  })

  it('moves a single object, refuses locked objects and prevents changing the committed night', () => {
    const home = homeWith(['otter'])
    expect(placeObservationItem(home, 'corner', 'ball')).toBe(home)
    expect(placeObservationItem(home, 'bedside', 'tent')).toBe(home)
    const moved = placeObservationItem(home, 'window', 'ball')
    expect(moved.observation.placements).toEqual({ bedside: null, window: 'ball', corner: null })
    const night = sleepTogether(moved, day, tomorrow)
    expect(placeObservationItem(night, 'bedside', 'box')).toBe(night)
    expect(activeObservationNight(night)!.placements).toEqual(moved.observation.placements)
  })

  it('freezes the selected pet and results through save/reload, date gating, and resting again', () => {
    const home = homeWith(['otter', 'seal', 'puppy', 'rabbit', 'cat'])
    const night = sleepTogether(home, day, tomorrow)
    expect(activeObservationNight(night)!.roster).toHaveLength(3)
    expect(activeObservationNight(night)!.roster).toContain(home.selected)
    expect(activeObservationNight(night)!.results.some(result => result.petIds.includes(home.selected) && result.status === 'used')).toBe(true)
    expect(wakeTogether(night, day)).toBe(night)
    expect(sleepTogether(night, day, dateAt(2))).toBe(night)
    const loaded = parseHome(JSON.stringify(night))!
    expect(activeObservationNight(loaded)).toEqual(activeObservationNight(night))
    const morning = wakeTogether(loaded, tomorrow)
    expect(activeObservationNight(morning)!.observedOn).toBe(tomorrow)
    expect(activeObservationNight(restAgain(morning))).toEqual(activeObservationNight(morning))
    const finished = finishMorning(morning, tomorrow)
    expect(sleepTogether(finished, tomorrow, tomorrow)).toBe(finished)
    expect(activeObservationNight(finished)!.results).toEqual(activeObservationNight(night)!.results)
  })

  it('keeps unopened nights without manufacturing results for missed dates', () => {
    const night = sleepTogether(homeWith(['otter']), day, tomorrow)
    const morning = wakeTogether(night, dateAt(5))
    expect(morning.observation.nights).toHaveLength(1)
    expect(activeObservationNight(morning)!.wakeDate).toBe(tomorrow)
    expect(activeObservationNight(morning)!.observedOn).toBe(dateAt(5))
  })

  it('provides stable preferences for all 48 pets and uses the approved game-only chances', () => {
    for (const id of PET_IDS) {
      expect(observationPreference(id).liked.length).toBeGreaterThan(0)
      for (const item of OBSERVATION_ITEMS) expect(observationUseChance(id, item.id, 'window')).toBeLessThanOrEqual(.8)
    }
    expect(observationUseChance('otter', 'ball', 'window')).toBe(.65)
    expect(observationUseChance('otter', 'ball', 'bedside')).toBe(.75)
    expect(observationUseChance('otter', 'box', 'window')).toBe(.35)
    expect(observationUseChance('otter', 'tent', 'window')).toBe(.1)
  })

  it('allows all objects to be ignored after the first night and reports observations rather than dislike', () => {
    let ignored: PetHome | undefined
    for (let seed = 1; seed <= 200 && !ignored; seed++) {
      let home = homeWith(['otter'], seed)
      home = placeObservationItem(home, 'window', null)
      home = finishMorning(wakeTogether(sleepTogether(home, day, day), day), day)
      home = wakeTogether(sleepTogether(home, tomorrow, tomorrow), tomorrow)
      if (activeObservationNight(home)!.results.every(result => result.status === 'untouched')) ignored = home
    }
    expect(ignored).toBeDefined()
    expect(observedItemStats(ignored!, 'otter', 'ball')).toMatchObject({ offered: 2, used: 1 })
    expect(activeObservationNight(ignored!)!.results[0]!.description).toContain('그대로')
    expect(activeObservationNight(ignored!)!.results[0]!.description).not.toContain('싫어')
  })

  it('never allocates the same pet or object twice and never grants rare results before two observed uses', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const home = bedCredits(homeWith(['otter', 'seal', 'rabbit'], seed), 14)
      const placed = placeObservationItem(placeObservationItem(home, 'window', 'large-blanket'), 'corner', 'cushion')
      const night = activeObservationNight(sleepTogether(placed, day, tomorrow))!
      const pets = night.results.flatMap(result => result.petIds)
      expect(new Set(pets).size).toBe(pets.length)
      expect(new Set(night.results.map(result => result.itemId)).size).toBe(night.results.length)
      expect(night.results.every(result => !OBSERVATION_SCENES.some(scene => scene.id === result.sceneId && scene.rarity === 'rare'))).toBe(true)
      expect(parseHome(JSON.stringify(sleepTogether(placed, day, tomorrow)))).not.toBeNull()
    }
  })

  it('lets a real partner share one rare scene after prior use, consuming both pets and one object', () => {
    let pair: PetHome | undefined
    let home = placeObservationItem(homeWith(['otter', 'seal'], 771), 'window', null)
    for (let i = 0; i < 260 && !pair; i++) {
      const today = dateAt(i)
      home = wakeTogether(sleepTogether(home, today, today), today)
      if (activeObservationNight(home)?.results.some(result => result.sceneId === 'otter-seal-ball')) pair = home
      home = finishMorning(home, today)
    }
    expect(pair).toBeDefined()
    const result = activeObservationNight(pair!)!.results.find(result => result.sceneId === 'otter-seal-ball')!
    expect(result.petIds).toEqual(['otter', 'seal'])
    expect(activeObservationNight(pair!)!.results).toHaveLength(1)
    expect(parseHome(JSON.stringify(pair))).not.toBeNull()
  })

  it('saves photos only for revealed used results and keeps automatic discoveries separate', () => {
    const night = sleepTogether(homeWith(['otter']), day, tomorrow)
    const result = activeObservationNight(night)!.results.find(result => result.status === 'used')!
    expect(photographObservation(night, result.id)).toBe(night)
    const morning = wakeTogether(night, tomorrow)
    expect(morning.observation.photos).toEqual([])
    const photo = photographObservation(morning, result.id)
    expect(photo.observation.photos).toEqual([result.id])
    expect(photographObservation(photo, result.id)).toBe(photo)
    expect(photographObservation(photo, 'unknown')).toBe(photo)
    expect(parseHome(JSON.stringify(photo))).not.toBeNull()
  })

  it('rejects corrupt scene references, duplicate allocations and invented photos', () => {
    const home = wakeTogether(sleepTogether(homeWith(['otter']), day, tomorrow), tomorrow)
    const damaged = structuredClone(home)
    damaged.observation.nights[0]!.results[0]!.petIds = ['otter', 'otter']
    expect(parseHome(JSON.stringify(damaged))).toBeNull()
    const unknown = structuredClone(home)
    unknown.observation.nights[0]!.results[0]!.sceneId = 'not-a-scene'
    expect(parseHome(JSON.stringify(unknown))).toBeNull()
    expect(parseHome(JSON.stringify({ ...home, observation: { ...home.observation, photos: ['unknown'] } }))).toBeNull()
  })

  it('uses the existing scoped compare-and-save boundary, retaining stored data on failure', () => {
    const storage = store()
    const initial = homeWith(['otter'])
    const saved = persistHome(storage, 'guest', initial, null)
    if (!saved.ok) throw Error('fixture failed')
    const night = sleepTogether(saved.home, day, tomorrow)
    expect(persistHome(storage, 'guest', night, null).ok).toBe(false)
    expect(persistHome({ getItem: storage.getItem, setItem: () => { throw Error('quota') } }, 'guest', night, saved.raw).ok).toBe(false)
    expect(storage.getItem(petHomeKey('guest'))).toBe(saved.raw)
    const committed = persistHome(storage, 'guest', night, saved.raw)
    expect(committed.ok).toBe(true)
    expect(loadHome(storage, 'account-other', day, 22).home.observation.nights).toEqual([])
  })

  it('chooses a suggested date from local time while leaving explicit dates user-controlled', () => {
    expect(defaultObservationWakeDate(new Date(2026, 9, 26, 17, 59))).toBe(day)
    expect(defaultObservationWakeDate(new Date(2026, 9, 26, 18, 0))).toBe(tomorrow)
    expect(defaultObservationWakeDate(new Date(2026, 9, 27, 1, 0))).toBe(tomorrow)
    const home = homeWith(['otter'])
    expect(sleepTogether(home, day, '2026-10-25')).toBe(home)
    expect(sleepTogether(home, day, '2026-02-30')).toBe(home)
  })
})
