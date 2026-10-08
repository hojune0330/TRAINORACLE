/**
 * Original cartoon sprites for the treadmill minigame, drawn with canvas paths.
 * Colours come only from the --game-* tokens (see colors_and_type.css).
 * Coordinates: origin at the runner's feet / hazard base, negative y is up.
 */
import type { TreadmillHazardKind, TreadmillUpgrade } from "../../domain/minigame/treadmill"

export const GAME_TOKENS = {
  skyTop: "--game-sky-top", skyLow: "--game-sky-low", hillFar: "--game-hill-far", hillNear: "--game-hill-near",
  mudSkyTop: "--game-mud-sky-top", mudSkyLow: "--game-mud-sky-low", mudHillFar: "--game-mud-hill-far", mudHillNear: "--game-mud-hill-near",
  mud: "--game-mud", mudLight: "--game-mud-light",
  spikeSkyTop: "--game-spike-sky-top", spikeSkyLow: "--game-spike-sky-low", spikeHillFar: "--game-spike-hill-far", spikeHillNear: "--game-spike-hill-near",
  belt: "--game-belt", beltDark: "--game-belt-dark", lane: "--game-belt-lane", rail: "--game-rail",
  outline: "--game-outline", skin: "--game-skin", shirt: "--game-shirt", shirtDark: "--game-shirt-dark", shorts: "--game-shorts",
  shoe: "--game-shoe", cloud: "--game-cloud", danger: "--game-danger", dangerDark: "--game-danger-dark",
  gold: "--game-gold", goldDark: "--game-gold-dark", good: "--game-good", panel: "--game-panel", ink: "--game-ink", inkSoft: "--game-ink-soft",
} as const

export type GamePalette = Record<keyof typeof GAME_TOKENS, string>

export function gamePalette(element: HTMLElement): GamePalette {
  const css = getComputedStyle(element)
  return Object.fromEntries(Object.entries(GAME_TOKENS).map(([key, name]) => [key, css.getPropertyValue(name).trim()])) as GamePalette
}

export function roundRect(context: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2))
  context.beginPath()
  context.moveTo(x + radius, y)
  context.arcTo(x + w, y, x + w, y + h, radius)
  context.arcTo(x + w, y + h, x, y + h, radius)
  context.arcTo(x, y + h, x, y, radius)
  context.arcTo(x, y, x + w, y, radius)
  context.closePath()
}

/** Toon-shaded rounded part: base fill, a lit top band, a shadow bottom band, then the outline. */
function part(context: CanvasRenderingContext2D, palette: GamePalette, fill: string, x: number, y: number, w: number, h: number, r: number) {
  roundRect(context, x, y, w, h, r)
  context.fillStyle = fill; context.fill()
  context.save()
  context.clip()
  context.globalAlpha = 0.32; context.fillStyle = palette.cloud
  roundRect(context, x + w * 0.12, y + h * 0.1, w * 0.5, Math.max(1.2, h * 0.22), Math.min(r, 2)); context.fill()
  context.globalAlpha = 0.18; context.fillStyle = palette.outline
  context.fillRect(x, y + h * 0.72, w, h * 0.28)
  context.restore()
  roundRect(context, x, y, w, h, r)
  context.strokeStyle = palette.outline; context.stroke()
}

/** Big chunky title text with a thick outline, the way mobile games label waves. */
export function outlinedText(context: CanvasRenderingContext2D, text: string, x: number, y: number, size: number,
  fill: string, stroke: string, font: string, weight = 900) {
  context.save()
  context.font = `${weight} ${size}px ${font}`
  context.textAlign = "center"; context.textBaseline = "middle"
  context.lineJoin = "round"; context.lineWidth = Math.max(3, size / 5)
  context.strokeStyle = stroke; context.strokeText(text, x, y)
  context.fillStyle = fill; context.fillText(text, x, y)
  context.restore()
}

export type RunnerPose = "idle" | "run" | "jump" | "fall" | "hit" | "tired" | "cheer" | "dash"

export type RunnerLook = {
  pose: RunnerPose
  /** Running cycle phase in radians. */
  phase: number
  upgrades: readonly TreadmillUpgrade[]
  /** 0..1, flattens the body for one beat after landing. */
  squash?: number
}

