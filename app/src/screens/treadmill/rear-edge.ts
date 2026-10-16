import type { GamePalette } from './sprites'

/** Paint the pit behind the exact engine fall line, below gameplay silhouettes. */
export function drawRearEdge(ctx: CanvasRenderingContext2D, p: GamePalette, edge: number,
  floor: number, width: number, height: number) {
  if (edge <= 0 || edge >= width) return
  ctx.save()
  ctx.fillStyle = p.outline
  ctx.fillRect(0, floor - 8, edge, height - floor + 8)
  ctx.strokeStyle = p.danger; ctx.lineWidth = 4
  ctx.beginPath(); ctx.moveTo(edge, floor - 8); ctx.lineTo(edge, height); ctx.stroke()
  ctx.beginPath(); ctx.rect(Math.max(0, edge - 10), floor - 8, 10, height - floor + 8); ctx.clip()
  ctx.strokeStyle = p.gold; ctx.lineWidth = 4
  for (let y = floor - 8; y < height + 18; y += 18) {
    ctx.beginPath(); ctx.moveTo(edge - 10, y); ctx.lineTo(edge, y + 10); ctx.stroke()
  }
  ctx.restore()
}
