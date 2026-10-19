import { afterEach, expect, it, vi } from 'vitest'
import { acquirePetHomeLease, petHomeLeaseHeld, withPetHomeWrite } from './pet-home-lock'
import { petLockFixture } from '../test/pet-lock-fixture'

afterEach(() => vi.unstubAllGlobals())
it('holds one room writer until exit, reuses its lease for a confirmed save and isolates owners', async () => {
  vi.stubGlobal('navigator', { locks: petLockFixture().manager })
  const first = await acquirePetHomeLease('lease-a')
  if (!first.ok) throw Error('fixture')
  try {
    expect(petHomeLeaseHeld('lease-a')).toBe(true)
    const write = vi.fn(() => 7)
    expect(await withPetHomeWrite('lease-a', write)).toBe(7)
    expect(write).toHaveBeenCalledOnce()
    expect((await acquirePetHomeLease('lease-a')).ok).toBe(false)
    const other = await acquirePetHomeLease('lease-b')
    expect(other.ok).toBe(true)
    if (other.ok) other.release()
  } finally { first.release() }
  expect(petHomeLeaseHeld('lease-a')).toBe(false)
})
it('denies a competing tab before migration or a credit write and allows retry after it exits', async () => {
  const fixture = petLockFixture()
  vi.stubGlobal('navigator', { locks: fixture.manager })
  const exitOtherTab = fixture.external('external-owner')
  const write = vi.fn()
  expect((await acquirePetHomeLease('external-owner')).ok).toBe(false)
  await expect(withPetHomeWrite('external-owner', write)).rejects.toThrow('다른 창')
  expect(write).not.toHaveBeenCalled()
  exitOtherTab()
  await withPetHomeWrite('external-owner', write)
  expect(write).toHaveBeenCalledOnce()
})
it('fails closed without browser lock support and releases short leases after a failed action', async () => {
  vi.stubGlobal('navigator', {})
  const write = vi.fn()
  await expect(withPetHomeWrite('unsupported', write)).rejects.toThrow('브라우저')
  expect(write).not.toHaveBeenCalled()
  vi.stubGlobal('navigator', { locks: petLockFixture().manager })
  await expect(withPetHomeWrite('throws', () => { throw Error('quota') })).rejects.toThrow('quota')
  expect(petHomeLeaseHeld('throws')).toBe(false)
})
it('does not let a cancelled mount take a late grant from its replacement', async () => {
  const grants: (() => void)[] = []
  vi.stubGlobal('navigator', { locks: { request: (_name: string, _options: LockOptions, callback: (lock: Lock) => unknown) => new Promise<void>(resolve => {
    grants.push(() => { void Promise.resolve(callback({ name: 'late', mode: 'exclusive' } as Lock)).then(() => resolve()) })
  }) } })
  const cancelled = new AbortController()
  const first = acquirePetHomeLease('late-grant', cancelled.signal)
  cancelled.abort()
  const second = acquirePetHomeLease('late-grant', new AbortController().signal)
  expect(grants).toHaveLength(1)
  grants.shift()!()
  expect((await first).ok).toBe(false)
  await vi.waitFor(() => expect(grants).toHaveLength(1))
  grants.shift()!()
  const lease = await second
  expect(lease.ok).toBe(true)
  if (lease.ok) lease.release()
})
