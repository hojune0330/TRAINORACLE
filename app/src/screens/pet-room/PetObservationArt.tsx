import React, { useState } from 'react'
import { Box, Heart, Tent } from 'lucide-react'
import { PetSprite, PropArt, petRoomAsset } from './PetArt'
import { OBSERVATION_ITEMS, OBSERVATION_SLOTS, type ObservationItemId, type ObservationPlacements, type ObservationResult } from './pet-observation'

/** Keep gameplay readable if an optional illustration cannot be loaded. */
export function ObservationItemArt({ id, className = '' }: { id: ObservationItemId; className?: string }) {
  const [failed, setFailed] = useState(false)
  if (id === 'ball' || id === 'cushion' || id === 'large-blanket') return <PropArt item={id === 'cushion' ? 'pillow' : id === 'large-blanket' ? 'blanket' : 'ball'} className={`pet-observation-item-art ${className}`} />
  const Icon = id === 'box' ? Box : id === 'tent' ? Tent : Heart
  return <span aria-hidden="true" className={`pet-observation-item-art ${className}`}>
    {failed ? <Icon size={36} strokeWidth={1.5} /> : <img src={petRoomAsset(`observations/props/${id}.webp`)} alt="" draggable={false} onError={() => setFailed(true)} />}
  </span>
}

export function ObservationArt({ result, className = '' }: { result: ObservationResult; className?: string }) {
  return <ObservationArtFrame key={result.sceneId ?? result.id} result={result} className={className} />
}
function ObservationArtFrame({ result, className }: { result: ObservationResult; className: string }) {
  const [failed, setFailed] = useState(false)
  return <span aria-hidden="true" className={`pet-observation-art ${className}`}>
    {result.sceneId && !failed ? <img src={petRoomAsset(`observations/${result.sceneId}.webp`)} alt="" draggable={false} onError={() => setFailed(true)} />
      : <span className={`pet-observation-art__fallback${result.petIds.length > 1 ? ' pet-observation-art__fallback--pair' : ''}`}>
        {result.petIds.map(id => <PetSprite key={id} id={id} pose="sleeping" />)}
        <ObservationItemArt key={result.itemId} id={result.itemId} />
      </span>}
  </span>
}

/** Reuse the actual saved layout in the normal room and while closing the curtains. */
export function ObservationPlacementArt({ placements, className = '' }: { placements: ObservationPlacements; className?: string }) {
  const placed = OBSERVATION_SLOTS.filter(slot => placements[slot.id])
  if (!placed.length) return null
  return <span className={`pet-observation-placements ${className}`} role="img" aria-label={`놓아 둔 물건: ${placed.map(slot => `${slot.label} ${OBSERVATION_ITEMS.find(item => item.id === placements[slot.id])!.label}`).join(', ')}`}>
    {placed.map(slot => <span key={slot.id} className={`pet-observation-placements__item pet-observation-placements__item--${slot.id}`}><ObservationItemArt key={placements[slot.id]} id={placements[slot.id]!} /></span>)}
  </span>
}
