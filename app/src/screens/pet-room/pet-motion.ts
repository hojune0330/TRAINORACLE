import type { PetId, PetPose } from './pet-catalog'

export const PET_MOTIONS = ['idle', 'walk', 'walk-left', 'walk-right', 'pet', 'eat', 'play', 'lie-down', 'sleep', 'wake', 'hello'] as const
export type PetMotion = typeof PET_MOTIONS[number]
export type PetMotionClip = Readonly<{
  sheet: string
  columns: number
  rows: number
  frames: number
  fps: number
  loop: boolean
  /** A readable pose when the user has turned motion off. */
  restFrame: number
}>
export type PetMotionCatalog = Partial<Record<PetId, Partial<Record<PetMotion, PetMotionClip>>>>

export const motionForPose = (pose: PetPose): PetMotion => ({
  awake: 'idle', happy: 'pet', eating: 'eat', playing: 'play', sleeping: 'sleep', waking: 'wake',
} as const)[pose]

export function motionFrame(clip: PetMotionClip, elapsedMs: number, reduced = false) {
  if (reduced) return clip.restFrame
  const frame = Math.floor(Math.max(0, elapsedMs) * clip.fps / 1000)
  return clip.loop ? frame % clip.frames : Math.min(frame, clip.frames - 1)
}
export function motionPosition(clip: PetMotionClip, frame: number) {
  const column = frame % clip.columns
  const row = Math.floor(frame / clip.columns)
  return `${clip.columns > 1 ? column / (clip.columns - 1) * 100 : 0}% ${clip.rows > 1 ? row / (clip.rows - 1) * 100 : 0}%`
}
