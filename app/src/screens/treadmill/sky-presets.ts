/**
 * Layer trees for the `shaders` package, one per stage plus result screens.
 * Pure data so it can be unit-tested without a GPU. Colours are passed in from tokens.
 */
export type SkyScene = "track" | "mud" | "spikes" | "clear" | "over"

export type FxPalette = Record<
  | "trackA" | "trackB" | "trackMesh1" | "trackMesh2" | "trackMesh3" | "trackRay"
  | "mudA" | "mudB" | "mudFlow1" | "mudFlow2" | "mudFlow3" | "mudFlow4" | "mudRay"
  | "spikeA" | "spikeB" | "aurora1" | "aurora2" | "aurora3" | "star"
  | "burst" | "burstBg" | "failA" | "failB", string>

type Layer = { type: string; id: string; props: Record<string, unknown>; blendMode?: string; opacity?: number }
export type SkyPreset = { components: Layer[] }

const vertical = { start: { x: 0.5, y: 0 }, end: { x: 0.5, y: 1 } }

/** `still` zeroes every speed so reduced-motion users get a static painted sky. */
export function skyPreset(stage: "track" | "mud" | "spikes", c: FxPalette, still: boolean): SkyPreset {
  const s = (speed: number) => (still ? 0 : speed)
  if (stage === "track") return { components: [
    { type: "LinearGradient", id: "sky", props: { colorA: c.trackA, colorB: c.trackB, ...vertical } },
    { type: "MeshGradient", id: "haze", opacity: 0.6, props: {
      stops: [{ color: c.trackMesh1, position: 0 }, { color: c.trackMesh2, position: 0.5 }, { color: c.trackMesh3, position: 1 }],
      count: 4, speed: s(0.5), drift: 0.3, swirl: 0.15, smoothness: 3 } },
    { type: "Godrays", id: "sun", blendMode: "screen", opacity: 0.45, props: {
      center: { x: 0.85, y: 0 }, rayColor: c.trackRay, intensity: 0.35, density: 0.2, speed: s(0.25), spotty: 0.2 } },
  ] }
  if (stage === "mud") return { components: [
    { type: "LinearGradient", id: "sky", props: { colorA: c.mudA, colorB: c.mudB, ...vertical } },
    { type: "FlowingGradient", id: "glow", opacity: 0.45, props: {
      colorA: c.mudFlow1, colorB: c.mudFlow2, colorC: c.mudFlow3, colorD: c.mudFlow4, speed: s(0.35), distortion: 0.35 } },
    { type: "Godrays", id: "sun", blendMode: "screen", opacity: 0.55, props: {
      center: { x: 0.82, y: 0.55 }, rayColor: c.mudRay, intensity: 0.5, density: 0.25, speed: s(0.15), spotty: 0.1 } },
  ] }
  return { components: [
    { type: "LinearGradient", id: "sky", props: { colorA: c.spikeA, colorB: c.spikeB, ...vertical } },
    { type: "Nebula", id: "nebula", blendMode: "screen", opacity: 0.55, props: {
      coreColor: c.aurora3, gasColor: c.aurora1, veilColor: c.spikeA, center: { x: 0.25, y: 0.3 }, scale: 2.2, density: 0.7, stars: 0, dust: 0.3 } },
    { type: "Aurora", id: "aurora", blendMode: "screen", opacity: 1, props: {
      colorA: c.aurora1, colorB: c.aurora2, colorC: c.aurora3, intensity: 90, speed: s(2.5), height: 140,
      center: { x: 0.5, y: 0 }, curtainCount: 3, waviness: 80 } },
    { type: "FloatingParticles", id: "stars", blendMode: "screen", props: {
      particleColor: c.star, count: 260, particleSize: 1.3, speed: s(0.04), twinkle: still ? 0 : 0.9, softness: 0.3 } },
  ] }
}

export function burstPreset(kind: "clear" | "over", c: FxPalette, still: boolean): SkyPreset {
  if (kind === "clear") return { components: [
    { type: "SunBurst", id: "burst", props: { color: c.burst, background: c.burstBg, rayCount: 16, radius: 1.2, speed: still ? 0 : 0.3, softness: 0.5, feather: 1.5 } },
  ] }
  return { components: [
    { type: "RadialGradient", id: "dim", props: { colorA: c.failA, colorB: c.failB, center: { x: 0.5, y: 0.35 }, radius: 1.1 } },
  ] }
}

/** Every animated prop in a preset, for tests and the reduced-motion contract. */
export function presetSpeeds(preset: SkyPreset): number[] {
  return preset.components.flatMap(layer => ["speed", "twinkle"].filter(key => key in layer.props).map(key => Number(layer.props[key])))
}
