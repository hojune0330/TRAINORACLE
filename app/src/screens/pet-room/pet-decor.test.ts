import { expect, it } from 'vitest'
import { careFor, createHome, parseHome, persistHome, placeRoomDecoration, sleepTogether } from './pet-engine'
import { roomKeepsakes } from './pet-decor'

const day = '2026-10-23'
it('reads older homes without decoration and rejects an unearned or unknown decoration', () => {
  const home = createHome(day, 123)
  const { roomDecoration: _, ...older } = home
  expect(parseHome(JSON.stringify(older))?.roomDecoration).toBeNull()
  expect(parseHome(JSON.stringify({ ...older, roomDecoration: 'paw-frame' }))).toBeNull()
  expect(parseHome(JSON.stringify({ ...older, roomDecoration: 'unknown' }))).toBeNull()
  expect(placeRoomDecoration(home, 'paw-frame')).toBe(home)
})

it('earns keepsakes from actual saved care with the original date and friend, without repeat rewards', () => {
  let home = createHome(day, 123)
  const id = home.selected
  expect(roomKeepsakes(home)).toEqual([])
  home = careFor(home, id, 'pet', day)
  expect(roomKeepsakes(home)).toEqual([{ id: 'paw-frame', petId: id, date: day }])
  home = careFor(home, id, 'pet', '2026-10-25')
  expect(roomKeepsakes(home)).toEqual([{ id: 'paw-frame', petId: id, date: day }])
  home = careFor(home, id, 'feed', day)
  home = careFor(home, id, 'play', day)
  expect(roomKeepsakes(home)).toHaveLength(3)
  expect(roomKeepsakes(sleepTogether(home, day))).toHaveLength(4)
})

it('persists only the room choice and keeps care and journal data unchanged; failures preserve the old choice', () => {
  const fresh = createHome(day, 123)
  const home = careFor(fresh, fresh.selected, 'pet', day)
  let raw: string | null = JSON.stringify(home)
  const storage = { getItem: () => raw, setItem: (_: string, value: string) => { raw = value } }
  const placed = placeRoomDecoration(home, 'paw-frame')
  expect(placed.pets).toBe(home.pets)
  expect(placed.journal).toBe(home.journal)
  const result = persistHome(storage, home.scope, placed, raw)
  expect(result.ok).toBe(true)
  expect(parseHome(raw!)?.roomDecoration).toBe('paw-frame')
  const before = raw
  expect(persistHome(storage, home.scope, placeRoomDecoration(placed, null), 'stale').ok).toBe(false)
  expect(raw).toBe(before)
  expect(persistHome({ getItem: storage.getItem, setItem: () => { throw Error('quota') } }, home.scope, placeRoomDecoration(placed, null), raw).ok).toBe(false)
  expect(raw).toBe(before)
})