/** A blocky, chibi runner in a sporty cap. About 64 logical px tall. */
export function drawRunner(context: CanvasRenderingContext2D, palette: GamePalette, look: RunnerLook) {
  const { pose, phase, upgrades } = look
  const springs = upgrades.includes("spring")
  const grip = upgrades.includes("grip")
  const band = upgrades.includes("economy")
  context.save()
  context.lineWidth = 2.2; context.lineJoin = "round"; context.lineCap = "round"
  const squash = look.squash ?? 0
  context.scale(1 + squash * 0.18, 1 - squash * 0.2)
  if (springs) context.translate(0, -5)

  const swing = pose === "run" || pose === "dash" ? Math.sin(phase) : 0
  const legAngle = pose === "jump" ? 0.5 : pose === "fall" ? -0.6 : pose === "dash" ? swing * 0.9 : swing * 0.7
  const armAngle = pose === "cheer" ? 2.6 : pose === "jump" ? -2.3 : pose === "fall" ? 2.8 : pose === "hit" ? -1.2 : pose === "tired" ? 0.15 : -swing * 0.9
  const lean = pose === "run" ? 0.12 : pose === "dash" ? 0.28 : pose === "tired" ? 0.22 : pose === "hit" ? -0.25 : 0
  const bob = pose === "run" ? Math.abs(Math.cos(phase)) * -2 : pose === "cheer" ? -2 : 0
  context.translate(0, bob)
  context.rotate(lean)

  // Legs (back leg first), shoes, optional springs.
  const leg = (angle: number, back: boolean) => {
    context.save()
    context.translate(back ? -4 : 4, -16)
    context.rotate(angle)
    part(context, palette, back ? palette.shirtDark : palette.shorts, -3.5, 0, 7, 13, 2)
    if (springs) {
      context.strokeStyle = palette.goldDark; context.lineWidth = 2
      context.beginPath(); context.moveTo(-3, 16)
      for (let i = 0; i < 4; i++) context.lineTo(i % 2 ? -3 : 3, 17 + i * 1.6)
      context.stroke(); context.lineWidth = 2.2
    }
    part(context, palette, grip ? palette.lane : palette.shoe, -4, 11, 10, 5, 2)
    if (grip) { context.fillStyle = palette.outline; for (const dx of [-2, 1.5, 5]) context.fillRect(dx - 0.8, 15.5, 1.6, 1.6) }
    context.restore()
  }
  leg(-legAngle, true)

  // Back arm.
  const arm = (angle: number, back: boolean) => {
    context.save()
    context.translate(back ? -9 : 9, -31)
    context.rotate(angle)
    part(context, palette, back ? palette.shirtDark : palette.shirt, -3, -1, 6, 8, 2)
    part(context, palette, palette.skin, -2.6, 6, 5.2, 7, 2)
    if (band) part(context, palette, palette.gold, -3, 5, 6, 2.6, 1)
    context.restore()
  }
  arm(-armAngle * (pose === "cheer" ? -1 : 1), true)

  // Torso with a chest stripe.
  part(context, palette, palette.shirt, -10, -33, 20, 18, 4)
  context.fillStyle = palette.cloud; context.globalAlpha = 0.9
  context.fillRect(-10 + 1.2, -26, 17.6, 3)
  context.globalAlpha = 1
  part(context, palette, palette.shorts, -9.5, -19, 19, 5, 2)

  leg(legAngle, false)
  arm(armAngle, false)

  // Head with cap.
  part(context, palette, palette.skin, -11, -55, 22, 21, 6)
  context.save()
  roundRect(context, -11.5, -58, 23, 9, 5); context.fillStyle = palette.shirtDark; context.fill(); context.stroke()
  roundRect(context, 6, -52, 10, 4, 2); context.fillStyle = palette.shirtDark; context.fill(); context.stroke()
  context.restore()
  if (band) { part(context, palette, palette.gold, -11.5, -50, 23, 3.5, 1.5) }
  drawFace(context, palette, pose)
  context.restore()
}

