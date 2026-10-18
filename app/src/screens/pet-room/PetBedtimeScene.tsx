import React, { useRef, useState, type PointerEvent } from 'react'
import { Moon } from 'lucide-react'
import { petById, type PetId } from './pet-catalog'
import { PetSprite, PropArt, petRoomAsset } from './PetArt'
import { PetOverlay } from './PetOverlay'
import { inDropZone, type RoomPoint } from './pet-play'

export function PetBedtimeScene({ companions, onFinish, onClose, error, onReload }: {
  companions: PetId[]; onFinish: () => void; onClose: () => void; error: string | null; onReload: () => void
}) {
  const [step, setStep] = useState(0)
  const [held, setHeld] = useState(false)
  const [drag, setDrag] = useState<RoomPoint | null>(null)
  const pointer = useRef<{ id: number; start: RoomPoint; moved: boolean } | null>(null)
  const suppressClick = useRef(false)
  const room = useRef<HTMLDivElement>(null)
  const targets = [{ x: 50, y: 71 }, { x: 24, y: 63 }, { x: 78, y: 63 }]
  const columns = Math.min(4, companions.length)
  const rows = Math.ceil(companions.length / columns)
  const place = (index: number) => companions.length <= 3 ? { ...targets[index]!, width: 34 } : { x: (index % columns + .5) * 100 / columns, y: 48 + (Math.floor(index / columns) + .5) * 42 / rows, width: Math.min(30, 92 / columns) }
  function point(event: PointerEvent<HTMLButtonElement>) {
    const rect = room.current!.getBoundingClientRect()
    return { x: Math.max(5, Math.min(95, (event.clientX - rect.left) / rect.width * 100)), y: Math.max(10, Math.min(92, (event.clientY - rect.top) / rect.height * 100)) }
  }
  function spread() { if (!error) { setStep(1); setHeld(false); setDrag(null) } }
  return <PetOverlay title="같이 잘 준비" onClose={onClose} night={step > 1}>
    <ol className="pet-bedtime-steps" aria-label="잠자리 준비 순서">{['이불 펴기', '커튼 닫기', '불 끄기'].map((name, index) => <li key={name} aria-current={step === index ? 'step' : undefined} data-done={step > index}>{step > index ? '✓' : index + 1} {name}</li>)}</ol>
    <p className="pet-activity__instruction" aria-live="polite">{step === 0 ? '폭신한 이불을 친구들 아래에 펴 줘.' : step === 1 ? '이불은 준비됐어. 커튼도 닫을까?' : '이제 불을 끄고 우리도 쉬자.'}</p>
    <div ref={room} className="pet-care-world pet-bedtime-world" onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') suppressClick.current = false }}>
      <img className="pet-care-world__background" src={petRoomAsset('room.webp')} alt="" draggable={false} />
      <img className={`pet-care-world__background pet-night-layer${step >= 2 ? ' pet-night-layer--visible' : ''}`} src={petRoomAsset('room-curtains-v2.webp')} alt="" draggable={false} />
      {companions.map((id, index) => <div className="pet-bedtime-friend" key={id} style={{ left: `${place(index).x}%`, top: `${place(index).y}%`, width: `${place(index).width}%` }}>
        {step > 0 && <PropArt item="blanket" className="pet-bedtime-mat" />}<PetSprite id={id} pose={step > 0 ? 'happy' : 'awake'} /><span>{petById(id).name}</span>
      </div>)}
      {step === 0 ? <>
        <button type="button" className={`pet-drop-target pet-bedtime-place${held ? ' pet-drop-target--ready' : ''}`} disabled={!!error} onClick={spread}>이불 펼 자리</button>
        <button type="button" className="pet-care-prop pet-care-prop--drag" disabled={!!error} aria-label="접힌 이불 들기" aria-pressed={held} style={{ left: `${drag?.x ?? 22}%`, top: `${drag?.y ?? 83}%` }}
          onPointerDown={event => { if (event.button !== 0 || pointer.current) return; suppressClick.current = false; pointer.current = { id: event.pointerId, start: point(event), moved: false }; event.currentTarget.setPointerCapture?.(event.pointerId) }}
          onPointerMove={event => { const active = pointer.current; if (!active || active.id !== event.pointerId) return; const next = point(event); active.moved ||= Math.hypot(next.x - active.start.x, next.y - active.start.y) > 3; setDrag(next); setHeld(true) }}
          onPointerUp={event => { const active = pointer.current; if (!active || active.id !== event.pointerId) return; pointer.current = null; suppressClick.current = active.moved; setDrag(null); event.currentTarget.releasePointerCapture?.(event.pointerId); if (active.moved && inDropZone(point(event), { x: 50, y: 72 }, 30)) spread() }}
          onPointerCancel={event => { pointer.current = null; setDrag(null); setHeld(false); suppressClick.current = true; event.currentTarget.releasePointerCapture?.(event.pointerId) }}
          onClick={() => { if (suppressClick.current) { suppressClick.current = false; return }; setHeld(value => !value) }}><PropArt item="folded" /></button>
      </> : step === 1 ? <button type="button" className="pet-room-hotspot pet-room-hotspot--curtain" disabled={!!error} onClick={() => setStep(2)}>커튼 닫기</button>
        : <button type="button" className="pet-room-hotspot pet-room-hotspot--lamp" disabled={!!error} onClick={onFinish}>불 끄기</button>}
    </div>
    {error && <div role="alert" className="pet-home__error"><p>{error}</p><button type="button" onClick={onReload}>다시 불러오기</button></div>}
    <div className="pet-activity__controls">
      <p>{companions.length}명 모두 함께 쉬어요. {companions.map(id => petById(id).name).join(' · ')}</p>
      <button type="button" className="pet-primary" disabled={!!error} onClick={() => step === 0 ? spread() : step === 1 ? setStep(2) : onFinish()}>{step === 0 ? '친구들 이불 펴 주기' : step === 1 ? '커튼 닫아 주기' : '불 끄고 같이 자기'}</button>
      <p>마지막에 불을 끄면 잠자리 준비가 저장돼요.</p>
      <button type="button" className="pet-activity__leave" disabled={!!error} onClick={onFinish}><Moon size={16} /> 졸려요, 바로 재우기</button>
    </div>
  </PetOverlay>
}
