import { describe, expect, it } from 'vitest'
import { activeJourney, createState, DEFAULT_CONTEXT, evaluate, getChapter, getHintAction, isPuzzleContext, isSolved, isValidLayout, litCells, parseState, saveState, solveLayouts, swapOutcome, transition } from './engine'
import type { ChapterId, InnState, Layout, PuzzleContext, StorageAccess } from './engine'

function beginPuzzle(state: InnState): InnState {
  for (const type of ['skipIntro', 'rest', 'awake', 'discover'] as const) state = transition(state, { type })
  const journey = activeJourney(state)
  if (journey.phase === 'upgrade') state = journey.chapter === 4 ? transition(state, { type: 'chooseLamp', mode: 'hooded' }) : transition(state, { type: 'chooseStone', mode: 'long' })
  return state
}
function solveCurrent(state: InnState): InnState {
  let count = 0
  while (!isSolved(activeJourney(state).layout, activeJourney(state))) {
    const current = activeJourney(state)
    const hint = getHintAction(current.layout, current)
    expect(hint, `chapter ${current.chapter} has a legal solution`).not.toBeNull()
    const next = transition(state, hint!)
    expect(next).not.toBe(state)
    state = next
    if (++count > 20) throw new Error('hint failed to converge')
  }
  return transition(state, { type: 'confirm' })
}
function reachChapter(chapter: ChapterId): InnState {
  let state = createState('2026-10-18', 'season')
  for (let id = 1; id < chapter; id++) state = transition(solveCurrent(beginPuzzle(state)), { type: 'nextChapter' })
  return state
}
const branches: PuzzleContext[] = [
  ...([1, 2, 3] as ChapterId[]).map(chapter => ({ ...DEFAULT_CONTEXT, chapter })),
  ...(['soft', 'hooded'] as const).flatMap(lampMode => [
    { ...DEFAULT_CONTEXT, chapter: 4 as const, lampMode },
    ...(['small', 'long'] as const).map(stoneMode => ({ ...DEFAULT_CONTEXT, chapter: 5 as const, lampMode, stoneMode })),
  ]),
]

describe('five distinct room chapters', () => {
  it('exhaustively finds legal nontrivial solutions in every facility branch', () => {
    for (const context of branches) {
      const initial = getChapter(context).initialLayout
      expect(isValidLayout(initial, context)).toBe(true)
      expect(isSolved(initial, context)).toBe(false)
      const solutions = solveLayouts(context)
      expect(solutions.length, JSON.stringify(context)).toBeGreaterThan(0)
      expect(new Set(solutions.map(layout => layout.join(','))).size).toBe(solutions.length)
      for (const layout of solutions) {
        expect(isValidLayout(layout, context)).toBe(true)
        expect(evaluate(layout, context).every(rule => rule.satisfied)).toBe(true)
        // Independent physical oracle: no diagonal neighbours, dry guests, fixed stone and footprint.
        const cols = context.chapter === 5 ? 4 : 3
        const neighbours = (a: number, b: number) => (Math.floor(a / cols) === Math.floor(b / cols) && Math.abs(a - b) === 1) || Math.abs(a - b) === cols
        expect(neighbours(layout.indexOf('fox'), layout.indexOf('screen'))).toBe(true)
        if (context.chapter === 2) { expect(layout.indexOf('fox')).toBeLessThan(3); expect(layout.indexOf('turtle')).toBeGreaterThanOrEqual(3) }
        if (context.chapter === 3) { expect(layout[4]).toBe('stone'); for (const i of [0, 1]) expect(['fox', 'turtle', 'moth']).not.toContain(layout[i]) }
        if (context.chapter === 5) {
          expect(layout.indexOf('letter')).toBeLessThan(4)
          for (const i of [0, 3]) expect(['fox', 'turtle', 'moth']).not.toContain(layout[i])
          if (context.stoneMode === 'long') { expect(layout.indexOf('stone') % 4).not.toBe(3); expect(layout.indexOf('stoneTail')).toBe(layout.indexOf('stone') + 1) }
        }
      }
    }
  }, 30000)
  it('uses one-cell directional light and allows rotation to escape an unlit direction', () => {
    const context: PuzzleContext = { ...DEFAULT_CONTEXT, chapter: 4, lampMode: 'hooded', lampDirection: 'south' }
    const layout: Layout = ['fox', 'screen', 'moth', 'turtle', 'stone', 'lamp']
    expect(litCells(layout, context)).toEqual([])
    expect(litCells(layout, { ...context, lampDirection: 'north' })).toEqual([2])
    expect(litCells(layout, { ...context, lampDirection: 'west' })).toEqual([4])
    expect(litCells(layout, { ...context, lampMode: 'soft' })).toEqual([2, 4])
    expect(getHintAction(layout, context)).toEqual({ type: 'rotateLamp' })
    expect(isSolved(layout, { ...context, lampDirection: 'north' })).toBe(true)
  })
  it('moves a long stone as a bundle and rejects row wrap, split tails, and locked stone moves', () => {
    const context: PuzzleContext = { ...DEFAULT_CONTEXT, chapter: 5, stoneMode: 'long' }
    const layout = getChapter(context).initialLayout
    expect(swapOutcome(layout, 4, 0, context)).toEqual(['stone', 'stoneTail', 'moth', 'letter', 'fox', 'turtle', 'screen', 'lamp'])
    expect(swapOutcome(layout, 4, 5, context)).toBeNull()
    expect(swapOutcome(layout, 4, 3, context)).toBeNull()
    expect(swapOutcome(layout, 5, 0, context)).toBeNull()
    const split = [...layout]; [split[5], split[7]] = [split[7]!, split[5]!]
    expect(isValidLayout(split, context)).toBe(false)
    const rainy = { ...DEFAULT_CONTEXT, chapter: 3 as const }
    expect(swapOutcome(getChapter(rainy).initialLayout, 4, 0, rainy)).toBeNull()
  })
})

