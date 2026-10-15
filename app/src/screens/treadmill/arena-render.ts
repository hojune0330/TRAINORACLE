import { drawCityBackdrop, drawCityGround, citySceneFor } from './city-art'
import { TOUR_CITIES } from '../../domain/minigame/tour'
import { drawHazard, drawRunner, outlinedText } from './sprites'
import type { GamePalette } from './sprites'
import type { ArenaSnapshot } from './arena-types'
import { drawPartyProp } from './party-art'

export function drawArena(ctx: CanvasRenderingContext2D, palette: GamePalette, snapshot: ArenaSnapshot,
  selfId: string, width: number, height: number, reduced: boolean, visualTime: number, curve = false) {
  const game = snapshot.game
  if (!game) return
  const surface = game.time < 30 ? 'track' : game.time < 60 ? 'mud' : 'spikes'
  const time = Math.max(0, game.time), sway = reduced ? 0 : Math.sin(visualTime * .45) * 3
  const floor = height * .72 + sway, scale = Math.min(1.4, Math.max(1.1, width / 440))
  const ground = (x: number) => floor - (curve ? Math.sin(x * Math.PI) * 34 + x * 34 : 0)
  const scene = citySceneFor(TOUR_CITIES[0]!, surface)
  const frame = { width, height, floor, left: 0, beltWidth: width, travel: time * 125, clock: time,
    reduced, low: false, skyFromShader: false }
  drawCityBackdrop(ctx, palette, scene, frame)
  drawCityGround(ctx, palette, scene, frame, 0, 0)
  // Full-width playable floor. Scenery always renders before bodies and hazards.
  ctx.fillStyle = surface === 'mud' ? palette.mud : palette.laneRedDark
  ctx.beginPath()
  for (let i = 0; i <= 20; i++) ctx.lineTo(i / 20 * width, ground(i / 20) - 30 * scale)
  for (let i = 20; i >= 0; i--) ctx.lineTo(i / 20 * width, ground(i / 20) + 70 * scale)
  ctx.closePath(); ctx.fill()
  ctx.strokeStyle = palette.cloud; ctx.globalAlpha = .35; ctx.lineWidth = 2
  for (let i = 0; i < 3; i++) { ctx.beginPath(); for (let j = 0; j <= 20; j++) ctx.lineTo(j / 20 * width, ground(j / 20) - 15 + i * 30); ctx.stroke() }
  for (let x = -(time * 125) % 65; x < width + 65; x += 65) { ctx.beginPath(); ctx.moveTo(x + 24, ground(x / width) - 30 * scale); ctx.lineTo(x - 24, ground(x / width) + (curve ? 70 : 100) * scale); ctx.stroke() }
  ctx.globalAlpha = 1; ctx.fillStyle = palette.danger; ctx.fillRect(width * .055, ground(.055) - 30 * scale, 4, 100 * scale)
  const font = 'system-ui, sans-serif'
  outlinedText(ctx, '낙하선', width * .12, ground(.055) + 86 * scale, 12, palette.cloud, palette.outline, font)
  // Spawn art is scenery: hazards and active players always paint over it.
  for (const p of game.players) if (p.state === 'respawning') {
    const spawnX = (p.slot === 0 ? .53 : .68) * width
    drawPartyProp(ctx, 'respawn-beacon', spawnX, ground(spawnX / width) + p.slot * 12 - 18, 72 * scale)
  }
  for (const h of game.hazards) {
    ctx.save(); ctx.translate(h.x * width, ground(h.x) + 5); ctx.scale(scale, scale)
    if (h.kind === 'hurdle') drawHazard(ctx, palette, 'barrier', 15, 36, true)
    else { ctx.fillStyle = palette.rail; ctx.strokeStyle = palette.outline; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(0, -13, 16, 13, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke() }
    ctx.restore()
  }
  for (const p of game.players) {
    const name = snapshot.members.find(m => m.id === p.id)?.name ?? '러너'
    const base = ground(p.x) + p.slot * 12
    if (p.state === 'respawning') {
      const spawnX = (p.slot === 0 ? .53 : .68) * width
      ctx.strokeStyle = p.id === selfId ? palette.gold : palette.neonBlue; ctx.lineWidth = 3
      ctx.beginPath(); ctx.ellipse(spawnX, ground(spawnX / width) + p.slot * 12, 24, 8, 0, 0, Math.PI * 2); ctx.stroke()
      outlinedText(ctx, `${name} · ${Math.max(1, Math.ceil(p.respawnAt - time))}초 뒤 복귀`, width / 2, height * .38 + p.slot * 32, 16, palette.cloud, palette.outline, font)
      continue
    }
    ctx.fillStyle = p.id === selfId ? palette.gold : palette.neonBlue
    ctx.beginPath(); ctx.ellipse(p.x * width, base, 24 * scale, 7 * scale, 0, 0, Math.PI * 2); ctx.fill()
    ctx.save(); ctx.translate(p.x * width, base - p.y * scale); ctx.scale(scale, scale)
    const protectedNow = time < p.protectedUntil
    if (protectedNow) { ctx.globalAlpha = .8; ctx.strokeStyle = palette.neonBlue; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(0, -40, 32, 46, 0, 0, Math.PI * 2); ctx.stroke() }
    drawRunner(ctx, palette, { character: p.slot === 0 ? 'tori' : 'hana', upgrades: [], phase: visualTime * 13,
      pose: time < p.hitUntil ? 'hit' : p.y > 0 ? 'jump' : time < p.dashUntil ? 'dash' : p.running ? 'run' : 'idle' })
    ctx.restore()
    outlinedText(ctx, `${p.id === selfId ? '나 · ' : ''}${name}${protectedNow ? ' · 보호' : ''}`, p.x * width, base - p.y * scale - 90 * scale, 13, palette.cloud, palette.outline, font, 800, width * .48)
  }
}
