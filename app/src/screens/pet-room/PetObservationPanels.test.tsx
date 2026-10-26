import React from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createHome, sleepTogether, wakeTogether, type PetHome } from './pet-engine'
import { OBSERVATION_ITEMS, OBSERVATION_SLOTS, activeObservationNight, photographObservation } from './pet-observation'
import { PetNightSetup } from './PetNightSetup'
import { PetMorningObservation } from './PetMorningObservation'
import { PetObservationAlbum } from './PetObservationAlbum'
import { PET_IDS, petById } from './pet-catalog'

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 9, 26, 12)) })
afterEach(() => { cleanup(); vi.useRealTimers() })
function otterHome(): PetHome {
  const home = createHome('2026-10-25', 41)
  home.pets.otter = { ...home.pets[home.selected]! }
  home.visitors = ['otter']
  home.selected = 'otter'
  return home
}
const morning = () => wakeTogether(sleepTogether(otterHome(), '2026-10-25', '2026-10-26'), '2026-10-26')
const morningActions = () => ({ onPhotograph: vi.fn(), onFinish: vi.fn(), onRest: vi.fn(), onOpenAlbum: vi.fn() })

it('keeps the actual saved layout when placing an item fails', () => {
  const home = otterHome()
  const onCommit = vi.fn(() => false)
  render(<PetNightSetup home={home} onCommit={onCommit} onContinue={vi.fn()} onClose={vi.fn()} />)
  fireEvent.click(screen.getByRole('button', { name: '낮은 쿠션 침대 옆에 놓기' }))
  expect(onCommit).toHaveBeenCalledOnce()
  expect(screen.getByRole('button', { name: '침대 옆, 작은 공' })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByRole('button', { name: '작은 공, 놓여 있어요' })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.queryByText('침대 옆에 낮은 쿠션을 놓았어요.')).toBeNull()
  expect(screen.getByRole('button', { name: /작은 인형, 함께 3일/ })).toBeDisabled()
})

it('previews only the selected pet and the next two sleeping companions when many pets are adopted', () => {
  const home = otterHome()
  for (const id of PET_IDS) home.pets[id] = { metOn: '2026-10-25', caredDays: [], actions: { pet: [], feed: [], play: [], bed: [] }, adoptedOn: '2026-10-25' }
  home.selected = 'rabbit'
  render(<PetNightSetup home={home} onCommit={vi.fn(() => true)} onContinue={vi.fn()} onClose={vi.fn()} />)
  const roster = screen.getByLabelText('오늘 함께 잘 친구들')
  const names = Array.from(roster.querySelectorAll('small')).map(item => item.textContent)
  expect(names).toEqual(['rabbit', 'otter', 'seal'].map(id => petById(id as typeof home.selected).name))
  expect(roster.querySelectorAll('.pet-sprite')).toHaveLength(3)
})

it('limits the wake-date control to today or tomorrow instead of locking the room for months', () => {
  render(<PetNightSetup home={otterHome()} onCommit={vi.fn(() => true)} onContinue={vi.fn()} onClose={vi.fn()} />)
  const date = screen.getByLabelText('일어날 날짜')
  const proceed = screen.getByRole('button', { name: '이대로 잠자리 준비' })
  expect(date).toHaveAttribute('min', '2026-10-26')
  expect(date).toHaveAttribute('max', '2026-10-27')
  fireEvent.change(date, { target: { value: '2027-03-01' } })
  expect(proceed).toBeDisabled()
  expect(screen.getByText('일어날 날짜는 오늘이나 내일로 골라 주세요.')).toBeVisible()
  fireEvent.change(date, { target: { value: '2026-10-26' } })
  expect(proceed).toBeEnabled()
  fireEvent.change(date, { target: { value: '2026-10-27' } })
  expect(proceed).toBeEnabled()
})

it('does not reveal a frozen result before the morning has been opened', () => {
  const sleeping = sleepTogether(otterHome(), '2026-10-25', '2026-10-26')
  const { container } = render(<PetMorningObservation home={sleeping} {...morningActions()} />)
  expect(container).toBeEmptyDOMElement()
})

it('reveals the tapped observation and only claims a photo after confirmed home state changes', () => {
  const home = morning()
  const result = activeObservationNight(home)!.results.find(item => item.status === 'used')!
  const actions = morningActions()
  const view = render(<PetMorningObservation home={home} {...actions} />)
  expect(screen.queryByText(result.description)).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: /동글 모습 보기/ }))
  expect(screen.getByText(result.description)).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: '이 모습 사진첩에 담기' }))
  expect(actions.onPhotograph).toHaveBeenCalledWith(result.id)
  expect(screen.queryByText('사진첩에 담았어요')).toBeNull()
  view.rerender(<PetMorningObservation home={photographObservation(home, result.id)} {...actions} />)
  expect(screen.getByRole('button', { name: '사진첩에 담았어요' })).toBeDisabled()
})

it('shows an unused item without fabricating a pet interaction or photo', () => {
  const home = morning()
  const night = activeObservationNight(home)!
  const result = night.results.find(item => item.status === 'untouched')!
  render(<PetMorningObservation home={home} {...morningActions()} />)
  fireEvent.click(screen.getByRole('button', { name: `${OBSERVATION_SLOTS.find(slot => slot.id === result.slot)!.label}, ${OBSERVATION_ITEMS.find(item => item.id === result.itemId)!.label} 모습 보기` }))
  expect(screen.getByText(result.description)).toBeVisible()
  expect(screen.queryByRole('button', { name: '이 모습 사진첩에 담기' })).toBeNull()
})

it('keeps an observed but unphotographed moment out of the photo album', () => {
  const home = morning()
  const view = render(<PetObservationAlbum home={home} onClose={vi.fn()} />)
  expect(screen.getByText('아직 담아 둔 사진이 없어요.')).toBeVisible()
  const result = activeObservationNight(home)!.results.find(item => item.status === 'used')!
  view.rerender(<PetObservationAlbum home={photographObservation(home, result.id)} onClose={vi.fn()} />)
  expect(screen.queryByText('아직 담아 둔 사진이 없어요.')).toBeNull()
  expect(screen.getByRole('button', { name: /사진 크게 보기/ })).toBeVisible()
})
