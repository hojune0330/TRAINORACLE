import React, { useState } from 'react'
import { Camera, Check, Images, Sun } from 'lucide-react'
import { PetSprite, petRoomAsset } from './PetArt'
import { ObservationArt } from './PetObservationArt'
import { petById } from './pet-catalog'
import type { PetHome } from './pet-engine'
import { OBSERVATION_ITEMS, OBSERVATION_SCENES, OBSERVATION_SLOTS, activeObservationNight, observationState } from './pet-observation'

export interface PetMorningObservationProps {
  home: PetHome
  onPhotograph: (resultId: string) => void
  onFinish: () => void
  onRest: () => void
  onOpenAlbum: () => void
  error?: string | null
}
export function PetMorningObservation({ home, onPhotograph, onFinish, onRest, onOpenAlbum, error }: PetMorningObservationProps) {
  const night = activeObservationNight(home)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  if (!night?.observedOn) return null
  const selected = night.results.find(result => result.id === selectedId)
  const usedPets = night.results.flatMap(result => result.petIds)
  const resting = night.roster.filter(id => !usedPets.includes(id))
  const photos = observationState(home).photos
  const scene = selected && OBSERVATION_SCENES.find(item => item.id === selected.sceneId)
  const shownDate = `${Number(night.wakeDate.slice(5, 7))}월 ${Number(night.wakeDate.slice(8, 10))}일`
  return <section className="pet-morning-observation" aria-labelledby="pet-morning-title">
    <header><div><p>{shownDate} 아침</p><h2 id="pet-morning-title">어젯밤에 뭐 했니?</h2></div><button type="button" className="pet-icon-button" aria-label="사진첩 열기" onClick={onOpenAlbum}><Images size={20} /></button></header>
    <div className="pet-observation-room" aria-label="친구나 물건을 눌러 아침 모습 보기">
      <img className="pet-observation-room__background" src={petRoomAsset('room.webp')} alt="" draggable={false} />
      {night.results.map(result => <button type="button" key={result.id} className={`pet-observation-hotspot pet-observation-hotspot--${result.slot}`} aria-pressed={selectedId === result.id} aria-label={`${OBSERVATION_SLOTS.find(slot => slot.id === result.slot)!.label}, ${result.petIds.length ? result.petIds.map(id => petById(id).name).join('와 ') : OBSERVATION_ITEMS.find(item => item.id === result.itemId)!.label} 모습 보기`} onClick={() => setSelectedId(result.id)}>
        <ObservationArt result={result} /><span>{result.petIds.length ? result.petIds.map(id => petById(id).name).join(' · ') : OBSERVATION_ITEMS.find(item => item.id === result.itemId)!.label}</span>
      </button>)}
      {resting.map((id, index) => <div key={id} className="pet-observation-room__resting" style={{ left: `${[70, 1, 37][index]}%`, top: `${[60, 65, 27][index]}%` }}><PetSprite id={id} pose="sleeping" /><span>{petById(id).name}</span></div>)}
      {!night.results.length && <p className="pet-observation-room__empty">물건 없이 편히 쉬었어요.</p>}
    </div>
    <div className="pet-observation-discovery" aria-live="polite">
      {selected ? <>
        <p className="pet-observation-discovery__place">{OBSERVATION_SLOTS.find(slot => slot.id === selected.slot)!.label}</p>
        <h3>{scene?.title ?? (selected.status === 'used' ? `${selected.petIds.map(id => petById(id).name).join(' · ')}의 아침` : '그대로 놓여 있어요')}</h3>
        <p>{selected.description}</p>
        {selected.status === 'used' ? <button type="button" className="pet-observation-photo-button" disabled={photos.includes(selected.id) || !!error} onClick={() => onPhotograph(selected.id)}>{photos.includes(selected.id) ? <><Check size={18} /> 사진첩에 담았어요</> : <><Camera size={18} /> 이 모습 사진첩에 담기</>}</button>
          : <p className="pet-observation-note">오늘 밤엔 자리를 바꿔 봐도 좋고, 그대로 둬도 좋아요.</p>}
      </> : <p className="pet-observation-tap-hint">친구나 물건을 눌러 봐요.</p>}
    </div>
    {error && <div className="pet-home__error" role="alert">{error}</div>}
    <div className="pet-observation-morning-actions"><button type="button" className="pet-primary" disabled={!!error} onClick={onFinish}><Sun size={20} /> 나도 일어났어</button><button type="button" className="pet-observation-text-action" disabled={!!error} onClick={onRest}>조금 더 같이 쉬기</button></div>
  </section>
}
