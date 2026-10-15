import type { GamePalette } from './sprites'
export type MotionBurst = 'jump' | 'dash' | 'land' | 'clear'
/** Local vector effects: finite, bounded, and always behind gameplay silhouettes. */
export function drawMotionBurst(ctx: CanvasRenderingContext2D, p: GamePalette, kind: MotionBurst,
  x: number, floor: number, age: number, reduced: boolean) {
  if (reduced || age < 0 || age >= .36) return
  const t = age / .36
  ctx.save(); ctx.globalAlpha = (1-t)*.75
  ctx.strokeStyle = kind === 'clear' ? p.gold : kind === 'dash' ? p.neonBlue : p.cloud
  ctx.lineWidth = 3*(1-t)+1
  if (kind === 'dash') {
    for (let i=0;i<3;i++) {
      const start=x-20-t*60-i*12, y=floor-22-i*12
      ctx.beginPath(); ctx.moveTo(start-22,y); ctx.lineTo(start,y); ctx.stroke()
    }
  } else {
    ctx.beginPath(); ctx.ellipse(x,floor+3,12+t*38,4+t*9,0,0,Math.PI*2); ctx.stroke()
    if (kind === 'jump' || kind === 'clear') for (let i=0;i<5;i++) {
      const angle=Math.PI+i*Math.PI/4, radius=18+t*28
      ctx.beginPath();ctx.moveTo(x+Math.cos(angle)*radius,floor+Math.sin(angle)*radius)
      ctx.lineTo(x+Math.cos(angle)*(radius+7),floor+Math.sin(angle)*(radius+7));ctx.stroke()
    }
  }
  ctx.restore()
}
