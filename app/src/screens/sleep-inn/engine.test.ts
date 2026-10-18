import { describe, expect, it } from 'vitest'
import { activeJourney, adjacent, createState, evaluate, getHint, INITIAL_LAYOUT, isLayout, isSolved, parseState, saveState, SOLUTION, solveLayouts, storageKey, transition, validDate } from './engine'
import type { InnState, Layout, StorageAccess } from './engine'

function puzzleState(): InnState {
  let state = createState('2026-10-18', 'first')
  for (const type of ['skipIntro', 'rest', 'awake', 'discover'] as const) state = transition(state, { type })
  return state
}
function completedState(): InnState {
  return transition(transition(transition(puzzleState(), { type: 'swap', from: 0, to: 1 }), { type: 'swap', from: 0, to: 2 }), { type: 'confirm' })
}
const PLAY_SOLUTION: Layout = ['moth', 'fox', 'turtle', 'lamp', 'screen', 'stone']
function memoryStorage(): StorageAccess & { values: Map<string, string> } {
  const values = new Map<string, string>()
  return { values, getItem: key => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value) } }
}

describe('sleep inn six-cell rules', () => {
  it('rejects diagonal and row-wrap adjacency while accepting orthogonal neighbours', () => {
    expect(adjacent(0, 1)).toBe(true)
    expect(adjacent(0, 3)).toBe(true)
    expect(adjacent(0, 4)).toBe(false)
    expect(adjacent(2, 3)).toBe(false)
    expect(adjacent(1, 1)).toBe(false)
    expect(adjacent(-1, 0)).toBe(false)
  })
  it('finds the 96 valid permutations and accepts the documented diagonal-light solution', () => {
    const solutions = solveLayouts()
    expect(solutions).toHaveLength(96)
    expect(new Set(solutions.map(layout => layout.join(','))).size).toBe(96)
    expect(solutions).toContainEqual(SOLUTION)
    for (const layout of solutions) {
      // Independent row/column oracle prevents a solver returning arbitrary permutations.
      const neighbours = (a: string, b: string) => {
        const i = layout.indexOf(a as Layout[number]); const j = layout.indexOf(b as Layout[number])
        return (Math.floor(i / 3) === Math.floor(j / 3) && Math.abs(i - j) === 1) || Math.abs(i - j) === 3
      }
      expect(neighbours('fox', 'screen')).toBe(true)
      expect(neighbours('fox', 'lamp')).toBe(false)
      expect(neighbours('turtle', 'stone')).toBe(true)
      expect(neighbours('moth', 'lamp')).toBe(true)
    }
  })
  it('starts unsolved, rejects duplicates, and identifies the actual wrong neighbour', () => {
    expect(isSolved(INITIAL_LAYOUT)).toBe(false)
    expect(evaluate(INITIAL_LAYOUT).find(rule => rule.id === 'FOX_NO_LAMP')?.satisfied).toBe(false)
    expect(isLayout(['fox', 'fox', 'turtle', 'moth', 'lamp', 'stone'])).toBe(false)
    expect(isSolved(['fox', 'fox', 'turtle', 'moth', 'lamp', 'stone'])).toBe(false)
    expect(getHint(INITIAL_LAYOUT)).toContain('두 자리를 바꿔 보세요.')
  })
  it('requires at least two exchanges to reach any solution from the initial layout', () => {
    const distance = (to: Layout) => {
      const visited = new Set<number>(); let cycles = 0
      for (let i = 0; i < 6; i++) {
        if (visited.has(i)) continue
        cycles++
        let cursor = i
        while (!visited.has(cursor)) { visited.add(cursor); cursor = to.indexOf(INITIAL_LAYOUT[cursor]!) }
      }
      return 6 - cycles
    }
    expect(Math.min(...solveLayouts().map(distance))).toBe(2)
  })
})

