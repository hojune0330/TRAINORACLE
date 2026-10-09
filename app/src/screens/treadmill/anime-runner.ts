/**
 * SD anime runners for the tour (owner request 2026-10-09: "제대로 만들거나 레퍼런스 제대로 가져와").
 *
 * Motion reference: Eadweard Muybridge, *Animal Locomotion* (1887) Plate 65 "Running full speed",
 * top row (side view, 8 frames), public domain via Wikimedia Commons / Boston Public Library:
 * https://commons.wikimedia.org/wiki/File:Animal_locomotion._Plate_65_(Boston_Public_Library).jpg
 * Frames 1–7 were keyed by hand as joint angles (frame 8 mirrors frame 1), then mirrored for the second
 * step: a 14-key cycle with contact → midstance → toe-off → float → reach. No pixels were traced or copied.
 *
 * Proportions: SD (super-deformed) runner, ~2.9 heads tall, the readable range for a 64–80 px sprite
 * (normal anime is 7–8 heads; SD puts a third of the height in the head — see Wikipedia "Super deformed").
 * Style: 3/4 face turned to the run direction, big eyes in the lower half of the face with two highlights,
 * clumped hair that streams back with speed, flat cel shading (far limbs one tone darker), thin dark outline.
 * Everyone shares one skeleton, so height and hit box never change. Origin at the feet, -y is up.
 */
import type { TreadmillUpgrade } from "../../domain/minigame/treadmill"
import type { GamePalette, RunnerCharacter, RunnerPose } from "./sprites"

type Look = { pose: RunnerPose; phase: number; upgrades: readonly TreadmillUpgrade[]; squash?: number; character?: RunnerCharacter }
type Leg = { t: number; k: number; p: number }
type Arm = { s: number; e: number }
type Pose = { far: Leg; near: Leg; farArm: Arm; nearArm: Arm; lean: number; lift: number; flow: number; face: Face }
type Face = "smile" | "focus" | "intense" | "open" | "hurt" | "shock" | "tired" | "joy"

const RIG = { scale: 0.68, thigh: 19, shin: 18, upperArm: 12.5, foreArm: 11.5, torso: 23 }
const D = Math.PI / 180

/* Muybridge Plate 65, frames 1–7. t: thigh from vertical (+ forward), k: knee flex, p: toes-down from flat. */
const STEP: readonly { a: Leg; b: Leg; lift: number }[] = [
  { a: { t: 25, k: 15, p: 5 }, b: { t: -20, k: 100, p: 40 }, lift: 0 },
  { a: { t: 0, k: 22, p: 0 }, b: { t: 10, k: 115, p: 45 }, lift: 0 },
  { a: { t: -15, k: 15, p: 0 }, b: { t: 45, k: 100, p: 40 }, lift: 0 },
  { a: { t: -30, k: 8, p: 35 }, b: { t: 62, k: 80, p: 25 }, lift: 0.5 },
  { a: { t: -35, k: 35, p: 45 }, b: { t: 48, k: 50, p: 15 }, lift: 2.5 },
  { a: { t: -28, k: 65, p: 45 }, b: { t: 36, k: 22, p: 5 }, lift: 3 },
  { a: { t: -20, k: 92, p: 45 }, b: { t: 30, k: 12, p: 5 }, lift: 1.5 },
]
/** 14 keys: the step, then the same step with legs swapped. Index i: [far leg, near leg, lift]. */
const CYCLE = [...STEP.map(key => [key.a, key.b, key.lift] as const), ...STEP.map(key => [key.b, key.a, key.lift] as const)]

const mix = (a: number, b: number, f: number) => a + (b - a) * f
const mixLeg = (a: Leg, b: Leg, f: number): Leg => ({ t: mix(a.t, b.t, f), k: mix(a.k, b.k, f), p: mix(a.p, b.p, f) })
/** Arms swing against the leg on the same side; elbows bend more when the arm is in front. */
const armFor = (leg: Leg, gain: number): Arm => { const s = -leg.t * 1.05 * gain; return { s, e: 80 + Math.max(0, s) * 0.35 } }

function runPose(phase: number, dash: boolean): Pose {
  const u = ((phase / (Math.PI * 2)) % 1 + 1) % 1 * CYCLE.length
  const i = Math.floor(u), f = (1 - Math.cos((u - i) * Math.PI)) / 2
  const [farA, nearA, liftA] = CYCLE[i]!, [farB, nearB, liftB] = CYCLE[(i + 1) % CYCLE.length]!
  const gain = dash ? 1.15 : 1
  const scaleLeg = (leg: Leg): Leg => ({ t: leg.t * gain, k: leg.k, p: leg.p })
  const far = scaleLeg(mixLeg(farA, farB, f)), near = scaleLeg(mixLeg(nearA, nearB, f))
  return { far, near, farArm: armFor(far, gain), nearArm: armFor(near, gain), lean: dash ? 18 : 10, lift: mix(liftA, liftB, f), flow: dash ? 1.3 : 1, face: dash ? "intense" : "focus" }
}

