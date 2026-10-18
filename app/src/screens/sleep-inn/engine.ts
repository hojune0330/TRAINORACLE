import { DEFAULT_CONTEXT, DIRECTIONS, getChapter, isLayout, isPuzzleContext, isSolved, isValidLayout, swapOutcome } from './chapter-rules'
import type { ChapterId, Direction, LampMode, Layout, PuzzleContext, StoneMode } from './chapter-rules'
export * from './chapter-rules'

export type Phase = 'intro' | 'discovery' | 'puzzle' | 'night' | 'resting' | 'upgrade' | 'complete' | 'seasonComplete'
export type NightStep = 'blanket' | 'curtain' | 'lamp'
export interface Journey extends PuzzleContext {
  id: string; startedDate: string; phase: Phase; introStep: number; layout: Layout; history: Layout[]
  historyDirections: Direction[]; night: Record<NightStep, boolean>
}
export interface Postcard extends PuzzleContext { journeyId: string; date: string; layout: Layout }
export interface InnState { version: 2; revision: number; activeJourneyId: string; journeys: Journey[]; postcards: Postcard[] }
export const postcardKey = (card: Pick<Postcard, 'journeyId' | 'chapter'>) => `${card.journeyId}:${card.chapter}`
export const activeJourney = (state: InnState): Journey => state.journeys.find(journey => journey.id === state.activeJourneyId)!
const freshNight = (): Record<NightStep, boolean> => ({ blanket: false, curtain: false, lamp: false })
export function createJourney(id: string, startedDate: string): Journey {
  return { ...DEFAULT_CONTEXT, id, startedDate, phase: 'intro', introStep: 0, layout: getChapter(1).initialLayout, history: [], historyDirections: [], night: freshNight() }
}
export function createState(date: string, id: string): InnState {
  return { version: 2, revision: 0, activeJourneyId: id, journeys: [createJourney(id, date)], postcards: [] }
}
export type InnAction = { type: 'nextIntro' | 'skipIntro' | 'discover' | 'undo' | 'reset' | 'confirm' | 'rest' | 'awake' | 'nextChapter' | 'rotateLamp' }
  | { type: 'swap'; from: number; to: number } | { type: 'night'; step: NightStep }
  | { type: 'chooseLamp'; mode: LampMode } | { type: 'chooseStone'; mode: StoneMode }
  | { type: 'newJourney'; id: string; date: string } | { type: 'revisit' | 'resumeJourney'; id: string }
