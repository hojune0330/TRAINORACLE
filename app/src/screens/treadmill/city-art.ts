/**
 * 2.5D city world for the tour ("러닝 투어"). Pure canvas paths, --game-* tokens only.
 *
 * Camera: a side-scrolling view tilted down onto the ground. Depth d >= 1 maps to
 * y = horizon + (floor - horizon) / d, so lanes bunch up toward the horizon and props
 * shrink and slow down with distance. The playable lane is d = 1 (the floor line),
 * which keeps the drawing on the same geometry as the hit boxes.
 */
import type { TreadmillSurface } from "../../domain/minigame/treadmill"
import type { TourCity, TourLandmark, TourWeather } from "../../domain/minigame/tour"
import { part, roundRect } from "./sprites"
import type { GamePalette } from "./sprites"

export type CityScene = { city: TourCity; surface: TreadmillSurface; weather: TourWeather }
export type CityFrame = {
  width: number; height: number; floor: number; left: number; beltWidth: number
  travel: number; clock: number; reduced: boolean; low: boolean; skyFromShader: boolean
}

export function citySceneFor(city: TourCity, surface: TreadmillSurface): CityScene {
  const index = surface === "track" ? 0 : surface === "mud" ? 1 : 2
  return { city, surface, weather: city.weather[index]! }
}

const night = (scene: CityScene) => scene.surface === "spikes"
const dusk = (scene: CityScene) => scene.surface === "mud"
const wrap = (value: number, span: number) => ((value % span) + span) % span

/** Horizon for the tilted camera. */
export function cityHorizon(floor: number) {
  return Math.round(floor * 0.56)
}

/** Background: sky (unless a shader draws it), sun or moon, skyline with the landmark. */
export function drawCityBackdrop(context: CanvasRenderingContext2D, palette: GamePalette, scene: CityScene, frame: CityFrame) {
  const { width, floor, travel, clock, reduced, skyFromShader } = frame
  const horizon = cityHorizon(floor)
  context.clearRect(0, 0, width, frame.height)
  if (!skyFromShader) {
    const sky = context.createLinearGradient(0, 0, 0, horizon)
    if (night(scene)) { sky.addColorStop(0, palette.cityNight); sky.addColorStop(1, palette.spikeSkyTop) }
    else if (dusk(scene)) { sky.addColorStop(0, palette.mudSkyTop); sky.addColorStop(1, palette.mudSkyLow) }
    else if (scene.weather === "rain" || scene.weather === "snow") { sky.addColorStop(0, palette.cityFar); sky.addColorStop(1, palette.rain) }
    else { sky.addColorStop(0, palette.skyTop); sky.addColorStop(1, palette.skyLow) }
    context.fillStyle = sky; context.fillRect(0, 0, width, horizon + 2)
    if (night(scene)) {
      context.fillStyle = palette.cloud
      for (let i = 0; i < 30; i++) {
        context.globalAlpha = reduced ? 0.6 : 0.3 + 0.5 * Math.abs(Math.sin(clock * 1.3 + i * 1.7))
        context.fillRect((i * 89) % width, (i * 41) % Math.max(1, horizon * 0.7), 2, 2)
      }
      context.globalAlpha = 1
    }
  }
  // Sun / moon.
  const bodyX = width * 0.82, bodyY = dusk(scene) ? horizon * 0.62 : horizon * 0.26
  const r = dusk(scene) ? 26 : night(scene) ? 15 : 20
  const halo = context.createRadialGradient(bodyX, bodyY, r * 0.6, bodyX, bodyY, r * 3.2)
  halo.addColorStop(0, night(scene) ? palette.skyLow : palette.gold); halo.addColorStop(1, "transparent")
  context.globalAlpha = scene.weather === "rain" ? 0.15 : 0.35; context.fillStyle = halo
  context.fillRect(bodyX - r * 3.2, bodyY - r * 3.2, r * 6.4, r * 6.4); context.globalAlpha = 1
  if (scene.weather !== "rain" || night(scene)) {
    context.beginPath(); context.arc(bodyX, bodyY, r, 0, Math.PI * 2)
    context.fillStyle = night(scene) ? palette.skyLow : dusk(scene) ? palette.heat : palette.gold; context.fill()
    if (night(scene)) { context.beginPath(); context.arc(bodyX + 6, bodyY - 4, r - 2, 0, Math.PI * 2); context.fillStyle = palette.cityNight; context.fill() }
  }

  // Far skyline, then the landmark, then a nearer skyline: three parallax layers.
  skyline(context, palette, scene, width, horizon, travel * 0.05, 0.55, 7, clock, reduced)
  const landmarkX = width * 0.62 - wrap(travel * 0.02, width * 0.4)
  landmark(context, palette, scene, scene.city.landmark, landmarkX, horizon, Math.min(1.25, Math.max(0.8, width / 380)))
  skyline(context, palette, scene, width, horizon, travel * 0.12, 0.85, 3, clock, reduced)
  if (scene.weather === "sea") sea(context, palette, scene, width, horizon, travel, clock, reduced)
}