const STILL: Record<Exclude<RunnerPose, "run" | "dash">, Pose> = {
  idle: { far: { t: -4, k: 4, p: 0 }, near: { t: 6, k: 6, p: 0 }, farArm: { s: -6, e: 25 }, nearArm: { s: 8, e: 30 }, lean: 0, lift: 0, flow: 0.1, face: "smile" },
  jump: { far: { t: 30, k: 95, p: 30 }, near: { t: 70, k: 110, p: 20 }, farArm: { s: -50, e: 60 }, nearArm: { s: 125, e: 40 }, lean: 6, lift: 0, flow: 0.7, face: "open" },
  fall: { far: { t: -10, k: 20, p: 20 }, near: { t: 22, k: 30, p: 20 }, farArm: { s: 160, e: 25 }, nearArm: { s: 150, e: 20 }, lean: -14, lift: 0, flow: -0.8, face: "shock" },
  hit: { far: { t: 15, k: 20, p: 10 }, near: { t: 35, k: 45, p: 15 }, farArm: { s: -95, e: 25 }, nearArm: { s: -65, e: 30 }, lean: -16, lift: 0, flow: -0.6, face: "hurt" },
  tired: { far: { t: -5, k: 25, p: 0 }, near: { t: 12, k: 30, p: 0 }, farArm: { s: 8, e: 15 }, nearArm: { s: 18, e: 20 }, lean: 22, lift: 0, flow: 0.1, face: "tired" },
  // Side-view fist pump at chest height: readable, and never across the face.
  cheer: { far: { t: -6, k: 4, p: 0 }, near: { t: 8, k: 6, p: 0 }, farArm: { s: -35, e: 45 }, nearArm: { s: 60, e: 70 }, lean: -4, lift: 0, flow: 0.2, face: "joy" },
}

type Kit = {
  hair: string; hairShade: string; skin: string; skinShade: string; top: string; topShade: string; trim: string
  bottom: string; bottomShade: string; shoe: string; shoeShade: string; sole: string; sock: string; iris: string
}
function kitFor(c: GamePalette, character: RunnerCharacter): Kit {
  const base = { skin: c.skin, skinShade: c.skinShade, sock: c.cloud, sole: c.outline, bottomShade: c.outline, shoeShade: c.rail }
  switch (character) {
    case "hana": return { ...base, hair: c.hairHana, hairShade: c.mud, top: c.hanaShirt, topShade: c.hanaShirtDark, trim: c.cloud, bottom: c.outline, shoe: c.cloud, sole: c.hanaShirtDark, iris: c.hanaShirtDark }
    case "dandan": return { ...base, hair: c.bear, hairShade: c.mud, top: c.gold, topShade: c.goldDark, trim: c.shorts, bottom: c.shorts, bottomShade: c.shirtDark, shoe: c.danger, shoeShade: c.dangerDark, iris: c.mud }
    case "nabi": return { ...base, hair: c.cat, hairShade: c.heat, top: c.shorts, topShade: c.outline, trim: c.cat, bottom: c.outline, shoe: c.danger, shoeShade: c.dangerDark, sole: c.cloud, iris: c.good }
    case "r01": return { ...base, skin: c.robotLight, skinShade: c.robot, hair: c.hairSilver, hairShade: c.hairShine, top: c.robot, topShade: c.belt, trim: c.robotEye, bottom: c.belt, bottomShade: c.beltDark, shoe: c.robotEye, shoeShade: c.good, sole: c.belt, iris: c.robotEye }
    case "pengu": return { ...base, hair: c.hair, hairShade: c.outline, top: c.penguin, topShade: c.outline, trim: c.beak, bottom: c.penguin, shoe: c.beak, shoeShade: c.goldDark, sole: c.goldDark, iris: c.sea }
    default: return { ...base, hair: c.hair, hairShade: c.outline, top: c.shirt, topShade: c.shirtDark, trim: c.cloud, bottom: c.shorts, bottomShade: c.shirtDark, shoe: c.cloud, sole: c.lane, iris: c.shorts }
  }
}

type P = { x: number; y: number }
const at = (o: P, angleDeg: number, length: number): P => ({ x: o.x + Math.sin(angleDeg * D) * length, y: o.y + Math.cos(angleDeg * D) * length })

function legJoints(hip: P, leg: Leg) {
  const knee = at(hip, leg.t, RIG.thigh)
  const ankle = at(knee, leg.t - leg.k, RIG.shin)
  const foot = 90 - leg.p
  // Sole points (heel and toe) for ground contact.
  const dir = { x: Math.sin(foot * D), y: Math.cos(foot * D) }, down = { x: -dir.y, y: dir.x }
  const heel = { x: ankle.x - dir.x * 4 + down.x * 3.5, y: ankle.y - dir.y * 4 + down.y * 3.5 }
  const toe = { x: ankle.x + dir.x * 9 + down.x * 3.5, y: ankle.y + dir.y * 9 + down.y * 3.5 }
  return { knee, ankle, foot, lowest: Math.max(heel.y, toe.y) }
}

