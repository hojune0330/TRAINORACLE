import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { generatePlanFromDraft, selectPlanForActivation } from './plan-beta-flow'
import { replaceCandidateCatalogWorkout } from './catalog-plan-binding'
import { planBetaStateV3Schema } from './plan-beta-schema'
import { savePlanBetaState, readPlanBetaStateFromStorage, readArchivedOriginalPlans } from './plan-beta-store'
import { createPlannedSessionLogDraft } from './planned-session-link'
import { JOURNAL_STORAGE_KEY } from './journal-storage-keys'
import { FIELD_PROVENANCE } from './field-provenance'
import { readCatalogCycleDraftSource, catalogCycleDraftSourceStillCurrent } from './catalog-cycle-draft'
import { saveSelectedPlanCandidate } from '../screens/plan-beta/plan-selection'
import { setActiveLocalAccount } from './account/local-journal-ownership'
import { catalogScheduleConditions } from './catalog-schedule-conditions'
import { bindCatalogSession, bindDefaultCatalogSessions, resolveCatalogBinding } from '@impl/prescription/catalog-session-binding'
import { ALL_WORKOUT_CATALOG, catalogMethodIdentity } from '@impl/prescription/all-workout-calculator'
import { isVerifiedPlanCandidate } from '@impl/plan-generator/adaptation'
import { derivePlanCycleResponse } from './plan-cycle-response'
import { resolveCatalogCycleSuccessor } from './catalog-cycle-successor'
import { CatalogCycleSummary } from '../screens/plan-beta/CatalogCycleSummary'
import * as lockModule from './plan-mutation-lock'
import * as accountDomain from './account/account-plan-domain'
import type { PlanSession } from '@impl/plan-generator/types'
import type { PostSessionEntry } from './journal-schema'

const intake = { eventGroup: 'FIVE_K' as const, eventDistanceM: 5000 as const,
  competitionDivision: 'OPEN' as const, experienceBand: 'EXPERIENCED' as const,
  availableDayCount: 'EVERY_DAY' as const, requestedFrameLength: 9 as const,
  trainingFocus: 'LT_INTENT' as const, secondSessionMode: 'RECOVERY_PM_ALLOWED' as const,
  trainingTimePreference: 'MORNING' as const, selectedDetailedTemplateRef: null,
  startDate: '2026-09-20' }
const main = (sessions: readonly PlanSession[]) => sessions.filter(s => s.role === 'QUALITY')
const binding = (s: PlanSession) => s.prescription.kind === 'RPE_TIME_RANGE' ? s.prescription.catalogWorkout : undefined
const storeEntries = (entries: readonly PostSessionEntry[]) => localStorage.setItem(JOURNAL_STORAGE_KEY, JSON.stringify(entries))
const storedBytes = () => JSON.stringify(Object.fromEntries(Object.entries(localStorage)))

