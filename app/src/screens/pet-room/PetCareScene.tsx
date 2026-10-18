import React, { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react'
import { petById, type CareAction, type PetId, type PetPose } from './pet-catalog'
import { PetSprite, PropArt, petRoomAsset } from './PetArt'
import { PetOverlay } from './PetOverlay'
import { PET_PLAY, inDropZone, petStroke, type RoomPoint } from './pet-play'
import { careVoice } from './pet-personality'

type Action = Exclude<CareAction, 'bed'>
type Phase = 'ready' | 'outbound' | 'returning' | 'catch' | 'peek' | 'find' | 'done'
const FOOD_TARGET = { x: 65, y: 88 }
const BALL_ORIGIN = { x: 23, y: 78 }
const FETCH_TARGETS = [{ x: 30, y: 48 }, { x: 78, y: 51 }]

export function PetCareScene({ id, action, turn, onComplete, onClose, error, onReload }: {
  id: PetId; action: Action; turn: number; onComplete: () => boolean; onClose: () => void; error: string | null; onReload: () => void
}) {
  const pet = petById(id)
  const play = PET_PLAY[id]
  const [phase, setPhase] = useState<Phase>(action === 'play' && play.style === 'hide' ? 'peek' : 'ready')
  const [passes, setPasses] = useState(0)
  const passCount = useRef(0)
  const [held, setHeld] = useState(false)
  const [drag, setDrag] = useState<RoomPoint | null>(null)
  const [destination, setDestination] = useState<RoomPoint>({ x: 77, y: 57 })
  const [hint, setHint] = useState('')
  const [hiddenAt] = useState(() => (turn + id.length) % 3)
  const room = useRef<HTMLDivElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const done = useRef(false)
  const doneButton = useRef<HTMLButtonElement>(null)
  const pointer = useRef<{ id: number; start: RoomPoint; moved: boolean; anchor: number; direction: number } | null>(null)
  const suppressClick = useRef(false)
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])
  useEffect(() => {
    if (phase === 'catch') suppressClick.current = false
    if (phase === 'done') doneButton.current?.focus({ preventScroll: true })
  }, [phase])

  function complete() {
    if (done.current || error) return
    if (onComplete()) { done.current = true; setPhase('done'); setHeld(false); setDrag(null) }
  }
  function stroke() {
    if (done.current || error) return
    passCount.current = Math.min(3, passCount.current + 1)
    setPasses(passCount.current)
    if (passCount.current === 3) complete()
  }
  function point(event: PointerEvent<HTMLElement>): RoomPoint {
    const bounds = room.current!.getBoundingClientRect()
    return { x: Math.max(5, Math.min(95, (event.clientX - bounds.left) / bounds.width * 100)), y: Math.max(12, Math.min(92, (event.clientY - bounds.top) / bounds.height * 100)) }
  }
  function down(event: PointerEvent<HTMLButtonElement>) {
    if (error || done.current || pointer.current || event.button !== 0) return
    suppressClick.current = false
    const start = point(event)
    pointer.current = { id: event.pointerId, start, moved: false, anchor: start.x, direction: 0 }
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }
  function move(event: PointerEvent<HTMLButtonElement>) {
    const active = pointer.current
    if (!active || active.id !== event.pointerId) return
    const next = point(event)
    active.moved ||= Math.hypot(next.x - active.start.x, next.y - active.start.y) > 3
    if (action === 'pet') {
      // Keep gestures on the animal rather than counting off-canvas motion.
      if (next.x < 28 || next.x > 86 || next.y < 35 || next.y > 83) return
      const pass = petStroke(active.anchor, next.x, active.direction)
      if (pass) { active.anchor = pass.anchor; active.direction = pass.direction; stroke() }
    } else { setHeld(true); setDrag(next) }
  }
  function up(event: PointerEvent<HTMLButtonElement>, cancelled = false) {
    const active = pointer.current
    if (!active || active.id !== event.pointerId) return
    pointer.current = null; suppressClick.current = active.moved || cancelled
    event.currentTarget.releasePointerCapture?.(event.pointerId)
    if (cancelled) { setDrag(null); setHeld(false); return }
    if (action === 'pet' || !active.moved) return
    const drop = point(event)
    setDrag(null)
    if (action === 'feed' && inDropZone(drop, FOOD_TARGET)) complete()
    else {
      const target = action === 'play' && (play.style === 'fetch' ? FETCH_TARGETS : [destination]).find(candidate => inDropZone(drop, candidate, 23))
      if (target) sendBall(target)
      else { setHeld(false); setHint(action === 'feed' ? '그릇을 친구 앞의 점선 안에 놓아 줘.' : '공을 점선 쪽으로 보내 줘.') }
    }
  }
  function clicked(callback: () => void) {
    if (suppressClick.current) { suppressClick.current = false; return }
    callback()
  }
  function sendBall(target: RoomPoint) {
    if (phase !== 'ready' || error || done.current) return
    setDestination(target); setHeld(false); setDrag(null); setHint(''); setPhase('outbound')
    timer.current = setTimeout(() => {
      setPhase('returning')
      timer.current = setTimeout(() => setPhase('catch'), play.travelMs)
    }, play.travelMs)
  }
  const pose: PetPose = phase === 'done' ? action === 'pet' ? 'happy' : action === 'feed' ? 'eating' : 'playing'
    : action === 'pet' && passes > 0 ? 'happy' : 'awake'
  const moving = phase === 'outbound' || phase === 'returning'
  const petPoint = action === 'play' && phase === 'outbound' ? destination : { x: action === 'pet' ? 55 : 65, y: 65 }
  const ballPoint = drag ?? (phase === 'outbound' ? destination : phase === 'returning' || phase === 'catch' ? BALL_ORIGIN : BALL_ORIGIN)
  const title = action === 'pet' ? `${pet.name} 쓰다듬기` : action === 'feed' ? `${pet.name} 간식 주기` : `${pet.name} 공놀이`
  const instruction = phase === 'done' ? careVoice(id, action, turn)
    : hint || (action === 'pet' ? play.petting : action === 'feed' ? held ? '이제 친구 앞을 눌러 줘.' : '그릇을 친구 앞으로 옮겨 줘.'
      : phase === 'peek' ? play.invite : phase === 'find' ? '공이 어디 있었지? 쿠션을 들어 봐.'
        : phase === 'outbound' ? play.style === 'fetch' ? '내가 가져올게!' : '굴러온다! 내가 받을게.'
          : phase === 'returning' || phase === 'catch' ? '너한테 다시 보냈어. 받아 줘!' : play.invite)
  return <PetOverlay title={title} onClose={onClose}>
    <p className="pet-activity__instruction" aria-live="polite">{instruction}</p>
    <div className={`pet-care-world pet-care-world--${action}${moving ? ` pet-care-world--${play.motion}` : ''}`} ref={room} style={{ '--pet-travel': `${play.travelMs}ms` } as CSSProperties} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') suppressClick.current = false }}>
      <img className="pet-care-world__background" src={petRoomAsset('room.webp')} alt="" draggable={false} />
      <button type="button" disabled={!!error || phase === 'done' || action === 'play'} className={`pet-care-world__pet${action === 'pet' ? ' pet-care-world__pet--touch' : ''}`} style={{ left: `${petPoint.x}%`, top: `${petPoint.y}%` }}
        aria-label={action === 'pet' ? '살살 쓰다듬기' : action === 'feed' ? '친구 앞에 그릇 놓기' : pet.name}
        onPointerDown={action === 'pet' ? down : undefined} onPointerMove={action === 'pet' ? move : undefined}
        onPointerUp={action === 'pet' ? event => up(event) : undefined} onPointerCancel={action === 'pet' ? event => up(event, true) : undefined}
        onClick={() => clicked(() => action === 'pet' ? stroke() : held ? complete() : setHint('먼저 아래 그릇을 골라 줘.'))}>
        <PetSprite id={id} pose={pose} /><span>{pet.name}</span>
      </button>
      {action === 'pet' && phase !== 'done' && <div className="pet-stroke-guide" aria-hidden="true">↔</div>}
      {action === 'feed' && phase !== 'done' && <>
        <button className={`pet-drop-target${held ? ' pet-drop-target--ready' : ''}`} type="button" disabled={!!error} style={{ left: `${FOOD_TARGET.x}%`, top: `${FOOD_TARGET.y}%` }} onClick={() => held ? complete() : setHint('먼저 아래 그릇을 골라 줘.')} aria-label="그릇 놓을 자리">여기에 놓기</button>
        <button className="pet-care-prop pet-care-prop--drag" type="button" disabled={!!error} aria-label="간식 그릇 들기" aria-pressed={held} style={{ left: `${drag?.x ?? 24}%`, top: `${drag?.y ?? 79}%` }} onPointerDown={down} onPointerMove={move} onPointerUp={event => up(event)} onPointerCancel={event => up(event, true)} onClick={() => clicked(() => { setHeld(value => !value); setHint('') })}><PropArt item="bowl" /></button>
      </>}
      {action === 'play' && play.style !== 'hide' && phase !== 'done' && <>
        {phase === 'ready' && <div className="pet-throw-choices">
          {(play.style === 'fetch' ? FETCH_TARGETS : [destination]).map((target, index) => <button key={index} className="pet-drop-target" type="button" disabled={!!error} style={{ left: `${target.x}%`, top: `${target.y}%` }} onClick={() => sendBall(target)}>{play.style === 'fetch' ? index === 0 ? '왼쪽으로' : '오른쪽으로' : '이쪽으로 굴리기'}</button>)}
        </div>}
        <button type="button" className="pet-care-prop pet-care-prop--ball" disabled={!!error || moving} aria-label={phase === 'catch' ? '공 받기' : play.style === 'fetch' ? '공 들기' : '공 굴리기'} style={{ left: `${ballPoint.x}%`, top: `${ballPoint.y}%` }}
          onPointerDown={phase === 'ready' ? down : undefined} onPointerMove={phase === 'ready' ? move : undefined} onPointerUp={phase === 'ready' ? event => up(event) : undefined} onPointerCancel={phase === 'ready' ? event => up(event, true) : undefined}
          onClick={() => clicked(() => phase === 'catch' ? complete() : play.style === 'fetch' ? setHint('왼쪽이나 오른쪽을 골라 줘.') : sendBall(destination))}><PropArt item="ball" /></button>
      </>}
      {action === 'play' && play.style === 'hide' && phase !== 'done' && <div className="pet-hide-cushions">
        {[0, 1, 2].map(index => <button key={index} type="button" disabled={phase !== 'find' || !!error} aria-label={`${['왼쪽', '가운데', '오른쪽'][index]} 쿠션 들기`} onClick={() => index === hiddenAt ? complete() : setHint('이 쿠션 뒤에는 없네. 다른 쪽을 볼까?')}>
          <PropArt item="pillow" />{phase === 'peek' && index === hiddenAt && <PropArt item="ball" className="pet-hidden-ball" />}
        </button>)}
      </div>}
    </div>
    {error && <div role="alert" className="pet-home__error"><p>{error}</p><button type="button" onClick={onReload}>다시 불러오기</button></div>}
    <div className="pet-activity__controls">
      {phase === 'done' ? <><p role="status">돌본 기록을 저장했어요. 같은 날은 한 번만 세어요.</p><button ref={doneButton} type="button" className="pet-primary" onClick={onClose}>{action === 'feed' ? '다 먹었네! 방으로 가기' : action === 'pet' ? '기분 좋지? 방으로 가기' : '잘 놀았어! 방으로 가기'}</button></>
        : action === 'pet' ? <><p>손을 좌우로 움직이거나 친구를 톡톡 눌러 줘. <strong>{passes}/3</strong></p><button type="button" className="pet-secondary" disabled={!!error} onClick={stroke}>살살 한 번 더</button></>
          : action === 'feed' ? <p>그릇을 끌어다 놓거나, 그릇과 놓을 자리를 차례로 눌러도 돼.</p>
            : play.style === 'hide' && phase === 'peek' ? <button type="button" className="pet-primary" disabled={!!error} onClick={() => { setPhase('find'); setHint('') }}>봤어! 숨겨 봐</button>
              : phase === 'catch' ? <button type="button" className="pet-primary" disabled={!!error} onClick={complete}>친구가 보낸 공 받기</button>
                : <p>{moving ? '친구가 공을 보내는 중이에요.' : play.style === 'fetch' ? '공을 보낼 곳을 골라 줘. 친구가 가져오면 받아 주자.' : '실수해도 괜찮아. 점수나 시간 제한은 없어.'}</p>}
      {phase !== 'done' && <button type="button" className="pet-activity__leave" onClick={onClose}>그만하고 방으로</button>}
    </div>
  </PetOverlay>
}
