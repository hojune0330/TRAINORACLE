import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { setActiveLocalAccount } from './account/local-journal-ownership'
import { capturePetJournalScope, pendingPetJournalError, readPetJournalProgress, recordConfirmedPetJournalSave, retryPetJournalSave } from './pet-journal-progress'
import { careDay, createHome, legacyPetHomeKey, loadHome, petHomeKey, sleepTogether } from '../screens/pet-room/pet-engine'
import { petLockFixture } from '../test/pet-lock-fixture'

beforeEach(() => {
  localStorage.clear(); setActiveLocalAccount(null)
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(2026, 9, 19, 12))
  vi.stubGlobal('navigator', { locks: petLockFixture().manager })
})
afterEach(() => { setActiveLocalAccount(null); vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks() })
const ref = () => ({ date: careDay(), kind: 'evening' })
it('accepts only a confirmed receipt for the current owner, including after an A to B to A switch', async () => {
  setActiveLocalAccount('owner-a')
  const a = capturePetJournalScope()
  setActiveLocalAccount('owner-b')
  expect(await recordConfirmedPetJournalSave(ref(), a)).toBe('STALE')
  setActiveLocalAccount('owner-a')
  expect(await recordConfirmedPetJournalSave(ref(), a)).toBe('STALE')
  expect(localStorage.getItem(petHomeKey('owner-a'))).toBeNull()
  expect(await recordConfirmedPetJournalSave(ref(), capturePetJournalScope())).toBe('RECORDED')
  expect(loadHome(localStorage, 'owner-a', careDay(), 1).home.journal.days).toEqual([careDay()])
  expect(localStorage.getItem(petHomeKey('owner-b'))).toBeNull()
})
it('does not credit an owner change while waiting to acquire the browser lease', async () => {
  let grant: (() => void) | undefined
  vi.stubGlobal('navigator', { locks: { request: (_name: string, _options: LockOptions, callback: (lock: Lock) => Promise<void>) => new Promise<void>(resolve => {
    grant = () => { void callback({ name: 'fixture', mode: 'exclusive' } as Lock).then(resolve) }
  }) } })
  setActiveLocalAccount('wait-a')
  const result = recordConfirmedPetJournalSave(ref(), capturePetJournalScope())
  setActiveLocalAccount('wait-b')
  grant!()
  expect(await result).toBe('STALE')
  expect(localStorage.getItem(petHomeKey('wait-a'))).toBeNull()
  expect(localStorage.getItem(petHomeKey('wait-b'))).toBeNull()
})
it('keeps the confirmed save day when the browser grants its lock just after midnight', async () => {
  let grant: (() => void) | undefined
  vi.stubGlobal('navigator', { locks: { request: (_name: string, _options: LockOptions, callback: (lock: Lock) => Promise<void>) => new Promise<void>(resolve => {
    grant = () => { void callback({ name: 'midnight', mode: 'exclusive' } as Lock).then(resolve) }
  }) } })
  vi.setSystemTime(new Date(2026, 9, 19, 23, 59, 59))
  const result = recordConfirmedPetJournalSave(ref(), capturePetJournalScope())
  vi.setSystemTime(new Date(2026, 9, 20, 0, 0, 1))
  grant!()
  expect(await result).toBe('RECORDED')
  expect(loadHome(localStorage, 'guest', careDay(), 1).home.journal.days).toEqual(['2026-10-19'])
})
it('retains a failed confirmed date for explicit same-day retry and never throws into the journal save continuation', async () => {
  const fail = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw Error('quota') })
  expect(await recordConfirmedPetJournalSave(ref(), capturePetJournalScope())).toBe('UNAVAILABLE')
  expect(pendingPetJournalError('guest')).toContain('일지는 저장됐지만')
  expect(localStorage.getItem(petHomeKey('guest'))).toBeNull()
  fail.mockRestore()
  expect(await retryPetJournalSave('guest')).toBe(true)
  expect(pendingPetJournalError('guest')).toBeNull()
  expect(loadHome(localStorage, 'guest', careDay(), 1).home.journal.days).toHaveLength(1)
  expect(await recordConfirmedPetJournalSave(ref(), capturePetJournalScope())).toBe('UNCHANGED')
})
it('expires a stale failed receipt after midnight or a scope generation change, without a backdated credit', async () => {
  const fail = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw Error('quota') })
  await recordConfirmedPetJournalSave(ref(), capturePetJournalScope())
  vi.setSystemTime(new Date(2026, 9, 20, 12))
  expect(pendingPetJournalError('guest')).toBeNull()
  expect(await retryPetJournalSave('guest')).toBe(false)
  setActiveLocalAccount('failure-a')
  await recordConfirmedPetJournalSave(ref(), capturePetJournalScope())
  setActiveLocalAccount('failure-b'); setActiveLocalAccount('failure-a')
  expect(pendingPetJournalError('failure-a')).toBeNull()
  fail.mockRestore()
  expect(await retryPetJournalSave('failure-a')).toBe(false)
  expect(localStorage.getItem(petHomeKey('failure-a'))).toBeNull()
})
it('denies corrupt or mismatched-owner counters and unsupported locks without resetting the source', async () => {
  localStorage.setItem(petHomeKey('guest'), '{bad-counter')
  expect(await recordConfirmedPetJournalSave(ref(), capturePetJournalScope())).toBe('UNAVAILABLE')
  expect(localStorage.getItem(petHomeKey('guest'))).toBe('{bad-counter')
  vi.stubGlobal('navigator', {})
  expect(await recordConfirmedPetJournalSave(ref(), capturePetJournalScope())).toBe('UNAVAILABLE')
  expect(localStorage.getItem(petHomeKey('guest'))).toBe('{bad-counter')
})

