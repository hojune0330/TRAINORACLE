import { defenseSupplies, facilityX } from '../../domain/minigame/solo-defense'
import type { SoloDefense } from '../../domain/minigame/solo-defense'
import { drawCityBackdrop, citySceneFor } from './city-art'
import { TOUR_CITIES } from '../../domain/minigame/tour'
import { drawRunner, outlinedText } from './sprites'
import type { GamePalette } from './sprites'
import { drawPartyProp } from './party-art'
import { drawDefenseArt } from './defense-art'

export function drawSoloDefense(ctx: CanvasRenderingContext2D, p: GamePalette, s: SoloDefense, w: number, h: number, reduced: boolean) {
  const floor = h * .75, scale = Math.min(1.4, Math.max(.9, w / 410)), x = (v: number) => w * (.08 + .8 * v)
  const y = (v: number) => floor - (s.wave > 1 ? Math.sin(v * Math.PI) * 32 + v * 35 : v * 8)
  const scene = citySceneFor(TOUR_CITIES[0]!, s.wave === 2 ? 'mud' : 'track')
  drawCityBackdrop(ctx, p, scene, { width: w, height: h, floor: h * .875, left: 0, beltWidth: w, travel: s.time * 100,
    clock: s.time, reduced, low: true, skyFromShader: false })
  ctx.fillStyle = p.hillNear; ctx.fillRect(0, h * .42, w, h * .58)
  ctx.fillStyle = s.wave === 2 ? p.mud : p.belt
  ctx.beginPath(); ctx.moveTo(0, y(0) - 40)
  for (let i = 0; i <= 24; i++) ctx.lineTo(w * i / 24, y(i / 24) - 40)
  ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.closePath(); ctx.fill()
  ctx.strokeStyle = p.neonBlue; ctx.lineWidth = 2; ctx.globalAlpha = .4
  for (let row = 0; row < 4; row++) { ctx.beginPath(); for (let i = 0; i <= 24; i++) ctx.lineTo(w * i / 24, y(i / 24) - 20 + row * 32); ctx.stroke() }
  for (let col = -(s.time * 100) % 65; col < w; col += 65) { ctx.beginPath(); ctx.moveTo(col + 20, y(col / w) - 40); ctx.lineTo(col - 20, h); ctx.stroke() }
  ctx.globalAlpha = 1
  const text = (t: string, px: number, py: number, size = 13) => outlinedText(ctx, t, px, py, size, p.cloud, p.outline, 'system-ui, sans-serif', 800, w * .9)
  for (let i = 0; i < 3; i++) {
    const fx = x(facilityX(i)), fy = y(facilityX(i)) - 160 * scale, f = s.facilities[i]
    ctx.fillStyle = p.panel; ctx.strokeStyle = p.outline; ctx.lineWidth = 3
    ctx.beginPath(); ctx.ellipse(fx, fy + 20, 28 * scale, 10, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke()
    if (!f) { text('빈 칸', fx, fy); continue }
    ctx.fillStyle = f.kind === 'cannon' ? p.gold : f.kind === 'fan' ? p.neonBlue : p.good
    ctx.strokeStyle = p.outline
    if (drawDefenseArt(ctx, f.kind, fx, fy + 20, 84 * scale)) {
      // Original geometry below remains available if image loading fails.
    } else if (f.kind === 'cannon') {
      ctx.fillRect(fx - 18, fy - 18, 36, 28); ctx.strokeRect(fx - 18, fy - 18, 36, 28)
      ctx.beginPath(); ctx.arc(fx, fy - 23, 12, 0, Math.PI * 2); ctx.fill(); ctx.stroke()
    } else if (f.kind === 'fan') {
      for (let a = 0; a < 3; a++) { const angle = a * Math.PI * 2 / 3 + (reduced ? 0 : s.time * 3); ctx.beginPath(); ctx.ellipse(fx + Math.cos(angle) * 13, fy - 8 + Math.sin(angle) * 13, 15, 7, angle, 0, Math.PI * 2); ctx.fill(); ctx.stroke() }
    } else {
      ctx.beginPath(); ctx.moveTo(fx - 10, fy + 18); ctx.lineTo(fx - 10, fy - 35); ctx.lineTo(fx + 25, fy - 23); ctx.lineTo(fx - 10, fy - 9); ctx.fill(); ctx.stroke()
    }
    text(`${{ cannon: '발사기', fan: '바람', flag: '보급' }[f.kind]} ${f.level}`, fx, fy + 42, 12)
  }
  const baseY = y(.055)
  ctx.strokeStyle = p.danger; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x(.055), baseY - 40); ctx.lineTo(x(.055), h); ctx.stroke()
  if (!drawDefenseArt(ctx, 'base', x(.055), baseY, 72 * scale)) drawPartyProp(ctx, 'respawn-beacon', x(.055), baseY - 40, 65 * scale)
  text(`기지 통과 ${s.totals.passed}마리`, w * .18, baseY + 58, 12)
  for (const c of defenseSupplies(s)) {
    if (!drawPartyProp(ctx, 'supply-capsule', x(c.x), y(c.x) - 25, 46 * scale)) {
      ctx.fillStyle = p.gold; ctx.fillRect(x(c.x) - 13, y(c.x) - 38, 26, 26)
    }
    text('예산 +1', x(c.x), y(c.x) - 58, 11)
  }
  for (const e of s.enemies) {
    const ex = x(e.x), ey = y(e.x) - 18
    ctx.fillStyle = e.kind === 'armor' ? p.rail : e.kind === 'rush' ? p.danger : p.mudLight
    ctx.strokeStyle = p.outline; ctx.lineWidth = 3
    const hasArt = drawDefenseArt(ctx, e.kind, ex, ey + 19, (e.kind === 'armor' ? 64 : 56) * scale, true)
    if (!hasArt) { ctx.beginPath(); ctx.ellipse(ex, ey, e.kind === 'armor' ? 23 : 17, e.kind === 'rush' ? 12 : 19, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke() }
    if (e.kind === 'armor') {
      if (!hasArt || e.cracked) { ctx.fillStyle = e.cracked ? p.good : p.belt; ctx.fillRect(ex - 23, ey - 5, 46, 9) }
      text(e.cracked ? '껍질 깨짐' : '두 번 눌러 깨기', ex, ey - 45, 11)
    }
    if (e.kind === 'rush' && !hasArt) { ctx.beginPath(); ctx.moveTo(ex - 28, ey); ctx.lineTo(ex - 12, ey - 8); ctx.lineTo(ex - 12, ey + 8); ctx.closePath(); ctx.fill(); ctx.stroke() }
    if (!hasArt) { ctx.fillStyle = p.ink; ctx.fillRect(ex - 10, ey - 5, 4, 5); ctx.fillRect(ex + 3, ey - 5, 4, 5) }
    ctx.fillStyle = p.outline; ctx.fillRect(ex - 20, ey - 32, 40, 6)
    ctx.fillStyle = p.good; ctx.fillRect(ex - 20, ey - 32, 40 * e.hp / e.maxHp, 6)
  }
  for (const shot of s.shots) {
    ctx.strokeStyle = p.gold; ctx.lineWidth = reduced ? 2 : 5
    ctx.beginPath(); ctx.moveTo(x(shot.from), y(shot.from) - 180 * scale); ctx.lineTo(x(shot.to), y(shot.to) - 20); ctx.stroke()
  }
  const r = s.runner
  if (r.respawn > 0) {
    drawPartyProp(ctx, 'respawn-beacon', x(.5), y(.5), 80)
    text(`${Math.ceil(r.respawn)}초 뒤 복귀`, w * .5, h * .44, 20)
  } else {
    ctx.save(); ctx.translate(x(r.x), y(r.x) - r.y * scale); ctx.scale(scale, scale)
    if (r.protected > 0) { ctx.strokeStyle = p.neonBlue; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(0, -40, 30, 48, 0, 0, Math.PI * 2); ctx.stroke() }
    drawRunner(ctx, p, { character: 'tori', upgrades: [], phase: s.time * 13,
      pose: r.hit > 0 ? 'hit' : r.y > 0 ? 'jump' : r.dash > 0 ? 'dash' : r.running ? 'run' : 'idle' }); ctx.restore()
  }
}
