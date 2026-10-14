import React from "react"
import { useTaskFlowBack } from "../hooks/useTaskFlowBack"
import { tourCity } from "../domain/minigame/tour"
import { useSavedRun } from "./treadmill/useSavedRun"
import { GameLeaveDialog } from "./treadmill/GameLeaveDialog"
import { createGameGestures } from "./treadmill/gestures"

import { RewardActionButton } from "../components/rewards/RewardActionButton"
import { ArrowLeft, ChevronsRight, Footprints, Pause, Play, RotateCcw, MoveUp, Star, Zap, Trophy, Menu, Map as MapIcon, ArrowRight, Sparkles } from "lucide-react"
import {
  advanceTreadmill, newTreadmillRun, treadmillCommand, treadmillCourseSeconds, treadmillElapsed, treadmillStars, treadmillTip, treadmillWarning,
  TREADMILL_RULES, TREADMILL_STAGES, TREADMILL_UPGRADES,
} from "../domain/minigame/treadmill"
import type { TreadmillCommand, TreadmillStage, TreadmillState, TreadmillUpgrade } from "../domain/minigame/treadmill"
import { TOUR_CITIES, tourStages } from "../domain/minigame/tour"
import type { TourCity, TourSeasonId } from "../domain/minigame/tour"
import {
  MINIGAME_CHARACTERS, activeCharacter, characterUnlocked, medalsOf, nextCity, recordCityResult, seasonUnlocked, updateMinigameSettings, withMedals,
} from "../domain/minigame/progress"
import { buyTrail, equipTrail, medalForRun, runMedalsLeftToday, MINIGAME_REWARD_RULES } from "../domain/minigame/rewards"
import type { MinigameProgress } from "../domain/minigame/progress"
import { useMinigameProgress } from "../domain/minigame/progress-store"
import { createTreadmillRenderer, gamePalette } from "./treadmill/draw"
import type { RenderView } from "./treadmill/draw"
import { drawRunner } from "./treadmill/sprites"
import { loadToriArt } from "./treadmill/runner-art"
import { loadSceneArt } from "./treadmill/scene-art"
import type { GamePalette, RunnerCharacter } from "./treadmill/sprites"
import { fxPalette, mountShaderSky } from "./treadmill/shader-sky"
import type { ShaderSky } from "./treadmill/shader-sky"
import type { SkyScene } from "./treadmill/sky-presets"
import { CharacterPortrait, GameMenu, TourMap } from "./treadmill/GamePanels"
import { UpgradeChoice, UPGRADE_STORIES } from "./treadmill/UpgradeChoice"
import { playGameSound } from "./treadmill/sound"
import "../styles/treadmill-game.css"
import "../styles/treadmill-tour.css"
import "./treadmill/game-reward-actions.css"
import "./treadmill/upgrade-choice.css"
import "./treadmill/game-navigation.css"

const fillStyle = (fill: number) => ({ "--fill": Math.max(0, Math.min(1, fill)).toFixed(3) }) as React.CSSProperties
const upgradeName = (id: string) => TREADMILL_UPGRADES.find(upgrade => upgrade.id === id)?.name ?? id


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
    let mounted = true
    const paint = () => {
      if (!mounted) return
      context.setTransform(ratio, 0, 0, ratio, 0, 0)
      context.clearRect(0, 0, size, size)
      context.translate(size / 2, size * 0.86)
      context.scale(size / 94, size / 94)
      drawRunner(context, gamePalette(canvas), { pose, phase: 0, upgrades, character })
    }
    paint()
    if (character === "tori") void loadToriArt().then(paint)
    return () => { mounted = false }
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

