import React from 'react'
import { ArrowLeft, ChevronRight, Check, Gamepad2, Trophy } from 'lucide-react'
import { GAME_CATALOG, loungeGame } from './game-catalog'
import type { LoungeGameId, LoungePlay } from './game-catalog'
import { SoloParty } from './SoloParty'
import { FriendArena } from './FriendArena'
import {getTDMap}
from '../../domain/minigame/tower-defense'
import type {TDMapId} from '../../domain/minigame/tower-defense'
import { TowerDefense } from './TowerDefense'
import { arenaInvitation } from './arena-types'
import { PartyIcon } from './PartyIcon'
import { loadTD, readTDRecords } from '../../domain/minigame/tower-defense-storage'
import { loadSoloCheckpoint, readSoloRecords, bestSoloRecord } from '../../domain/minigame/solo-party-storage'
import type { TDRecord } from '../../domain/minigame/tower-defense-storage'
import type { SoloRecord } from '../../domain/minigame/solo-party-storage'
import { useMinigameProgress } from '../../domain/minigame/progress-store'
import { TOUR_CITIES } from '../../domain/minigame/tour'
import { useSavedRun } from './useSavedRun'
import { useTaskFlowBack } from '../../hooks/useTaskFlowBack'
import './game-lounge.css'

const SleepInnLoungeEntry = React.lazy(() => import('../sleep-inn/SleepInnEntry').then(module => ({ default: module.SleepInnLoungeEntry })))

type Route = 'lounge' | 'tour' | 'solo' | 'friends' | 'defense' | 'legacy'
type Props = { onBack: () => void; backLabel: string; renderTour: (back: () => void, cityId?:string, onDefense?:()=>void) => React.ReactNode;
  onJournalSaved?: ((entry: import('../../domain/journal-store').JournalEntry) => void) | undefined }

/** Existing licensed/generated game art, with text always carrying the destination. */
function GameArt({ id, large = false }: { id: LoungeGameId; large?: boolean }) {
  const game = loungeGame(id)
  return <span className={`game-lounge-art${large ? ' game-lounge-art--large' : ''}`} data-game={id} aria-hidden="true">
    <img src={`${import.meta.env.BASE_URL}game/${game.art}`} alt="" draggable={false} onError={e => { e.currentTarget.hidden = true }} />
    <img src={`${import.meta.env.BASE_URL}game/${game.extra}`} alt="" draggable={false} onError={e => { e.currentTarget.hidden = true }} />
  </span>
}

