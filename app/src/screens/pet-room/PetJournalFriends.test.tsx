import React, { useState } from 'react'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { PetJournalMeeting, PetJournalProgress } from './PetJournalFriends'
import { careDay, confirmJournalDay, createHome, journalFriendCredits, parseHome, persistHome, petHomeKey, type PetHome } from './pet-engine'
import { PET_IDS, petById } from './pet-catalog'

beforeEach(() => { localStorage.clear(); vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(2026, 9, 19, 12)) })
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.useRealTimers() })
function ready() {
  let home = createHome('2026-10-01', 15)
  for (let i = 1; i <= 7; i++) { const date = `2026-10-${String(i).padStart(2, '0')}`; home = confirmJournalDay(home, { date, kind: 'evening' }, date) }
  return home
}
function Host({ initial = ready(), onClose = () => {} }: { initial?: PetHome; onClose?: () => void }) {
  const [home, setHome] = useState(initial)
  const [raw, setRaw] = useState(() => localStorage.getItem(petHomeKey('guest')))
  const [error, setError] = useState<string | null>(null)
  const commit = (next: PetHome) => {
    const result = persistHome(localStorage, 'guest', next, raw)
    if (!result.ok) { setError(result.error); return false }
    setRaw(result.raw); setHome(result.home); return true
  }
  return <PetJournalMeeting home={home} commit={commit} error={error} onReload={() => setError(null)} onClose={onClose} />
}
it('keeps the meeting optional, shows the nonconsecutive progress and never opens a modal itself', () => {
  render(<PetJournalProgress home={ready()} unavailable={false} onMeet={vi.fn()} pendingError={null} onRetry={vi.fn()} />)
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(screen.getByRole('button', { name: '친구 만나기' })).toBeVisible()
  expect(screen.getByText('어떻게 만나나요?')).toBeVisible()
})
it('saves one random proposal before showing it, preserves it after cancel/reload and consumes only on explicit adoption', () => {
  const close = vi.fn()
  const first = render(<Host onClose={close} />)
  fireEvent.click(screen.getByRole('button', { name: '랜덤 친구 만나기' }))
  const proposal = parseHome(localStorage.getItem(petHomeKey('guest'))!)!
  expect(proposal.journal.pending).not.toBeNull()
  expect(journalFriendCredits(proposal)).toBe(1)
  const name = petById(proposal.journal.pending!.id).name
  expect(screen.getByRole('button', { name: `${name}, 우리 집으로 입양하기` })).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: '나중에 만날게' }))
  expect(close).toHaveBeenCalledOnce()
  first.unmount()
  render(<Host initial={proposal} />)
  fireEvent.click(screen.getByRole('button', { name: '랜덤 친구 다시 보기' }))
  fireEvent.click(screen.getByRole('button', { name: '직접 고르기로 바꾸기' }))
  expect(parseHome(localStorage.getItem(petHomeKey('guest'))!)!.journal.pending).toEqual(proposal.journal.pending)
  expect(journalFriendCredits(parseHome(localStorage.getItem(petHomeKey('guest'))!)!)).toBe(1)
  fireEvent.click(screen.getByRole('button', { name: '만나는 방법 다시 고르기' }))
  fireEvent.click(screen.getByRole('button', { name: '랜덤 친구 다시 보기' }))
  fireEvent.click(screen.getByRole('button', { name: `${name}, 우리 집으로 입양하기` }))
  const adopted = parseHome(localStorage.getItem(petHomeKey('guest'))!)!
  expect(adopted.pets[proposal.journal.pending!.id]?.adoptedOn).toBe(careDay())
  expect(journalFriendCredits(adopted)).toBe(0)
  expect(screen.getByRole('heading', { name: `${name}, 우리 집에 온 걸 환영해!` })).toHaveFocus()
})
it('offers all forty-eight in twelve-friend pages and clears a hidden page selection', () => {
  render(<Host />)
  fireEvent.click(screen.getByRole('button', { name: '직접 고르기' }))
  const choices = screen.getByRole('group', { name: '입양할 친구 선택' })
  expect(within(choices).getAllByRole('button')).toHaveLength(12)
  fireEvent.click(within(choices).getByRole('button', { name: '동글 · 수달' }))
  expect(screen.getByRole('button', { name: '동글, 우리 집으로 입양하기' })).toBeEnabled()
  fireEvent.click(screen.getByRole('button', { name: '다음 친구 12명' }))
  expect(screen.getByRole('button', { name: '친구를 골라 주세요' })).toBeDisabled()
  for (let i = 0; i < 2; i++) fireEvent.click(screen.getByRole('button', { name: '다음 친구 12명' }))
  expect(screen.getByRole('button', { name: '다음 친구 12명' })).toBeDisabled()
  expect(within(choices).getByRole('button', { name: '이끼 · 이끼거북' })).toBeVisible()
})
it('shows no adoption celebration or lost credit after quota failure, and lets the user leave', () => {
  render(<Host />)
  fireEvent.click(screen.getByRole('button', { name: '랜덤 친구 만나기' }))
  const before = localStorage.getItem(petHomeKey('guest'))!
  const home = parseHome(before)!
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw Error('quota') })
  const name = petById(home.journal.pending!.id).name
  fireEvent.click(screen.getByRole('button', { name: `${name}, 우리 집으로 입양하기` }))
  expect(screen.getByRole('alert')).toHaveTextContent('저장되지 않았어요')
  expect(screen.queryByRole('heading', { name: /우리 집에 온 걸 환영해/ })).toBeNull()
  expect(localStorage.getItem(petHomeKey('guest'))).toBe(before)
  expect(journalFriendCredits(parseHome(before)!)).toBe(1)
  expect(screen.getByRole('button', { name: '나중에 만날게' })).toBeEnabled()
})
it('keeps credits with all forty-eight owned and offers no claim button', () => {
  const home = ready()
  for (const id of PET_IDS) home.pets[id] = { metOn: careDay(), caredDays: [], actions: { pet: [], feed: [], play: [], bed: [] }, adoptedOn: careDay() }
  render(<PetJournalProgress home={home} unavailable={false} onMeet={vi.fn()} pendingError={null} onRetry={vi.fn()} />)
  expect(screen.queryByRole('button', { name: '친구 만나기' })).toBeNull()
  expect(screen.getByText('모든 친구와 함께해요. 남은 만남 1번은 보관돼요.')).toBeVisible()
  expect(journalFriendCredits(home)).toBe(1)
})
