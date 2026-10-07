import { nearestHazard, upcomingHazards, TREADMILL_HAZARDS, TREADMILL_RULES, TREADMILL_STAGES } from "../../domain/minigame/treadmill"
import type { TreadmillState } from "../../domain/minigame/treadmill"

const TOKENS = {
  background: "--bg", surface: "--surface", surface2: "--surface-2", ink: "--ink", ink2: "--ink-2", ink3: "--ink-3",
  ink4: "--ink-4", line: "--line", line2: "--line-2", brand: "--brand", danger: "--err", caution: "--warn",
  track: "--tape", mud: "--paper-edge", pencil: "--pencil", spikes: "--paper-2",
} as const

export type TreadmillPalette = Record<keyof typeof TOKENS, string>

export function treadmillPalette(element: HTMLElement): TreadmillPalette {
  const css = getComputedStyle(element)
  return Object.fromEntries(Object.entries(TOKENS).map(([key, name]) => [key, css.getPropertyValue(name).trim()])) as TreadmillPalette
}

/** Shared geometry so the drawing, the hit boxes and the tests talk about the same belt. */
export function treadmillGeometry(width: number, height: number) {
  const left = Math.round(width * 0.05)
  const beltWidth = width - left * 2
  return { left, beltWidth, floor: height - 46, toPx: (x: number) => left + x * beltWidth }
}

