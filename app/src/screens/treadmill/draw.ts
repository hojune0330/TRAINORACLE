import { nearestHazard, treadmillElapsed, upcomingHazards, TREADMILL_HAZARDS, TREADMILL_RULES, TREADMILL_STAGES } from "../../domain/minigame/treadmill"
import type { TreadmillState } from "../../domain/minigame/treadmill"
import { drawHazard, drawRunner, gamePalette, outlinedText, roundRect } from "./sprites"
import type { GamePalette, RunnerPose } from "./sprites"

export { gamePalette }
export type { GamePalette }

/** Shared geometry so the drawing, the hit boxes and the tests talk about the same belt. */
export function treadmillGeometry(width: number, height: number) {
  const left = Math.round(width * 0.1)
  const right = Math.round(width * 0.04)
  const beltWidth = width - left - right
  const floor = height - 74
  return { left, beltWidth, floor, toPx: (x: number) => left + x * beltWidth }
}

type Particle = { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; color: keyof GamePalette; kind: "dot" | "star" | "confetti" | "line" }
type Popup = { x: number; y: number; text: string; life: number; color: keyof GamePalette; size: number }

/**
 * Stateful renderer: the game state stays pure, while short-lived effects (dust, popups,
 * shake, confetti, the fall animation) live here and are derived from state changes.
 */