it('reads completion progress without initializing, migrating or resetting unavailable homes', () => {
  const ticket = capturePetJournalScope()
  localStorage.setItem(legacyPetHomeKey('guest'), '{legacy source stays untouched}')
  const write = vi.spyOn(Storage.prototype, 'setItem')
  expect(readPetJournalProgress(ticket)).toEqual({ status: 'MISSING' })
  expect(localStorage.getItem(petHomeKey('guest'))).toBeNull()
  expect(readPetJournalProgress(ticket, { storage: { getItem: () => { throw Error('read denied') } } })).toEqual({ status: 'UNAVAILABLE' })
  for (const raw of ['{corrupt', JSON.stringify(createHome(careDay(), 1, 'another-owner')), JSON.stringify(createHome('2026-10-20', 1))]) {
    expect(readPetJournalProgress(ticket, { storage: { getItem: () => raw } })).toEqual({ status: 'UNAVAILABLE' })
  }
  expect(write).not.toHaveBeenCalled()
  expect(localStorage.getItem(legacyPetHomeKey('guest'))).toBe('{legacy source stays untouched}')
})

it('projects only committed owner-scoped counts and hides them after a generation change', async () => {
  const ticket = capturePetJournalScope()
  await recordConfirmedPetJournalSave(ref(), ticket)
  const savedFriend = JSON.parse(localStorage.getItem(petHomeKey(ticket.owner))!).selected
  expect(readPetJournalProgress(ticket)).toEqual({ status: 'READY', days: 1, credits: 0, canMeet: false, recordedToday: true, friend: { id: savedFriend, pose: 'happy' } })
  setActiveLocalAccount('read-other'); setActiveLocalAccount(null)
  expect(readPetJournalProgress(ticket)).toEqual({ status: 'STALE' })
})

it('shows a ready morning without waking or writing, and keeps future nights and same-day naps asleep', () => {
  const ticket = capturePetJournalScope()
  const today = careDay()
  const previousDay = '2026-10-18'
  const ready = sleepTogether(createHome(previousDay, 1), previousDay, today)
  const future = sleepTogether(createHome(previousDay, 1), previousDay, '2026-10-20')
  const nap = sleepTogether(createHome(today, 1), today, today)
  const write = vi.spyOn(Storage.prototype, 'setItem')
  for (const [home, pose] of [[ready, 'waking'], [future, 'sleeping'], [nap, 'sleeping']] as const) {
    const raw = JSON.stringify(home)
    expect(readPetJournalProgress(ticket, { storage: { getItem: () => raw }, today })).toMatchObject({ status: 'READY', friend: { id: home.selected, pose } })
    expect(JSON.stringify(home)).toBe(raw)
    expect(home.sleeping).not.toBeNull()
    expect(home.morning).toBeNull()
    expect(home.observation.nights[0]?.observedOn).toBeNull()
  }
  expect(write).not.toHaveBeenCalled()
  expect(localStorage.getItem(petHomeKey(ticket.owner))).toBeNull()
})
