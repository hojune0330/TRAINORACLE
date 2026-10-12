import { act, cleanup, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { accountScopedStorageKeyFor } from "../account/local-account-scope"
import { setActiveLocalAccount } from "../account/local-journal-ownership"
import { createMinigameProgressSync } from "../account/account-minigame-progress-service"
import type { MinigameSyncResult } from "../account/account-minigame-progress-service"
import { emptyMinigameProgress, recordCityResult, updateMinigameSettings, withMedals } from "./progress"
import { emptyMedals, medalForRun } from "./rewards"
import { MINIGAME_PROGRESS_STORAGE_KEY, useMinigameProgress } from "./progress-store"

vi.mock("../account/account-minigame-progress-service", () => ({
  minigameAccountStorageEnabled: () => true,
  createMinigameProgressSync: vi.fn(),
}))

const OWNER_A = "synthetic-game-owner-a"
const OWNER_B = "synthetic-game-owner-b"
const sync = vi.fn<(progress: MinigameSyncResult["progress"]) => Promise<MinigameSyncResult>>()
const reset = vi.fn<() => Promise<boolean>>()
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(done => { resolve = done })
  return { promise, resolve }
}
const stored = (owner: string | null = OWNER_A) => JSON.parse(localStorage.getItem(accountScopedStorageKeyFor(MINIGAME_PROGRESS_STORAGE_KEY, owner)) ?? "null")

beforeEach(() => {
  localStorage.clear()
  setActiveLocalAccount(OWNER_A)
  sync.mockReset().mockImplementation(async progress => ({ status: "SYNCED", progress }))
  reset.mockReset().mockResolvedValue(true)
  vi.mocked(createMinigameProgressSync).mockReturnValue({ sync, reset })
})
afterEach(() => { cleanup(); setActiveLocalAccount(null); localStorage.clear() })

it("keeps local city results, medals and newer settings while an older account sync finishes", async () => {
  const first = deferred<MinigameSyncResult>()
  sync.mockImplementationOnce(() => first.promise)
  const view = renderHook(useMinigameProgress)
  const now = new Date("2026-10-11T03:00:00.000Z")
  act(() => view.result.current.update(current => withMedals(
    updateMinigameSettings(recordCityResult(current, "seoul", 2, 800), { sound: false }, now),
    medalForRun(emptyMedals(), 12, now).state,
  )))
  const remote = recordCityResult(emptyMinigameProgress(), "daejeon", 1, 400)
  await act(async () => { first.resolve({ status: "SYNCED", progress: remote }) })
  expect(view.result.current.progress.cities.seoul).toMatchObject({ stars: 2, bestScore: 800, clears: 1 })
  expect(view.result.current.progress.cities.daejeon).toMatchObject({ stars: 1, bestScore: 400 })
  expect(view.result.current.progress.settings.sound).toBe(false)
  expect(Object.values(view.result.current.progress.medals!.days)).toEqual([[1, 0]])
  expect(sync).toHaveBeenCalledTimes(2)
  expect(sync.mock.calls[1]![0]).toEqual(view.result.current.progress)
  expect(stored()).toEqual(view.result.current.progress)
})

it("does not persist a late sync response or retry after the game unmounts", async () => {
  const first = deferred<MinigameSyncResult>()
  sync.mockImplementationOnce(() => first.promise)
  const view = renderHook(useMinigameProgress)
  act(() => view.result.current.update(current => recordCityResult(current, "seoul", 1, 200)))
  const before = stored()
  view.unmount()
  await act(async () => { first.resolve({ status: "SYNCED", progress: recordCityResult(emptyMinigameProgress(), "daejeon", 3, 999) }) })
  expect(stored()).toEqual(before)
  expect(sync).toHaveBeenCalledTimes(1)
})

