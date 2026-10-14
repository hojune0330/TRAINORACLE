import { afterEach, describe, expect, it, vi } from 'vitest'

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); vi.resetModules() })
describe('optional party art', () => {
  it('finishes its finite clip and suppresses motion when requested', async () => {
    const { partyEffectFrame } = await import('./party-art')
    expect(partyEffectFrame(0, false)).toBe(0)
    expect(partyEffectFrame(.639, false)).toBe(7)
    for (const time of [-1, .64, 8, NaN]) expect(partyEffectFrame(time, false)).toBeNull()
    expect(partyEffectFrame(.2, true)).toBeNull()
  })
  it('settles stalled downloads without drawing missing art or blocking the caller', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('Image', class { set src(_value: string) {} })
    const { loadPartyArt, drawPartyProp } = await import('./party-art')
    const done = vi.fn(); const pending = loadPartyArt().then(done)
    await vi.advanceTimersByTimeAsync(4000); await pending
    expect(done).toHaveBeenCalledOnce()
    const drawImage = vi.fn()
    expect(drawPartyProp({ drawImage } as unknown as CanvasRenderingContext2D, 'jump-pad', 40, 40, 48)).toBe(false)
    expect(drawImage).not.toHaveBeenCalled()
  })
  it('uses atlas crop for animation and a static icon for reduced motion', async () => {
    vi.stubGlobal('Image', class {
      naturalWidth = 1024; naturalHeight = 512; onload?: () => void
      set src(_value: string) { queueMicrotask(() => this.onload?.()) }
    })
    const { loadPartyArt, drawPartyProp } = await import('./party-art')
    await loadPartyArt()
    const drawImage = vi.fn(), ctx = { drawImage } as unknown as CanvasRenderingContext2D
    expect(drawPartyProp(ctx, 'supply-capsule', 40, 60, 48, .16)).toBe(true)
    expect(drawImage.mock.calls[0]).toHaveLength(9)
    expect(drawImage.mock.calls[0]?.slice(1,5)).toEqual([512,0,256,256])
    drawPartyProp(ctx, 'supply-capsule', 40, 60, 48, .16, true)
    expect(drawImage.mock.calls[1]).toHaveLength(5)
  })
})
