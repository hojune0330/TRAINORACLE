import React, { useEffect, useRef, useState } from 'react'
import { useCalendarMotion } from '../../hooks/useCalendarMotion'
import { motionFrame, motionPosition, type PetMotionClip } from './pet-motion'

/** Visual-only playback. onEnd changes poses/copy, never care or journal progress. */
export function PetMotion({ clip, active, onReady, onEnd, replay }: {
  clip: PetMotionClip; active: boolean; onReady: (ready: boolean) => void; onEnd?: () => void; replay?: number | string
}) {
  const element = useRef<HTMLSpanElement>(null)
  const [shown, setShown] = useState<{ clip: PetMotionClip; source: string; key: string } | null>(null)
  const [failed, setFailed] = useState<string | null>(null)
  const { reduced } = useCalendarMotion()
  const elapsed = useRef(0)
  const finished = useRef(false)
  const end = useRef(onEnd)
  end.current = onEnd
  const source = `${import.meta.env.BASE_URL}games/pet-motion-v1/${clip.sheet}`
  const key = `${source}:${replay ?? ''}`
  useEffect(() => {
    let alive = true
    finished.current = false
    const unavailable = () => { if (alive) { setFailed(key); onReady(false) } }
    const image = new Image()
    image.onload = () => {
      if (!alive) return
      // Reject a wrong-size or truncated sheet instead of showing neighbouring pets.
      const correct = image.naturalWidth > 0 && image.naturalHeight > 0
        && image.naturalWidth / clip.columns === image.naturalHeight / clip.rows
      if (!correct) { unavailable(); return }
      elapsed.current = 0
      setFailed(null)
      setShown({ clip, source, key })
      onReady(true)
    }
    image.onerror = unavailable
    image.src = source
    return () => { alive = false; image.onload = null; image.onerror = null }
  }, [source, key, clip, onReady])
  useEffect(() => {
    let request = 0
    let lastTime: number | null = null
    let lastFrame = -1
    const finish = () => {
      if (finished.current) return
      finished.current = true
      end.current?.()
    }
    const paint = () => {
      const frame = motionFrame(clip, elapsed.current, reduced)
      if (frame !== lastFrame && element.current) {
        element.current.style.backgroundPosition = motionPosition(clip, frame)
        lastFrame = frame
      }
    }
    const tick = (now: number) => {
      if (lastTime !== null) elapsed.current += Math.min(100, now - lastTime)
      lastTime = now
      paint()
      // Show the last frame for its full duration before moving to the next pose.
      if (!clip.loop && elapsed.current >= clip.frames / clip.fps * 1000) finish()
      else request = requestAnimationFrame(tick)
    }
    const resume = () => {
      cancelAnimationFrame(request)
      lastTime = null
      if (failed === key) {
        if (active && document.visibilityState !== 'hidden') finish()
        return
      }
      // Keep the previous frame on screen while the next sheet loads.
      if (shown?.key !== key || !element.current) return
      paint()
      if (!active || document.visibilityState === 'hidden' || finished.current) return
      if (reduced) { if (!clip.loop) finish() }
      else request = requestAnimationFrame(tick)
    }
    resume()
    document.addEventListener('visibilitychange', resume)
    return () => { cancelAnimationFrame(request); document.removeEventListener('visibilitychange', resume) }
  }, [active, clip, shown, key, failed, reduced])
  return <span ref={element} className="pet-sprite__motion" style={{
    opacity: shown && failed !== key ? 1 : 0, backgroundImage: shown ? `url("${shown.source}")` : undefined,
    backgroundSize: shown ? `${shown.clip.columns * 100}% ${shown.clip.rows * 100}%` : undefined,
    backgroundPosition: shown ? motionPosition(shown.clip, reduced ? shown.clip.restFrame : 0) : undefined,
  }} />
}