describe('sleep inn journey transitions', () => {
  it('requires explicit return, discovery, a real swap, and confirmation before a postcard exists', () => {
    let state = createState('2026-10-18', 'first')
    state = transition(state, { type: 'skipIntro' })
    expect(activeJourney(state).phase).toBe('night')
    state = transition(state, { type: 'rest' })
    expect(activeJourney(state).phase).toBe('resting')
    expect(state.postcards).toHaveLength(0)
    expect(transition(state, { type: 'confirm' })).toBe(state)
    state = transition(state, { type: 'awake' })
    expect(activeJourney(state).phase).toBe('discovery')
    state = transition(state, { type: 'discover' })
    expect(transition(state, { type: 'confirm' })).toBe(state)
    state = transition(state, { type: 'swap', from: 0, to: 1 })
    expect(transition(state, { type: 'confirm' })).toBe(state)
    state = transition(state, { type: 'swap', from: 0, to: 2 })
    expect(activeJourney(state).layout).toEqual(PLAY_SOLUTION)
    expect(state.postcards).toHaveLength(0)
    state = transition(state, { type: 'confirm' })
    expect(activeJourney(state).phase).toBe('complete')
    expect(state.postcards).toEqual([expect.objectContaining({ journeyId: 'first', date: '2026-10-18', chapter: 1, layout: PLAY_SOLUTION })])
    expect(transition(state, { type: 'confirm' })).toBe(state)
    expect(transition(state, { type: 'awake' })).toBe(state)
  })
  it('undoes swaps and resets without mutating the previous snapshot', () => {
    const original = puzzleState()
    const swapped = transition(original, { type: 'swap', from: 0, to: 1 })
    expect(activeJourney(original).layout).toEqual(INITIAL_LAYOUT)
    expect(activeJourney(transition(swapped, { type: 'undo' })).layout).toEqual(INITIAL_LAYOUT)
    const reset = transition(swapped, { type: 'reset' })
    expect(activeJourney(reset).layout).toEqual(INITIAL_LAYOUT)
    expect(activeJourney(transition(reset, { type: 'undo' })).layout).toEqual(activeJourney(swapped).layout)
    expect(transition(original, { type: 'swap', from: 1, to: 6 })).toBe(original)
  })
  it('keeps undo history beyond fifty exchanges without cutting off earlier moves', () => {
    let state = puzzleState()
    for (let i = 0; i < 75; i++) state = transition(state, { type: 'swap', from: 0, to: 1 })
    expect(activeJourney(state).history).toHaveLength(75)
    for (let i = 0; i < 75; i++) state = transition(state, { type: 'undo' })
    expect(activeJourney(state).layout).toEqual(INITIAL_LAYOUT)
    expect(activeJourney(state).history).toHaveLength(0)
  })
  it('preserves completed postcards and the in-progress journey when revisiting or starting again', () => {
    const done = completedState()
    const next = transition(done, { type: 'newJourney', id: 'second', date: '2026-10-19' })
    expect(next.postcards).toEqual(done.postcards)
    expect(next.journeys).toHaveLength(2)
    expect(activeJourney(next).layout).toEqual(INITIAL_LAYOUT)
    const returned = transition(next, { type: 'revisit', id: 'first' })
    expect(activeJourney(returned).phase).toBe('complete')
    expect(returned.journeys.find(j => j.id === 'second')?.phase).toBe('intro')
    expect(returned.postcards).toHaveLength(1)
    expect(transition(returned, { type: 'newJourney', id: 'first', date: '2026-10-19' })).toBe(returned)
  })
})

describe('sleep inn local persistence boundary', () => {
  it('uses owner isolation, keeps dates per journey, and persists only validated game data', () => {
    const key = storageKey('account-a')!
    expect(key).not.toBe(storageKey('account-b'))
    expect(storageKey('')).toBeNull()
    expect(validDate('2026-02-31')).toBe(false)
    const storage = memoryStorage()
    const result = saveState(storage, key, completedState())
    expect(result.ok).toBe(true)
    const raw = storage.getItem(key)!
    const restored = parseState(raw)!
    expect(restored.postcards).toHaveLength(1)
    expect(activeJourney(restored).phase).toBe('complete')
    expect(activeJourney(restored).startedDate).toBe('2026-10-18')
    const tomorrow = transition(restored, { type: 'newJourney', id: 'tomorrow', date: '2026-10-19' })
    expect(activeJourney(tomorrow).startedDate).toBe('2026-10-19')
    expect(tomorrow.postcards[0]?.date).toBe('2026-10-18')
    expect(raw).not.toMatch(/sleepH|sleepQuality|entryId|journal|duration|elapsed/)
  })
  it('does not overwrite corrupted or concurrently updated storage', () => {
    const storage = memoryStorage(); const key = 'scope'
    storage.setItem(key, '{broken')
    expect(saveState(storage, key, puzzleState())).toEqual({ ok: false, reason: 'corrupt' })
    expect(storage.getItem(key)).toBe('{broken')
    storage.values.clear()
    const first = saveState(storage, key, puzzleState())
    expect(first.ok).toBe(true)
    const written = storage.getItem(key)
    expect(saveState(storage, key, completedState())).toEqual({ ok: false, reason: 'conflict' })
    expect(storage.getItem(key)).toBe(written)
  })
  it('reports a failed write without marking or mutating the candidate saved', () => {
    const state = completedState()
    const storage: StorageAccess = { getItem: () => null, setItem: () => { throw new Error('quota') } }
    expect(saveState(storage, 'key', state)).toEqual({ ok: false, reason: 'unavailable' })
    expect(state.revision).toBe(0)
  })
  it('rejects tampered completion, duplicate cards and invalid history on reload', () => {
    const state = { ...completedState(), revision: 1 }
    expect(parseState(JSON.stringify(state))).not.toBeNull()
    expect(parseState(JSON.stringify({ ...state, postcards: [...state.postcards, ...state.postcards] }))).toBeNull()
    expect(parseState(JSON.stringify({ ...state, journeys: [{ ...activeJourney(state), layout: INITIAL_LAYOUT }] }))).toBeNull()
    expect(parseState(JSON.stringify({ ...state, journeys: [{ ...activeJourney(state), history: [['fox']] }] }))).toBeNull()
    expect(parseState('null')).toBeNull()
  })
})