export function createTreadmillRenderer() {
  let previous: TreadmillState | null = null
  let particles: Particle[] = []
  let popups: Popup[] = []
  let shake = 0
  let phase = 0
  let endedAt = 0
  let clock = 0
  let lastNow = 0
  let dustTimer = 0
  let seed = 1
  const random = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646 }

  function emit(count: number, base: Omit<Particle, "vx" | "vy" | "life" | "max">, spread: { vx: [number, number]; vy: [number, number]; life: [number, number] }) {
    for (let i = 0; i < count; i++) {
      const life = spread.life[0] + random() * (spread.life[1] - spread.life[0])
      particles.push({ ...base, vx: spread.vx[0] + random() * (spread.vx[1] - spread.vx[0]), vy: spread.vy[0] + random() * (spread.vy[1] - spread.vy[0]), life, max: life })
    }
  }

  function react(state: TreadmillState, runnerX: number, footY: number, reduced: boolean) {
    const before = previous
    previous = state
    if (!before) return
    if (state.mode === "running" && before.mode !== "running" && state.countdown > 0 && treadmillElapsed(state) === 0) { particles = []; popups = [] }
    if ((state.mode === "over" || state.mode === "clear") && before.mode !== state.mode) endedAt = clock
    if (state.stats.hits > before.stats.hits) {
      if (!reduced) shake = 0.35
      popups.push({ x: runnerX + 6, y: footY - 76, text: state.failure === "spike" ? "앗!" : "쿵!", life: 0.8, color: "gold", size: 26 })
      if (!reduced) emit(8, { x: runnerX + 10, y: footY - 34, size: 5, color: "gold", kind: "star" }, { vx: [-60, 140], vy: [-200, -40], life: [0.4, 0.8] })
    }
    if (state.stats.score > before.stats.score && state.stats.cleared > before.stats.cleared) {
      const gained = state.stats.score - before.stats.score
      popups.push({ x: runnerX, y: footY - 88, text: state.stats.combo > 1 ? `+${gained} ×${state.stats.combo}` : `+${gained}`, life: 0.9, color: state.stats.combo > 2 ? "gold" : "cloud", size: state.stats.combo > 2 ? 20 : 17 })
    }
    if (state.stats.jumps > before.stats.jumps && !reduced) emit(6, { x: runnerX, y: footY, size: 4, color: "cloud", kind: "dot" }, { vx: [-70, 30], vy: [-50, -5], life: [0.25, 0.45] })
    if (before.y > 0 && state.y === 0 && state.mode === "running" && !reduced) emit(7, { x: runnerX, y: footY, size: 4, color: "cloud", kind: "dot" }, { vx: [-90, 90], vy: [-60, -10], life: [0.25, 0.5] })
    if (state.stats.dashes > before.stats.dashes && !reduced) emit(10, { x: runnerX - 10, y: footY - 30, size: 14, color: "cloud", kind: "line" }, { vx: [-260, -160], vy: [-30, 30], life: [0.2, 0.4] })
    if (state.mode === "clear" && before.mode !== "clear" && !reduced) {
      emit(46, { x: runnerX, y: footY - 90, size: 6, color: "gold", kind: "confetti" }, { vx: [-180, 180], vy: [-320, -120], life: [1.2, 2.2] })
      for (const p of particles.slice(-46)) p.color = (["gold", "danger", "shirt", "shorts", "good"] as const)[Math.floor(random() * 5)]!
    }
    if (state.mode === "upgrade" && before.mode !== "upgrade") popups.push({ x: runnerX, y: footY - 96, text: "구간 통과!", life: 1.2, color: "gold", size: 22 })
  }

  function step(dt: number) {
    shake = Math.max(0, shake - dt)
    for (const p of particles) {
      p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt
      p.vy += (p.kind === "confetti" ? 380 : p.kind === "line" ? 0 : 260) * dt
      if (p.kind === "confetti") p.vx *= 0.985
    }
    particles = particles.filter(p => p.life > 0)
    for (const pop of popups) { pop.life -= dt; pop.y -= 38 * dt }
    popups = popups.filter(pop => pop.life > 0)
  }

  function pose(state: TreadmillState): RunnerPose {
    if (state.mode === "over") return state.failure === "fall" ? "fall" : "hit"
    if (state.mode === "clear") return "cheer"
    if (state.mode !== "running") return "idle"
    if (state.hitFlash < 0.45) return "hit"
    if (state.dashLeft > 0) return "dash"
    if (state.y > 0) return "jump"
    if (state.exhausted) return "tired"
    if (state.running && state.countdown === 0) return "run"
    return "idle"
  }

  return function draw(context: CanvasRenderingContext2D, state: TreadmillState, width: number, height: number,
    palette: GamePalette, reduced: boolean, now: number) {
    const dt = lastNow === 0 ? 0 : Math.min(0.05, Math.max(0, (now - lastNow) / 1000))
    lastNow = now
    clock += dt
    const rules = TREADMILL_RULES
    const stage = TREADMILL_STAGES[state.stage]!
    const { left, beltWidth, floor, toPx } = treadmillGeometry(width, height)
    const font = getComputedStyle(context.canvas).fontFamily
    const runnerX = Math.max(left - 18, toPx(state.x))
    const moving = state.mode === "running" && state.countdown === 0
    if (moving && state.running && !state.exhausted) phase += dt * 15
    react(state, runnerX, floor - state.y, reduced)
    step(dt)

    context.save()
    if (shake > 0) context.translate((random() - 0.5) * 10 * (shake / 0.35), (random() - 0.5) * 8 * (shake / 0.35))
    const travel = reduced ? 0 : treadmillElapsed(state) * 60
    drawWorld(context, palette, stage.id, width, height, floor, travel, clock, reduced)
    drawMachine(context, palette, stage.id, width, height, left, beltWidth, floor, travel * 1.6, state)

    // Jump guide: a gold strip on the belt; it lights up while a jump now would clear.
    const ahead = state.mode === "running" ? nearestHazard(state) : undefined
    if (ahead && ahead.x - state.x < 0.34 && state.y === 0) {
      const [from, to] = rules.jumpWindow
      const gap = ahead.x - state.x
      const inWindow = gap >= from && gap <= to
      context.globalAlpha = inWindow ? 0.9 : 0.35
      roundRect(context, runnerX + from * beltWidth, floor + 2, (to - from) * beltWidth, 4, 2)
      context.fillStyle = palette.gold; context.fill()
      context.globalAlpha = 1
    }

    for (const hazard of state.hazards) {
      const shape = TREADMILL_HAZARDS[hazard.kind]
      const gap = hazard.x - state.x
      const now = hazard === ahead && gap >= rules.jumpWindow[0] && gap <= rules.jumpWindow[1]
      context.save()
      context.translate(toPx(hazard.x), floor)
      if (hazard.hit) { context.globalAlpha = 0.5; context.rotate(hazard.kind === "barrier" ? -0.5 : 0) }
      drawHazard(context, palette, hazard.kind, Math.max(6, shape.halfWidth * beltWidth), shape.height, now)
      context.restore()
    }

    // Telegraph: a bouncing "!" bubble at the front edge before a hazard enters.
    if (state.mode === "running") {
      const item = upcomingHazards(state)[0]
      if (item) {
        const bounce = reduced ? 0 : Math.sin(clock * 10) * 2
        const cx = width - 24, cy = floor - 44 + bounce
        const progress = 1 - Math.max(0, item.inSeconds) / rules.telegraphSeconds
        context.lineWidth = 2.5; context.strokeStyle = palette.outline
        context.beginPath(); context.arc(cx, cy, 14, 0, Math.PI * 2)
        context.fillStyle = item.kind === "spike" ? palette.danger : palette.gold; context.fill(); context.stroke()
        context.strokeStyle = palette.cloud; context.lineWidth = 3
        context.beginPath(); context.arc(cx, cy, 18, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2); context.stroke()
        outlinedText(context, "!", cx, cy + 1, 18, palette.cloud, palette.outline, font)
      }
    }

    // Runner and its shadow. A fall sends the runner tumbling into the pit.
    const sinceEnd = clock - endedAt
    const falling = state.mode === "over" && state.failure === "fall"
    const fallDrop = falling ? (reduced ? 60 : Math.min(140, 40 + sinceEnd * sinceEnd * 600)) : 0
    if (!falling) {
      const lift = Math.min(1, state.y / 110)
      context.globalAlpha = 0.28 - lift * 0.16
      context.fillStyle = palette.outline
      context.beginPath(); context.ellipse(runnerX, floor + 1, 15 - lift * 7, 4, 0, 0, Math.PI * 2); context.fill()
      context.globalAlpha = 1
    }
    if (state.dashLeft > 0 && !reduced) {
      for (const k of [1, 2]) {
        context.save(); context.globalAlpha = 0.22 / k
        context.translate(runnerX - k * 16, floor - state.y)
        drawRunner(context, palette, { pose: "dash", phase, upgrades: state.upgrades })
        context.restore()
      }
    }
    context.save()
    context.translate(runnerX, floor - state.y + fallDrop)
    if (falling && !reduced) context.rotate(-sinceEnd * 6)
    const blink = state.invulnerable > 0 && !reduced && Math.floor(state.invulnerable * 12) % 2 === 0
    if (blink) context.globalAlpha = 0.45
    const squash = !reduced && state.landed < 0.14 ? 1 - state.landed / 0.14 : 0
    drawRunner(context, palette, { pose: pose(state), phase: reduced ? 0 : phase, upgrades: state.upgrades, squash })
    context.restore()
    if (state.invulnerable > 0 && reduced) {
      context.strokeStyle = palette.gold; context.lineWidth = 3
      roundRect(context, runnerX - 18, floor - state.y - 66, 36, 68, 8); context.stroke()
    }

    // Running dust.
    if (moving && state.running && !state.exhausted && state.y === 0 && !reduced) {
      dustTimer -= dt
      if (dustTimer <= 0) {
        dustTimer = 0.09
        emit(1, { x: runnerX - 6, y: floor - 2, size: 3 + random() * 2, color: stage.id === "mud" ? "mudLight" : "cloud", kind: "dot" }, { vx: [-120, -60], vy: [-50, -15], life: [0.3, 0.5] })
      }
    }

    for (const p of particles) {
      const alpha = Math.min(1, p.life / p.max * 1.5)
      context.globalAlpha = alpha
      context.fillStyle = palette[p.color]
      if (p.kind === "dot") { context.beginPath(); context.arc(p.x, p.y, p.size * (0.5 + alpha / 2), 0, Math.PI * 2); context.fill() }
      else if (p.kind === "star") { star(context, p.x, p.y, p.size); context.fill(); context.strokeStyle = palette.outline; context.lineWidth = 1; context.stroke() }
      else if (p.kind === "confetti") { context.save(); context.translate(p.x, p.y); context.rotate(p.life * 9); context.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2); context.restore() }
      else { context.strokeStyle = palette.cloud; context.lineWidth = 2.5; context.beginPath(); context.moveTo(p.x, p.y); context.lineTo(p.x + p.size, p.y); context.stroke() }
    }
    context.globalAlpha = 1
    for (const pop of popups) {
      context.globalAlpha = Math.min(1, pop.life * 2.5)
      outlinedText(context, pop.text, pop.x, pop.y, pop.size, palette[pop.color], palette.outline, font)
    }
    context.globalAlpha = 1

    // Countdown banner.
    if (state.mode === "running" && state.countdown > 0) {
      const n = Math.ceil(state.countdown)
      const t = state.countdown - Math.floor(state.countdown)
      const pulse = reduced ? 1 : 1 + t * 0.35
      const resumeOnly = state.countdown <= rules.countdownResume && treadmillElapsed(state) > 0
      context.fillStyle = palette.outline; context.globalAlpha = 0.18; context.fillRect(0, 0, width, height); context.globalAlpha = 1
      outlinedText(context, `${state.stage + 1}구간 · ${stage.name}`, width / 2, height * 0.26, 20, palette.cloud, palette.outline, font, 800)
      outlinedText(context, resumeOnly ? "준비!" : String(n), width / 2, height * 0.46, 56 * pulse, palette.gold, palette.outline, font)
    }
    context.restore()
  }
}

