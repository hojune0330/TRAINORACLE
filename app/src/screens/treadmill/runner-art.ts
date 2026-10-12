import type { RunnerLook } from "./sprites"

/** The authoring frames are 512px; the game atlas uses 256px cells (4 x 4). */
export const TORI_ATLAS = {
  url: `${import.meta.env.BASE_URL}game/characters/tori/tori-atlas-v1.webp`,
  cell: 256, columns: 4, rows: 4, pivotX: 128, baseline: 240, height: 210,
} as const

let atlas: HTMLImageElement | null = null
let pending: Promise<boolean> | null = null

/** One request per page. A missing/broken asset leaves the existing canvas runner usable. */
export function loadToriArt(): Promise<boolean> {
  if (pending) return pending
  if (typeof Image === "undefined") return Promise.resolve(false)
  pending = new Promise(resolve => {
    const image = new Image()
    image.onload = () => {
      const valid = image.naturalWidth === TORI_ATLAS.cell * TORI_ATLAS.columns
        && image.naturalHeight === TORI_ATLAS.cell * TORI_ATLAS.rows
      if (valid) atlas = image
      resolve(valid)
    }
    image.onerror = () => resolve(false)
    image.src = TORI_ATLAS.url
  })
  return pending
}

/** State selects the jump pose; run cadence never advances a jump or a paused portrait. */
export function toriFrame(look: RunnerLook): number {
  const phase = Number.isFinite(look.phase) ? look.phase : 0
  const cycle = ((phase / (Math.PI * 2)) % 1 + 1) % 1
  switch (look.pose) {
    case "run": case "dash": return Math.min(7, Math.floor(cycle * 8))
    case "jump": return 10 + (look.jumpStage ?? 1)
    case "hit": return 13
    case "fall": return 14
    case "cheer": return 15
    default: return 8
  }
}

export function drawToriArt(context: CanvasRenderingContext2D, look: RunnerLook): boolean {
  if ((look.character ?? "tori") !== "tori" || !atlas) return false
  const frame = toriFrame(look)
  const scale = 75 / TORI_ATLAS.height
  context.save()
  const squash = Math.max(0, Math.min(1, look.squash ?? 0))
  context.scale(1 + squash * 0.05, 1 - squash * 0.05)
  if (look.pose === "dash") context.transform(1, 0, -0.12, 1, 0, 0)
  if (look.pose === "hit") context.rotate(-0.15)
  if (look.pose === "tired") { context.rotate(0.12); context.globalAlpha *= 0.85 }
  context.drawImage(atlas,
    (frame % TORI_ATLAS.columns) * TORI_ATLAS.cell, Math.floor(frame / TORI_ATLAS.columns) * TORI_ATLAS.cell,
    TORI_ATLAS.cell, TORI_ATLAS.cell,
    -TORI_ATLAS.pivotX * scale, -TORI_ATLAS.baseline * scale,
    TORI_ATLAS.cell * scale, TORI_ATLAS.cell * scale)
  context.restore()
  return true
}
