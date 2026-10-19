import React from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { JournalSaveResult } from './JournalSaveResult'
import { PetJournalSaveLink } from './PetJournalSaveLink'
import { capturePetJournalScope, PET_JOURNAL_EVENT, recordConfirmedPetJournalSave } from '../domain/pet-journal-progress'
import { setActiveLocalAccount } from '../domain/account/local-journal-ownership'
import { careDay, createHome, petHomeKey } from '../screens/pet-room/pet-engine'
import { PET_IDS } from '../screens/pet-room/pet-catalog'
import type { SleepInnEntryProps } from '../screens/sleep-inn/SleepInnEntry'

vi.mock('../screens/sleep-inn/SleepInnEntry', () => ({ SleepInnEntry: ({ date, sourceJournal, startWithJournalMeeting, onBack, returnLabel }: SleepInnEntryProps) => <section role="dialog" aria-label="친구 연결 검사"><p>{date} · {sourceJournal?.entryId}</p><p>{startWithJournalMeeting ? '만남으로 진입' : '방으로 진입'}</p><button onClick={onBack}>{returnLabel}</button></section> }))
const owner = 'completion-fixture'
const journal = { id: 'confirmed-synthetic-id', date: '2026-10-20', kind: 'evening' }
beforeEach(() => {
  localStorage.clear(); setActiveLocalAccount(owner)
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(2026, 9, 20, 12))
})
afterEach(() => { cleanup(); setActiveLocalAccount(null); vi.useRealTimers(); vi.restoreAllMocks() })
function homeWithDays(count: number) {
  const home = createHome(careDay(), 1, owner)
  home.journal.days = Array.from({ length: count }, (_, i) => `2026-10-${String(20 - i).padStart(2, '0')}`)
  localStorage.setItem(petHomeKey(owner), JSON.stringify(home))
}

it('shows committed progress without writing and opens only the explicit originating-journal shortcut', async () => {
  homeWithDays(3)
  const write = vi.spyOn(Storage.prototype, 'setItem')
  render(<PetJournalSaveLink journal={journal} />)
  expect(screen.getByText('일지로 만나는 친구 · 3/7일')).toBeVisible()
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(write).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: '우리 집 친구들' }))
  const dialog = await screen.findByRole('dialog', { name: '친구 연결 검사' })
  expect(dialog).toHaveTextContent(`${journal.date} · ${journal.id}`)
  expect(dialog).toHaveTextContent('방으로 진입')
  fireEvent.click(screen.getByRole('button', { name: '저장 완료로 돌아가기' }))
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(screen.getByText('일지로 만나는 친구 · 3/7일')).toBeVisible()
  expect(write).not.toHaveBeenCalled()
})

it('refreshes a persisted seventh day and enters the meeting only after the user asks', async () => {
  homeWithDays(6)
  render(<PetJournalSaveLink journal={journal} />)
  homeWithDays(7)
  act(() => window.dispatchEvent(new Event(PET_JOURNAL_EVENT)))
  expect(screen.getByText('친구 만남 기회 1번이 있어요')).toBeVisible()
  expect(screen.queryByRole('dialog')).toBeNull()
  const before = localStorage.getItem(petHomeKey(owner))
  fireEvent.click(screen.getByRole('button', { name: '친구 만나기' }))
  expect(await screen.findByRole('dialog')).toHaveTextContent('만남으로 진입')
  expect(localStorage.getItem(petHomeKey(owner))).toBe(before)
})

