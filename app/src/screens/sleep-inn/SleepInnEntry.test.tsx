import React from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest'
import { initializeCanonicalJournalFixture } from '../../test/canonical-journal-fixture'
import { deleteEntry, loadEntries, nextJournalSavedAt, saveEntry, updateEntry, type EveningEntry, type PostSessionEntry } from '../../domain/journal-store'
import { setActiveLocalAccount } from '../../domain/account/local-journal-ownership'
import { beginBrowserPopNavigation } from '../../navigation/browserNavigation'
import { useTaskFlowBack } from '../../hooks/useTaskFlowBack'
import type { SleepInnGameProps } from './types'

vi.mock('./SleepInnGame', () => ({ SleepInnGame: ({ onBack }: SleepInnGameProps) => <button onClick={onBack}>게임 닫기</button> }))
vi.mock('../pet-room/PetRoom', () => ({ PetRoom: ({ journal, onBack, onOpenJournal, journalLinkLabel }: SleepInnGameProps) => {
  const [turn, setTurn] = React.useState(0)
  return <section aria-label="게임 검사 화면"><p data-testid="sleep-context">{JSON.stringify(journal)}</p>
    <button onClick={() => setTurn(value => value + 1)}>게임 진행 {turn}</button>
    <button onClick={onOpenJournal}>{journalLinkLabel ?? '수면 일지 열기'}</button><button onClick={onBack}>게임 닫기</button></section>
} }))
import { SleepInnEntry, SleepInnLoungeEntry } from './SleepInnEntry'
import { EveningCheckin } from '../log-entry/EveningCheckin'

// Wait for the real lazy reader once, rather than treating cold transformation as a product timeout.
beforeAll(async () => { await import('../LogDetail') }, 60000)

const date = '2026-10-09'
const original: EveningEntry = { id: 'same-sleep-id', kind: 'evening', date, savedAt: '2026-10-09T01:00:00Z', syncState: 'local',
  sleepH: 6, sleepQuality: 3, mood: 4, weightKg: '65', restingHr: '52', painParts: {}, note: '',
  fieldProvenance: { sleepH: { provenance: 'EXPLICIT' }, sleepQuality: { provenance: 'EXPLICIT' }, mood: { provenance: 'EXPLICIT' },
    weightKg: { provenance: 'EXPLICIT' }, restingHr: { provenance: 'EXPLICIT' }, painParts: { provenance: 'MISSING' } } }

async function popTo(state: unknown) {
  await act(async () => {
    window.history.replaceState(state, '', '/')
    beginBrowserPopNavigation()
    window.dispatchEvent(new PopStateEvent('popstate', { state }))
    await Promise.resolve()
  })
}
beforeEach(async () => {
  localStorage.clear(); sessionStorage.clear(); setActiveLocalAccount(null)
  window.history.replaceState({}, '', '/')
  await initializeCanonicalJournalFixture()
})
afterEach(async () => { cleanup(); await popTo({}); vi.restoreAllMocks(); setActiveLocalAccount(null) })

it('opens the inn from a friend invitation without creating a journal or reopening after close', () => {
  window.history.replaceState({}, '', '/?app=1&games=lounge#sleep-inn=INN1.invalid')
  const back = vi.spyOn(window.history, 'back').mockImplementation(() => undefined)
  render(<SleepInnLoungeEntry />)
  expect(screen.getByRole('dialog', { name: '꿈손님 여관' })).toBeVisible()
  expect(loadEntries()).toHaveLength(0)
  fireEvent.click(screen.getByRole('button', { name: '게임 닫기' }))
  expect(screen.queryByRole('dialog', { name: '꿈손님 여관' })).toBeNull()
  expect(back).toHaveBeenCalledTimes(1)
})

