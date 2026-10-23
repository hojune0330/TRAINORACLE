import React, { useCallback, useEffect, useRef, useState } from 'react'
import { POSE_FRAME, petAsset, type PetId, type PetPose } from './pet-catalog'
import { PET_MOTION_CATALOG } from './pet-motion-catalog'
import { PetMotion } from './PetMotion'
import type { PetMotion as MotionName } from './pet-motion'
import './pet-art.css'

export const petRoomAsset = (name: string) => `${import.meta.env.BASE_URL}games/pet-room-v1/${name}`
const position = (frame: number) => `${(frame % 3) * 50}% ${Math.floor(frame / 3) * 100}%`

type PetSpriteProps = {
  id: PetId; pose?: PetPose; className?: string; motion?: MotionName; replay?: number | string; active?: boolean
  /** The resting motion after a one-shot. This never advances or saves game progress. */
  settleTo?: MotionName
  /** Visual completion, including static-art fallback and reduced motion. */
  onMotionEnd?: () => void
}
export function PetSprite(props: PetSpriteProps) {
  // Keep the visible frame between actions; remount only when the animal changes.
  return <PetSpriteFrame key={props.id} {...props} />
}
function PetSpriteFrame({ id, pose = 'awake', className = '', motion, active = true, replay, settleTo, onMotionEnd }: PetSpriteProps) {
  const element = useRef<HTMLSpanElement>(null)
  const [visible, setVisible] = useState(() => typeof IntersectionObserver === 'undefined')
  const [onScreen, setOnScreen] = useState(() => typeof IntersectionObserver === 'undefined')
  const [motionReady, setMotionReady] = useState(false)
  const [ended, setEnded] = useState<string | null>(null)
  const ready = useCallback((value: boolean) => setMotionReady(value), [])
  const actionKey = `${motion ?? ''}:${replay ?? ''}`
  const playing = ended === actionKey && settleTo ? settleTo : motion
  const clip = playing ? PET_MOTION_CATALOG[id]?.[playing] : undefined
  const end = useCallback(() => {
    if (ended === actionKey) return
    setEnded(actionKey)
    onMotionEnd?.()
  }, [actionKey, ended, onMotionEnd])
  useEffect(() => {
    if (visible && active && motion && !clip && (settleTo || onMotionEnd)) end()
  }, [visible, active, motion, clip, settleTo, onMotionEnd, end])
  useEffect(() => {
    if (!element.current || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(entries => {
      const intersects = entries.some(entry => entry.isIntersecting)
      if (intersects) setVisible(true)
      setOnScreen(intersects)
    }, { rootMargin: '160px' })
    observer.observe(element.current)
    return () => observer.disconnect()
  }, [])
  return <span ref={element} aria-hidden="true" data-pet-motion={motionReady && clip ? playing : undefined} className={`pet-sprite ${className}`} style={{ backgroundImage: visible && !(motionReady && clip) ? `url("${petAsset(id)}")` : undefined, backgroundPosition: position(POSE_FRAME[pose]) }}>
    {visible && clip && <PetMotion clip={clip} active={active && onScreen} onReady={ready} onEnd={end} replay={replay} />}
  </span>
}
export function ActionArt({ frame }: { frame: number }) {
  return <span aria-hidden="true" className="pet-action-art" style={{ backgroundImage: `url("${petRoomAsset('actions.webp')}")`, backgroundPosition: position(frame) }} />
}
export type PetProp = 'ball' | 'bowl' | 'bowl-empty' | 'folded' | 'blanket' | 'pillow' | 'basket'
const PROP_FRAME: Record<PetProp, number> = { ball: 0, bowl: 1, 'bowl-empty': 1, folded: 2, blanket: 3, pillow: 4, basket: 5 }
export function PropArt({ item, className = '' }: { item: PetProp; className?: string }) {
  const single = item === 'blanket' ? 'blanket-v3.webp' : item === 'bowl-empty' ? 'bowl-empty-v3.webp' : null
  return <span aria-hidden="true" data-pet-prop={item} className={`pet-prop-art ${className}`} style={{ backgroundImage: `url("${petRoomAsset(single ?? 'care-props-v2.webp')}")`, backgroundPosition: single ? 'center' : position(PROP_FRAME[item]), backgroundSize: single ? '100% 100%' : undefined }} />
}
