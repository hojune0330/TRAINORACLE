import { useEffect, useRef, useState } from "react"
import { useCalendarMotion } from "../hooks/useCalendarMotion"
import { COMPANION_MOTION_SECONDS, companionMotionAtlas, companionMotionPoster, type CompanionMotion as Motion } from "../domain/training-companions"
import "../styles/training-companions.css"

/** One short, user-started gesture. Confirmed-save hosts may request one automatic nod. */
export function CompanionMotion({ motion = "warm_up", autoPlay = false, interactive = false, size = 64 }: {
  readonly motion?: Motion; readonly autoPlay?: boolean; readonly interactive?: boolean; readonly size?: 64 | 80
}) {
  const { reduced } = useCalendarMotion()
  const [requested, setRequested] = useState(false)
  const [ready, setReady] = useState(false)
  const [frame, setFrame] = useState(0)
  const [failed, setFailed] = useState(false)
  const [posterFailed, setPosterFailed] = useState(false)
  const autoStarted = useRef(false)
  const previousMotion = useRef(motion)
  useEffect(() => {
    if (previousMotion.current === motion) return
    previousMotion.current = motion; autoStarted.current = false
    setRequested(false); setReady(false); setFailed(false); setFrame(0); setPosterFailed(false)
  }, [motion])
  useEffect(() => {
    if (!autoPlay || autoStarted.current) return
    autoStarted.current = true
    if (!reduced && document.visibilityState !== "hidden") setRequested(true)
  }, [autoPlay, reduced, motion])
  useEffect(() => {
    if (!requested || !ready || reduced || failed) return
    let raf = 0, start: number | undefined
    const stop = () => { cancelAnimationFrame(raf); setRequested(false); setReady(false); setFrame(0) }
    const tick = (now: number) => {
      if (document.visibilityState === "hidden") { stop(); return }
      start ??= now
      const progress = (now - start) / (COMPANION_MOTION_SECONDS[motion] * 1000)
      if (progress >= 1) { stop(); return }
      setFrame(Math.min(15, Math.floor(progress * 16)))
      raf = requestAnimationFrame(tick)
    }
    const hidden = () => { if (document.visibilityState === "hidden") stop() }
    document.addEventListener("visibilitychange", hidden)
    raf = requestAnimationFrame(tick)
    return () => { cancelAnimationFrame(raf); document.removeEventListener("visibilitychange", hidden) }
  }, [requested, ready, reduced, failed, motion])
  useEffect(() => { if (reduced) { setRequested(false); setReady(false); setFrame(0) } }, [reduced])
  const content = <span className="companion-motion__frame" style={{ width: size, height: size }} aria-hidden="true">
    {!posterFailed && <img className="companion-motion__poster" src={companionMotionPoster(motion)} width={size} height={size} alt="" loading="lazy" decoding="async" draggable={false}
      style={{ visibility: requested && ready && !reduced && !failed ? "hidden" : "visible" }} onError={() => setPosterFailed(true)} />}
    {requested && !reduced && !failed && <img className="companion-motion__atlas" src={companionMotionAtlas(motion)} alt="" draggable={false}
      style={{ opacity: ready ? 1 : 0, transform: `translateX(-${frame * 100 / 16}%)` }}
      onLoad={() => setReady(true)} onError={() => { setFailed(true); setRequested(false); setReady(false) }} />}
  </span>
  if (posterFailed) return null
  if (!interactive || reduced || failed) return <span className="companion-motion" data-motion={motion}>{content}</span>
  return <button type="button" className="companion-motion companion-motion--button" aria-label={requested ? "수달 동작 멈추기" : "수달 동작 보기"}
    onClick={() => { setReady(false); setFrame(0); setRequested(value => !value) }}>
    {content}<span className="companion-motion__label">{requested ? "멈추기" : "동작 보기"}</span>
  </button>
}
