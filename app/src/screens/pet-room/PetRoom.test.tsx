import React from 'react'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { PetRoom } from './PetRoom'
import { careDay, careFor, confirmJournalDay, createHome, parseHome, petHomeKey, sleepTogether } from './pet-engine'
import { PET_IDS, petById, type PetId } from './pet-catalog'
import { careVoice } from './pet-personality'
import { PET_PLAY } from './pet-play'

// UI behavior runs after a granted room lease. Cross-tab/unsupported/awaited
// acquisition is exercised separately in the coordinator's boundary tests.
vi.mock('../../domain/pet-home-lock', () => ({ acquirePetHomeLease: () => ({ then: (ready: (lease: { ok: true; release: () => void }) => void) => { ready({ ok: true, release: () => {} }) } }) }))

it('does not add care when a scene is opened, abandoned or closed through the host Back gate', () => {
  let canExit: (() => boolean) | null = null
  render(<PetRoom {...props} onCanExitReady={callback => { canExit = callback }} />)
  const before = localStorage.getItem(petHomeKey('guest'))
  fireEvent.click(screen.getByRole('button', { name: '간식 주기' }))
  fireEvent.click(screen.getByRole('button', { name: '그릇 놓을 자리' }))
  expect(localStorage.getItem(petHomeKey('guest'))).toBe(before)
  act(() => { expect(canExit!()).toBe(false) })
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(canExit!()).toBe(true)
  openBed()
  fireEvent.click(screen.getByRole('button', { name: '친구들 이불 펴 주기' }))
  fireEvent.click(screen.getByRole('button', { name: '커튼 닫아 주기' }))
  fireEvent.click(screen.getByRole('button', { name: '방으로 돌아가기' }))
  expect(localStorage.getItem(petHomeKey('guest'))).toBe(before)
})

it('saves all current companions only when lights are switched off and uses the matching night art', () => {
  render(<PetRoom {...props} />)
  const before = stored()
  openBed()
  fireEvent.click(screen.getByRole('button', { name: '친구들 이불 펴 주기' }))
  fireEvent.click(screen.getByRole('button', { name: '커튼 닫아 주기' }))
  expect(stored()).toEqual(before)
  fireEvent.click(screen.getByRole('button', { name: '불 끄고 같이 자기' }))
  expect(stored().sleeping?.pets).toEqual(before.visitors)
  for (const id of before.visitors) expect(stored().pets[id]!.actions.bed).toEqual([careDay()])
  expect(screen.getByRole('button', { name: '우리 방' })).toHaveFocus()
  const room = screen.getByRole('region', { name: '친구들이 함께 자는 방' })
  expect(room.querySelector('img')).toHaveAttribute('src', '/games/pet-room-v1/room-sleep-v2.webp')
})

it('opens only earned story scenes and reading a story never changes the care record', () => {
  render(<PetRoom {...props} />)
  const before = localStorage.getItem(petHomeKey('guest'))
  fireEvent.click(screen.getByRole('button', { name: new RegExp(stored().selected === 'puppy' ? '두부 이야기' : petById(stored().selected).name + ' 이야기') }))
  const scene = within(screen.getByRole('dialog'))
  const chapters = scene.getByRole('navigation', { name: '이야기 장면 고르기' })
  expect(within(chapters).getAllByRole('button').filter(button => !(button as HTMLButtonElement).disabled)).toHaveLength(1)
  fireEvent.click(scene.getByRole('button', { name: '친구한테 돌아가기' }))
  expect(localStorage.getItem(petHomeKey('guest'))).toBe(before)
})

const props = { persistenceScope: 'guest', journal: { date: '2026-01-01', status: 'missing' as const }, onBack: vi.fn(), onOpenJournal: vi.fn(), onOldGame: vi.fn() }
beforeEach(() => { localStorage.clear(); localStorage.setItem(petHomeKey('guest'), JSON.stringify(createHome(careDay(), 123))) })
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks() })
const stored = () => parseHome(localStorage.getItem(petHomeKey('guest'))!)!

