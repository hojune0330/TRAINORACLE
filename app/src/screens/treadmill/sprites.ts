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
  gold: "--game-gold", goldDark: "--game-gold-dark", good: "--game-good", panel: "--game-panel", panelEdge: "--game-panel-edge", ink: "--game-ink", inkSoft: "--game-ink-soft",
  hair: "--game-hair", hanaShirt: "--game-hana-shirt", hanaShirtDark: "--game-hana-shirt-dark", bear: "--game-bear", bearLight: "--game-bear-light",
  cat: "--game-cat", catLight: "--game-cat-light", robot: "--game-robot", robotLight: "--game-robot-light", robotEye: "--game-robot-eye",
  penguin: "--game-penguin", penguinBelly: "--game-penguin-belly", beak: "--game-beak",
  cityFar: "--game-city-far", cityNear: "--game-city-near", cityNight: "--game-city-night", window: "--game-window",
  neonPink: "--game-neon-pink", neonBlue: "--game-neon-blue", sea: "--game-sea", seaLight: "--game-sea-light", sand: "--game-sand",
  petal: "--game-petal", rain: "--game-rain", snow: "--game-snow", heat: "--game-heat",
  laneRed: "--game-lane-red", laneRedDark: "--game-lane-red-dark", grassStripe: "--game-grass-stripe",
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
export function part(context: CanvasRenderingContext2D, palette: GamePalette, fill: string, x: number, y: number, w: number, h: number, r: number) {
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

export type RunnerCharacter = "tori" | "hana" | "dandan" | "nabi" | "r01" | "pengu"

export type RunnerLook = {
  pose: RunnerPose
  /** Cosmetic only: every character shares the same hit box and physics. */
  character?: RunnerCharacter
  /** Running cycle phase in radians. */
  phase: number
  upgrades: readonly TreadmillUpgrade[]
  /** 0..1, flattens the body for one beat after landing. */
  squash?: number
}

type Skin = { shirt: string; shirtDark: string; shorts: string; skin: string; limb: string; shoe: string }

function skinFor(palette: GamePalette, character: RunnerCharacter): Skin {
  switch (character) {
    case "hana": return { shirt: palette.hanaShirt, shirtDark: palette.hanaShirtDark, shorts: palette.outline, skin: palette.skin, limb: palette.skin, shoe: palette.shoe }
    case "dandan": return { shirt: palette.gold, shirtDark: palette.goldDark, shorts: palette.shorts, skin: palette.bear, limb: palette.bear, shoe: palette.shoe }
    case "nabi": return { shirt: palette.shorts, shirtDark: palette.outline, shorts: palette.outline, skin: palette.cat, limb: palette.cat, shoe: palette.danger }
    case "r01": return { shirt: palette.robot, shirtDark: palette.belt, shorts: palette.belt, skin: palette.robotLight, limb: palette.robot, shoe: palette.robotEye }
    case "pengu": return { shirt: palette.penguin, shirtDark: palette.outline, shorts: palette.penguin, skin: palette.penguin, limb: palette.penguin, shoe: palette.beak }
    default: return { shirt: palette.shirt, shirtDark: palette.shirtDark, shorts: palette.shorts, skin: palette.skin, limb: palette.skin, shoe: palette.shoe }
  }
}

/** A chunky chibi runner. About 64 logical px tall; six cosmetic characters share one rig. */
export function drawRunner(context: CanvasRenderingContext2D, palette: GamePalette, look: RunnerLook) {
  const { pose, phase, upgrades } = look
  const character = look.character ?? "tori"
  const k = skinFor(palette, character)
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
    part(context, palette, back ? k.shirtDark : k.shorts, -3.5, 0, 7, 13, 2)
    if (springs) {
      context.strokeStyle = palette.goldDark; context.lineWidth = 2
      context.beginPath(); context.moveTo(-3, 16)
      for (let i = 0; i < 4; i++) context.lineTo(i % 2 ? -3 : 3, 17 + i * 1.6)
      context.stroke(); context.lineWidth = 2.2
    }
    part(context, palette, grip ? palette.lane : k.shoe, -4, 11, 10, 5, 2)
    if (grip) { context.fillStyle = palette.outline; for (const dx of [-2, 1.5, 5]) context.fillRect(dx - 0.8, 15.5, 1.6, 1.6) }
    context.restore()
  }
  leg(-legAngle, true)

  // Back arm.
  const arm = (angle: number, back: boolean) => {
    context.save()
    context.translate(back ? -9 : 9, -31)
    context.rotate(angle)
    part(context, palette, back ? k.shirtDark : k.shirt, -3, -1, 6, 8, 2)
    part(context, palette, k.limb, -2.6, 6, 5.2, 7, 2)
    if (band) part(context, palette, palette.gold, -3, 5, 6, 2.6, 1)
    context.restore()
  }
  arm(-armAngle * (pose === "cheer" ? -1 : 1), true)

  // Tails sit behind the body.
  if (character === "nabi") {
    context.save(); context.strokeStyle = palette.outline; context.lineWidth = 6
    const wag = Math.sin(phase * 0.5) * 4
    context.beginPath(); context.moveTo(-9, -20); context.quadraticCurveTo(-22, -24 + wag, -19, -38 + wag); context.stroke()
    context.strokeStyle = k.skin; context.lineWidth = 3.4; context.stroke(); context.restore()
  }
  if (character === "dandan") { context.beginPath(); context.arc(-10, -20, 3.5, 0, Math.PI * 2); context.fillStyle = k.skin; context.fill(); context.stroke() }

  // Torso with a chest mark.
  part(context, palette, k.shirt, -10, -33, 20, 18, 4)
  if (character === "pengu") {
    context.beginPath(); context.ellipse(1, -24, 6.5, 8, 0, 0, Math.PI * 2); context.fillStyle = palette.penguinBelly; context.fill()
  } else if (character === "r01") {
    roundRect(context, -5, -29, 10, 7, 2); context.fillStyle = palette.belt; context.fill(); context.stroke()
    context.fillStyle = palette.robotEye; context.fillRect(-3, -27, 2, 3); context.fillRect(1, -27, 2, 3)
  } else {
    context.fillStyle = palette.cloud; context.globalAlpha = 0.9
    context.fillRect(-10 + 1.2, -26, 17.6, 3)
    context.globalAlpha = 1
  }
  if (character !== "pengu") part(context, palette, k.shorts, -9.5, -19, 19, 5, 2)

  leg(legAngle, false)
  arm(armAngle, false)

  drawHead(context, palette, character, k, phase, pose)
  if (band) { part(context, palette, palette.gold, -11.5, -50, 23, 3.5, 1.5) }
  drawFace(context, palette, pose, character)
  context.restore()
}

