import type { GamePalette, RunnerLook } from "./sprites"

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

/** Atlas-local attachment points, measured against each pose, not the fixed ground line. */
const GEAR_ANCHORS = [
  { feet: [[100, 216, 1.2], [124, 230, 0]], wrist: [151, 179] },
  { feet: [[83, 225, 1.15], [146, 221, 0]], wrist: [162, 145] },
  { feet: [[83, 211, 1.15], [138, 229, 0]], wrist: [163, 182] },
  { feet: [[95, 224, 0.65], [139, 220, 0.15]], wrist: [184, 134] },
  { feet: [[101, 215, 1.2], [128, 230, 0]], wrist: [154, 181] },
  { feet: [[86, 224, 1.15], [149, 220, 0]], wrist: [165, 145] },
  { feet: [[83, 211, 1.15], [138, 230, 0]], wrist: [161, 181] },
  { feet: [[97, 225, 0.65], [141, 220, 0.15]], wrist: [184, 143] },
  { feet: [[118, 235, 0], [145, 235, 0]], wrist: [119, 191] },
  { feet: [[118, 235, 0], [145, 235, 0]], wrist: [119, 191] },
  { feet: [[126, 231, 0.55], [139, 236, 0.45]], wrist: [132, 146] },
  { feet: [[126, 230, 0.55], [139, 235, 0.45]], wrist: [132, 145] },
  { feet: [[125, 231, 0.65], [137, 236, 0.5]], wrist: [131, 140] },
  { feet: [[104, 234, 0.2], [154, 238, 0]], wrist: [136, 152] },
  { feet: [[104, 238, 0], [150, 239, 0]], wrist: [139, 164] },
  { feet: [[122, 239, 0], [148, 239, 0]], wrist: [151, 65] },
] as const

function drawEquipment(context: CanvasRenderingContext2D, look: RunnerLook, palette: GamePalette, frame: number, scale: number) {
  if (!look.upgrades.length) return
  const attachment = GEAR_ANCHORS[frame]!
  context.save()
  context.translate(-TORI_ATLAS.pivotX * scale, -TORI_ATLAS.baseline * scale)
  context.scale(scale, scale)
  context.lineCap = "round"; context.lineJoin = "round"
  for (const [x, y, angle] of attachment.feet) {
    context.save(); context.translate(x, y); context.rotate(angle)
    if (look.upgrades.includes("grip")) {
      context.fillStyle = palette.outline
      context.fillRect(-13, -4, 31, 6)
      for (const tooth of [-10, 0, 10]) context.fillRect(tooth, 1, 6, 5)
      context.fillStyle = palette.lane; context.fillRect(-12, -5, 28, 3)
    }
    if (look.upgrades.includes("spring")) {
      context.strokeStyle = palette.outline; context.lineWidth = 7
      context.beginPath(); context.moveTo(-9, -6); context.lineTo(9, -3); context.lineTo(-8, 0); context.lineTo(10, 3); context.stroke()
      context.strokeStyle = palette.gold; context.lineWidth = 4; context.stroke()
    }
    context.restore()
  }
  if (look.upgrades.includes("economy")) {
    context.fillStyle = palette.gold; context.strokeStyle = palette.outline; context.lineWidth = 3
    context.beginPath(); context.arc(attachment.wrist[0], attachment.wrist[1], 8, 0, Math.PI * 2); context.fill(); context.stroke()
    context.fillStyle = palette.shirtDark; context.fillRect(attachment.wrist[0] - 3, attachment.wrist[1] - 4, 6, 8)
  }
  context.restore()
}

export function drawToriArt(context: CanvasRenderingContext2D, look: RunnerLook, palette?: GamePalette): boolean {
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
  if (palette) drawEquipment(context, look, palette, frame, scale)
  context.restore()
  return true
}