export function drawAnimeRunner(ctx: CanvasRenderingContext2D, c: GamePalette, look: Look) {
  const character = look.character ?? "tori"
  const k = kitFor(c, character)
  const pose = look.pose === "run" || look.pose === "dash" ? runPose(look.phase, look.pose === "dash") : STILL[look.pose]
  const springs = look.upgrades.includes("spring"), grip = look.upgrades.includes("grip"), band = look.upgrades.includes("economy")
  const squash = look.squash ?? 0
  ctx.save()
  ctx.lineJoin = "round"; ctx.lineCap = "round"; ctx.strokeStyle = c.outline
  ctx.scale((1 + squash * 0.16) * RIG.scale, (1 - squash * 0.18) * RIG.scale)
  if (springs) ctx.translate(0, -6)

  // Place the hips so the lowest sole touches y = 0, plus the float lift between steps.
  const probe = { x: 0, y: 0 }
  const reach = Math.max(legJoints(probe, pose.far).lowest, legJoints(probe, pose.near).lowest)
  const hip: P = { x: 0, y: -reach - pose.lift }
  const lean = pose.lean * D
  const OUT = 2.8

  const limb = (points: readonly P[], widths: readonly number[], fill: string) => {
    for (const pass of [0, 1]) {
      ctx.strokeStyle = pass === 0 ? c.outline : fill
      for (let i = 0; i < points.length - 1; i++) {
        ctx.lineWidth = widths[i]! + (pass === 0 ? OUT : 0)
        ctx.beginPath(); ctx.moveTo(points[i]!.x, points[i]!.y); ctx.lineTo(points[i + 1]!.x, points[i + 1]!.y); ctx.stroke()
      }
    }
    ctx.strokeStyle = c.outline
  }

  const drawLeg = (leg: Leg, far: boolean) => {
    const { knee, ankle, foot } = legJoints(hip, leg)
    const skin = far ? k.skinShade : k.skin
    limb([hip, knee, ankle], [8, 6.4], skin)
    // Shorts over the top of the thigh, sock over the bottom of the shin.
    const shortEnd = at(hip, leg.t, 8.5)
    limb([hip, shortEnd], [10.5], far ? k.bottomShade : k.bottom)
    const sockTop = at(knee, leg.t - leg.k, RIG.shin - 5)
    limb([sockTop, ankle], [6.6], far ? c.rail : k.sock)
    drawShoe(ankle, foot, far)
  }

  const drawShoe = (ankle: P, foot: number, far: boolean) => {
    ctx.save(); ctx.translate(ankle.x, ankle.y); ctx.rotate(Math.atan2(Math.cos(foot * D), Math.sin(foot * D)))
    ctx.beginPath()
    ctx.moveTo(-4.5, -2.5); ctx.quadraticCurveTo(-5.5, 3.5, -2, 3.5); ctx.lineTo(8.5, 3.5)
    ctx.quadraticCurveTo(11.5, 3, 10.5, 0.5); ctx.quadraticCurveTo(8, -2, 3.5, -3.5); ctx.closePath()
    ctx.lineWidth = OUT; ctx.stroke(); ctx.fillStyle = grip ? c.lane : far ? k.shoeShade : k.shoe; ctx.fill()
    ctx.fillStyle = k.sole; ctx.fillRect(-4.5, 2.2, 15, 1.6)
    ctx.strokeStyle = far ? c.outline : k.sole; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, -1.5); ctx.lineTo(4, 1); ctx.stroke(); ctx.strokeStyle = c.outline
    if (grip) { ctx.fillStyle = c.outline; for (const x of [-2, 2, 6]) ctx.fillRect(x, 3.8, 1.6, 1.6) }
    if (springs) { ctx.strokeStyle = c.goldDark; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(1, 4); for (let i = 0; i < 4; i++) ctx.lineTo(i % 2 ? -1 : 5, 5.5 + i * 1.5); ctx.stroke(); ctx.strokeStyle = c.outline }
    ctx.restore()
  }

  // Torso frame: origin at the hips, rotated by the lean.
  const shoulder: P = { x: -0.5, y: -RIG.torso + 2.5 }
  const drawArm = (arm: Arm, far: boolean) => {
    const elbow = at(shoulder, arm.s, RIG.upperArm)
    const hand = at(elbow, arm.s + arm.e, RIG.foreArm)
    limb([shoulder, elbow], [6.2], far ? k.topShade : k.top)
    limb([elbow, hand], [5.2], far ? k.skinShade : k.skin)
    if (band && !far) { const cuff = at(elbow, arm.s + arm.e, RIG.foreArm * 0.7); limb([cuff, hand], [5.8], c.gold) }
    ctx.beginPath(); ctx.arc(hand.x, hand.y, 3.1, 0, Math.PI * 2); ctx.lineWidth = OUT * 0.8; ctx.stroke(); ctx.fillStyle = far ? k.skinShade : k.skin; ctx.fill()
  }

  ctx.save(); ctx.translate(hip.x, hip.y)
  // Tails go behind everything.
  if (character === "nabi") {
    const wag = Math.sin(look.phase * 0.5) * 5
    ctx.rotate(lean)
    ctx.lineWidth = 7.5; ctx.beginPath(); ctx.moveTo(-7, -2); ctx.bezierCurveTo(-20, 0, -26, -12 + wag, -20, -22 + wag); ctx.stroke()
    ctx.strokeStyle = k.hair; ctx.lineWidth = 4.6; ctx.stroke()
    ctx.strokeStyle = c.cloud; ctx.lineWidth = 4.6; ctx.beginPath(); ctx.moveTo(-21.5, -19 + wag); ctx.lineTo(-20, -22 + wag); ctx.stroke(); ctx.strokeStyle = c.outline
    ctx.rotate(-lean)
  }
  ctx.translate(-hip.x, -hip.y)

  // Far arm (behind torso), far leg.
  ctx.save(); ctx.translate(hip.x, hip.y); ctx.rotate(lean); drawArm(pose.farArm, true); ctx.restore()
  drawLeg(pose.far, true)

  // Torso: singlet with cel shade on the back, side stripe, race bib.
  ctx.save(); ctx.translate(hip.x, hip.y); ctx.rotate(lean)
  const body = () => { ctx.beginPath(); ctx.moveTo(-7.5, 1); ctx.bezierCurveTo(-9.5, -8, -9.5, -17, -8, -21.5); ctx.bezierCurveTo(-5, -25, 6, -25, 8.5, -21); ctx.bezierCurveTo(10, -15, 9.5, -7, 7.5, 1); ctx.closePath() }
  body(); ctx.lineWidth = OUT; ctx.stroke(); ctx.fillStyle = k.top; ctx.fill()
  ctx.save(); body(); ctx.clip()
  ctx.fillStyle = k.topShade; ctx.beginPath(); ctx.moveTo(-10, -26); ctx.lineTo(-3.5, -26); ctx.bezierCurveTo(-5.5, -15, -5, -6, -3, 2); ctx.lineTo(-10, 2); ctx.fill()
  if (character === "pengu") { ctx.fillStyle = c.penguinBelly; ctx.beginPath(); ctx.ellipse(4.5, -9, 5, 10, 0, 0, Math.PI * 2); ctx.fill() }
  else {
    ctx.strokeStyle = k.trim; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-1, -24); ctx.bezierCurveTo(2, -15, 1, -6, 3.5, 2); ctx.stroke(); ctx.strokeStyle = c.outline
  }
  ctx.restore()
  // V neck.
  ctx.fillStyle = k.skin; ctx.beginPath(); ctx.moveTo(1, -23.5); ctx.quadraticCurveTo(4.5, -19.5, 7.5, -22.5); ctx.closePath(); ctx.fill(); ctx.lineWidth = 1.4; ctx.stroke()
  if (character === "r01") {
    ctx.beginPath(); ctx.arc(4, -13, 3, 0, Math.PI * 2); ctx.fillStyle = c.robotEye; ctx.fill(); ctx.lineWidth = 1.4; ctx.stroke()
  } else if (character !== "pengu") {
    ctx.beginPath(); ctx.rect(1, -17, 7, 7.5); ctx.fillStyle = c.cloud; ctx.fill(); ctx.lineWidth = 1.3; ctx.stroke()
    ctx.fillStyle = k.trim === c.cloud ? k.topShade : k.trim; ctx.fillRect(1.6, -16.4, 5.8, 1.6)
    ctx.fillStyle = c.outline; ctx.fillRect(2.6, -13.6, 1.4, 3); ctx.fillRect(5, -13.6, 1.4, 3)
  }
  // Shorts waistband over the hips.
  ctx.beginPath(); ctx.moveTo(-8, -2); ctx.quadraticCurveTo(0, -3.5, 8, -2); ctx.lineTo(8.5, 4); ctx.quadraticCurveTo(0, 5.5, -8.5, 4); ctx.closePath()
  ctx.lineWidth = OUT; ctx.stroke(); ctx.fillStyle = k.bottom; ctx.fill()
  if (character === "dandan") { ctx.beginPath(); ctx.arc(-9.5, 0, 3.6, 0, Math.PI * 2); ctx.lineWidth = OUT * 0.8; ctx.stroke(); ctx.fillStyle = k.hair; ctx.fill() }
  ctx.restore()

  drawLeg(pose.near, false)

  // A raised near arm (jump, cheer, hit) goes behind the head so it never covers the face.
  const raised = Math.abs(pose.nearArm.s) > 100
  if (raised) { ctx.save(); ctx.translate(hip.x, hip.y); ctx.rotate(lean); drawArm(pose.nearArm, false); ctx.restore() }
  // Head rides the torso but stays more upright than the lean.
  ctx.save(); ctx.translate(hip.x, hip.y); ctx.rotate(lean)
  ctx.translate(1.5, -RIG.torso - 1); ctx.rotate(-lean * 0.55)
  // Neck.
  limb([{ x: 0, y: 2 }, { x: 0.5, y: -3 }], [5], k.skinShade)
  ctx.translate(1, -17)
  drawHead(ctx, c, k, character, pose, look.phase, band)
  ctx.restore()

  if (!raised) { ctx.save(); ctx.translate(hip.x, hip.y); ctx.rotate(lean); drawArm(pose.nearArm, false); ctx.restore() }
  ctx.restore()

  // Accents in screen space.
  ctx.save(); ctx.scale(RIG.scale, RIG.scale)
  if (look.pose === "dash") {
    ctx.strokeStyle = c.cloud; ctx.lineWidth = 2.6; ctx.globalAlpha = 0.85
    for (const [y, len] of [[-78, 14], [-60, 20], [-40, 12]] as const) { ctx.beginPath(); ctx.moveTo(-22 - len, y); ctx.lineTo(-20, y); ctx.stroke() }
    ctx.globalAlpha = 1
  }
  if (look.pose === "cheer") { sparkle(ctx, c, 22, -112, 6); sparkle(ctx, c, -20, -104, 4) }
  ctx.restore()
  ctx.restore()
}