const remember = (journey: Journey) => ({ history: [...journey.history, [...journey.layout]], historyDirections: [...journey.historyDirections, journey.lampDirection] })
export function transition(state: InnState, action: InnAction): InnState {
  const current = activeJourney(state)
  if (action.type === 'newJourney') {
    if (!validId(action.id) || !validDate(action.date) || state.journeys.some(j => j.id === action.id)) return state
    return { ...state, activeJourneyId: action.id, journeys: [...state.journeys, createJourney(action.id, action.date)] }
  }
  if (action.type === 'revisit' || action.type === 'resumeJourney') {
    if (action.id === state.activeJourneyId || !state.journeys.some(j => j.id === action.id)) return state
    return { ...state, activeJourneyId: action.id }
  }
  let next = current
  let postcards = state.postcards
  switch (action.type) {
    case 'nextIntro':
      if (current.phase === 'intro') next = current.introStep < 2 ? { ...current, introStep: current.introStep + 1 } : { ...current, phase: 'night' }
      break
    case 'skipIntro': if (current.phase === 'intro') next = { ...current, phase: 'night' }; break
    case 'discover': if (current.phase === 'discovery') next = { ...current, phase: getChapter(current).upgrade ? 'upgrade' : 'puzzle' }; break
    case 'chooseLamp':
      if (current.phase === 'upgrade' && current.chapter === 4 && ['soft', 'hooded'].includes(action.mode)) {
        next = { ...current, lampMode: action.mode, lampDirection: 'north', phase: 'puzzle', history: [], historyDirections: [] }
      }
      break
    case 'chooseStone':
      if (current.phase === 'upgrade' && current.chapter === 5 && ['small', 'long'].includes(action.mode)) {
        const context = { ...current, stoneMode: action.mode }
        next = { ...context, layout: getChapter(context).initialLayout, phase: 'puzzle', history: [], historyDirections: [] }
      }
      break
    case 'swap': {
      const layout = current.phase === 'puzzle' ? swapOutcome(current.layout, action.from, action.to, current) : null
      if (layout) next = { ...current, ...remember(current), layout }
      break
    }
    case 'rotateLamp':
      if (current.phase === 'puzzle' && current.chapter >= 4 && current.lampMode === 'hooded') {
        next = { ...current, ...remember(current), lampDirection: DIRECTIONS[(DIRECTIONS.indexOf(current.lampDirection) + 1) % 4]! }
      }
      break
    case 'undo':
      if (current.phase === 'puzzle' && current.history.length) next = { ...current, layout: [...current.history.at(-1)!], lampDirection: current.historyDirections.at(-1)!, history: current.history.slice(0, -1), historyDirections: current.historyDirections.slice(0, -1) }
      break
    case 'reset': {
      const initial = getChapter(current).initialLayout
      if (current.phase === 'puzzle' && (current.layout.some((p, i) => p !== initial[i]) || current.lampDirection !== 'north')) next = { ...current, ...remember(current), layout: initial, lampDirection: 'north' }
      break
    }
    case 'confirm':
      if (current.phase === 'puzzle' && isSolved(current.layout, current)) {
        next = { ...current, phase: current.chapter === 5 ? 'seasonComplete' : 'complete' }
        const card: Postcard = { journeyId: current.id, date: current.startedDate, chapter: current.chapter, layout: [...current.layout], lampMode: current.lampMode, lampDirection: current.lampDirection, stoneMode: current.stoneMode }
        if (!postcards.some(saved => postcardKey(saved) === postcardKey(card))) postcards = [...postcards, card]
      }
      break
    case 'nextChapter':
      if (current.phase === 'complete' && current.chapter < 5) {
        const context: PuzzleContext = { ...current, chapter: (current.chapter + 1) as ChapterId, lampDirection: 'north' }
        next = { ...current, ...context, phase: 'intro', introStep: 0, layout: getChapter(context).initialLayout, history: [], historyDirections: [], night: freshNight() }
      }
      break
    case 'night': if (current.phase === 'night' && ['blanket', 'curtain', 'lamp'].includes(action.step)) next = { ...current, night: { ...current.night, [action.step]: !current.night[action.step] } }; break
    case 'rest': if (current.phase === 'night') next = { ...current, phase: 'resting' }; break
    case 'awake': if (current.phase === 'resting') next = { ...current, phase: 'discovery' }; break
  }
  return next === current ? state : { ...state, journeys: state.journeys.map(j => j.id === current.id ? next : j), postcards }
}