function skyline(context: CanvasRenderingContext2D, palette: GamePalette, scene: CityScene, width: number, horizon: number,
  offset: number, depth: number, seed: number, clock: number, reduced: boolean) {
  const lit = night(scene) || dusk(scene)
  const far = depth < 0.7
  const body = night(scene) ? (far ? palette.spikeHillFar : palette.cityNight) : dusk(scene) ? (far ? palette.mudHillFar : palette.mudHillNear) : far ? palette.cityFar : palette.cityNear
  const span = width + 160
  const count = Math.ceil(span / 34) + 1
  context.save()
  if (far) context.globalAlpha = 0.85
  for (let i = 0; i < count; i++) {
    const n = (i * 37 + seed * 13) % 17
    const w = 22 + (n % 4) * 8
    const h = (far ? 26 : 16) + ((n * 7 + seed) % 9) * (far ? 7 : 5)
    const x = wrap(i * 34 - offset, span) - 80
    const base = horizon + (far ? 0 : 2)
    context.fillStyle = body
    context.fillRect(x, base - h, w, h + 2)
    if (n % 5 === 0) context.fillRect(x + w / 2 - 1, base - h - 8, 2, 8)
    if (lit) {
      context.fillStyle = palette.window
      for (let wy = base - h + 5; wy < base - 4; wy += 7) for (let wx = x + 4; wx < x + w - 4; wx += 6) {
        const on = ((wx * 7 + wy * 3 + seed) | 0) % 5 < (night(scene) ? 2 : 1)
        if (!on) continue
        context.globalAlpha = (far ? 0.55 : 0.85) * (reduced ? 1 : 0.8 + 0.2 * Math.sin(clock * 2 + wx))
        context.fillRect(wx, wy, 2.5, 3)
      }
      context.globalAlpha = far ? 0.85 : 1
    }
  }
  context.restore()
}

