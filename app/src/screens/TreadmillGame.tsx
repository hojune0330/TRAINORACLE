import React from "react"
import { ArrowLeft, ChevronsRight, Footprints, Pause, Play, RotateCcw, MoveUp, Star, Zap, Flame, Trophy, Menu, Map as MapIcon, ArrowRight, Sparkles } from "lucide-react"
import {
  advanceTreadmill, newTreadmillRun, treadmillCommand, treadmillCourseSeconds, treadmillElapsed, treadmillStars, treadmillTip, treadmillWarning,
  TREADMILL_RULES, TREADMILL_STAGES, TREADMILL_UPGRADES,
} from "../domain/minigame/treadmill"
import type { TreadmillCommand, TreadmillStage, TreadmillState, TreadmillUpgrade } from "../domain/minigame/treadmill"
import { TOUR_CITIES, tourStages } from "../domain/minigame/tour"
import type { TourCity, TourSeasonId } from "../domain/minigame/tour"
import {
  MINIGAME_CHARACTERS, activeCharacter, characterUnlocked, nextCity, recordCityResult, seasonUnlocked, updateMinigameSettings,
} from "../domain/minigame/progress"
import type { MinigameProgress } from "../domain/minigame/progress"
import { useMinigameProgress } from "../domain/minigame/progress-store"
import { createTreadmillRenderer, gamePalette } from "./treadmill/draw"
import type { RenderView } from "./treadmill/draw"
import { drawRunner } from "./treadmill/sprites"
import type { GamePalette, RunnerCharacter } from "./treadmill/sprites"
import { fxPalette, mountShaderSky } from "./treadmill/shader-sky"
import type { ShaderSky } from "./treadmill/shader-sky"
import type { SkyScene } from "./treadmill/sky-presets"
import { CharacterPortrait, GameMenu, TourMap } from "./treadmill/GamePanels"
import { playGameSound } from "./treadmill/sound"
import "../styles/treadmill-game.css"
import "../styles/treadmill-tour.css"

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
function RunnerPortrait({ upgrades, pose = "idle", label, character }: { readonly upgrades: readonly TreadmillUpgrade[]; readonly pose?: "idle" | "cheer" | "hit"; readonly label: string; readonly character: RunnerCharacter }) {
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
    context.translate(size / 2, size * 0.86)
    context.scale(size / 82, size / 82)
    drawRunner(context, gamePalette(canvas), { pose, phase: 0, upgrades, character })
  }, [upgrades, pose, character])
  return <canvas ref={ref} className="treadmill-game__portrait" role="img" aria-label={label} />
}

function Stars({ count }: { readonly count: number }) {
  return <div className="treadmill-game__stars" role="img" aria-label={`별 ${count}개 / 3개`}>
    {[0, 1, 2].map(index => <Star key={index} size={34} aria-hidden="true" data-on={index < count || undefined} />)}
  </div>
}

type Course = { readonly kind: "practice" } | { readonly kind: "city"; readonly city: TourCity }
const courseStages = (course: Course): readonly TreadmillStage[] => course.kind === "city" ? tourStages(course.city) : TREADMILL_STAGES
type Screen = "map" | "play"

/** Unlocks gained between two progress snapshots, for the result card. */
function unlocksBetween(before: MinigameProgress, after: MinigameProgress): string[] {
  const out: string[] = []
  for (const city of TOUR_CITIES) {
    const was = before.cities[city.id]?.stars ?? 0, now = after.cities[city.id]?.stars ?? 0
    if (was === 0 && now > 0) {
      const next = nextCity(after, city.id)
      if (next) out.push(next.season !== city.season ? `시즌 2 월드 투어 · ${next.name} 열림` : `${next.name} 열림`)
    }
  }
  for (const character of MINIGAME_CHARACTERS) {
    if (!characterUnlocked(before, character.id) && characterUnlocked(after, character.id)) out.push(`새 캐릭터 ${character.name}`)
  }
  return out
}