function star(context: CanvasRenderingContext2D, x: number, y: number, r: number) {
  context.beginPath()
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5
    const rr = i % 2 === 0 ? r : r * 0.45
    context.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr)
  }
  context.closePath()
}

function drawWorld(context: CanvasRenderingContext2D, palette: GamePalette, stageId: string, width: number, height: number,
  floor: number, travel: number, clock: number, reduced: boolean) {
  const theme = stageId === "mud"
    ? { top: palette.mudSkyTop, low: palette.mudSkyLow, far: palette.mudHillFar, near: palette.mudHillNear }
    : stageId === "spikes"
      ? { top: palette.spikeSkyTop, low: palette.spikeSkyLow, far: palette.spikeHillFar, near: palette.spikeHillNear }
      : { top: palette.skyTop, low: palette.skyLow, far: palette.hillFar, near: palette.hillNear }
  const sky = context.createLinearGradient(0, 0, 0, floor)
  sky.addColorStop(0, theme.top); sky.addColorStop(1, theme.low)
  context.fillStyle = sky; context.fillRect(0, 0, width, height)

  // Sun / moon and stars.
  if (stageId === "spikes") {
    context.fillStyle = palette.cloud
    for (let i = 0; i < 18; i++) {
      const sx = (i * 97) % width, sy = (i * 53) % Math.max(1, floor * 0.55)
      context.globalAlpha = reduced ? 0.7 : 0.4 + 0.4 * Math.abs(Math.sin(clock * 1.5 + i)); context.fillRect(sx, sy, 2, 2)
    }
    context.globalAlpha = 1
    context.beginPath(); context.arc(width * 0.78, floor * 0.22, 18, 0, Math.PI * 2); context.fillStyle = palette.skyLow; context.fill()
    context.beginPath(); context.arc(width * 0.78 + 7, floor * 0.22 - 4, 15, 0, Math.PI * 2); context.fillStyle = theme.top; context.fill()
  } else {
    const sunY = stageId === "mud" ? floor * 0.42 : floor * 0.2
    context.beginPath(); context.arc(width * 0.8, sunY, stageId === "mud" ? 26 : 20, 0, Math.PI * 2)
    context.fillStyle = palette.gold; context.globalAlpha = stageId === "mud" ? 0.9 : 1; context.fill(); context.globalAlpha = 1
  }

  // Clouds drift slowly.
  if (stageId !== "spikes") {
    context.fillStyle = palette.cloud; context.globalAlpha = 0.9
    for (let i = 0; i < 4; i++) {
      const span = width + 120
      const cx = ((i * 140 - travel * 0.15 - (reduced ? 0 : clock * 6)) % span + span) % span - 60
      const cy = 24 + (i % 2) * 26
      cloud(context, cx, cy, 1 + (i % 3) * 0.2)
    }
    context.globalAlpha = 1
  }

  hills(context, theme.far, width, floor - 6, 46, 180, travel * 0.25, 0.8)
  hills(context, theme.near, width, floor + 2, 30, 120, travel * 0.5, 1.7)

  // Near decorations that sell each place.
  const span = width + 80
  for (let i = 0; i < 5; i++) {
    const x = ((i * 115 - travel * 0.5) % span + span) % span - 40
    context.save(); context.translate(x, floor - 4)
    if (stageId === "track") flag(context, palette, i)
    else if (stageId === "mud") reed(context, palette)
    else crystal(context, palette, i)
    context.restore()
  }
}

