import React from "react"
import { ArrowLeft, ChevronsRight, Footprints, Pause, Play, RotateCcw, MoveUp, Star, Zap, Flame, Trophy } from "lucide-react"
import {
  advanceTreadmill, newTreadmillRun, treadmillCommand, treadmillCourseSeconds, treadmillElapsed, treadmillStars, treadmillTip, treadmillWarning,
  TREADMILL_RULES, TREADMILL_STAGES, TREADMILL_UPGRADES,
} from "../domain/minigame/treadmill"
import type { TreadmillCommand, TreadmillState, TreadmillUpgrade } from "../domain/minigame/treadmill"
import { createTreadmillRenderer, gamePalette } from "./treadmill/draw"
import { drawRunner } from "./treadmill/sprites"
import type { GamePalette } from "./treadmill/sprites"
import "../styles/treadmill-game.css"

/** Best of this app session only. Not saved, not sent, reset when the app reloads. */
let sessionBest = { score: 0, seconds: 0 }

/** Taps act on press for game timing; keyboard activation (click with detail 0) still works. */
function tapAction(action: () => void) {
  return {
    onPointerDown: (event: React.PointerEvent) => { if (event.button === 0) { event.preventDefault(); action() } },
    onClick: (event: React.MouseEvent) => { if (event.detail === 0) action() },
  }
}
const fillStyle = (fill: number) => ({ "--fill": Math.max(0, Math.min(1, fill)).toFixed(3) }) as React.CSSProperties
const upgradeName = (id: string) => TREADMILL_UPGRADES.find(upgrade => upgrade.id === id)?.name ?? id
const UPGRADE_ICON: Record<TreadmillUpgrade, typeof Zap> = { grip: Footprints, spring: MoveUp, economy: Flame }

/** Small canvas portrait of the runner wearing the given gear (Gun Hero-style loadout preview). */
function RunnerPortrait({ upgrades, pose = "idle", label }: { readonly upgrades: readonly TreadmillUpgrade[]; readonly pose?: "idle" | "cheer" | "hit" | "fall"; readonly label: string }) {
  const ref = React.useRef<HTMLCanvasElement>(null)
  React.useEffect(() => {
    const canvas = ref.current
    const context = canvas?.getContext("2d")
    if (!canvas || !context) return
    const ratio = Math.min(window.devicePixelRatio || 1, 2)
    const size = canvas.clientWidth || 88
    canvas.width = size * ratio; canvas.height = size * ratio
    context.setTransform(ratio, 0, 0, ratio, 0, 0)
    context.clearRect(0, 0, size, size)
    const palette = gamePalette(canvas)
    context.translate(size / 2, size * 0.86)
    const scale = size / 82
    context.scale(scale, scale)
    drawRunner(context, palette, { pose: pose === "fall" ? "hit" : pose, phase: 0, upgrades })
  }, [upgrades, pose])
  return <canvas ref={ref} className="treadmill-game__portrait" role="img" aria-label={label} />
}

function Stars({ count }: { readonly count: number }) {
  return <div className="treadmill-game__stars" role="img" aria-label={`별 ${count}개 / 3개`}>
    {[0, 1, 2].map(index => <Star key={index} size={34} aria-hidden="true" data-on={index < count || undefined} />)}
  </div>
}