it('returns to the lounge once by button or native Back without consuming the lounge flow', async () => {
  const leaveLounge = vi.fn()
  const back = vi.spyOn(window.history, 'back').mockImplementation(() => undefined)
  function Lounge() {
    useTaskFlowBack({ enabled: true, onBack: leaveLounge })
    return <div className="app-scroll-region"><SleepInnLoungeEntry /></div>
  }
  render(<React.StrictMode><Lounge /></React.StrictMode>)
  const loungeState = window.history.state
  const opener = screen.getByRole('button', { name: /우리 집 친구들/ })
  const region = opener.closest<HTMLElement>('.app-scroll-region')!
  region.scrollTop = 137
  opener.focus()
  fireEvent.click(opener)
  expect(screen.getByRole('dialog', { name: '우리 집 친구들' })).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: '게임 닫기' }))
  expect(screen.queryByRole('dialog', { name: '우리 집 친구들' })).toBeNull()
  expect(back).toHaveBeenCalledTimes(1)
  await popTo(loungeState)
  expect(leaveLounge).not.toHaveBeenCalled()
  expect(opener).toHaveFocus()
  expect(region.scrollTop).toBe(137)
  fireEvent.click(opener)
  expect(screen.getByRole('dialog', { name: '우리 집 친구들' })).toBeVisible()
  await popTo(loungeState)
  expect(screen.queryByRole('dialog', { name: '우리 집 친구들' })).toBeNull()
  expect(leaveLounge).not.toHaveBeenCalled()
  expect(opener).toHaveFocus()
})

it('edits the same real journal and returns to the still-mounted game after confirmed save', async () => {
  expect(saveEntry(original).ok).toBe(true)
  const saved = vi.fn()
  render(<SleepInnEntry date={date} entryId={original.id} onBack={vi.fn()} onJournalSaved={saved} />)
  fireEvent.click(screen.getByRole('button', { name: '게임 진행 0' }))
  const gameState = window.history.state
  const opener = screen.getByRole('button', { name: '수면 일지 열기' })
  const dialog = screen.getByRole('dialog', { name: '우리 집 친구들' })
  dialog.scrollTop = 127
  opener.focus()
  fireEvent.click(opener)
  fireEvent.change(screen.getByRole('textbox', { name: '수면 시간' }), { target: { value: '7.5' } })
  fireEvent.click(screen.getByRole('button', { name: '입력 확인으로' }))
  fireEvent.click(screen.getByRole('button', { name: '수정 저장' }))
  await waitFor(() => expect(loadEntries()[0]).toMatchObject({ id: original.id, date, sleepH: 7.5, mood: 4, weightKg: '65', restingHr: '52' }))
  await popTo(gameState)
  await waitFor(() => expect(saved).toHaveBeenCalledTimes(1))
  expect(loadEntries()).toHaveLength(1)
  expect(screen.getByRole('button', { name: '게임 진행 1' })).toBeVisible()
  expect(screen.getByTestId('sleep-context')).toHaveTextContent('7.5')
  await waitFor(() => expect(opener).toHaveFocus())
  expect(dialog.scrollTop).toBe(127)
})

it('does not choose the latest same-day record when several journals exist', () => {
  expect(saveEntry(original).ok).toBe(true)
  expect(saveEntry({ ...original, id: 'second', sleepH: 9 }).ok).toBe(true)
  render(<SleepInnEntry date={date} onBack={vi.fn()} />)
  fireEvent.click(screen.getByRole('button', { name: '수면 일지 열기' }))
  expect(screen.getByRole('alert')).toHaveTextContent('먼저 연결할 일지')
  expect(screen.queryByRole('textbox', { name: '수면 시간' })).toBeNull()
  fireEvent.change(screen.getByRole('combobox'), { target: { value: original.id } })
  fireEvent.click(screen.getByRole('button', { name: '수면 일지 열기' }))
  expect(screen.getByRole('textbox', { name: '수면 시간' })).toHaveValue('6')
})

