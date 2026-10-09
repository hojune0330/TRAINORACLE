/**
 * Anime-style runner rig for the tour (2026-10-09 owner request: "러닝에 적절한 일본 애니메이션 스타일로 재구성").
 *
 * Drawn from scratch with canvas paths, no copied artwork. Style notes:
 * - Sports-anime proportions (about 3.6 heads) instead of chibi blocks; long legs read as speed.
 * - Two-segment limbs on one skeleton: knee drive and heel kick in the run cycle, arms bent ~90°.
 * - Big glossy eyes with two highlights, spiky hair silhouettes that stream back, a hard cel-shade band
 *   (one flat shadow tone, no gradients) and a thin dark outline.
 * - Race bib, sweat drop / sparkle / speed-line accents, all from --game-* tokens.
 * Every character shares this skeleton, so the silhouette height and hit box never change.
 * Origin is at the feet; negative y is up. About 66 logical px tall.
 */
import type { TreadmillUpgrade } from "../../domain/minigame/treadmill"
import type { GamePalette, RunnerCharacter, RunnerPose } from "./sprites"

type Look = { pose: RunnerPose; phase: number; upgrades: readonly TreadmillUpgrade[]; squash?: number; character?: RunnerCharacter }

type Kit = {
  hair: string; hairShade: string; skin: string; skinShade: string; top: string; topShade: string
  bottom: string; shoe: string; sole: string; accent: string
}

function kitFor(c: GamePalette, character: RunnerCharacter): Kit {
  switch (character) {
    case "hana": return { hair: c.hairHana, hairShade: c.outline, skin: c.skin, skinShade: c.skinShade, top: c.hanaShirt, topShade: c.hanaShirtDark, bottom: c.outline, shoe: c.cloud, sole: c.hanaShirtDark, accent: c.gold }
    case "dandan": return { hair: c.bear, hairShade: c.mud, skin: c.bear, skinShade: c.mud, top: c.gold, topShade: c.goldDark, bottom: c.shorts, shoe: c.cloud, sole: c.belt, accent: c.danger }
    case "nabi": return { hair: c.cat, hairShade: c.heat, skin: c.catLight, skinShade: c.cat, top: c.shorts, topShade: c.outline, bottom: c.outline, shoe: c.danger, sole: c.cloud, accent: c.gold }
    case "r01": return { hair: c.robot, hairShade: c.belt, skin: c.robotLight, skinShade: c.robot, top: c.robot, topShade: c.belt, bottom: c.belt, shoe: c.robotEye, sole: c.belt, accent: c.robotEye }
    case "pengu": return { hair: c.penguin, hairShade: c.outline, skin: c.penguinBelly, skinShade: c.rail, top: c.penguin, topShade: c.outline, bottom: c.penguin, shoe: c.beak, sole: c.goldDark, accent: c.danger }
    default: return { hair: c.hair, hairShade: c.outline, skin: c.skin, skinShade: c.skinShade, top: c.shirt, topShade: c.shirtDark, bottom: c.shorts, shoe: c.cloud, sole: c.lane, accent: c.gold }
  }
}

