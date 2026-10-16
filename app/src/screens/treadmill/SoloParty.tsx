import React from 'react'
import { ArrowLeft, Pause, Trophy, Play, Save, RotateCcw } from 'lucide-react'
import { newSoloPush, startSoloPush, advanceSoloPush, pushInput, pushSeriesPoints } from '../../domain/minigame/solo-push'
import type { SoloPush } from '../../domain/minigame/solo-push'
import { startDefenseWave, advanceSoloDefense, defenseInput, buyFacility, FACILITIES, DEFENSE_RULES, waveCount } from '../../domain/minigame/solo-defense'
import type { SoloDefense, FacilityKind } from '../../domain/minigame/solo-defense'
import { bestSoloRecord, loadSoloCheckpoint, readSoloRecords, saveSoloCheckpoint, storeSoloRecord } from '../../domain/minigame/solo-party-storage'
import type { SoloRecord } from '../../domain/minigame/solo-party-storage'
import { beginDefenseReview, finishDefenseReview, previousBestMessage } from '../../domain/minigame/solo-review'
import type { DefenseReview } from '../../domain/minigame/solo-review'
import { createGameGestures } from './gestures'
import { gamePalette } from './sprites'
import { drawArena } from './arena-render'
import { drawSoloDefense } from './solo-defense-render'
import { loadToriArt } from './runner-art'
import { loadSceneArt } from './scene-art'
import { loadPartyArt } from './party-art'
import { PartyIcon } from './PartyIcon'
import { GameModeArtwork } from './GameModeArtwork'
import { TowerDefense } from './TowerDefense'
import { loadDefenseArt } from './defense-art'
import { DefenseIcon } from './DefenseIcon'
import { GameLeaveDialog } from './GameLeaveDialog'
import { useTaskFlowBack } from '../../hooks/useTaskFlowBack'
import { useMinigameProgress } from '../../domain/minigame/progress-store'
import './friend-arena.css'
import './solo-party.css'

type Session = SoloPush | SoloDefense
const isPlaying = (s: Session | null) => !!s && (s.phase === 'playing' || s.phase === 'countdown')
const titles = { push: '혼자 밀어내기', survival: '혼자 장애물 생존', defense: '러닝 디펜스' }
const modes = ['push', 'survival', 'defense'] as const
const members = [{ id: 'you', name: '나', ready: true, connected: true }, { id: 'bot', name: '연습 상대', ready: true, connected: true }]

