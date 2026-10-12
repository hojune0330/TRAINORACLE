import { act, cleanup, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { setActiveLocalAccount } from "../domain/account/local-journal-ownership"
import { useNavigationReturnFrame } from "./useNavigationReturnFrame"

const navigation = vi.hoisted(() => ({ epoch: 0 }))
vi.mock("../navigation/browserNavigation", () => ({ getBrowserNavigationEpoch: () => navigation.epoch }))

let frames: Map<number, FrameRequestCallback>
let nextFrame: number

beforeEach(() => {
  navigation.epoch = 0
  frames = new Map()
  nextFrame = 0
  setActiveLocalAccount(null)
  vi.spyOn(window, "requestAnimationFrame").mockImplementation(callback => {
    const id = ++nextFrame
    frames.set(id, callback)
    return id
  })
  // Keep callbacks available to prove that cancellation alone is not the guard.
  vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => undefined)
})

afterEach(() => { cleanup(); setActiveLocalAccount(null); vi.restoreAllMocks() })

describe("navigation return frame lifetime", () => {
  it("restores the position for the current navigation", () => {
    const restore = vi.fn()
    const { result } = renderHook(useNavigationReturnFrame)
    act(() => result.current.schedule(restore))
    act(() => frames.get(1)?.(0))
    expect(restore).toHaveBeenCalledOnce()
  })

  it("does not let an older return move the latest screen", () => {
    const oldRestore = vi.fn(), latestRestore = vi.fn()
    const { result } = renderHook(useNavigationReturnFrame)
    act(() => { result.current.schedule(oldRestore); result.current.schedule(latestRestore) })
    act(() => { frames.get(1)?.(0); frames.get(2)?.(0) })
    expect(oldRestore).not.toHaveBeenCalled()
    expect(latestRestore).toHaveBeenCalledOnce()
  })

  it("ignores a frame after browser Back or Forward has advanced", () => {
    const restore = vi.fn()
    const { result } = renderHook(useNavigationReturnFrame)
    act(() => result.current.schedule(restore))
    navigation.epoch += 1
    act(() => frames.get(1)?.(0))
    expect(restore).not.toHaveBeenCalled()
  })

  it("cannot revive a return after the same account signs in again", () => {
    setActiveLocalAccount("navigation-return-account-a")
    const restore = vi.fn()
    const { result } = renderHook(useNavigationReturnFrame)
    act(() => result.current.schedule(restore))
    act(() => { setActiveLocalAccount("navigation-return-account-b"); setActiveLocalAccount("navigation-return-account-a") })
    act(() => frames.get(1)?.(0))
    expect(restore).not.toHaveBeenCalled()
  })

  it("does not restore after the shell has unmounted", () => {
    const restore = vi.fn()
    const { result, unmount } = renderHook(useNavigationReturnFrame)
    act(() => result.current.schedule(restore))
    unmount()
    act(() => frames.get(1)?.(0))
    expect(restore).not.toHaveBeenCalled()
  })
})
