import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { CSSProperties, KeyboardEvent } from 'react'
import { ArrowLeft, ArrowRight, BookOpen, Check, ChevronRight, Lightbulb, Mail, Map, Moon, RotateCcw, Sun, Undo2, Users, LockKeyhole, Play, Archive, Plus, Compass } from 'lucide-react'
import type { SleepInnGameProps } from './types'
import { activeJourney, canSwap, createState, evaluate, getChapter, getHint, isSolved, litCells, parseState, PIECE_NAMES, saveState, storageKey, transition, validDate } from './engine'
import type { ChapterId, InnAction, InnState, Journey, NightStep, Piece } from './engine'
import { SleepInnSocial } from './SleepInnSocial'
import { hasSleepInnInviteFragment } from './social'
import './sleep-inn.css'

const asset = `${import.meta.env.BASE_URL}games/sleep-inn/`
const SPRITE_POSITIONS: Partial<Record<Piece, string>> = { fox: '0% 0%', turtle: '50% 0%', moth: '100% 0%', screen: '0% 100%', lamp: '50% 100%', stone: '100% 100%', stoneTail: '100% 100%' }
const DIRECTION_NAMES = { north: '위', east: '오른쪽', south: '아래', west: '왼쪽' } as const
const newId = () => `j_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
type Initial = { state: InnState; blocked: boolean; message: string; saved: boolean }

function loadInitial(scope: string, date: string): Initial {
  const state = createState(date, newId())
  const key = storageKey(scope)
  if (!key) return { state, blocked: true, saved: false, message: '보관 대상을 확인할 수 없어 게임 진행을 저장할 수 없어요.' }
  try {
    const raw = window.localStorage.getItem(key)
    if (raw === null) return validDate(date) ? { state, blocked: false, saved: false, message: '' }
      : { state, blocked: true, saved: false, message: '기록 날짜를 확인할 수 없어 새 여정을 저장할 수 없어요.' }
    const stored = parseState(raw)
    return stored ? { state: stored, blocked: false, saved: true, message: '' }
      : { state, blocked: true, saved: false, message: '보관된 여관을 읽지 못했어요. 기존 저장은 그대로 두었고, 지금 조작은 이 화면에만 남아요.' }
  } catch {
    return { state, blocked: true, saved: false, message: '기기 저장을 읽을 수 없어요. 기존 여관을 확인할 때까지 이 화면에서만 진행해요.' }
  }
}

export function SleepInnGame(props: SleepInnGameProps) {
  // Date and journal edits only change the read-only context, never the active journey.
  return <SleepInnSession key={props.persistenceScope} {...props} />
}

function Sprite({ piece, className = '', upgrade, direction = 'south' }: { piece: Piece; className?: string; upgrade?: 'hooded' | 'long'; direction?: Journey['lampDirection'] }) {
  if (piece === 'empty') return <span aria-hidden="true" className={`inn-sprite inn-sprite--empty ${className}`} />
  if (piece === 'stoneTail') return <span aria-hidden="true" className={`inn-sprite inn-sprite--stoneTail ${className}`} />
  if (piece === 'letter' || upgrade) return <span aria-hidden="true" className={`inn-sprite inn-sprite--${piece} inn-sprite--single${upgrade ? ` inn-sprite--${upgrade}` : ''} ${className}`} style={{ backgroundImage: `url("${asset}${piece === 'letter' ? 'tripo/sealed-letter-south' : upgrade === 'hooded' ? `tripo/hooded-lamp-${direction}` : 'tripo/long-warm-stone-south'}.png")` }} />
  return <span aria-hidden="true" className={`inn-sprite inn-sprite--${piece} ${className}`} style={{ backgroundImage: `url("${asset}pieces.png")`, backgroundPosition: SPRITE_POSITIONS[piece] }} />
}

function Room({ journey, interactive = false, selected, onSelect, onKey, cellRefs, miniature = false }: {
  journey: Journey
  interactive?: boolean
  selected?: number | null
  onSelect?: (index: number) => void
  onKey?: (event: KeyboardEvent<HTMLButtonElement>, index: number) => void
  cellRefs?: React.MutableRefObject<(HTMLButtonElement | null)[]>
  miniature?: boolean
}) {
  const chapter = getChapter(journey)
  const cols = chapter.cols
  const illuminated = journey.chapter >= 4 ? litCells(journey.layout, journey) : []
  const night = journey.phase === 'night' || journey.phase === 'resting'
  const dim = night && (journey.night.lamp || journey.phase === 'resting')
  return <div className={`inn-room inn-room--chapter-${chapter.id}${cols === 4 ? ' inn-room--expanded' : ''}${night ? ' inn-room--night' : ''}${dim ? ' inn-room--dim' : ''}${miniature ? ' inn-room--mini' : ''}`} role="group" aria-label={interactive ? cols === 3 ? '여섯 칸 객실 배치' : '여덟 칸 객실 배치' : '세 손님의 여관'}>
    <img className="inn-room__background" src={`${asset}room.png`} alt="" draggable={false} />
    {chapter.id >= 2 && <span className="inn-room__window" aria-hidden="true"><span /></span>}
    {chapter.wetCells.length > 0 && <div className="inn-room__rain" aria-hidden="true"><i /><i /><i /><i /><i /></div>}
    {night && journey.night.curtain && <span className="inn-room__curtain" aria-hidden="true" />}
    {journey.layout.map((piece, index) => {
      const x = cols === 3 ? [26, 50, 74][index % cols]! : [20, 40, 60, 80][index % cols]!
      const y = index < cols ? 51 : 72
      const locked = chapter.lockedCells.includes(index)
      const wet = chapter.wetCells.includes(index)
      const windowSide = chapter.windowCells.includes(index)
      const near = selected !== null && selected !== undefined && Math.abs(selected % cols - index % cols) + Math.abs(Math.floor(selected / cols) - Math.floor(index / cols)) === 1
      const style = { left: `${x}%`, top: `${y}%`, zIndex: index < cols ? 2 : 3 } as CSSProperties
      const classes = `inn-cell${index < cols ? ' inn-cell--back' : ''}${selected === index ? ' inn-cell--selected' : ''}${near ? ' inn-cell--neighbor' : ''}${locked ? ' inn-cell--locked' : ''}${wet ? ' inn-cell--wet' : ''}${windowSide ? ' inn-cell--window' : ''}${illuminated.includes(index) ? ' inn-cell--lit' : ''}${night && journey.night.blanket && ['fox', 'turtle', 'moth'].includes(piece) ? ' inn-cell--blanket' : ''}`
      const content = <><span className="inn-cell__floor" aria-hidden="true" />{piece === 'lamp' && journey.lampMode === 'hooded' && <span className={`inn-light-beam inn-light-beam--${journey.lampDirection}`} aria-hidden="true" />}<Sprite piece={piece} direction={journey.lampDirection} upgrade={piece === 'lamp' && journey.lampMode === 'hooded' ? 'hooded' : piece === 'stone' && journey.stoneMode === 'long' ? 'long' : undefined} />{interactive && <span className="inn-cell__name" aria-hidden="true"><span className="inn-cell__coordinate">{chapter.cells[index]}</span>{locked && <LockKeyhole size={10} />}<span>{piece === 'stoneTail' ? '온돌 끝' : PIECE_NAMES[piece]}</span></span>}</>
      return interactive ? <button key={index} ref={node => { if (cellRefs) cellRefs.current[index] = node }} type="button" className={classes} style={style}
        aria-label={`${chapter.cells[index]} ${PIECE_NAMES[piece]}${locked ? ' 고정' : ''}${wet ? ' 비 오는 자리' : ''}`} aria-pressed={selected === index} aria-disabled={locked} onClick={() => onSelect?.(index)} onKeyDown={event => onKey?.(event, index)}>
        {content}
      </button> : <div key={index} className={`${classes} inn-cell--still`} style={style}>{content}</div>
    })}
    {!miniature && chapter.id > 1 && <span className="inn-room__scene-label">{chapter.id === 2 ? '창가의 아침' : chapter.id === 3 ? '빗소리가 닿는 방' : chapter.id === 4 ? '불빛을 나누는 방' : '조금 더 넓어진 여관'}</span>}
  </div>
}

function SleepInnSession({ journal, persistenceScope, onBack, onOpenJournal, returnLabel = '돌아가기', onCanExitReady }: SleepInnGameProps) {
  const [initial] = useState(() => loadInitial(persistenceScope, journal.date))
  const [state, setState] = useState(initial.state)
  const stateRef = useRef(state)
  const [storageBlocked, setStorageBlocked] = useState(initial.blocked)
  const [saveError, setSaveError] = useState(initial.message)
  const [saved, setSaved] = useState(initial.saved)
  const pending = useRef<InnState | null>(null)
  const [selected, setSelected] = useState<number | null>(null)
  const [announcement, setAnnouncement] = useState('')
  const [hint, setHint] = useState('')
  const [archiveOpen, setArchiveOpen] = useState(false)
  const [mapOpen, setMapOpen] = useState(false)
  const [friendsOpen, setFriendsOpen] = useState(hasSleepInnInviteFragment)
  const [newJourneyPrompt, setNewJourneyPrompt] = useState(false)
  const [exitPrompt, setExitPrompt] = useState(false)
  const [facilityChoice, setFacilityChoice] = useState<'soft' | 'hooded' | 'small' | 'long' | null>(null)
  const [previewCardId, setPreviewCardId] = useState<string | null>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const cellRefs = useRef<(HTMLButtonElement | null)[]>([])
  const journey = activeJourney(state)
  const chapter = getChapter(journey)
  const intro = chapter.story
  const rules = evaluate(journey.layout, journey)
  const solved = isSolved(journey.layout, journey)
  const key = storageKey(persistenceScope)
  const previewCard = previewCardId ? state.postcards.find(card => `${card.journeyId}:${card.chapter}` === previewCardId) : undefined
  const previewJourney: Journey | undefined = previewCard ? { ...state.journeys.find(j => j.id === previewCard.journeyId)!, chapter: previewCard.chapter, layout: [...previewCard.layout], lampMode: previewCard.lampMode, lampDirection: previewCard.lampDirection, stoneMode: previewCard.stoneMode, phase: 'complete' } : undefined

  useLayoutEffect(() => {
    // The registered callback reads the live pending ref, including a write that
    // failed after registration. The parent owns history and native Escape.
    onCanExitReady?.(() => {
      if (!pending.current) return true
      setNewJourneyPrompt(false); setExitPrompt(true)
      return false
    })
    return () => onCanExitReady?.(null)
  }, [onCanExitReady])

  useEffect(() => {
    // Only explicit scene changes return to the scene heading. Swaps and journal
    // editing preserve the reader's scroll position.
    heading.current?.focus({ preventScroll: true })
    const dialog = heading.current?.closest('dialog')
    if (dialog) dialog.scrollTop = 0
  }, [journey.phase, journey.chapter, archiveOpen, mapOpen, friendsOpen, previewCardId, newJourneyPrompt, exitPrompt])

  function updateState(next: InnState) { stateRef.current = next; setState(next) }
  function commit(next: InnState, requireSave = false): boolean {
    pending.current = next
    let failure = '게임 진행을 기기에 저장하지 못했어요. 화면을 닫기 전에 다시 저장해 주세요.'
    if (!storageBlocked && key) {
      const result = (() => { try { return saveState(window.localStorage, key, next) } catch { return { ok: false as const, reason: 'unavailable' as const } } })()
      if (result.ok) {
        updateState(result.state); setSaveError(''); setSaved(true); pending.current = null
        return true
      }
      if (result.reason === 'conflict') failure = '다른 화면에서 여관이 바뀌었어요. 이 화면의 변경을 덮어쓰지 않았어요. 기기 저장을 다시 불러와 확인해 주세요.'
      if (result.reason === 'corrupt') { failure = '기존 여관을 읽지 못해 덮어쓰지 않았어요. 저장 내용을 확인할 때까지 완료 처리를 보류해요.'; setStorageBlocked(true) }
    } else if (saveError) failure = saveError
    if (!requireSave) updateState(next)
    setSaveError(failure); setSaved(false)
    return false
  }
  function act(action: InnAction, requireSave = false) {
    const next = transition(stateRef.current, action)
    if (next !== stateRef.current) commit(next, requireSave)
    setSelected(null); setHint('')
  }
  function reload() {
    const loaded = loadInitial(persistenceScope, journal.date)
    if (loaded.blocked) { setSaveError(loaded.message); setStorageBlocked(true); return }
    updateState(loaded.state); pending.current = null; setStorageBlocked(false); setSaved(loaded.saved); setSaveError(''); setSelected(null); setHint('')
  }
  function choose(index: number) {
    const current = activeJourney(stateRef.current)
    const layout = current.layout
    if (getChapter(current).lockedCells.includes(index)) { setHint(`${PIECE_NAMES[layout[index]!]}은 바닥에 고정되어 있어요. 다른 조각을 골라 주세요.`); setAnnouncement('고정된 자리는 움직일 수 없어요.'); return }
    if (selected === null) { setSelected(index); setAnnouncement(`${PIECE_NAMES[layout[index]!]} 선택. 바꿀 칸을 누르세요.`); return }
    if (selected === index) { setSelected(null); setAnnouncement('선택을 취소했어요.'); return }
    if (!canSwap(current, selected, index)) { setHint('긴 온돌자리는 가로로 맞닿은 두 칸이 필요해요. 옮길 칸을 고르면 그 자리에 있던 조각들과 자리를 바꿔요.'); setAnnouncement('이 자리로는 옮길 수 없어요. 다른 칸을 골라 주세요.'); return }
    const first = PIECE_NAMES[layout[selected]!]
    const second = PIECE_NAMES[layout[index]!]
    act({ type: 'swap', from: selected, to: index })
    setAnnouncement(`${first} · ${second}, 자리를 바꿨어요.`)
  }
  function cellKey(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key === 'Escape') { if (selected !== null) { event.preventDefault(); event.stopPropagation(); setSelected(null); setAnnouncement('선택을 취소했어요.') }; return }
    const cols = chapter.cols
    const last = journey.layout.length - 1
    const next = event.key === 'ArrowLeft' ? (index % cols ? index - 1 : index)
      : event.key === 'ArrowRight' ? (index % cols < cols - 1 ? index + 1 : index)
      : event.key === 'ArrowUp' ? Math.max(0, index - cols)
      : event.key === 'ArrowDown' ? Math.min(last, index + cols)
      : event.key === 'Home' ? 0 : event.key === 'End' ? last : null
    if (next !== null) { event.preventDefault(); cellRefs.current[next]?.focus({ preventScroll: true }) }
  }
  const phaseTitle = exitPrompt ? '저장하지 못한 변경이 있어요' : newJourneyPrompt ? '새 여관 문을 열까요?' : friendsOpen ? '엽서로 만나는 친구' : mapOpen ? '다섯 번의 작은 밤' : archiveOpen ? previewJourney ? `${previewJourney.chapter}장의 엽서` : '여관 엽서 보관함' : journey.phase === 'intro' ? intro[journey.introStep]!.title
    : journey.phase === 'discovery' ? journey.chapter === 1 ? '오늘, 세 손님이 왔어요' : chapter.title : journey.phase === 'puzzle' ? '모두의 자리를 찾아요'
    : journey.phase === 'upgrade' ? journey.chapter === 4 ? '어떤 불빛을 놓을까요?' : '따뜻함을 나눌까요?'
    : journey.phase === 'night' ? '여관을 닫을 시간' : journey.phase === 'resting' ? '잠시 쉬어 가요' : journey.phase === 'seasonComplete' ? '다시 찾아올 곳이 생겼어요' : `${journey.chapter}장의 엽서`
  const journalText = journal.status === 'recorded' ? '기존 수면 일지와 연결됨' : journal.status === 'draft' ? '일지에 작성 중인 내용이 있어요'
    : journal.status === 'unavailable' ? '일지 상태를 확인하지 못했어요' : '수면 기록 없이도 플레이할 수 있어요'
  const sleepMinutes = journal.status === 'recorded' && typeof journal.sleepH === 'number' && Number.isFinite(journal.sleepH) && journal.sleepH > 0 && journal.sleepH <= 24 ? Math.round(journal.sleepH * 60) : null
  // Same labels and 1-based values as the existing EveningCheckin sleep editor.
  const qualityLabels = ['최악', '나쁨', '보통', '좋음', '최고']
  const quality = journal.status === 'recorded' && Number.isInteger(journal.sleepQuality) ? qualityLabels[(journal.sleepQuality ?? 0) - 1] : undefined
  const sleepText = [sleepMinutes !== null ? `${Math.floor(sleepMinutes / 60) ? `${Math.floor(sleepMinutes / 60)}시간` : ''}${sleepMinutes % 60 ? `${sleepMinutes >= 60 ? ' ' : ''}${sleepMinutes % 60}분` : ''}` : null, quality ? `수면 질 ${quality}` : null].filter(Boolean).join(' · ')
  const nextChapter = getChapter(Math.min(5, journey.chapter + 1) as ChapterId)
  function openView(view: 'play' | 'map' | 'archive' | 'friends') {
    setArchiveOpen(view === 'archive'); setMapOpen(view === 'map'); setFriendsOpen(view === 'friends'); setPreviewCardId(null); setNewJourneyPrompt(false)
    setSelected(null); setHint(''); setFacilityChoice(null); setExitPrompt(false)
  }
  function handleBack() {
    if (pending.current) { setNewJourneyPrompt(false); setExitPrompt(true) }
    else onBack()
  }

  return <section className="sleep-inn" aria-label="꿈손님 여관">
    <header className="inn-header">
      <button type="button" className="inn-back" onClick={handleBack}><ArrowLeft size={18} aria-hidden="true" /><span>{returnLabel || '돌아가기'}</span></button>
      <span className="inn-brand">꿈손님 여관</span>
      <button type="button" className="inn-icon-button" aria-label="여관 엽서 보관함" onClick={() => openView('archive')}><Mail size={20} aria-hidden="true" />{state.postcards.length > 0 && <span className="inn-dot" />}</button>
    </header>
    <div className="inn-journal">
      <div><span>{journal.date}</span>{sleepText && <strong className="inn-journal__values">{sleepText}</strong>}<span>{journalText}{journal.sourceLabel ? ` · ${journal.sourceLabel}` : ''}</span></div>
      <button type="button" onClick={onOpenJournal} aria-label="기존 수면 일지 열기"><BookOpen size={17} aria-hidden="true" /><span>일지</span></button>
    </div>
    <nav className="inn-nav" aria-label="여관 둘러보기">
      <button type="button" aria-current={!archiveOpen && !mapOpen && !friendsOpen ? 'page' : undefined} onClick={() => openView('play')}><Moon size={16} aria-hidden="true" />내 여관</button>
      <button type="button" aria-current={mapOpen ? 'page' : undefined} onClick={() => openView('map')}><Map size={16} aria-hidden="true" />이야기</button>
      <button type="button" aria-current={archiveOpen ? 'page' : undefined} onClick={() => openView('archive')}><Archive size={16} aria-hidden="true" />보관함</button>
      <button type="button" aria-current={friendsOpen ? 'page' : undefined} onClick={() => openView('friends')}><Users size={16} aria-hidden="true" />친구</button>
    </nav>
    <main className="inn-main">
      <div className="inn-heading"><span className="inn-eyebrow">여울밤 · {journey.chapter} / 5장{!archiveOpen && !mapOpen && !friendsOpen ? ` · ${chapter.subtitle}` : ''}</span><h1 ref={heading} tabIndex={-1}>{phaseTitle}</h1></div>
      {saveError && <div className="inn-save-error" role="alert"><p>{saveError}</p>
        {!storageBlocked && <button type="button" onClick={() => commit(pending.current ?? stateRef.current, true)}>다시 저장하기</button>}
        <button type="button" onClick={reload}>기기 저장 다시 불러오기</button><small>다시 불러오면 이 화면의 미저장 변경 대신 기기에 보관된 여관을 열어요.</small>
      </div>}

      {!newJourneyPrompt && !exitPrompt && (friendsOpen ? <div className="inn-friends"><SleepInnSocial cards={state.postcards} /><button type="button" className="inn-text-button" onClick={() => openView('play')}>진행 중인 여관으로</button></div>
        : mapOpen ? <div className="inn-map">
          <p className="inn-copy">한 장마다 다른 부탁이 기다려요.<br />완성한 장면은 언제든 엽서로 다시 볼 수 있어요.</p>
          <ol className="inn-chapter-list">{([1, 2, 3, 4, 5] as const).map(number => {
            const item = getChapter(number)
            const card = state.postcards.find(p => p.journeyId === journey.id && p.chapter === number)
            const current = number === journey.chapter
            return <li key={number} className={card ? 'is-complete' : current ? 'is-current' : 'is-locked'}><span className="inn-chapter-number">{card ? <Check size={18} aria-hidden="true" /> : number}</span><div><strong>{item.title}</strong><p>{item.subtitle}</p><span>{card ? '엽서 보관됨' : current ? '진행 중' : '앞 이야기를 마치면 열려요'}</span></div>{card ? <button type="button" aria-label={`${number}장 엽서 보기`} onClick={() => { openView('archive'); setPreviewCardId(`${card.journeyId}:${card.chapter}`) }}><Mail size={18} aria-hidden="true" /></button> : current ? <button type="button" aria-label={`${number}장 이어하기`} onClick={() => openView('play')}><Play size={18} aria-hidden="true" /></button> : <LockKeyhole size={16} aria-hidden="true" />}</li>
          })}</ol>
          <button type="button" className="inn-button inn-button--primary" onClick={() => openView('play')}>진행 중인 여관으로<ArrowRight size={18} aria-hidden="true" /></button>
        </div>
        : archiveOpen ? <div className="inn-archive">
        {previewJourney ? <><Room journey={previewJourney} /><p className="inn-copy">{getChapter(previewJourney).completion}</p><p className="inn-footnote">{previewCard?.date}에 시작한 여정 · {previewJourney.chapter}장<br />보관한 장면을 보는 동안 진행 중인 여관은 바뀌지 않아요.</p><button type="button" className="inn-text-button" onClick={() => setPreviewCardId(null)}>엽서 목록으로</button></>
          : <><p className="inn-copy">날짜가 바뀌어도, 새로 시작해도<br />엽서와 진행 중이던 여정은 그대로 남아요.</p>
            <div className="inn-postcard-grid">{state.postcards.length ? state.postcards.map(card => {
              const cardJourney = { ...state.journeys.find(j => j.id === card.journeyId)!, ...card, id: card.journeyId, phase: 'complete' as const }
              return <button type="button" className="inn-postcard" key={`${card.journeyId}:${card.chapter}`} onClick={() => setPreviewCardId(`${card.journeyId}:${card.chapter}`)}><Room journey={cardJourney} miniature /><span>{card.chapter}장 · {getChapter(card.chapter).title}<ChevronRight size={16} aria-hidden="true" /></span><small>{card.date}</small></button>
            }) : <div className="inn-empty"><Mail size={32} aria-hidden="true" /><p>첫 이야기를 마치면 여기에 엽서가 남아요.</p></div>}</div>
            {state.journeys.length > 1 && <div className="inn-saved-journeys"><h2>이어갈 여정</h2>{state.journeys.map(item => <div key={item.id} className="inn-journey-row"><span><strong>{item.startedDate}에 연 여관</strong><small>{item.chapter}장 · {item.phase === 'seasonComplete' ? '이야기 완결' : getChapter(item).title}</small></span>{item.id === journey.id ? <span className="inn-current-tag">현재</span> : <button type="button" onClick={() => { const next = transition(stateRef.current, { type: 'resumeJourney', id: item.id }); if (commit(next, true)) openView('play') }}>이어하기</button>}</div>)}</div>}
            <button type="button" className="inn-button" onClick={() => setNewJourneyPrompt(true)}><Plus size={18} aria-hidden="true" />새 여정 시작</button>
          </>}
        <button type="button" className="inn-text-button" onClick={() => openView('play')}>진행 중인 여관으로</button>
      </div> : <>
        {journey.phase === 'intro' && <>
          <Room journey={journey} />
          <div className="inn-story"><Sprite piece={intro[journey.introStep]!.piece} /><p>{intro[journey.introStep]!.text}</p></div>
          <div className="inn-story-dots" aria-label={`이야기 ${journey.introStep + 1} / ${intro.length}`}>{intro.map((_, index) => <span key={index} className={index === journey.introStep ? 'is-current' : ''} />)}</div>
          <button type="button" className="inn-button inn-button--primary" onClick={() => act({ type: 'nextIntro' })}>{journey.introStep === 2 ? '밤 준비하기' : '이야기 계속'}<ArrowRight size={18} aria-hidden="true" /></button>
          <button type="button" className="inn-text-button" onClick={() => act({ type: 'skipIntro' })}>이야기 건너뛰기</button>
        </>}
        {journey.phase === 'discovery' && <>
          <Room journey={journey} />
          <div className="inn-story"><Sprite piece={journey.chapter === 2 ? 'moth' : journey.chapter === 3 ? 'turtle' : 'fox'} /><p>{chapter.discovery}</p></div>
          <button type="button" className="inn-button inn-button--primary" onClick={() => { setFacilityChoice(null); act({ type: 'discover' }) }}>{chapter.upgrade ? '새 시설 살펴보기' : '자리 정해 주기'}<ArrowRight size={18} aria-hidden="true" /></button>
        </>}
        {journey.phase === 'upgrade' && <>
          <Room journey={journey} />
          <p className="inn-copy">{chapter.upgrade === 'lamp' ? '빛을 넓게 나누거나, 필요한 곳에만 비춰요. 선택에 따라 자리 조건이 달라져요.' : '여관이 여덟 칸으로 넓어졌어요. 작은 돌의 자유로움과 긴 자리의 따뜻함 중 골라 보세요.'}</p>
          <div className="inn-upgrades" role="group" aria-label="시설 선택">
            {chapter.upgrade === 'lamp' ? <>
              <button type="button" aria-pressed={facilityChoice === 'soft'} className="inn-upgrade" onClick={() => setFacilityChoice('soft')}><Sprite piece="lamp" /><span><strong>작은 등불</strong><small>한 칸 · 모든 이웃을 비춤</small><span>루미는 등불 옆, 모루는 한 칸 떨어져요.</span></span><span className="inn-upgrade__check">{facilityChoice === 'soft' && <Check size={18} />}</span></button>
              <button type="button" aria-pressed={facilityChoice === 'hooded'} className="inn-upgrade inn-upgrade--hood" onClick={() => setFacilityChoice('hooded')}><span className="inn-upgrade__art"><Sprite piece="lamp" upgrade="hooded" /><Compass size={20} /></span><span><strong>가림등</strong><small>한 칸 · 한 방향으로 비춤</small><span>빛의 방향을 돌려 루미에게만 닿게 해요.</span></span><span className="inn-upgrade__check">{facilityChoice === 'hooded' && <Check size={18} />}</span></button>
            </> : <>
              <button type="button" aria-pressed={facilityChoice === 'small'} className="inn-upgrade" onClick={() => setFacilityChoice('small')}><Sprite piece="stone" /><span><strong>작은 온돌돌</strong><small>한 칸 · 빈자리 하나</small><span>도담 옆에 놓고 빈칸을 활용해요.</span></span><span className="inn-upgrade__check">{facilityChoice === 'small' && <Check size={18} />}</span></button>
              <button type="button" aria-pressed={facilityChoice === 'long'} className="inn-upgrade" onClick={() => setFacilityChoice('long')}><span className="inn-upgrade__art"><Sprite piece="stone" upgrade="long" /></span><span><strong>긴 온돌자리</strong><small>가로 두 칸 · 넓어진 주변 자리</small><span>도담이 앉을 수 있는 주변 자리가 늘어요. 빈칸은 없어져요.</span></span><span className="inn-upgrade__check">{facilityChoice === 'long' && <Check size={18} />}</span></button>
            </>}
          </div>
          <button type="button" className="inn-button inn-button--primary" disabled={!facilityChoice} onClick={() => { if (facilityChoice === 'soft' || facilityChoice === 'hooded') act({ type: 'chooseLamp', mode: facilityChoice }, true); else if (facilityChoice === 'small' || facilityChoice === 'long') act({ type: 'chooseStone', mode: facilityChoice }, true) }}>이 시설로 방 꾸미기<ArrowRight size={18} aria-hidden="true" /></button>
          <p className="inn-footnote">이 장의 퍼즐을 시작하기 전 고르는 시설이에요.</p>
        </>}
        {journey.phase === 'puzzle' && <>
          <p className="inn-instruction">조각을 고르고, 바꿀 자리를 눌러 주세요.</p>
          <Room journey={journey} interactive selected={selected} onSelect={choose} onKey={cellKey} cellRefs={cellRefs} />
          <div className="inn-selection" aria-live="polite">{selected === null ? '상하좌우만 이웃이에요. 대각선은 이웃이 아니에요.' : `${PIECE_NAMES[journey.layout[selected]!]} 선택 · 다른 칸과 바꾸거나 다시 눌러 취소`}</div>
          <div className="inn-tools"><button type="button" onClick={() => act({ type: 'undo' })} disabled={!journey.history.length}><Undo2 size={16} aria-hidden="true" />되돌리기</button><button type="button" onClick={() => act({ type: 'reset' })}><RotateCcw size={16} aria-hidden="true" />처음 배치</button><button type="button" onClick={() => setHint(getHint(journey.layout, journey))}><Lightbulb size={16} aria-hidden="true" />힌트</button></div>
          {journey.lampMode === 'hooded' && journey.chapter >= 4 && <button type="button" className="inn-lamp-control" onClick={() => { act({ type: 'rotateLamp' }); setAnnouncement('가림등을 시계 방향으로 돌렸어요.') }}><Compass size={18} aria-hidden="true" /><span>가림등 · {DIRECTION_NAMES[journey.lampDirection]} 비추는 중</span><RotateCcw size={16} aria-hidden="true" /><strong>돌리기</strong></button>}
          {chapter.wetCells.length > 0 && <p className="inn-board-note">물결 표시가 있는 칸은 비가 들어와요. 손님의 부탁에서 젖어도 되는 자리를 확인해 주세요.</p>}
          {journey.stoneMode === 'long' && journey.chapter === 5 && <p className="inn-board-note">긴 온돌자리는 가로 두 칸이 함께 움직여요. 바꿀 수 없는 배치는 그대로 유지돼요.</p>}
          {hint && <p className="inn-hint" role="status">{hint}</p>}
          <ul className="inn-rules" aria-label="손님들의 자리 조건">{rules.map(rule => <li key={rule.id} className={rule.satisfied ? 'is-met' : ''}><span className="inn-rule-mark" aria-hidden="true">{rule.satisfied ? <Check size={14} /> : '·'}</span><span>{rule.label}</span><small>{rule.satisfied ? '맞음' : '조정 필요'}</small></li>)}</ul>
          <button type="button" className="inn-button inn-button--primary" disabled={!solved} onClick={() => act({ type: 'confirm' }, true)}>이 배치로 준비<ChevronRight size={18} aria-hidden="true" /></button>
          <p className="inn-footnote">{solved ? '모두 자리를 찾았어요. 준비를 누르면 배치를 확정해요.' : `${rules.filter(rule => rule.satisfied).length} / ${rules.length}가지 부탁을 맞췄어요. 모두 맞추면 준비할 수 있어요.`}</p>
          <details className="inn-keyboard"><summary>키보드로 배치하기</summary><p>방향키로 칸 이동 · Enter 또는 Space로 선택과 교환 · Escape로 선택 취소</p></details>
        </>}
        {journey.phase === 'night' && <>
          <Room journey={journey} />
          <p className="inn-copy">마음이 가는 것만 정리해요. 바로 쉬어도 괜찮아요.</p>
          <div className="inn-night-actions">{([['blanket', '이불 덮기'], ['curtain', '커튼 닫기'], ['lamp', '불 끄기']] as [NightStep, string][]).map(([step, label]) => <button type="button" key={step} aria-pressed={journey.night[step]} onClick={() => act({ type: 'night', step })}><span>{label}</span><span className="inn-night-check">{journey.night[step] ? <Check size={18} aria-hidden="true" /> : <span aria-hidden="true">○</span>}</span></button>)}</div>
          <button type="button" className="inn-button inn-button--primary" onClick={() => act({ type: 'rest' })}><Moon size={18} aria-hidden="true" />바로 쉬기</button>
          <button type="button" className="inn-text-button" onClick={onOpenJournal}>일지로 돌아가기</button>
        </>}
        {journey.phase === 'resting' && <>
          <Room journey={journey} />
          <p className="inn-rest-message">여관 문을 살며시 닫았어요.<br />화면을 닫고 나중에 돌아와도 괜찮아요.</p>
          <p className="inn-footnote">수면을 측정하지 않아요. 지금 바로 이어가도 돼요.</p>
          <button type="button" className="inn-button inn-button--primary" onClick={() => act({ type: 'awake' }, true)}><Sun size={18} aria-hidden="true" />다시 왔어요</button>
          <button type="button" className="inn-text-button" onClick={handleBack}>{returnLabel || '돌아가기'}</button>
        </>}
        {(journey.phase === 'complete' || journey.phase === 'seasonComplete') && <>
          <div className="inn-complete-badge"><Check size={16} aria-hidden="true" />{journey.chapter}장 완성</div>
          <Room journey={journey} />
          <p className="inn-copy">{chapter.completion}</p>
          <p className="inn-postcard-saved"><Mail size={16} aria-hidden="true" />이 여정의 엽서가 기기에 보관되었어요.</p>
          {journey.chapter < 5 ? <><div className="inn-next-chapter"><span>이어지는 {journey.chapter + 1}장</span><strong>{nextChapter.title}</strong><p>{nextChapter.subtitle}</p></div><button type="button" className="inn-button inn-button--primary" onClick={() => act({ type: 'nextChapter' }, true)}>다음 이야기<ArrowRight size={18} aria-hidden="true" /></button></> : <><div className="inn-ending"><Mail size={24} aria-hidden="true" /><strong>다섯 장의 이야기를 모두 모았어요.</strong><p>“어디서 지내든, 쉴 곳 하나는 남겨 둘게.”<br />모루가 여관 열쇠를 당신에게 맡겼어요.</p></div><button type="button" className="inn-button inn-button--primary" onClick={() => openView('friends')}>친구에게 엽서 보여주기<Users size={18} aria-hidden="true" /></button></>}
          <button type="button" className="inn-text-button" onClick={onOpenJournal}>일지로 돌아가기</button>
          <div className="inn-complete-actions"><button type="button" onClick={() => openView('archive')}>엽서 다시 보기</button><button type="button" disabled={!validDate(journal.date)} onClick={() => setNewJourneyPrompt(true)}>새 여정 시작</button></div>
          <p className="inn-footnote">지금 나가도 이어할 수 있어요. 새 여정을 열어도 기존 여관과 엽서는 보관돼요.</p>
        </>}
      </>)}
      {newJourneyPrompt && <div className="inn-new-journey" role="group" aria-label="새 여정 시작 확인"><h2>이전 여정도 남아요</h2><p>지금 여정은 보관함에서 이어할 수 있어요. 일지와 엽서는 그대로 남아요.</p><button type="button" className="inn-button inn-button--primary" disabled={!validDate(journal.date)} onClick={() => { const next = transition(stateRef.current, { type: 'newJourney', id: newId(), date: journal.date }); if (commit(next, true)) openView('play') }}>보관하고 새로 시작</button><button type="button" className="inn-text-button" onClick={() => setNewJourneyPrompt(false)}>현재 여정 계속하기</button></div>}
      {exitPrompt && <div className="inn-new-journey" role="group" aria-label="저장되지 않은 여관 나가기"><p>이 화면의 마지막 변경은 아직 기기에 보관되지 않았어요. 기존에 저장한 여관은 남아 있어요.</p>{!storageBlocked && <button type="button" className="inn-button inn-button--primary" onClick={() => { if (commit(pending.current ?? stateRef.current, true)) onBack() }}>저장하고 돌아가기</button>}<button type="button" className="inn-text-button" onClick={() => setExitPrompt(false)}>계속 머물기</button><button type="button" className="inn-text-button" onClick={() => { pending.current = null; onBack() }}>저장하지 않고 돌아가기</button></div>}
      <p className="inn-storage-status">{saveError ? '게임 진행 · 저장되지 않은 변경이 있어요' : saved ? '게임 진행 · 이 기기에 저장됨' : '게임 진행은 이 기기에 보관돼요'}</p>
      <span className="inn-sr-only" role="status">{announcement}</span>
    </main>
  </section>
}

export default SleepInnGame
