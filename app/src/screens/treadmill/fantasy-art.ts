import type {TreadmillSurface} from '../../domain/minigame/treadmill'
import type {GamePalette} from './sprites'
import type {CityFrame} from './city-art'

const ART = ['panorama', 'ground', 'gate', 'crystal', 'bridge'] as const
type FantasyArt = typeof ART[number]
const images = new Map<FantasyArt, HTMLImageElement>()
let pending: Promise<void> | undefined
export const fantasyArtUrl = (id: FantasyArt) => `${import.meta.env.BASE_URL}game/fantasy-world-v1/${id}.webp`

/** Shared-region imagery is optional presentation. A failed image cannot prevent a run. */
export function loadFantasyArt(): Promise<void> {
  if (pending) return pending
  if (typeof Image === 'undefined') return Promise.resolve()
  pending = Promise.all(ART.map(id => new Promise<void>(resolve => {
    const image = new Image()
    image.onload = () => { if (image.naturalWidth > 0) images.set(id, image); resolve() }
    image.onerror = () => resolve()
    image.src = fantasyArtUrl(id)
  }))).then(() => undefined)
  return pending
}

const wrap = (value: number, span: number) => ((value % span) + span) % span

function prop(ctx: CanvasRenderingContext2D, id: FantasyArt, x: number, base: number, size: number) {
  const image = images.get(id)
  if (!image) return false
  // Blender assets share their ground anchor; transparent margins are intentional.
  ctx.drawImage(image, x - size * .5, base - size * .78, size, size)
  return true
}

/** Cover + a bounded slow pan never exposes an edge or a repeating panorama seam. */
export function drawFantasyBackdrop(ctx: CanvasRenderingContext2D, p: GamePalette, surface: TreadmillSurface, frame: CityFrame) {
  const {width, height, floor, travel, reduced} = frame
  ctx.clearRect(0, 0, width, height)
  const sky = ctx.createLinearGradient(0, 0, 0, floor)
  sky.addColorStop(0, p.skyTop); sky.addColorStop(1, p.hillFar)
  ctx.fillStyle = sky; ctx.fillRect(0, 0, width, height)
  const image = images.get('panorama'), bottom = floor * .91
  if (image) {
    const scale = Math.max(width / image.naturalWidth, bottom / image.naturalHeight) * 1.12
    const w = image.naturalWidth * scale, h = image.naturalHeight * scale
    const drift = reduced ? .5 : .5 + Math.sin(travel / 7000) * .35
    ctx.drawImage(image, -(w - width) * drift, bottom - h, w, h)
  } else {
    // Quiet layered ridges keep the route legible when offline images are unavailable.
    for (let layer = 0; layer < 3; layer++) {
      ctx.fillStyle = [p.hillFar, p.mudHillFar, p.hillNear][layer]!
      ctx.beginPath(); ctx.moveTo(0, bottom)
      for (let x = 0; x <= width + 30; x += 30) ctx.lineTo(x, bottom * (.54 + layer * .13) + Math.sin(x / 95 + layer) * 22)
      ctx.lineTo(width, height); ctx.lineTo(0, height); ctx.closePath(); ctx.fill()
    }
  }
  if (surface !== 'track') {
    ctx.save(); ctx.globalAlpha = surface === 'spikes' ? .32 : .1
    ctx.fillStyle = surface === 'spikes' ? p.cityNight : p.neonPink
    ctx.fillRect(0, 0, width, height); ctx.restore()
  }
}

/** The playable lane keeps the existing floor/hit geometry; scenery stays behind it. */
export function drawFantasyGround(ctx: CanvasRenderingContext2D, p: GamePalette, surface: TreadmillSurface, frame: CityFrame, warnRear: number, near: number) {
  const {width, height, floor, left, beltWidth, travel, low, reduced} = frame
  const top = floor * .77
  const path = ctx.createLinearGradient(0, top, 0, height)
  path.addColorStop(0, surface === 'spikes' ? p.cityFar : surface === 'mud' ? p.mudHillFar : p.hillFar)
  path.addColorStop(1, surface === 'spikes' ? p.cityNight : surface === 'mud' ? p.mudLight : p.sand)
  ctx.fillStyle = path; ctx.fillRect(0, top, width, height - top)
  const ground = images.get('ground')
  if (ground) {
    ctx.save(); ctx.globalAlpha = .18
    // Adjacent mirrored tiles meet at identical edge pixels.
    const tile = Math.max(width, 420), offset = reduced ? 0 : wrap(travel * .6, tile * 2)
    for (let i = -2; i < 3; i++) {
      ctx.save(); ctx.translate(i * tile - offset, top)
      if (Math.abs(i) % 2) { ctx.translate(tile, 0); ctx.scale(-1, 1) }
      ctx.drawImage(ground, 0, 0, tile + 1, height - top); ctx.restore()
    }
    ctx.restore()
  }
  // Stone joints convey motion without the red stadium track in a fantasy forest.
  const scroll = reduced ? 0 : wrap(travel * 1.3, 88)
  ctx.save(); ctx.strokeStyle = p.cloud; ctx.globalAlpha = surface === 'spikes' ? .2 : .3; ctx.lineWidth = 1.5
  for (let x = -100 - scroll; x < width + 100; x += 88) {
    ctx.beginPath(); ctx.moveTo(width * .5 + (x - width * .5) / 1.5, top); ctx.lineTo(x, height); ctx.stroke()
  }
  for (const y of [top, floor + 16, floor + 50]) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke() }
  ctx.restore()

  // Bases end above the runner's head, keeping silhouettes out of the hazard corridor.
  const landmark = surface === 'track' ? 'crystal' : surface === 'mud' ? 'bridge' : 'gate'
  const landmarkSize = Math.min(156, floor * .3)
  prop(ctx, landmark, width * .73 - (reduced ? 0 : Math.sin(travel / 1400) * 24), top - landmarkSize * .22, landmarkSize)
  for (let i = 0; i < (low ? 3 : 5); i++) {
    const size = 32 + i % 2 * 18, x = wrap(i * 173 - (reduced ? 0 : travel * .24), width + 160) - 80
    prop(ctx, 'crystal', x, top - 15 - i % 2 * 20, size)
  }
  if (!reduced && !low) {
    ctx.save(); ctx.fillStyle = p.neonBlue
    for (let i = 0; i < 8; i++) {
      const x = wrap(i * 61 - travel * .12, width + 20) - 10
      const y = top - 20 - (i * 37) % Math.max(30, top * .25)
      ctx.globalAlpha = .2 + Math.abs(Math.sin(travel / 250 + i)) * .4
      ctx.beginPath(); ctx.arc(x, y, 1.5, 0, Math.PI * 2); ctx.fill()
    }
    ctx.restore()
  }
  const warn = Math.max(0, left + warnRear * beltWidth)
  if (near > 0 && warn > 0) {
    ctx.save(); ctx.globalAlpha = near * .34; ctx.fillStyle = p.danger; ctx.fillRect(0, top, warn, height - top)
    ctx.globalAlpha = near; ctx.fillRect(0, floor + 6, warn, 5); ctx.restore()
  }
}
