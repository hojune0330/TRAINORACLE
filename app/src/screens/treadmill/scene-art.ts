import runtime from '../../../public/game/image-library-v1/manifest.json' with { type: 'json' }

/** Offline props: existing Seoul 3D artwork stays primary. */
export const SCENE_ART = ["tree", "rock", "hurdle", "gate", "shoe", "tower"] as const
export type SceneProp = typeof SCENE_ART[number]
export const sceneArtUrl = (id: SceneProp) => `${import.meta.env.BASE_URL}game/seoul-v1/${id}.webp`
export const WORLD_ART = ['tree-broadleaf', 'rock-cluster', 'jump-hurdle', 'mud-patch', 'short-bridge', 'grass-island'] as const
export type WorldProp = typeof WORLD_ART[number]
export const worldArtUrl = (id: WorldProp) => `${import.meta.env.BASE_URL}game/image-library-v1/world/world-${id}.webp`
const images = new Map<string, HTMLImageElement>()
let pending: Promise<void> | undefined

/** Individual failures stay local: a missing prop must never prevent play. */
export function loadSceneArt(): Promise<void> {
  if (pending) return pending
  if (typeof Image === "undefined") return Promise.resolve()
  const sources = [
    ...SCENE_ART.map(id => [id, sceneArtUrl(id)] as const),
    ...WORLD_ART.map(id => [`world-${id}`, worldArtUrl(id)] as const),
  ]
  pending = Promise.all(sources.map(([id, url]) => new Promise<void>(resolve => {
    const image = new Image()
    image.onload = () => {
      if (image.naturalWidth > 0 && image.naturalHeight > 0) images.set(id, image)
      resolve()
    }
    image.onerror = () => resolve()
    image.src = url
  }))).then(() => undefined)
  return pending
}

/** Baked artwork is tightly cropped; the base aligns to the existing physics floor. */
export function drawSceneProp(context: CanvasRenderingContext2D, id: SceneProp,
  x: number, base: number, width: number, height: number): boolean {
  const image = images.get(id)
  if (!image) {
    const replacement = { tree: 'tree-broadleaf', rock: 'rock-cluster', hurdle: 'jump-hurdle' } as const
    return id in replacement && drawWorldProp(context, replacement[id as keyof typeof replacement], x, base, width, height)
  }
  context.drawImage(image, x - width / 2, base - height, width, height)
  return true
}

/** Source-rect alignment removes transparent margins at draw time; files stay intact. */
export function drawWorldProp(context: CanvasRenderingContext2D, id: WorldProp,
  x: number, base: number, width: number, height: number): boolean {
  const image = images.get(`world-${id}`)
  const asset = runtime.assets.find(a => a.id === `world-${id}`)
  if (!image || !asset) return false
  const [left, top, right, bottom] = asset.visibleRectAlpha128
  if (left === undefined || top === undefined || right === undefined || bottom === undefined) return false
  context.drawImage(image, left, top, right - left, bottom - top, x - width / 2, base - height, width, height)
  return true
}