describe('season state and storage migration', () => {
  it('plays every chapter by legal hints, stores five immutable cards, then starts a fresh journey', () => {
    let state = createState('2026-10-18', 'season')
    const preserved: string[] = []
    for (let chapter = 1; chapter <= 5; chapter++) {
      state = solveCurrent(beginPuzzle(state))
      expect(activeJourney(state).chapter).toBe(chapter)
      expect(activeJourney(state).phase).toBe(chapter === 5 ? 'seasonComplete' : 'complete')
      expect(state.postcards).toHaveLength(chapter)
      preserved.forEach((card, index) => expect(JSON.stringify(state.postcards[index])).toBe(card))
      preserved.push(JSON.stringify(state.postcards.at(-1)))
      expect(parseState(JSON.stringify({ ...state, revision: chapter }))).not.toBeNull()
      if (chapter < 5) state = transition(state, { type: 'nextChapter' })
    }
    expect(transition(state, { type: 'nextChapter' })).toBe(state)
    const next = transition(state, { type: 'newJourney', id: 'again', date: '2026-10-19' })
    expect(next.postcards).toEqual(state.postcards)
    expect(activeJourney(next).chapter).toBe(1)
    expect(activeJourney(next).phase).toBe('intro')
  }, 30000)
  it('preserves and resumes an unfinished journey without allowing duplicate identifiers', () => {
    let state = beginPuzzle(reachChapter(3))
    state = transition(state, { type: 'swap', from: 0, to: 1 })
    const snapshot = structuredClone(activeJourney(state))
    const fresh = transition(state, { type: 'newJourney', id: 'fresh', date: '2026-10-19' })
    expect(fresh.journeys.find(j => j.id === snapshot.id)).toEqual(snapshot)
    expect(transition(fresh, { type: 'newJourney', id: 'fresh', date: '2026-10-20' })).toBe(fresh)
    const resumed = transition(fresh, { type: 'resumeJourney', id: snapshot.id })
    expect(activeJourney(resumed)).toEqual(snapshot)
    expect(resumed.postcards).toHaveLength(2)
    expect(parseState(JSON.stringify({ ...resumed, revision: 1 }))).not.toBeNull()
  }, 30000)
  it('undoes rotations and resets with their exact layouts and directions', () => {
    let state = beginPuzzle(reachChapter(4))
    const original = activeJourney(state)
    state = transition(state, { type: 'rotateLamp' })
    expect(activeJourney(state).lampDirection).toBe('east')
    state = transition(state, { type: 'swap', from: 0, to: 1 })
    state = transition(state, { type: 'undo' })
    expect(activeJourney(state).lampDirection).toBe('east')
    expect(activeJourney(state).layout).toEqual(original.layout)
    state = transition(state, { type: 'undo' })
    expect(activeJourney(state)).toEqual(original)
    state = transition(transition(state, { type: 'rotateLamp' }), { type: 'reset' })
    expect(activeJourney(state).lampDirection).toBe('north')
    expect(activeJourney(transition(state, { type: 'undo' })).lampDirection).toBe('east')
  }, 30000)
  it('rejects facility purchases, rotation and chapter advance outside their allowed phase', () => {
    const state = createState('2026-10-18', 'first')
    for (const action of [{ type: 'chooseLamp', mode: 'hooded' }, { type: 'chooseStone', mode: 'long' }, { type: 'rotateLamp' }, { type: 'nextChapter' }, { type: 'confirm' }] as const) expect(transition(state, action)).toBe(state)
    const puzzle = beginPuzzle(state)
    expect(transition(puzzle, { type: 'rotateLamp' })).toBe(puzzle)
    expect(transition(puzzle, { type: 'chooseLamp', mode: 'hooded' })).toBe(puzzle)
    expect(isPuzzleContext({ ...DEFAULT_CONTEXT, lampMode: 'hooded' })).toBe(false)
    expect(isPuzzleContext({ ...DEFAULT_CONTEXT, chapter: 4, stoneMode: 'long' })).toBe(false)
    expect(isPuzzleContext({ ...DEFAULT_CONTEXT, chapter: 5, lampDirection: 'east' })).toBe(false)
    expect(isPuzzleContext({ ...DEFAULT_CONTEXT, chapter: 5, lampMode: 'hooded', lampDirection: 'east', stoneMode: 'long' })).toBe(true)
  })
  it('migrates completed and unfinished v1 journeys without losing undo or postcards and writes v2 with the same revision guard', () => {
    const base = solveCurrent(beginPuzzle(createState('2026-10-18', 'old')))
    const pending = transition(base, { type: 'newJourney', id: 'pending', date: '2026-10-19' })
    const legacy = { ...pending, version: 1, revision: 7,
      journeys: pending.journeys.map(({ chapter: _c, lampMode: _l, lampDirection: _d, stoneMode: _s, historyDirections: _h, ...journey }) => journey),
      postcards: pending.postcards.map(({ chapter: _c, lampMode: _l, lampDirection: _d, stoneMode: _s, ...card }) => card),
    }
    const migrated = parseState(JSON.stringify(legacy))!
    expect(migrated.version).toBe(2)
    expect(migrated.revision).toBe(7)
    expect(migrated.activeJourneyId).toBe('pending')
    expect(migrated.journeys[0]?.history).toEqual(base.journeys[0]?.history)
    expect(migrated.postcards).toEqual(base.postcards)
    let raw = JSON.stringify(legacy)
    const storage: StorageAccess = { getItem: () => raw, setItem: (_, value) => { raw = value } }
    const result = saveState(storage, 'same-key', migrated)
    expect(result.ok).toBe(true)
    expect(JSON.parse(raw).version).toBe(2)
    expect(JSON.parse(raw).revision).toBe(8)
    expect(saveState(storage, 'same-key', migrated)).toEqual({ ok: false, reason: 'conflict' })
  })
  it('rejects future versions, forged completed chapters, missing earlier cards, split footprints and duplicate journeys', () => {
    const state = { ...solveCurrent(beginPuzzle(createState('2026-10-18', 'one'))), revision: 1 }
    expect(parseState(JSON.stringify({ ...state, version: 3 }))).toBeNull()
    expect(parseState(JSON.stringify({ ...state, journeys: [...state.journeys, ...state.journeys] }))).toBeNull()
    expect(parseState(JSON.stringify({ ...state, journeys: [{ ...activeJourney(state), chapter: 2 }], postcards: [{ ...state.postcards[0], chapter: 2 }] }))).toBeNull()
    expect(parseState(JSON.stringify({ ...state, postcards: [...state.postcards, ...state.postcards] }))).toBeNull()
    expect(parseState(JSON.stringify({ ...state, journeys: [{ ...activeJourney(state), historyDirections: ['invalid'] }] }))).toBeNull()
  })
})
