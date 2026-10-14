/** Offline 3D props: small transparent images; exact provenance lives in the asset manifest. */
export const SCENE_ART = ["tree", "rock", "hurdle", "gate", "shoe", "tower"] as const
export type SceneProp = typeof SCENE_ART[number]
export const sceneArtUrl = (id: SceneProp) => `${import.meta.env.BASE_URL}game/seoul-v1/${id}.webp`
const images = new Map<SceneProp, HTMLImageElement>()
let pending: Promise<void> | undefined

/** Individual failures stay local: a missing prop must never prevent play. */
export function loadSceneArt(): Promise<void> {
  if (pending) return pending
  if (typeof Image === "undefined") return Promise.resolve()
  pending = Promise.all(SCENE_ART.map(id => new Promise<void>(resolve => {
    const image = new Image()
    image.onload = () => {
      if (image.naturalWidth > 0 && image.naturalHeight > 0) images.set(id, image)
      resolve()
    }
    image.onerror = () => resolve()
    image.src = sceneArtUrl(id)
  }))).then(() => undefined)
  return pending
}

/** Baked artwork is tightly cropped; the base aligns to the existing physics floor. */
export function drawSceneProp(context: CanvasRenderingContext2D, id: SceneProp,
  x: number, base: number, width: number, height: number): boolean {
  const image = images.get(id)
  if (!image) return false
  context.drawImage(image, x - width / 2, base - height, width, height)
  return true
}
