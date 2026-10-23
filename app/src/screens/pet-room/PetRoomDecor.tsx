import React, { useState } from 'react'
import { Check, LockKeyhole } from 'lucide-react'
import { PetOverlay } from './PetOverlay'
import { PetSprite, PropArt, petRoomAsset } from './PetArt'
import { petById, type CareAction } from './pet-catalog'
import type { PetHome } from './pet-engine'
import { ROOM_DECOR, ROOM_DECOR_IDS, roomKeepsakes, type RoomDecorId } from './pet-decor'

export function DecorArt({ id, className = '' }: { id: RoomDecorId; className?: string }) {
  return <span className={`pet-decor-art ${className}`} aria-hidden="true">{id === 'toy-basket' ? <PropArt item="basket" /> : <img src={petRoomAsset(`keepsakes-v1/${id}.webp`)} alt="" draggable={false} />}</span>
}

export function PetRoomDecor({ home, onPlace, onEarn, onClose, error, onReload }: {
  home: PetHome; onPlace: (id: RoomDecorId | null) => void; onEarn: (action: CareAction) => void; onClose: () => void; error: string | null; onReload: () => void
}) {
  const [choice, setChoice] = useState(home.roomDecoration)
  const owned = roomKeepsakes(home)
  const memory = owned.find(item => item.id === choice)
  const allowed = choice === null || !!memory
  const canCare = !home.sleeping && !home.morning
  const earnLabel: Record<CareAction, string> = { pet: '쓰다듬으러 가기', feed: '간식 주러 가기', play: '같이 놀러 가기', bed: '같이 잘 준비하기' }
  return <PetOverlay title="우리 방 꾸미기" onClose={onClose} contained>
    <div className="pet-decor-picker">
      <p>같이 지낸 날을 소품으로 남겨 봐. 마음에 드는 걸 방에 놓자.</p>
      <div className="pet-decor-preview" aria-label="소품을 놓을 모습 미리보기">
        <img src={petRoomAsset('room.webp')} className="pet-decor-preview__room" alt="" />
        <PetSprite id={home.selected} motion="idle" className="pet-decor-preview__friend" />
        {choice && <DecorArt id={choice} className="pet-decor-preview__item" />}
        <span>미리보기</span>
      </div>
      <div className="pet-decor-options" role="group" aria-label="방에 놓을 소품">
        {ROOM_DECOR_IDS.map(id => {
          const unlocked = owned.some(item => item.id === id)
          return <button type="button" key={id} aria-label={`${ROOM_DECOR[id].name} ${unlocked ? home.roomDecoration === id ? '지금 놓아 둠' : '놓을 수 있어요' : '아직 없어요'}`} aria-pressed={choice === id} onClick={() => setChoice(id)}>
            <DecorArt id={id} /><strong>{ROOM_DECOR[id].name}</strong>
            <span>{unlocked ? home.roomDecoration === id ? '지금 놓아 둠' : '놓을 수 있어요' : <><LockKeyhole size={12} />아직 없어요</>}</span>
            <span className="pet-decor-options__check">{choice === id && <Check size={16} />}</span>
          </button>
        })}
      </div>
      <div className="pet-decor-memory" aria-live="polite">
        {choice ? <><strong>{ROOM_DECOR[choice].name}</strong><p>{memory ? `${memory.date.replaceAll('-', '.')} · ${petById(memory.petId).name} · ${ROOM_DECOR[choice].memory}` : ROOM_DECOR[choice].requirement}</p></> : <p>소품 없이 넓게 쓸래.</p>}
      </div>
      {error && <div role="alert" className="pet-home__error"><p>{error}</p><button type="button" onClick={onReload}>다시 불러오기</button></div>}
      <button type="button" className="pet-primary" disabled={!!error || !allowed && !canCare} onClick={() => !allowed && choice ? onEarn(ROOM_DECOR[choice].action) : onPlace(choice)}>{!allowed && choice ? canCare ? earnLabel[ROOM_DECOR[choice].action] : '아침 인사 후에 받을 수 있어요' : choice === home.roomDecoration ? '이대로 방으로 가기' : choice ? '이 소품 놓기' : '소품 치우기'}</button>
      <button type="button" className="pet-text-button" aria-pressed={choice === null} onClick={() => setChoice(null)}>소품 없이 쓰기</button>
      <small>고른 뒤 ‘놓기’를 눌러야 저장돼요. 받은 소품은 없어지지 않아요.</small>
    </div>
  </PetOverlay>
}
