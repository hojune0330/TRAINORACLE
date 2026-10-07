import React from "react"
import { ArrowLeft, ChevronsRight, Footprints, Pause, Play, RotateCcw, MoveUp } from "lucide-react"
import {
  advanceTreadmill, newTreadmillRun, treadmillCommand, treadmillCourseSeconds, treadmillElapsed, treadmillTip, treadmillWarning,
  TREADMILL_RULES, TREADMILL_STAGES, TREADMILL_UPGRADES,
} from "../domain/minigame/treadmill"
import type { TreadmillCommand, TreadmillState } from "../domain/minigame/treadmill"
import { drawTreadmill, treadmillPalette } from "./treadmill/draw"
import "../styles/treadmill-game.css"

/** Best of this app session only. Not saved, not sent, reset when the app reloads. */
let sessionBest = 0

/** Taps act on press for game timing; keyboard activation (click with detail 0) still works. */
function tapAction(action: () => void) {
  return {
    onPointerDown: (event: React.PointerEvent) => { if (event.button === 0) { event.preventDefault(); action() } },
    onClick: (event: React.MouseEvent) => { if (event.detail === 0) action() },
  }
}
const fillStyle = (fill: number) => ({ "--fill": Math.max(0, Math.min(1, fill)).toFixed(3) }) as React.CSSProperties

const upgradeName = (id: string) => TREADMILL_UPGRADES.find(upgrade => upgrade.id === id)?.name ?? id

