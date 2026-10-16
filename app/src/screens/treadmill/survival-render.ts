import type { ArenaSnapshot } from './arena-types'
import { drawHazard, drawRunner, outlinedText } from './sprites'
import type { GamePalette } from './sprites'
import { drawPartyProp } from './party-art'
import { survivalPoint } from './survival-view'

/** Two perspective lanes share the exact server hazard positions and collision rules. */
export function drawSurvivalCourse(ctx: CanvasRenderingContext2D, palette: GamePalette, snapshot: ArenaSnapshot,
  selfId: string, width: number, height: number, reduced: boolean, visualTime: number, curve: boolean) {
  const game = snapshot.game!
  const time = Math.max(0, game.time), font = 'system-ui, sans-serif'
  const point = (x: number, lane: number) => survivalPoint(x, lane, width, height, visualTime, reduced, curve)
  const polygon = (points: ReturnType<typeof point>[], fill: string) => {
    ctx.beginPath(); points.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.closePath()
    ctx.fillStyle = fill; ctx.fill(); ctx.strokeStyle = palette.neonBlue; ctx.lineWidth = 1; ctx.stroke()
  }
  // A continuous deck, not fake holes. Seams move at the same speed as the hazards.
  polygon([point(0,-2.1), point(1.2,-2.1), point(1.2,2.1), point(0,2.1)], palette.beltDark)
  for (let i = 16; i >= 0; i--) {
    const x = i * .08 - (time * .24) % .08
    if (x < 0 || x > 1.2) continue
    for (const lane of [-1, 1]) polygon([point(x,lane-.9), point(Math.min(1.2,x+.075),lane-.9),
      point(Math.min(1.2,x+.075),lane+.9), point(x,lane+.9)], i % 2 ? palette.belt : palette.rail)
  }
  const edgeA = point(.055,-2.05), edgeB = point(.055,2.05)
  ctx.strokeStyle = palette.danger; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(edgeA.x,edgeA.y); ctx.lineTo(edgeB.x,edgeB.y); ctx.stroke()
  outlinedText(ctx, '낙하선 · 손을 떼면 뒤로 밀려요', width / 2, Math.min(height-62,edgeA.y+24), 12, palette.cloud, palette.outline, font)
  // Paint far-to-near so scenery never covers a nearer runner or obstacle.
  const bodies = [
    ...game.hazards.flatMap(h => [-1,1].map(lane => ({x:h.x, kind:'hazard' as const, h, lane}))),
    ...game.players.map(p => ({x:p.state === 'respawning' ? .53 : p.x, kind:'runner' as const, p, lane:p.slot===0?-1:1})),
  ].sort((a,b)=>b.x-a.x)
  for (const body of bodies) {
    const pos=point(body.x,body.lane), scale=pos.scale * Math.min(1.5,Math.max(1.3,width/340))
    if (body.kind === 'hazard') {
      ctx.save(); ctx.translate(pos.x,pos.y); ctx.scale(scale,scale)
      ctx.fillStyle=palette.outline; ctx.globalAlpha=.2; ctx.beginPath(); ctx.ellipse(0,3,23,6,0,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1
      if(body.h.kind==='hurdle') drawHazard(ctx,palette,'barrier',15,36,true)
      else {ctx.fillStyle=palette.rail;ctx.strokeStyle=palette.outline;ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(0,-13,16,13,0,0,Math.PI*2);ctx.fill();ctx.stroke()}
      ctx.restore(); continue
    }
    const p=body.p, mine=p.id===selfId, name=snapshot.members.find(m=>m.id===p.id)?.name??'러너'
    if(p.state==='respawning') {
      drawPartyProp(ctx,'respawn-beacon',pos.x,pos.y-20,64*scale)
      outlinedText(ctx,`${mine?'나':name} · ${Math.max(1,Math.ceil(p.respawnAt-time))}초`,pos.x,pos.y-68*scale,13,palette.cloud,palette.outline,font)
      continue
    }
    ctx.fillStyle=mine?palette.gold:palette.neonBlue;ctx.beginPath();ctx.ellipse(pos.x,pos.y,22*scale,7*scale,0,0,Math.PI*2);ctx.fill()
    ctx.save();ctx.translate(pos.x,pos.y-p.y*scale);ctx.scale(scale,scale)
    if(time<p.protectedUntil){ctx.strokeStyle=palette.neonBlue;ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(0,-40,32,46,0,0,Math.PI*2);ctx.stroke()}
    drawRunner(ctx,palette,{character:p.slot===0?'tori':'hana',upgrades:[],phase:visualTime*13,
      pose:time<p.hitUntil?'hit':p.y>0?'jump':time<p.dashUntil?'dash':p.running?'run':'idle'})
    ctx.restore()
    outlinedText(ctx,mine?'나':name,pos.x,pos.y-p.y*scale-90*scale,13,palette.cloud,palette.outline,font,800,width*.4)
  }
}