function fixture(id = 'P-LT-B', changes = {}) {
  const first = generatePlanFromDraft({ ...intake, ...changes }, 'NO_KNOWN_RISK')
  if (first.kind !== 'generated') throw Error('Fixture generation: ' + first.kind)
  let generated = first.generated
  for (const s of main(generated.candidates[0].sessions)) {
    const next = replaceCandidateCatalogWorkout(generated, s, id, {
      eventDistanceM: 5000, experience: 'EXPERIENCED', availableSeconds: null,
      confirmedRequirements: [], fiveK: null, segmentPaces: [],
    }, true)
    if (!next) throw Error('Fixture binding: ' + id)
    generated = next
  }
  const selected = selectPlanForActivation(generated.candidates[0].candidateId, generated,
    first.gate, first.intake, first.athleteEvidence, new Date('2026-09-20T03:00:00Z'))
  if (selected.kind !== 'selected') throw Error('Fixture selection: ' + selected.code)
  const predecessor = planBetaStateV3Schema.parse({ ...selected.state,
    progress: selected.state.activePlan.sessions.map(s => ({ sessionDay: s.day, sessionSlot: s.slot, state: 'COMPLETED' })) })
  expect(savePlanBetaState(predecessor).ok).toBe(true)
  const entries: PostSessionEntry[] = main(predecessor.activePlan.sessions).map(s => {
    const draft = createPlannedSessionLogDraft(predecessor, s, '2026-09-29T03:00:00Z')!
    return { id: `synthetic-${s.day}-${s.slot}`, kind: 'post-session', date: draft.date,
      savedAt: '2026-09-29T03:00:00Z', syncState: 'local', system: 'lt', title: '', memo: '',
      distanceKm: '', durationMin: '', avgPace: '', rpe: 10, activityOutcome: 'COMPLETED',
      planExecutionRelation: 'AS_PLANNED', activitySlot: s.slot, painCheckStatus: 'NO_SIGNAL_REPORTED',
      plannedSessionLink: draft.link, fieldProvenance: {
        rpe: { provenance: FIELD_PROVENANCE.explicit },
        plannedSessionLink: { provenance: FIELD_PROVENANCE.explicit },
        activityOutcome: { provenance: FIELD_PROVENANCE.explicit },
        activitySlot: { provenance: FIELD_PROVENANCE.explicit },
        painCheckStatus: { provenance: FIELD_PROVENANCE.explicit },
        planExecutionRelation: { provenance: FIELD_PROVENANCE.derived,
          derivationRuleId: 'QUICK_PLAN_EXECUTION_RELATION_V2', derivedFrom: ['activityOutcome', 'activitySlot', 'plannedSessionLink'] },
      } }
  })
  storeEntries(entries)
  const next = () => {
    const result = generatePlanFromDraft({ ...first.intake, startDate: '2026-10-01' },
      'NO_KNOWN_RISK', undefined, undefined, undefined, predecessor)
    if (result.kind !== 'generated') throw Error('Fixture next: ' + (result.kind === 'rejected' ? result.code : result.kind))
    return result
  }
  const save = (result: ReturnType<typeof next>, context = result.cycleDraft) => saveSelectedPlanCandidate(
    { candidateId: result.generated.candidates[0].candidateId, startDate: '2026-10-01' },
    result.generated, result.gate, result.intake, result.athleteEvidence, () => true, predecessor, context)
  return { predecessor, entries, first, generated, next, save }
}

beforeEach(() => {
  localStorage.clear(); sessionStorage.clear(); setActiveLocalAccount(null)
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-01T03:00:00Z'))
  vi.stubGlobal('fetch', () => { throw Error('Independent audit: network forbidden') })
})
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); setActiveLocalAccount(null) })