/** Joint angles for the pose. Thigh/shin angles are from vertical (+ = forward). */
function rig(pose: RunnerPose, phase: number) {
  const s = Math.sin(phase), c = Math.cos(phase)
  if (pose === "run" || pose === "dash") {
    const drive = pose === "dash" ? 1.25 : 1
    // Front leg: knee drives up then extends; back leg: pushes off then heel kicks.
    const thigh = (t: number) => (0.15 + 0.85 * Math.sin(t)) * drive
    const shin = (t: number) => -(0.25 + 1.1 * Math.max(0, -Math.sin(t + 0.6))) * drive - 0.15
    return {
      legs: [[thigh(phase + Math.PI), shin(phase + Math.PI)], [thigh(phase), shin(phase)]] as const,
      arms: [[-s * 1.0 * drive, -1.5], [s * 1.0 * drive, -1.5]] as const,
      lean: pose === "dash" ? 0.34 : 0.18, bob: -Math.abs(c) * 3, hairFlow: 1,
    }
  }
  // Arm angles keep both hands clear of the face: back arm up-behind, front arm up-in-front.
  if (pose === "jump") return { legs: [[-0.2, -1.4], [1.1, -1.5]] as const, arms: [[-2.2, -0.4], [1.9, 0.5]] as const, lean: 0.05, bob: 0, hairFlow: 0.6 }
  if (pose === "cheer") return { legs: [[-0.1, -0.05], [0.12, -0.05]] as const, arms: [[-2.0, -0.6], [2.0, 0.6]] as const, lean: -0.05, bob: -2, hairFlow: 0.2 }
  if (pose === "hit") return { legs: [[-0.4, -0.3], [0.5, -0.6]] as const, arms: [[-2.2, -0.6], [1.8, 0.4]] as const, lean: -0.3, bob: 0, hairFlow: -0.6 }
  if (pose === "fall") return { legs: [[-0.9, -0.4], [0.8, -0.8]] as const, arms: [[-2.1, 0.4], [2.0, -0.4]] as const, lean: -0.5, bob: 0, hairFlow: -1 }
  if (pose === "tired") return { legs: [[0.25, -0.6], [-0.15, -0.2]] as const, arms: [[0.2, -0.2], [0.35, -0.2]] as const, lean: 0.35, bob: 1, hairFlow: 0.1 }
  return { legs: [[-0.08, -0.05], [0.1, -0.08]] as const, arms: [[0.15, -0.35], [-0.1, -0.35]] as const, lean: 0, bob: 0, hairFlow: 0.1 }
}

