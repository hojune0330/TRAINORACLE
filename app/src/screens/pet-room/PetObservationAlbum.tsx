import React, { useState } from 'react'
import { Camera, ChevronLeft } from 'lucide-react'
import { PetOverlay } from './PetOverlay'
import { PetSprite } from './PetArt'
import { ObservationArt, ObservationItemArt } from './PetObservationArt'
import { petById, type PetId } from './pet-catalog'
import type { PetHome } from './pet-engine'
import { OBSERVATION_ITEMS, OBSERVATION_SCENES, observationState, observedItemStats } from './pet-observation'

export function PetObservationAlbum({ home, onClose }: { home: PetHome; onClose: () => void }) {
  const [tab, setTab] = useState<'photos' | 'habits'>('photos')
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null)
  const state = observationState(home)
  const photos = state.nights.flatMap(night => night.observedOn ? night.results.filter(result => state.photos.includes(result.id)).map(result => ({ result, date: night.wakeDate })) : []).reverse()
  const observedPets = [...new Set(state.nights.filter(night => night.observedOn).flatMap(night => night.roster))]
  const [petId, setPetId] = useState<PetId>(observedPets.includes(home.selected) ? home.selected : observedPets[0] ?? home.selected)
  const selected = photos.find(photo => photo.result.id === selectedPhoto)
  const stats = OBSERVATION_ITEMS.map(item => ({ item, ...observedItemStats(home, petId, item.id) })).filter(item => item.offered > 0)
  const photoTitle = (sceneId: string | null) => OBSERVATION_SCENES.find(scene => scene.id === sceneId)?.title
  return <PetOverlay title="우리 사진첩" onClose={onClose}>
    <div className="pet-observation-album">
      <div className="pet-observation-album__tabs" role="group" aria-label="사진첩 보기"><button type="button" aria-pressed={tab === 'photos'} onClick={() => setTab('photos')}>담아 둔 사진</button><button type="button" aria-pressed={tab === 'habits'} onClick={() => setTab('habits')}>누가 뭘 썼을까?</button></div>
      {tab === 'photos' ? selected ? <div className="pet-observation-photo-detail">
        <button type="button" className="pet-observation-text-action" onClick={() => setSelectedPhoto(null)}><ChevronLeft size={18} /> 사진 목록</button>
        <ObservationArt result={selected.result} />
        <p className="pet-observation-note">{selected.date}</p>
        <h3>{photoTitle(selected.result.sceneId) ?? selected.result.petIds.map(id => petById(id).name).join(' · ')}</h3>
        <p>{selected.result.description}</p>
        {selected.result.sceneId && <p className="pet-observation-note">이 사진은 꾸미기에서도 쓸 수 있어요.</p>}
      </div> : photos.length ? <div className="pet-observation-photo-grid">{photos.map(photo => <button type="button" key={photo.result.id} onClick={() => setSelectedPhoto(photo.result.id)} aria-label={`${photo.date}, ${photo.result.description} 사진 크게 보기`}>
        <ObservationArt result={photo.result} /><strong>{photoTitle(photo.result.sceneId) ?? photo.result.petIds.map(id => petById(id).name).join(' · ')}</strong><span>{photo.date}</span>
      </button>)}</div> : <div className="pet-observation-album-empty"><Camera size={32} /><h3>아직 담아 둔 사진이 없어요.</h3><p>아침에 마음에 드는 모습을 누르고<br />사진첩에 담아 보세요.</p></div>
        : <>
          {observedPets.length ? <><div className="pet-observation-pet-picker" role="group" aria-label="친구 선택">{observedPets.map(id => <button type="button" key={id} aria-pressed={petId === id} onClick={() => setPetId(id)}><PetSprite id={id} pose="awake" /><span>{petById(id).name}</span></button>)}</div>
            <h3>{petById(petId).name}에게 놓아 줬던 물건</h3>
            {stats.length ? <ul className="pet-observation-habits">{stats.map(({ item, offered, used }) => <li key={item.id}><ObservationItemArt id={item.id} /><div><strong>{item.label}</strong><span>놓은 밤 {offered}번 · 쓴 밤 {used}번</span></div></li>)}</ul> : <p className="pet-observation-note">아직 물건을 놓아 준 밤이 없어요.</p>}
            <p className="pet-observation-note">한 번 안 썼다고 싫어하는 건 아닐 수 있어요. 다른 자리에도 놓아 봐요.</p></>
            : <div className="pet-observation-album-empty"><h3>첫 아침을 기다리는 중이에요.</h3><p>누가 어떤 물건을 썼는지 여기에 모아 둘게요.</p></div>}
        </>}
    </div>
  </PetOverlay>
}