export function GameLounge({ onBack, backLabel, renderTour, onJournalSaved }: Props) {
  const [route, setRoute] = React.useState<Route>(() => arenaInvitation() ? 'friends' : 'lounge')
  const [selected, setSelected] = React.useState<LoungeGameId | null>(null)
  const [play, setPlay] = React.useState<LoungePlay>('solo')
  const [tab, setTab] = React.useState<'games' | 'records'>('games')
  const [filter, setFilter] = React.useState<'all' | 'solo' | 'friends'>('all')
  const [query, setQuery] = React.useState('')
  const [petHomeOpened, setPetHomeOpened] = React.useState(false)
  const markPetHomeOpened = React.useCallback(() => setPetHomeOpened(true), [])
  const [tdMap,setTdMap]=React.useState<TDMapId>('starlight')
  const [tourEntry,setTourEntry]=React.useState<string|undefined>()
  const [tdEntry, setTdEntry] = React.useState<'new' | 'resume'>('new')
  const [tdCheckpoints,setTDCheckpoints]=React.useState<NonNullable<ReturnType<typeof loadTD>>[]>([])
  const tdSaved=tdCheckpoints.find(item=>getTDMap(item.state).id===tdMap)??null
  const [legacy, setLegacy] = React.useState(false)
  const [tdRecords, setTdRecords] = React.useState<TDRecord[]>([])
  const [records, setRecords] = React.useState<SoloRecord[]>([])
  const [errors, setErrors] = React.useState<string[]>([])
  const store = useMinigameProgress(), savedRun = useSavedRun()
  const returnFocus = React.useRef<string | null>(null)
  const surface = React.useRef<HTMLElement>(null)
  const title = React.useRef<HTMLHeadingElement>(null)
  const listScroll = React.useRef<{ node: HTMLElement; top: number }[]>([])
  const game = selected ? loungeGame(selected) : null
  const games = GAME_CATALOG.filter(item => (filter !== 'friends' || item.friends) && `${item.name} ${item.category} ${item.goal}`.includes(query.trim()))
  const showSleepInn = filter !== 'friends' && (!query.trim() || '우리 집 친구들 펫 동물 입양 돌보기 수면 일지 꿈손님 여관'.includes(query.trim()))
  const scrollParents = () => { const nodes: HTMLElement[] = []; for (let node = surface.current?.parentElement; node; node = node.parentElement) if (node.scrollHeight > node.clientHeight) nodes.push(node); return nodes }
  const closeDetail = () => { setSelected(null); requestAnimationFrame(() => {
    surface.current?.querySelector<HTMLButtonElement>(`[data-game-open="${returnFocus.current}"]`)?.focus({ preventScroll: true })
    for (const { node, top } of listScroll.current) node.scrollTop = top
  }) }
  useTaskFlowBack({ enabled: route === 'lounge', onBack: () => selected ? closeDetail() : tab === 'records' ? setTab('games') : onBack() })
  React.useEffect(() => {
    if (route !== 'lounge') return
    savedRun.refresh()
    const messages: string[] = []
    const checkpoints:NonNullable<ReturnType<typeof loadTD>>[]=[],defenseRecords:TDRecord[]=[]
    for(const map of ['forest','starlight'] as TDMapId[]){
      try{const saved=loadTD(localStorage,map);if(saved)checkpoints.push(saved)}catch{messages.push(`${getTDMap(map).name} 이어하기를 읽지 못했어요. 기존 저장은 보존했어요.`)}
      try{defenseRecords.push(...readTDRecords(localStorage,map))}catch{messages.push(`${getTDMap(map).name} 기록을 읽지 못했어요.`)}
    }
    setTDCheckpoints(checkpoints);setTdRecords(defenseRecords)
    try { setRecords(readSoloRecords(localStorage)) } catch { messages.push('대결 기록을 읽지 못했어요.') }
    try { setLegacy(!!loadSoloCheckpoint(localStorage)) } catch { messages.push('이전 러닝 디펜스 저장을 읽지 못했어요.') }
    setErrors(messages)
    title.current?.focus({ preventScroll: true })
  }, [route, selected, tab, tdMap])
  const backToDetail = () => setRoute('lounge')
  const open = (id: LoungeGameId, button?: HTMLButtonElement) => {
    returnFocus.current = button?.dataset.gameOpen ?? id; listScroll.current = scrollParents().map(node => ({ node, top: node.scrollTop }))
    setSelected(id); setPlay(filter === 'friends' ? 'friends' : 'solo')
    for (const node of scrollParents()) node.scrollTop = 0
  }
  const launch = () => {
    if (!game) return
    // Adding a catalog entry requires its real destination; never silently route a new game elsewhere.
    const launchers: Record<LoungeGameId, () => void> = {
      tour: () => {setTourEntry(undefined);setRoute('tour')},
      defense: () => { setTdEntry('new'); setRoute('defense') },
      push: () => setRoute(play === 'friends' ? 'friends' : 'solo'),
      survival: () => setRoute(play === 'friends' ? 'friends' : 'solo'),
    }
    launchers[game.id]()
  }
  if (route === 'tour') return renderTour(backToDetail,tourEntry,()=>{setTdMap('starlight');setTdEntry('new');setSelected('defense');setRoute('defense')})
  if (route === 'defense') return <TowerDefense key={tdMap} onBack={backToDetail} entry={tdEntry} mapId={tdMap} onRun={()=>{setTourEntry('starlight');setSelected('tour');setRoute('tour')}} />
  if (route === 'solo' && (selected === 'push' || selected === 'survival')) return <SoloParty initialMode={selected} onBack={backToDetail} onFriends={() => { setPlay('friends'); setRoute('friends') }} />
  if (route === 'legacy') return <SoloParty onBack={backToDetail} onFriends={() => { setSelected(null); setTab('games'); setFilter('friends'); setRoute('lounge') }} />
  if (route === 'friends') return <FriendArena initialMode={selected === 'survival' ? 'survival' : 'push'} onBack={backToDetail} />

  const defenseRecords = (['forest', 'starlight'] as const).map(id => ({ id, records: tdRecords.filter(record => getTDMap(record).id === id) }))
  const completedCities = TOUR_CITIES.filter(city => (store.progress.cities[city.id]?.stars ?? 0) > 0)
  return <section ref={surface} className="game-lounge" data-view={selected ?? tab} data-reduced={store.progress.settings.motion === 'reduce'}>
    <header className="game-lounge__header">
      <button type="button" className="game-lounge__back" aria-label={selected ? '게임 목록으로' : backLabel} onClick={selected ? closeDetail : onBack}><ArrowLeft size={22} /></button>
      <span>{selected ? '게임 소개' : 'TRAINORACLE'}</span>
      {selected && <span className="game-lounge__eyebrow">{game!.category}</span>}
    </header>
    {!game ? <>
      <div className="game-lounge__intro"><div><h1 ref={title} tabIndex={-1}>게임 라운지</h1><p>쉬는 시간, 가볍게 한 판</p></div><PartyIcon id="reward-victory-medal" size={76} fallback={<Trophy size={52} />} /></div>
      <nav className="game-lounge__tabs" aria-label="게임 라운지 메뉴">
        <button type="button" aria-current={tab === 'games' ? 'page' : undefined} onClick={() => setTab('games')}><PartyIcon id="track-island" size={32} fallback={<Gamepad2 size={24} />} />게임</button>
        <button type="button" aria-current={tab === 'records' ? 'page' : undefined} onClick={() => setTab('records')}><PartyIcon id="reward-star" size={32} fallback={<Trophy size={24} />} />내 기록</button>
      </nav>
      {errors.map(error => <p key={error} className="game-lounge__error" role="alert">{error}</p>)}
      {tab === 'games' ? <>
        {(tdCheckpoints.length>0 || savedRun.slot.kind === 'saved') && <section className="game-lounge__resume" aria-label="저장한 게임"><h2>이어서 할 수 있어요</h2>
          {savedRun.slot.kind === 'saved' && <button onClick={() => { setTourEntry(undefined); setSelected('tour'); setRoute('tour') }}><GameArt id="tour" /><span><strong>러닝 투어</strong><small>저장한 구간에서 다시 출발</small></span><ChevronRight size={18} /></button>}
          {tdCheckpoints.map(checkpoint=><button key={getTDMap(checkpoint.state).id} onClick={() => {setTdMap(getTDMap(checkpoint.state).id);setSelected('defense');setTdEntry('resume');setRoute('defense')}}><GameArt id="defense"/><span><strong>타워 디펜스 · {getTDMap(checkpoint.state).name}</strong><small>{checkpoint.state.wave+1}웨이브 준비 · 기지 체력 {checkpoint.state.lives}</small></span><ChevronRight size={18}/></button>)}
        </section>}
        <div className="game-lounge__section-heading"><h2>어떤 게임을 할까요?</h2></div>
        {showSleepInn && <React.Suspense fallback={null}><SleepInnLoungeEntry onJournalSaved={onJournalSaved} initialOpen={!petHomeOpened} onOpened={markPetHomeOpened} /></React.Suspense>}
        <label className="game-lounge__search"><span className="sr-only">게임 검색</span><input type="search" placeholder="게임 이름이나 종류로 찾기" value={query} onChange={e => setQuery(e.target.value)} /></label>
        <div className="game-lounge__filters" role="group" aria-label="참가 방식으로 게임 찾기">{(['all', 'solo', 'friends'] as const).map(value => <button key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}>{value === 'all' ? '전체' : value === 'solo' ? '혼자' : '친구와'}</button>)}</div>
        <div className="game-lounge__catalog">{games.map(item => <button key={item.id} className="game-lounge__game" data-game-open={item.id} onClick={e => open(item.id, e.currentTarget)} aria-label={`${item.name} 게임 소개`}>
          <GameArt id={item.id} /><span className="game-lounge__game-copy"><span className="game-lounge__eyebrow">{item.category}</span><strong>{item.name}</strong><span>{item.goal}</span><small>{item.friends ? '혼자 · 친구와 1:1' : '혼자 플레이'}<i aria-hidden="true">·</i>{item.id === 'defense' ? '6웨이브' : item.id === 'tour' ? '도시마다 90초' : '한 라운드 90초'}</small></span><ChevronRight size={20} /></button>)}</div>
        {games.length === 0 && !showSleepInn && <div className="game-lounge__empty" role="status"><p>조건에 맞는 게임이 없어요.</p><button className="game-lounge__secondary" onClick={() => { setQuery(''); setFilter('all') }}>전체 게임 보기</button></div>}
        <p className="game-lounge__hint">혼자 할 때도 바로 시작할 수 있어요.<br />친구와 할 때는 초대 링크로 둘이 만나요.</p>
      </> : <div className="game-lounge__records"><h2>내가 해낸 도전</h2><p>점수 하나 대신, 게임마다의 성취를 모았어요.</p>
        <button className="game-lounge__record" data-game-open="tour" onClick={e => open('tour', e.currentTarget)}><GameArt id="tour" /><span><strong>러닝 투어</strong><b>{completedCities.length ? `${completedCities.length}개 도시 완주` : '아직 완주한 도시가 없어요'}</b><small>{completedCities.length ? completedCities.map(c => c.name).join(' · ') : '첫 도시부터 도전해 보세요'}</small></span><ChevronRight size={18} /></button>
        {(['push', 'survival'] as const).map(id => { const best = bestSoloRecord(records, id); return <button className="game-lounge__record" data-game-open={id} key={id} onClick={e => open(id, e.currentTarget)}><GameArt id={id} /><span><strong>{loungeGame(id).name}</strong><b>{best ? id === 'push' ? `최고 시리즈 승점 ${best.wins}/4` : `최소 낙하 ${best.falls}회` : '아직 완료한 경기가 없어요'}</b><small>{best ? `${id === 'push' ? '밀어냄' : '점프 회피'} ${best.success}회 · 컴퓨터 상대` : '두 라운드를 마치면 기록이 남아요'}</small></span><ChevronRight size={18} /></button> })}
        {defenseRecords.map(({id, records}) => {
          const best = records.filter(record => record.won).sort((a, b) => b.lives - a.lives)[0]
          return <button key={id} className="game-lounge__record" data-game-open={`defense-${id}`} onClick={e => { setTdMap(id); open('defense', e.currentTarget) }}><GameArt id="defense" /><span><strong>타워 디펜스 · {getTDMap(id).name}</strong><b>{best ? `6웨이브 방어 · 기지 ${best.lives}/20` : records.length ? `최고 ${Math.max(...records.map(record => record.wave))}웨이브 도전` : '아직 완료한 방어전이 없어요'}</b><small>{best ? `막은 적 ${best.kills} · 놓친 적 ${best.leaks}` : '기지를 지키고 첫 완주에 도전해요'}</small></span><ChevronRight size={18} /></button>
        })}
        <p className="game-lounge__hint">대결·디펜스 기록은 이 기기에 저장돼요. 러닝 투어는 기존 계정 저장 설정을 따라요. 친구 전적은 함께한 방에서 비교해요.</p>
      </div>}
      {(legacy || records.some(r => r.mode === 'defense')) && <details className="game-lounge__archive"><summary>이전 버전 저장</summary><p>전에 하던 러닝 디펜스의 이어하기와 기록을 확인할 수 있어요.</p><button className="game-lounge__secondary" onClick={() => setRoute('legacy')}>이전 러닝 디펜스 열기</button></details>}
      <p className="game-lounge__footnote">게임 결과는 훈련 성과나 포인트(P)에 반영되지 않아요.</p>
    </> : <>
      <div className="game-lounge__hero"><GameArt id={game.id} large /><h1 ref={title} tabIndex={-1}>{game.name}</h1><p>{game.goal}</p></div>
      <div className="game-lounge__detail-body">
        {game.friends ? <fieldset className="game-lounge__players"><legend>누구와 할까요?</legend>{(['solo', 'friends'] as const).map(value => <label key={value} data-selected={play === value}><input type="radio" name="lounge-players" value={value} checked={play === value} onChange={() => setPlay(value)} /><span><strong>{value === 'solo' ? '혼자 하기' : '친구와 하기'}</strong><small>{value === 'solo' ? '컴퓨터 상대 · 90초 × 2라운드' : '초대한 친구와 1:1 · 한 판 90초'}</small></span><Check size={20} aria-hidden="true" /></label>)}</fieldset>
          : <p className="game-lounge__format">혼자 플레이 <i aria-hidden="true">·</i> {game.solo}</p>}
        {game.id==='defense'&&<fieldset className="game-lounge__map-choice"><legend>방어할 지역</legend>{(['starlight','forest'] as TDMapId[]).map(id=><button key={id} aria-pressed={tdMap===id} onClick={()=>setTdMap(id)}>{id==='starlight'?'별빛 릴레이 숲':'기존 숲길 관문'}<small>{id==='starlight'?'넓은 전장 · 이동과 확대 · 14지점':'첫 지도 · 8지점'}</small></button>)}</fieldset>}
        <section className="game-lounge__how"><h2>이렇게 하면 돼요</h2><ol>{game.rules.map(rule => <li key={rule}>{rule}</li>)}</ol><p className="game-lounge__goal"><strong>이번 판 목표</strong>{game.outcome}</p></section>
        {(game.id==='defense'||game.id==='tour')&&<div className="game-lounge__fantasy"><img src={`${import.meta.env.BASE_URL}game/fantasy-world-v1/panorama.webp`} alt="부유섬과 수정 다리, 별빛 숲의 관문"/><div><strong>별빛 릴레이 숲</strong><p>같은 숲에서 길을 달리고, 관문을 지켜요.</p><button onClick={()=>{setTourEntry('starlight');setRoute('tour')}}>판타지 러닝 코스</button></div></div>}
        {game.friends && <p className="game-lounge__hint">{play === 'friends' ? '두 명이 각자 겨루는 개인전이에요. 방을 만든 뒤 링크로 친구를 초대해요.' : '컴퓨터 상대와 연습해요. 시간 끝까지 몇 번이든 다시 살아나요.'}</p>}
        {game.id === 'defense' && errors.map(error => <p role="alert" key={error} className="game-lounge__error">{error}</p>)}
      </div>
      <div className="game-lounge__start">
        {game.id === 'defense' && tdSaved && <button className="game-lounge__primary" onClick={() => { setTdEntry('resume'); setRoute('defense') }}>{tdSaved.state.wave + 1}웨이브 이어하기</button>}
        <button className={game.id === 'defense' && tdSaved ? 'game-lounge__secondary' : 'game-lounge__primary'} onClick={launch}>{game.id === 'tour' ? '도시 고르기' : game.id === 'defense' ? '새 방어전 시작' : play === 'friends' ? '친구 초대 준비하기' : '컴퓨터와 시작하기'}</button>
        {game.id === 'defense' && tdSaved && <small>새 판을 시작해도 이전 저장은 유지돼요. 다시 저장할 때 바뀝니다.</small>}
      </div>
    </>}
  </section>
}