function sparkle(ctx: CanvasRenderingContext2D, c: GamePalette, x: number, y: number, r: number) {
  ctx.save(); ctx.translate(x, y); ctx.fillStyle = c.gold; ctx.strokeStyle = c.outline; ctx.lineWidth = 1.4
  ctx.beginPath()
  for (let i = 0; i < 8; i++) { const a = (i * Math.PI) / 4, rr = i % 2 ? r * 0.35 : r; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) }
  ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore()
}

/** A tapered hair clump from two scalp points to a tip, bowed by `bend`. */
function clump(ctx: CanvasRenderingContext2D, a: P, b: P, tip: P, bend = 0.25) {
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
  const nx = -(tip.y - mid.y) * bend, ny = (tip.x - mid.x) * bend
  ctx.moveTo(a.x, a.y)
  ctx.quadraticCurveTo((a.x + tip.x) / 2 + nx, (a.y + tip.y) / 2 + ny, tip.x, tip.y)
  ctx.quadraticCurveTo((b.x + tip.x) / 2 + nx * 0.4, (b.y + tip.y) / 2 + ny * 0.4, b.x, b.y)
}

function drawHead(ctx: CanvasRenderingContext2D, c: GamePalette, k: Kit, character: RunnerCharacter, pose: Pose, phase: number, band: boolean) {
  const OUT = 2.6
  const flow = pose.flow
  const sway = Math.sin(phase * 2) * Math.abs(flow) * 1.2

  // Back hair and anything behind the head.
  ctx.fillStyle = k.hair; ctx.lineWidth = OUT
  if (character === "hana") {
    // High ponytail streaming back, swinging with the stride.
    const swing = Math.sin(phase + 0.8) * 3 * Math.abs(flow)
    ctx.beginPath(); ctx.moveTo(-8, -15)
    ctx.bezierCurveTo(-20 - flow * 6, -20 + swing, -32 - flow * 6, -4 + swing, -24 - flow * 3, 10 + swing)
    ctx.bezierCurveTo(-24, 2, -18, -6, -9, -6); ctx.closePath(); ctx.stroke(); ctx.fill()
    ctx.beginPath(); ctx.ellipse(-9, -14, 3.6, 3.2, 0, 0, Math.PI * 2); ctx.fillStyle = c.hanaShirt; ctx.fill(); ctx.stroke(); ctx.fillStyle = k.hair
  }
  if (character === "pengu") {
    // Penguin hood: a round hood shell with a white face opening.
    ctx.beginPath(); ctx.ellipse(0, -1, 21, 21, 0, 0, Math.PI * 2); ctx.fillStyle = c.penguin; ctx.fill(); ctx.stroke()
  } else {
    ctx.beginPath()
    ctx.moveTo(10, -17)
    ctx.bezierCurveTo(4, -24, -12, -24, -17, -12)
    clump(ctx, { x: -17, y: -12 }, { x: -16, y: -4 }, { x: -24 - flow * 3, y: -9 + sway }, 0.15)
    clump(ctx, { x: -16, y: -4 }, { x: -13, y: 4 }, { x: -21 - flow * 3, y: 4 + sway }, 0.15)
    if (character === "r01") { ctx.lineTo(-13, 9) } else clump(ctx, { x: -13, y: 4 }, { x: -9, y: 9 }, { x: -16 - flow * 2, y: 13 + sway }, 0.15)
    ctx.lineTo(-4, 6); ctx.lineTo(8, -8); ctx.closePath()
    ctx.fillStyle = k.hair; ctx.fill(); ctx.stroke()
  }
  // Animal ears sit on the back hair.
  if (character === "dandan") for (const [ex, ey] of [[-9, -19], [5, -21]] as const) {
    ctx.beginPath(); ctx.arc(ex, ey, 5.2, 0, Math.PI * 2); ctx.fillStyle = k.hair; ctx.fill(); ctx.stroke()
    ctx.beginPath(); ctx.arc(ex, ey + 0.5, 2.6, 0, Math.PI * 2); ctx.fillStyle = c.bearLight; ctx.fill()
  }
  if (character === "nabi") for (const [bx, tx] of [[-12, -15], [2, 4]] as const) {
    ctx.beginPath(); ctx.moveTo(bx, -16); ctx.lineTo(tx - flow * 2, -31); ctx.lineTo(bx + 10, -19); ctx.closePath(); ctx.fillStyle = k.hair; ctx.fill(); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(bx + 2.5, -18); ctx.lineTo(tx - flow * 2 + 0.5, -27); ctx.lineTo(bx + 7.5, -19.5); ctx.closePath(); ctx.fillStyle = c.catLight; ctx.fill()
  }

  // Face: round cranium into a small chin, turned 3/4 toward the run direction.
  const face = () => {
    ctx.beginPath(); ctx.moveTo(-15, 0)
    ctx.bezierCurveTo(-16, -19, 15, -21, 16, -2)
    ctx.bezierCurveTo(16.5, 6, 13, 12.5, 8, 15)
    ctx.bezierCurveTo(3, 17, -6, 14, -11, 9)
    ctx.bezierCurveTo(-14, 6, -15, 3, -15, 0); ctx.closePath()
  }
  face(); ctx.lineWidth = OUT; ctx.stroke(); ctx.fillStyle = character === "pengu" ? c.cloud : k.skin; ctx.fill()
  ctx.save(); face(); ctx.clip()
  // Cel shadow cast by the bangs, and on the far side of the face.
  ctx.fillStyle = k.skinShade
  ctx.beginPath(); ctx.moveTo(-16, -22); ctx.lineTo(17, -22); ctx.lineTo(17, -3); ctx.bezierCurveTo(8, 0, -2, -3, -16, -4); ctx.fill()
  ctx.beginPath(); ctx.moveTo(-16, -5); ctx.bezierCurveTo(-10, 2, -10, 9, -5, 16); ctx.lineTo(-16, 16); ctx.fill()
  ctx.restore()
  // Ear.
  if (character !== "pengu") {
    ctx.beginPath(); ctx.ellipse(-6, 3, 3, 4, 0.2, 0, Math.PI * 2); ctx.fillStyle = k.skin; ctx.fill(); ctx.lineWidth = 1.6; ctx.stroke()
    if (character === "r01") { ctx.beginPath(); ctx.ellipse(-6, 3, 4.5, 6, 0, 0, Math.PI * 2); ctx.fillStyle = c.belt; ctx.fill(); ctx.stroke(); ctx.fillStyle = c.robotEye; ctx.fillRect(-7, 1, 2, 4) }
  }

  drawFace(ctx, c, k, character, pose.face)

  // Front hair: clumped bangs whose tips stream back with speed.
  const back = flow * 2.2
  ctx.fillStyle = k.hair; ctx.lineWidth = OUT
  if (character === "pengu") {
    // Hood rim over the forehead, small bangs, and the penguin face on the hood.
    ctx.beginPath(); ctx.moveTo(-15, -2); ctx.bezierCurveTo(-14, -22, 15, -24, 17, -4)
    ctx.bezierCurveTo(10, -10, -6, -10, -15, -2); ctx.closePath(); ctx.fillStyle = c.penguin; ctx.fill(); ctx.stroke()
    ctx.beginPath(); clump(ctx, { x: 2, y: -8 }, { x: 8, y: -8 }, { x: 4 - back, y: -1 }); clump(ctx, { x: 8, y: -8 }, { x: 13, y: -7 }, { x: 10 - back, y: -1 }); ctx.fillStyle = k.hair; ctx.fill(); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(6, -21); ctx.lineTo(13, -18.5); ctx.lineTo(6, -16.5); ctx.closePath(); ctx.fillStyle = c.beak; ctx.fill(); ctx.lineWidth = 1.6; ctx.stroke()
    for (const ex of [-1, 9]) { ctx.beginPath(); ctx.arc(ex, -16, 1.4, 0, Math.PI * 2); ctx.fillStyle = c.cloud; ctx.fill() }
  } else {
    ctx.beginPath()
    ctx.moveTo(-15, -4)
    ctx.bezierCurveTo(-16, -21, 13, -25, 17, -6)
    const tips: readonly (readonly [number, number, number, number])[] = character === "hana"
      ? [[17, -6, 12, 2], [12, -11, 6, 0], [6, -13, -1, -1], [-1, -14, -8, -2]]
      : character === "r01"
        ? [[17, -6, 14, 4], [11, -12, 5, 2], [4, -14, -3, 1], [-3, -14, -11, 0]]
        : [[17, -6, 14, 1], [12, -12, 8, -1], [6, -14, 1, 1], [0, -15, -6, -2], [-6, -14, -12, -3]]
    for (let i = 0; i < tips.length; i++) {
      const [ax, ay, tx, ty] = tips[i]!
      const next = tips[i + 1] ?? [-15, -4]
      clump(ctx, { x: ax, y: ay }, { x: next[0]!, y: next[1]! }, { x: tx - back * (1 - i * 0.12), y: ty + sway * 0.4 }, 0.2)
    }
    ctx.closePath(); ctx.fillStyle = k.hair; ctx.fill(); ctx.stroke()
    // One shadow tone under the crown and an "angel ring" highlight.
    ctx.save(); ctx.beginPath(); ctx.moveTo(-15, -4); ctx.bezierCurveTo(-16, -21, 13, -25, 17, -6); ctx.lineTo(-15, -4); ctx.clip()
    ctx.fillStyle = k.hairShade; ctx.globalAlpha = 0.35; ctx.fillRect(-17, -24, 9, 22); ctx.globalAlpha = 1; ctx.restore()
    ctx.strokeStyle = character === "r01" ? c.cloud : c.hairShine; ctx.lineWidth = 2
    ctx.beginPath(); ctx.arc(1, -4, 13, Math.PI * 1.18, Math.PI * 1.42); ctx.stroke()
    ctx.beginPath(); ctx.arc(1, -4, 13, Math.PI * 1.5, Math.PI * 1.62); ctx.stroke()
    ctx.strokeStyle = c.outline
  }
  if (character === "tori" || band) {
    // Headband with tails streaming back (team colour for Tori, gold with the 박자 upgrade).
    const color = band ? c.gold : k.top
    ctx.beginPath(); ctx.moveTo(-15, -6); ctx.bezierCurveTo(-8, -14, 9, -15, 16.5, -8); ctx.lineTo(16.5, -4.5); ctx.bezierCurveTo(9, -11, -8, -10, -15, -2.5); ctx.closePath()
    ctx.fillStyle = color; ctx.fill(); ctx.lineWidth = 1.8; ctx.stroke()
    ctx.beginPath(); ctx.moveTo(-14, -5); ctx.bezierCurveTo(-20, -8 + sway, -24 - flow * 4, -4 + sway, -28 - flow * 5, -6 + sway * 1.5)
    ctx.lineTo(-27 - flow * 5, -1 + sway * 1.5); ctx.bezierCurveTo(-22, -1, -18, -2, -14, -2); ctx.closePath(); ctx.fill(); ctx.stroke()
  }
  if (character === "r01") {
    // Headset band across the crown.
    ctx.strokeStyle = c.belt; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(-1, -2, 16, Math.PI * 1.05, Math.PI * 1.55); ctx.stroke(); ctx.strokeStyle = c.outline
  }

  // Effort marks.
  if (pose.face === "tired" || pose.face === "intense") {
    ctx.fillStyle = c.rain; ctx.lineWidth = 1.3
    ctx.beginPath(); ctx.moveTo(-12, -14); ctx.quadraticCurveTo(-8, -7, -11.5, -5); ctx.quadraticCurveTo(-15.5, -7, -12, -14); ctx.fill(); ctx.stroke()
  }
  if (pose.face === "hurt" || pose.face === "shock") {
    ctx.lineWidth = 2
    for (const a of [-2.4, -1.75, -1.1]) { ctx.beginPath(); ctx.moveTo(4 + Math.cos(a) * 24, -4 + Math.sin(a) * 24); ctx.lineTo(4 + Math.cos(a) * 30, -4 + Math.sin(a) * 30); ctx.stroke() }
  }
}