const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
const validId = (value: unknown): value is string => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,80}$/.test(value)
export function validDate(date: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(`${date}T00:00:00Z`)) && new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) === date
}
/** Keep the existing key so upgrading the game never strands a v1 journey. */
export function storageKey(scope: string): string | null { return scope.trim() ? `trainoracle:sleep-inn:v1:${encodeURIComponent(scope)}` : null }
function contextOf(value: Record<string, unknown>): PuzzleContext | null {
  if (!isPuzzleContext(value)) return null
  return { chapter: value.chapter as ChapterId, lampMode: value.lampMode as LampMode, lampDirection: value.lampDirection as Direction, stoneMode: value.stoneMode as StoneMode }
}
function migrateV1(value: Record<string, unknown>): Record<string, unknown> | null {
  if (!Array.isArray(value.journeys) || !Array.isArray(value.postcards)) return null
  const journeys = value.journeys.map(j => {
    if (!record(j) || !Array.isArray(j.history) || !isLayout(j.layout) || !j.history.every(isLayout)
      || !['intro', 'discovery', 'puzzle', 'night', 'resting', 'complete'].includes(j.phase as string)) return null
    return { ...j, ...DEFAULT_CONTEXT, historyDirections: j.history.map(() => 'north') }
  })
  const postcards = value.postcards.map(card => record(card) && isLayout(card.layout) ? { ...card, ...DEFAULT_CONTEXT } : null)
  return journeys.includes(null) || postcards.includes(null) ? null : { ...value, version: 2, journeys, postcards }
}
export function parseState(raw: string): InnState | null {
  try {
    if (raw.length > 2_000_000) return null
    const decoded: unknown = JSON.parse(raw)
    if (!record(decoded) || ![1, 2].includes(decoded.version as number)) return null
    const value = decoded.version === 1 ? migrateV1(decoded) : decoded
    if (!value || !Number.isSafeInteger(value.revision) || (value.revision as number) < 1
      || !validId(value.activeJourneyId) || !Array.isArray(value.journeys) || !value.journeys.length || !Array.isArray(value.postcards)) return null
    const journeys: Journey[] = []
    for (const j of value.journeys) {
      if (!record(j)) return null
      const context = contextOf(j)
      if (!context || !validId(j.id) || typeof j.startedDate !== 'string' || !validDate(j.startedDate) || !['intro', 'discovery', 'puzzle', 'night', 'resting', 'upgrade', 'complete', 'seasonComplete'].includes(j.phase as string)
        || !Number.isInteger(j.introStep) || (j.introStep as number) < 0 || (j.introStep as number) > 2 || !isValidLayout(j.layout, context)
        || !Array.isArray(j.history) || !j.history.every(layout => isValidLayout(layout, context)) || !Array.isArray(j.historyDirections)
        || j.historyDirections.length !== j.history.length || !j.historyDirections.every(d => DIRECTIONS.includes(d as Direction) && (context.chapter >= 4 || d === 'north'))
        || !record(j.night) || !['blanket', 'curtain', 'lamp'].every(step => typeof (j.night as Record<string, unknown>)[step] === 'boolean')) return null
      if ((j.phase === 'complete' || j.phase === 'seasonComplete') && !isSolved(j.layout, context)) return null
      if ((j.phase === 'seasonComplete') !== (context.chapter === 5 && (j.phase === 'complete' || j.phase === 'seasonComplete'))) return null
      if (j.phase === 'upgrade' && !getChapter(context).upgrade) return null
      journeys.push({ ...context, id: j.id, startedDate: j.startedDate, phase: j.phase as Phase, introStep: j.introStep as number,
        layout: [...j.layout], history: (j.history as Layout[]).map(l => [...l]), historyDirections: [...j.historyDirections] as Direction[],
        night: { blanket: j.night.blanket as boolean, curtain: j.night.curtain as boolean, lamp: j.night.lamp as boolean } })
    }
    if (new Set(journeys.map(j => j.id)).size !== journeys.length || !journeys.some(j => j.id === value.activeJourneyId)) return null
    const postcards: Postcard[] = []
    for (const card of value.postcards) {
      if (!record(card)) return null
      const context = contextOf(card)
      const journey = journeys.find(j => j.id === card.journeyId)
      if (!context || !validId(card.journeyId) || typeof card.date !== 'string' || !validDate(card.date) || !isValidLayout(card.layout, context) || !isSolved(card.layout, context)
        || !journey || journey.startedDate !== card.date || context.chapter > journey.chapter) return null
      if (context.chapter === journey.chapter && (!['complete', 'seasonComplete'].includes(journey.phase)
        || !journey.layout.every((p, i) => p === (card.layout as Layout)[i]) || journey.lampMode !== context.lampMode || journey.lampDirection !== context.lampDirection || journey.stoneMode !== context.stoneMode)) return null
      postcards.push({ ...context, journeyId: card.journeyId, date: card.date, layout: [...card.layout] })
    }
    if (new Set(postcards.map(postcardKey)).size !== postcards.length) return null
    for (const journey of journeys) {
      const completed = ['complete', 'seasonComplete'].includes(journey.phase) ? journey.chapter : journey.chapter - 1
      const cards = postcards.filter(card => card.journeyId === journey.id)
      if (cards.length !== completed || Array.from({ length: completed }, (_, i) => i + 1).some(chapter => !cards.some(card => card.chapter === chapter))) return null
      if (journey.chapter === 5 && cards.find(card => card.chapter === 4)?.lampMode !== journey.lampMode) return null
    }
    return { version: 2, revision: value.revision as number, activeJourneyId: value.activeJourneyId, journeys, postcards }
  } catch { return null }
}
export type StorageAccess = Pick<Storage, 'getItem' | 'setItem'>
export type SaveResult = { ok: true; state: InnState } | { ok: false; reason: 'unavailable' | 'corrupt' | 'conflict' }
export function saveState(storage: StorageAccess, key: string, state: InnState): SaveResult {
  try {
    const raw = storage.getItem(key)
    const stored = raw === null ? null : parseState(raw)
    if (raw !== null && !stored) return { ok: false, reason: 'corrupt' }
    if ((stored?.revision ?? 0) !== state.revision) return { ok: false, reason: 'conflict' }
    const next: InnState = { ...state, revision: state.revision + 1 }
    const serialized = JSON.stringify(next)
    if (!parseState(serialized)) return { ok: false, reason: 'corrupt' }
    storage.setItem(key, serialized)
    return { ok: true, state: next }
  } catch { return { ok: false, reason: 'unavailable' } }
}
