import React from 'react'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { PetRoom } from './PetRoom'
import { careDay, careFor, createHome, parseHome, petHomeKey, sleepTogether } from './pet-engine'
import { petById } from './pet-catalog'
import { careVoice, PET_VOICES } from './pet-personality'

const props = { persistenceScope: 'guest', journal: { date: '2026-01-01', status: 'missing' as const }, onBack: vi.fn(), onOpenJournal: vi.fn(), onOldGame: vi.fn() }
beforeEach(() => { localStorage.clear(); localStorage.setItem(petHomeKey('guest'), JSON.stringify(createHome(careDay(), 123))) })
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks() })
const stored = () => parseHome(localStorage.getItem(petHomeKey('guest'))!)!

it('records real today, shows care poses, and restores sleeping pets after remount', () => {
  const view = render(<PetRoom {...props} />)
  const id = stored().selected
  fireEvent.click(screen.getByRole('button', { name: '간식 주기' }))
  expect(stored().pets[id]!.caredDays).toEqual([careDay()])
  expect(stored().pets[id]!.actions.feed).toEqual([careDay()])
  expect(screen.getByText(careVoice(id, 'feed', 0))).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: /^같이 자기/ }))
  expect(stored().sleeping).not.toBeNull()
  view.unmount()
  render(<PetRoom {...props} />)
  expect(screen.getByRole('region', { name: '친구들이 함께 자는 방' })).toBeVisible()
  fireEvent.click(screen.getAllByRole('button', { name: /살짝 깨우기/ })[0]!)
  fireEvent.click(screen.getByRole('button', { name: '다시 같이 자기' }))
  expect(stored().pets[id]!.actions.bed).toHaveLength(1)
  fireEvent.click(screen.getByRole('button', { name: '다 잤어, 일어나자' }))
  expect(stored().sleeping).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: '수면 일지 열기' }))
  expect(props.onOpenJournal).toHaveBeenCalledTimes(1)
  expect(stored()).not.toHaveProperty('sleepH')
})

it('never shows saved care or adoption after a storage failure', () => {
  render(<PetRoom {...props} />)
  const before = localStorage.getItem(petHomeKey('guest'))
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw Error('quota') })
  fireEvent.click(screen.getByRole('button', { name: '쓰다듬기' }))
  expect(screen.getByRole('alert')).toHaveTextContent('저장되지 않았어요')
  expect(localStorage.getItem(petHomeKey('guest'))).toBe(before)
  expect(screen.queryByText(careVoice(stored().selected, 'pet', 0))).toBeNull()
})

it('shows a failed room selection inside the open details and offers reload without losing stored care', () => {
  render(<PetRoom {...props} />)
  const before = localStorage.getItem(petHomeKey('guest'))
  const name = petById(stored().selected).name
  fireEvent.click(screen.getByRole('button', { name: '입양 조건' }))
  const failure = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw Error('quota') })
  fireEvent.click(screen.getByRole('button', { name: `${name} 돌보러 가기` }))
  const details = within(screen.getByRole('dialog'))
  expect(details.getByRole('alert')).toHaveTextContent('저장되지 않았어요')
  expect(localStorage.getItem(petHomeKey('guest'))).toBe(before)
  failure.mockRestore()
  fireEvent.click(details.getByRole('button', { name: '다시 불러오기' }))
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(screen.queryByRole('alert')).toBeNull()
  expect(stored().pets).toEqual(parseHome(before!)!.pets)
})

it('adopts only after a completed mission set and keeps the pet after reopening', () => {
  const start = new Date(); start.setDate(start.getDate() - 6)
  let ready = createHome(careDay(start), 123)
  const id = ready.selected
  for (const mission of petById(id).missions) for (let i = 0; i < mission.days; i++) {
    const date = new Date(start); date.setDate(date.getDate() + i)
    ready = careFor(ready, id, mission.action, careDay(date))
  }
  // Keep this known visitor invited through today's daily visitor refresh.
  ready.invited = id
  localStorage.setItem(petHomeKey('guest'), JSON.stringify(ready))
  const view = render(<PetRoom {...props} />)
  fireEvent.click(screen.getByRole('button', { name: '입양 조건' }))
  fireEvent.click(screen.getByRole('button', { name: '우리 집으로 입양하기' }))
  expect(stored().pets[id]!.adoptedOn).toBe(careDay())
  expect(screen.getByText('우리 집 식구가 됐어요')).toBeVisible()
  view.unmount()
  render(<PetRoom {...props} />)
  expect(screen.getByText(`${petById(id).animal} · 우리 집 식구`)).toBeVisible()
})

