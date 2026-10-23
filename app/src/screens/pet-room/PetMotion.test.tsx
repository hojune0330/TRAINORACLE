import React from 'react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { PetMotion } from './PetMotion'
import { motionFrame, motionPosition, type PetMotionClip } from './pet-motion'
import { PetBedtimeScene } from './PetBedtimeScene'
import { PetCareScene } from './PetCareScene'

const preference = vi.hoisted(() => ({ reduced: false }))
vi.mock('../../hooks/useCalendarMotion', () => ({ useCalendarMotion: () => preference }))
const clip: PetMotionClip = { sheet: 'fixture.webp', columns: 4, rows: 2, frames: 7, fps: 10, loop: false, restFrame: 6 }
afterEach(() => { cleanup(); preference.reduced = false; vi.unstubAllGlobals(); vi.restoreAllMocks() })

it('keeps the final pose, uses the reduced-motion pose, and never displays an unused atlas cell', () => {
  expect(motionFrame(clip, 100_000)).toBe(6)
  expect(motionFrame({ ...clip, loop: true }, 700)).toBe(0)
  expect(motionFrame(clip, 0, true)).toBe(6)
  expect(motionPosition(clip, 6)).toBe('66.66666666666666% 100%')
})

function images() {
  const created: Array<{ onload: (() => void) | null; onerror: (() => void) | null; naturalWidth: number; naturalHeight: number; src: string }> = []
  vi.stubGlobal('Image', class {
    onload = null
    onerror = null
    naturalWidth = 1024
    naturalHeight = 512
    src = ''
    constructor() { created.push(this) }
  })
  return created
}
function animationClock() {
  let nextId = 0
  const requests = new Map<number, FrameRequestCallback>()
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { requests.set(++nextId, callback); return nextId })
  vi.stubGlobal('cancelAnimationFrame', (id: number) => requests.delete(id))
  return (now: number) => act(() => {
    const pending = [...requests.values()]
    requests.clear()
    pending.forEach(callback => callback(now))
  })
}
it('keeps static art available on a missing sheet and ignores an image that arrives after leaving', () => {
  const created = images()
  const ready = vi.fn()
  const onEnd = vi.fn()
  const view = render(<PetMotion clip={clip} active onReady={ready} onEnd={onEnd} />)
  act(() => created[0]!.onerror!())
  expect(ready).toHaveBeenLastCalledWith(false)
  expect(onEnd).toHaveBeenCalledTimes(1)
  const staleLoad = created[0]!.onload!
  view.unmount()
  act(staleLoad)
  expect(ready).toHaveBeenCalledTimes(1)
  expect(onEnd).toHaveBeenCalledTimes(1)
})
it('cancels animation work when a scene is covered and does not schedule motion for reduced motion', () => {
  const created = images()
  const request = vi.fn(() => 81)
  const cancel = vi.fn()
  vi.stubGlobal('requestAnimationFrame', request)
  vi.stubGlobal('cancelAnimationFrame', cancel)
  const ready = vi.fn()
  const view = render(<PetMotion clip={clip} active onReady={ready} />)
  act(() => created[0]!.onload!())
  expect(request).toHaveBeenCalledTimes(1)
  view.rerender(<PetMotion clip={clip} active={false} onReady={ready} />)
  expect(cancel).toHaveBeenCalledWith(81)
  expect(request).toHaveBeenCalledTimes(1)
  preference.reduced = true
  view.rerender(<PetMotion clip={clip} active onReady={ready} />)
  expect(request).toHaveBeenCalledTimes(1)
  expect(view.container.firstChild).toHaveStyle({ backgroundPosition: '66.66666666666666% 100%' })
})
it('holds the last frame for a full frame, then finishes once without counting time while covered', () => {
  const created = images()
  const tick = animationClock()
  const onEnd = vi.fn()
  const onReady = vi.fn()
  const view = render(<PetMotion clip={clip} active onReady={onReady} onEnd={onEnd} />)
  act(() => created[0]!.onload!())
  for (let now = 0; now <= 600; now += 100) tick(now)
  expect(onEnd).not.toHaveBeenCalled()
  view.rerender(<PetMotion clip={clip} active={false} onReady={onReady} onEnd={onEnd} />)
  tick(5000)
  expect(onEnd).not.toHaveBeenCalled()
  view.rerender(<PetMotion clip={clip} active onReady={onReady} onEnd={onEnd} />)
  tick(5100)
  expect(onEnd).not.toHaveBeenCalled()
  tick(5200)
  tick(5300)
  expect(onEnd).toHaveBeenCalledTimes(1)
})
it('keeps the previous sheet visible while the next loads and ignores a superseded download', () => {
  const created = images()
  const tick = animationClock()
  const onReady = vi.fn()
  const view = render(<PetMotion clip={clip} active onReady={onReady} />)
  act(() => created[0]!.onload!())
  tick(0); tick(100)
  const previousPosition = (view.container.firstChild as HTMLElement).style.backgroundPosition
  const second = { ...clip, sheet: 'second.webp' }
  view.rerender(<PetMotion clip={second} active onReady={onReady} />)
  expect(view.container.firstChild).toHaveStyle({ opacity: '1', backgroundPosition: previousPosition })
  expect((view.container.firstChild as HTMLElement).style.backgroundImage).toContain('fixture.webp')
  const lateLoad = created[1]!.onload!
  view.rerender(<PetMotion clip={{ ...clip, sheet: 'third.webp' }} active onReady={onReady} />)
  act(lateLoad)
  expect((view.container.firstChild as HTMLElement).style.backgroundImage).toContain('fixture.webp')
  act(() => created[2]!.onload!())
  expect((view.container.firstChild as HTMLElement).style.backgroundImage).toContain('third.webp')
})
it('settles into breathing sleep without completing bedtime, including reduced motion', () => {
  const created = images()
  const tick = animationClock()
  const onFinish = vi.fn()
  const view = render(<PetBedtimeScene companions={['cat']} onFinish={onFinish} onClose={vi.fn()} error={null} onReload={vi.fn()} />)
  fireEvent.click(screen.getByRole('button', { name: '친구들 이불 펴 주기' }))
  expect(created.at(-1)!.src).toContain('cat-lie-down.webp')
  act(() => created.at(-1)!.onload!())
  for (let now = 0; now <= 2600; now += 100) tick(now)
  expect(created.at(-1)!.src).toContain('cat-sleep.webp')
  expect(onFinish).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: '커튼 닫아 주기' }))
  expect(onFinish).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: '불 끄고 같이 자기' }))
  expect(onFinish).toHaveBeenCalledTimes(1)
  view.unmount()
  preference.reduced = true
  render(<PetBedtimeScene companions={['cat']} onFinish={onFinish} onClose={vi.fn()} error={null} onReload={vi.fn()} />)
  fireEvent.click(screen.getByRole('button', { name: '친구들 이불 펴 주기' }))
  act(() => created.at(-1)!.onload!())
  expect(created.at(-1)!.src).toContain('cat-sleep.webp')
  expect(onFinish).toHaveBeenCalledTimes(1)
})
it('shows eating before the thank-you and never saves again when its animation finishes', () => {
  const created = images()
  const tick = animationClock()
  const onComplete = vi.fn(() => true)
  render(<PetCareScene id="cat" action="feed" turn={0} onComplete={onComplete} onClose={vi.fn()} error={null} onReload={vi.fn()} />)
  fireEvent.click(screen.getByRole('button', { name: '간식 그릇 들기' }))
  fireEvent.click(screen.getByRole('button', { name: '그릇 놓을 자리' }))
  expect(screen.getByText('냠냠, 간식을 먹고 있어.')).toBeVisible()
  expect(onComplete).toHaveBeenCalledTimes(1)
  expect(created.at(-1)!.src).toContain('cat-eat.webp')
  act(() => created.at(-1)!.onload!())
  for (let now = 0; now <= 2600; now += 100) tick(now)
  expect(screen.queryByText('냠냠, 간식을 먹고 있어.')).not.toBeInTheDocument()
  expect(created.at(-1)!.src).toContain('cat-idle.webp')
  expect(onComplete).toHaveBeenCalledTimes(1)
})