export function drawAnimeRunner(ctx: CanvasRenderingContext2D, c: GamePalette, look: Look) {
  const character = look.character ?? "tori"
  const k = kitFor(c, character)
  const { pose, phase, upgrades } = look
  const springs = upgrades.includes("spring"), grip = upgrades.includes("grip"), band = upgrades.includes("economy")
  const r = rig(pose, phase)
  const squash = look.squash ?? 0
  ctx.save()
  ctx.lineJoin = "round"; ctx.lineCap = "round"; ctx.strokeStyle = c.outline
  ctx.scale(1 + squash * 0.16, 1 - squash * 0.18)
  if (springs) ctx.translate(0, -4)
  ctx.translate(0, r.bob)

  const hip = { x: 0, y: -30 }
  const THIGH = 15, SHIN = 15, UPPER = 10, FORE = 10

  // A limb is a tapered capsule: outline pass then fill pass, then a cel-shadow on its back edge.
  const capsule = (x1: number, y1: number, x2: number, y2: number, w1: number, w2: number, fill: string, shade?: string) => {
    const a = Math.atan2(y2 - y1, x2 - x1), nx = -Math.sin(a), ny = Math.cos(a)
    const path = () => {
      ctx.beginPath()
      ctx.moveTo(x1 + nx * w1, y1 + ny * w1); ctx.lineTo(x2 + nx * w2, y2 + ny * w2)
      ctx.arc(x2, y2, w2, a + Math.PI / 2, a - Math.PI / 2, true)
      ctx.lineTo(x1 - nx * w1, y1 - ny * w1)
      ctx.arc(x1, y1, w1, a - Math.PI / 2, a + Math.PI / 2, true)
      ctx.closePath()
    }
    path(); ctx.lineWidth = 2.6; ctx.stroke(); ctx.fillStyle = fill; ctx.fill()
    if (shade) {
      ctx.save(); path(); ctx.clip()
      ctx.fillStyle = shade
      ctx.beginPath(); ctx.moveTo(x1 - nx * w1 * 0.1, y1 - ny * w1 * 0.1); ctx.lineTo(x2 - nx * w2 * 0.1, y2 - ny * w2 * 0.1)
      ctx.lineTo(x2 - nx * w2 * 2, y2 - ny * w2 * 2); ctx.lineTo(x1 - nx * w1 * 2, y1 - ny * w1 * 2); ctx.fill()
      ctx.restore()
    }
  }
  const joint = (x: number, y: number, angle: number, length: number) => ({ x: x + Math.sin(angle) * length, y: y + Math.cos(angle) * length })

  const leg = (index: 0 | 1, back: boolean) => {
    const [thighA, shinA] = r.legs[index]
    const knee = joint(hip.x + (back ? -1.5 : 1.5), hip.y, thighA, THIGH)
    const foot = joint(knee.x, knee.y, thighA + shinA, SHIN)
    const dim = back ? k.topShade : k.bottom
    capsule(hip.x + (back ? -1.5 : 1.5), hip.y, knee.x, knee.y, 4.2, 3.4, back ? k.skinShade : k.skin, back ? undefined : k.skinShade)
    capsule(knee.x, knee.y, foot.x, foot.y, 3.4, 2.6, back ? k.skinShade : k.skin, back ? undefined : k.skinShade)
    // Shorts over the thigh top.
    const shortsEnd = joint(hip.x + (back ? -1.5 : 1.5), hip.y, thighA, 7)
    capsule(hip.x + (back ? -1.5 : 1.5), hip.y, shortsEnd.x, shortsEnd.y, 5, 4.6, dim)
    // Shoe: a wedge pointing forward along the ground direction of the shin.
    const footA = thighA + shinA + Math.PI / 2 - 0.15
    ctx.save(); ctx.translate(foot.x, foot.y); ctx.rotate(-footA + Math.PI / 2)
    ctx.beginPath(); ctx.moveTo(-3.5, -3); ctx.quadraticCurveTo(-4, 3, 0, 3.2); ctx.lineTo(8, 3.2); ctx.quadraticCurveTo(9, -0.5, 4, -2.5); ctx.closePath()
    ctx.lineWidth = 2.2; ctx.stroke(); ctx.fillStyle = grip ? c.lane : k.shoe; ctx.fill()
    ctx.fillStyle = k.sole; ctx.fillRect(-3.4, 1.6, 12, 1.6)
    if (grip) { ctx.fillStyle = c.outline; for (const dx of [-1, 2.5, 6]) ctx.fillRect(dx, 3.2, 1.4, 1.4) }
    if (springs) { ctx.strokeStyle = c.goldDark; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(0, 3.6); for (let i = 0; i < 4; i++) ctx.lineTo(i % 2 ? -1 : 4, 4.6 + i * 1.3); ctx.stroke(); ctx.strokeStyle = c.outline }
    ctx.restore()
  }

  const shoulder = { x: 1, y: -47 }
  const arm = (index: 0 | 1, back: boolean) => {
    const [upperA, foreA] = r.arms[index]
    const sx = shoulder.x + (back ? -3 : 3)
    const elbow = joint(sx, shoulder.y, upperA, UPPER)
    const hand = joint(elbow.x, elbow.y, upperA + foreA, FORE)
    capsule(sx, shoulder.y, elbow.x, elbow.y, 3.2, 2.8, back ? k.topShade : k.top)
    capsule(elbow.x, elbow.y, hand.x, hand.y, 2.6, 2.2, back ? k.skinShade : k.skin)
    if (band) capsule(elbow.x + (hand.x - elbow.x) * 0.7, elbow.y + (hand.y - elbow.y) * 0.7, hand.x, hand.y, 2.9, 2.9, c.gold)
    ctx.beginPath(); ctx.arc(hand.x, hand.y, 2.8, 0, Math.PI * 2); ctx.lineWidth = 2.2; ctx.stroke(); ctx.fillStyle = back ? k.skinShade : k.skin; ctx.fill()
  }

  ctx.save()
  ctx.rotate(r.lean)
  // Tails go behind everything.
  if (character === "nabi") {
    const wag = Math.sin(phase * 0.5) * 4
    ctx.lineWidth = 6.5; ctx.beginPath(); ctx.moveTo(-6, -30); ctx.quadraticCurveTo(-22, -32 + wag, -20, -46 + wag); ctx.stroke()
    ctx.strokeStyle = k.hair; ctx.lineWidth = 3.6; ctx.stroke(); ctx.strokeStyle = c.outline
  }
  if (character === "dandan") { ctx.beginPath(); ctx.arc(-8, -30, 3.6, 0, Math.PI * 2); ctx.lineWidth = 2.2; ctx.stroke(); ctx.fillStyle = k.hair; ctx.fill() }

  arm(0, true)
  leg(0, true)

  // Torso: a tapered singlet, cel shade on the back side, and a race bib.
  ctx.beginPath()
  ctx.moveTo(-6, -49); ctx.quadraticCurveTo(-8, -40, -6, -29); ctx.lineTo(6, -29); ctx.quadraticCurveTo(8.5, -40, 7, -49); ctx.quadraticCurveTo(0.5, -51.5, -6, -49); ctx.closePath()
  ctx.lineWidth = 2.6; ctx.stroke(); ctx.fillStyle = k.top; ctx.fill()
  ctx.save(); ctx.clip(); ctx.fillStyle = k.topShade; ctx.fillRect(-9, -50, 5, 22); ctx.restore()
  if (character === "pengu") {
    ctx.beginPath(); ctx.ellipse(2, -38, 5, 8.5, 0, 0, Math.PI * 2); ctx.fillStyle = c.penguinBelly; ctx.fill()
  } else if (character === "r01") {
    ctx.beginPath(); ctx.arc(1.5, -41, 3, 0, Math.PI * 2); ctx.fillStyle = c.robotEye; ctx.fill(); ctx.lineWidth = 1.5; ctx.stroke()
    ctx.fillStyle = c.belt; ctx.fillRect(-5, -33, 11, 2)
  } else {
    // Bib with a number-ish mark.
    ctx.beginPath(); ctx.rect(-3.5, -43, 9, 7); ctx.fillStyle = c.cloud; ctx.fill(); ctx.lineWidth = 1.4; ctx.stroke()
    ctx.fillStyle = k.accent; ctx.fillRect(-2.5, -42, 7, 1.6)
    ctx.fillStyle = c.outline; ctx.fillRect(-1, -39.5, 1.3, 2.6); ctx.fillRect(1.5, -39.5, 1.3, 2.6)
  }
  // Waistband.
  ctx.fillStyle = k.bottom; ctx.beginPath(); ctx.rect(-6.5, -31, 13, 3.5); ctx.fill(); ctx.lineWidth = 2; ctx.stroke()

  leg(1, false)
  drawHead(ctx, c, k, character, pose, phase, r.hairFlow, band)
  arm(1, false)
  ctx.restore()

  // Effort accents in screen space.
  if (pose === "dash") {
    ctx.strokeStyle = c.cloud; ctx.lineWidth = 2; ctx.globalAlpha = 0.8
    for (const [y, len] of [[-56, 10], [-44, 14], [-32, 9]] as const) { ctx.beginPath(); ctx.moveTo(-16 - len, y); ctx.lineTo(-14, y); ctx.stroke() }
    ctx.globalAlpha = 1
  }
  if (pose === "cheer") sparkle(ctx, c, 14, -70, 4.5)
  ctx.restore()
}