it('keeps a stale editor open and never reports success when another writer changed the record', async () => {
  expect(saveEntry(original).ok).toBe(true)
  const saved = vi.fn()
  render(<SleepInnEntry date={date} entryId={original.id} onBack={vi.fn()} onJournalSaved={saved} />)
  fireEvent.click(screen.getByRole('button', { name: '수면 일지 열기' }))
  fireEvent.change(screen.getByRole('textbox', { name: '수면 시간' }), { target: { value: '7.5' } })
  act(() => { expect(updateEntry({ ...original, sleepH: 8, savedAt: nextJournalSavedAt(original.savedAt) }, original.savedAt).ok).toBe(true) })
  fireEvent.click(screen.getByRole('button', { name: '입력 확인으로' }))
  fireEvent.click(screen.getByRole('button', { name: '수정 저장' }))
  await screen.findByRole('alert')
  expect(loadEntries()[0]).toMatchObject({ id: original.id, sleepH: 8 })
  expect(saved).not.toHaveBeenCalled()
  expect(screen.getByRole('button', { name: '수정 저장' })).toBeVisible()
})

it('lets the user explicitly select the remaining record after the linked record is deleted', async () => {
  expect(saveEntry(original).ok).toBe(true)
  expect(saveEntry({ ...original, id: 'remaining', sleepH: 9 }).ok).toBe(true)
  render(<SleepInnEntry date={date} entryId={original.id} onBack={vi.fn()} />)
  act(() => { expect(deleteEntry(original.id).ok).toBe(true) })
  await screen.findByText(/연결했던 일지를 찾을 수 없어요/)
  expect(screen.getByTestId('sleep-context')).toHaveTextContent('unavailable')
  fireEvent.change(screen.getByRole('combobox'), { target: { value: 'remaining' } })
  fireEvent.click(screen.getByRole('button', { name: '수면 일지 열기' }))
  expect(screen.getByRole('textbox', { name: '수면 시간' })).toHaveValue('9')
  expect(loadEntries()).toHaveLength(1)
})

it('keeps an explicit disconnect until the remaining journal is selected without creating a duplicate', async () => {
  expect(saveEntry(original).ok).toBe(true)
  expect(saveEntry({ ...original, id: 'remaining', sleepH: 9 }).ok).toBe(true)
  render(<SleepInnEntry date={date} entryId={original.id} onBack={vi.fn()} />)
  act(() => { expect(deleteEntry(original.id).ok).toBe(true) })
  fireEvent.click(await screen.findByRole('button', { name: '기록 연결 해제' }))
  expect(screen.getByRole('combobox')).toHaveValue('')
  expect(JSON.parse(screen.getByTestId('sleep-context').textContent ?? '{}')).toEqual({
    date, status: 'missing', sourceLabel: '일지 연결 안 함',
  })
  fireEvent.click(screen.getByRole('button', { name: '수면 일지 열기' }))
  expect(screen.getByRole('alert')).toHaveTextContent('먼저 연결할 일지를 골라 주세요.')
  expect(screen.queryByRole('textbox', { name: '수면 시간' })).toBeNull()
  expect(loadEntries()).toHaveLength(1)
  fireEvent.change(screen.getByRole('combobox'), { target: { value: 'remaining' } })
  fireEvent.click(screen.getByRole('button', { name: '수면 일지 열기' }))
  expect(screen.getByRole('textbox', { name: '수면 시간' })).toHaveValue('9')
  expect(loadEntries()).toHaveLength(1)
})

it('opens a missing-date editor without changing the chosen date or declaring unsaved input recorded', () => {
  const saved = vi.fn()
  render(<SleepInnEntry date={date} onBack={vi.fn()} onJournalSaved={saved} />)
  fireEvent.click(screen.getByRole('button', { name: '수면 일지 열기' }))
  fireEvent.change(screen.getByRole('textbox', { name: '수면 시간' }), { target: { value: '25' } })
  fireEvent.click(screen.getByRole('button', { name: '입력 확인으로' }))
  expect(screen.getByRole('textbox', { name: '수면 시간' })).toHaveAttribute('aria-invalid', 'true')
  expect(document.querySelector(`time[datetime="${date}"]`)).not.toBeNull()
  expect(saved).not.toHaveBeenCalled()
  expect(loadEntries()).toHaveLength(0)
  fireEvent(screen.getByRole('dialog', { name: '우리 집 친구들' }), new Event('cancel', { cancelable: true }))
  expect(screen.getByRole('dialog', { name: '작성 중인 기록을 저장할까요?' })).toBeVisible()
})