export function TreadmillGame({ onBack }: { readonly onBack: () => void }) {
  const state = React.useRef(newTreadmillRun())
  const [view, setView] = React.useState<TreadmillState>(state.current)
  const [best, setBest] = React.useState(sessionBest)
  const [newBest, setNewBest] = React.useState(false)
  const canvas = React.useRef<HTMLCanvasElement>(null)
  const surface = React.useRef<HTMLDivElement>(null)
  const heldPointers = React.useRef(new Set<number>())
  const keyboardHeld = React.useRef(false)
  const releaseInputs = () => { heldPointers.current.clear(); keyboardHeld.current = false }
  const settle = React.useCallback((next: TreadmillState) => {
    if (next.mode !== "over" && next.mode !== "clear") return
    const seconds = treadmillElapsed(next)
    const better = next.stats.score > sessionBest.score
    setNewBest(better && next.stats.score > 0)
    sessionBest = { score: Math.max(sessionBest.score, next.stats.score), seconds: Math.max(sessionBest.seconds, seconds) }
    setBest(sessionBest)
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
    const render = createTreadmillRenderer()
    let width = 320, height = 300, previous = 0, published = 0, frame = 0
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)")
    let palette: GamePalette = gamePalette(container)
    const draw = (now: number) => render(context, state.current, width, height, palette, motion.matches, now)
    const resize = () => {
      width = element.clientWidth; height = element.clientHeight
      const ratio = Math.min(window.devicePixelRatio || 1, 2)
      element.width = Math.round(width * ratio); element.height = Math.round(height * ratio)
      context.setTransform(ratio, 0, 0, ratio, 0, 0); palette = gamePalette(container); draw(performance.now())
    }
    const refreshTheme = () => { palette = gamePalette(container) }
    const observer = new ResizeObserver(resize)
    observer.observe(element)
    const tick = (now: number) => {
      const delta = previous === 0 ? 0 : (now - previous) / 1000
      previous = now
      const before = state.current
      if (delta > 0.25) command({ type: "pause" })
      else state.current = advanceTreadmill(state.current, delta)
      const after = state.current
      if (after.mode !== "running") releaseInputs()
      if (after.stats.hits > before.stats.hits) navigator.vibrate?.(after.mode === "over" ? [60, 40, 90] : 40)
      if (before.mode !== after.mode) settle(after)
      if (now - published > 80 || before.mode !== after.mode || (before.countdown > 0) !== (after.countdown > 0)) { setView(after); published = now }
      context.setTransform(Math.min(window.devicePixelRatio || 1, 2), 0, 0, Math.min(window.devicePixelRatio || 1, 2), 0, 0)
      draw(now); frame = window.requestAnimationFrame(tick)
    }
    const pause = () => command({ type: "pause" })
    const hidden = () => { if (document.hidden) pause() }
    window.addEventListener("blur", pause)
    document.addEventListener("visibilitychange", hidden)
    motion.addEventListener("change", refreshTheme)
    resize(); frame = window.requestAnimationFrame(tick)
    return () => {
      window.cancelAnimationFrame(frame); observer.disconnect()
      window.removeEventListener("blur", pause); document.removeEventListener("visibilitychange", hidden)
      motion.removeEventListener("change", refreshTheme)
      releaseInputs()
    }
  }, [command, settle])

  const running = view.mode === "running"
  const live = running && view.countdown === 0
  const stage = TREADMILL_STAGES[view.stage]!
  const nextStage = TREADMILL_STAGES[view.stage + 1]
  const warning = treadmillWarning(view)
  const total = treadmillCourseSeconds()
  const elapsed = Math.min(total, Math.floor(treadmillElapsed(view)))
  const focusField = () => canvas.current?.focus({ preventScroll: true })
  const start = () => { setNewBest(false); command({ type: "start" }); focusField() }
  const resume = () => { command({ type: "resume" }); focusField() }
  const energyLow = view.energy < view.jumpCost + 4
  const canJump = live && view.y === 0 && view.energy >= view.jumpCost
  const canDash = live && view.cooldown === 0 && view.energy >= TREADMILL_RULES.dashCost
  const ended = view.mode === "over" || view.mode === "clear"
  const stars = treadmillStars(view)

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

  return <div className="treadmill-game" ref={surface} onKeyDown={handleKey} data-mode={view.mode} data-stage={stage.id}
    onKeyUp={event => { if (event.key === "ArrowRight") { keyboardHeld.current = false; updateHeld() } }}
    onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) command({ type: "pause" }) }}>
    <header className="treadmill-game__header">
      <button type="button" className="treadmill-game__icon" onClick={onBack} aria-label="더보기로 돌아가기"><ArrowLeft size={20} aria-hidden="true" /></button>
      <div className="treadmill-game__title"><span>TRAINORACLE 미니게임</span><h1>멈추면 밀려나는 트랙</h1></div>
      <button type="button" className="treadmill-game__icon" disabled={!running} aria-label="일시정지" title="일시정지 (Esc)"
        onClick={() => command({ type: "pause" })}><Pause size={20} aria-hidden="true" /></button>
    </header>

    <div className="treadmill-game__stage">
      <div className="treadmill-game__hud">
        <div className="treadmill-game__hud-row">
          <ol className="treadmill-game__stages" aria-label={`코스 ${view.stage + 1}/3 · ${stage.name}`}>
            {TREADMILL_STAGES.map((item, index) => {
              const done = index < view.stage || (index === view.stage && view.mode === "clear")
              const fill = done ? 1 : index === view.stage ? view.seconds / TREADMILL_RULES.stageSeconds : 0
              return <li key={item.id} data-state={done ? "done" : index === view.stage ? "current" : "next"} data-stage={item.id}>
                <span>{item.name}</span>
                <i aria-hidden="true"><b style={fillStyle(fill)} /></i>
              </li>
            })}
          </ol>
          <div className="treadmill-game__score" aria-label="점수"><Trophy size={15} aria-hidden="true" />{view.stats.score.toLocaleString("ko-KR")}</div>
        </div>
        <div className="treadmill-game__hud-row">
          <div className={`treadmill-game__energy${energyLow ? " is-low" : ""}`}>
            <Zap size={16} aria-hidden="true" />
            <progress max={TREADMILL_RULES.maxEnergy} value={view.energy} aria-label="게임 에너지 게이지" />
            <output aria-label="게임 에너지" aria-live="off">에너지 {Math.ceil(view.energy)}</output>
          </div>
          <output className="treadmill-game__time" aria-label="경기 진행 시간" aria-live="off">{elapsed} / {total}초</output>
        </div>
        {view.stats.combo > 1 && live && <div className="treadmill-game__combo" aria-label={`연속 ${view.stats.combo}`}>콤보 ×{view.stats.combo}</div>}
      </div>

      <canvas ref={canvas} tabIndex={0} className="treadmill-game__canvas"
        aria-label="게임 조작 영역. 오른쪽 방향키를 누르고 있으면 달리기, 스페이스나 위 방향키는 점프, D는 대시, Esc는 일시정지. 왼쪽 끝 구덩이로 밀리면 추락합니다." />
      <p className="treadmill-game__warning" role="status" data-tone={warning.tone}>{warning.text}</p>

      {view.mode === "paused" && <div className="treadmill-game__overlay">
        <div className="treadmill-game__card treadmill-game__card--small">
          {view.seconds === 0 && view.stage > 0
            ? <><span className="treadmill-game__ribbon" data-stage={stage.id}>{view.stage + 1}구간</span><h2>{stage.name}</h2><p>{stage.hint}</p></>
            : <><span className="treadmill-game__ribbon">일시정지</span><h2>잠깐 쉬는 중</h2><p>바닥과 장애물이 멈춰 있어요.</p></>}
          <div className="treadmill-game__card-actions">
            <button type="button" className="treadmill-game__cta" onClick={resume}><Play size={18} aria-hidden="true" />계속</button>
            <button type="button" className="treadmill-game__ghost" onClick={start}><RotateCcw size={16} aria-hidden="true" />처음부터</button>
          </div>
        </div>
      </div>}

      {view.mode === "ready" && <div className="treadmill-game__overlay">
        <section className="treadmill-game__card" aria-labelledby="treadmill-ready-title">
          <span className="treadmill-game__ribbon">30초 서바이벌</span>
          <h2 id="treadmill-ready-title">30초 동안 바닥 위에서 버티세요</h2>
          <ul className="treadmill-game__rules">
            <li><b><Footprints size={18} aria-hidden="true" /></b><span><strong>꾹 누르면 앞으로</strong>에너지를 써요</span></li>
            <li><b><Pause size={18} aria-hidden="true" /></b><span><strong>손을 떼면 회복</strong>대신 뒤로 밀려요</span></li>
            <li><b><MoveUp size={18} aria-hidden="true" /></b><span><strong>장애물은 점프</strong>구덩이·가시에 닿으면 끝</span></li>
          </ul>
          <button type="button" className="treadmill-game__cta" onClick={start}><Play size={18} aria-hidden="true" />시작</button>
          <p className="treadmill-game__keys">키보드: → 달리기 · Space/↑ 점프 · D 대시 · Esc 정지</p>
        </section>
      </div>}

      {ended && <div className="treadmill-game__overlay">
        <section className="treadmill-game__card treadmill-game__result" aria-labelledby="treadmill-result-title" data-result={view.mode}>
          <span className="treadmill-game__ribbon" data-tone={view.mode === "clear" ? "gold" : "danger"}>{view.mode === "clear" ? "완주" : "실패"}</span>
          <h2 id="treadmill-result-title">{view.mode === "clear" ? "세 구간 완주!" : view.failure === "spike" ? `${stage.name}에서 가시에 닿았어요` : `${stage.name}에서 뒤로 떨어졌어요`}</h2>
          {view.mode === "clear" ? <Stars count={stars} /> : <RunnerPortrait upgrades={view.upgrades} pose="hit" label="넘어진 러너" />}
          <div className="treadmill-game__big-score"><small>점수</small><strong>{view.stats.score.toLocaleString("ko-KR")}</strong>{newBest && <em>이번 접속 최고!</em>}</div>
          <dl className="treadmill-game__stats">
            <div><dt>버틴 시간</dt><dd>{elapsed}<small>/{total}초</small></dd></div>
            <div><dt>넘은 장애물</dt><dd>{view.stats.cleared}</dd></div>
            <div><dt>최고 콤보</dt><dd>{view.stats.bestCombo}</dd></div>
            <div><dt>부딪힘</dt><dd>{view.stats.hits - (view.failure === "spike" ? 1 : 0)}</dd></div>
          </dl>
          <p className="treadmill-game__tip">{treadmillTip(view)}</p>
          {view.upgrades.length > 0 && <p className="treadmill-game__picks">이번 판: {view.upgrades.map(upgradeName).join(" · ")}</p>}
          <p className="treadmill-game__best">이번 접속 최고 {best.score.toLocaleString("ko-KR")}점 · {Math.floor(best.seconds)}초</p>
          <button type="button" className="treadmill-game__cta" onClick={start}><RotateCcw size={18} aria-hidden="true" />다시 시작</button>
          <p className="treadmill-game__keys">다시 시작하면 강화가 초기화돼요.</p>
        </section>
      </div>}
    </div>

    {view.mode !== "upgrade" && <div className="treadmill-game__controls" onContextMenu={event => event.preventDefault()} data-hidden={!running && view.mode !== "paused" ? true : undefined}>
      <button type="button" className="treadmill-game__pad treadmill-game__run" disabled={!running} aria-pressed={view.running}
        onPointerDown={event => { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); heldPointers.current.add(event.pointerId); updateHeld() }}
        onPointerUp={event => { heldPointers.current.delete(event.pointerId); updateHeld() }}
        onPointerCancel={event => { heldPointers.current.delete(event.pointerId); updateHeld() }}
        onLostPointerCapture={event => { heldPointers.current.delete(event.pointerId); updateHeld() }}
        onKeyDown={event => { if (!event.repeat && [" ", "Enter"].includes(event.key)) { event.preventDefault(); event.stopPropagation(); keyboardHeld.current = true; updateHeld() } }}
        onKeyUp={event => { if ([" ", "Enter"].includes(event.key)) { event.preventDefault(); keyboardHeld.current = false; updateHeld() } }}>
        <Footprints size={26} aria-hidden="true" />
        <span>달리기 꾹</span>
        <small>{view.exhausted ? "에너지 0 · 손을 떼세요" : view.running ? "앞으로 · 에너지 소모" : "놓으면 회복 · 뒤로 밀림"}</small>
      </button>
      <button type="button" className="treadmill-game__pad treadmill-game__jump" disabled={!canJump} {...tapAction(() => command({ type: "jump" }))}>
        <MoveUp size={26} aria-hidden="true" /><span>점프</span><small><Zap size={11} aria-hidden="true" />{view.jumpCost}</small>
      </button>
      <button type="button" className="treadmill-game__pad treadmill-game__dash" disabled={!canDash} {...tapAction(() => command({ type: "dash" }))}>
        <ChevronsRight size={26} aria-hidden="true" /><span>대시</span>
        <small>{view.cooldown > 0 ? `${view.cooldown.toFixed(1)}초 뒤` : <><Zap size={11} aria-hidden="true" />{TREADMILL_RULES.dashCost}</>}</small>
        {view.cooldown > 0 && <i aria-hidden="true" style={fillStyle(1 - view.cooldown / view.cooldownSeconds)} />}
      </button>
    </div>}

    {view.mode === "upgrade" && nextStage && <section className="treadmill-game__loadout" aria-labelledby="treadmill-upgrade-title">
      <div className="treadmill-game__loadout-head">
        <RunnerPortrait upgrades={view.upgrades} label={`현재 장비: ${view.upgrades.length ? view.upgrades.map(upgradeName).join(", ") : "기본"}`} />
        <div>
          <span className="treadmill-game__ribbon" data-tone="gold">구간 통과!</span>
          <h2 id="treadmill-upgrade-title">안전 발판 · 강화 하나 선택</h2>
          <p>다음 구간 <strong>{nextStage.name}</strong> · {nextStage.hint}. 고르면 <Zap size={12} aria-hidden="true" />+{TREADMILL_RULES.checkpointRefill}</p>
        </div>
      </div>
      <div className="treadmill-game__gear-stats" aria-label="현재 능력치">
        <span><Zap size={13} aria-hidden="true" />점프 {view.jumpCost}</span>
        <span><Footprints size={13} aria-hidden="true" />소모 ×{view.runDrainFactor.toFixed(2)}</span>
        <span><ChevronsRight size={13} aria-hidden="true" />대시 {view.cooldownSeconds.toFixed(1)}초</span>
      </div>
      <div className="treadmill-game__upgrades">
        {TREADMILL_UPGRADES.map(upgrade => {
          const owned = view.upgrades.filter(id => id === upgrade.id).length
          const Icon = UPGRADE_ICON[upgrade.id]
          return <button type="button" key={upgrade.id} data-upgrade={upgrade.id} onClick={() => command({ type: "upgrade", upgrade: upgrade.id })}>
            <b className="treadmill-game__gear-icon" aria-hidden="true"><Icon size={26} /></b>
            <span className="treadmill-game__gear-text">
              <strong>{upgrade.name}{owned > 0 && <em> Lv.{owned + 1}</em>}{upgrade.fits === nextStage.id && <mark>다음 구간에 맞음</mark>}</strong>
              <span className="treadmill-game__plus">+ {upgrade.benefit}</span>
              <span className="treadmill-game__minus">− {upgrade.cost}</span>
            </span>
          </button>
        })}
      </div>
    </section>}

    <p className="treadmill-game__note">게임 에너지와 점수는 이번 판에만 쓰여요. 실제 훈련 수치·포인트와 연결되지 않고 저장하지 않아요.</p>
  </div>
}