/** Simple, recognisable silhouettes. Not logos or copies of any artwork. */
function landmark(context: CanvasRenderingContext2D, palette: GamePalette, scene: CityScene, kind: TourLandmark, x: number, base: number, s: number) {
  const n = night(scene)
  const body = n ? palette.cityNight : dusk(scene) ? palette.mudHillNear : palette.cityNear
  const accent = kind === "tokyoTower" ? palette.danger : n ? palette.window : palette.cloud
  context.save()
  context.translate(x, base); context.scale(s, s)
  context.fillStyle = body; context.strokeStyle = palette.outline; context.lineWidth = 1.5; context.lineJoin = "round"
  const glow = (gx: number, gy: number, r: number) => {
    if (!n) return
    const g = context.createRadialGradient(gx, gy, 0, gx, gy, r)
    g.addColorStop(0, palette.window); g.addColorStop(1, "transparent")
    context.save(); context.globalAlpha = 0.5; context.fillStyle = g; context.fillRect(gx - r, gy - r, r * 2, r * 2); context.restore()
  }
  if (kind === "namsan" || kind === "tower83") {
    if (kind === "namsan") { context.beginPath(); context.moveTo(-70, 0); context.quadraticCurveTo(0, -60, 70, 0); context.closePath(); context.fillStyle = n ? palette.spikeHillNear : dusk(scene) ? palette.mudHillNear : palette.hillNear; context.fill() }
    const top = kind === "namsan" ? -132 : -112, foot = kind === "namsan" ? -40 : 0
    context.fillStyle = body
    context.beginPath(); context.moveTo(-4, foot); context.lineTo(-2.5, top + 26); context.lineTo(2.5, top + 26); context.lineTo(4, foot); context.closePath(); context.fill(); context.stroke()
    roundRect(context, -11, top + 14, 22, 12, 5); context.fill(); context.stroke()
    context.fillStyle = accent; context.fillRect(-8, top + 18, 16, 3)
    context.fillStyle = body; context.fillRect(-1, top - 6, 2, 20)
    glow(0, top + 20, 30)
  } else if (kind === "hanbit") {
    context.beginPath(); context.moveTo(-10, 0); context.lineTo(0, -120); context.lineTo(10, 0); context.closePath(); context.fill(); context.stroke()
    context.beginPath(); context.arc(0, -96, 9, 0, Math.PI * 2); context.fillStyle = n ? palette.window : palette.gold; context.fill(); context.stroke()
    context.beginPath(); context.ellipse(0, -96, 15, 4, -0.3, 0, Math.PI * 2); context.stroke()
    glow(0, -96, 28)
  } else if (kind === "gwangan") {
    context.lineWidth = 2
    context.fillStyle = body; context.fillRect(-140, -16, 280, 5)
    for (const px of [-60, 60]) { context.fillRect(px - 3, -62, 6, 62) }
    context.strokeStyle = n ? palette.neonBlue : body
    context.beginPath(); context.moveTo(-140, -14); context.quadraticCurveTo(-100, -20, -60, -60); context.quadraticCurveTo(0, -12, 60, -60); context.quadraticCurveTo(100, -20, 140, -14); context.stroke()
    if (n) { context.fillStyle = palette.neonPink; for (let i = -130; i <= 130; i += 14) context.fillRect(i, -12, 3, 2) }
  } else if (kind === "tokyoTower" || kind === "eiffel") {
    const h = kind === "eiffel" ? 140 : 130, w = kind === "eiffel" ? 34 : 28
    context.fillStyle = kind === "tokyoTower" && !n ? palette.danger : body
    context.beginPath(); context.moveTo(-w, 0)
    context.quadraticCurveTo(-w * 0.35, -h * 0.35, -2, -h); context.lineTo(2, -h); context.quadraticCurveTo(w * 0.35, -h * 0.35, w, 0)
    context.lineTo(w * 0.55, 0); context.quadraticCurveTo(0, -h * 0.22, -w * 0.55, 0); context.closePath(); context.fill(); context.stroke()
    context.strokeStyle = kind === "tokyoTower" ? palette.cloud : palette.outline; context.lineWidth = 1
    for (const t of [0.3, 0.55, 0.75]) { const y = -h * t, half = w * (1 - t) * 0.75; context.beginPath(); context.moveTo(-half, y); context.lineTo(half, y); context.stroke() }
    context.fillStyle = body; roundRect(context, -w * 0.5, -h * 0.3, w, 4, 1); context.fill()
    if (n) { context.fillStyle = palette.window; for (let i = 0; i < 12; i++) { const t = i / 12; context.fillRect(-1, -h * t - 2, 2, 2) } }
    glow(0, -h * 0.6, 34)
  } else if (kind === "osakaCastle") {
    context.fillStyle = n ? palette.cityNight : palette.cityNear
    context.fillRect(-36, -20, 72, 20)
    const roof = (y: number, w: number) => { context.beginPath(); context.moveTo(-w - 6, y); context.lineTo(-w + 6, y - 9); context.lineTo(w - 6, y - 9); context.lineTo(w + 6, y); context.closePath(); context.fillStyle = palette.good; context.fill(); context.stroke() }
    context.fillStyle = palette.cloud; context.fillRect(-26, -44, 52, 24); roof(-20, 30)
    context.fillStyle = palette.cloud; context.fillRect(-18, -64, 36, 20); roof(-44, 22)
    context.fillStyle = palette.cloud; context.fillRect(-11, -80, 22, 16); roof(-64, 15)
    roof(-80, 9); context.fillStyle = palette.gold; context.fillRect(-2, -94, 4, 5)
    glow(0, -60, 40)
  } else if (kind === "bigBen") {
    context.fillRect(-12, -120, 24, 120); context.strokeRect(-12, -120, 24, 120)
    context.beginPath(); context.moveTo(-14, -120); context.lineTo(0, -150); context.lineTo(14, -120); context.closePath(); context.fill(); context.stroke()
    context.beginPath(); context.arc(0, -100, 8, 0, Math.PI * 2); context.fillStyle = n ? palette.window : palette.cloud; context.fill(); context.stroke()
    context.strokeStyle = palette.outline; context.beginPath(); context.moveTo(0, -100); context.lineTo(0, -105); context.moveTo(0, -100); context.lineTo(4, -100); context.stroke()
    context.fillStyle = body; context.fillRect(-60, -40, 48, 40); context.fillRect(12, -40, 60, 40)
    glow(0, -100, 26)
  }
  context.restore()
}