export function SoloParty({ onBack, onFriends }: { readonly onBack: () => void; readonly onFriends: () => void }) {
  const [towerDefense, setTowerDefense] = React.useState(false)
  const current = React.useRef<Session | null>(null), runId = React.useRef(''), recorded = React.useRef(false)
  const [view, setView] = React.useState<Session | null>(null), [paused, setPaused] = React.useState(false)
  const [notice, setNotice] = React.useState(''), [saved, setSaved] = React.useState<ReturnType<typeof loadSoloCheckpoint>>(null)
  const [records, setRecords] = React.useState<SoloRecord[]>([]), [recordStatus, setRecordStatus] = React.useState('')
  const [reviews, setReviews] = React.useState<DefenseReview[]>([]), [comparison, setComparison] = React.useState('')
  const reviewStart = React.useRef<ReturnType<typeof beginDefenseReview> | null>(null)
  const [draft, setDraft] = React.useState<SoloDefense | null>(null), [selected, setSelected] = React.useState(0)
  const canvas = React.useRef<HTMLCanvasElement>(null), keys = React.useRef(false), gestures = React.useRef(createGameGestures())
  const progress = useMinigameProgress()
  const reduced = progress.progress.settings.motion === 'reduce' || matchMedia('(prefers-reduced-motion: reduce)').matches
  const playing = isPlaying(view), mode = view?.mode
  const sync = React.useCallback(() => {
    const s = current.current
    if (s?.mode === 'defense' && reviewStart.current) {
      const report = finishDefenseReview(reviewStart.current, s)
      if (report) { setReviews(rows => [...rows, report]); reviewStart.current = null }
    }
    setView(s ? structuredClone(s) : null)
  }, [])
  const release = React.useCallback(() => { keys.current = false; gestures.current.reset() }, [])
  const refresh = React.useCallback(() => {
    try {
      const checkpoint = loadSoloCheckpoint(localStorage); setSaved(checkpoint)
      if (!checkpoint && localStorage.getItem('trainoracle.solo-party.checkpoint.v1')) setNotice('디펜스 규칙이 바뀌어 이전 판은 이어할 수 없어요. 이전 저장과 완주 기록은 보존했어요. 새 판으로 도전해 주세요.')
    } catch { setNotice('저장된 경기의 버전을 읽지 못했어요. 기존 저장은 보존하며 새 경기는 시작할 수 있어요.') }
    try { setRecords(readSoloRecords(localStorage)) } catch { setNotice('이 기기의 기록을 읽지 못했어요. 기존 기록을 덮어쓰지 않아요.') }
  }, [])
  React.useEffect(() => { refresh(); void loadToriArt(); void loadSceneArt(); void loadPartyArt(); void loadDefenseArt() }, [refresh])
  const start = (next: Session, id: string = crypto.randomUUID()) => {
    release(); current.current = next; runId.current = id; recorded.current = false
    reviewStart.current = null; setReviews([]); setComparison('')
    setPaused(false); setDraft(null); setRecordStatus(''); setNotice(''); sync()
  }
  const menu = () => { release(); current.current = null; setPaused(false); setDraft(null); sync(); refresh() }
  const pause = React.useCallback(() => { release(); sync(); setPaused(true) }, [release, sync])
  const requestBack = () => {
    if (!view) onBack()
    else if (view.phase === 'finished' || (view.mode !== 'defense' && view.phase === 'ready')) menu()
    else pause()
  }
  useTaskFlowBack({ enabled: !towerDefense, onBack: requestBack })
  const action = React.useCallback((value?: 'jump' | 'dash') => {
    const s = current.current
    if (!s || paused) return
    const run = gestures.current.held || keys.current
    if (s.mode !== 'defense') pushInput(s, run, value)
    else defenseInput(s, run, value)
  }, [paused])
  React.useEffect(() => {
    if (!playing || paused) return
    const down = (e: KeyboardEvent) => {
      if (!['ArrowRight', 'ArrowUp', ' ', 'd', 'D', 'Escape'].includes(e.key)) return
      if (e.key !== 'Escape' && e.target instanceof HTMLElement && e.target.closest('button, input, select, textarea')) return
      e.preventDefault()
      if (e.key === 'Escape') { pause(); return }
      if (e.key === 'ArrowRight') keys.current = true
      if (!e.repeat && (e.key === 'ArrowUp' || e.key === ' ')) action('jump')
      if (!e.repeat && e.key.toLowerCase() === 'd') action('dash')
    }
    const up = (e: KeyboardEvent) => { if (e.key === 'ArrowRight') keys.current = false }
    const hidden = () => { if (document.hidden) pause() }
    window.addEventListener('keydown', down); window.addEventListener('keyup', up)
    window.addEventListener('blur', pause); document.addEventListener('visibilitychange', hidden)
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', pause); document.removeEventListener('visibilitychange', hidden); release() }
  }, [playing, paused, action, pause, release])
  React.useEffect(() => {
    if (!playing) return
    const node = canvas.current, ctx = node?.getContext('2d')
    if (!node || !ctx) return
    let raf = 0, last = performance.now(), carry = 0, lastUI = 0
    const palette = gamePalette(node)
    const frame = (now: number) => {
      const s = current.current
      if (!s) return
      const dt = Math.min(.1, Math.max(0, (now - last) / 1000)); last = now
      if (!paused) {
        carry += dt
        while (carry >= 1 / 60) {
          if (s.mode !== 'defense') advanceSoloPush(s, 1 / 60, keys.current || gestures.current.held)
          else advanceSoloDefense(s, 1 / 60, keys.current || gestures.current.held)
          carry -= 1 / 60
        }
      }
      const ratio = Math.min(devicePixelRatio || 1, 2), w = node.clientWidth, h = node.clientHeight
      if (node.width !== Math.round(w * ratio) || node.height !== Math.round(h * ratio)) { node.width = Math.round(w * ratio); node.height = Math.round(h * ratio) }
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
      if (s.mode !== 'defense') drawArena(ctx, palette, { type: 'state', room: 'solo', host: 'you', members, game: s.game, history: [] }, 'you', w, h, reduced, Math.max(0, s.game.time), s.round === 2)
      else drawSoloDefense(ctx, palette, s, w, h, reduced)
      if (now - lastUI > 90 || !isPlaying(s)) { sync(); lastUI = now }
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [playing, paused, reduced, sync])
  React.useEffect(() => {
    if (view?.phase !== 'finished' || recorded.current) return
    recorded.current = true
    const self = view.mode !== 'defense' ? view.results.flat().filter(p => p.id === 'you') : []
    const result: SoloRecord = { id: runId.current, mode: view.mode, version: view.mode === 'defense' ? DEFENSE_RULES.version : 1, completedAt: new Date().toISOString(),
      success: view.mode === 'defense' ? view.totals.killed : self.reduce((sum, p) => sum + (view.mode === 'survival' ? p.dodges : p.kos), 0),
      missed: view.mode === 'defense' ? view.totals.passed + view.totals.unresolved : 0,
      falls: view.mode === 'defense' ? view.runner.falls : self.reduce((sum, p) => sum + p.falls, 0),
      wins: view.mode !== 'defense' ? pushSeriesPoints(view.results, 'you') : 0 }
    try { setComparison(previousBestMessage(readSoloRecords(localStorage), result)) }
    catch { setComparison('이전 기록을 읽지 못해 비교할 수 없어요.') }
    try { setRecords(storeSoloRecord(localStorage, result)); setRecordStatus('완주 기록을 이 기기에 저장했어요.') }
    catch { setRecordStatus('기록을 저장하지 못했어요. 이 결과는 현재 화면에서만 볼 수 있어요.'); recorded.current = false }
  }, [view])
  const begin = () => {
    const s = current.current
    if (!s) return
    release()
    if (s.mode !== 'defense') startSoloPush(s)
    else {
      if (draft) current.current = structuredClone(draft)
      startDefenseWave(current.current as SoloDefense)
      reviewStart.current = beginDefenseReview(current.current as SoloDefense)
    }
    setDraft(null); sync()
  }
  const save = () => {
    const s = draft ?? current.current
    if (s?.mode !== 'defense') return
    try {
      // A future or damaged checkpoint must not be silently replaced.
      loadSoloCheckpoint(localStorage)
      saveSoloCheckpoint(localStorage, s, runId.current); menu(); setNotice('웨이브 준비 상태를 이 기기에 저장했어요.')
    } catch { setNotice('저장하지 못했어요. 경기는 그대로 있어요. 기기 저장 공간이나 기존 저장의 호환성을 확인해 주세요.') }
  }
  const edit = (kind: FacilityKind) => {
    if (view?.mode !== 'defense') return
    const next = structuredClone(draft ?? view)
    if (buyFacility(next, selected, kind)) setDraft(next)
  }
  const preparation = view?.mode === 'defense' && view.phase === 'prepare' ? draft ?? view : null
  const me = view && view.mode !== 'defense' ? view.game.players[0] : null
  const time = view && view.mode !== 'defense' ? view.game.time : view?.time ?? 0
  const countdown = view && view.mode !== 'defense' ? Math.ceil(-view.game.time) : view?.phase === 'countdown' ? Math.ceil(view.countdown) : 0
  const point = (e: React.PointerEvent) => ({ x: e.clientX, y: e.clientY, time: performance.now() })
  if (towerDefense) return <TowerDefense onBack={() => setTowerDefense(false)} />
  return <section className="treadmill-game solo-party" data-screen={playing ? 'play' : 'map'} data-phase={view?.phase ?? 'select'} data-solo-mode={mode}>
    <header className="treadmill-game__header">
      <button className="treadmill-game__icon" aria-label={view ? '종목 선택으로' : '러닝 투어로'} onClick={requestBack}><ArrowLeft size={20} /></button>
      <div className="treadmill-game__title"><span>혼자 도전 · 서버 연결 없이</span><h1>{mode ? titles[mode] : '오늘은 어떤 경기?'}</h1></div>
      {playing ? <button className="treadmill-game__icon" aria-label="혼자 경기 일시정지" onClick={pause}><Pause size={20} /></button> : <Trophy aria-hidden="true" />}
    </header>
    {notice && <p className="solo-party__notice" role="status">{notice}</p>}
    {!view && <div className="solo-party__menu">
      {saved && <button className="treadmill-game__cta" onClick={() => start(saved.state, saved.id)}><Play size={20} /> 이전 러닝 디펜스 {saved.state.wave}웨이브 이어하기</button>}
      <div className="solo-party__games">{modes.map(m => { const best = bestSoloRecord(records, m); return <button key={m} className="solo-party__mode" onClick={() => m === 'defense' ? setTowerDefense(true) : start(newSoloPush(m))}>
        <GameModeArtwork mode={m} />
        <span><strong>{m === 'defense' ? '타워 디펜스' : titles[m]}</strong><span>{m !== 'defense' ? '컴퓨터와 90초 × 2라운드' : '숲길 방어전 · 6웨이브 · 배치와 강화'}</span>
          <small>{m === 'defense' ? '연사·포격·감속 · 기지 체력 20을 지키세요' : best ? m === 'survival' ? `최고 기록 · 낙하 ${best.falls} · 점프 회피 ${best.success}` : `최고 기록 · 시리즈 승점 ${best.wins}/4 · 밀어냄 ${best.success}` : m === 'survival' ? '연속 장애물 · 낙하 적은 순 · 서로 밀리지 않아요' : '트랙 → 커브 · 시간 끝까지 무한 리젠'}</small></span>
      </button> })}</div>
      <button className="treadmill-game__ghost" onClick={onFriends}>친구 파티</button>
      {records.length > 0 && <details className="solo-party__history"><summary>최근 도전 기록 {Math.min(5, records.length)}판</summary>
        <ol>{records.slice(-5).reverse().map(r => <li key={r.id}><strong>{titles[r.mode]}{r.mode === 'defense' && r.version !== DEFENSE_RULES.version ? ' · 이전 규칙' : ''}</strong><span>{r.mode === 'defense' ? `막은 적 ${r.success}/48 · 놓친 적 ${r.missed}` : r.mode === 'survival' ? `점프 회피 ${r.success}` : `승점 ${r.wins}/4 · 밀어냄 ${r.success}`} · 낙하 {r.falls}회</span><small>{new Date(r.completedAt).toLocaleString('ko-KR')}</small></li>)}</ol>
      </details>}
      <p className="solo-party__note">기록은 이 기기에 저장하고 최근 20판을 모아 보여줘요. 같은 종목·규칙끼리 비교하며 친구 순위와 훈련 기록에는 들어가지 않아요.</p>
    </div>}
    {view && view.mode !== 'defense' && ['ready', 'between'].includes(view.phase) && <div className="solo-party__panel">
      <PartyIcon id="track-island" size={80} />
      <h2>{view.phase === 'ready' ? view.mode === 'survival' ? '연속 장애물을 넘고, 낙하를 줄이세요' : '연습 상대를 밀어 떨어뜨리세요' : '1라운드 완료 · 다음은 커브'}</h2>
      <p>{view.phase === 'ready' ? '두 라운드를 끝내면 시리즈 기록이 남아요. 떨어져도 2초 뒤 돌아옵니다.' : `트랙에서 ${view.mode === 'survival' ? '점프 회피 ' + view.game.players[0]!.dodges : '밀어냄 ' + view.game.players[0]!.kos} · 낙하 ${view.game.players[0]!.falls}. 다음 라운드는 위치와 에너지를 새로 시작해요.`}</p>
      <p>{view.mode === 'survival' ? '낙하가 적은 쪽이 승리. 같으면 점프 회피가 많은 쪽이 이겨요. 대시는 전진만 하며 서로 밀리지 않아요.' : '밀어냄이 많으면 승리. 같으면 낙하가 적은 쪽이 이겨요.'} 승리 2점 · 공동 1점으로 두 라운드를 비교해요.</p>
      <Controls survival={view.mode === 'survival'} />
      <button className="treadmill-game__cta" onClick={begin}>{view.phase === 'ready' ? '1라운드 시작' : '2라운드 시작'}</button>
    </div>}
    {preparation && <div className="solo-party__panel">
      <div className="solo-party__enemy-guide" aria-label="적 종류">
        <span><DefenseIcon id="normal" />일반</span><span><DefenseIcon id="rush" />빠른 돌진</span><span><DefenseIcon id="armor" />밀쳐서 껍질 깨기</span>
      </div>
      <h2>{preparation.wave}웨이브 준비</h2>
      <p>{preparation.wave === 1 ? '12마리 · 껍질 적 1마리' : preparation.wave === 2 ? '16마리 · 돌진 적 4마리와 껍질 적 2마리' : '20마리 · 돌진 적 4마리와 껍질 적 4마리'}<br />놓친 적을 줄이세요. 모두 처리하면 바로 다음 단계로 넘어가요.</p>
      <p><strong>껍질은 두 번 눌러 깨세요.</strong> 껍질 적은 공 피해를 85% 막아요. 가까이에서 밀치면 껍질이 깨져 발사기가 온전히 피해를 줘요. 바람으로 늦추면 접근할 시간이 늘어나요.</p>
      {preparation.wave > 1 && <p>지금까지 막은 적 {preparation.totals.killed} · 놓친 적 {preparation.totals.passed + preparation.totals.unresolved} · 낙하 {preparation.runner.falls}</p>}
      {preparation.wave > 1 && <DefenseRecap reviews={reviews} expected={preparation.wave - 1} />}
      <strong className="solo-party__budget">남은 예산 {preparation.budget}개{draft ? ' · 변경 미확정' : ''}</strong>
      <div className="solo-party__slots" role="group" aria-label="시설 설치 칸">{preparation.facilities.map((f, i) => <button key={i} aria-pressed={selected === i} onClick={() => setSelected(i)}>{i + 1}번 칸<br />{f ? `${FACILITIES[f.kind].name} Lv.${f.level}` : '비어 있음'}</button>)}</div>
      <div className="solo-party__builds">{(Object.keys(FACILITIES) as FacilityKind[]).map(kind => {
        const f = preparation.facilities[selected], item = FACILITIES[kind], cost = f ? 4 : 3
        const unavailable = !!f && (f.kind !== kind || f.level === 2)
        return <button key={kind} disabled={unavailable || preparation.budget < cost} onClick={() => edit(kind)}>
          <DefenseIcon id={kind} />
          <strong>{item.name} {f?.kind === kind ? '강화' : '설치'}</strong><span>{item.detail}</span>
          <small>{f?.kind === kind ? `${item.levels[0]} → ${item.levels[1]}` : item.levels[0]} · {unavailable ? f?.kind === kind ? '최대 레벨' : '다른 칸 선택' : `${cost}개 필요`}</small>
        </button>
      })}</div>
      {draft && <button className="treadmill-game__ghost" onClick={() => setDraft(null)}><RotateCcw size={16} /> 이번 변경 취소</button>}
      <p className="solo-party__note">첫 예산 6개 · 다음 웨이브마다 +4개. 1·2웨이브의 건설 재료는 다음 준비에서 쓸 예산 +1개이며 각 2개까지 모을 수 있어요. 마지막 웨이브에는 나오지 않아요. 보급 깃발 근처에서 손을 놓으면 밀치기에 쓸 에너지가 더 빨리 회복돼요.</p>
      <Controls />
      <button className="treadmill-game__cta" onClick={begin}>배치 확정하고 {preparation.wave}웨이브 시작</button>
      {preparation.facilities.every(f => !f) && <small>아무것도 설치하지 않으면 공 발사기 1개를 3예산으로 설치해요.</small>}
      <button className="treadmill-game__ghost" onClick={save}><Save size={18} /> 확정·저장하고 종목 선택으로</button>
      <p className="solo-party__note">준비 중에는 시간 제한이 없어요. 저장하면 기존 디펜스 이어하기를 이번 준비 상태로 바꿔요.</p>
    </div>}
    {playing && view && <div className="arena-field solo-party__field">
      <canvas ref={canvas} tabIndex={0} aria-label={`${titles[view.mode]} 경기장`} data-time={time.toFixed(2)} data-state={JSON.stringify(view)}
        onContextMenu={e => e.preventDefault()}
        onPointerDown={e => { if (paused) return; e.currentTarget.setPointerCapture(e.pointerId); const dash = gestures.current.down(e.pointerId, point(e)); action(dash ? 'dash' : undefined) }}
        onPointerMove={e => { if (gestures.current.move(e.pointerId, point(e))) action('jump') }}
        onPointerUp={e => gestures.current.up(e.pointerId, point(e))}
        onPointerCancel={e => gestures.current.cancel(e.pointerId)} onLostPointerCapture={e => gestures.current.cancel(e.pointerId)} />
      <div className="arena-hud solo-party__hud">
        <strong>{view.mode !== 'defense' ? `${view.round}/2라운드` : `${view.wave}/3웨이브`} · {Math.ceil((view.mode !== 'defense' ? 90 : 60) - Math.max(0, time))}초</strong>
        <span>{view.mode !== 'defense' ? view.round === 1 ? '트랙 · 컴퓨터 상대' : '커브 · 컴퓨터 상대' : `적 ${view.spawned}/${waveCount(view.wave)} · 남은 예산 ${view.budget}`}</span>
        <div className="solo-party__stats">{view.mode !== 'defense' ? <>{view.mode === 'survival' ? `점프 회피 ${me?.dodges} : ${view.game.players[1]!.dodges}` : `밀어냄 ${me?.kos} : ${view.game.players[1]!.kos}`} · 내 낙하 {me?.falls}</> : <>막은 적 {view.totals.killed} · 놓친 적 {view.totals.passed + view.totals.unresolved} · 낙하 {view.runner.falls}</>}</div>
        <label>에너지 {Math.ceil(me?.energy ?? (view as SoloDefense).runner.energy)}<progress max={100} value={me?.energy ?? (view as SoloDefense).runner.energy} /></label>
      </div>
      {countdown > 0 && <div className="arena-countdown" role="status"><strong>{countdown}</strong><span>준비하세요</span></div>}
      <div className="arena-hints">꾹 달리기 · ↗ 점프 · 두 번 {view.mode === 'survival' ? '대시 · 서로 밀리지 않아요' : '밀치기'}</div>
    </div>}
    {view?.phase === 'finished' && <div className="solo-party__panel">
      {view.mode === 'defense' ? <DefenseIcon id="finish-gate" size={96} /> : <PartyIcon id="upgrade-core" size={80} />}<h2>{view.mode !== 'defense' ? '두 라운드 완주!' : '세 웨이브 완주!'}</h2>
      {view.mode !== 'defense' ? <>
        <strong className="solo-party__result">시리즈 승점 {pushSeriesPoints(view.results, 'you')} : {pushSeriesPoints(view.results, 'bot')}</strong>
        <p>{pushSeriesPoints(view.results, 'you') > pushSeriesPoints(view.results, 'bot') ? '연습 상대에게 승리했어요.' : pushSeriesPoints(view.results, 'you') === pushSeriesPoints(view.results, 'bot') ? '공동 순위예요. 다음에는 낙하를 줄여보세요.' : view.mode === 'survival' ? '다음 목표: 앞의 장애물을 보고 점프하고, 낙하를 줄이세요.' : '다음 목표: 상대가 가까워질 때 밀치고, 공격은 점프로 피하세요.'}</p>
        {view.results.map((r, i) => { const a = r.find(p => p.id === 'you')!; return <p key={i}>{i + 1}라운드 · {a.rank}위 · {view.mode === 'survival' ? `점프 회피 ${a.dodges}` : `밀어냄 ${a.kos}`} · 낙하 {a.falls}</p> })}
      </> : <><strong className="solo-party__result">막은 적 {view.totals.killed}/48</strong>
        <p>기지 통과 {view.totals.passed} · 시간 안에 못 막음 {view.totals.unresolved}<br />낙하 {view.runner.falls} · 직접 밀치기 적중 {view.totals.pushed}</p>
        <p>{view.totals.passed + view.totals.unresolved > 0 ? `다음 목표: 놓친 적 ${view.totals.passed + view.totals.unresolved}마리보다 줄이기` : view.runner.falls ? '다음 목표: 모든 적을 막고 낙하 없이 완주하기' : '완벽 방어 달성! 다른 시설 조합으로 도전해 보세요.'}</p></>}
      <p className="solo-party__comparison">{comparison}</p>
      <p role="status">{recordStatus}</p>
      {recordStatus.startsWith('기록을 저장하지') && <button className="treadmill-game__ghost" onClick={sync}>기록 저장 다시 시도</button>}
      <button className="treadmill-game__cta" onClick={() => view.mode === 'defense' ? (menu(), setTowerDefense(true)) : start(newSoloPush(view.mode))}>같은 종목 새로 시작</button>
      {view.mode === 'defense' && <DefenseRecap reviews={reviews} expected={3} />}
      <button className="treadmill-game__ghost" onClick={menu}>다른 종목 고르기</button>
      <button className="treadmill-game__ghost" onClick={onFriends}>친구 파티</button>
    </div>}
    {paused && <GameLeaveDialog title="잠깐 쉬는 중" onCancel={() => setPaused(false)}>
      <p>혼자 경기는 멈춰 있어요. 종목 선택으로 나가면 진행 중인 판은 기록되지 않아요.</p>
      {view?.mode === 'defense' && view.phase === 'prepare' ? <button className="treadmill-game__cta" onClick={save}>저장하고 나가기</button> : <p>중간 저장은 디펜스의 웨이브 준비 화면에서 할 수 있어요.</p>}
      {notice && <p role="alert">{notice}</p>}
      <button className="treadmill-game__ghost" onClick={menu}>저장 없이 종목 선택으로</button>
    </GameLeaveDialog>}
  </section>
}

function DefenseRecap({ reviews, expected }: { readonly reviews: DefenseReview[]; readonly expected: number }) {
  return <div className="solo-party__recap" aria-label="웨이브별 결과">
    <details><summary>웨이브별 결과 살펴보기</summary>
    {reviews.length < expected && <p className="solo-party__note">이어하기 전 웨이브는 합계만 남아 있어요. 아래는 이번에 직접 진행한 웨이브예요.</p>}
    <ol>{reviews.map(r => <li key={r.wave}>
      <strong>{r.wave}웨이브 · 막은 적 {r.killed}/{r.killed + r.passed + r.unresolved}</strong>
      <span>기지 통과 {r.passed} · 시간 내 미처리 {r.unresolved} · 낙하 {r.falls}회</span>
      <span>직접 밀치기 적중 {r.pushed}회 · 보급품 {r.collected}개</span>
      <details><summary>이때 사용한 시설</summary><p>{r.facilities.join(' · ')}</p></details>
    </li>)}</ol>
    <p className="solo-party__note">밀치기 적중은 처치 수가 아니에요. 다음 판에서 시설이나 밀치는 타이밍을 바꾸고 놓친 적을 비교해 보세요.</p>
    </details>
  </div>
}

function Controls({ survival = false }: { readonly survival?: boolean }) {
  return <p className="solo-party__note">꾹 눌러 달리기 · 위로 쓸어 점프 · 두 번 눌러 {survival ? '대시' : '밀치기'}.<br />손을 떼지 않고 내렸다 올려도 다시 점프해요.<br />키보드 → 달리기 · Space/↑ 점프 · D {survival ? '대시' : '밀치기'}</p>
}
