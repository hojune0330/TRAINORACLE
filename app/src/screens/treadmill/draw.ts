import { TREADMILL_STAGES } from "../../domain/minigame/treadmill"
import type { TreadmillState } from "../../domain/minigame/treadmill"

export type TreadmillPalette = Record<"background" | "surface" | "ink" | "muted" | "line" | "runner" | "danger" | "track" | "mud", string>

export function treadmillPalette(element: HTMLElement): TreadmillPalette {
  const css = getComputedStyle(element)
  const token = (name: string) => css.getPropertyValue(name).trim()
  return { background: token("--bg"), surface: token("--surface-2"), ink: token("--ink"), muted: token("--ink-3"),
    line: token("--line-2"), runner: token("--brand"), danger: token("--err"), track: token("--tape"), mud: token("--pencil") }
}

export function drawTreadmill(context: CanvasRenderingContext2D, state: TreadmillState, width: number, height: number,
  palette: TreadmillPalette, reducedMotion: boolean): void {
  const floor = height - 52
  const stage = TREADMILL_STAGES[state.stage]!
  context.clearRect(0, 0, width, height)
  context.fillStyle = palette.background
  context.fillRect(0, 0, width, height)
  context.fillStyle = palette.surface
  context.fillRect(width * 0.04, floor + 20, width * 0.92, 16)
  context.fillStyle = stage.id === "mud" ? palette.mud : palette.track
  context.fillRect(width * 0.04, floor, width * 0.92, 20)
  context.save()
  context.beginPath(); context.rect(width * 0.04, floor, width * 0.92, 20); context.clip()
  context.fillStyle = palette.ink; context.globalAlpha = 0.25
  const phase = reducedMotion ? 0 : state.seconds * 130
  for (let x = -(phase % 44); x < width; x += 44) {
    if (stage.id === "mud") { context.beginPath(); context.ellipse(x, floor + 10, 10, 3, 0, 0, Math.PI * 2); context.fill() }
    else context.fillRect(x, floor + 8, 20, 3)
  }
  context.restore()
  context.fillStyle = palette.danger; context.globalAlpha = 0.10
  context.fillRect(width * 0.04, 48, width * 0.13, floor - 48); context.globalAlpha = 1
  context.font = `12px ${getComputedStyle(context.canvas).fontFamily}`
  context.fillStyle = palette.danger; context.fillText("추락", width * 0.05, floor + 46)
  context.fillStyle = palette.muted; context.textAlign = "right"; context.fillText("바닥 ←", width * 0.94, floor + 46); context.textAlign = "left"
  for (const hazard of state.hazards) {
    const x = hazard.x * width
    context.fillStyle = palette.danger
    if (stage.hazard === "spike") {
      for (let j = -1; j <= 1; j++) {
        context.beginPath(); context.moveTo(x + j * 12 - 6, floor); context.lineTo(x + j * 12, floor - 25); context.lineTo(x + j * 12 + 6, floor); context.fill()
      }
    } else {
      context.fillRect(x - 11, floor - 26, 22, 8)
      context.fillStyle = palette.ink; context.fillRect(x - 8, floor - 18, 4, 18); context.fillRect(x + 4, floor - 18, 4, 18)
    }
  }
  context.save(); context.translate(Math.max(10, state.x * width), floor - state.y + (state.mode === "over" ? 24 : 0))
  const stride = !reducedMotion && state.mode === "running" && state.running && state.y === 0 ? Math.sin(state.seconds * 14) * 6 : 0
  context.fillStyle = palette.runner; context.fillRect(-10, -35, 20, 20)
  context.fillStyle = palette.ink; context.fillRect(-8, -52, 16, 16)
  context.fillStyle = palette.background; context.fillRect(3, -46, 3, 3)
  context.strokeStyle = palette.ink; context.lineWidth = 6; context.lineCap = "round"
  context.beginPath(); context.moveTo(-4, -16); context.lineTo(-6 - stride, -3); context.moveTo(5, -16); context.lineTo(7 + stride, -3); context.stroke()
  context.lineWidth = 5; context.beginPath(); context.moveTo(-10, -31); context.lineTo(-17 + stride, -22); context.moveTo(10, -31); context.lineTo(16 - stride, -23); context.stroke()
  if (state.dashLeft > 0 && !reducedMotion) {
    context.strokeStyle = palette.runner; context.lineWidth = 3; context.beginPath(); context.moveTo(-20, -28); context.lineTo(-41, -28); context.moveTo(-22, -17); context.lineTo(-34, -17); context.stroke()
  }
  context.restore()
}
