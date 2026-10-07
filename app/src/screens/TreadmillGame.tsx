import React from "react"
import { ArrowLeft, Pause, Play, RotateCcw } from "lucide-react"
import { advanceTreadmill, newTreadmillRun, treadmillCommand, treadmillWarning, TREADMILL_RULES, TREADMILL_STAGES, TREADMILL_UPGRADES } from "../domain/minigame/treadmill"
import type { TreadmillCommand, TreadmillState } from "../domain/minigame/treadmill"
import { drawTreadmill, treadmillPalette } from "./treadmill/draw"
import "../styles/treadmill-game.css"

export function TreadmillGame({ onBack }: { readonly onBack: () => void }) {
  const state = React.useRef(newTreadmillRun())
  const [view, setView] = React.useState<TreadmillState>(state.current)
  const canvas = React.useRef<HTMLCanvasElement>(null)
  const surface = React.useRef<HTMLDivElement>(null)
  const heldPointers = React.useRef(new Set<number>())
  const keyboardHeld = React.useRef(false)
  const command = React.useCallback((input: TreadmillCommand) => {
    state.current = treadmillCommand(state.current, input)
    if (state.current.mode !== "running" || input.type === "start") {
      heldPointers.current.clear(); keyboardHeld.current = false
    }
    setView(state.current)
  }, [])
  const updateHeld = () => command({ type: "run", held: keyboardHeld.current || heldPointers.current.size > 0 })

  React.useEffect(() => {
    const element = canvas.current, container = surface.current
    if (!element || !container) return
    const context = element.getContext("2d")
    if (!context) return
    let width = 320, height = 240, previous = 0, published = 0, frame = 0
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)")
    let palette = treadmillPalette(container)
    const draw = () => drawTreadmill(context, state.current, width, height, palette, motion.matches)
    const resize = () => {
      width = element.clientWidth; height = element.clientHeight
      const ratio = Math.min(window.devicePixelRatio || 1, 2)
      element.width = width * ratio; element.height = height * ratio
      context.setTransform(ratio, 0, 0, ratio, 0, 0); palette = treadmillPalette(container); draw()
    }
    const refreshTheme = () => { palette = treadmillPalette(container); draw() }
    const observer = new ResizeObserver(resize)
    observer.observe(element)
    const themeObserver = new MutationObserver(refreshTheme)
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "style", "data-theme"] })
    const tick = (now: number) => {
      const delta = previous === 0 ? 0 : (now - previous) / 1000
      previous = now
      const oldMode = state.current.mode
      if (delta > 0.25) command({ type: "pause" })
      else state.current = advanceTreadmill(state.current, delta)
      if (state.current.mode !== "running") { heldPointers.current.clear(); keyboardHeld.current = false }
      if (now - published > 80 || oldMode !== state.current.mode) { setView(state.current); published = now }
      draw(); frame = window.requestAnimationFrame(tick)
    }
    const pause = () => command({ type: "pause" })
    const hidden = () => { if (document.hidden) pause() }
    window.addEventListener("blur", pause)
    document.addEventListener("visibilitychange", hidden)
    motion.addEventListener("change", refreshTheme)
    resize(); frame = window.requestAnimationFrame(tick)
    return () => {
      window.cancelAnimationFrame(frame); observer.disconnect(); themeObserver.disconnect()
      window.removeEventListener("blur", pause); document.removeEventListener("visibilitychange", hidden)
      motion.removeEventListener("change", refreshTheme)
      heldPointers.current.clear(); keyboardHeld.current = false
    }
  }, [command])

  const running = view.mode === "running"
  const stage = TREADMILL_STAGES[view.stage]!
  const warning = treadmillWarning(view)
  const start = () => { command({ type: "start" }); canvas.current?.focus() }
  const handleKey = (event: React.KeyboardEvent) => {
    if (!running || event.repeat) return
    if (event.key === "ArrowRight") {
      event.preventDefault(); keyboardHeld.current = true; updateHeld()
    } else if (event.code === "Space" && event.target === canvas.current) {
      event.preventDefault(); command({ type: "jump" })
    } else if (event.key.toLowerCase() === "d") {
      event.preventDefault(); command({ type: "dash" })
    }
  }
  return <div className="treadmill-game" ref={surface} onKeyDown={handleKey}
    onKeyUp={event => { if (event.key === "ArrowRight") { keyboardHeld.current = false; updateHeld() } }}
    onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) command({ type: "pause" }) }}>
    <header className="utility-header">
      <button type="button" onClick={onBack} aria-label="더보기로 돌아가기"><ArrowLeft size={19} aria-hidden="true" /></button>
      <div><div className="utility-header__eyebrow">TRAINORACLE</div><h1>멈추면 밀려나는 트랙</h1></div>
    </header>
    <p className="treadmill-game__intro">앞쪽 공간을 벌고 잠깐 쉬어 가며 세 구간을 완주하세요.</p>
    <div className="treadmill-game__status">
      <span>{view.stage + 1}/3 · {stage.name}</span>
      <output aria-label="경기 진행 시간" aria-live="off">{Math.min(30, Math.floor(view.stage * 10 + view.seconds))} / 30초</output>
      <output aria-label="게임 에너지" aria-live="off">에너지 {Math.ceil(view.energy)}</output>
    </div>
    <progress className="treadmill-game__energy" max={TREADMILL_RULES.maxEnergy} value={view.energy} aria-label="게임 에너지 게이지" />
    <div className="treadmill-game__field">
      <canvas ref={canvas} tabIndex={0} aria-label="게임 조작 영역. 오른쪽 방향키를 누르면 달리기, 스페이스는 점프, D는 대시. 왼쪽 끝으로 밀리면 추락합니다." />
      <p className="treadmill-game__warning" role="status">{warning}</p>
    </div>
    <p className="treadmill-game__route">트랙 → 진흙 → 가시밭</p>
    <div className="treadmill-game__controls">
      <button type="button" disabled={!running} aria-pressed={view.running}
        onPointerDown={event => { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); heldPointers.current.add(event.pointerId); updateHeld() }}
        onPointerUp={event => { heldPointers.current.delete(event.pointerId); updateHeld() }}
        onPointerCancel={event => { heldPointers.current.delete(event.pointerId); updateHeld() }}
        onLostPointerCapture={event => { heldPointers.current.delete(event.pointerId); updateHeld() }}
        onKeyDown={event => { if (!event.repeat && [" ", "Enter"].includes(event.key)) { event.preventDefault(); keyboardHeld.current = true; updateHeld() } }}
        onKeyUp={event => { if ([" ", "Enter"].includes(event.key)) { event.preventDefault(); keyboardHeld.current = false; updateHeld() } }}>
        달리기 꾹<small>→ · 놓으면 회복</small>
      </button>
      <button type="button" disabled={!running || view.y > 0 || view.energy < view.jumpCost} onClick={() => command({ type: "jump" })}>
        점프<small>Space · {view.jumpCost} 소모</small>
      </button>
      <button type="button" disabled={!running || view.cooldown > 0 || view.energy < TREADMILL_RULES.dashCost} onClick={() => command({ type: "dash" })}>
        대시<small>{view.cooldown > 0 ? `${view.cooldown.toFixed(1)}초 뒤` : "D · 18 소모"}</small>
      </button>
    </div>
    <div className="treadmill-game__actions">
      <button type="button" className="treadmill-game__primary" onClick={start}>
        {view.mode === "ready" ? <Play size={16} aria-hidden="true" /> : <RotateCcw size={16} aria-hidden="true" />}
        {view.mode === "ready" ? "시작" : "다시 시작"}
      </button>
      <button type="button" disabled={!running && view.mode !== "paused"} onClick={() => {
        command({ type: view.mode === "paused" ? "resume" : "pause" }); canvas.current?.focus()
      }}>{view.mode === "paused" ? <Play size={16} aria-hidden="true" /> : <Pause size={16} aria-hidden="true" />}{view.mode === "paused" ? "계속" : "일시정지"}</button>
    </div>
    {view.mode === "upgrade" && <section className="treadmill-game__upgrades" aria-label="구간 사이 강화 선택">
      <h2>안전 발판 · 강화 하나 선택</h2>
      {TREADMILL_UPGRADES.map(upgrade => <button type="button" key={upgrade.id} onClick={() => command({ type: "upgrade", upgrade: upgrade.id })}>
        <strong>{upgrade.name}</strong><span>{upgrade.benefit} / {upgrade.cost}</span>
      </button>)}
    </section>}
    {view.upgrades.length > 0 && <p className="treadmill-game__picks">이번 판: {view.upgrades.map(id => TREADMILL_UPGRADES.find(upgrade => upgrade.id === id)!.name).join(" · ")}</p>}
    <p className="treadmill-game__note">게임 에너지는 이번 판에만 적용됩니다. 실제 훈련 수치나 포인트와 연결되지 않습니다.</p>
  </div>
}
