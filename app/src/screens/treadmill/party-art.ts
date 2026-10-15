/** Presentation-only Tripo art. Loading failure must never gate the simulation. */
import manifest from '../../../public/game/run-party-v2/manifest.json'

export type PartyProp = 'jump-pad' | 'supply-capsule' | 'upgrade-core' | 'track-island' | 'respawn-beacon'
export const partyIconUrl = (id: PartyProp) => `${import.meta.env.BASE_URL}game/run-party-v3/${id}.webp`
const images = new Map<string, HTMLImageElement>()
const pending = new Map<string, Promise<void>>()
function load(url: string): Promise<void> {
  if (pending.has(url)) return pending.get(url)!
  if (typeof Image === 'undefined') return Promise.resolve()
  const promise = new Promise<void>(resolve => {
    const image = new Image()
    const done = () => { clearTimeout(timer); resolve() }
    const timer = setTimeout(done, 4000)
    image.onload = () => { if (image.naturalWidth && image.naturalHeight) images.set(url, image); done() }
    image.onerror = done
    image.src = url
  })
  pending.set(url, promise)
  return promise
}
export function loadPartyArt(includeJumpEffect = false): Promise<void> {
  return Promise.all([
    ...(['jump-pad', 'supply-capsule', 'upgrade-core', 'respawn-beacon'] as const).map(id => load(partyIconUrl(id))),
    ...manifest.assets.filter(a => includeJumpEffect || a.id !== 'jump-pad').map(a => load(`${import.meta.env.BASE_URL}game/run-party-v2/${a.effect.file}`)),
  ]).then(() => undefined)
}

export function partyEffectFrame(elapsed: number, reduced: boolean): number | null {
  if (reduced || !Number.isFinite(elapsed) || elapsed < 0 || elapsed >= .64) return null
  return Math.min(7, Math.floor(elapsed / .08))
}

/** Centered UI/event art. Never infer a collider from transparent margins. */
export function drawPartyProp(ctx: CanvasRenderingContext2D, id: PartyProp, x: number, y: number,
  size: number, elapsed?: number, reduced = false): boolean {
  const frame = elapsed === undefined ? null : partyEffectFrame(elapsed, reduced)
  const asset = manifest.assets.find(a => a.id === id)
  if (asset && frame !== null) {
    const image = images.get(`${import.meta.env.BASE_URL}game/run-party-v2/${asset.effect.file}`)
    const rect = asset.effect.frames[frame]
    if (image && rect) {
      ctx.drawImage(image, rect[0]!, rect[1]!, rect[2]!, rect[3]!, x-size/2, y-size/2, size, size)
      return true
    }
  }
  const image = images.get(partyIconUrl(id))
  if (!image) return false
  ctx.drawImage(image, x-size/2, y-size/2, size, size)
  return true
}
