import React, { useEffect, useRef, useState } from 'react'
import { POSE_FRAME, petAsset, type PetId, type PetPose } from './pet-catalog'

export const petRoomAsset = (name: string) => `${import.meta.env.BASE_URL}games/pet-room-v1/${name}`
const position = (frame: number) => `${(frame % 3) * 50}% ${Math.floor(frame / 3) * 100}%`

export function PetSprite({ id, pose = 'awake', className = '' }: { id: PetId; pose?: PetPose; className?: string }) {
  const element = useRef<HTMLSpanElement>(null)
  const [visible, setVisible] = useState(() => typeof IntersectionObserver === 'undefined')
  useEffect(() => {
    if (visible || !element.current) return
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { setVisible(true); observer.disconnect() }
    }, { rootMargin: '160px' })
    observer.observe(element.current)
    return () => observer.disconnect()
  }, [visible])
  return <span ref={element} aria-hidden="true" className={`pet-sprite ${className}`} style={{ backgroundImage: visible ? `url("${petAsset(id)}")` : undefined, backgroundPosition: position(POSE_FRAME[pose]) }} />
}
export function ActionArt({ frame }: { frame: number }) {
  return <span aria-hidden="true" className="pet-action-art" style={{ backgroundImage: `url("${petRoomAsset('actions.webp')}")`, backgroundPosition: position(frame) }} />
}
export type PetProp = 'ball' | 'bowl' | 'folded' | 'blanket' | 'pillow' | 'basket'
const PROP_FRAME: Record<PetProp, number> = { ball: 0, bowl: 1, folded: 2, blanket: 3, pillow: 4, basket: 5 }
export function PropArt({ item, className = '' }: { item: PetProp; className?: string }) {
  return <span aria-hidden="true" className={`pet-prop-art ${className}`} style={{ backgroundImage: `url("${petRoomAsset('care-props-v2.webp')}")`, backgroundPosition: position(PROP_FRAME[item]) }} />
}