export function TreadmillGame({ onBack, backLabel = "더보기로 돌아가기" }: { readonly onBack: () => void; readonly backLabel?: string }) {
  const store = useMinigameProgress()
  const saved = useSavedRun()
  const [leave, setLeave] = React.useState<null | { title: string; detail: string; action: () => void; canSave: boolean; replaceSaved: boolean; returnToRun: boolean }>(null)
  const { progress } = store
  const settings = progress.settings
  const character = activeCharacter(progress)
  React.useEffect(() => {
    if (character === "tori") void loadToriArt()
    void loadSceneArt()
  }, [character])
  const [screen, setScreen] = React.useState<Screen>("map")
  const [course, setCourse] = React.useState<Course>({ kind: "city", city: TOUR_CITIES[0]! })
  const [season, setSeason] = React.useState<TourSeasonId>(() => seasonUnlocked(progress, "world") ? "world" : "korea")
  const [menuOpen, setMenuOpen] = React.useState(false)
  const [pauseReason, setPauseReason] = React.useState("직접 일시정지했어요.")
  const [menuTab, setMenuTab] = React.useState<"settings" | "shop">("settings")
  const [result, setResult] = React.useState<{ best: boolean; unlocks: string[]; bestScore: number; medal: number; medalsLeft: number } | null>(null)
  const [equipped, setEquipped] = React.useState<TreadmillUpgrade | null>(null)
  const state = React.useRef(newTreadmillRun(courseStages(course)))
  const [view, setView] = React.useState<TreadmillState>(state.current)
  const canvas = React.useRef<HTMLCanvasElement>(null)
  const skyCanvas = React.useRef<HTMLCanvasElement>(null)
  const sky = React.useRef<ShaderSky | null>(null)
  const [shaderLive, setShaderLive] = React.useState(false)
  const shaderLiveRef = React.useRef(false)
  const surface = React.useRef<HTMLDivElement>(null)
  const gestures = React.useRef(createGameGestures())
  const keyboardHeld = React.useRef(false)
  const [systemReduced, setSystemReduced] = React.useState(() => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches)
  const reduced = systemReduced || settings.motion === "reduce"
  const city = course.kind === "city" ? course.city : null
  const renderView = React.useRef<RenderView & { reduced: boolean; sound: boolean; vibration: boolean }>({ reduced, sound: settings.sound, vibration: settings.vibration })
  renderView.current = { city: settings.view === "flat" ? null : city, character, effects: settings.effects, jumpGuide: settings.jumpGuide, trail: medalsOf(progress).trail,
    reduced, sound: settings.sound, vibration: settings.vibration }
  const progressRef = React.useRef(progress)
  progressRef.current = progress
  const courseRef = React.useRef(course)
  courseRef.current = course
  const updateRef = React.useRef(store.update)
  updateRef.current = store.update

  const releaseInputs = () => { gestures.current.reset(); keyboardHeld.current = false }
  // Stable on purpose: the game loop depends on it and must not restart on every render.
  const settle = React.useCallback((next: TreadmillState) => {
    if (next.mode !== "over" && next.mode !== "clear") return
    const sound = renderView.current.sound
    playGameSound(next.mode === "clear" ? "win" : "lose", sound)
    const course = courseRef.current
    const before = progressRef.current
    // The medal depends only on time played this run, never on the result (rewards.ts).
    const now = new Date()
    const paid = medalForRun(medalsOf(before), treadmillElapsed(next), now)
    let after = paid.earned > 0 ? withMedals(before, paid.state) : before
    const medalsLeft = runMedalsLeftToday(paid.state, now)
    if (course.kind !== "city") {
      setResult({ best: false, unlocks: [], bestScore: 0, medal: paid.earned, medalsLeft })
    } else {
      const stars = treadmillStars(next)
      const previousBest = before.cities[course.city.id]?.bestScore ?? 0
      after = recordCityResult(after, course.city.id, stars, next.stats.score)
      setResult({ best: stars > 0 && next.stats.score > previousBest, unlocks: unlocksBetween(before, after), bestScore: Math.max(previousBest, stars > 0 ? next.stats.score : 0), medal: paid.earned, medalsLeft })
    }
    if (after !== before) updateRef.current(() => after)
  }, [])
  const command = React.useCallback((input: TreadmillCommand, reason = "직접 일시정지했어요.") => {
    const before = state.current
    if (["start", "resume", "retryStage", "pause"].includes(input.type)) setEquipped(null)
    state.current = treadmillCommand(state.current, input)
    if (before.mode === "running" && state.current.mode === "paused") setPauseReason(reason)
    if (state.current.mode !== "running" || input.type === "start") releaseInputs()
    if (input.type === "jump" && state.current.stats.jumps > before.stats.jumps) playGameSound("jump", renderView.current.sound)
    setView(state.current)
  }, [])
  const updateHeld = () => command({ type: "run", held: keyboardHeld.current || gestures.current.held })

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
    const draw = (now: number) => {
      // Enlarge the whole scene together, keeping runner/hazards on the same geometry.
      const zoom = Math.min(1.5, Math.max(1, width / 430, height / 580))
      const ratio = Math.min(window.devicePixelRatio || 1, 2)
      context.setTransform(ratio * zoom, 0, 0, ratio * zoom, 0, 0)
      render(context, state.current, width / zoom, height / zoom, palette, renderView.current.reduced, now, shaderLiveRef.current, renderView.current)
    }
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
      // Rendering can stall on mobile without leaving the game. The engine caps
      // each step at 100ms; discard excess elapsed time instead of pausing or catching up.
      state.current = advanceTreadmill(state.current, delta)
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
    const pause = () => command({ type: "pause" }, "다른 창으로 이동해 잠시 멈췄어요.")
    const hidden = () => {
      previous = 0
      if (document.hidden) command({ type: "pause" }, "게임 화면을 벗어나 잠시 멈췄어요.")
    }
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
  const inProgress = screen === "play" && ["running", "paused", "upgrade"].includes(view.mode)
  React.useEffect(() => {
    if (!inProgress) return
    const protect = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = "" }
    window.addEventListener("beforeunload", protect)
    return () => window.removeEventListener("beforeunload", protect)
  }, [inProgress])
  const energyLow = view.energy < view.jumpCost + 4
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
  const goMap = () => { command({ type: "pause" }); releaseInputs(); setMenuOpen(false); setScreen("map"); setResult(null) }
  const requestLeave = (action: () => void, title: string, canSave = true) => {
    if (!inProgress) { setMenuOpen(false); action(); return }
    const returnToRun = state.current.mode === "running"
    command({ type: "pause" }); releaseInputs(); setMenuOpen(false); saved.clearError()
    setLeave({ title, action, canSave, replaceSaved: false, returnToRun,
      detail: canSave ? "저장하면 시간·에너지·강화를 그대로 이어가요. 중간 저장은 이 기기에 한 판만 보관해요." : "현재 판의 진행과 강화가 초기화돼요. 완주 기록과 모은 별은 유지돼요." })
  }
  const backToMap = () => requestLeave(goMap, "지도로 나갈까요?")
  const exitGame = () => requestLeave(onBack, "게임에서 나갈까요?")
  const requestRestart = () => requestLeave(start, "새 판을 시작할까요?", false)
  const savedCourse = saved.slot.kind === "saved" ? saved.slot.run.course : null
  const savedTitle = savedCourse === "practice" ? "러닝머신 연습" : tourCity(savedCourse ?? "")?.name ?? "저장한 판"
  const chooseCourse = (next: Course) => {
    if (saved.slot.raw === null) { openCourse(next); return }
    saved.clearError()
    setLeave({ title: "저장한 판 대신 새로 시작할까요?", detail: "새 판을 시작하면 중간 저장한 판은 지워져요. 완주 기록과 모은 별은 유지돼요.",
      action: () => openCourse(next), canSave: false, replaceSaved: true, returnToRun: false })
  }
  const resumeSaved = () => {
    if (saved.slot.kind !== "saved") return
    const run = saved.slot.run
    if (!saved.clear()) return
    const next: Course = run.course === "practice" ? { kind: "practice" } : { kind: "city", city: tourCity(run.course)! }
    setCourse(next); courseRef.current = next; setResult(null); setEquipped(null)
    state.current = run.state; setView(run.state); setPauseReason("중간 저장한 판을 불러왔어요.")
    setScreen("play")
  }
  const saveAndGo = (action: () => void) => {
    command({ type: "pause" }); releaseInputs()
    if (!saved.save(course.kind === "city" ? course.city.id : "practice", state.current)) return
    setLeave(null); action()
  }
  const cancelLeave = () => {
    const continueRun = leave?.returnToRun
    setLeave(null); saved.clearError()
    if (continueRun) resume()
  }
  const discardAndGo = () => {
    if (!leave || (leave.replaceSaved && !saved.clear())) return
    const action = leave.action
    setLeave(null); action()
  }
  const discardSaved = () => {
    saved.clearError()
    setLeave({ title: "중간 저장한 판을 지울까요?", detail: "이 판의 진행만 지워요. 완주 기록과 모은 별은 유지돼요.",
      action: () => {}, canSave: false, replaceSaved: true, returnToRun: false })
  }
  useTaskFlowBack({ enabled: screen === "play" || menuOpen || leave !== null, onBack: () => {
    if (leave) cancelLeave()
    else if (menuOpen) setMenuOpen(false)
    else backToMap()
  } })
  const openMenu = () => { command({ type: "pause" }); setMenuTab("settings"); setMenuOpen(true) }
  const following = city ? nextCity(progress, city.id) : undefined
  const isCity = course.kind === "city"
  // The full rules card is for someone who has never finished a city; afterwards the intro is one line.
  const firstTime = Object.values(progress.cities).every(item => item.clears === 0)
  const cityBest = city ? progress.cities[city.id]?.bestScore ?? 0 : 0
  const canRetryStage = view.mode === "over" && view.stage > 0 && view.checkpoint !== null
  const pickUpgrade = (upgrade: TreadmillUpgrade) => { setEquipped(upgrade); command({ type: "upgrade", upgrade }); playGameSound("tap", settings.sound); focusField() }
  const retryStage = () => { setResult(null); command({ type: "retryStage" }); playGameSound("tap", settings.sound); focusField() }

  const handleKey = (event: React.KeyboardEvent) => {
    if (!running || event.repeat || menuOpen || leave) return
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
    onBlur={event => {
      // Touching non-focusable areas (notably Safari) gives relatedTarget=null.
      // Release keyboard input, but only window blur/visibility loss pauses play.
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
        keyboardHeld.current = false; updateHeld()
      }
    }}>
    <header className="treadmill-game__header">
      {screen === "map"
        ? <button type="button" className="treadmill-game__icon treadmill-game__nav" onClick={onBack} aria-label={backLabel}><ArrowLeft size={18} aria-hidden="true" />{backLabel.startsWith("홈") ? "홈" : "더보기"}</button>
        : <button type="button" className="treadmill-game__icon treadmill-game__nav" onClick={backToMap} aria-label="투어 지도로"><MapIcon size={18} aria-hidden="true" />지도</button>}
      <div className="treadmill-game__title"><span>TRAINORACLE 미니게임</span><h1>{title}</h1></div>
      <div className="treadmill-game__header-actions">
        {screen === "play" && <button type="button" className="treadmill-game__icon" disabled={!running} aria-label="일시정지" title="일시정지 (Esc)"
          onClick={() => command({ type: "pause" })}><Pause size={20} aria-hidden="true" /></button>}
        <button type="button" className="treadmill-game__icon" aria-label="게임 메뉴 (설정·도움말·오픈소스)" aria-haspopup="dialog" onClick={openMenu}><Menu size={20} aria-hidden="true" /></button>
      </div>
    </header>

    {saved.error && !leave && <p className="treadmill-game__save-error" role="alert">{saved.error}</p>}
    {screen === "map" && saved.slot.kind === "saved" && <section className="treadmill-game__resume-card" aria-label="중간 저장한 판">
      <h2>{savedTitle} · 이어서 달릴까요?</h2>
      <p>{saved.slot.run.state.stage + 1}구간 · {Math.floor(treadmillElapsed(saved.slot.run.state))}/{treadmillCourseSeconds(saved.slot.run.state)}초 · 에너지 {Math.ceil(saved.slot.run.state.energy)}</p>
      <p>{saved.slot.run.state.upgrades.length ? `강화: ${saved.slot.run.state.upgrades.map(upgradeName).join(" · ")}` : "강화 선택 전"} · 이 기기에 저장됨</p>
      <button type="button" className="treadmill-game__cta" onClick={resumeSaved}><Play size={18} aria-hidden="true" />저장한 판 이어하기</button>
      <button type="button" className="treadmill-game__text-button" onClick={discardSaved}>저장한 판 지우기</button>
    </section>}
    {screen === "map" && saved.slot.kind === "invalid" && <section className="treadmill-game__resume-card" aria-label="중간 저장 확인">
      <h2>저장한 판을 불러올 수 없어요</h2><p>게임 버전이 달라졌거나 저장 내용이 손상됐어요. 완주 기록은 유지돼요.</p>
      <button type="button" className="treadmill-game__ghost" onClick={discardSaved}>저장한 판 지우기</button>
    </section>}
    {screen === "map" && <TourMap progress={progress} season={season} onSeason={setSeason} status={store.status} onShop={() => { setMenuTab("shop"); setMenuOpen(true) }}
      onPlay={item => chooseCourse({ kind: "city", city: item })} onPractice={() => chooseCourse({ kind: "practice" })} />}

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
        data-running={view.running} data-jumps={view.stats.jumps} data-dashes={view.stats.dashes}
        aria-label="게임 조작 영역. 화면을 꾹 누르면 달리기, 위나 대각선 위로 스와이프하면 점프, 두 번 누르면 대시. 키보드 → 달리기, Space 또는 ↑ 점프, D 대시, Esc 일시정지."
        onContextMenu={event => event.preventDefault()}
        onPointerDown={event => {
          if (event.button !== 0 || state.current.mode !== "running" || menuOpen || leave) return
          event.preventDefault(); event.currentTarget.focus({ preventScroll: true }); event.currentTarget.setPointerCapture(event.pointerId)
          const dash = gestures.current.down(event.pointerId, { x: event.clientX, y: event.clientY, time: event.timeStamp })
          updateHeld(); if (dash) command({ type: "dash" })
        }}
        onPointerMove={event => {
          if (state.current.mode !== "running" || menuOpen || leave) return
          if (gestures.current.move(event.pointerId, { x: event.clientX, y: event.clientY, time: event.timeStamp })) command({ type: "jump" })
        }}
        onPointerUp={event => { gestures.current.up(event.pointerId, { x: event.clientX, y: event.clientY, time: event.timeStamp }); updateHeld() }}
        onPointerCancel={event => { gestures.current.cancel(event.pointerId); updateHeld() }}
        onLostPointerCapture={event => { gestures.current.cancel(event.pointerId); updateHeld() }} />
      <div className="treadmill-game__gesture-hint" aria-label="화면 조작 안내">
        <span>{view.exhausted ? "손을 떼면 회복" : view.running ? "달리는 중 · 떼면 회복" : "화면 꾹 달리기"}</span>
        <span aria-label="점프 에너지">↗ 점프 ⚡{view.jumpCost}</span>
        <span aria-label="대시 충전">두 번 대시 {view.cooldown > 0 ? `${view.cooldown.toFixed(1)}초` : `⚡${TREADMILL_RULES.dashCost}`}</span>
      </div>
      {live && <span className="treadmill-game__wave">웨이브 {Math.min(3, Math.floor(view.seconds / TREADMILL_RULES.waveSeconds) + 1)}/3 · 10초마다 보급</span>}
      {running && view.countdown > 0 && equipped && <div className="treadmill-game__equipped" role="status"><strong>{upgradeName(equipped)} 장착!</strong><span>{UPGRADE_STORIES[equipped].effect}</span></div>}
      <p className="treadmill-game__warning" role="status" data-tone={warning.tone}>{warning.text}</p>

      {view.mode === "paused" && !menuOpen && !leave && <div className="treadmill-game__overlay">
        <div className="treadmill-game__card treadmill-game__card--small">
          <span className="treadmill-game__ribbon">일시정지</span><h2>잠깐 쉬는 중</h2><p>{pauseReason}<br />계속을 누르면 이어서 달려요.</p>
          <button type="button" className="treadmill-game__cta" onClick={resume}><Play size={18} aria-hidden="true" />계속</button>
          <div className="treadmill-game__pause-nav">
            <button type="button" className="treadmill-game__ghost" onClick={() => saveAndGo(goMap)}>저장하고 지도로 나가기</button>
            <div className="treadmill-game__card-actions treadmill-game__card-actions--quiet">
              <button type="button" className="treadmill-game__text-button" onClick={requestRestart}><RotateCcw size={14} aria-hidden="true" />처음부터</button>
              <button type="button" className="treadmill-game__text-button" onClick={exitGame}>게임 나가기</button>
            </div>
          </div>
        </div>
      </div>}

      {view.mode === "ready" && <div className="treadmill-game__overlay">
        <section className="treadmill-game__card" aria-labelledby="treadmill-ready-title" data-first={firstTime || undefined}>
          <span className="treadmill-game__ribbon">{city ? `${city.country} · ${TOUR_CITIES.indexOf(city) + 1}번째 도시` : `연습 · ${total}초`}</span>
          {city
            ? <><h2 id="treadmill-ready-title">{city.name} · {city.tagline}</h2>
              <ol className="treadmill-game__intro-stages">{stages.map((item, index) => <li key={item.id} data-stage={item.surface}><b>{index + 1}</b>{item.name}</li>)}</ol></>
            : <h2 id="treadmill-ready-title">{total}초 러닝 챌린지</h2>}
          {firstTime
            ? <ul className="treadmill-game__rules">
              <li><b><Footprints size={18} aria-hidden="true" /></b><span><strong>화면을 꾹 누르면 달리기</strong>손을 떼면 회복하며 뒤로 밀려요</span></li>
              <li><b><MoveUp size={18} aria-hidden="true" /></b><span><strong>위로 쓸어 올리면 점프</strong>대각선 위로도 가능해요</span></li>
              <li><b><ChevronsRight size={18} aria-hidden="true" /></b><span><strong>두 번 누르면 대시</strong>짧게 빠르게 앞으로</span></li>
            </ul>
            : <p className="treadmill-game__ready-hint">{stages[0]!.hint}{cityBest > 0 && <> · 최고 <strong>{cityBest.toLocaleString("ko-KR")}점</strong></>}</p>}
          <div className="treadmill-game__ready-runner"><CharacterPortrait character={character} size={52} label={`캐릭터 ${MINIGAME_CHARACTERS.find(item => item.id === character)?.name}`} />
            <button type="button" className="treadmill-game__link" onClick={openMenu}>캐릭터·설정 바꾸기</button></div>
          <button type="button" className="treadmill-game__cta" onClick={start}><Play size={18} aria-hidden="true" />시작</button>
          {firstTime && <p className="treadmill-game__keys">키보드: → 달리기 · Space/↑ 점프 · D 대시 · Esc 정지</p>}
        </section>
      </div>}

      {view.mode === "upgrade" && nextStage && <UpgradeChoice state={view} nextStage={nextStage} onPick={pickUpgrade} />}

      {ended && <div className="treadmill-game__overlay">
        <section className="treadmill-game__card treadmill-game__result" aria-labelledby="treadmill-result-title" data-result={view.mode}>
          <span className="treadmill-game__ribbon" data-tone={view.mode === "clear" ? "gold" : "danger"}>{view.mode === "clear" ? "완주" : `${view.stage + 1}구간에서 멈춤`}</span>
          <h2 id="treadmill-result-title">{view.mode === "clear" ? (city ? `${city.name} 완주!` : "세 구간 완주!") : view.failure === "spike" ? `${stage.name}에서 가시에 닿았어요` : `${stage.name}에서 뒤로 떨어졌어요`}</h2>
          {view.mode === "clear" ? <Stars count={stars} /> : <RunnerPortrait upgrades={view.upgrades} pose="hit" label="넘어진 러너" character={character} />}
          <div className="treadmill-game__big-score"><small>점수</small><strong>{view.stats.score.toLocaleString("ko-KR")}</strong>{result?.best && <em>{city?.name} 최고 기록!</em>}</div>
          {result && result.unlocks.length > 0 && <ul className="treadmill-game__unlocks" aria-label="새로 열림">
            {result.unlocks.map(item => <li key={item}><Sparkles size={14} aria-hidden="true" />{item}</li>)}
          </ul>}
          {view.mode === "clear" && view.stats.retries > 0 && <p className="treadmill-game__picks">구간 다시하기를 써서 별은 1개예요. 처음부터 완주하면 별 3개까지 받을 수 있어요.</p>}
          {view.mode === "over" && <p className="treadmill-game__tip">{treadmillTip(view)}</p>}
          {result && <div className="game-reward-result__receipt" role="status" data-earned={result.medal > 0 || undefined}>
            <span className="game-reward-result__medal" aria-hidden="true">🏅</span>
            <div><strong>{result.medal > 0 ? `메달 +${result.medal}` : result.medalsLeft === 0 ? "오늘 받을 메달을 다 받았어요" : "이번 판은 메달이 지급되지 않았어요"}</strong>
              <span>{result.medal > 0 ? `자동 지급 · 오늘 ${result.medalsLeft}회 더 받을 수 있어요` : result.medalsLeft === 0 ? "내일 다시 받을 수 있어요" : `${MINIGAME_REWARD_RULES.minRunSeconds}초 이상 플레이하면 받아요 · 오늘 ${result.medalsLeft}회 남음`}</span>
            </div>
          </div>}
          <div className="treadmill-game__result-actions">
            {view.mode === "clear" && following
              && <RewardActionButton type="button" tone="primary" className="game-reward-result__cta" onClick={() => openCourse({ kind: "city", city: following })}><ArrowRight size={18} aria-hidden="true" />다음 도시 · {following.name}</RewardActionButton>}
            {view.mode === "clear" && !following
              && <RewardActionButton type="button" tone="primary" className="game-reward-result__cta" onClick={backToMap}><MapIcon size={18} aria-hidden="true" />지도에서 보기</RewardActionButton>}
            {canRetryStage
              && <RewardActionButton type="button" tone="primary" className="game-reward-result__cta" onClick={retryStage}><RotateCcw size={18} aria-hidden="true" />{view.stage + 1}구간부터 다시<small>강화 유지 · 별 최대 1개</small></RewardActionButton>}
            {view.mode === "over" && !canRetryStage
              && <RewardActionButton type="button" tone="primary" className="game-reward-result__cta" onClick={start}><RotateCcw size={18} aria-hidden="true" />다시 도전</RewardActionButton>}
            <div className="treadmill-game__card-actions treadmill-game__card-actions--quiet">
              {(view.mode === "clear" || canRetryStage) && <button type="button" className="treadmill-game__text-button" onClick={start}><RotateCcw size={14} aria-hidden="true" />처음부터</button>}
              <button type="button" className="treadmill-game__text-button" onClick={backToMap}><MapIcon size={14} aria-hidden="true" />지도</button>
            </div>
          </div>
          <details className="treadmill-game__more">
            <summary>이번 판 기록</summary>
            <dl className="treadmill-game__stats">
              <div><dt>버틴 시간</dt><dd>{elapsed}<small>/{total}초</small></dd></div>
              <div><dt>넘은 장애물</dt><dd>{view.stats.cleared}</dd></div>
              <div><dt>최고 콤보</dt><dd>{view.stats.bestCombo}</dd></div>
              <div><dt>부딪힘</dt><dd>{view.stats.hits - (view.failure === "spike" ? 1 : 0)}</dd></div>
            </dl>
            {view.upgrades.length > 0 && <p className="treadmill-game__picks">강화: {view.upgrades.map(upgradeName).join(" · ")}</p>}
            {isCity && result && result.bestScore > 0 && <p className="treadmill-game__best">{city?.name} 최고 {result.bestScore.toLocaleString("ko-KR")}점</p>}
          </details>
        </section>
      </div>}
    </div>

    </>}

    {menuOpen && <GameMenu progress={progress} status={store.status} initialTab={menuTab}
      onMap={screen === "play" ? backToMap : undefined} onExit={exitGame}
      onContinue={screen === "play" ? () => { setMenuOpen(false); if (state.current.mode === "paused") resume(); else focusField() } : undefined}
      onBuy={id => { let ok = false; store.update(current => { const bought = buyTrail(medalsOf(current), id); ok = bought.ok; return bought.ok ? withMedals(current, bought.state) : current }); return ok }}
      onEquip={id => store.update(current => withMedals(current, equipTrail(medalsOf(current), id)))}
      onClose={() => { setMenuOpen(false); if (screen === "play") focusField() }}
      onSettings={patch => store.update(current => updateMinigameSettings(current, patch))}
      onCharacter={id => store.update(current => updateMinigameSettings(current, { character: id }))}
      onReset={async () => {
        if (!saved.clear()) return false
        const ok = await store.reset()
        if (ok) {
          releaseInputs(); state.current = newTreadmillRun(courseStages(course)); setView(state.current)
          setResult(null); setEquipped(null); setScreen("map")
        }
        return ok
      }} />}

    {leave && <GameLeaveDialog title={leave.title} onCancel={cancelLeave}>
      <p>{leave.detail}</p>
      {saved.error && <p className="treadmill-game__save-error" role="alert">{saved.error}</p>}
      {leave.canSave && <button type="button" className="treadmill-game__cta" onClick={() => saveAndGo(leave.action)}>저장하고 나가기</button>}
      <button type="button" className="treadmill-game__text-button" onClick={discardAndGo}>{leave.canSave ? "저장 없이 나가기" : leave.replaceSaved ? "지우고 진행하기" : "처음부터 시작하기"}</button>
    </GameLeaveDialog>}
    {screen === "map" && <p className="treadmill-game__note">게임 에너지·점수·별은 게임 안에서만 쓰여요. 실제 훈련 기록이나 포인트(P)와 연결되지 않아요. 투어 기록은 이 기기와, 로그인하면 계정에 저장돼요.</p>}
  </div>
}