it('routes native Back at the embedded form root through the existing unsaved dialog', async () => {
  const close = vi.fn()
  render(<SleepInnEntry date={date} onBack={close} />)
  const gameState = window.history.state
  fireEvent.click(screen.getByRole('button', { name: '수면 일지 열기' }))
  fireEvent.change(screen.getByRole('textbox', { name: '수면 시간' }), { target: { value: '7' } })
  await popTo(gameState)
  expect(screen.getByRole('dialog', { name: '작성 중인 기록을 저장할까요?' })).toBeVisible()
  expect(close).not.toHaveBeenCalled()
  expect(loadEntries()).toHaveLength(0)
})

it('preserves invalid raw input and selected date across the draft game roundtrip', async () => {
  render(<EveningCheckin targetDate={date} />)
  fireEvent.click(screen.getByRole('button', { name: '수면' }))
  fireEvent.change(screen.getByRole('textbox', { name: '수면 시간' }), { target: { value: '25' } })
  const originalState = window.history.state
  fireEvent.click(screen.getByRole('button', { name: '펫과 함께 자기' }))
  await screen.findByRole('dialog', { name: '우리 집 친구들' })
  expect(screen.getByTestId('sleep-context')).toHaveTextContent(date)
  expect(screen.getByTestId('sleep-context')).toHaveTextContent('draft')
  expect(JSON.parse(screen.getByTestId('sleep-context').textContent ?? '{}')).not.toHaveProperty('sleepH')
  fireEvent.click(screen.getByRole('button', { name: '수면 일지 열기' }))
  await popTo(originalState)
  await waitFor(() => expect(screen.queryByRole('dialog', { name: '우리 집 친구들' })).toBeNull())
  expect(screen.getByRole('textbox', { name: '수면 시간' })).toHaveValue('25')
  expect(screen.getByRole('textbox', { name: '수면 시간' })).toHaveAttribute('aria-invalid', 'true')
  expect(loadEntries()).toHaveLength(0)
})

it('unmounts the previous scope instead of showing it under a new account', async () => {
  expect(saveEntry(original).ok).toBe(true)
  const close = vi.fn()
  render(<SleepInnEntry date={date} onBack={close} />)
  act(() => setActiveLocalAccount('synthetic-other-owner'))
  await waitFor(() => expect(close).toHaveBeenCalled())
  expect(screen.queryByTestId('sleep-context')).toBeNull()
})

const source: PostSessionEntry = { id: 'exact-confirmed-session', kind: 'post-session', date,
  savedAt: '2026-10-09T01:00:00Z', syncState: 'local', system: 'base', title: '저장한 합성 훈련',
  memo: '', distanceKm: '', durationMin: '', avgPace: '', rpe: 0 }

