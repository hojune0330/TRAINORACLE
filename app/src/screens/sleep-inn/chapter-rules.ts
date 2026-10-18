export const PIECES = ['fox', 'screen', 'turtle', 'moth', 'lamp', 'stone'] as const
export type Piece = typeof PIECES[number] | 'letter' | 'empty' | 'stoneTail'
export type Layout = Piece[]
export type ChapterId = 1 | 2 | 3 | 4 | 5
export type Direction = 'north' | 'east' | 'south' | 'west'
export type LampMode = 'soft' | 'hooded'
export type StoneMode = 'small' | 'long'
export interface PuzzleContext { chapter: ChapterId; lampMode: LampMode; lampDirection: Direction; stoneMode: StoneMode }
export const DIRECTIONS: Direction[] = ['north', 'east', 'south', 'west']
export const DIRECTION_NAMES: Record<Direction, string> = { north: '위', east: '오른쪽', south: '아래', west: '왼쪽' }
export const PIECE_NAMES: Record<Piece, string> = { fox: '모루', screen: '가림막', turtle: '도담', moth: '루미', lamp: '등불', stone: '온돌돌', letter: '편지함', empty: '빈자리', stoneTail: '긴 온돌돌 끝' }
export const CELLS = ['A1', 'B1', 'C1', 'A2', 'B2', 'C2'] as const
export const INITIAL_LAYOUT: Layout = ['fox', 'turtle', 'moth', 'lamp', 'screen', 'stone']
export const SOLUTION: Layout = ['fox', 'screen', 'turtle', 'moth', 'lamp', 'stone']
export const DEFAULT_CONTEXT: PuzzleContext = { chapter: 1, lampMode: 'soft', lampDirection: 'north', stoneMode: 'small' }
export function isPuzzleContext(value: unknown): value is PuzzleContext {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const context = value as Record<string, unknown>
  return [1, 2, 3, 4, 5].includes(context.chapter as number) && ['soft', 'hooded'].includes(context.lampMode as string)
    && DIRECTIONS.includes(context.lampDirection as Direction) && ['small', 'long'].includes(context.stoneMode as string)
    && ((context.chapter as number) >= 4 || (context.lampMode === 'soft' && context.lampDirection === 'north'))
    && (context.lampMode !== 'soft' || context.lampDirection === 'north')
    && ((context.chapter as number) >= 5 || context.stoneMode === 'small')
}
export interface StoryBeat { title: string; text: string; piece: Piece }
export interface Chapter {
  id: ChapterId; title: string; subtitle: string; discovery: string; completion: string
  story: StoryBeat[]; cols: 3 | 4; rows: 2; cells: string[]; initialLayout: Layout
  lockedCells: number[]; wetCells: number[]; windowCells: number[]; upgrade?: 'lamp' | 'stone'
}
const STORIES: Record<ChapterId, [string, string, string, string, string]> = {
  1: ['꺼진 여관에 불 하나', '다른 부탁, 같은 지붕', '모루는 어두운 가림막 옆을, 도담은 따뜻한 돌 옆을 찾아요. 루미는 등불 옆이 좋아요.', '세 손님이 처음으로 한 방에 머물렀어요. 빈 여관에 작은 숨소리가 생겼어요.', '문을 닫은 지 오래된 여관에, 세 손님이 찾아왔어요.'],
  2: ['창가에 남은 편지', '창가와 안쪽 자리', '옛 편지에는 “모루에게는 창가, 도담에게는 안쪽”이라고 쓰여 있어요. 기존 부탁도 함께 맞춰요.', '창가에 앉은 모루가 편지의 주인을 기억했어요. “이곳은 모두에게 같은 자리를 주지 않았어.”', '창틀 아래에서 빛바랜 편지 한 장을 발견했어요.'],
  3: ['비 오는 밤의 빈자리', '젖은 두 칸, 움직이지 않는 돌', 'A1·B1에 빗물이 떨어져요. 손님 셋은 마른 곳에, 온돌돌은 고정된 B2에 두어요. 가림막과 등불은 젖은 칸에도 놓을 수 있어요.', '세 손님이 마른 자리를 찾았어요. 움직이지 않는 것도 함께 머무는 방법이 되었어요.', '지붕 위로 비가 내렸어요. 온돌돌은 바닥에 붙어 움직이지 않아요.'],
  4: ['서로 다른 좋은 자리', '빛의 모양을 고르는 밤', '둥근등은 이웃 네 방향을 밝혀요. 가림등은 가리킨 한 칸만 밝혀요. 루미에게 빛을, 모루에게 어둠을 남겨 주세요.', '등불이 더 밝아진 것이 아니라, 필요한 곳을 비추게 되었어요.', '루미는 빛 가까이 오고 싶지만, 모루는 눈이 부셔요. 어떤 등불을 둘까요?'],
  5: ['같은 지붕 아래', '여덟 칸에 남길 마지막 편지', '방이 여덟 칸으로 넓어졌어요. 편지함은 창가에, 손님은 빗물이 드는 A1·D1을 피해 주세요. 긴 온돌돌은 가로 두 칸을 차지해요.', '다른 부탁을 가진 손님들이 같은 지붕 아래 머물렀어요. 여관의 다음 이야기는 당신의 새 배치에서 시작돼요.', '수리한 옆방의 문을 열었어요. 이제 여덟 칸에 손님과 편지함을 함께 놓을 수 있어요.'],
}
export function getChapter(value: PuzzleContext | ChapterId = 1): Chapter {
  const id = typeof value === 'number' ? value : value.chapter
  const context = typeof value === 'number' ? { ...DEFAULT_CONTEXT, chapter: value } : value
  const [title, subtitle, discovery, completion, opening] = STORIES[id]
  const cols = id === 5 ? 4 : 3
  const initialLayout: Layout = id === 3 ? ['fox', 'turtle', 'moth', 'lamp', 'stone', 'screen']
    : id === 5 ? context.stoneMode === 'long'
      ? ['fox', 'turtle', 'moth', 'letter', 'stone', 'stoneTail', 'screen', 'lamp']
      : ['fox', 'turtle', 'moth', 'letter', 'lamp', 'screen', 'empty', 'stone']
      : [...INITIAL_LAYOUT]
  return { id, title, subtitle, discovery, completion, cols, rows: 2,
    cells: Array.from({ length: cols * 2 }, (_, i) => `${String.fromCharCode(65 + i % cols)}${Math.floor(i / cols) + 1}`),
    initialLayout, lockedCells: id === 3 ? [4] : [], wetCells: id === 3 ? [0, 1] : id === 5 ? [0, 3] : [],
    windowCells: id >= 2 ? Array.from({ length: cols }, (_, i) => i) : [], upgrade: id === 4 ? 'lamp' : id === 5 ? 'stone' : undefined,
    story: [{ title, text: opening, piece: id === 2 ? 'letter' : 'fox' },
      { title: subtitle, text: discovery, piece: id === 3 ? 'stone' : id === 4 ? 'lamp' : 'turtle' },
      { title: '오늘의 방을 준비해요', text: '서두르지 않아도 괜찮아요. 원하는 만큼 되돌리거나, 여정을 보관하고 새로 시작할 수 있어요.', piece: 'moth' }],
  }
}
export function isLayout(value: unknown): value is Layout {
  return Array.isArray(value) && value.length === 6 && new Set(value).size === 6 && value.every(piece => PIECES.includes(piece as typeof PIECES[number]))
}
export function isValidLayout(value: unknown, context: PuzzleContext = DEFAULT_CONTEXT): value is Layout {
  if (!Array.isArray(value) || !isPuzzleContext(context)) return false
  const chapter = getChapter(context)
  const expected: Piece[] = [...PIECES, ...(context.chapter === 5 ? ['letter', context.stoneMode === 'long' ? 'stoneTail' : 'empty'] as Piece[] : [])]
  if (value.length !== expected.length || new Set(value).size !== value.length || !value.every(p => expected.includes(p as Piece))) return false
  if (chapter.lockedCells.some(i => value[i] !== chapter.initialLayout[i])) return false
  if (context.chapter === 5 && context.stoneMode === 'long') {
    const stone = value.indexOf('stone')
    if (stone % 4 === 3 || value[stone + 1] !== 'stoneTail') return false
  }
  return true
}
export function adjacent(a: number, b: number, cols = 3, rows = 2): boolean {
  return Number.isInteger(a) && Number.isInteger(b) && a >= 0 && b >= 0 && a < cols * rows && b < cols * rows
    && Math.abs(a % cols - b % cols) + Math.abs(Math.floor(a / cols) - Math.floor(b / cols)) === 1
}
export function litCells(layout: Layout, context: PuzzleContext): number[] {
  const { cols, rows } = getChapter(context)
  const lamp = layout.indexOf('lamp')
  if (lamp < 0) return []
  const neighbours = Array.from({ length: cols * rows }, (_, i) => i).filter(i => adjacent(lamp, i, cols, rows))
  if (context.lampMode === 'soft') return neighbours
  const delta = context.lampDirection === 'north' ? -cols : context.lampDirection === 'south' ? cols : context.lampDirection === 'east' ? 1 : -1
  return neighbours.filter(i => i === lamp + delta)
}
export interface RuleResult { id: string; label: string; satisfied: boolean }
export function evaluate(layout: Layout, context: PuzzleContext = DEFAULT_CONTEXT): RuleResult[] {
  if (!isPuzzleContext(context)) return [{ id: 'INVALID_CONTEXT', label: '이 장에서 사용할 수 없는 시설이에요.', satisfied: false }]
  const valid = isValidLayout(layout, context)
  const chapter = getChapter(context)
  const near = (a: Piece, b: Piece) => valid && adjacent(layout.indexOf(a), layout.indexOf(b), chapter.cols)
  const lit = litCells(layout, context)
  const rules: RuleResult[] = [
    { id: 'FOX_SCREEN', label: '모루는 가림막 옆', satisfied: near('fox', 'screen') },
    { id: 'FOX_NO_LAMP', label: context.chapter >= 4 ? '모루 자리에는 빛이 닿지 않게' : '모루는 등불과 떨어져', satisfied: valid && !lit.includes(layout.indexOf('fox')) },
    { id: 'TURTLE_STONE', label: context.stoneMode === 'long' ? '도담은 긴 온돌돌 어느 쪽이든 옆' : '도담은 온돌돌 옆', satisfied: near('turtle', 'stone') || (context.chapter === 5 && context.stoneMode === 'long' && near('turtle', 'stoneTail')) },
    { id: 'MOTH_LAMP', label: context.chapter >= 4 ? '루미 자리에는 등불의 빛이 닿게' : '루미는 등불 옆', satisfied: valid && lit.includes(layout.indexOf('moth')) },
  ]
  if (context.chapter === 2) rules.push(
    { id: 'FOX_WINDOW', label: '모루는 창가 줄(A1·B1·C1)', satisfied: valid && chapter.windowCells.includes(layout.indexOf('fox')) },
    { id: 'TURTLE_INSIDE', label: '도담은 안쪽 줄(A2·B2·C2)', satisfied: valid && !chapter.windowCells.includes(layout.indexOf('turtle')) },
  )
  if (context.chapter === 3 || context.chapter === 5) rules.push({ id: 'GUESTS_DRY', label: `손님 셋은 젖은 ${chapter.wetCells.map(i => chapter.cells[i]).join('·')}를 피해`, satisfied: valid && ['fox', 'turtle', 'moth'].every(p => !chapter.wetCells.includes(layout.indexOf(p as Piece))) })
  if (context.chapter === 3) rules.push({ id: 'STONE_FIXED', label: '온돌돌은 고정된 B2', satisfied: valid && layout[4] === 'stone' })
  if (context.chapter === 4) rules.push({ id: 'LAMP_INSIDE', label: '등불은 안쪽 줄(A2·B2·C2)', satisfied: valid && !chapter.windowCells.includes(layout.indexOf('lamp')) })
  if (context.chapter === 5) rules.push({ id: 'LETTER_WINDOW', label: '편지함은 창가 줄', satisfied: valid && chapter.windowCells.includes(layout.indexOf('letter')) })
  return rules
}
export const isSolved = (layout: Layout, context: PuzzleContext = DEFAULT_CONTEXT) => evaluate(layout, context).every(rule => rule.satisfied)