function sea(context: CanvasRenderingContext2D, palette: GamePalette, scene: CityScene, width: number, horizon: number, travel: number, clock: number, reduced: boolean) {
  context.fillStyle = night(scene) ? palette.cityNight : palette.sea
  context.fillRect(0, horizon, width, 14)
  context.strokeStyle = night(scene) ? palette.neonBlue : palette.seaLight; context.lineWidth = 1.5
  for (let row = 0; row < 3; row++) {
    const y = horizon + 3 + row * 4
    context.globalAlpha = 0.7 - row * 0.15
    context.beginPath()
    for (let x = -20; x < width + 20; x += 18) {
      const sx = x - wrap(travel * (0.08 + row * 0.03) + (reduced ? 0 : clock * 6), 18)
      context.moveTo(sx, y); context.quadraticCurveTo(sx + 4, y - 2, sx + 8, y)
    }
    context.stroke()
  }
  context.globalAlpha = 1
}

/** Tilted ground: field / beach / plaza, a running track receding into depth, scrolling cross lines and props. */
export function drawCityGround(context: CanvasRenderingContext2D, palette: GamePalette, scene: CityScene, frame: CityFrame, warnRear: number, near: number) {
  const { width, height, floor, left, beltWidth, travel, low } = frame
  const horizon = cityHorizon(floor) + (scene.weather === "sea" ? 14 : 0)
  const depthY = (d: number) => horizon + (floor - horizon) / d
  const right = left + beltWidth
  const vpX = width * 0.5

  // Ground plane.
  const field = night(scene) ? palette.spikeHillNear : scene.weather === "sea" ? palette.sand : dusk(scene) ? palette.mudHillNear : palette.hillNear
  const stripe = night(scene) ? palette.spikeHillFar : scene.weather === "sea" ? palette.mudSkyLow : dusk(scene) ? palette.mudHillFar : palette.grassStripe
  context.fillStyle = field; context.fillRect(0, horizon, width, height - horizon)
  for (let d = 9; d > 1.5; d -= 1) {
    if (Math.floor(d) % 2) continue
    context.fillStyle = stripe; context.globalAlpha = 0.5
    context.fillRect(0, depthY(d + 1), width, depthY(d) - depthY(d + 1))
  }
  context.globalAlpha = 1

  // Depth props: far ones first so near ones overlap them.
  const props = low ? 6 : 11
  for (let i = props; i >= 0; i--) {
    const d = 1.75 + (i % 4) * 0.9 + (i > 6 ? 2.5 : 0)
    const span = width + 120
    const x = wrap(i * 97 - travel / d, span) - 60
    const y = depthY(d)
    const s = 1 / d * 1.6
    context.save(); context.translate(x, y); context.scale(s, s)
    prop(context, palette, scene, i)
    context.restore()
  }

  // Running track band: lanes from d = 1 (playable) to d = 1.55.
  const top = depthY(1.55)
  const track = context.createLinearGradient(0, top, 0, floor + 14)
  track.addColorStop(0, palette.laneRedDark); track.addColorStop(1, palette.laneRed)
  context.fillStyle = scene.surface === "mud" && scene.weather === "sea" ? palette.sand : track
  context.fillRect(0, top, width, floor + 14 - top)
  context.strokeStyle = palette.cloud; context.lineWidth = 1.5
  for (const d of [1.12, 1.26, 1.4, 1.55]) { context.globalAlpha = 0.8; context.beginPath(); context.moveTo(0, depthY(d)); context.lineTo(width, depthY(d)); context.stroke() }
  context.globalAlpha = 1
  // Cross lines converge toward the vanishing point and scroll with the course: the 2.5D cue.
  context.save(); context.beginPath(); context.rect(0, top, width, floor + 14 - top); context.clip()
  context.strokeStyle = palette.cloud; context.globalAlpha = 0.35; context.lineWidth = 2
  for (let x = -60 - wrap(travel * 1.6, 70); x < width + 70; x += 70) {
    const farX = vpX + (x - vpX) / 1.55
    context.beginPath(); context.moveTo(x, floor + 14); context.lineTo(farX, top); context.stroke()
  }
  context.restore()
  // Weathered surface on slow-ground stages.
  if (scene.surface === "mud") {
    context.fillStyle = scene.weather === "rain" ? palette.rain : scene.weather === "petals" ? palette.petal : scene.weather === "sea" ? palette.mudLight : palette.heat
    context.globalAlpha = 0.45
    for (let x = left - wrap(travel * 1.6, 46); x < right + 46; x += 46) { context.beginPath(); context.ellipse(x + 20, floor + 3, 16, 3.5, 0, 0, Math.PI * 2); context.fill() }
    context.globalAlpha = 1
  }

  // Near curb and foreground.
  part(context, palette, palette.rail, -4, floor + 10, width + 8, 7, 3)
  context.fillStyle = field; context.fillRect(0, floor + 17, width, height - floor - 17)
  context.fillStyle = palette.outline; context.globalAlpha = 0.18; context.fillRect(0, floor + 17, width, 4); context.globalAlpha = 1

  // The rear edge: the course drops away behind the start (same rule as the treadmill pit).
  const pit = context.createLinearGradient(0, floor - 4, 0, height)
  pit.addColorStop(0, palette.beltDark); pit.addColorStop(1, palette.outline)
  context.fillStyle = pit
  context.beginPath(); context.moveTo(0, top); context.lineTo(left - 4, top); context.lineTo(left - 2, floor + 17); context.lineTo(left - 10, height); context.lineTo(0, height); context.fill()
  const warn = left + warnRear * beltWidth
  context.save(); context.beginPath(); context.rect(left, floor - 1, warn - left, 11); context.clip()
  for (let x = left - 20; x < warn + 20; x += 12) {
    context.fillStyle = palette.danger
    context.beginPath(); context.moveTo(x, floor + 10); context.lineTo(x + 6, floor + 10); context.lineTo(x + 14, floor - 1); context.lineTo(x + 8, floor - 1); context.fill()
  }
  context.restore()
  if (near > 0) {
    context.fillStyle = palette.danger
    for (let i = 0; i < 8; i++) { context.globalAlpha = near * 0.42 * (1 - i / 8); context.fillRect((warn * i) / 8, 0, warn / 8 + 1, floor + 8) }
    context.globalAlpha = 1
  }
}

