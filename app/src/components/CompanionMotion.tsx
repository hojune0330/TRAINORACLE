import { useEffect, useRef, useState } from "react"
import { Pause, Play } from "lucide-react"
import { useCalendarMotion } from "../hooks/useCalendarMotion"
import { COMPANION_MOTION_SECONDS, companionMotionAtlas, companionMotionPoster, type CompanionMotion as Motion } from "../domain/training-companions"
import "../styles/training-companions.css"

/** Calm idle while visible; requested exercise and confirmed-save gestures play once. */
export function CompanionMotion({ motion = "warm_up", autoPlay = false, interactive = false, size = 64 }: {
  readonly motion?: Exclude<Motion, "idle">; readonly autoPlay?: boolean; readonly interactive?: boolean; readonly size?: 64 | 80
}) {
  const { reduced } = useCalendarMotion()
  const root = useRef<HTMLSpanElement>(null)
  const [onScreen, setOnScreen] = useState(() => typeof IntersectionObserver === "undefined")
  const [visible, setVisible] = useState(() => document.visibilityState !== "hidden")
  const [paused, setPaused] = useState(false)
  const [requested, setRequested] = useState(false)
  const [readyMotion, setReadyMotion] = useState<Motion | null>(null)
  const [frame, setFrame] = useState(0)
  const [failed, setFailed] = useState(false)
  const [posterFailed, setPosterFailed] = useState(false)
  const autoStarted = useRef(false)
  const previousMotion = useRef(motion)
  const activeMotion: Motion | null = !reduced && visible && onScreen && !failed && !posterFailed && (requested || !paused)
    ? requested ? motion : "idle" : null
  const ready = activeMotion !== null && readyMotion === activeMotion

  useEffect(() => {
    const hide = () => { setRequested(false); setReadyMotion(null); setFrame(0) }
    const visibility = () => {
      const shown = document.visibilityState !== "hidden"
      setVisible(shown)
      if (!shown) hide()
    }
    document.addEventListener("visibilitychange", visibility)
    const observer = typeof IntersectionObserver === "undefined" ? null : new IntersectionObserver(entries => {
      const shown = entries.some(entry => entry.isIntersecting)
      setOnScreen(shown)
      if (!shown) hide()
    })
    if (root.current) observer?.observe(root.current)
    return () => { observer?.disconnect(); document.removeEventListener("visibilitychange", visibility) }
  }, [])
  useEffect(() => {
    if (previousMotion.current === motion) return
    previousMotion.current = motion; autoStarted.current = false
    setRequested(false); setReadyMotion(null); setFailed(false); setFrame(0); setPosterFailed(false)
  }, [motion])
  useEffect(() => {
    if (!autoPlay || autoStarted.current) return
    if (reduced) { autoStarted.current = true; return }
    if (!visible || !onScreen) return
    autoStarted.current = true
    setReadyMotion(null); setFrame(0); setRequested(true)
  }, [autoPlay, reduced, motion, visible, onScreen])
  useEffect(() => {
    if (!activeMotion || !ready) return
    let raf = 0, start: number | undefined
    const tick = (now: number) => {
      start ??= now
      const progress = (now - start) / (COMPANION_MOTION_SECONDS[activeMotion] * 1000)
      if (activeMotion !== "idle" && progress >= 1) {
        setRequested(false); setReadyMotion(null); setFrame(0)
        return
      }
      setFrame(Math.min(15, Math.floor((progress % 1) * 16)))
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [activeMotion, ready])
  useEffect(() => { if (reduced) { setRequested(false); setReadyMotion(null); setFrame(0) } }, [reduced])

  const content = <span className="companion-motion__frame" style={{ width: size, height: size }} aria-hidden="true">
    <img className="companion-motion__poster" src={companionMotionPoster("idle")} width={size} height={size} alt="" loading="lazy" decoding="async" draggable={false}
      style={{ visibility: ready ? "hidden" : "visible" }} onError={() => setPosterFailed(true)} />
    {activeMotion && <img key={activeMotion} className="companion-motion__atlas" src={companionMotionAtlas(activeMotion)} alt="" draggable={false}
      style={{ opacity: ready ? 1 : 0, transform: `translateX(-${frame * 100 / 16}%)` }}
      onLoad={() => setReadyMotion(activeMotion)} onError={() => { setFailed(true); setRequested(false); setReadyMotion(null) }} />}
  </span>
  if (posterFailed) return null
  return <span ref={root} className="companion-motion" data-motion={motion} data-playback={activeMotion ?? "still"}>
    {interactive && !reduced && !failed ? <button type="button" className="companion-motion--button" aria-label={requested ? "수달 동작 멈추기" : "수달 동작 보기"}
      onClick={() => { setReadyMotion(null); setFrame(0); setRequested(value => !value) }}>
      {content}<span className="companion-motion__label">{requested ? "멈추기" : "동작 보기"}</span>
    </button> : content}
    {!reduced && !failed && <button type="button" className="companion-motion__toggle" aria-label={paused ? "수달 움직임 켜기" : "수달 움직임 멈추기"}
      title={paused ? "움직임 켜기" : "움직임 멈추기"} aria-pressed={paused}
      onClick={() => { setPaused(value => !value); setRequested(false); setReadyMotion(null); setFrame(0) }}>
      {paused ? <Play size={14} aria-hidden="true" /> : <Pause size={14} aria-hidden="true" />}
    </button>}
  </span>
}