it("does not revive an old response after an A to B to A account switch", async () => {
  const first = deferred<MinigameSyncResult>()
  sync.mockImplementationOnce(() => first.promise)
  const view = renderHook(useMinigameProgress)
  act(() => view.result.current.update(current => recordCityResult(current, "seoul", 1, 200)))
  const before = stored()
  act(() => { setActiveLocalAccount(OWNER_B); setActiveLocalAccount(OWNER_A) })
  await act(async () => { first.resolve({ status: "SYNCED", progress: recordCityResult(emptyMinigameProgress(), "daejeon", 3, 999) }) })
  expect(stored()).toEqual(before)
  expect(sync).toHaveBeenCalledTimes(1)
})

it("never lets a callback from the previous account save into the next account's device space", () => {
  const first = deferred<MinigameSyncResult>()
  sync.mockImplementationOnce(() => first.promise)
  const view = renderHook(useMinigameProgress)
  const previousUpdate = view.result.current.update
  act(() => setActiveLocalAccount(OWNER_B))
  act(() => previousUpdate(current => recordCityResult(current, "seoul", 1, 200)))
  expect(stored(OWNER_B)).toBeNull()
  expect(stored(OWNER_A)).toBeNull()
})

it("finishes the active sync before deleting the account copy so reset cannot resurrect progress", async () => {
  const first = deferred<MinigameSyncResult>()
  sync.mockImplementationOnce(() => first.promise)
  localStorage.setItem(accountScopedStorageKeyFor(MINIGAME_PROGRESS_STORAGE_KEY, OWNER_A), JSON.stringify(recordCityResult(emptyMinigameProgress(), "seoul", 1, 200)))
  const view = renderHook(useMinigameProgress)
  let resetting!: Promise<boolean>
  act(() => { resetting = view.result.current.reset() })
  expect(reset).not.toHaveBeenCalled()
  await act(async () => { first.resolve({ status: "SYNCED", progress: recordCityResult(emptyMinigameProgress(), "daejeon", 3, 999) }); await resetting })
  expect(reset).toHaveBeenCalledTimes(1)
  expect(view.result.current.progress.cities).toEqual({})
  expect(stored().cities).toEqual({})
  expect(sync).toHaveBeenCalledTimes(1)
})

it("does not clear the new account's device progress when a reset completes after an account switch", async () => {
  const deleting = deferred<boolean>()
  reset.mockImplementationOnce(() => deleting.promise)
  const view = renderHook(useMinigameProgress)
  await act(async () => undefined)
  let resetting!: Promise<boolean>
  act(() => { resetting = view.result.current.reset() })
  await act(async () => undefined)
  expect(reset).toHaveBeenCalledTimes(1)
  act(() => setActiveLocalAccount(OWNER_B))
  let result: boolean | undefined
  await act(async () => { deleting.resolve(true); result = await resetting })
  expect(result).toBe(false)
  expect(stored(OWNER_B)).toBeNull()
})

it("retains device progress when the account refuses the reset", async () => {
  const saved = recordCityResult(emptyMinigameProgress(), "seoul", 2, 700)
  localStorage.setItem(accountScopedStorageKeyFor(MINIGAME_PROGRESS_STORAGE_KEY, OWNER_A), JSON.stringify(saved))
  reset.mockResolvedValueOnce(false)
  const view = renderHook(useMinigameProgress)
  await act(async () => undefined)
  let result: boolean | undefined
  await act(async () => { result = await view.result.current.reset() })
  expect(result).toBe(false)
  expect(view.result.current.progress).toEqual(saved)
  expect(stored()).toEqual(saved)
})

it("keeps guest play in the guest device space without starting an account request", () => {
  setActiveLocalAccount(null)
  const view = renderHook(useMinigameProgress)
  act(() => view.result.current.update(current => recordCityResult(current, "seoul", 1, 200)))
  expect(stored(null).cities.seoul).toMatchObject({ stars: 1, bestScore: 200 })
  expect(stored(OWNER_A)).toBeNull()
  expect(view.result.current.status).toBe("DEVICE")
  expect(createMinigameProgressSync).not.toHaveBeenCalled()
})