function drawFace(context: CanvasRenderingContext2D, palette: GamePalette, pose: RunnerPose) {
  const ink = palette.outline
  context.save()
  context.translate(2, -42)
  context.fillStyle = ink; context.strokeStyle = ink; context.lineWidth = 1.8
  const eyes = (draw: (x: number) => void) => { draw(-4.5); draw(4.5) }
  if (pose === "hit") {
    eyes(x => { context.beginPath(); context.moveTo(x - 2, -2.5); context.lineTo(x + 2, 0); context.lineTo(x - 2, 2.5); context.stroke() })
    context.beginPath(); context.moveTo(-3, 6); context.lineTo(-1, 5); context.lineTo(1, 6); context.lineTo(3, 5); context.stroke()
  } else if (pose === "fall") {
    eyes(x => { context.fillStyle = palette.cloud; context.beginPath(); context.arc(x, 0, 3.2, 0, Math.PI * 2); context.fill(); context.stroke(); context.fillStyle = ink; context.beginPath(); context.arc(x, 0, 1.2, 0, Math.PI * 2); context.fill() })
    context.beginPath(); context.ellipse(0, 6.5, 2.2, 2.6, 0, 0, Math.PI * 2); context.fill()
  } else if (pose === "cheer") {
    eyes(x => { context.beginPath(); context.arc(x, 1, 2.6, Math.PI * 1.1, Math.PI * 1.9); context.stroke() })
    context.beginPath(); context.arc(0, 4, 3.6, 0, Math.PI); context.fill()
  } else if (pose === "tired") {
    eyes(x => { context.beginPath(); context.moveTo(x - 2.4, 0.5); context.lineTo(x + 2.4, 0.5); context.stroke() })
    context.beginPath(); context.ellipse(0, 6, 1.6, 1.9, 0, 0, Math.PI * 2); context.fill()
    context.fillStyle = palette.skyTop; context.strokeStyle = palette.outline; context.lineWidth = 1.2
    context.beginPath(); context.moveTo(11, -9); context.quadraticCurveTo(14, -4, 11.5, -2.5); context.quadraticCurveTo(8.5, -4, 11, -9); context.fill(); context.stroke()
  } else {
    eyes(x => {
      context.beginPath(); context.ellipse(x, 0, 1.9, 2.7, 0, 0, Math.PI * 2); context.fill()
      context.fillStyle = palette.cloud; context.beginPath(); context.arc(x + 0.6, -1, 0.7, 0, Math.PI * 2); context.fill(); context.fillStyle = ink
    })
    if (pose === "run" || pose === "dash") {
      context.beginPath(); context.moveTo(-6.5, -4.5); context.lineTo(-2.5, -3.5); context.moveTo(6.5, -4.5); context.lineTo(2.5, -3.5); context.stroke()
      context.beginPath(); context.moveTo(-2, 5.5); context.lineTo(2.5, 5.5); context.stroke()
    } else {
      context.beginPath(); context.arc(0, 4, 2.6, 0.15 * Math.PI, 0.85 * Math.PI); context.stroke()
    }
  }
  // Cheeks.
  context.fillStyle = palette.danger; context.globalAlpha = 0.25
  context.beginPath(); context.ellipse(-7.5, 3.5, 2, 1.2, 0, 0, Math.PI * 2); context.ellipse(7.5, 3.5, 2, 1.2, 0, 0, Math.PI * 2); context.fill()
  context.restore()
}

/** Hurdle or spike row. `halfWidth` and `height` are the hit box in px, so the art never lies about collisions. */
export function drawHazard(context: CanvasRenderingContext2D, palette: GamePalette, kind: TreadmillHazardKind,
  halfWidth: number, height: number, highlight: boolean) {
  context.save()
  context.lineWidth = 2; context.lineJoin = "round"; context.strokeStyle = palette.outline
  if (kind === "barrier") {
    const postW = 3.5
    for (const x of [-halfWidth, halfWidth - postW]) part(context, palette, palette.rail, x, -height + 4, postW, height - 4, 1)
    part(context, palette, palette.rail, -halfWidth - 3, -3, halfWidth * 2 + 6, 3, 1)
    context.save()
    roundRect(context, -halfWidth - 3, -height, halfWidth * 2 + 6, 9, 3)
    context.fillStyle = palette.danger; context.fill()
    context.clip()
    context.fillStyle = palette.cloud
    for (let x = -halfWidth - 8; x < halfWidth + 8; x += 8) { context.beginPath(); context.moveTo(x, -height + 9); context.lineTo(x + 4, -height + 9); context.lineTo(x + 8, -height); context.lineTo(x + 4, -height); context.fill() }
    context.restore()
    roundRect(context, -halfWidth - 3, -height, halfWidth * 2 + 6, 9, 3); context.stroke()
  } else {
    part(context, palette, palette.dangerDark, -halfWidth - 1, -4, halfWidth * 2 + 2, 4, 1)
    const teeth = Math.max(2, Math.round(halfWidth / 5))
    const tooth = (halfWidth * 2) / teeth
    for (let i = 0; i < teeth; i++) {
      const base = -halfWidth + i * tooth
      context.beginPath(); context.moveTo(base, -3); context.lineTo(base + tooth / 2, -height); context.lineTo(base + tooth, -3); context.closePath()
      context.fillStyle = palette.rail; context.fill(); context.stroke()
      context.fillStyle = palette.cloud
      context.beginPath(); context.moveTo(base + tooth / 2, -height + 1.5); context.lineTo(base + tooth / 2 - 1.6, -height + 7); context.lineTo(base + tooth / 2, -height + 6); context.fill()
    }
  }
  if (highlight) {
    context.strokeStyle = palette.gold; context.lineWidth = 3
    roundRect(context, -halfWidth - 8, -height - 8, halfWidth * 2 + 16, height + 10, 6); context.stroke()
  }
  context.restore()
}