export function drawTreadmill(context: CanvasRenderingContext2D, state: TreadmillState, width: number, height: number,
  palette: TreadmillPalette, reducedMotion: boolean): void {
  const rules = TREADMILL_RULES
  const stage = TREADMILL_STAGES[state.stage]!
  const { left, beltWidth, floor, toPx } = treadmillGeometry(width, height)
  const font = getComputedStyle(context.canvas).fontFamily
  context.clearRect(0, 0, width, height)
  context.fillStyle = palette.background
  context.fillRect(0, 0, width, height)

  // Rear danger: the fall edge is solid, the approach is a lighter band that grows stronger nearby.
  const fallPx = toPx(rules.fallEdge), warnPx = toPx(rules.warnRear)
  const near = state.mode === "running" ? Math.max(0, Math.min(1, (rules.warnRear + 0.12 - state.x) / 0.12)) : 0
  context.fillStyle = palette.danger
  context.globalAlpha = 0.07 + near * 0.12
  context.fillRect(fallPx, 0, warnPx - fallPx, floor)
  context.globalAlpha = 0.22
  context.fillRect(0, 0, fallPx, floor + 14)
  context.globalAlpha = 1
  context.strokeStyle = palette.danger; context.lineWidth = 1; context.setLineDash([4, 4])
  context.beginPath(); context.moveTo(warnPx + 0.5, 8); context.lineTo(warnPx + 0.5, floor); context.stroke(); context.setLineDash([])

  // Belt body, rollers and the stage surface.
  context.fillStyle = palette.ink2
  context.fillRect(left, floor + 14, beltWidth, 8)
  const surface = stage.id === "mud" ? palette.mud : stage.id === "spikes" ? palette.spikes : palette.track
  context.fillStyle = surface
  context.fillRect(left, floor, beltWidth, 14)
  context.save()
  context.beginPath(); context.rect(left, floor, beltWidth, 14); context.clip()
  const travel = reducedMotion ? 0 : (state.stage * 10 + state.seconds) * stage.belt * beltWidth
  context.fillStyle = stage.id === "mud" ? palette.pencil : palette.ink
  context.globalAlpha = stage.id === "mud" ? 0.28 : 0.2
  for (let x = left - (travel % 36); x < left + beltWidth + 36; x += 36) {
    if (stage.id === "mud") { context.beginPath(); context.ellipse(x, floor + 7, 9, 3, 0, 0, Math.PI * 2); context.fill() }
    else context.fillRect(x, floor + 6, 16, 2)
  }
  context.restore()
  context.globalAlpha = 1
  for (const cx of [left, left + beltWidth]) {
    context.fillStyle = palette.ink2; context.beginPath(); context.arc(cx, floor + 11, 10, 0, Math.PI * 2); context.fill()
    const angle = reducedMotion ? 0 : -travel / 10
    context.strokeStyle = palette.surface; context.lineWidth = 2
    context.beginPath(); context.moveTo(cx + Math.cos(angle) * 6, floor + 11 + Math.sin(angle) * 6)
    context.lineTo(cx - Math.cos(angle) * 6, floor + 11 - Math.sin(angle) * 6); context.stroke()
  }

  context.font = `600 12px ${font}`
  context.textBaseline = "alphabetic"
  context.fillStyle = palette.danger; context.textAlign = "left"; context.fillText("추락", 6, floor + 40)
  context.fillStyle = palette.ink3; context.textAlign = "right"; context.fillText("← 바닥이 흘러요", width - 6, floor + 40)
  context.textAlign = "left"

  // Jump guide: when the next hazard's centre is inside this band, a jump clears it.
  const ahead = state.mode === "running" ? nearestHazard(state) : undefined
  const runnerPx = toPx(state.x)
  if (ahead && ahead.x - state.x < 0.32 && state.y === 0) {
    const [from, to] = rules.jumpWindow
    const inWindow = ahead.x - state.x >= from && ahead.x - state.x <= to
    context.fillStyle = palette.brand
    context.globalAlpha = inWindow ? 0.32 : 0.12
    context.fillRect(runnerPx + from * beltWidth, floor - 3, (to - from) * beltWidth, 3)
    context.globalAlpha = 1
  }

  for (const hazard of state.hazards) {
    const shape = TREADMILL_HAZARDS[hazard.kind]
    const x = toPx(hazard.x)
    const half = Math.max(7, shape.halfWidth * beltWidth)
    const gap = hazard.x - state.x
    const now = hazard === ahead && gap >= rules.jumpWindow[0] && gap <= rules.jumpWindow[1]
    context.globalAlpha = hazard.hit ? 0.35 : hazard.passed ? 0.6 : 1
    if (hazard.kind === "spike") {
      const teeth = Math.max(2, Math.round(half / 6))
      const tooth = (half * 2) / teeth
      context.fillStyle = palette.danger
      for (let i = 0; i < teeth; i++) {
        const base = x - half + i * tooth
        context.beginPath(); context.moveTo(base, floor); context.lineTo(base + tooth / 2, floor - shape.height); context.lineTo(base + tooth, floor); context.fill()
      }
      context.fillStyle = palette.ink; context.fillRect(x - half, floor - 2, half * 2, 2)
    } else {
      context.fillStyle = palette.ink
      context.fillRect(x - half + 1, floor - shape.height + 6, 3, shape.height - 6)
      context.fillRect(x + half - 4, floor - shape.height + 6, 3, shape.height - 6)
      context.fillStyle = palette.danger
      context.fillRect(x - half - 2, floor - shape.height, half * 2 + 4, 7)
    }
    if (now) {
      context.strokeStyle = palette.brand; context.lineWidth = 2
      context.strokeRect(x - half - 5, floor - shape.height - 5, half * 2 + 10, shape.height + 5)
    }
    context.globalAlpha = 1
  }

  // Telegraph hazards that are about to enter from the front edge.
  if (state.mode === "running") {
    for (const item of upcomingHazards(state)) {
      const progress = 1 - Math.max(0, item.inSeconds) / rules.telegraphSeconds
      const cx = width - 18, cy = floor - 40
      context.strokeStyle = palette.line2; context.lineWidth = 3
      context.beginPath(); context.arc(cx, cy, 11, 0, Math.PI * 2); context.stroke()
      context.strokeStyle = item.kind === "spike" ? palette.danger : palette.ink
      context.beginPath(); context.arc(cx, cy, 11, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2); context.stroke()
      context.fillStyle = item.kind === "spike" ? palette.danger : palette.ink
      context.font = `700 13px ${font}`; context.textAlign = "center"; context.textBaseline = "middle"
      context.fillText("!", cx, cy + 1)
      context.textAlign = "left"; context.textBaseline = "alphabetic"
      break
    }
  }

  drawRunner(context, state, runnerPx, floor, palette, reducedMotion)
}