it.each(['button', 'escape', 'native Back'] as const)('returns from the exact saved read-only journal by %s without replacing the room or completion', async exit => {
  expect(saveEntry(source).ok).toBe(true)
  expect(saveEntry({ ...source, id: 'other-same-day-entry', title: '다른 같은 날 합성 훈련' }).ok).toBe(true)
  const before = loadEntries()
  const parentState = window.history.state
  vi.spyOn(window.history, 'back').mockImplementation(() => undefined)
  function Completion() {
    const [open, setOpen] = React.useState(false)
    return <div className="app-scroll-region"><label>보존할 작성 자리<input defaultValue="합성 입력 유지" /></label><button onClick={() => setOpen(true)}>친구 방 열기</button>
      {open && <SleepInnEntry date={date} sourceJournal={{ entryId: source.id }} onBack={() => setOpen(false)} returnLabel="저장 완료로 돌아가기" />}</div>
  }
  render(<Completion />)
  const opener = screen.getByRole('button', { name: '친구 방 열기' })
  const region = opener.closest<HTMLElement>('.app-scroll-region')!
  region.scrollTop = 143; opener.focus(); fireEvent.click(opener)
  fireEvent.click(screen.getByRole('button', { name: '게임 진행 0' }))
  const gameState = window.history.state
  const book = screen.getByRole('button', { name: '저장한 일지 보기' })
  const dialog = screen.getByRole('dialog', { name: '우리 집 친구들' })
  dialog.scrollTop = 126; book.focus(); fireEvent.click(book)
  const reader = await screen.findByRole('region', { name: '저장한 일지' })
  await waitFor(() => expect(reader).toHaveTextContent(source.title))
  expect(dialog.scrollTop).toBe(0)
  expect(reader).not.toHaveTextContent('다른 같은 날 합성 훈련')
  expect(reader.querySelector('[data-testid="journal-manage-toggle"]')).toBeNull()
  expect(reader.querySelector('.journal-save-friends')).toBeNull()
  expect(screen.queryByRole('textbox', { name: '수면 시간' })).toBeNull()
  if (exit === 'button') fireEvent.click(screen.getByRole('button', { name: '친구 방으로 돌아가기' }))
  else if (exit === 'escape') fireEvent(dialog, new Event('cancel', { cancelable: true }))
  await popTo(gameState)
  expect(screen.queryByRole('region', { name: '저장한 일지' })).toBeNull()
  expect(screen.getByRole('button', { name: '게임 진행 1' })).toBeVisible()
  await waitFor(() => expect(book).toHaveFocus())
  expect(dialog.scrollTop).toBe(126)
  fireEvent.click(screen.getByRole('button', { name: '게임 닫기' }))
  await popTo(parentState)
  expect(screen.getByRole('textbox', { name: '보존할 작성 자리' })).toHaveValue('합성 입력 유지')
  expect(opener).toHaveFocus(); expect(region.scrollTop).toBe(143)
  expect(loadEntries()).toEqual(before)
})

it('does not substitute another same-day journal if the exact source was removed', async () => {
  expect(saveEntry({ ...source, id: 'remaining-source', title: '다른 같은 날 합성 훈련' }).ok).toBe(true)
  render(<SleepInnEntry date={date} sourceJournal={{ entryId: 'removed-exact-source' }} onBack={vi.fn()} />)
  fireEvent.click(screen.getByRole('button', { name: '저장한 일지 보기' }))
  expect(await screen.findByRole('status')).toHaveTextContent('저장한 일지를 지금 찾을 수 없어요')
  expect(screen.queryByText('다른 같은 날 합성 훈련')).toBeNull()
})

it('closes the saved-journal reader on an account change before displaying the next owner', async () => {
  expect(saveEntry(source).ok).toBe(true)
  const close = vi.fn()
  render(<SleepInnEntry date={date} sourceJournal={{ entryId: source.id }} onBack={close} />)
  fireEvent.click(screen.getByRole('button', { name: '저장한 일지 보기' }))
  await screen.findByText(source.title)
  act(() => setActiveLocalAccount('different-source-owner'))
  await waitFor(() => expect(close).toHaveBeenCalled())
  expect(screen.queryByRole('region', { name: '저장한 일지' })).toBeNull()
})

it('keeps an approved date-only entry as a date reader instead of choosing one same-day journal', async () => {
  expect(saveEntry(source).ok).toBe(true)
  expect(saveEntry({ ...source, id: 'second-date-source', title: '같은 날짜의 두 번째 합성 훈련' }).ok).toBe(true)
  render(<SleepInnEntry date={date} sourceJournal={{}} onBack={vi.fn()} />)
  fireEvent.click(screen.getByRole('button', { name: '이날 일지 보기' }))
  const reader = await screen.findByRole('region', { name: '이날 일지' })
  await waitFor(() => expect(reader).toHaveTextContent(source.title))
  expect(reader).toHaveTextContent('같은 날짜의 두 번째 합성 훈련')
  expect(reader.querySelector('[data-testid="journal-manage-toggle"]')).toBeNull()
  expect(screen.queryByRole('textbox', { name: '수면 시간' })).toBeNull()
})
