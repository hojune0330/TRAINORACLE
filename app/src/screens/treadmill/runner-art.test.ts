import { afterEach, describe, expect, it, vi } from "vitest"

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules() })

async function fixture() {
  const images: FakeImage[] = []
  class FakeImage {
    naturalWidth = 1024
    naturalHeight = 1024
    src = ""
    onload = () => {}
    onerror = () => {}
    constructor() { images.push(this) }
  }
  vi.stubGlobal("Image", FakeImage)
  return { art: await import("./runner-art"), images }
}

describe("Tori art loading and frame selection", () => {
  it("shares a request and waits for a complete atlas before replacing the fallback", async () => {
    const { art, images } = await fixture()
    const pending = art.loadToriArt()
    expect(art.loadToriArt()).toBe(pending)
    expect(images).toHaveLength(1)
    const context = { save: vi.fn(), restore: vi.fn(), scale: vi.fn(), drawImage: vi.fn() }
    const look = { pose: "run" as const, phase: Math.PI, upgrades: [] }
    expect(art.drawToriArt(context as unknown as CanvasRenderingContext2D, look)).toBe(false)
    images[0]!.onload()
    await expect(pending).resolves.toBe(true)
    expect(art.drawToriArt(context as unknown as CanvasRenderingContext2D, look)).toBe(true)
    expect(context.drawImage.mock.calls[0]!.slice(1, 5)).toEqual([0, 256, 256, 256])
    expect(art.drawToriArt(context as unknown as CanvasRenderingContext2D, { ...look, character: "hana" })).toBe(false)
    expect(context.restore).toHaveBeenCalledTimes(1)
  })

  it.each(["network", "size"])("keeps fallback usable on %s failure", async reason => {
    const { art, images } = await fixture()
    const pending = art.loadToriArt()
    if (reason === "network") images[0]!.onerror()
    else { images[0]!.naturalHeight = 512; images[0]!.onload() }
    await expect(pending).resolves.toBe(false)
    expect(art.drawToriArt({} as CanvasRenderingContext2D, { pose: "idle", phase: 0, upgrades: [] })).toBe(false)
  })

  it("loops eight run frames and selects jump poses from flight stage", async () => {
    const { art } = await fixture()
    const look = { pose: "run" as const, phase: 0, upgrades: [] }
    expect(Array.from({ length: 8 }, (_, i) => art.toriFrame({ ...look, phase: i * Math.PI / 4 }))).toEqual([0,1,2,3,4,5,6,7])
    expect(art.toriFrame({ ...look, phase: 2 * Math.PI })).toBe(0)
    expect(art.toriFrame({ ...look, phase: -Math.PI / 4 })).toBe(7)
    expect(art.toriFrame({ ...look, phase: NaN })).toBe(0)
    expect(([0,1,2] as const).map(jumpStage => art.toriFrame({ ...look, pose: "jump", phase: 99, jumpStage }))).toEqual([10,11,12])
  })
})
