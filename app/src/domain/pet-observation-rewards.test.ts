import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setActiveLocalAccount } from './account/local-journal-ownership'
import { createHome, legacyPetHomeKey, petHomeKey, sleepTogether, wakeTogether, type PetHome } from '../screens/pet-room/pet-engine'
import { activeObservationNight, photographObservation, placeObservationItem } from '../screens/pet-room/pet-observation'
import { readPetObservationRewardScenes } from './pet-observation-rewards'
import { PET_OBSERVATIONS_V1, PET_OBSERVATION_STICKERS } from './pet-observation-collection'
import { acquisitionCost, REWARD_RULES } from './decoration-collections'
import { createEmptyDecorationState, decorationStateSchema } from './decoration-schema'
import { claimRewardDecorations, loadDecorationState, purchaseDecoration } from './decoration-store'
import { appendJournalDecoration, journalDecorationItems } from './journal-decoration-state'

const day = '2026-10-26'
function readyHome(scope = 'guest'): PetHome {
  const initial = createHome(day, 131, scope)
  const home = { ...initial, selected: 'otter' as const, visitors: ['otter' as const], pets: { otter: initial.pets[initial.selected]! } }
  return placeObservationItem(home, 'window', null)
}
function photoHome(scope = 'guest'): PetHome {
  const morning = wakeTogether(sleepTogether(readyHome(scope), day, day), day)
  return photographObservation(morning, activeObservationNight(morning)!.results[0]!.id)
}
beforeEach(() => { localStorage.clear(); setActiveLocalAccount(null) })
afterEach(() => { setActiveLocalAccount(null); vi.restoreAllMocks(); localStorage.clear() })

describe('confirmed pet photo to journal sticker', () => {
  it('requires a revealed scene and an explicit confirmed photo, without initializing old or missing homes', () => {
    localStorage.setItem(legacyPetHomeKey('guest'), '{legacy stays unchanged}')
    const writes = vi.spyOn(Storage.prototype, 'setItem')
    expect(readPetObservationRewardScenes({ today: day })).toEqual([])
    expect(writes).not.toHaveBeenCalled()
    const { observation: _observation, ...old } = readyHome()
    expect(readPetObservationRewardScenes({ today: day, storage: { getItem: () => JSON.stringify(old) } })).toEqual([])
    const night = sleepTogether(readyHome(), day, day)
    expect(readPetObservationRewardScenes({ today: day, storage: { getItem: () => JSON.stringify(night) } })).toEqual([])
    const morning = wakeTogether(night, day)
    expect(readPetObservationRewardScenes({ today: day, storage: { getItem: () => JSON.stringify(morning) } })).toEqual([])
    expect(readPetObservationRewardScenes({ today: day, storage: { getItem: () => JSON.stringify(photoHome()) } })).toEqual(['otter-ball'])
    expect(writes).not.toHaveBeenCalled()
    expect(localStorage.getItem(petHomeKey('guest'))).toBeNull()
  })

  it('reads only the active owner and rejects owner mismatch, account switches and future photos', () => {
    localStorage.setItem(petHomeKey('guest'), JSON.stringify(photoHome()))
    setActiveLocalAccount('account-a')
    expect(readPetObservationRewardScenes({ today: day })).toEqual([])
    const keys: string[] = []
    expect(readPetObservationRewardScenes({ today: day, storage: { getItem: key => { keys.push(key); return JSON.stringify(photoHome()) } } })).toEqual([])
    expect(keys).toEqual([petHomeKey('account-a')])
    const own = JSON.stringify(photoHome('account-a'))
    expect(readPetObservationRewardScenes({ today: day, storage: { getItem: () => own } })).toEqual(['otter-ball'])
    expect(readPetObservationRewardScenes({ today: day, storage: { getItem: () => { setActiveLocalAccount('account-b'); setActiveLocalAccount('account-a'); return own } } })).toEqual([])
    expect(readPetObservationRewardScenes({ today: '2026-10-25', storage: { getItem: () => own } })).toEqual([])
  })

  it('returns no evidence for corrupted saves or unavailable storage and does not rewrite them', () => {
    const bad = '{not-json'
    localStorage.setItem(petHomeKey('guest'), bad)
    expect(readPetObservationRewardScenes({ today: day })).toEqual([])
    expect(localStorage.getItem(petHomeKey('guest'))).toBe(bad)
    expect(readPetObservationRewardScenes({ today: day, storage: { getItem: () => { throw Error('denied') } } })).toEqual([])
    const invented = photoHome()
    invented.observation.photos.push('2026-10-26:missing')
    expect(readPetObservationRewardScenes({ today: day, storage: { getItem: () => JSON.stringify(invented) } })).toEqual([])
  })

  it('each scene unlocks only its own sticker without journal, visit or sleep requirements', () => {
    for (const sticker of PET_OBSERVATION_STICKERS) {
      const rules = REWARD_RULES.filter(rule => rule.id.startsWith('PET_PHOTO_'))
      expect(rules.filter(rule => rule.satisfied({ journalDays: 0, visitDays: 0, petObservationScenes: [sticker.sceneId] })).map(rule => rule.id)).toEqual([sticker.ruleId])
      expect(rules.some(rule => rule.satisfied({ journalDays: 999, visitDays: 999 }))).toBe(false)
    }
    expect(PET_OBSERVATIONS_V1.items).toHaveLength(12)
    expect(PET_OBSERVATIONS_V1.items.every(item => acquisitionCost(item.acquisition) === 0)).toBe(true)
  })

  it('claims the exact photo once at zero points, survives reload and can actually be placed in a journal', () => {
    localStorage.setItem(petHomeKey('guest'), JSON.stringify(photoHome()))
    const signals = { journalDays: 0, visitDays: 0, petObservationScenes: readPetObservationRewardScenes({ today: day }) }
    const empty = createEmptyDecorationState()
    expect(empty.ownedItemIds).not.toContain('PET_NIGHT_OTTER_BALL')
    const claim = claimRewardDecorations(empty, signals, day, null)
    expect(claim.kind).toBe('CLAIMED')
    if (claim.kind !== 'CLAIMED') throw Error(claim.kind)
    expect(claim.items.map(item => item.id)).toEqual(['PET_NIGHT_OTTER_BALL'])
    expect(claim.state.spentPoints).toBe(0)
    const restored = decorationStateSchema.parse(loadDecorationState())
    expect(restored.ownedItemIds).toContain('PET_NIGHT_OTTER_BALL')
    expect(claimRewardDecorations(restored, signals, day).kind).toBe('NOTHING_TO_CLAIM')
    const decorated = appendJournalDecoration(restored, day, 'PET_NIGHT_OTTER_BALL')
    expect(decorated).not.toBeNull()
    expect(journalDecorationItems(decorated!, day).some(item => item.itemId === 'PET_NIGHT_OTTER_BALL')).toBe(true)
    expect(decorated!.spentPoints).toBe(0)
    expect(purchaseDecoration(1000, empty, 'PET_NIGHT_OTTER_BALL').kind).toBe('NOT_PURCHASABLE')
  })
})