function drawHead(context: CanvasRenderingContext2D, palette: GamePalette, character: RunnerCharacter, k: Skin, phase: number, pose: RunnerPose) {
  const ear = (x: number, y: number, r: number, inner: string) => {
    context.beginPath(); context.arc(x, y, r, 0, Math.PI * 2); context.fillStyle = k.skin; context.fill(); context.stroke()
    context.beginPath(); context.arc(x, y, r * 0.5, 0, Math.PI * 2); context.fillStyle = inner; context.fill()
  }
  if (character === "dandan") { ear(-9, -55, 5, palette.bearLight); ear(9, -55, 5, palette.bearLight) }
  if (character === "nabi") {
    for (const side of [-1, 1]) {
      context.beginPath(); context.moveTo(side * 11, -50); context.lineTo(side * 9, -62); context.lineTo(side * 2, -54); context.closePath()
      context.fillStyle = k.skin; context.fill(); context.stroke()
      context.beginPath(); context.moveTo(side * 9, -52); context.lineTo(side * 8.3, -58.5); context.lineTo(side * 4.5, -54); context.closePath()
      context.fillStyle = palette.catLight; context.fill()
    }
  }
  if (character === "hana") {
    // Ponytail swings against the stride.
    const swing = pose === "run" || pose === "dash" ? Math.sin(phase + 1) * 4 : 0
    context.beginPath(); context.ellipse(-14, -46 + swing * 0.3, 5, 9, 0.5 + swing * 0.06, 0, Math.PI * 2)
    context.fillStyle = palette.hair; context.fill(); context.stroke()
  }
  if (character === "r01") {
    context.beginPath(); context.moveTo(0, -56); context.lineTo(0, -63); context.stroke()
    context.beginPath(); context.arc(0, -64.5, 2.6, 0, Math.PI * 2); context.fillStyle = palette.robotEye; context.fill(); context.stroke()
  }
  const radius = character === "r01" ? 4 : character === "pengu" ? 10 : 6
  part(context, palette, k.skin, -11, -55, 22, 21, radius)
  if (character === "pengu") {
    context.beginPath(); context.ellipse(2, -42, 8.5, 9, 0, 0, Math.PI * 2); context.fillStyle = palette.penguinBelly; context.fill()
    context.beginPath(); context.moveTo(9, -40); context.lineTo(15, -38); context.lineTo(9, -36); context.closePath(); context.fillStyle = palette.beak; context.fill(); context.stroke()
    roundRect(context, -11.5, -59, 23, 8, 4); context.fillStyle = palette.danger; context.fill(); context.stroke()
    context.beginPath(); context.arc(0, -61, 3, 0, Math.PI * 2); context.fillStyle = palette.snow; context.fill(); context.stroke()
  } else if (character === "dandan" || character === "nabi") {
    context.beginPath(); context.ellipse(3, -37.5, 6, 4, 0, 0, Math.PI * 2); context.fillStyle = character === "dandan" ? palette.bearLight : palette.catLight; context.fill()
    context.beginPath(); context.ellipse(3, -39, 2, 1.4, 0, 0, Math.PI * 2); context.fillStyle = palette.outline; context.fill()
    if (character === "nabi") {
      context.save(); context.lineWidth = 1; context.globalAlpha = 0.6
      for (const dy of [-1.5, 1]) { context.beginPath(); context.moveTo(10, -38 + dy); context.lineTo(15, -39 + dy * 1.6); context.stroke() }
      context.restore()
    }
  } else if (character === "r01") {
    roundRect(context, -8, -50, 18, 10, 3); context.fillStyle = palette.belt; context.fill(); context.stroke()
  } else if (character === "hana") {
    context.beginPath(); context.moveTo(-11, -45); context.quadraticCurveTo(-9, -58, 3, -56.5); context.quadraticCurveTo(11.5, -55.5, 11, -46)
    context.quadraticCurveTo(5, -51, -1, -49.5); context.quadraticCurveTo(-7, -48, -11, -45); context.closePath()
    context.fillStyle = palette.hair; context.fill(); context.stroke()
    part(context, palette, palette.hanaShirt, -13, -54, 5, 5, 2.5)
  } else {
    roundRect(context, -11.5, -58, 23, 9, 5); context.fillStyle = k.shirtDark; context.fill(); context.stroke()
    roundRect(context, 6, -52, 10, 4, 2); context.fillStyle = k.shirtDark; context.fill(); context.stroke()
  }
}

function drawFace(context: CanvasRenderingContext2D, palette: GamePalette, pose: RunnerPose, character: RunnerCharacter) {
  const ink = palette.outline
  context.save()
  if (character === "r01") {
    // Visor eyes only: a squint when hit, a smile-line when cheering.
    context.translate(2, -45); context.fillStyle = palette.robotEye
    const tall = pose === "hit" || pose === "fall" ? 1.2 : pose === "cheer" ? 1.6 : 3.6
    for (const x of [-3.5, 3.5]) { roundRect(context, x - 1.6, -tall / 2, 3.2, tall, 1.2); context.fill() }
    context.restore(); return
  }
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
