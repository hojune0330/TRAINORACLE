/**
 * Original cartoon sprites for the treadmill minigame, drawn with canvas paths.
 * Colours come only from the --game-* tokens (see colors_and_type.css).
 * Coordinates: origin at the runner's feet / hazard base, negative y is up.
 */
import type { TreadmillHazardKind, TreadmillUpgrade } from "../../domain/minigame/treadmill"
import { drawAnimeRunner } from "./anime-runner"

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
  skinShade: "--game-skin-shade", hairHana: "--game-hair-hana", hairSilver: "--game-hair-silver", hairShine: "--game-hair-shine",
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
  fill: string, stroke: string, font: string, weight = 900, maxWidth?: number) {
  context.save()
  context.font = `${weight} ${size}px ${font}`
  context.textAlign = "center"; context.textBaseline = "middle"
  context.lineJoin = "round"; context.lineWidth = Math.max(3, size / 5)
  context.strokeStyle = stroke; context.strokeText(text, x, y, maxWidth)
  context.fillStyle = fill; context.fillText(text, x, y, maxWidth)
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

/** All runners use the anime rig in anime-runner.ts (one skeleton, same height and hit box for everyone). */
export function drawRunner(context: CanvasRenderingContext2D, palette: GamePalette, look: RunnerLook) {
  drawAnimeRunner(context, palette, look)
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
