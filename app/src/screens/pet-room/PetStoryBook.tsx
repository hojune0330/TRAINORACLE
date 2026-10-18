import React, { useState } from 'react'
import { petById, type PetId } from './pet-catalog'
import type { PetBond } from './pet-engine'
import { PetSprite, PropArt, petRoomAsset, type PetProp } from './PetArt'
import { PetOverlay } from './PetOverlay'
import { petStory } from './pet-story'

const arrivalProp: Partial<Record<PetId, PetProp>> = { otter: 'ball', mouse: 'ball', puppy: 'ball', penguin: 'ball', 'guinea-pig': 'bowl' }
const familyProp: Partial<Record<PetId, PetProp>> = { otter: 'ball', mouse: 'ball', puppy: 'ball', chinchilla: 'pillow', 'guinea-pig': 'bowl' }
export function PetStoryBook({ id, bond, onClose }: { id: PetId; bond: PetBond; onClose: () => void }) {
  const scenes = petStory(id, bond)
  const [page, setPage] = useState(() => scenes.map(scene => scene.date !== null).lastIndexOf(true))
  const scene = scenes[page]!
  const prop = scene.key === 'arrival' ? arrivalProp[id] : scene.key === 'family' ? familyProp[id] : scene.key === 'bed' && id === 'otter' ? 'ball' : undefined
  return <PetOverlay title={`${petById(id).name} 이야기`} onClose={onClose} night={scene.key === 'bed'}>
    <div className={`pet-story-picture pet-story-picture--${scene.key}`}>
      <img className="pet-care-world__background" src={petRoomAsset(scene.key === 'bed' ? 'room-sleep-v2.webp' : 'room.webp')} alt="" />
      {(scene.key === 'bed' || scene.key === 'family') && <PropArt item="blanket" className="pet-story-picture__mat" />}
      {scene.key === 'family' && (id === 'otter' || id === 'mouse') && <PropArt item="basket" className="pet-story-picture__basket" />}
      {prop && <PropArt item={prop} className="pet-story-picture__prop" />}
      <PetSprite id={id} pose={scene.pose} className="pet-story-picture__friend" />
    </div>
    <div className="pet-story-copy" aria-live="polite"><time dateTime={scene.date!}>{scene.date!.replaceAll('-', '.')} · 함께한 장면</time><h3>{scene.copy[0]}</h3><p>{scene.copy[1]}</p><blockquote>“{scene.copy[2]}”</blockquote></div>
    <nav className="pet-story-pages" aria-label="이야기 장면 고르기">{scenes.map((item, index) => <button key={item.key} type="button" disabled={!item.date} aria-current={page === index ? 'page' : undefined} onClick={() => setPage(index)}><strong>{index + 1}. {item.copy[0]}</strong><span>{item.date ? item.date.replaceAll('-', '.') : item.requirement}</span></button>)}</nav>
    <div className="pet-activity__controls"><button type="button" className="pet-primary" onClick={onClose}>친구한테 돌아가기</button></div>
  </PetOverlay>
}