describe('independent real reduction and transactional boundaries', () => {
  it.each([['P-LT-B', 'LT_INTENT', 'P-LT-B-480'], ['P-VO2-2', 'VO2_INTENT', 'P-VO2-2-5']])(
    'calculates and stores real lower %s and preserves predecessor and journals', async (id, focus, lower) => {
      const f = fixture(id, { trainingFocus: focus }), before = storedBytes(), result = f.next()
      expect(result.cycleSummary?.reducedCount).toBe(main(f.predecessor.activePlan.sessions).length)
      expect(storedBytes()).toBe(before)
      expect(result.generated.candidates.every(isVerifiedPlanCandidate)).toBe(true)
      for (const [i, s] of main(result.generated.candidates[0].sessions).entries()) {
        const old = main(f.predecessor.activePlan.sessions)[i]!
        const a = resolveCatalogBinding(binding(s)!)!, b = resolveCatalogBinding(binding(old)!)!
        expect(binding(s)?.catalogId).toBe(lower)
        expect(a.totals.seconds!.maximum).toBeLessThan(b.totals.seconds!.maximum)
        expect(a.totals.knownMainDistanceM).toBeLessThanOrEqual(b.totals.knownMainDistanceM)
        expect(a.totals.workOccurrences).toBeLessThanOrEqual(b.totals.workOccurrences)
        const recoveries = a.steps.filter(x => x.phase === 'main' && x.kind === 'RECOVERY')
        const oldRecoveries = b.steps.filter(x => x.phase === 'main' && x.kind === 'RECOVERY')
        expect(recoveries.every(r => oldRecoveries.some(o => o.intent === r.intent && o.seconds!.minimum <= r.seconds!.minimum))).toBe(true)
      }
      const saved = await f.save(result)
      expect(saved.kind).toBe('saved')
      expect(readArchivedOriginalPlans()).toMatchObject({ kind: 'loaded', plans: expect.arrayContaining([f.predecessor]) })
      expect(localStorage.getItem(JOURNAL_STORAGE_KEY)).toBe(JSON.stringify(f.entries))
      if (saved.kind === 'saved' && saved.state.version === 3) {
        expect(saved.state.periodization!.frameOrdinal).toBe(f.predecessor.periodization!.frameOrdinal + 1)
        expect(saved.state.activePlan.sessions).toEqual(result.generated.candidates[0].sessions)
      }
    })

  it('rejects changed RPE during lock wait without writes', async () => {
    const f = fixture(), result = f.next()
    let release: (() => void) | undefined
    vi.spyOn(lockModule, 'getPlanMutationLockManager').mockReturnValue({ request: <T,>(_n: string, _o: unknown, cb: (lock: object) => T | Promise<T>) =>
      new Promise<T>(resolve => { release = () => resolve(cb({})) }) } as never)
    const waiting = f.save(result)
    storeEntries(f.entries.map(e => ({ ...e, rpe: 6 })))
    const before = storedBytes(); release!()
    expect(await waiting).toEqual({ kind: 'rejected', code: 'CYCLE_EVIDENCE_CHANGED' })
    expect(storedBytes()).toBe(before)
  })

  it('rejects changed predecessor even if journal fingerprint is unchanged', async () => {
    const f = fixture(), result = f.next()
    expect(savePlanBetaState({ ...f.predecessor, progress: [] }).ok).toBe(true)
    const before = storedBytes()
    expect(await f.save(result)).toMatchObject({ kind: 'rejected', code: 'STALE_BASE' })
    expect(storedBytes()).toBe(before)
  })

  it('checks real account callback again after journal mutation', async () => {
    const f = fixture(), result = f.next(), before = storedBytes()
    let invoked = false
    vi.spyOn(accountDomain, 'captureAccountPlanWrite').mockReturnValue({ save: async (_s: unknown, _r: unknown, fresh: () => boolean) => {
      invoked = true; expect(fresh()).toBe(true)
      storeEntries(f.entries.map(e => ({ ...e, rpe: 6 })))
      expect(fresh()).toBe(false)
      return 'ACCOUNT_PLAN_REVIEW_REQUIRED'
    } } as never)
    expect(await f.save(result)).toEqual({ kind: 'rejected', code: 'ACCOUNT_PLAN_REVIEW_REQUIRED' })
    expect(invoked).toBe(true)
    expect(readPlanBetaStateFromStorage()).toEqual({ kind: 'loaded', state: f.predecessor })
    expect(storedBytes()).not.toBe(before)
  })

  it('account callback rejects scope change even with identical synthetic plan and journals', async () => {
    const f = fixture(), result = f.next()
    let invoked = false
    vi.spyOn(accountDomain, 'captureAccountPlanWrite').mockReturnValue({ save: async (_s: unknown, _r: unknown, fresh: () => boolean) => {
      invoked = true; expect(fresh()).toBe(true); setActiveLocalAccount('synthetic-account-b')
      expect(fresh()).toBe(false); return 'ACCOUNT_PLAN_STALE'
    } } as never)
    expect(await f.save(result)).toEqual({ kind: 'rejected', code: 'ACCOUNT_PLAN_STALE' })
    expect(invoked).toBe(true)
  })

  it('does not expose an old account pending receipt after the scope changes', async () => {
    const f = fixture(), result = f.next()
    let invoked = false
    vi.spyOn(accountDomain, 'captureAccountPlanWrite').mockReturnValue({ save: async (_s: unknown, _r: unknown, fresh: () => boolean) => {
      invoked = true; expect(fresh()).toBe(true); setActiveLocalAccount('synthetic-account-b')
      expect(fresh()).toBe(false); return 'ACCOUNT_PLAN_PENDING'
    } } as never)
    expect(await f.save(result)).toEqual({ kind: 'rejected', code: 'PLAN_STORAGE_STATE_UNCERTAIN' })
    expect(invoked).toBe(true)
  })

  it('maintains exact retry without double archival or lineage advance', async () => {
    const f = fixture(), result = f.next()
    expect((await f.save(result)).kind).toBe('saved')
    const before = storedBytes()
    expect((await f.save(result)).kind).toBe('saved')
    expect(storedBytes()).toBe(before)
  })

  it('does not require a changed journal to acknowledge an already committed exact retry', async () => {
    const f = fixture(), result = f.next()
    expect((await f.save(result)).kind).toBe('saved')
    storeEntries(f.entries.map(e => ({ ...e, rpe: 6 })))
    const before = storedBytes()
    expect((await f.save(result)).kind).toBe('saved')
    expect(storedBytes()).toBe(before)
  })

  it('cannot bypass journal revalidation by omitting the new optional context', async () => {
    const f = fixture(), result = f.next()
    storeEntries(f.entries.map(e => ({ ...e, rpe: 6 })))
    const before = storedBytes()
    const saved = await saveSelectedPlanCandidate({ candidateId: result.generated.candidates[0].candidateId, startDate: '2026-10-01' },
      result.generated, result.gate, result.intake, result.athleteEvidence, () => true, f.predecessor)
    expect(saved.kind).toBe('rejected')
    expect(storedBytes()).toBe(before)
  })
})

