import { describe, expect, it } from 'vitest'
import { LEGACY_PET_IDS, PET_IDS, PETS, POSE_FRAME, petAsset } from './pet-catalog'
import { PET_VOICES } from './pet-personality'
import { PET_STORIES } from './pet-story'
import { PET_PLAY } from './pet-play'
import { adoptJournalFriend, adoptPet, careDay, confirmJournalDay, createHome, journalFriendCredits, legacyPetHomeKey, loadHome, parseHome, persistHome, petHomeKey, proposeJournalFriend, sleepTogether, wakeTogether, type PetHome } from './pet-engine'

const day = '2026-10-19'
const at = (n: number) => careDay(new Date(2026, 9, 19 + n))
function storage() {
  const values = new Map<string, string>()
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value) } }
}
function earned(days = 7): PetHome {
  let home = createHome(day, 72)
  for (let i = 0; i < days; i++) home = confirmJournalDay(home, { date: at(i * 2), kind: ['post-session', 'evening', 'race'][i % 3]! }, at(i * 2))
  return home
}
function legacyRaw() {
  // Freeze the v1 wire format: deriving it from createHome leaks future v2 fields
  // into the strict legacy reader and stops testing real older saved records.
  return JSON.stringify({ version: 1, revision: 0, seed: 72, day,
    visitors: ['otter'], invited: null, selected: 'otter',
    pets: { otter: { metOn: day, caredDays: [day], actions: { pet: [day], feed: [], play: [], bed: [] }, adoptedOn: day } },
    sleeping: null, morning: null })
}
describe('journal day friend opportunities', () => {
  it('earns one opportunity at seven nonconsecutive saved calendar days, equally for every journal kind', () => {
    expect(journalFriendCredits(earned(6))).toBe(0)
    const home = earned()
    expect(journalFriendCredits(home)).toBe(1)
    expect(confirmJournalDay(home, { date: at(12), kind: 'race' }, at(12))).toBe(home)
    expect(journalFriendCredits(earned(14))).toBe(2)
  })
  it('rejects future, backdated, unknown, draft and opened-calendar input and a clock behind the home', () => {
    const home = createHome(day, 73)
    for (const ref of [{ date: at(1), kind: 'evening' }, { date: at(-1), kind: 'post-session' }, { date: day, kind: 'draft' }, { date: day, kind: 'calendar' }]) expect(confirmJournalDay(home, ref, day)).toBe(home)
    expect(confirmJournalDay(home, { date: at(-1), kind: 'evening' }, at(-1))).toBe(home)
    const last = confirmJournalDay(home, { date: at(2), kind: 'evening' }, at(2))
    expect(confirmJournalDay(last, { date: at(1), kind: 'race' }, at(1))).toBe(last)
  })
  it('never reads raw notes, pain, volume, outcomes or pace, and repeated edits/recreation count once', () => {
    const input = { date: day, kind: 'post-session', activityOutcome: 'RESTED', get memo() { throw Error('private') }, get painParts() { throw Error('health') }, get distanceKm() { throw Error('volume') } }
    const once = confirmJournalDay(createHome(day, 4), input, day)
    expect(once.journal.days).toEqual([day])
    expect(confirmJournalDay(once, { date: day, kind: 'evening' }, day)).toBe(once)
  })
  it('persists a stable random proposal without consuming credit and confirms ownership with credit together', () => {
    const store = storage()
    const proposal = proposeJournalFriend(earned())
    const id = proposal.journal.pending!.id
    expect(journalFriendCredits(proposal)).toBe(1)
    expect(proposeJournalFriend(proposal)).toBe(proposal)
    expect(proposal.pets[id]?.adoptedOn).toBeFalsy()
    const saved = persistHome(store, 'guest', proposal, null)
    if (!saved.ok) throw Error('fixture')
    const reloaded = loadHome(store, 'guest', at(12), 999)
    expect(reloaded.home.journal.pending).toEqual(proposal.journal.pending)
    const adopted = adoptJournalFriend(reloaded.home, id, at(12))
    const confirmed = persistHome(store, 'guest', adopted, reloaded.raw)
    expect(confirmed.ok).toBe(true)
    const result = loadHome(store, 'guest', at(20), 1).home
    expect(result.pets[id]?.adoptedOn).toBe(at(12))
    expect(journalFriendCredits(result)).toBe(0)
    expect(adoptJournalFriend(result, id, at(20))).toBe(result)
    expect(result.journal.pending).toBeNull()
  })
  it('persists a different direct choice once, clears the used proposal and preserves any remaining credit', () => {
    for (const days of [7, 14]) {
      const store = storage()
      const pending = proposeJournalFriend(earned(days))
      const id = PET_IDS.find(value => value !== pending.journal.pending!.id)!
      const saved = persistHome(store, 'guest', pending, null)
      if (!saved.ok) throw Error('fixture')
      expect(journalFriendCredits(saved.home)).toBe(days / 7)
      const adopted = adoptJournalFriend(saved.home, id, at(26))
      expect(persistHome(store, 'guest', adopted, saved.raw).ok).toBe(true)
      const reloaded = loadHome(store, 'guest', at(26), 1)
      expect(reloaded.error).toBeNull()
      expect(reloaded.home.pets[id]?.adoptedOn).toBe(at(26))
      expect(reloaded.home.journal.pending).toBeNull()
      expect(journalFriendCredits(reloaded.home)).toBe(days / 7 - 1)
      expect(adoptJournalFriend(reloaded.home, id, at(26))).toBe(reloaded.home)
    }
  })
  it('clears a proposed friend adopted through care without consuming the journal opportunity', () => {
    let home = proposeJournalFriend(earned())
    const id = home.journal.pending!.id
    home.pets[id] = { metOn: day, caredDays: Array.from({ length: 30 }, (_, i) => at(i)), actions: { pet: [], feed: [], play: [], bed: [] }, adoptedOn: null }
    home = adoptPet(home, id, at(30))
    expect(home.journal.pending).toBeNull()
    expect(journalFriendCredits(home)).toBe(1)
    const different = PET_IDS.find(value => value !== id)!
    expect(adoptJournalFriend(home, different, at(30)).pets[different]?.adoptedOn).toBe(at(30))
  })
  it('keeps unused opportunities when all forty-eight are owned and supports their full bedtime handoff', () => {
    let home = earned()
    for (const id of PET_IDS) home.pets[id] = { metOn: day, caredDays: [], actions: { pet: [], feed: [], play: [], bed: [] }, adoptedOn: day }
    expect(proposeJournalFriend(home)).toBe(home)
    expect(journalFriendCredits(home)).toBe(1)
    home = sleepTogether(home, at(12))
    expect(parseHome(JSON.stringify(home))?.sleeping?.pets).toHaveLength(48)
    expect(parseHome(JSON.stringify(wakeTogether(home, at(13))))?.morning?.pets).toHaveLength(48)
  })
})
describe('authoritative v2 home and preservation', () => {
  it('migrates strict twelve-pet v1 bytes once and never remerges later old-client writes', () => {
    const store = storage(); const source = legacyRaw()
    store.setItem(legacyPetHomeKey('guest'), source)
    const loaded = loadHome(store, 'guest', day, 1)
    expect(loaded.error).toBeNull()
    expect(loaded.home.version).toBe(2)
    expect(loaded.home.pets.otter?.adoptedOn).toBe(day)
    expect(loaded.home.journal.days).toEqual([])
    expect(loaded.home.roomDecoration).toBeNull()
    expect(store.getItem(legacyPetHomeKey('guest'))).toBe(source)
    store.setItem(legacyPetHomeKey('guest'), '{old-client-now-broken')
    expect(loadHome(store, 'guest', day, 3)).toEqual(loaded)
  })
  it('fails closed for malformed v2, wrong owner, malformed legacy, quota and failed migration readback', () => {
    const store = storage(); store.setItem(legacyPetHomeKey('guest'), legacyRaw())
    store.setItem(petHomeKey('guest'), '{broken-v2')
    expect(loadHome(store, 'guest', day, 1).error).not.toBeNull()
    expect(store.getItem(petHomeKey('guest'))).toBe('{broken-v2')
    const wrong = JSON.stringify(createHome(day, 1, 'account-a'))
    store.setItem(petHomeKey('guest'), wrong)
    expect(loadHome(store, 'guest', day, 1).error).not.toBeNull()
    const legacy = storage(); legacy.setItem(legacyPetHomeKey('guest'), legacyRaw())
    const quota = { getItem: legacy.getItem, setItem: () => { throw Error('quota') } }
    expect(loadHome(quota, 'guest', day, 1).error).not.toBeNull()
    expect(legacy.getItem(petHomeKey('guest'))).toBeNull()
    expect(loadHome({ getItem: legacy.getItem, setItem: () => undefined }, 'guest', day, 1).error).not.toBeNull()
    legacy.setItem(legacyPetHomeKey('guest'), '{broken')
    expect(loadHome(legacy, 'guest', day, 1).error).not.toBeNull()
  })
  it('does not consume on a stale-tab, quota, ignored write or cross-owner persistence attempt', () => {
    const store = storage(); const saved = persistHome(store, 'guest', earned(), null)
    if (!saved.ok) throw Error('fixture')
    const next = adoptJournalFriend(saved.home, 'cat', at(12))
    expect(persistHome(store, 'guest', next, null).ok).toBe(false)
    expect(persistHome({ getItem: store.getItem, setItem: () => { throw Error('quota') } }, 'guest', next, saved.raw).ok).toBe(false)
    expect(persistHome({ getItem: store.getItem, setItem: () => undefined }, 'guest', next, saved.raw).ok).toBe(false)
    expect(persistHome(store, 'account-b', next, null).ok).toBe(false)
    expect(loadHome(store, 'guest', at(12), 1).home).toEqual(saved.home)
  })
  it('does not migrate or claim from a home dated ahead of the current device day', () => {
    const legacy = storage(); const before = legacyRaw()
    legacy.setItem(legacyPetHomeKey('guest'), before)
    expect(loadHome(legacy, 'guest', at(-1), 1).error).toContain('날짜')
    expect(legacy.getItem(petHomeKey('guest'))).toBeNull()
    expect(legacy.getItem(legacyPetHomeKey('guest'))).toBe(before)
    const store = storage(); store.setItem(petHomeKey('guest'), JSON.stringify(earned()))
    expect(loadHome(store, 'guest', day, 1).error).toContain('날짜')
  })
  it('rejects invalid claim ledgers and legacy states that could not have existed in v1', () => {
    const home = earned()
    expect(parseHome(JSON.stringify({ ...home, journal: { ...home.journal, claimed: 2 } }))).toBeNull()
    expect(parseHome(JSON.stringify({ ...home, journal: { ...home.journal, pending: { id: 'cat', ordinal: 2 } } }))).toBeNull()
    const legacy = storage(); legacy.setItem(legacyPetHomeKey('guest'), legacyRaw().replaceAll('otter', 'cat'))
    expect(loadHome(legacy, 'guest', day, 1).error).not.toBeNull()
  })
})
it('offers forty-eight unique authored friends, all six poses and unchanged legacy asset paths', () => {
  expect(PET_IDS).toHaveLength(48)
  expect(new Set(PETS.map(pet => pet.id)).size).toBe(48)
  expect(new Set(PETS.map(pet => pet.name)).size).toBe(48)
  expect(Object.values(POSE_FRAME)).toEqual([0, 1, 2, 3, 4, 5])
  for (const id of PET_IDS) {
    expect(PET_VOICES[id].wake.length).toBeGreaterThan(5)
    expect(PET_STORIES[id].family[1].length).toBeGreaterThan(10)
    expect(PET_PLAY[id].petting.length).toBeGreaterThan(5)
    const folder = (LEGACY_PET_IDS as readonly string[]).includes(id) ? 'pet-room-v1' : 'pet-friends-v2'
    expect(petAsset(id)).toBe(`/games/${folder}/pets/${id}.webp`)
  }
})
