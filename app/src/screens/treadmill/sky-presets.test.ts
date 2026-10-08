import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { burstPreset, presetSpeeds, skyPreset } from "./sky-presets"
import type { FxPalette } from "./sky-presets"
import { FX_TOKENS } from "./shader-sky"

const tokens = readFileSync("../colors_and_type.css", "utf8")
const palette = Object.fromEntries(Object.entries(FX_TOKENS).map(([key, name]) => {
  const match = new RegExp(`${name}:\\s*(#[0-9A-Fa-f]{6});`).exec(tokens)
  return [key, match?.[1] ?? ""]
})) as FxPalette

const scenes = [
  ...(["track", "mud", "spikes"] as const).map(stage => [stage, (still: boolean) => skyPreset(stage, palette, still)] as const),
  ...(["clear", "over"] as const).map(kind => [kind, (still: boolean) => burstPreset(kind, palette, still)] as const),
]

describe("treadmill shader sky presets", () => {
  it("resolves every fx token to a #rrggbb colour the shader props accept", () => {
    for (const [key, value] of Object.entries(palette)) expect(value, key).toMatch(/^#[0-9A-Fa-f]{6}$/u)
  })
  it("uses only token colours: every colour prop in every scene comes from the palette", () => {
    const allowed = new Set(Object.values(palette))
    for (const [name, build] of scenes) {
      const colours = JSON.stringify(build(false)).match(/#[0-9A-Fa-f]{3,8}/gu) ?? []
      expect(colours.length, name).toBeGreaterThan(0)
      for (const colour of colours) expect(allowed.has(colour), `${name} ${colour}`).toBe(true)
    }
  })
  it("animates normally and freezes every speed and twinkle under reduced motion", () => {
    for (const [name, build] of scenes.filter(([scene]) => scene !== "over")) {
      expect(presetSpeeds(build(false)).some(speed => speed > 0), name).toBe(true)
      expect(presetSpeeds(build(true)), name).toEqual(presetSpeeds(build(true)).map(() => 0))
    }
  })
  it("gives each stage its own look", () => {
    const signature = (stage: "track" | "mud" | "spikes") => skyPreset(stage, palette, false).components.map(layer => layer.type).join("+")
    expect(new Set([signature("track"), signature("mud"), signature("spikes")]).size).toBe(3)
  })
})

describe("treadmill shader sky boundary", () => {
  const source = readFileSync("src/screens/treadmill/shader-sky.ts", "utf8")
  it("always disables the package telemetry, on the first mount and on every rebuild", () => {
    const creates = source.match(/lib\.createShader\(/gu) ?? []
    expect(creates.length).toBeGreaterThan(0)
    expect((source.match(/disableTelemetry: true/gu) ?? []).length).toBe(creates.length)
    expect(source).not.toMatch(/disableTelemetry: (false|!)/u)
  })
  it("loads the package lazily and only behind a WebGPU check", () => {
    expect(source).not.toMatch(/^import [^\n]*from "shaders/mu)
    expect(source).toMatch(/if \(!\(await webGpuAvailable\(\)\)\) return null[\s\S]*await import\("shaders\/js"\)/u)
    expect(source).toMatch(/requestAdapter\(\)/u)
  })
  it("is the only app module that reaches for the shaders package", async () => {
    const { readdirSync, statSync } = await import("node:fs")
    const { join } = await import("node:path")
    const walk = (dir: string): string[] => readdirSync(dir).flatMap(name => {
      const path = join(dir, name)
      return statSync(path).isDirectory() ? walk(path) : /\.(tsx?|css)$/u.test(name) ? [path] : []
    })
    const users = walk("src").filter(path => !path.endsWith(".test.ts") && /["']shaders(\/[a-z]+)?["']/u.test(readFileSync(path, "utf8")))
    expect(users).toEqual([join("src", "screens", "treadmill", "shader-sky.ts")])
  })
})