function hills(context: CanvasRenderingContext2D, color: string, width: number, base: number, amp: number, wave: number, offset: number, seed: number) {
  context.fillStyle = color
  context.beginPath(); context.moveTo(0, base + 40)
  for (let x = 0; x <= width + 8; x += 8) {
    const t = (x + offset) / wave
    context.lineTo(x, base - amp * (0.55 + 0.3 * Math.sin(t * Math.PI * 2 + seed) + 0.15 * Math.sin(t * Math.PI * 5 + seed * 3)))
  }
  context.lineTo(width, base + 40); context.closePath(); context.fill()
}

function cloud(context: CanvasRenderingContext2D, x: number, y: number, s: number) {
  context.beginPath()
  context.arc(x, y, 12 * s, 0, Math.PI * 2); context.arc(x + 14 * s, y - 6 * s, 15 * s, 0, Math.PI * 2)
  context.arc(x + 30 * s, y, 11 * s, 0, Math.PI * 2); context.rect(x, y, 30 * s, 10 * s)
  context.fill()
}

function flag(context: CanvasRenderingContext2D, palette: GamePalette, i: number) {
  context.strokeStyle = palette.outline; context.lineWidth = 2
  context.beginPath(); context.moveTo(0, 0); context.lineTo(0, -34); context.stroke()
  context.beginPath(); context.moveTo(0, -34); context.lineTo(16, -29); context.lineTo(0, -24); context.closePath()
  context.fillStyle = i % 2 ? palette.danger : palette.gold; context.fill(); context.stroke()
}