export function TreadmillGame({ onBack }: { readonly onBack: () => void }) {
  const store = useMinigameProgress()
  const { progress } = store
  const settings = progress.settings
  const character = activeCharacter(progress)
  const [screen, setScreen] = React.useState<Screen>("map")
  const [course, setCourse] = React.useState<Course>({ kind: "city", city: TOUR_CITIES[0]! })
  const [season, setSeason] = React.useState<TourSeasonId>(() => seasonUnlocked(progress, "world") ? "world" : "korea")
  const [menuOpen, setMenuOpen] = React.useState(false)
  const [result, setResult] = React.useState<{ best: boolean; unlocks: string[]; bestScore: number } | null>(null)
  const state = React.useRef(newTreadmillRun(courseStages(course)))
  const [view, setView] = React.useState<TreadmillState>(state.current)
  const canvas = React.useRef<HTMLCanvasElement>(null)
  const skyCanvas = React.useRef<HTMLCanvasElement>(null)
  const sky = React.useRef<ShaderSky | null>(null)
  const [shaderLive, setShaderLive] = React.useState(false)
  const shaderLiveRef = React.useRef(false)
  const surface = React.useRef<HTMLDivElement>(null)
  const heldPointers = React.useRef(new Set<number>())
  const keyboardHeld = React.useRef(false)
  const [systemReduced, setSystemReduced] = React.useState(() => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches)
  const reduced = systemReduced || settings.motion === "reduce"
  const city = course.kind === "city" ? course.city : null
  const renderView = React.useRef<RenderView & { reduced: boolean; sound: boolean; vibration: boolean }>({ reduced, sound: settings.sound, vibration: settings.vibration })
  renderView.current = { city: settings.view === "flat" ? null : city, character, effects: settings.effects, jumpGuide: settings.jumpGuide,
    reduced, sound: settings.sound, vibration: settings.vibration }
  const progressRef = React.useRef(progress)
  progressRef.current = progress
  const courseRef = React.useRef(course)
  courseRef.current = course
  const updateRef = React.useRef(store.update)
  updateRef.current = store.update

  const releaseInputs = () => { heldPointers.current.clear(); keyboardHeld.current = false }
  // Stable on purpose: the game loop depends on it and must not restart on every render.
  const settle = React.useCallback((next: TreadmillState) => {
    if (next.mode !== "over" && next.mode !== "clear") return
    const sound = renderView.current.sound
    playGameSound(next.mode === "clear" ? "win" : "lose", sound)
    const course = courseRef.current
    if (course.kind !== "city") { setResult({ best: false, unlocks: [], bestScore: 0 }); return }
    const before = progressRef.current
    const stars = treadmillStars(next)
    const previousBest = before.cities[course.city.id]?.bestScore ?? 0
    const after = recordCityResult(before, course.city.id, stars, next.stats.score)
    setResult({ best: stars > 0 && next.stats.score > previousBest, unlocks: unlocksBetween(before, after), bestScore: Math.max(previousBest, stars > 0 ? next.stats.score : 0) })
    if (after !== before) updateRef.current(() => after)
  }, [])
  const command = React.useCallback((input: TreadmillCommand) => {
    const before = state.current
    state.current = treadmillCommand(state.current, input)
    if (state.current.mode !== "running" || input.type === "start") releaseInputs()
    if (input.type === "jump" && state.current.stats.jumps > before.stats.jumps) playGameSound("jump", renderView.current.sound)
    setView(state.current)
  }, [])
  const updateHeld = () => command({ type: "run", held: keyboardHeld.current || heldPointers.current.size > 0 })

  React.useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)")
    const changed = () => setSystemReduced(motion.matches)
    motion.addEventListener("change", changed)
    return () => motion.removeEventListener("change", changed)
  }, [])

  // Game loop: runs only on the play screen.
  React.useEffect(() => {
    if (screen !== "play") return
    const element = canvas.current, container = surface.current
    if (!element || !container) return
    const context = element.getContext("2d")
    if (!context) return
    const render = createTreadmillRenderer()
    let width = 320, height = 300, previous = 0, published = 0, frame = 0
    let palette: GamePalette = gamePalette(container)
    const draw = (now: number) => render(context, state.current, width, height, palette, renderView.current.reduced, now, shaderLiveRef.current, renderView.current)
    const resize = () => {
      width = element.clientWidth; height = element.clientHeight
      const ratio = Math.min(window.devicePixelRatio || 1, 2)
      element.width = Math.round(width * ratio); element.height = Math.round(height * ratio)
      context.setTransform(ratio, 0, 0, ratio, 0, 0); palette = gamePalette(container); draw(performance.now())
    }
    const observer = new ResizeObserver(resize)
    observer.observe(element)
    const tick = (now: number) => {
      const delta = previous === 0 ? 0 : (now - previous) / 1000
      previous = now
      const before = state.current
      if (delta > 0.25) command({ type: "pause" })
      else state.current = advanceTreadmill(state.current, delta)
      const after = state.current
      const sound = renderView.current.sound
      if (after.mode !== "running") releaseInputs()
      if (after.stats.hits > before.stats.hits) {
        if (renderView.current.vibration) navigator.vibrate?.(after.mode === "over" ? [60, 40, 90] : 40)
        playGameSound("hit", sound)
      }
      if (after.stats.cleared > before.stats.cleared) playGameSound("clearHazard", sound)
      if (before.y > 0 && after.y === 0 && after.mode === "running") playGameSound("land", sound)
      if (after.countdown > 0 && Math.ceil(after.countdown) !== Math.ceil(before.countdown)) playGameSound("tick", sound)
      if (before.countdown > 0 && after.countdown === 0 && after.mode === "running") playGameSound("go", sound)
      if (after.mode === "upgrade" && before.mode !== "upgrade") playGameSound("stage", sound)
      if (before.mode !== after.mode) settle(after)
      if (now - published > 80 || before.mode !== after.mode || (before.countdown > 0) !== (after.countdown > 0)) { setView(after); published = now }
      context.setTransform(Math.min(window.devicePixelRatio || 1, 2), 0, 0, Math.min(window.devicePixelRatio || 1, 2), 0, 0)
      draw(now); frame = window.requestAnimationFrame(tick)
    }
    const pause = () => command({ type: "pause" })
    const hidden = () => { if (document.hidden) pause() }
    window.addEventListener("blur", pause)
    document.addEventListener("visibilitychange", hidden)
    resize(); frame = window.requestAnimationFrame(tick)
    return () => {
      window.cancelAnimationFrame(frame); observer.disconnect()
      window.removeEventListener("blur", pause); document.removeEventListener("visibilitychange", hidden)
      releaseInputs()
    }
  }, [command, settle, screen])

  // Optional WebGPU sky, only with high effects. Absent or failed => the 2D canvas paints its own sky.
  const wantShader = screen === "play" && settings.effects === "high"
  React.useEffect(() => {
    const skyElement = skyCanvas.current, container = surface.current
    if (!wantShader || !skyElement || !container) return
    let cancelled = false
    const lose = () => { shaderLiveRef.current = false; setShaderLive(false); sky.current?.destroy(); sky.current = null }
    void mountShaderSky(skyElement, fxPalette(container), renderView.current.reduced, lose).then(instance => {
      if (cancelled) { instance?.destroy(); return }
      if (!instance) return
      sky.current = instance; shaderLiveRef.current = true; setShaderLive(true)
    })
    return () => { cancelled = true; sky.current?.destroy(); sky.current = null; shaderLiveRef.current = false; setShaderLive(false) }
  }, [wantShader])
  React.useEffect(() => { sky.current?.setMotion(reduced) }, [reduced, shaderLive])

  const running = view.mode === "running"
  const live = running && view.countdown === 0
  const stages = view.stages
  const stage = stages[view.stage]!
  const nextStage = stages[view.stage + 1]
  const warning = treadmillWarning(view)
  const total = treadmillCourseSeconds(view)
  const elapsed = Math.min(total, Math.floor(treadmillElapsed(view)))
  const focusField = () => canvas.current?.focus({ preventScroll: true })
  const start = () => { setResult(null); command({ type: "start", stages: courseStages(course) }); playGameSound("tap", settings.sound); focusField() }
  const resume = () => { command({ type: "resume" }); focusField() }
  const energyLow = view.energy < view.jumpCost + 4
  const canJump = live && view.y === 0 && view.energy >= view.jumpCost
  const canDash = live && view.cooldown === 0 && view.energy >= TREADMILL_RULES.dashCost
  const ended = view.mode === "over" || view.mode === "clear"
  const stars = treadmillStars(view)
  const scene: SkyScene = view.mode === "clear" ? "clear" : view.mode === "over" ? "over" : stage.surface
  React.useEffect(() => { sky.current?.show(scene) }, [scene, shaderLive])
  React.useEffect(() => {
    if (!sky.current) return
    if (!menuOpen && (view.mode === "running" || view.mode === "clear" || view.mode === "over" || view.mode === "ready")) sky.current.resume()
    else sky.current.pause()
  }, [view.mode, shaderLive, menuOpen])

  const openCourse = (next: Course) => {
    setCourse(next); setResult(null)
    state.current = newTreadmillRun(courseStages(next)); setView(state.current)
    setScreen("play"); playGameSound("tap", settings.sound)
  }
  const backToMap = () => { command({ type: "pause" }); releaseInputs(); setScreen("map"); setResult(null) }
  const openMenu = () => { command({ type: "pause" }); setMenuOpen(true) }
  const following = city ? nextCity(progress, city.id) : undefined
  const isCity = course.kind === "city"

  const handleKey = (event: React.KeyboardEvent) => {
    if (!running || event.repeat || menuOpen) return
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

  const title = screen === "map" ? "러닝 투어" : city ? `${city.name} 투어` : "러닝머신 연습"
  return <div className="treadmill-game" ref={surface} onKeyDown={handleKey} data-screen={screen} data-mode={view.mode} data-stage={stage.surface}
    data-sky={shaderLive ? "shader" : "canvas"} data-view={renderView.current.city ? "city" : "flat"} data-controls={settings.controls} data-run-side={settings.runSide}
    data-reduced={reduced || undefined}
    onKeyUp={event => { if (event.key === "ArrowRight") { keyboardHeld.current = false; updateHeld() } }}
    onBlur={event => { if (screen === "play" && !menuOpen && !event.currentTarget.contains(event.relatedTarget as Node | null)) command({ type: "pause" }) }}>
    <header className="treadmill-game__header">
      {screen === "map"
        ? <button type="button" className="treadmill-game__icon" onClick={onBack} aria-label="더보기로 돌아가기"><ArrowLeft size={20} aria-hidden="true" /></button>
        : <button type="button" className="treadmill-game__icon" onClick={backToMap} aria-label="투어 지도로"><MapIcon size={20} aria-hidden="true" /></button>}
      <div className="treadmill-game__title"><span>TRAINORACLE 미니게임</span><h1>{title}</h1></div>
      <div className="treadmill-game__header-actions">
        {screen === "play" && <button type="button" className="treadmill-game__icon" disabled={!running} aria-label="일시정지" title="일시정지 (Esc)"
          onClick={() => command({ type: "pause" })}><Pause size={20} aria-hidden="true" /></button>}
        <button type="button" className="treadmill-game__icon" aria-label="게임 메뉴 (설정·도움말·오픈소스)" aria-haspopup="dialog" onClick={openMenu}><Menu size={20} aria-hidden="true" /></button>
      </div>
    </header>

    {screen === "map" && <TourMap progress={progress} season={season} onSeason={setSeason} status={store.status}
      onPlay={item => openCourse({ kind: "city", city: item })} onPractice={() => openCourse({ kind: "practice" })} />}

    {screen === "play" && <>
    <div className="treadmill-game__stage">
      <div className="treadmill-game__hud">
        <div className="treadmill-game__hud-row">
          <ol className="treadmill-game__stages" aria-label={`코스 ${view.stage + 1}/${stages.length} · ${stage.name}`}>
            {stages.map((item, index) => {
              const done = index < view.stage || (index === view.stage && view.mode === "clear")
              const fill = done ? 1 : index === view.stage ? view.seconds / TREADMILL_RULES.stageSeconds : 0
              return <li key={item.id} data-state={done ? "done" : index === view.stage ? "current" : "next"} data-stage={item.surface}>
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

      <canvas ref={skyCanvas} className="treadmill-game__sky" aria-hidden="true" data-live={shaderLive || undefined} />
      <canvas ref={canvas} tabIndex={0} className="treadmill-game__canvas"
        aria-label="게임 조작 영역. 오른쪽 방향키를 누르고 있으면 달리기, 스페이스나 위 방향키는 점프, D는 대시, Esc는 일시정지. 왼쪽 끝으로 밀리면 떨어집니다." />
      <p className="treadmill-game__warning" role="status" data-tone={warning.tone}>{warning.text}</p>

      {view.mode === "paused" && !menuOpen && <div className="treadmill-game__overlay">
        <div className="treadmill-game__card treadmill-game__card--small">
          {view.seconds === 0 && view.stage > 0
            ? <><span className="treadmill-game__ribbon" data-stage={stage.surface}>{view.stage + 1}구간</span><h2>{stage.name}</h2><p>{stage.hint}</p></>
            : <><span className="treadmill-game__ribbon">일시정지</span><h2>잠깐 쉬는 중</h2><p>바닥과 장애물이 멈춰 있어요.</p></>}
          <div className="treadmill-game__card-actions">
            <button type="button" className="treadmill-game__cta" onClick={resume}><Play size={18} aria-hidden="true" />계속</button>
            <button type="button" className="treadmill-game__ghost" onClick={start}><RotateCcw size={16} aria-hidden="true" />처음부터</button>
          </div>
        </div>
      </div>}

      {view.mode === "ready" && <div className="treadmill-game__overlay">
        <section className="treadmill-game__card" aria-labelledby="treadmill-ready-title">
          <span className="treadmill-game__ribbon">{city ? `${city.country} · 30초 서바이벌` : "30초 서바이벌"}</span>
          {city
            ? <><h2 id="treadmill-ready-title">{city.name} · {city.tagline}</h2>
              <ol className="treadmill-game__intro-stages">{stages.map((item, index) => <li key={item.id} data-stage={item.surface}><b>{index + 1}</b>{item.name}</li>)}</ol></>
            : <h2 id="treadmill-ready-title">30초 동안 바닥 위에서 버티세요</h2>}
          <ul className="treadmill-game__rules">
            <li><b><Footprints size={18} aria-hidden="true" /></b><span><strong>꾹 누르면 앞으로</strong>에너지를 써요</span></li>
            <li><b><Pause size={18} aria-hidden="true" /></b><span><strong>손을 떼면 회복</strong>대신 뒤로 밀려요</span></li>
            <li><b><MoveUp size={18} aria-hidden="true" /></b><span><strong>장애물은 점프</strong>{city ? "허들·못판" : "구덩이·가시"}에 닿으면 끝</span></li>
          </ul>
          <div className="treadmill-game__ready-runner"><CharacterPortrait character={character} size={52} label={`캐릭터 ${MINIGAME_CHARACTERS.find(item => item.id === character)?.name}`} />
            <button type="button" className="treadmill-game__link" onClick={openMenu}>캐릭터·설정 바꾸기</button></div>
          <button type="button" className="treadmill-game__cta" onClick={start}><Play size={18} aria-hidden="true" />시작</button>
          <p className="treadmill-game__keys">키보드: → 달리기 · Space/↑ 점프 · D 대시 · Esc 정지</p>
        </section>
      </div>}

      {ended && <div className="treadmill-game__overlay">
        <section className="treadmill-game__card treadmill-game__result" aria-labelledby="treadmill-result-title" data-result={view.mode}>
          <span className="treadmill-game__ribbon" data-tone={view.mode === "clear" ? "gold" : "danger"}>{view.mode === "clear" ? "완주" : "실패"}</span>
          <h2 id="treadmill-result-title">{view.mode === "clear" ? (city ? `${city.name} 완주!` : "세 구간 완주!") : view.failure === "spike" ? `${stage.name}에서 가시에 닿았어요` : `${stage.name}에서 뒤로 떨어졌어요`}</h2>
          {view.mode === "clear" ? <Stars count={stars} /> : <RunnerPortrait upgrades={view.upgrades} pose="hit" label="넘어진 러너" character={character} />}
          <div className="treadmill-game__big-score"><small>점수</small><strong>{view.stats.score.toLocaleString("ko-KR")}</strong>{result?.best && <em>{city?.name} 최고 기록!</em>}</div>
          {result && result.unlocks.length > 0 && <ul className="treadmill-game__unlocks" aria-label="새로 열림">
            {result.unlocks.map(item => <li key={item}><Sparkles size={14} aria-hidden="true" />{item}</li>)}
          </ul>}
          <dl className="treadmill-game__stats">
            <div><dt>버틴 시간</dt><dd>{elapsed}<small>/{total}초</small></dd></div>
            <div><dt>넘은 장애물</dt><dd>{view.stats.cleared}</dd></div>
            <div><dt>최고 콤보</dt><dd>{view.stats.bestCombo}</dd></div>
            <div><dt>부딪힘</dt><dd>{view.stats.hits - (view.failure === "spike" ? 1 : 0)}</dd></div>
          </dl>
          <p className="treadmill-game__tip">{treadmillTip(view)}</p>
          {view.upgrades.length > 0 && <p className="treadmill-game__picks">이번 판: {view.upgrades.map(upgradeName).join(" · ")}</p>}
          {isCity && result && result.bestScore > 0 && <p className="treadmill-game__best">{city?.name} 최고 {result.bestScore.toLocaleString("ko-KR")}점</p>}
          <div className="treadmill-game__card-actions">
            {view.mode === "clear" && following
              ? <button type="button" className="treadmill-game__cta" onClick={() => openCourse({ kind: "city", city: following })}><ArrowRight size={18} aria-hidden="true" />다음 도시 {following.name}</button>
              : <button type="button" className="treadmill-game__cta" onClick={start}><RotateCcw size={18} aria-hidden="true" />다시 시작</button>}
            {view.mode === "clear" && following && <button type="button" className="treadmill-game__ghost" onClick={start}><RotateCcw size={16} aria-hidden="true" />다시</button>}
            <button type="button" className="treadmill-game__ghost" onClick={backToMap}><MapIcon size={16} aria-hidden="true" />지도</button>
          </div>
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
        <RunnerPortrait upgrades={view.upgrades} character={character} label={`현재 장비: ${view.upgrades.length ? view.upgrades.map(upgradeName).join(", ") : "기본"}`} />
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
              <strong>{upgrade.name}{owned > 0 && <em> Lv.{owned + 1}</em>}{upgrade.fits === nextStage.surface && <mark>다음 구간에 맞음</mark>}</strong>
              <span className="treadmill-game__plus">+ {upgrade.benefit}</span>
              <span className="treadmill-game__minus">− {upgrade.cost}</span>
            </span>
          </button>
        })}
      </div>
    </section>}
    </>}

    {menuOpen && <GameMenu progress={progress} status={store.status} onClose={() => { setMenuOpen(false); if (screen === "play") focusField() }}
      onSettings={patch => store.update(current => updateMinigameSettings(current, patch))}
      onCharacter={id => store.update(current => updateMinigameSettings(current, { character: id }))}
      onReset={store.reset} />}

    <p className="treadmill-game__note">게임 에너지·점수·별은 게임 안에서만 쓰여요. 실제 훈련 기록이나 포인트(P)와 연결되지 않아요. 투어 기록은 이 기기와, 로그인하면 계정에 저장돼요.</p>
  </div>
}
