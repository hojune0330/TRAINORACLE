import { expect, it } from 'vitest'
import { morningGreeting } from './PetMorningGreeting'

it('uses only the exact wake date and explicit sleep-quality value', () => {
  const recorded = { date: '2026-10-27', status: 'recorded' as const, sleepH: 3, sleepQuality: 5 }
  expect(morningGreeting(recorded, recorded.date)).not.toContain('잘 잤다니')
  expect(morningGreeting({ ...recorded, sleepQualityExplicit: true }, recorded.date)).toContain('잘 잤다니')
  expect(morningGreeting({ ...recorded, sleepQuality: 1, sleepQualityExplicit: true }, recorded.date)).toContain('피곤하겠다')
  expect(morningGreeting({ ...recorded, sleepQualityExplicit: true }, '2026-10-28')).toBe('일어났네! 어떻게 잤어?')
  expect(morningGreeting({ ...recorded, status: 'draft', sleepQualityExplicit: true }, recorded.date)).toBe('일어났네! 어떻게 잤어?')
})
