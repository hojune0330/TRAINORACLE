/**
 * Animated WebGPU backdrops for the treadmill minigame, built from the MIT-licensed
 * `shaders` package (https://github.com/shader-effects-inc/shaders).
 *
 * Contract:
 * - Loaded lazily and only when the browser exposes WebGPU. Otherwise nothing is fetched
 *   and the 2D canvas keeps painting its own sky (the fallback is the default path).
 * - Telemetry is always disabled, so the game still sends no network requests.
 * - Colours come from the --game-fx-* tokens; animation stops when reduced motion is on.
 */
import { burstPreset, skyPreset } from "./sky-presets"
import type { FxPalette, SkyScene } from "./sky-presets"

export type ShaderSky = {
  show(scene: SkyScene): void
  setMotion(reduced: boolean): void
  pause(): void
  resume(): void
  destroy(): void
}

export const FX_TOKENS = {
  trackA: "--game-fx-track-a", trackB: "--game-fx-track-b", trackMesh1: "--game-fx-track-mesh-1", trackMesh2: "--game-fx-track-mesh-2",
  trackMesh3: "--game-fx-track-mesh-3", trackRay: "--game-fx-track-ray", mudA: "--game-fx-mud-a", mudB: "--game-fx-mud-b",
  mudFlow1: "--game-fx-mud-flow-1", mudFlow2: "--game-fx-mud-flow-2", mudFlow3: "--game-fx-mud-flow-3", mudFlow4: "--game-fx-mud-flow-4",
  mudRay: "--game-fx-mud-ray", spikeA: "--game-fx-spike-a", spikeB: "--game-fx-spike-b", aurora1: "--game-fx-aurora-1",
  aurora2: "--game-fx-aurora-2", aurora3: "--game-fx-aurora-3", star: "--game-fx-star", burst: "--game-fx-burst",
  burstBg: "--game-fx-burst-bg", failA: "--game-fx-fail-a", failB: "--game-fx-fail-b",
} as const

export function fxPalette(element: HTMLElement): FxPalette {
  const css = getComputedStyle(element)
  return Object.fromEntries(Object.entries(FX_TOKENS).map(([key, name]) => [key, css.getPropertyValue(name).trim()])) as FxPalette
}

type GpuNavigator = { gpu?: { requestAdapter(): Promise<unknown> } }

/** True only when an adapter is actually granted, so the library is never fetched for nothing. */
export async function webGpuAvailable(): Promise<boolean> {
  const gpu = typeof navigator === "undefined" ? undefined : (navigator as GpuNavigator).gpu
  if (!gpu) return false
  try { return Boolean(await gpu.requestAdapter()) } catch { return false }
}

/** Reasons after which the shader will never draw again. */
const TERMINAL = /unsupported|no-adapter|no-device|init-failed|device-lost|out-of-memory|gpu-error|render-failed|limit-exceeded|unrecoverable|rebuild_failed/

/**
 * Mounts a shader backdrop on `canvas`. Resolves to null (leaving the canvas untouched)
 * when WebGPU is missing or refused; `onLost` fires if it fails later. In both cases the
 * caller keeps or restores the 2D sky.
 */
export async function mountShaderSky(canvas: HTMLCanvasElement, palette: FxPalette, reduced: boolean,
  onLost: () => void): Promise<ShaderSky | null> {
  if (!(await webGpuAvailable())) return null
  let lib: typeof import("shaders/js")
  try {
    lib = await import("shaders/js")
    if (!lib.isWebGPUSupported()) return null
  } catch { return null }

  let scene: SkyScene = "track"
  let motion = reduced
  let dead = false
  let paused = false
  let generation = 0
  const fail = (reason: string) => { if (!dead && TERMINAL.test(reason)) { dead = true; onLost() } }
  const build = () => scene === "clear" || scene === "over" ? burstPreset(scene, palette, motion) : skyPreset(scene, palette, motion)
  const create = () => lib.createShader(canvas, build() as never, { disableTelemetry: true, onError: fail })

  let instance: Awaited<ReturnType<typeof lib.createShader>> | null
  try { instance = await create() } catch { return null }
  if (dead || instance.getFailureReason()) { instance.destroy(); return null }

  const rebuild = async () => {
    const mine = ++generation
    try {
      const next = await create()
      if (mine !== generation || dead) { next.destroy(); return }
      instance?.destroy()
      instance = next
      if (paused) instance.pause()
    } catch { if (!dead) { dead = true; onLost() } }
  }
  return {
    show(next) { if (next !== scene) { scene = next; void rebuild() } },
    setMotion(value) { if (value !== motion) { motion = value; void rebuild() } },
    pause() { paused = true; instance?.pause() },
    resume() { paused = false; instance?.resume() },
    destroy() { generation++; dead = true; instance?.destroy(); instance = null },
  }
}
