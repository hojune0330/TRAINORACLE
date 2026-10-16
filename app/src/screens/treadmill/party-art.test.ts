import { afterEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { cleanup, fireEvent, render } from '@testing-library/react'

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.useRealTimers(); vi.resetModules() })
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
  it('draws the new single-frame effect without atlas cropping and expires it', async () => {
    vi.stubGlobal('Image', class {
      naturalWidth = 512; naturalHeight = 224; onload?: () => void
      set src(_value: string) { queueMicrotask(() => this.onload?.()) }
    })
    const { loadPartyArt, drawPartyEffect } = await import('./party-art')
    await loadPartyArt()
    const drawImage = vi.fn(), save = vi.fn(), restore = vi.fn()
    const ctx = { drawImage, save, restore, globalAlpha: 1 } as unknown as CanvasRenderingContext2D
    expect(drawPartyEffect(ctx, 'fx-dash-trail', 100, 80, 100, .2)).toBe(true)
    const call = drawImage.mock.calls[0]!
    expect(call).toHaveLength(5)
    expect(call.slice(1)).toEqual([50, 58.125, 100, 43.75])
    expect(save).toHaveBeenCalledOnce()
    expect(restore).toHaveBeenCalledOnce()
    for (const age of [-1, .36, .6, NaN]) expect(drawPartyEffect(ctx, 'fx-dash-trail', 100, 80, 100, age)).toBe(false)
    expect(drawImage).toHaveBeenCalledOnce()
  })
  it('keeps reduced effects static at their full size and returns false when missing', async () => {
    vi.stubGlobal('Image', class {
      naturalWidth = 256; naturalHeight = 256; onload?: () => void
      set src(_value: string) { queueMicrotask(() => this.onload?.()) }
    })
    const { loadPartyArt, drawPartyEffect } = await import('./party-art')
    const drawImage = vi.fn(), ctx = { drawImage, save: vi.fn(), restore: vi.fn(), globalAlpha: 1 } as unknown as CanvasRenderingContext2D
    expect(drawPartyEffect(ctx, 'fx-hit-burst', 40, 50, 60, .1, true)).toBe(false)
    await loadPartyArt()
    drawPartyEffect(ctx, 'fx-hit-burst', 40, 50, 60, .01, true)
    drawPartyEffect(ctx, 'fx-hit-burst', 40, 50, 60, .4, true)
    expect(drawImage.mock.calls[0]?.slice(1)).toEqual([10, 20, 60, 60])
    expect(drawImage.mock.calls[1]?.slice(1)).toEqual([10, 20, 60, 60])
    expect(drawPartyEffect(ctx, 'fx-hit-burst', 40, 50, 60, .48, true)).toBe(false)
  })
  it('falls back from a failed reward to the old image and then its supplied fallback', async () => {
    const { PartyIcon } = await import('./PartyIcon')
    const { container, rerender } = render(createElement(PartyIcon, { id: 'reward-victory-medal', fallback: '이미지 없음' }))
    expect(container.querySelector('img')?.getAttribute('src')).toContain('image-library-v1/fx/reward-victory-medal.webp')
    fireEvent.error(container.querySelector('img')!)
    expect(container.querySelector('img')?.getAttribute('src')).toContain('run-party-v3/upgrade-core.webp')
    fireEvent.error(container.querySelector('img')!)
    expect(container.textContent).toBe('이미지 없음')
    rerender(createElement(PartyIcon, { id: 'reward-star' }))
    expect(container.querySelector('img')?.getAttribute('src')).toContain('image-library-v1/fx/reward-star.webp')
  })
})