it('shows both exact adoption routes, disallows early adoption, and closes details before exiting', () => {
  let canExit: (() => boolean) | null = null
  render(<PetRoom {...props} onCanExitReady={callback => { canExit = callback }} />)
  fireEvent.click(screen.getByRole('button', { name: '입양 조건' }))
  expect(screen.getByText('0 / 30일')).toBeVisible()
  expect(screen.getByText('또는 아래 미션 3개를 모두 끝내기')).toBeVisible()
  expect(screen.queryByRole('button', { name: '우리 집으로 입양하기' })).toBeNull()
  expect(canExit).not.toBeNull()
  let exited = true
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
  expect(screen.queryByRole('dialog')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: '입양 조건' }))
  // The host's native Back gate consumes the detail layer first.
  act(() => { exited = canExit!() })
  expect(exited).toBe(false)
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(canExit!()).toBe(true)
})

it('cares for the pet shown on screen when midnight passes without a focus change', () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 9, 18, 23, 59))
  const home = createHome(careDay(), 123)
  localStorage.setItem(petHomeKey('guest'), JSON.stringify(home))
  render(<PetRoom {...props} />)
  expect(screen.getByRole('region', { name: `${petById(home.selected).name} 돌보기` })).toBeVisible()
  vi.setSystemTime(new Date(2026, 9, 19, 0, 1))
  fireEvent.click(screen.getByRole('button', { name: '간식 주기' }))
  expect(stored().selected).toBe(home.selected)
  expect(stored().pets[home.selected]!.actions.feed).toEqual(['2026-10-19'])
  expect(stored().visitors).toEqual(home.visitors)
})

it('puts the visible guests to bed after midnight, not newly drawn unseen guests', () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 9, 18, 23, 59))
  const home = createHome(careDay(), 123)
  localStorage.setItem(petHomeKey('guest'), JSON.stringify(home))
  render(<PetRoom {...props} />)
  vi.setSystemTime(new Date(2026, 9, 19, 0, 1))
  fireEvent.click(screen.getByRole('button', { name: /^같이 자기/ }))
  expect(stored().sleeping).toEqual({ day: '2026-10-19', pets: home.visitors })
  expect(stored().pets[home.selected]!.actions.bed).toEqual(['2026-10-19'])
})

it('keeps the same pet for morning greeting across reload, then keeps that companion alongside new visitors', () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 9, 19, 8))
  const night = sleepTogether(createHome('2026-10-18', 123), '2026-10-18')
  localStorage.setItem(petHomeKey('guest'), JSON.stringify(night))
  const view = render(<PetRoom {...props} />)
  fireEvent.click(screen.getByRole('button', { name: '다 잤어, 일어나자' }))
  expect(stored().selected).toBe(night.selected)
  expect(stored().visitors).toEqual(night.visitors)
  expect(screen.getByText(PET_VOICES[night.selected].wake)).toBeVisible()
  expect(stored().sleeping).toBeNull()
  view.unmount()
  render(<PetRoom {...props} />)
  expect(screen.getByRole('region', { name: '함께 잔 친구들과 아침 인사' })).toBeVisible()
  expect(screen.queryByRole('button', { name: '간식 주기' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: '오늘도 같이 지내기' }))
  expect(stored().selected).toBe(night.selected)
  expect(stored().visitors).not.toContain(night.selected)
  expect(stored().invited).toBe(night.selected)
  expect(stored().morning).toBeNull()
  expect(stored().pets[night.selected]).toEqual(night.pets[night.selected])
  expect(screen.getByRole('button', { name: '간식 주기' })).toBeVisible()
})

it('shows personal reactions without awarding duplicate care and saves the actual moment in the album', () => {
  render(<PetRoom {...props} />)
  const id = stored().selected
  fireEvent.click(screen.getByRole('button', { name: '같이 놀기' }))
  expect(screen.getByText(careVoice(id, 'play', 0))).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: /같이 놀기/ }))
  expect(screen.getByText(careVoice(id, 'play', 1))).toBeVisible()
  expect(stored().pets[id]!.actions.play).toEqual([careDay()])
  fireEvent.click(screen.getByRole('button', { name: '입양 조건' }))
  const album = within(screen.getByRole('region', { name: `${petById(id).name}과의 추억` }))
  expect(album.getByText('처음 같이 논 날')).toBeVisible()
  expect(album.queryByText('첫 간식')).toBeNull()
})

it('returns from an adopted pet\'s details to the sleeping room without waking anyone', () => {
  const home = createHome(careDay(), 123)
  const id = home.selected
  home.pets[id]!.adoptedOn = careDay()
  localStorage.setItem(petHomeKey('guest'), JSON.stringify(sleepTogether(home, careDay())))
  render(<PetRoom {...props} />)
  fireEvent.click(screen.getByRole('button', { name: /친구들 3\/12/ }))
  fireEvent.click(screen.getByRole('button', { name: new RegExp(`${petById(id).name}.*우리 집 식구`) }))
  fireEvent.click(screen.getByRole('button', { name: '잠든 방으로 돌아가기' }))
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(screen.getByRole('region', { name: '친구들이 함께 자는 방' })).toBeVisible()
  expect(stored().sleeping).not.toBeNull()
  expect(screen.getByRole('button', { name: '우리 방' })).toHaveFocus()
})