it('earns the first keepsake through care, previews without saving, then restores the explicitly placed prop', () => {
  const view = render(<PetRoom {...props} />)
  fireEvent.click(screen.getByRole('button', { name: '쓰다듬기' }))
  for (let i = 0; i < 3; i++) fireEvent.click(screen.getByRole('button', { name: '살살 한 번 더' }))
  expect(screen.getByText('새 소품! 발도장 액자')).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: '소품 놓으러 가기' }))
  const beforeChoice = localStorage.getItem(petHomeKey('guest'))
  fireEvent.click(screen.getByRole('button', { name: /새싹 화분 아직 없어요/ }))
  expect(within(screen.getByRole('dialog')).getByRole('button', { name: '간식 주러 가기' })).toBeEnabled()
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: '간식 주러 가기' }))
  expect(screen.getByRole('dialog')).toHaveTextContent('간식 주기')
  expect(localStorage.getItem(petHomeKey('guest'))).toBe(beforeChoice)
  fireEvent.click(screen.getByRole('button', { name: '방으로 돌아가기' }))
  fireEvent.click(screen.getByRole('button', { name: /방 꾸미기/ }))
  fireEvent.click(screen.getByRole('button', { name: /발도장 액자 놓을 수 있어요/ }))
  expect(localStorage.getItem(petHomeKey('guest'))).toBe(beforeChoice)
  fireEvent.click(screen.getByRole('button', { name: '방으로 돌아가기' }))
  expect(stored().roomDecoration).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: /방 꾸미기/ }))
  fireEvent.click(screen.getByRole('button', { name: /발도장 액자 놓을 수 있어요/ }))
  fireEvent.click(screen.getByRole('button', { name: '이 소품 놓기' }))
  expect(stored().roomDecoration).toBe('paw-frame')
  expect(screen.getByRole('button', { name: /방 꾸미기/ })).toHaveFocus()
  expect(stored().pets[stored().selected]!.actions.pet).toEqual([careDay()])
  view.unmount()
  render(<PetRoom {...props} />)
  expect(screen.getByRole('button', { name: '발도장 액자 추억 보기' })).toBeVisible()
})

it('shows a storage failure in the decoration sheet without closing or claiming placement', () => {
  const fresh = stored()
  localStorage.setItem(petHomeKey('guest'), JSON.stringify(careFor(fresh, fresh.selected, 'feed', careDay())))
  render(<PetRoom {...props} />)
  fireEvent.click(screen.getByRole('button', { name: /방 꾸미기/ }))
  fireEvent.click(screen.getByRole('button', { name: /새싹 화분 놓을 수 있어요/ }))
  const before = localStorage.getItem(petHomeKey('guest'))
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw Error('quota') })
  fireEvent.click(screen.getByRole('button', { name: '이 소품 놓기' }))
  expect(within(screen.getByRole('dialog')).getByRole('alert')).toHaveTextContent('저장되지 않았어요')
  expect(localStorage.getItem(petHomeKey('guest'))).toBe(before)
  expect(stored().roomDecoration).toBeNull()
})
it('returns focus after a cancelled journal meeting and brings a confirmed friend from the collection into the room', () => {
  const start = new Date(); start.setDate(start.getDate() - 8)
  let home = createHome(careDay(start), 123)
  for (let i = 0; i < 7; i++) {
    const date = new Date(start); date.setDate(date.getDate() + i)
    home = confirmJournalDay(home, { date: careDay(date), kind: 'evening' }, careDay(date))
  }
  localStorage.setItem(petHomeKey('guest'), JSON.stringify(home))
  render(<PetRoom {...props} />)
  const meet = screen.getByRole('button', { name: '친구 만나기' })
  meet.focus(); fireEvent.click(meet)
  const before = localStorage.getItem(petHomeKey('guest'))
  expect(document.querySelector('.pet-home__content')).toHaveProperty('inert', true)
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
  expect(meet).toHaveFocus()
  expect(localStorage.getItem(petHomeKey('guest'))).toBe(before)
  fireEvent.click(screen.getByRole('button', { name: /친구들/ }))
  fireEvent.click(meet)
  fireEvent.click(screen.getByRole('button', { name: '직접 고르기' }))
  fireEvent.click(screen.getByRole('button', { name: '동글 · 수달' }))
  fireEvent.click(screen.getByRole('button', { name: '동글, 우리 집으로 입양하기' }))
  fireEvent.click(screen.getByRole('button', { name: '친구와 방으로 가기' }))
  expect(screen.getByRole('button', { name: '우리 방' })).toHaveAttribute('aria-current', 'page')
  expect(screen.getByRole('button', { name: '우리 방' })).toHaveFocus()
  expect(stored().selected).toBe('otter')
  expect(stored().pets.otter?.adoptedOn).toBe(careDay())
  expect(stored().journal.claimed).toBe(1)
})
it('honors only an explicit saved-result meeting destination and cancels without consuming it', () => {
  const home = createHome(careDay(), 123)
  home.journal.days = Array.from({ length: 7 }, (_, i) => { const date = new Date(); date.setDate(date.getDate() - i); return careDay(date) })
  localStorage.setItem(petHomeKey('guest'), JSON.stringify(home))
  render(<PetRoom {...props} startWithJournalMeeting />)
  expect(screen.getByRole('dialog', { name: '일지로 친구 만나기' })).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: '나중에 만날게' }))
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(screen.getByRole('button', { name: '우리 방' })).toHaveFocus()
  expect(stored().journal.claimed).toBe(0)
  expect(stored().journal.pending).toBeNull()
})
it('keeps adopted friends while only the three visible companions enter this night', () => {
  const home = createHome(careDay(), 123)
  for (const id of PET_IDS) home.pets[id] = { metOn: careDay(), caredDays: [], actions: { pet: [], feed: [], play: [], bed: [] }, adoptedOn: careDay() }
  localStorage.setItem(petHomeKey('guest'), JSON.stringify(home))
  render(<PetRoom {...props} />)
  openBed()
  const scene = screen.getByRole('dialog')
  expect(scene.querySelectorAll('.pet-bedtime-friend')).toHaveLength(3)
  expect(scene).toHaveTextContent('3명이 함께 쉬어요.')
  quickBed()
  expect(stored().sleeping?.pets).toHaveLength(3)
  expect(PET_IDS.every(id => stored().pets[id]?.adoptedOn)).toBe(true)
})
function finishFeed() {
  const scene = within(screen.getByRole('dialog'))
  fireEvent.click(scene.getByRole('button', { name: '간식 그릇 들기' }))
  fireEvent.click(scene.getByRole('button', { name: '그릇 놓을 자리' }))
  fireEvent.click(scene.getByRole('button', { name: /^(간식 두고 )?방으로 가기$/ }))
}
function openBed() {
  fireEvent.click(screen.getByRole('button', { name: /^같이 자기/ }))
  fireEvent.change(screen.getByLabelText('일어날 날짜'), { target: { value: careDay() } })
  fireEvent.click(screen.getByRole('button', { name: '이대로 잠자리 준비' }))
}
function quickBed() {
  fireEvent.click(screen.getByRole('button', { name: '졸려요, 바로 재우기' }))
}
function finishPlay(id: PetId, turn: number, close = true) {
  const scene = within(screen.getByRole('dialog'))
  if (PET_PLAY[id].style === 'hide') {
    fireEvent.click(scene.getByRole('button', { name: '봤어! 숨겨 봐' }))
    fireEvent.click(scene.getByRole('button', { name: `${['왼쪽', '가운데', '오른쪽'][(turn + id.length) % 3]} 쿠션 들기` }))
  } else {
    fireEvent.click(scene.getByRole('button', { name: PET_PLAY[id].style === 'fetch' ? '왼쪽으로' : '공 굴리기' }))
    act(() => { vi.advanceTimersByTime(PET_PLAY[id].travelMs * 2) })
    fireEvent.click(scene.getByRole('button', { name: '공 받기' }))
  }
  if (close) fireEvent.click(scene.getByRole('button', { name: '방으로 가기' }))
}