/** A long stone is one horizontal two-cell object: move both ends or reject the move. */
export function swapOutcome(layout: Layout, from: number, to: number, context: PuzzleContext = DEFAULT_CONTEXT): Layout | null {
  if (!isValidLayout(layout, context) || from === to || ![from, to].every(i => Number.isInteger(i) && i >= 0 && i < layout.length)) return null
  const next = [...layout]
  const long = context.chapter === 5 && context.stoneMode === 'long'
  const bundle = (i: number) => long && (layout[i] === 'stone' || layout[i] === 'stoneTail')
  if (bundle(from) || bundle(to)) {
    if (bundle(from) && bundle(to)) return null
    const selected = bundle(from) ? from : to
    const destination = bundle(from) ? to : from
    const sourceAnchor = layout.indexOf('stone')
    const targetAnchor = destination - (layout[selected] === 'stoneTail' ? 1 : 0)
    if (targetAnchor < 0 || targetAnchor >= 7 || targetAnchor % 4 === 3) return null
    const source = [sourceAnchor, sourceAnchor + 1]; const target = [targetAnchor, targetAnchor + 1]
    const freed = source.filter(i => !target.includes(i)); const displaced = target.filter(i => !source.includes(i))
    freed.forEach((i, k) => { next[i] = layout[displaced[k]!]! })
    next[targetAnchor] = 'stone'; next[targetAnchor + 1] = 'stoneTail'
  } else [next[from], next[to]] = [next[to]!, next[from]!]
  return isValidLayout(next, context) ? next : null
}
export const canSwap = (context: PuzzleContext & { layout: Layout }, from: number, to: number): boolean => swapOutcome(context.layout, from, to, context) !== null
const solutionCache = new Map<string, Layout[]>()
export function solveLayouts(context: PuzzleContext = DEFAULT_CONTEXT): Layout[] {
  const key = `${context.chapter}:${context.lampMode}:${context.lampDirection}:${context.stoneMode}`
  const cached = solutionCache.get(key)
  if (cached) return cached.map(layout => [...layout])
  const results: Layout[] = []
  const visit = (prefix: Layout, remaining: Layout) => {
    if (!remaining.length) { if (isSolved(prefix, context)) results.push(prefix); return }
    remaining.forEach((piece, index) => visit([...prefix, piece], remaining.filter((_, i) => i !== index)))
  }
  visit([], getChapter(context).initialLayout)
  solutionCache.set(key, results)
  return results.map(layout => [...layout])
}
export type HintAction = { type: 'swap'; from: number; to: number } | { type: 'rotateLamp' }
const hintCache = new Map<string, HintAction>()
/** Breadth-first legal moves guarantee that a hint leads toward a real solution, including rotation and footprint movement. */
export function getHintAction(layout: Layout, context: PuzzleContext = DEFAULT_CONTEXT): HintAction | null {
  if (!isValidLayout(layout, context) || isSolved(layout, context)) return null
  const cacheKey = `${context.chapter}:${context.lampMode}:${context.stoneMode}:${context.lampDirection}:${layout.join(',')}`
  const cachedHint = hintCache.get(cacheKey)
  if (cachedHint) return { ...cachedHint }
  const queue: { layout: Layout; direction: Direction; first: HintAction | null }[] = [{ layout, direction: context.lampDirection, first: null }]
  const seen = new Set([`${layout.join(',')}:${context.lampDirection}`])
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const node = queue[cursor]!
    const current = { ...context, lampDirection: node.direction }
    const candidates: { layout: Layout; direction: Direction; action: HintAction }[] = []
    for (let a = 0; a < layout.length; a++) for (let b = a + 1; b < layout.length; b++) {
      const next = swapOutcome(node.layout, a, b, current)
      if (next) candidates.push({ layout: next, direction: node.direction, action: { type: 'swap', from: a, to: b } })
    }
    if (context.chapter >= 4 && context.lampMode === 'hooded') candidates.push({ layout: node.layout, direction: DIRECTIONS[(DIRECTIONS.indexOf(node.direction) + 1) % 4]!, action: { type: 'rotateLamp' } })
    for (const next of candidates) {
      const key = `${next.layout.join(',')}:${next.direction}`
      if (seen.has(key)) continue
      const first = node.first ?? next.action
      if (isSolved(next.layout, { ...context, lampDirection: next.direction })) { hintCache.set(cacheKey, first); return first }
      seen.add(key); queue.push({ layout: next.layout, direction: next.direction, first })
    }
  }
  return null
}
export function getHint(layout: Layout, context: PuzzleContext = DEFAULT_CONTEXT): string {
  if (!isValidLayout(layout, context)) return '각 조각의 자리와 고정된 시설을 확인해 주세요.'
  if (isSolved(layout, context)) return '모두 자리를 찾았어요. 이 배치로 준비해 보세요.'
  const move = getHintAction(layout, context)
  if (!move) return '등불의 종류와 고정 시설을 확인해 주세요.'
  if (move.type === 'rotateLamp') return '가림등을 시계 방향으로 한 번 돌려 보세요.'
  const cells = getChapter(context).cells
  return `${cells[move.from]}의 ${PIECE_NAMES[layout[move.from]!]}, ${cells[move.to]}의 ${PIECE_NAMES[layout[move.to]!]}: 두 자리를 바꿔 보세요.`
}