export function TreadmillGame({ onBack }: { readonly onBack: () => void }) {
  const state = React.useRef(newTreadmillRun())
  const [view, setView] = React.useState<TreadmillState>(state.current)
  const [best, setBest] = React.useState(sessionBest)
  const canvas = React.useRef<HTMLCanvasElement>(null)
  const surface = React.useRef<HTMLDivElement>(null)
  const heldPointers = React.useRef(new Set<number>())
  const keyboardHeld = React.useRef(false)
  const releaseInputs = () => { heldPointers.current.clear(); keyboardHeld.current = false }
  const settle = React.useCallback((next: TreadmillState) => {
    if (next.mode === "over" || next.mode === "clear") {
      const elapsed = treadmillElapsed(next)
      if (elapsed > sessionBest) { sessionBest = elapsed; setBest(elapsed) }
    }
  }, [])
  const command = React.useCallback((input: TreadmillCommand) => {
    state.current = treadmillCommand(state.current, input)
    if (state.current.mode !== "running" || input.type === "start") releaseInputs()
    setView(state.current)
  }, [])
  const updateHeld = () => command({ type: "run", held: keyboardHeld.current || heldPointers.current.size > 0 })

  React.useEffect(() => {
    const element = canvas.current, container = surface.current
    if (!element || !container) return
    const context = element.getContext("2d")
    if (!context) return
    let width = 320, height = 220, previous = 0, published = 0, frame = 0
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)")
    let palette = treadmillPalette(container)
    const draw = () => drawTreadmill(context, state.current, width, height, palette, motion.matches)
    const resize = () => {
      width = element.clientWidth; height = element.clientHeight
      const ratio = Math.min(window.devicePixelRatio || 1, 2)
      element.width = Math.round(width * ratio); element.height = Math.round(height * ratio)
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
      const before = state.current
      if (delta > 0.25) command({ type: "pause" })
      else state.current = advanceTreadmill(state.current, delta)
      const after = state.current
      if (after.mode !== "running") releaseInputs()
      if (after !== before && after.stats.hits > before.stats.hits) navigator.vibrate?.(after.mode === "over" ? [60, 40, 90] : 40)
      if (before.mode !== after.mode) settle(after)
      if (now - published > 80 || before.mode !== after.mode) { setView(after); published = now }
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
      releaseInputs()
    }
  }, [command, settle])

  const running = view.mode === "running"
  const stage = TREADMILL_STAGES[view.stage]!
  const nextStage = TREADMILL_STAGES[view.stage + 1]
  const warning = treadmillWarning(view)
  const total = treadmillCourseSeconds()
  const elapsed = Math.min(total, Math.floor(treadmillElapsed(view)))
  const focusField = () => canvas.current?.focus({ preventScroll: true })
  const start = () => { command({ type: "start" }); focusField() }
  const resume = () => { command({ type: "resume" }); focusField() }
  const energyLow = view.energy < view.jumpCost + 4
  const canJump = running && view.y === 0 && view.energy >= view.jumpCost
  const canDash = running && view.cooldown === 0 && view.energy >= TREADMILL_RULES.dashCost

  const handleKey = (event: React.KeyboardEvent) => {
    if (!running || event.repeat) return
    const onField = event.target === canvas.current
    if (event.key === "ArrowRight") {
      event.preventDefault(); keyboardHeld.current = true; updateHeld()
    } else if (event.key === "ArrowUp" || (event.code === "Space" && onField)) {
      event.preventDefault(); command({ type: "jump" })
    } else if (event.key.toLowerCase() === "d") {
      event.preventDefault(); command({ type: "dash" })
    } else if (event.key === "Escape" || event.key.toLowerCase() === "p") {
      event.preventDefault(); command({ type: "pause" })
    }
  }

  return <div className="treadmill-game" ref={surface} onKeyDown={handleKey} data-mode={view.mode}
    onKeyUp={event => { if (event.key === "ArrowRight") { keyboardHeld.current = false; updateHeld() } }}
    onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) command({ type: "pause" }) }}>
    <header className="utility-header treadmill-game__header">
      <button type="button" onClick={onBack} aria-label="더보기로 돌아가기"><ArrowLeft size={19} aria-hidden="true" /></button>
      <div><div className="utility-header__eyebrow">TRAINORACLE 미니게임</div><h1>멈추면 밀려나는 트랙</h1></div>
      <button type="button" className="treadmill-game__pause" disabled={!running} aria-label="일시정지" title="일시정지 (Esc)"
        onClick={() => command({ type: "pause" })}><Pause size={18} aria-hidden="true" /></button>
    </header>

    <div className="treadmill-game__hud">
      <ol className="treadmill-game__stages" aria-label={`코스 ${view.stage + 1}/3 · ${stage.name}`}>
        {TREADMILL_STAGES.map((item, index) => {
          const done = index < view.stage || (index === view.stage && view.mode === "clear")
          const fill = done ? 1 : index === view.stage ? view.seconds / TREADMILL_RULES.stageSeconds : 0
          return <li key={item.id} data-state={done ? "done" : index === view.stage ? "current" : "next"}>
            <span>{item.name}</span>
            <i aria-hidden="true"><b style={fillStyle(fill)} /></i>
          </li>
        })}
      </ol>
      <div className="treadmill-game__meters">
        <output aria-label="경기 진행 시간" aria-live="off">{elapsed} / {total}초</output>
        <div className={`treadmill-game__energy${energyLow ? " is-low" : ""}`}>
          <progress max={TREADMILL_RULES.maxEnergy} value={view.energy} aria-label="게임 에너지 게이지" />
          <output aria-label="게임 에너지" aria-live="off">에너지 {Math.ceil(view.energy)}</output>
        </div>
      </div>
    </div>

    <div className="treadmill-game__field" data-tone={warning.tone}>
      <canvas ref={canvas} tabIndex={0}
        aria-label="게임 조작 영역. 오른쪽 방향키를 누르고 있으면 달리기, 스페이스나 위 방향키는 점프, D는 대시, Esc는 일시정지. 왼쪽 빨간 끝으로 밀리면 추락합니다." />
      <p className="treadmill-game__warning" role="status" data-tone={warning.tone}>{warning.text}</p>
      {view.mode === "paused" && <div className="treadmill-game__overlay">
        {view.seconds === 0 && view.stage > 0
          ? <><strong>{view.stage + 1}구간 · {stage.name}</strong><p>{stage.hint}</p></>
          : <><strong>일시정지</strong><p>바닥과 장애물이 멈춰 있어요.</p></>}
        <div className="treadmill-game__overlay-actions">
          <button type="button" className="treadmill-game__primary" onClick={resume}><Play size={16} aria-hidden="true" />계속</button>
          <button type="button" onClick={start}><RotateCcw size={16} aria-hidden="true" />처음부터</button>
        </div>
      </div>}
    </div>

    {(running || view.mode === "paused") && <div className="treadmill-game__controls" onContextMenu={event => event.preventDefault()}>
      <button type="button" className="treadmill-game__run" disabled={!running} aria-pressed={view.running}
        onPointerDown={event => { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); heldPointers.current.add(event.pointerId); updateHeld() }}
        onPointerUp={event => { heldPointers.current.delete(event.pointerId); updateHeld() }}
        onPointerCancel={event => { heldPointers.current.delete(event.pointerId); updateHeld() }}
        onLostPointerCapture={event => { heldPointers.current.delete(event.pointerId); updateHeld() }}
        onKeyDown={event => { if (!event.repeat && [" ", "Enter"].includes(event.key)) { event.preventDefault(); event.stopPropagation(); keyboardHeld.current = true; updateHeld() } }}
        onKeyUp={event => { if ([" ", "Enter"].includes(event.key)) { event.preventDefault(); keyboardHeld.current = false; updateHeld() } }}>
        <Footprints size={20} aria-hidden="true" />
        달리기 꾹
        <small>{view.exhausted ? "에너지 0 · 손을 떼세요" : view.running ? "앞으로 · 에너지 소모" : "놓으면 회복 · 뒤로 밀림"}</small>
      </button>
      <button type="button" className="treadmill-game__jump" disabled={!canJump}
        {...tapAction(() => command({ type: "jump" }))}>
        <MoveUp size={20} aria-hidden="true" />점프<small>{view.jumpCost} 소모</small>
      </button>
      <button type="button" className="treadmill-game__dash" disabled={!canDash}
        {...tapAction(() => command({ type: "dash" }))}>
        <ChevronsRight size={20} aria-hidden="true" />대시
        <small>{view.cooldown > 0 ? `${view.cooldown.toFixed(1)}초 뒤` : `${TREADMILL_RULES.dashCost} 소모`}</small>
        {view.cooldown > 0 && <i aria-hidden="true" style={fillStyle(1 - view.cooldown / view.cooldownSeconds)} />}
      </button>
    </div>}

    {view.mode === "ready" && <section className="treadmill-game__panel" aria-labelledby="treadmill-ready-title">
      <h2 id="treadmill-ready-title">30초 동안 바닥 위에서 버티세요</h2>
      <ul className="treadmill-game__rules">
        <li><Footprints size={16} aria-hidden="true" /><span><strong>꾹 누르면 앞으로</strong> 에너지를 써요.</span></li>
        <li><Pause size={16} aria-hidden="true" /><span><strong>손을 떼면 회복</strong> 대신 뒤로 밀려요.</span></li>
        <li><MoveUp size={16} aria-hidden="true" /><span><strong>장애물은 점프</strong> 빨간 끝이나 가시에 닿으면 끝.</span></li>
      </ul>
      <p className="treadmill-game__hint">앞쪽에 벌어 둔 공간이 곧 쉴 수 있는 시간이에요.</p>
      <button type="button" className="treadmill-game__primary" onClick={start}><Play size={16} aria-hidden="true" />시작</button>
      <p className="treadmill-game__keys">키보드: → 달리기 · Space/↑ 점프 · D 대시 · Esc 정지</p>
    </section>}

    {view.mode === "upgrade" && nextStage && <section className="treadmill-game__panel" aria-labelledby="treadmill-upgrade-title">
      <h2 id="treadmill-upgrade-title">안전 발판 · 강화 하나 선택</h2>
      <p className="treadmill-game__hint">다음 구간 <strong>{nextStage.name}</strong> · {nextStage.hint}. 고르면 에너지 +{TREADMILL_RULES.checkpointRefill}.</p>
      <div className="treadmill-game__upgrades">
        {TREADMILL_UPGRADES.map(upgrade => {
          const owned = view.upgrades.filter(id => id === upgrade.id).length
          return <button type="button" key={upgrade.id} onClick={() => command({ type: "upgrade", upgrade: upgrade.id })}>
            <strong>{upgrade.name}{owned > 0 && <em> · 보유 {owned}</em>}{upgrade.fits === nextStage.id && <mark>다음 구간에 맞음</mark>}</strong>
            <span className="treadmill-game__plus">+ {upgrade.benefit}</span>
            <span className="treadmill-game__minus">− {upgrade.cost}</span>
          </button>
        })}
      </div>
    </section>}

    {(view.mode === "over" || view.mode === "clear") && <section className="treadmill-game__panel treadmill-game__result" aria-labelledby="treadmill-result-title">
      <h2 id="treadmill-result-title">{view.mode === "clear" ? "세 구간 완주!" : view.failure === "spike" ? `${stage.name}에서 가시에 닿았어요` : `${stage.name}에서 뒤로 떨어졌어요`}</h2>
      <dl className="treadmill-game__stats">
        <div><dt>버틴 시간</dt><dd>{elapsed}<small>/{total}초</small></dd></div>
        <div><dt>넘은 장애물</dt><dd>{view.stats.cleared}</dd></div>
        <div><dt>부딪힘</dt><dd>{view.stats.hits - (view.failure === "spike" ? 1 : 0)}</dd></div>
        <div><dt>이번 접속 최고</dt><dd>{Math.floor(best)}<small>초</small></dd></div>
      </dl>
      <p className="treadmill-game__tip">{treadmillTip(view)}</p>
      {view.upgrades.length > 0 && <p className="treadmill-game__picks">이번 판: {view.upgrades.map(upgradeName).join(" · ")}</p>}
      <button type="button" className="treadmill-game__primary" onClick={start}><RotateCcw size={16} aria-hidden="true" />다시 시작</button>
      <p className="treadmill-game__keys">다시 시작하면 강화가 초기화돼요.</p>
    </section>}

    <p className="treadmill-game__note">게임 에너지와 기록은 이번 판에만 쓰여요. 실제 훈련 수치·포인트와 연결되지 않고 저장하지 않아요.</p>
  </div>
}