it('restarts play in the same scene without duplicate care days or a second keepsake', () => {
  vi.useFakeTimers()
  render(<PetRoom {...props} />)
  const id = stored().selected
  fireEvent.click(screen.getByRole('button', { name: '같이 놀기' }))
  finishPlay(id, 0, false)
  expect(screen.getByText('새 소품! 장난감 바구니')).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: '한 번 더 놀기' }))
  expect(screen.queryByText('새 소품! 장난감 바구니')).toBeNull()
  finishPlay(id, 1, false)
  expect(stored().pets[id]!.actions.play).toEqual([careDay()])
  expect(stored().pets[id]!.caredDays).toEqual([careDay()])
  expect(screen.queryByText('새 소품! 장난감 바구니')).toBeNull()
  expect(screen.getByRole('button', { name: '한 번 더 놀기' })).toBeEnabled()
})

it('records real today, shows care poses, and restores sleeping pets after remount', () => {
  const view = render(<PetRoom {...props} />)
  const id = stored().selected
  fireEvent.click(screen.getByRole('button', { name: '간식 주기' }))
  expect(stored().pets[id]!.caredDays).toEqual([])
  finishFeed()
  expect(stored().pets[id]!.caredDays).toEqual([careDay()])
  expect(stored().pets[id]!.actions.feed).toEqual([careDay()])
  expect(screen.getByText(careVoice(id, 'feed', 0))).toBeVisible()
  openBed()
  quickBed()
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
  const scene = within(screen.getByRole('dialog'))
  for (let i = 0; i < 3; i++) fireEvent.click(scene.getByRole('button', { name: '살살 한 번 더' }))
  expect(scene.getByRole('alert')).toHaveTextContent('저장되지 않았어요')
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
  window.dispatchEvent(new Event('focus'))
  finishFeed()
  expect(stored().selected).toBe(home.selected)
  expect(stored().pets[home.selected]!.actions.feed).toEqual(['2026-10-19'])
  expect(stored().day).toBe('2026-10-19')
  expect(stored().visitors).not.toEqual(home.visitors)
  expect(stored().invited).toBe(home.selected)
})

