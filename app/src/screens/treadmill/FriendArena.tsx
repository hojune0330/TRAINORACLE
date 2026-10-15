import React from 'react'
import { ArrowLeft, Users } from 'lucide-react'
import { PartyLobby } from './PartyLobby'
import { PARTY_MODES, modeOf } from './arena-party'
import { arenaEndpoint, arenaInvitation } from './arena-types'
import type { ArenaSnapshot } from './arena-types'
import { createGameGestures } from './gestures'
import { gamePalette } from './sprites'
import { drawArena } from './arena-render'
import { loadToriArt } from './runner-art'
import { loadSceneArt } from './scene-art'
import { loadPartyArt } from './party-art'
import { GameLeaveDialog } from './GameLeaveDialog'
import { useTaskFlowBack } from '../../hooks/useTaskFlowBack'
import './friend-arena.css'

const errors: Record<string, string> = {
  'room-missing': '방이 끝났거나 서버가 재시작됐어요. 새 초대 링크로 만나 주세요.',
  'room-full': '이미 두 명이 있는 방이에요. 원래 참가한 탭에서 다시 열어 주세요.',
  'in-progress': '경기 중인 방이에요. 이번 판이 끝나면 다시 입장해 주세요.',
  capacity: '지금 새 방을 만들 수 없어요. 잠시 뒤 다시 시도해 주세요.',
  'client-update': '장애물 생존은 두 명 모두 최신 초대 링크로 접속해야 해요. 친구에게 이 방의 링크를 다시 전달해 주세요.',
}
export function FriendArena({ onBack }: { readonly onBack: () => void }) {
  const [name, setName] = React.useState(''), [attempt, setAttempt] = React.useState(0)
  const [snapshot, setSnapshot] = React.useState<ArenaSnapshot | null>(null), [self, setSelf] = React.useState('')
  const [status, setStatus] = React.useState(''), [connected, setConnected] = React.useState(false)
  const [leave, setLeave] = React.useState(false), [copied, setCopied] = React.useState(false)
  const [error, setError] = React.useState('')
  const room = React.useRef(arenaInvitation()), socket = React.useRef<WebSocket | null>(null)
  const gestures = React.useRef(createGameGestures()), keyRun = React.useRef(false), seq = React.useRef(0)
  const latest = React.useRef(snapshot), idRef = React.useRef(self), canvas = React.useRef<HTMLCanvasElement>(null)
  latest.current = snapshot; idRef.current = self
  const game = snapshot?.game, playing = game?.phase === 'playing' || game?.phase === 'countdown'
  const me = game?.players.find(p => p.id === self)
  const mode = modeOf(playing ? game?.mode : snapshot?.mode)
  const send = React.useCallback((value: object) => { if (socket.current?.readyState === WebSocket.OPEN) socket.current.send(JSON.stringify(value)) }, [])
  const input = React.useCallback((action?: 'jump' | 'dash') => send({ type: 'input', seq: ++seq.current, run: gestures.current.held || keyRun.current, action }), [send])
  const resetInput = React.useCallback(() => { gestures.current.reset(); keyRun.current = false; input() }, [input])
  const exit = () => {
    resetInput(); send({ type: 'leave' })
    if (room.current) { try { sessionStorage.removeItem(`arena:${room.current}`) } catch { /* storage optional */ } }
    history.replaceState(history.state, '', `${location.pathname}${location.search}`); onBack()
  }
  const requestExit = () => { resetInput(); if (playing) setLeave(true); else exit() }
  useTaskFlowBack({ enabled: true, onBack: requestExit })

  React.useEffect(() => {
    if (!attempt) return
    let disposed = false, retry: ReturnType<typeof setTimeout> | undefined, retries = 0, receivedAt = Date.now()
    const connect = () => {
      if (disposed) return
      setStatus(retries ? '연결을 복구하고 있어요…' : '경기 서버를 깨우고 있어요… 처음 연결은 잠시 걸릴 수 있어요.')
      let ws: WebSocket
      try { ws = new WebSocket(arenaEndpoint()) } catch { setError('친구 경기 서버 주소를 확인할 수 없어요.'); return }
      socket.current = ws; seq.current = 0; receivedAt = Date.now()
      const timeout = setTimeout(() => { if (ws.readyState !== WebSocket.OPEN) ws.close() }, 15_000)
      let terminal = false
      ws.onopen = () => {
        clearTimeout(timeout)
        let token: string | undefined
        try { token = room.current ? sessionStorage.getItem(`arena:${room.current}`) ?? undefined : undefined } catch { /* optional */ }
        ws.send(JSON.stringify({ type: 'join', room: room.current, token, name, partyVersion: 2 }))
      }
      ws.onmessage = event => {
        if (disposed) return
        receivedAt = Date.now()
        let data
        try { data = JSON.parse(String(event.data)) } catch { return }
        if (data.type === 'joined') {
          room.current = data.room; setSelf(data.id); setConnected(true); setError(''); setStatus('연결됨'); retries = 0
          try { sessionStorage.setItem(`arena:${data.room}`, data.token) } catch { /* reconnection unavailable */ }
          history.replaceState(history.state, '', `${location.pathname}${location.search}#arena=${data.room}`)
        } else if (data.type === 'state') setSnapshot(data as ArenaSnapshot)
        else if (data.type === 'error') { terminal = true; setError(errors[data.code] ?? '입장할 수 없어요. 다시 시도해 주세요.'); ws.close() }
      }
      ws.onerror = () => { /* close owns retry and user-facing state */ }
      ws.onclose = event => {
        clearTimeout(timeout)
        if (disposed) return
        setConnected(false); resetInput()
        if (event.code === 4009) { terminal = true; setError('다른 탭에서 이어서 접속했어요. 한 탭에서만 플레이해 주세요.') }
        if (event.code === 4004) { terminal = true; setError(errors['room-missing']!) }
        if (!terminal && retries++ < 12) retry = setTimeout(connect, Math.min(5000, 1000 * retries))
        else { setStatus('연결 끊김'); if (!terminal) setError('서버에 연결하지 못했어요. 네트워크를 확인한 뒤 다시 연결해 주세요.') }
      }
    }
    setError(''); connect()
    const heartbeat = setInterval(() => {
      if (socket.current?.readyState === WebSocket.OPEN && Date.now() - receivedAt > 5000) socket.current.close()
      else input()
    }, 150)
    return () => { disposed = true; clearInterval(heartbeat); clearTimeout(retry); socket.current?.close(); socket.current = null }
    // Name is submitted only on explicit connect; editing the form never tears down a match.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt])

  React.useEffect(() => { resetInput() }, [me?.state, game?.round, game?.phase, resetInput])
  React.useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (!playing || leave || event.target instanceof HTMLInputElement) return
      if (['ArrowRight', 'ArrowUp', ' ', 'd', 'D', 'Escape'].includes(event.key)) event.preventDefault()
      if (event.key === 'Escape') { resetInput(); setLeave(true); return }
      if (event.key === 'ArrowRight') { keyRun.current = true; input() }
      if (!event.repeat && (event.key === 'ArrowUp' || event.key === ' ')) input('jump')
      if (!event.repeat && event.key.toLowerCase() === 'd') input('dash')
    }
    const up = (event: KeyboardEvent) => { if (event.key === 'ArrowRight') { keyRun.current = false; input() } }
    const visibility = () => { if (document.hidden) resetInput() }
    window.addEventListener('keydown', down); window.addEventListener('keyup', up); window.addEventListener('blur', resetInput)
    document.addEventListener('visibilitychange', visibility)
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', resetInput); document.removeEventListener('visibilitychange', visibility) }
  }, [playing, leave, input, resetInput])
  React.useEffect(() => {
    if (!playing) return
    const node = canvas.current, ctx = node?.getContext('2d')
    if (!node || !ctx) return
    void loadToriArt(); void loadSceneArt()
    void loadPartyArt()
    let frame = 0, last = performance.now(), painted: ArenaSnapshot | null = null
    const palette = gamePalette(node), reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
    const paint = (now: number) => {
      const s = latest.current, dt = Math.min(.05, (now - last) / 1000); last = now
      if (s?.game) {
        const ratio = Math.min(devicePixelRatio || 1, 2), w = node.clientWidth, h = node.clientHeight
        if (node.width !== Math.round(w * ratio) || node.height !== Math.round(h * ratio)) { node.width = Math.round(w * ratio); node.height = Math.round(h * ratio) }
        ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
        const previous = painted
        painted = { ...s, game: { ...s.game, players: s.game.players.map(p => {
          const old = previous?.game?.players.find(a => a.id === p.id)
          if (!old || old.state !== p.state || previous?.game?.round !== s.game!.round || Math.abs(old.x - p.x) > .3) return { ...p }
          const blend = 1 - Math.exp(-24 * dt)
          return { ...p, x: old.x + (p.x - old.x) * blend, y: old.y + (p.y - old.y) * blend }
        }) } }
        drawArena(ctx, palette, painted, idRef.current, w, h, reduced, now / 1000)
      }
      frame = requestAnimationFrame(paint)
    }
    frame = requestAnimationFrame(paint)
    return () => cancelAnimationFrame(frame)
  }, [playing])

  const inviteUrl = snapshot ? `${location.origin}${location.pathname}?app=1#arena=${snapshot.room}` : ''
  const copy = async () => { try { await navigator.clipboard.writeText(inviteUrl); setCopied(true) } catch { setError('아래 초대 링크를 길게 눌러 복사해 주세요.') } }
  const share = async () => { try { await navigator.share({ title: '러닝 파티 · 같이 한 판!', url: inviteUrl }) } catch { /* canceled share keeps the room */ } }
  const point = (e: React.PointerEvent) => ({ x: e.clientX, y: e.clientY, time: performance.now() })
  return <section className="treadmill-game friend-arena" data-room={Boolean(snapshot)} data-screen={playing ? 'play' : 'map'} data-phase={game?.phase ?? 'lobby'}>
    <header className="treadmill-game__header">
      <button type="button" className="treadmill-game__icon" onClick={requestExit} aria-label="친구 경기 나가기"><ArrowLeft size={20} /></button>
      <div className="treadmill-game__title"><span>친구와 1:1 · 같은 방에서 한 판 더</span><h1>{snapshot ? `90초 ${PARTY_MODES[mode].name}` : '친구 파티'}</h1></div><Users size={24} aria-hidden="true" />
    </header>
    {error && <p role="alert" className="arena-error">{error}</p>}
    {!connected && attempt > 0 && <p role="status" className="arena-connection">{status} {playing && '경기는 계속돼요. 5초 이상 끊기면 무승부 중단됩니다.'}</p>}
    {!snapshot && <div className="arena-lobby">
      <h2>{room.current ? '친구가 기다리고 있어요' : '친구와 고르고, 바로 한 판!'}</h2>
      <p>밀어내기와 장애물 생존을 같은 방에서 즐겨요.<br />한 판 90초 · 떨어져도 2초 뒤 다시 시작해요.</p>
      <label>게임에서 쓸 이름<input maxLength={12} value={name} placeholder="러너" onChange={e => setName(e.target.value)} autoComplete="off" /></label>
      <button className="treadmill-game__cta" disabled={!arenaEndpoint() || (attempt > 0 && !error)} onClick={() => setAttempt(n => n + 1)}>{room.current ? '초대받은 방 입장' : '방 만들고 친구 초대'}</button>
      {!arenaEndpoint() && <p role="status">친구 경기 서버를 준비 중이에요. 혼자 연습은 계속 이용할 수 있어요.</p>}
      <p className="arena-note">로그인 없이 2명 · 같은 조건 · 계정 포인트와 무관<br />서버 재시작 시 방과 기록이 종료될 수 있어요.</p>
    </div>}
    {snapshot && !playing && <PartyLobby snapshot={snapshot} self={self} connected={connected} inviteUrl={inviteUrl} copied={copied} send={send} onCopy={() => void copy()} onShare={() => void share()} />}
    {playing && game && <div className="arena-field">
      <canvas ref={canvas} aria-label="친구 파티 경기장" tabIndex={0}
        data-time={game.time.toFixed(2)} data-players={JSON.stringify(game.players)} data-self={self} data-mode={mode}
        onContextMenu={e => e.preventDefault()}
        onPointerDown={e => { if (!connected || leave) return; e.currentTarget.setPointerCapture(e.pointerId); const dash = gestures.current.down(e.pointerId, point(e)); input(dash ? 'dash' : undefined) }}
        onPointerMove={e => { if (gestures.current.move(e.pointerId, point(e))) input('jump') }}
        onPointerUp={e => { gestures.current.up(e.pointerId, point(e)); input() }}
        onPointerCancel={e => { gestures.current.cancel(e.pointerId); input() }}
        onLostPointerCapture={e => { gestures.current.cancel(e.pointerId); input() }} />
      <div className="arena-hud"><strong>{Math.ceil(game.duration - Math.max(0, game.time))}초</strong><span>시간 끝까지 무한 리젠</span>
        <div className="arena-scoreboard">{game.players.map(p => <div key={p.id} data-self={p.id === self}><b>{snapshot.members.find(m => m.id === p.id)?.name}{p.id === self ? ' (나)' : ''}</b><span>{mode === 'survival' ? `점프 회피 ${p.dodges}` : `밀어냄 ${p.kos}`} · 낙하 {p.falls}</span></div>)}</div>
        <label>내 에너지 {Math.ceil(me?.energy ?? 100)}<progress max={100} value={me?.energy ?? 100} /></label>
      </div>
      {game.phase === 'countdown' && <div className="arena-countdown" role="status"><strong>{Math.max(1, Math.ceil(-game.time))}</strong><span>같이 출발!</span></div>}
      <div className="arena-hints">꾹 달리기 · ↗ 점프 · 두 번 {mode === 'survival' ? '대시' : '밀치기'}<br />{mode === 'survival' ? '낙하를 줄이고 장애물을 점프로 넘으세요' : me && game.time < me.protectedUntil ? '복귀 보호 · 서로 밀칠 수 없어요' : me && me.cooldownUntil > game.time ? `밀치기 ${Math.ceil(me.cooldownUntil - game.time)}초 뒤` : '가까이서 대시 → 상대 밀어내기'}</div>
    </div>}
    {snapshot && !connected && error && <button className="treadmill-game__ghost" onClick={() => setAttempt(n => n + 1)}>다시 연결</button>}
    {leave && <GameLeaveDialog title="친구 경기에서 나갈까요?" onCancel={() => setLeave(false)}><p>경기는 지금도 계속돼요. 나가면 이번 판은 승패 없이 중단돼요. 경기 중간 저장은 제공하지 않아요.</p><button className="treadmill-game__cta" onClick={exit}>경기 나가기</button></GameLeaveDialog>}
  </section>
}
