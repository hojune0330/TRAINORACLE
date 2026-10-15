/** Offline-baked Tripo props; presentation must never block gameplay. */
export const DEFENSE_ART = ['cannon', 'fan', 'flag', 'normal', 'rush', 'armor', 'base', 'finish-gate'] as const
export type DefenseArt = typeof DEFENSE_ART[number]
export const defenseArtUrl = (id: DefenseArt) => `${import.meta.env.BASE_URL}game/defense-v4/${id}.webp`
const images = new Map<DefenseArt, HTMLImageElement>()
let pending: Promise<void> | undefined
export function loadDefenseArt(): Promise<void> {
  if (pending) return pending
  if (typeof Image === 'undefined') return Promise.resolve()
  pending = Promise.all(DEFENSE_ART.map(id => new Promise<void>(resolve => {
    const image = new Image()
    const done = () => { clearTimeout(timer); resolve() }
    const timer = setTimeout(done, 4000)
    image.onload = () => { if (image.naturalWidth) images.set(id, image); done() }
    image.onerror = done; image.src = defenseArtUrl(id)
  }))).then(() => undefined)
  return pending
}
/** All baked images share baseline 240/256. Colliders stay in the simulation. */
export function drawDefenseArt(ctx: CanvasRenderingContext2D, id: DefenseArt, x: number, baseline: number, size: number, faceLeft = false): boolean {
  const image = images.get(id)
  if (!image) return false
  ctx.save(); ctx.translate(x, baseline)
  if (faceLeft) ctx.scale(-1, 1)
  ctx.drawImage(image, -size / 2, -size * 240 / 256, size, size)
  ctx.restore()
  return true
}