function reed(context: CanvasRenderingContext2D, palette: GamePalette) {
  context.strokeStyle = palette.mud; context.lineWidth = 2.5; context.lineCap = "round"
  for (const [dx, h] of [[-4, 22], [0, 30], [5, 18]] as const) { context.beginPath(); context.moveTo(dx, 0); context.quadraticCurveTo(dx + 3, -h / 2, dx + 1, -h); context.stroke() }
  context.fillStyle = palette.mudHillNear
  roundRect(context, -1, -36, 4, 10, 2); context.fill()
}

function crystal(context: CanvasRenderingContext2D, palette: GamePalette, i: number) {
  context.strokeStyle = palette.outline; context.lineWidth = 2; context.lineJoin = "round"
  const h = 18 + (i % 3) * 8
  context.beginPath(); context.moveTo(-7, 0); context.lineTo(-4, -h); context.lineTo(2, -h - 6); context.lineTo(6, -h + 4); context.lineTo(8, 0); context.closePath()
  context.fillStyle = i % 2 ? palette.spikeSkyLow : palette.spikeHillFar; context.fill(); context.stroke()
}

function drawMachine(context: CanvasRenderingContext2D, palette: GamePalette, stageId: string, width: number, height: number,
  left: number, beltWidth: number, floor: number, travel: number, state: TreadmillState) {
  const rules = TREADMILL_RULES
  const right = left + beltWidth
  // Ground under the machine.
  const ground = stageId === "mud" ? palette.mud : stageId === "spikes" ? palette.spikeHillNear : palette.hillNear
  context.fillStyle = ground; context.fillRect(0, floor + 10, width, height - floor)
  context.fillStyle = palette.outline; context.globalAlpha = 0.15; context.fillRect(0, floor + 10, width, 4); context.globalAlpha = 1

  // The pit behind the rear roller.
  const pit = context.createLinearGradient(0, floor, 0, height)
  pit.addColorStop(0, palette.beltDark); pit.addColorStop(1, palette.outline)
  context.fillStyle = pit
  context.beginPath(); context.moveTo(0, floor + 6); context.lineTo(left - 2, floor + 6); context.lineTo(left - 10, height); context.lineTo(0, height); context.fill()

  // Machine body and legs.
  context.lineWidth = 2.5; context.strokeStyle = palette.outline
  roundRect(context, left - 4, floor + 8, beltWidth + 8, 22, 10); context.fillStyle = palette.belt; context.fill(); context.stroke()
  for (const lx of [left + 22, right - 30]) { roundRect(context, lx, floor + 26, 10, height - floor - 34, 3); context.fillStyle = palette.beltDark; context.fill(); context.stroke() }
  roundRect(context, left + 10, height - 14, beltWidth - 20, 8, 4); context.fillStyle = palette.beltDark; context.fill(); context.stroke()

  // Belt surface with moving slats, tinted by the place.
  context.save()
  roundRect(context, left, floor - 2, beltWidth, 14, 7); context.clip()
  context.fillStyle = palette.beltDark; context.fillRect(left, floor - 2, beltWidth, 14)
  const slat = 18
  for (let x = left - (travel % slat); x < right + slat; x += slat) {
    context.fillStyle = palette.belt; context.fillRect(x, floor - 2, slat - 3, 14)
  }
  if (stageId === "mud") {
    context.fillStyle = palette.mud
    for (let x = left - (travel % 46); x < right + 46; x += 46) { context.beginPath(); context.ellipse(x + 20, floor + 1, 16, 4, 0, 0, Math.PI * 2); context.fill() }
    context.fillStyle = palette.mudLight
    for (let x = left - (travel % 46); x < right + 46; x += 46) { context.beginPath(); context.ellipse(x + 16, floor, 6, 1.5, 0, 0, Math.PI * 2); context.fill() }
  }
  context.fillStyle = palette.lane; context.globalAlpha = 0.85
  for (let x = left - (travel % 36); x < right + 36; x += 36) context.fillRect(x, floor + 4, 14, 2.5)
  context.globalAlpha = 1
  // Rear hazard stripes up to the warning line.
  const warn = left + rules.warnRear * beltWidth
  context.beginPath(); context.rect(left, floor - 2, warn - left, 14); context.clip()
  for (let x = left - 20; x < warn + 20; x += 12) {
    context.fillStyle = palette.danger
    context.beginPath(); context.moveTo(x, floor + 12); context.lineTo(x + 6, floor + 12); context.lineTo(x + 14, floor - 2); context.lineTo(x + 8, floor - 2); context.fill()
  }
  context.restore()
  roundRect(context, left, floor - 2, beltWidth, 14, 7); context.strokeStyle = palette.outline; context.lineWidth = 2.5; context.stroke()

  // Rollers.
  for (const cx of [left + 6, right - 6]) {
    context.beginPath(); context.arc(cx, floor + 5, 9, 0, Math.PI * 2); context.fillStyle = palette.rail; context.fill(); context.stroke()
    const a = -travel / 9
    context.strokeStyle = palette.beltDark; context.lineWidth = 2
    context.beginPath(); context.moveTo(cx + Math.cos(a) * 6, floor + 5 + Math.sin(a) * 6); context.lineTo(cx - Math.cos(a) * 6, floor + 5 - Math.sin(a) * 6); context.stroke()
    context.strokeStyle = palette.outline; context.lineWidth = 2.5
  }

  // Rear danger glow grows as the runner approaches.
  const near = state.mode === "running" ? Math.max(0, Math.min(1, (rules.warnRear + 0.14 - state.x) / 0.14)) : 0
  if (near > 0) {
    context.fillStyle = palette.danger
    const strips = 8
    for (let i = 0; i < strips; i++) {
      context.globalAlpha = near * 0.42 * (1 - i / strips)
      context.fillRect((warn * i) / strips, 0, warn / strips + 1, floor + 8)
    }
    context.globalAlpha = 1
  }
}