function drawFace(ctx: CanvasRenderingContext2D, c: GamePalette, k: Kit, character: RunnerCharacter, face: Face) {
  const ink = c.outline
  // Near eye larger toward the middle, far eye narrower near the face edge (3/4 view).
  const eyes = [{ x: 1.5, w: 1 }, { x: 11.5, w: 0.7 }] as const
  const y = 3
  ctx.strokeStyle = ink
  for (const eye of eyes) {
    ctx.save(); ctx.translate(eye.x, y); ctx.scale(eye.w, 1)
    if (face === "hurt") {
      ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-3, -3); ctx.lineTo(2.5, 0); ctx.lineTo(-3, 3); ctx.stroke()
    } else if (face === "joy") {
      ctx.lineWidth = 2.2; ctx.beginPath(); ctx.arc(0, 2, 3.6, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke()
    } else if (face === "tired") {
      ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-3.5, 0.5); ctx.quadraticCurveTo(0, 2.5, 3.5, 0.5); ctx.stroke()
      ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(-3, -1.5); ctx.lineTo(3, -2.5); ctx.stroke()
    } else {
      const narrow = face === "focus" ? 0.82 : face === "intense" ? 0.66 : 1
      const h = 5.2 * narrow
      // White, iris (two tones), pupil, two highlights, heavy upper lash.
      ctx.beginPath(); ctx.ellipse(0, 0.6, 3.4, h, 0, 0, Math.PI * 2); ctx.fillStyle = c.cloud; ctx.fill()
      ctx.save(); ctx.beginPath(); ctx.ellipse(0, 0.6, 3.4, h, 0, 0, Math.PI * 2); ctx.clip()
      ctx.beginPath(); ctx.ellipse(0.6, 1.2, 2.8, h * 0.95, 0, 0, Math.PI * 2); ctx.fillStyle = character === "r01" ? c.robotEye : k.iris; ctx.fill()
      ctx.fillStyle = ink; ctx.globalAlpha = 0.55; ctx.fillRect(-4, -h, 9, h * 0.9); ctx.globalAlpha = 1
      ctx.beginPath(); ctx.ellipse(0.8, 1.2, 1.3, h * 0.5, 0, 0, Math.PI * 2); ctx.fillStyle = ink; ctx.fill()
      ctx.restore()
      if (face === "shock") { ctx.beginPath(); ctx.ellipse(0.8, 1.2, 0.9, 1.1, 0, 0, Math.PI * 2); ctx.fillStyle = c.cloud; ctx.fill() }
      else {
        ctx.fillStyle = c.cloud
        ctx.beginPath(); ctx.ellipse(-0.6, -0.8, 1.3, 1.6, -0.3, 0, Math.PI * 2); ctx.fill()
        ctx.beginPath(); ctx.arc(1.6, 3, 0.7, 0, Math.PI * 2); ctx.fill()
      }
      ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(-4, -h + 1.2); ctx.quadraticCurveTo(0, -h - 0.8, 4.2, -h + 0.6); ctx.stroke()
      ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(3.4, -h + 0.8); ctx.lineTo(5.2, -h - 0.4); ctx.stroke()
    }
    // Brow.
    ctx.lineWidth = 1.5
    const browTilt = face === "intense" ? 2.2 : face === "focus" ? 1 : face === "shock" || face === "hurt" ? -1.5 : -0.4
    ctx.beginPath(); ctx.moveTo(-3.2, -8.5 - browTilt * 0.4); ctx.quadraticCurveTo(0, -9.8, 3.4, -8.5 + browTilt); ctx.stroke()
    ctx.restore()
  }
  // Mouth.
  const mx = 9, my = 10.5
  ctx.lineWidth = 1.5
  if (face === "joy" || face === "open") {
    ctx.beginPath(); ctx.moveTo(mx - 2.5, my - 0.5); ctx.quadraticCurveTo(mx, my + 4, mx + 2.5, my - 0.8); ctx.closePath(); ctx.fillStyle = c.danger; ctx.fill(); ctx.stroke()
  } else if (face === "focus" || face === "tired") {
    ctx.beginPath(); ctx.ellipse(mx, my + 0.5, 1.3, face === "tired" ? 1.8 : 1.1, 0, 0, Math.PI * 2); ctx.fillStyle = ink; ctx.fill()
  } else if (face === "intense") {
    ctx.beginPath(); ctx.moveTo(mx - 2.2, my); ctx.lineTo(mx + 2.2, my - 0.3); ctx.lineTo(mx + 1.8, my + 1.6); ctx.lineTo(mx - 1.8, my + 1.6); ctx.closePath(); ctx.fillStyle = c.cloud; ctx.fill(); ctx.stroke()
  } else if (face === "hurt" || face === "shock") {
    ctx.beginPath(); ctx.moveTo(mx - 2.5, my + 1); ctx.lineTo(mx - 1.2, my - 0.2); ctx.lineTo(mx, my + 1); ctx.lineTo(mx + 1.2, my - 0.2); ctx.lineTo(mx + 2.5, my + 1); ctx.stroke()
  } else {
    ctx.beginPath(); ctx.arc(mx, my - 1.5, 2.2, 0.25 * Math.PI, 0.75 * Math.PI); ctx.stroke()
  }
  // Blush.
  if (character !== "r01") {
    ctx.fillStyle = c.danger; ctx.globalAlpha = 0.22
    ctx.beginPath(); ctx.ellipse(3, 8.5, 3.2, 1.6, 0, 0, Math.PI * 2); ctx.fill()
    ctx.globalAlpha = 1
  } else {
    ctx.strokeStyle = c.robot; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-1, 8); ctx.lineTo(4, 9); ctx.stroke(); ctx.strokeStyle = ink
  }
}