function prop(context: CanvasRenderingContext2D, palette: GamePalette, scene: CityScene, i: number) {
  context.lineWidth = 2; context.strokeStyle = palette.outline; context.lineJoin = "round"
  const n = night(scene)
  const kind = scene.weather === "sea" ? (i % 3 === 0 ? "palm" : i % 3 === 1 ? "umbrella" : "lamp")
    : n ? (i % 3 === 0 ? "neon" : "lamp")
      : scene.surface === "track" ? (i % 4 === 0 ? "stand" : i % 4 === 1 ? "flag" : "tree")
        : i % 2 ? "tree" : "lamp"
  if (kind === "tree") {
    roundRect(context, -3, -20, 6, 20, 2); context.fillStyle = palette.mud; context.fill(); context.stroke()
    const leaf = scene.weather === "petals" ? palette.petal : dusk(scene) ? palette.mudHillFar : palette.hillNear
    context.beginPath(); context.arc(0, -30, 14, 0, Math.PI * 2); context.fillStyle = leaf; context.fill(); context.stroke()
    context.beginPath(); context.arc(-4, -34, 5, 0, Math.PI * 2); context.fillStyle = palette.cloud; context.globalAlpha = 0.3; context.fill(); context.globalAlpha = 1
  } else if (kind === "lamp") {
    context.fillStyle = palette.belt; context.fillRect(-1.5, -46, 3, 46)
    roundRect(context, -6, -50, 12, 6, 3); context.fill(); context.stroke()
    if (n || dusk(scene)) {
      const g = context.createRadialGradient(0, -44, 0, 0, -44, 26)
      g.addColorStop(0, palette.window); g.addColorStop(1, "transparent")
      context.globalAlpha = n ? 0.7 : 0.35; context.fillStyle = g; context.fillRect(-26, -70, 52, 52); context.globalAlpha = 1
    }
  } else if (kind === "neon") {
    roundRect(context, -16, -54, 32, 18, 4); context.fillStyle = palette.cityNight; context.fill()
    context.strokeStyle = i % 2 ? palette.neonPink : palette.neonBlue; context.lineWidth = 3; context.stroke()
    context.fillStyle = context.strokeStyle; context.fillRect(-9, -47, 18, 3)
    context.strokeStyle = palette.outline; context.lineWidth = 2
    context.fillStyle = palette.belt; context.fillRect(-1.5, -36, 3, 36)
  } else if (kind === "stand") {
    // Stadium bleachers with a crowd.
    for (let row = 0; row < 3; row++) { context.fillStyle = row % 2 ? palette.rail : palette.panelEdge; context.fillRect(-40, -12 - row * 10, 80, 10) }
    const crowd = [palette.danger, palette.gold, palette.shorts, palette.shirt, palette.hanaShirt, palette.cloud]
    for (let row = 0; row < 3; row++) for (let c = 0; c < 9; c++) {
      context.fillStyle = crowd[(c + row * 2 + i) % crowd.length]!
      context.beginPath(); context.arc(-36 + c * 9, -16 - row * 10, 3, 0, Math.PI * 2); context.fill()
    }
    context.strokeRect(-40, -42, 80, 42)
  } else if (kind === "flag") {
    context.beginPath(); context.moveTo(0, 0); context.lineTo(0, -44); context.stroke()
    context.beginPath(); context.moveTo(0, -44); context.lineTo(18, -38); context.lineTo(0, -32); context.closePath()
    context.fillStyle = i % 2 ? palette.danger : palette.gold; context.fill(); context.stroke()
  } else if (kind === "palm") {
    context.strokeStyle = palette.mud; context.lineWidth = 4
    context.beginPath(); context.moveTo(0, 0); context.quadraticCurveTo(4, -24, 0, -46); context.stroke()
    context.fillStyle = palette.hillNear; context.strokeStyle = palette.outline; context.lineWidth = 1.5
    for (const a of [-2.6, -1.9, -1.2, -0.5]) {
      context.beginPath(); context.ellipse(Math.cos(a) * 12, -46 + Math.sin(a) * 6, 14, 4, a + Math.PI / 2 * 0.2, 0, Math.PI * 2); context.fill(); context.stroke()
    }
  } else {
    context.fillStyle = palette.belt; context.fillRect(-1, -34, 2, 34)
    context.beginPath(); context.moveTo(-22, -30); context.quadraticCurveTo(0, -48, 22, -30); context.closePath()
    context.fillStyle = i % 2 ? palette.danger : palette.gold; context.fill(); context.stroke()
  }
}