function drawRunner(context: CanvasRenderingContext2D, state: TreadmillState, px: number, floor: number,
  palette: TreadmillPalette, reducedMotion: boolean) {
  const fell = state.mode === "over" && state.failure === "fall"
  const caught = state.mode === "over" && state.failure === "spike"
  const x = Math.max(12, px)
  // Ground shadow shows where the runner will land.
  if (!fell) {
    const lift = Math.min(1, state.y / 100)
    context.fillStyle = palette.ink; context.globalAlpha = 0.18 - lift * 0.1
    context.beginPath(); context.ellipse(x, floor - 1, 12 - lift * 5, 3, 0, 0, Math.PI * 2); context.fill()
    context.globalAlpha = 1
  }
  const blink = state.invulnerable > 0 && !reducedMotion && Math.floor(state.invulnerable * 10) % 2 === 0
  context.save()
  context.translate(x, fell ? floor + 30 : floor - state.y)
  const moving = state.mode === "running" && state.running && !state.exhausted
  const dashing = state.dashLeft > 0
  const lean = caught ? -0.2 : dashing ? 0.32 : moving ? 0.14 : state.exhausted ? 0.3 : 0
  const squash = state.landed < 0.12 && !reducedMotion ? 0.86 : 1
  context.scale(1 / Math.sqrt(squash), squash)
  context.rotate(fell ? -0.9 : lean)
  if (blink) context.globalAlpha = 0.35
  const stride = !reducedMotion && moving && state.y === 0 ? Math.sin(state.seconds * 16) * 6 : state.y > 0 ? 5 : 0
  const body = caught ? palette.danger : state.exhausted ? palette.ink3 : palette.brand
  context.strokeStyle = palette.ink; context.lineCap = "round"
  context.lineWidth = 5
  context.beginPath(); context.moveTo(-4, -16); context.lineTo(-6 - stride, -2); context.moveTo(4, -16); context.lineTo(6 + stride, -2); context.stroke()
  context.fillStyle = body; context.fillRect(-9, -34, 18, 19)
  context.lineWidth = 4
  context.beginPath(); context.moveTo(-8, -30); context.lineTo(-15 + stride, -21); context.moveTo(8, -30); context.lineTo(14 - stride, -22); context.stroke()
  context.fillStyle = palette.ink; context.fillRect(-7, -50, 15, 15)
  context.fillStyle = palette.background
  if (caught || fell) { context.fillRect(2, -45, 4, 1.5); context.fillRect(3.25, -46.25, 1.5, 4) }
  else context.fillRect(3, -46, 3, 3)
  if (state.exhausted) {
    context.fillStyle = palette.ink3
    for (const [dx, dy] of [[12, -52], [16, -44]] as const) { context.beginPath(); context.arc(dx, dy, 2, 0, Math.PI * 2); context.fill() }
  }
  context.globalAlpha = 1
  if (state.invulnerable > 0 && reducedMotion) {
    context.strokeStyle = palette.caution; context.lineWidth = 2; context.strokeRect(-12, -54, 26, 54)
  }
  context.restore()
  if (dashing && !reducedMotion) {
    context.strokeStyle = palette.brand; context.lineWidth = 3; context.lineCap = "round"
    const top = floor - state.y
    context.beginPath(); context.moveTo(x - 16, top - 28); context.lineTo(x - 38, top - 28); context.moveTo(x - 18, top - 16); context.lineTo(x - 32, top - 16); context.stroke()
  }
  if (state.hitFlash < 0.35) {
    context.fillStyle = palette.caution; context.font = `700 13px ${getComputedStyle(context.canvas).fontFamily}`
    context.textAlign = "center"; context.fillText("쿵!", x + 4, floor - state.y - 60); context.textAlign = "left"
  }
}
