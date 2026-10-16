import { afterEach, describe, expect, it, vi } from 'vitest'

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules() })

async function fixture(fail: (url: string) => boolean) {
  const requested: string[] = []
  vi.stubGlobal('Image', class {
    naturalWidth = 256; naturalHeight = 256
    onload?: () => void; onerror?: () => void
    url = ''
    set src(url: string) {
      this.url = url; requested.push(url)
      queueMicrotask(() => fail(url) ? this.onerror?.() : this.onload?.())
    }
  })
  const art = await import('./scene-art')
  await art.loadSceneArt()
  const drawImage = vi.fn()
  return { art, requested, drawImage, context: { drawImage } as unknown as CanvasRenderingContext2D }
}

describe('optional world scenery', () => {
  it('preserves existing Seoul artwork when both collections load', async () => {
    const { art, drawImage, context } = await fixture(() => false)
    expect(art.drawSceneProp(context, 'tree', 60, 100, 48, 58)).toBe(true)
    expect(drawImage.mock.calls[0]?.[0].url).toContain('game/seoul-v1/tree.webp')
    expect(drawImage.mock.calls[0]?.slice(1)).toEqual([36, 42, 48, 58])
  })

  it('uses the new tree only when the legacy asset fails, aligned inside the same bounds', async () => {
    const { art, drawImage, context } = await fixture(url => url.includes('seoul-v1/tree.webp'))
    expect(art.drawSceneProp(context, 'tree', 60, 100, 48, 58)).toBe(true)
    const call = drawImage.mock.calls[0]!
    expect(call[0].url).toContain('image-library-v1/world/world-tree-broadleaf.webp')
    expect(call).toHaveLength(9)
    expect(call.slice(5)).toEqual([36, 42, 48, 58])
    expect(call[3]).toBeGreaterThan(0)
    expect(call[4]).toBeGreaterThan(0)
  })

  it('isolates missing art and leaves geometry available while other terrain still draws', async () => {
    const { art, drawImage, context } = await fixture(url => url.includes('tree'))
    expect(art.drawSceneProp(context, 'tree', 60, 100, 48, 58)).toBe(false)
    expect(drawImage).not.toHaveBeenCalled()
    expect(art.drawWorldProp(context, 'mud-patch', 60, 100, 68, 20)).toBe(true)
    expect(drawImage.mock.calls[0]?.[0].url).toContain('world-mud-patch.webp')
  })
})