function sparkle(ctx: CanvasRenderingContext2D, c: GamePalette, x: number, y: number, r: number) {
  ctx.save(); ctx.translate(x, y); ctx.fillStyle = c.gold; ctx.strokeStyle = c.outline; ctx.lineWidth = 1.2
  ctx.beginPath()
  for (let i = 0; i < 8; i++) { const a = (i * Math.PI) / 4, rr = i % 2 ? r * 0.35 : r; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) }
  ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore()
}

function drawHead(ctx: CanvasRenderingContext2D, c: GamePalette, k: Kit, character: RunnerCharacter, pose: RunnerPose, phase: number, flow: number, band: boolean) {
  const hx = 3, hy = -60
  ctx.save(); ctx.translate(hx, hy)
  const flutter = Math.sin(phase * 2) * 0.8 * Math.abs(flow)

  // Back hair mass (streams behind the head when running).
  const backHair = () => {
    ctx.beginPath()
    ctx.moveTo(-8, -6)
    if (character === "hana") {
      // High ponytail that streams back.
      ctx.quadraticCurveTo(-14, -12, -20 - flow * 4, -6 + flutter)
      ctx.quadraticCurveTo(-24 - flow * 5, 2 + flutter, -19 - flow * 3, 6)
      ctx.quadraticCurveTo(-15, 0, -9, 2)
    } else if (character === "r01" || character === "pengu") {
      ctx.lineTo(-8, 4)
    } else {
      // Spiky back: three points flowing back.
      for (const [dx, dy] of [[-15 - flow * 3, -9 + flutter], [-11, -4], [-16 - flow * 3, -1 + flutter], [-10, 1], [-13 - flow * 2, 6 + flutter]] as const) ctx.lineTo(dx, dy)
      ctx.lineTo(-6, 5)
    }
    ctx.closePath(); ctx.lineWidth = 2.4; ctx.stroke(); ctx.fillStyle = k.hair; ctx.fill()
  }
  if (character !== "r01" && character !== "pengu" && character !== "dandan") backHair()

  // Ears for animal runners.
  if (character === "dandan") for (const ex of [-6, 6]) { ctx.beginPath(); ctx.arc(ex, -10, 3.8, 0, Math.PI * 2); ctx.lineWidth = 2.2; ctx.stroke(); ctx.fillStyle = k.hair; ctx.fill(); ctx.beginPath(); ctx.arc(ex, -10, 1.8, 0, Math.PI * 2); ctx.fillStyle = c.bearLight; ctx.fill() }
  if (character === "nabi") for (const side of [-1, 1]) {
    ctx.beginPath(); ctx.moveTo(side * 8, -6); ctx.lineTo(side * 7, -16); ctx.lineTo(side * 1.5, -9); ctx.closePath(); ctx.lineWidth = 2.2; ctx.stroke(); ctx.fillStyle = k.hair; ctx.fill()
    ctx.beginPath(); ctx.moveTo(side * 6.5, -8); ctx.lineTo(side * 6.2, -13); ctx.lineTo(side * 3.5, -9.5); ctx.closePath(); ctx.fillStyle = c.catLight; ctx.fill()
  }
  if (character === "r01") { ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-2, -10); ctx.lineTo(-4, -16); ctx.stroke(); ctx.beginPath(); ctx.arc(-4, -17, 1.8, 0, Math.PI * 2); ctx.fillStyle = c.robotEye; ctx.fill(); ctx.stroke() }

  // Face: soft anime jaw (wider cheek, pointed-ish chin toward the front).
  ctx.beginPath()
  ctx.moveTo(-8, -3); ctx.quadraticCurveTo(-9, -11, 0, -11.5); ctx.quadraticCurveTo(9, -11.5, 9, -3)
  ctx.quadraticCurveTo(9, 4, 4.5, 7.5); ctx.quadraticCurveTo(1.5, 9, -2, 7); ctx.quadraticCurveTo(-8, 4, -8, -3); ctx.closePath()
  ctx.lineWidth = 2.6; ctx.stroke(); ctx.fillStyle = character === "r01" ? c.robotLight : k.skin; ctx.fill()
  // Cel shadow under the hairline and down the back of the face.
  ctx.save(); ctx.clip(); ctx.fillStyle = k.skinShade
  ctx.beginPath(); ctx.moveTo(-9, -12); ctx.lineTo(9, -12); ctx.lineTo(9, -6); ctx.quadraticCurveTo(0, -3, -9, -6); ctx.fill()
  ctx.fillRect(-9, -12, 3.5, 22)
  ctx.restore()
  if (character === "pengu") { ctx.beginPath(); ctx.ellipse(2, 0, 6.5, 6.5, 0, 0, Math.PI * 2); ctx.fillStyle = c.penguinBelly; ctx.fill() }

  drawEyes(ctx, c, character, pose)

  // Front hair / headgear.
  if (character === "r01") {
    ctx.beginPath(); ctx.moveTo(-9, -4); ctx.quadraticCurveTo(-9, -13, 0, -13); ctx.quadraticCurveTo(10, -13, 10, -4); ctx.closePath()
    ctx.lineWidth = 2.4; ctx.stroke(); ctx.fillStyle = k.hair; ctx.fill()
    ctx.fillStyle = c.hairShine; ctx.fillRect(-4, -11, 8, 1.6)
  } else if (character === "pengu") {
    ctx.beginPath(); ctx.moveTo(-9, -4); ctx.quadraticCurveTo(-9, -15, 0, -15); ctx.quadraticCurveTo(10, -15, 10, -4)
    ctx.quadraticCurveTo(0, -7, -9, -4); ctx.closePath(); ctx.lineWidth = 2.4; ctx.stroke(); ctx.fillStyle = k.hair; ctx.fill()
    // Beak and a knit headband.
    ctx.beginPath(); ctx.moveTo(8, 1); ctx.lineTo(13, 2.5); ctx.lineTo(8, 4); ctx.closePath(); ctx.fillStyle = c.beak; ctx.fill(); ctx.lineWidth = 1.6; ctx.stroke()
    ctx.fillStyle = c.danger; ctx.fillRect(-9, -10, 19, 3); ctx.strokeRect(-9, -10, 19, 3)
  } else if (character === "dandan" || character === "nabi") {
    // Short fur fringe + muzzle.
    ctx.beginPath(); ctx.moveTo(-8.5, -5); ctx.quadraticCurveTo(-8, -13, 0.5, -12.5); ctx.quadraticCurveTo(9.5, -12.5, 9.5, -5)
    ctx.lineTo(6, -8); ctx.lineTo(3, -5.5); ctx.lineTo(0, -8.5); ctx.lineTo(-3, -6); ctx.lineTo(-6, -8.5); ctx.closePath()
    ctx.lineWidth = 2.2; ctx.stroke(); ctx.fillStyle = k.hair; ctx.fill()
    ctx.beginPath(); ctx.ellipse(5.5, 3.5, 3.4, 2.4, 0, 0, Math.PI * 2); ctx.fillStyle = character === "dandan" ? c.bearLight : c.catLight; ctx.fill()
    ctx.beginPath(); ctx.ellipse(6.6, 2.6, 1.4, 1, 0, 0, Math.PI * 2); ctx.fillStyle = c.outline; ctx.fill()
    if (character === "nabi") { ctx.lineWidth = 0.9; ctx.globalAlpha = 0.7; for (const dy of [-0.5, 1.8]) { ctx.beginPath(); ctx.moveTo(9, 3 + dy); ctx.lineTo(14, 2 + dy * 1.6); ctx.stroke() } ctx.globalAlpha = 1 }
  } else {
    // Spiky anime bangs, flowing back with speed.
    const spikes: readonly (readonly [number, number])[] = character === "hana"
      ? [[-9, -3], [-6, -8], [-3, -2], [0, -7], [3, -1], [6, -6], [10, -2]]
      : [[-9, -2], [-7, -9], [-4, -3], [-1, -9], [2, -2], [5, -8], [10, -1]]
    ctx.beginPath(); ctx.moveTo(-9.5, -3)
    ctx.quadraticCurveTo(-11, -15, 0, -15.5); ctx.quadraticCurveTo(10, -16 + flow, 11.5, -6)
    for (let i = spikes.length - 1; i >= 0; i--) { const [sx, sy] = spikes[i]!; ctx.lineTo(sx - flow * (sy < -5 ? 1.2 : 0), sy + (i % 2 ? 3.5 : 0)) }
    ctx.closePath(); ctx.lineWidth = 2.4; ctx.stroke(); ctx.fillStyle = k.hair; ctx.fill()
    // One-tone hair shadow + a crisp highlight arc (the classic anime "angel ring").
    ctx.save(); ctx.clip(); ctx.fillStyle = k.hairShade; ctx.globalAlpha = 0.45; ctx.fillRect(-11, -16, 5, 14); ctx.globalAlpha = 1; ctx.restore()
    ctx.strokeStyle = c.hairShine; ctx.lineWidth = 1.4
    ctx.beginPath(); ctx.arc(1, -6, 8.5, Math.PI * 1.2, Math.PI * 1.55); ctx.stroke()
    ctx.strokeStyle = c.outline
    if (character === "tori") {
      // Sweatband in team colour.
      ctx.fillStyle = k.top; ctx.beginPath(); ctx.moveTo(-9.6, -7.5); ctx.quadraticCurveTo(1, -11.5, 11, -8); ctx.lineTo(11, -5.5); ctx.quadraticCurveTo(1, -9, -9.6, -5); ctx.closePath(); ctx.fill(); ctx.lineWidth = 1.6; ctx.stroke()
      // Band tails streaming back.
      ctx.beginPath(); ctx.moveTo(-9, -6.5); ctx.quadraticCurveTo(-15, -8 + flutter, -19 - flow * 3, -5 + flutter); ctx.lineTo(-18 - flow * 3, -2 + flutter); ctx.quadraticCurveTo(-14, -4, -9, -4.5); ctx.closePath(); ctx.fill(); ctx.stroke()
    }
    if (character === "hana") { ctx.beginPath(); ctx.arc(-8.5, -9, 2.4, 0, Math.PI * 2); ctx.fillStyle = c.hanaShirt; ctx.fill(); ctx.lineWidth = 1.4; ctx.stroke() }
  }
  if (band && character !== "tori") { ctx.fillStyle = c.gold; ctx.fillRect(-9.5, -8, 21, 2.6); ctx.lineWidth = 1.4; ctx.strokeRect(-9.5, -8, 21, 2.6) }

  // Effort marks.
  if (pose === "tired" || pose === "dash") {
    ctx.fillStyle = c.rain; ctx.lineWidth = 1.2
    ctx.beginPath(); ctx.moveTo(-10, -9); ctx.quadraticCurveTo(-7, -4, -9.5, -2.5); ctx.quadraticCurveTo(-12.5, -4, -10, -9); ctx.fill(); ctx.stroke()
  }
  if (pose === "hit" || pose === "fall") {
    // Anime "shock" lines above the head.
    ctx.lineWidth = 1.6
    for (const a of [-2.3, -1.6, -0.9]) { ctx.beginPath(); ctx.moveTo(Math.cos(a) * 15, -5 + Math.sin(a) * 15); ctx.lineTo(Math.cos(a) * 20, -5 + Math.sin(a) * 20); ctx.stroke() }
  }
  ctx.restore()
}

