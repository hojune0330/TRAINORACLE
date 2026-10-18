import React from 'react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { initializeCanonicalJournalFixture } from '../../test/canonical-journal-fixture'
import { setActiveLocalAccount } from '../../domain/account/local-journal-ownership'
import { beginBrowserPopNavigation } from '../../navigation/browserNavigation'
import { SleepInnEntry } from './SleepInnEntry'
import { activeJourney, parseState, storageKey } from './engine'

const date = '2026-10-09'
const key = storageKey('guest')!
async function popTo(state: unknown) {
  await act(async () => {
    window.history.replaceState(state, '', '/')
    beginBrowserPopNavigation()
    window.dispatchEvent(new PopStateEvent('popstate', { state }))
    await Promise.resolve()
  })
}
function Host({ onClose }: { onClose: () => void }) {
  const [open, setOpen] = React.useState(true)
  return open ? <SleepInnEntry date={date} returnLabel="라운지로" onBack={() => { onClose(); setOpen(false) }} /> : <p>라운지</p>
}
function enterPuzzle() {
  fireEvent.click(screen.getByRole('button', { name: '내 여관' }))
  fireEvent.click(screen.getByRole('button', { name: '이야기 건너뛰기' }))
  fireEvent.click(screen.getByRole('button', { name: '바로 쉬기' }))
  fireEvent.click(screen.getByRole('button', { name: '다시 왔어요' }))
  fireEvent.click(screen.getByRole('button', { name: '자리 정해 주기' }))
}
beforeEach(async () => {
  localStorage.clear(); sessionStorage.clear(); setActiveLocalAccount(null)
  window.history.replaceState({}, '', '/#sleep-inn=INN1.invalid')
  await initializeCanonicalJournalFixture()
})
afterEach(async () => { cleanup(); await popTo({}); vi.restoreAllMocks(); setActiveLocalAccount(null) })

it('blocks real native Back and Escape after a failed game write, then saves and closes exactly once', async () => {
  const close = vi.fn()
  const parentState = window.history.state
  const back = vi.spyOn(window.history, 'back').mockImplementation(() => undefined)
  const forward = vi.spyOn(window.history, 'forward').mockImplementation(() => undefined)
  render(<React.StrictMode><Host onClose={close} /></React.StrictMode>)
  const gameState = window.history.state
  enterPuzzle()
  const storedBefore = localStorage.getItem(key)!
  const write = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota') })
  fireEvent.click(screen.getByRole('button', { name: 'A1 모루' }))
  fireEvent.click(screen.getByRole('button', { name: 'B1 도담' }))
  expect(localStorage.getItem(key)).toBe(storedBefore)

  await popTo(parentState)
  expect(forward).toHaveBeenCalledTimes(1)
  expect(close).not.toHaveBeenCalled()
  expect(screen.getByRole('group', { name: '저장되지 않은 여관 나가기' })).toBeVisible()
  // A duplicate native event must not discard or close the pending board.
  await popTo(parentState)
  expect(close).not.toHaveBeenCalled()
  expect(localStorage.getItem(key)).toBe(storedBefore)
  await popTo(gameState)
  fireEvent(screen.getByRole('dialog', { name: '꿈손님 여관' }), new Event('cancel', { cancelable: true }))
  expect(close).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: '저장하고 돌아가기' }))
  expect(close).not.toHaveBeenCalled()
  write.mockRestore()
  fireEvent.click(screen.getByRole('button', { name: '저장하고 돌아가기' }))
  expect(close).toHaveBeenCalledTimes(1)
  expect(back).toHaveBeenCalledTimes(1)
  expect(activeJourney(parseState(localStorage.getItem(key)!)!).layout[0]).toBe('turtle')
  expect(screen.queryByRole('dialog', { name: '꿈손님 여관' })).toBeNull()
  await popTo(parentState)
  expect(close).toHaveBeenCalledTimes(1)
})

it.each([false, true])('preserves corrupt storage on native exit (unsaved action: %s)', async changed => {
  localStorage.setItem(key, '{broken')
  const raw = localStorage.getItem(key)
  const write = vi.spyOn(Storage.prototype, 'setItem')
  const back = vi.spyOn(window.history, 'back').mockImplementation(() => undefined)
  const close = vi.fn()
  render(<Host onClose={close} />)
  if (changed) {
    fireEvent.click(screen.getByRole('button', { name: '내 여관' }))
    fireEvent.click(screen.getByRole('button', { name: '이야기 건너뛰기' }))
  }
  fireEvent(screen.getByRole('dialog', { name: '꿈손님 여관' }), new Event('cancel', { cancelable: true }))
  if (changed) {
    expect(close).not.toHaveBeenCalled()
    expect(screen.getByRole('group', { name: '저장되지 않은 여관 나가기' })).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: '저장하지 않고 돌아가기' }))
  }
  expect(close).toHaveBeenCalledTimes(1)
  expect(back).toHaveBeenCalledTimes(1)
  expect(localStorage.getItem(key)).toBe(raw)
  expect(write.mock.calls.filter(([writtenKey]) => writtenKey === key)).toHaveLength(0)
})

it('honors explicit discard while native history is restoring without reopening or replacing the saved board', async () => {
  const parentState = window.history.state
  const close = vi.fn()
  vi.spyOn(window.history, 'back').mockImplementation(() => undefined)
  vi.spyOn(window.history, 'forward').mockImplementation(() => undefined)
  render(<Host onClose={close} />)
  const gameState = window.history.state
  enterPuzzle()
  const storedBefore = localStorage.getItem(key)
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota') })
  fireEvent.click(screen.getByRole('button', { name: 'A1 모루' }))
  fireEvent.click(screen.getByRole('button', { name: 'B1 도담' }))
  await popTo(parentState)
  fireEvent.click(screen.getByRole('button', { name: '저장하지 않고 돌아가기' }))
  expect(close).toHaveBeenCalledTimes(1)
  expect(screen.queryByRole('dialog', { name: '꿈손님 여관' })).toBeNull()
  expect(localStorage.getItem(key)).toBe(storedBefore)
  await popTo(gameState)
  expect(close).toHaveBeenCalledTimes(1)
  expect(screen.queryByRole('dialog', { name: '꿈손님 여관' })).toBeNull()
  expect(localStorage.getItem(key)).toBe(storedBefore)
})