it('puts the visible guests to bed after midnight, not newly drawn unseen guests', () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 9, 18, 23, 59))
  const home = createHome(careDay(), 123)
  localStorage.setItem(petHomeKey('guest'), JSON.stringify(home))
  render(<PetRoom {...props} />)
  vi.setSystemTime(new Date(2026, 9, 19, 0, 1))
  openBed()
  quickBed()
  expect(stored().sleeping).toEqual({ day: '2026-10-19', pets: home.visitors })
  expect(stored().pets[home.selected]!.actions.bed).toEqual(['2026-10-19'])
})

it('keeps the same pet for morning greeting across reload, then keeps that companion alongside new visitors', () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 9, 19, 8))
  const night = sleepTogether(createHome('2026-10-18', 123), '2026-10-18')
  localStorage.setItem(petHomeKey('guest'), JSON.stringify(night))
  const view = render(<PetRoom {...props} />)
  // A later-day return reveals the committed scene without another wake prompt.
  expect(screen.queryByRole('button', { name: '다 잤어, 일어나자' })).toBeNull()
  expect(stored().selected).toBe(night.selected)
  expect(stored().visitors).toEqual(night.visitors)
  expect(screen.getByRole('heading', { name: '어젯밤에 뭐 했니?' })).toBeVisible()
  expect(stored().sleeping).toBeNull()
  view.unmount()
  render(<PetRoom {...props} />)
  expect(screen.getByRole('region', { name: '어젯밤에 뭐 했니?' })).toBeVisible()
  expect(screen.queryByRole('button', { name: '간식 주기' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: '나도 일어났어' }))
  expect(stored().selected).toBe(night.selected)
  expect(stored().visitors).not.toContain(night.selected)
  expect(stored().invited).toBe(night.selected)
  expect(stored().morning).toBeNull()
  expect(stored().pets[night.selected]).toEqual(night.pets[night.selected])
  expect(screen.getByRole('button', { name: '간식 주기' })).toBeVisible()
  const previousResults = JSON.stringify(stored().observation.nights)
  const date = careDay()
  fireEvent.click(screen.getByRole('button', { name: new RegExp(`그대로 재우기.*${date.slice(5).replace('-', '/')}`) }))
  expect(stored().sleeping).not.toBeNull()
  expect(JSON.stringify(stored().observation.nights.slice(0, -1))).toBe(previousResults)
})

it('keeps a legacy sleeping home usable without inventing an old observation', () => {
  const old = createHome(careDay(), 123)
  old.sleeping = { day: careDay(), pets: old.visitors }
  const { observation: _observation, ...legacy } = old
  localStorage.setItem(petHomeKey('guest'), JSON.stringify(legacy))
  render(<PetRoom {...props} />)
  fireEvent.click(screen.getByRole('button', { name: '다 잤어, 일어나자' }))
  expect(screen.getByRole('region', { name: '함께 잔 친구들과 아침 인사' })).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: '나도 일어났어' }))
  expect(stored().morning).toBeNull()
  expect(stored().observation.nights).toEqual([])
})

it('shows personal reactions without awarding duplicate care and saves the actual moment in the album', () => {
  vi.useFakeTimers()
  render(<PetRoom {...props} />)
  const id = stored().selected
  fireEvent.click(screen.getByRole('button', { name: '같이 놀기' }))
  finishPlay(id, 0)
  expect(screen.getByText(careVoice(id, 'play', 0))).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: /같이 놀기/ }))
  finishPlay(id, 1)
  expect(screen.getByText(careVoice(id, 'play', 1))).toBeVisible()
  expect(stored().pets[id]!.actions.play).toEqual([careDay()])
  fireEvent.click(screen.getByRole('button', { name: '입양 조건' }))
  const album = within(screen.getByRole('region', { name: `${petById(id).name}의 추억` }))
  expect(album.getByText('처음 같이 논 날')).toBeVisible()
  expect(album.queryByText('첫 간식')).toBeNull()
})

it('returns from an adopted pet\'s details to the sleeping room without waking anyone', () => {
  const home = createHome(careDay(), 123)
  const id = home.selected
  home.pets[id]!.adoptedOn = careDay()
  localStorage.setItem(petHomeKey('guest'), JSON.stringify(sleepTogether(home, careDay())))
  render(<PetRoom {...props} />)
  fireEvent.click(screen.getByRole('button', { name: /친구들 3\/48/ }))
  fireEvent.click(screen.getByRole('button', { name: '우리 집' }))
  fireEvent.click(screen.getByRole('button', { name: new RegExp(`${petById(id).name}.*우리 집 식구`) }))
  fireEvent.click(screen.getByRole('button', { name: '잠든 방으로 돌아가기' }))
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(screen.getByRole('region', { name: '친구들이 함께 자는 방' })).toBeVisible()
  expect(stored().sleeping).not.toBeNull()
  expect(screen.getByRole('button', { name: '우리 방' })).toHaveFocus()
})