function drawEyes(ctx: CanvasRenderingContext2D, c: GamePalette, character: RunnerCharacter, pose: RunnerPose) {
  const ink = c.outline
  if (character === "r01") {
    // Visor slit with two glowing eyes.
    ctx.beginPath(); ctx.rect(-6, -5.5, 15, 5.5); ctx.fillStyle = c.belt; ctx.fill(); ctx.lineWidth = 1.6; ctx.stroke()
    ctx.fillStyle = c.robotEye
    const h = pose === "hit" || pose === "fall" ? 0.9 : pose === "cheer" ? 1.2 : pose === "run" || pose === "dash" ? 2.2 : 3
    for (const x of [-2.5, 5.5]) ctx.fillRect(x - 1.6, -2.75 - h / 2, 3.2, h)
    return
  }
  const eyeX = [-2.5, 5.5] as const, eyeY = -3
  ctx.lineWidth = 1.6; ctx.strokeStyle = ink
  if (pose === "hit") {
    for (const x of eyeX) { ctx.beginPath(); ctx.moveTo(x - 2, eyeY - 2); ctx.lineTo(x + 2, eyeY); ctx.lineTo(x - 2, eyeY + 2); ctx.stroke() }
  } else if (pose === "fall") {
    for (const x of eyeX) { ctx.beginPath(); ctx.arc(x, eyeY, 2.6, 0, Math.PI * 2); ctx.fillStyle = c.cloud; ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.arc(x, eyeY, 0.9, 0, Math.PI * 2); ctx.fillStyle = ink; ctx.fill() }
  } else if (pose === "cheer") {
    for (const x of eyeX) { ctx.lineWidth = 1.8; ctx.beginPath(); ctx.arc(x, eyeY + 1.2, 2.4, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke() }
  } else if (pose === "tired") {
    for (const x of eyeX) { ctx.beginPath(); ctx.moveTo(x - 2.4, eyeY + 0.5); ctx.quadraticCurveTo(x, eyeY + 1.6, x + 2.4, eyeY + 0.5); ctx.stroke() }
  } else {
    const focused = pose === "run" || pose === "dash"
    for (const x of eyeX) {
      // Tall eye: dark iris, colour band, two highlights, a heavy upper lash line.
      ctx.beginPath(); ctx.ellipse(x, eyeY, 2.3, focused ? 2.9 : 3.3, 0, 0, Math.PI * 2); ctx.fillStyle = c.cloud; ctx.fill()
      ctx.beginPath(); ctx.ellipse(x + 0.5, eyeY + 0.3, 1.8, focused ? 2.5 : 2.8, 0, 0, Math.PI * 2); ctx.fillStyle = ink; ctx.fill()
      ctx.beginPath(); ctx.ellipse(x + 0.5, eyeY + 1.4, 1.4, 1.1, 0, 0, Math.PI * 2)
      ctx.fillStyle = character === "hana" ? c.hanaShirt : character === "nabi" ? c.good : character === "pengu" ? c.sea : c.shorts; ctx.fill()
      ctx.fillStyle = c.cloud; ctx.beginPath(); ctx.arc(x + 1.1, eyeY - 1.1, 0.9, 0, Math.PI * 2); ctx.fill()
      ctx.beginPath(); ctx.arc(x - 0.4, eyeY + 1.6, 0.4, 0, Math.PI * 2); ctx.fill()
      ctx.lineWidth = 1.9; ctx.beginPath(); ctx.moveTo(x - 2.6, eyeY - (focused ? 2.4 : 3)); ctx.quadraticCurveTo(x + 0.5, eyeY - (focused ? 3.6 : 4.2), x + 2.9, eyeY - (focused ? 2.6 : 3)); ctx.stroke()
      if (focused) { ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x - 2.5, eyeY - 5.6); ctx.lineTo(x + 2.5, eyeY - 4.8 + (x < 0 ? 0.8 : -0.4)); ctx.stroke() }
    }
  }
  // Mouth.
  ctx.lineWidth = 1.5
  if (pose === "cheer") { ctx.beginPath(); ctx.moveTo(1, 3); ctx.quadraticCurveTo(3, 6.5, 5.5, 3); ctx.closePath(); ctx.fillStyle = c.danger; ctx.fill(); ctx.stroke() }
  else if (pose === "run" || pose === "dash" || pose === "tired") { ctx.beginPath(); ctx.ellipse(3.6, 4, 1.2, pose === "tired" ? 1.6 : 1.1, 0, 0, Math.PI * 2); ctx.fillStyle = ink; ctx.fill() }
  else if (pose === "fall" || pose === "hit") { ctx.beginPath(); ctx.moveTo(1.5, 4.5); ctx.lineTo(2.5, 3.6); ctx.lineTo(3.5, 4.5); ctx.lineTo(4.5, 3.6); ctx.lineTo(5.5, 4.5); ctx.stroke() }
  else if (character !== "pengu") { ctx.beginPath(); ctx.arc(3.6, 2.6, 1.6, 0.2 * Math.PI, 0.8 * Math.PI); ctx.stroke() }
  // Blush hatching (anime cheek lines).
  if (character !== "pengu") {
    ctx.strokeStyle = c.danger; ctx.globalAlpha = 0.55; ctx.lineWidth = 0.9
    for (const bx of [-4.5, 7.5]) for (const d of [0, 1.6]) { ctx.beginPath(); ctx.moveTo(bx + d, 1); ctx.lineTo(bx + d - 1, 2.6); ctx.stroke() }
    ctx.globalAlpha = 1; ctx.strokeStyle = ink
  }
}