type Flake = { x: number; y: number; v: number; w: number; s: number }
/** Weather drawn above everything except the HUD. Deterministic from the clock, so no state is kept. */
export function drawWeather(context: CanvasRenderingContext2D, palette: GamePalette, scene: CityScene, frame: CityFrame) {
  const { width, height, clock, reduced, low } = frame
  const kind = scene.weather
  if (kind === "clear") return
  if (kind === "heat") {
    if (reduced) return
    context.save(); context.globalAlpha = 0.08; context.fillStyle = palette.heat
    for (let i = 0; i < 4; i++) { const y = frame.floor - 30 - i * 26 + Math.sin(clock * 3 + i) * 3; context.fillRect(0, y, width, 6) }
    context.restore(); return
  }
  if (kind === "sea") {
    if (reduced || low) return
    context.save(); context.fillStyle = palette.cloud; context.globalAlpha = 0.6
    for (let i = 0; i < 6; i++) { const t = (clock * 0.4 + i / 6) % 1; context.beginPath(); context.arc(wrap(i * 140 - clock * 30, width + 40) - 20, 30 + Math.sin(t * 6) * 8 + i * 6, 1.6, 0, Math.PI * 2); context.fill() }
    context.restore(); return
  }
  const total = low ? 18 : kind === "rain" ? 70 : 40
  const speed = kind === "rain" ? 520 : kind === "snow" ? 50 : 70
  const t = reduced ? 0 : clock
  context.save()
  for (let i = 0; i < total; i++) {
    const seed = (i * 9301 + 49297) % 233280 / 233280
    const flake: Flake = { x: seed * (width + 60), y: ((i * 37) % 97) / 97 * height, v: speed * (0.7 + seed * 0.6), w: 0.5 + seed, s: 2 + seed * 2.5 }
    const y = wrap(flake.y + t * flake.v, height + 20) - 10
    const sway = kind === "rain" ? -t * 60 * flake.w : Math.sin(t * 1.5 + i) * 14
    const x = wrap(flake.x + sway, width + 60) - 30
    if (kind === "rain") {
      context.strokeStyle = palette.rain; context.globalAlpha = 0.55; context.lineWidth = 1.4
      context.beginPath(); context.moveTo(x, y); context.lineTo(x - 3, y + 11); context.stroke()
    } else if (kind === "snow") {
      context.fillStyle = palette.snow; context.globalAlpha = 0.85
      context.beginPath(); context.arc(x, y, flake.s * 0.7, 0, Math.PI * 2); context.fill()
    } else {
      context.fillStyle = palette.petal; context.globalAlpha = 0.9
      context.save(); context.translate(x, y); context.rotate(t * 2 + i); context.beginPath(); context.ellipse(0, 0, flake.s, flake.s * 0.55, 0, 0, Math.PI * 2); context.fill(); context.restore()
    }
  }
  context.restore()
}