describe('independent evidence and first generation', () => {
  it.each(['single', 'missing-rpe', 'modified', 'conflict'])('does not reduce %s evidence', mode => {
    const f = fixture()
    const entries = mode === 'single' ? f.entries.slice(0, 1)
      : mode === 'missing-rpe' ? f.entries.map(e => ({ ...e, fieldProvenance: {} }))
        : mode === 'modified' ? f.entries.map(e => ({ ...e, planExecutionRelation: 'MODIFIED' as const }))
          : [...f.entries, { ...f.entries[0]!, id: 'synthetic-conflict', rpe: 6 }]
    storeEntries(entries)
    expect(f.next().cycleSummary?.reducedCount).toBe(0)
  })

  it('tracks scope and ignores private-only prose in source fingerprint', () => {
    const f = fixture(), source = readCatalogCycleDraftSource(f.predecessor)!
    storeEntries(f.entries.map(e => ({ ...e, memo: 'synthetic-private-only' })))
    expect(catalogCycleDraftSourceStillCurrent(f.predecessor, source.context)).toBe(true)
    setActiveLocalAccount('synthetic-account-b')
    expect(catalogCycleDraftSourceStillCurrent(f.predecessor, source.context)).toBe(false)
  })

  it('deduplicates an identical result without manufacturing repeated execution', () => {
    const f = fixture(); storeEntries([f.entries[0]!, f.entries[0]!])
    const result = f.next()
    expect(result.cycleSummary?.reducedCount).toBe(0)
    expect(readCatalogCycleDraftSource(f.predecessor)?.response.duplicateCount).toBe(1)
  })

  it('does not call a missing MAIN complete evidence', () => {
    const f = fixture('P-LT-B', { requestedFrameLength: 10 })
    expect(f.entries.length).toBeGreaterThanOrEqual(2)
    storeEntries(f.entries.slice(0, -1))
    const result = f.next()
    expect(result.cycleSummary?.reducedCount).toBe(0)
  })

  it('keeps EASY/PM envelopes and exact shortest fallback MAIN with honest accepted duration', () => {
    const q: PlanSession = { day: 1, slot: 'AM', role: 'QUALITY', plannedEnergyIntent: 'LT_INTENT',
      prescription: { kind: 'RPE_TIME_RANGE', rpe: { minimum: 5, maximum: 6 }, durationMinutes: { minimum: 20, maximum: 30 } } }
    const source = [q, { ...q, role: 'EASY', slot: 'PM', plannedEnergyIntent: 'RECOVERY_INTENT',
      prescription: { kind: 'RPE_TIME_RANGE', rpe: { minimum: 1, maximum: 2 }, durationMinutes: { minimum: 10, maximum: 20 } } }] as PlanSession[]
    const eligible = ALL_WORKOUT_CATALOG.filter(e => e.family === 'LT').flatMap(e => {
      const s = bindCatalogSession(q, e.id, { eventDistanceM: 5000, experience: 'EXPERIENCED', availableSeconds: null,
        confirmedRequirements: [], fiveK: null, segmentPaces: [] }, true)
      return s ? [{ s, identity: catalogMethodIdentity(e) }] : []
    })
    const byMethod = [...new Set(eligible.map(x => x.identity))].map(key => eligible.filter(x => x.identity === key)
      .sort((a, b) => a.s.prescription.kind === 'RPE_TIME_RANGE' && b.s.prescription.kind === 'RPE_TIME_RANGE'
        ? a.s.prescription.durationMinutes.maximum - b.s.prescription.durationMinutes.maximum : 0)[0]!.s)
    const within = byMethod.filter(s => s.prescription.kind === 'RPE_TIME_RANGE' && s.prescription.durationMinutes.maximum <= 30)
    const shortest = Math.min(...byMethod.map(s => s.prescription.kind === 'RPE_TIME_RANGE' ? s.prescription.durationMinutes.maximum : Infinity))
    for (let seed = 0; seed < 10; seed++) {
      const next = bindDefaultCatalogSessions(source, 5000, 'EXPERIENCED', seed)
      const actual = next[0]!.prescription
      expect(actual.kind).toBe('RPE_TIME_RANGE')
      if (actual.kind !== 'RPE_TIME_RANGE') throw Error('Wrong prescription')
      expect(actual.durationMinutes.maximum).toBe(within.length ? expect.any(Number) : shortest)
      if (actual.durationMinutes.maximum > 30) expect(actual.catalogWorkout?.acceptedDurationSeconds).toBe(actual.durationMinutes.maximum * 60)
      const pm = next[1]!.prescription
      if (pm.kind !== 'RPE_TIME_RANGE') throw Error('Wrong PM')
      expect(pm.durationMinutes.maximum).toBeLessThanOrEqual(20); expect(pm.rpe.maximum).toBeLessThanOrEqual(2)
      expect(binding(next[0]!)?.inputs.confirmedRequirements).toEqual([])
    }
  })

  it('renders no false maintained claim when no predecessor MAIN can be recovered', () => {
    const f = fixture('P-LT-B')
    const target = generatePlanFromDraft({ ...intake, startDate: '2026-10-01' }, 'NO_KNOWN_RISK')
    if (target.kind !== 'generated') throw Error('Bad target')
    const predecessor = planBetaStateV3Schema.parse({ ...f.predecessor, activePlan: {
      ...f.predecessor.activePlan, sessions: f.predecessor.activePlan.sessions } })
    const response = derivePlanCycleResponse(f.entries, predecessor)
    const next = resolveCatalogCycleSuccessor({ generated: target.generated, predecessor, response, evaluatedAt: new Date() })
    expect(next.summary.appliedCount).toBeGreaterThan(0)
    render(<CatalogCycleSummary summary={next.summary} startDate="2026-10-01" />)
    fireEvent.click(screen.getByText('이전 수행을 어떻게 반영했나요?'))
    expect(screen.getByRole('status').textContent).toBe(next.summary.headline)
  })
})
