import React, { useState } from 'react'
import { Check, LockKeyhole, Moon, Plus, X } from 'lucide-react'
import { PetSprite, petRoomAsset } from './PetArt'
import { PetOverlay } from './PetOverlay'
import { ObservationItemArt } from './PetObservationArt'
import { atHome, careDay, type PetHome } from './pet-engine'
import { petById } from './pet-catalog'
import { OBSERVATION_ITEMS, OBSERVATION_SLOTS, bedtimeDays, defaultObservationWakeDate, isObservationItemUnlocked, observationSlotCount, observationState, placeObservationItem, type ObservationSlotId } from './pet-observation'

export interface PetNightSetupProps {
  home: PetHome
  onCommit: (next: PetHome, message: string) => boolean
  onContinue: (wakeDate: string) => void
  onClose: () => void
  error?: string | null
  onReload?: () => void
}

function tomorrowDay() {
  const date = new Date()
  date.setDate(date.getDate() + 1)
  return careDay(date)
}

export function PetNightSetup({ home, onCommit, onContinue, onClose, error, onReload }: PetNightSetupProps) {
  const [slot, setSlot] = useState<ObservationSlotId>('bedside')
  const [notice, setNotice] = useState('')
  const [wakeDate, setWakeDate] = useState(() => {
    const date = defaultObservationWakeDate()
    const nights = observationState(home).nights
    // A finished morning cannot be rerolled; never select a distant future date.
    return [date, careDay(), tomorrowDay()].find(day => !nights.some(night => night.wakeDate === day)) ?? date
  })
  const state = observationState(home)
  const days = bedtimeDays(home)
  const slots = observationSlotCount(home)
  const selectedSlot = OBSERVATION_SLOTS.find(item => item.id === slot)!
  const companions = [home.selected, ...atHome(home).filter(id => id !== home.selected)].slice(0, 3)
  const placedCount = Object.values(state.placements).filter(Boolean).length
  const today = careDay()
  const tomorrow = tomorrowDay()
  const dateTaken = state.nights.some(night => night.wakeDate === wakeDate)
  const dateOutOfRange = wakeDate < today || wakeDate > tomorrow
  const validDate = /^\d{4}-\d{2}-\d{2}$/.test(wakeDate) && !dateOutOfRange && !dateTaken
  function remove() {
    if (onCommit(placeObservationItem(home, slot, null), `${selectedSlot.label} 물건을 치웠어요.`)) setNotice(`${selectedSlot.label}을 비웠어요.`)
  }
  return <PetOverlay title="오늘은 뭘 놓아 둘까?" onClose={onClose}>
    <div className="pet-night-setup">
      <p className="pet-observation-lead">물건을 놓고 같이 자요. 아침에 누가 썼는지 볼까요?</p>
      <div className="pet-night-layout" aria-label="잠자리 물건 배치">
        <img className="pet-night-layout__room" src={petRoomAsset('room.webp')} alt="" draggable={false} />
        {OBSERVATION_SLOTS.map((place, index) => {
          const locked = index >= slots
          const item = state.placements[place.id]
          return <button type="button" key={place.id} className={`pet-night-slot pet-night-slot--${place.id}`} disabled={locked || !!error} aria-pressed={slot === place.id} aria-label={`${place.label}${locked ? ', 7일 함께 자면 열려요' : item ? `, ${OBSERVATION_ITEMS.find(value => value.id === item)!.label}` : ', 비어 있어요'}`} onClick={() => { setSlot(place.id); setNotice('') }}>
            {locked ? <LockKeyhole size={24} /> : item ? <ObservationItemArt key={item} id={item} /> : <Plus size={28} />}
            <span>{place.label}{slot === place.id && !locked && <Check size={14} />}</span>
            {locked && <small>함께 자기 7일</small>}
          </button>
        })}
      </div>
      <div className="pet-night-slot-heading"><h3>{selectedSlot.label}에 놓을 물건</h3><span>{placedCount}/{slots}개</span></div>
      <div className="pet-night-items">
        {OBSERVATION_ITEMS.map(item => {
          const unlocked = isObservationItemUnlocked(home, item.id)
          const selected = state.placements[slot] === item.id
          const existingSlot = OBSERVATION_SLOTS.find(place => state.placements[place.id] === item.id)
          return <button type="button" key={item.id} className="pet-night-item" disabled={!unlocked || !!error} aria-pressed={selected} aria-label={unlocked ? `${item.label}${selected ? ', 놓여 있어요' : ` ${selectedSlot.label}에 놓기`}` : `${item.label}, 함께 ${item.unlockDays}일 자면 열려요`} onClick={() => {
            if (selected) return
            if (onCommit(placeObservationItem(home, slot, item.id), `${selectedSlot.label}에 ${item.label}을 놓았어요.`)) setNotice(`${selectedSlot.label}에 ${item.label}을 놓았어요.`)
          }}>
            <ObservationItemArt id={item.id} />
            <strong>{item.label}</strong>
            <span>{!unlocked ? <><LockKeyhole size={13} /> 함께 자기 {item.unlockDays}일</> : selected ? <><Check size={14} /> 놓여 있어요</> : existingSlot ? `${existingSlot.label}에서 옮기기` : '놓기'}</span>
          </button>
        })}
      </div>
      <div className="pet-night-placement-footer">
        <p role="status">{notice || (days > 0 ? `지금까지 ${days}일 함께 잤어요.` : '한 번 놓은 물건은 다음에도 그대로 있어요.')}</p>
        {state.placements[slot] && <button type="button" className="pet-observation-text-action" disabled={!!error} onClick={remove}><X size={16} /> 치우기</button>}
      </div>
      <div className="pet-night-companions" aria-label="오늘 함께 잘 친구들">{companions.map(id => <span key={id}><PetSprite id={id} pose="awake" /><small>{petById(id).name}</small></span>)}</div>
      <label className="pet-night-wake-date"><span>일어날 날짜</span><input type="date" tabIndex={0} min={today} max={tomorrow} value={wakeDate} disabled={!!error} onChange={event => setWakeDate(event.target.value)} aria-describedby="pet-night-wake-help" /></label>
      <p id="pet-night-wake-help" className="pet-observation-note">{dateOutOfRange ? '일어날 날짜는 오늘이나 내일로 골라 주세요.' : dateTaken ? '이 날짜의 아침은 이미 준비했어요. 다른 날짜를 골라 주세요.' : '오늘이나 내일 중 일어날 날짜를 골라 주세요. 그 날짜부터 아침 모습을 볼 수 있어요.'}</p>
      {error && <div className="pet-home__error" role="alert"><p>{error}</p>{onReload && <button type="button" onClick={onReload}>다시 불러오기</button>}</div>}
      <button type="button" className="pet-primary" disabled={!validDate || !!error} onClick={() => onContinue(wakeDate)}><Moon size={20} /> 이대로 잠자리 준비</button>
      <p className="pet-observation-note pet-observation-note--center">마음에 드는 물건이어도 안 쓰는 날이 있어요.</p>
    </div>
  </PetOverlay>
}