it('does not turn a past save or unavailable storage into a zero-count success', () => {
  const write = vi.spyOn(Storage.prototype, 'setItem')
  const view = render(<PetJournalSaveLink journal={{ ...journal, date: '2026-10-19' }} />)
  expect(screen.getByText('이 날짜는 오늘 친구 진행에 더해지지 않아요.')).toBeVisible()
  expect(screen.getByRole('button', { name: '우리 집 친구들' })).toBeVisible()
  expect(screen.queryByText(/0\/7/)).toBeNull()
  localStorage.setItem(petHomeKey(owner), '{corrupt')
  write.mockClear()
  view.rerender(<PetJournalSaveLink journal={journal} />)
  act(() => window.dispatchEvent(new Event(PET_JOURNAL_EVENT)))
  expect(screen.getByText('일지는 저장됐어요. 친구 진행을 확인하지 못했어요.')).toBeVisible()
  expect(screen.queryByText(/0\/7/)).toBeNull()
  expect(write).not.toHaveBeenCalled()
})

it('keeps confirmed journal success separate from pet write failure and retries only its receipt', async () => {
  const write = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw Error('quota') })
  expect(await recordConfirmedPetJournalSave(journal, capturePetJournalScope())).toBe('UNAVAILABLE')
  render(<JournalSaveResult result={{ count: 1, phase: 'enter', receipt: { kind: 'generic', savedDate: journal.date }, storageStatus: 'CONFIRMED', savedJournal: journal }} onClose={vi.fn()} manageBrowserBack={false} />)
  expect(screen.getByRole('heading', { name: /기록을 남겼어요/ })).toBeVisible()
  expect(document.querySelector('.journal-save-result')).toHaveAttribute('data-storage-state', 'confirmed')
  expect(screen.getByText('일지는 저장됐어요. 친구 진행은 반영하지 못했어요.')).toBeVisible()
  write.mockRestore()
  fireEvent.click(screen.getByRole('button', { name: '친구 진행 다시 확인' }))
  await waitFor(() => expect(screen.getByText('일지로 만나는 친구 · 1/7일')).toBeVisible())
  expect(screen.queryByRole('button', { name: '친구 진행 다시 확인' })).toBeNull()
  expect(document.querySelector('.journal-save-result')).toHaveAttribute('data-storage-state', 'confirmed')
})

it.each(['PENDING', 'CONFLICT'] as const)('does not present a friend shortcut for %s journal storage', storageStatus => {
  homeWithDays(7)
  render(<JournalSaveResult result={{ count: 1, phase: 'enter', receipt: { kind: 'generic', savedDate: journal.date }, storageStatus, savedJournal: journal }} onClose={vi.fn()} manageBrowserBack={false} />)
  expect(screen.queryByRole('button', { name: '친구 만나기' })).toBeNull()
  expect(screen.queryByLabelText('일지와 친구들')).toBeNull()
})

it('drops the prior owner shortcut on account change instead of reading another home', () => {
  homeWithDays(7)
  render(<PetJournalSaveLink journal={journal} />)
  expect(screen.getByRole('button', { name: '친구 만나기' })).toBeVisible()
  act(() => setActiveLocalAccount('another-completion-owner'))
  expect(screen.queryByLabelText('일지와 친구들')).toBeNull()
  expect(localStorage.getItem(petHomeKey('another-completion-owner'))).toBeNull()
})

it('keeps earned opportunities without offering a nonexistent meeting after all friends are owned', () => {
  homeWithDays(7)
  const home = createHome(careDay(), 1, owner)
  home.journal.days = Array.from({ length: 7 }, (_, i) => `2026-10-${String(20 - i).padStart(2, '0')}`)
  for (const id of PET_IDS) home.pets[id] = { metOn: careDay(), caredDays: [], actions: { pet: [], feed: [], play: [], bed: [] }, adoptedOn: careDay() }
  const before = JSON.stringify(home)
  localStorage.setItem(petHomeKey(owner), before)
  render(<PetJournalSaveLink journal={journal} />)
  expect(screen.getByText('친구 만남 기회 1번이 있어요')).toBeVisible()
  expect(screen.queryByRole('button', { name: '친구 만나기' })).toBeNull()
  expect(screen.getByRole('button', { name: '우리 집 친구들' })).toBeVisible()
  expect(localStorage.getItem(petHomeKey(owner))).toBe(before)
})
