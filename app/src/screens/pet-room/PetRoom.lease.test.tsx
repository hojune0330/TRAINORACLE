import React, { StrictMode } from 'react'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { PetRoom } from './PetRoom'
import { petLockFixture } from '../../test/pet-lock-fixture'
import { petHomeKey } from './pet-engine'

beforeEach(() => { localStorage.clear(); vi.stubGlobal('navigator', { locks: petLockFixture().manager }) })
afterEach(() => { cleanup(); vi.unstubAllGlobals() })
const props = { persistenceScope: 'strictmode-guest', journal: { date: '2026-01-01', status: 'missing' as const }, onBack: vi.fn(), onOpenJournal: vi.fn(), onOldGame: vi.fn() }
it('opens a single-tab room in StrictMode after the first mount cancels and releases its lease', async () => {
  const view = render(<StrictMode><PetRoom {...props} /></StrictMode>)
  expect(await screen.findByRole('button', { name: '우리 방' })).toBeVisible()
  expect(screen.queryByRole('alert')).toBeNull()
  await waitFor(() => expect(localStorage.getItem(petHomeKey(props.persistenceScope))).not.toBeNull())
  view.unmount()
  render(<StrictMode><PetRoom {...props} /></StrictMode>)
  expect(await screen.findByRole('button', { name: '우리 방' })).toBeVisible()
  expect(screen.queryByRole('alert')).toBeNull()
})
it('explains an actual other-tab lease and never writes before it becomes available', async () => {
  const fixture = petLockFixture(); const closeOther = fixture.external(props.persistenceScope)
  vi.stubGlobal('navigator', { locks: fixture.manager })
  const view = render(<PetRoom {...props} />)
  expect(await screen.findByRole('alert')).toHaveTextContent('다른 창')
  expect(localStorage.getItem(petHomeKey(props.persistenceScope))).toBeNull()
  view.unmount(); closeOther()
  render(<PetRoom {...props} />)
  expect(await screen.findByRole('button', { name: '우리 방' })).toBeVisible()
})
