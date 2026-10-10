import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

let navigation: typeof import("./browserNavigation")

beforeEach(async () => {
  vi.resetModules()
  navigation = await import("./browserNavigation")
  window.history.replaceState({ parent: "origin" }, "", window.location.href)
  vi.spyOn(window.history, "back").mockImplementation(() => undefined)
  vi.spyOn(window.history, "forward").mockImplementation(() => undefined)
})
afterEach(() => { vi.restoreAllMocks() })

function popTo(state: unknown): boolean {
  window.history.replaceState(state, "", window.location.href)
  navigation.beginBrowserPopNavigation()
  return navigation.consumeBrowserBackLayer(new PopStateEvent("popstate", { state }))
}

describe("native browser layer history", () => {
  it("drains inherited duplicate markers before releasing a queued new flow without replaying callbacks", async () => {
    const close = vi.fn(), nextClose = vi.fn()
    const layer = navigation.registerBrowserBackLayer({ id: "inherited-parent", canClose: () => true, onClose: close })
    const parentEntry = window.history.state
    window.history.pushState({ ...parentEntry, syntheticChild: "recording" }, "", window.location.href)
    layer.dispose()
    await Promise.resolve()
    navigation.registerBrowserBackLayer({ id: "waiting-next", canClose: () => true, onClose: nextClose })
    expect(navigation.hasPendingBrowserBackLayer()).toBe(true)
    expect(popTo(parentEntry)).toBe(true)
    expect(window.history.back).toHaveBeenCalledTimes(2)
    expect(navigation.hasPendingBrowserBackLayer()).toBe(true)
    expect(popTo({ parent: "origin" })).toBe(true)
    expect(navigation.hasPendingBrowserBackLayer()).toBe(false)
    expect(window.history.state.trainoracleBackLayer).toBe("waiting-next")
    expect(window.history.state.parent).toBe("origin")
    expect(close).not.toHaveBeenCalled()
    expect(nextClose).not.toHaveBeenCalled()
  })
  it("drains an obsolete different ancestor but preserves live parent and logical plan history", async () => {
    window.history.replaceState({ parent: "origin", logicalPlan: "synthetic-plan" }, "", window.location.href)
    const outerClose = vi.fn(), oldClose = vi.fn(), nextClose = vi.fn()
    const outer = navigation.registerBrowserBackLayer({ id: "live-parent", canClose: () => true, onClose: outerClose })
    const parentState = window.history.state
    const old = navigation.registerBrowserBackLayer({ id: "obsolete-ancestor", canClose: () => true, onClose: oldClose })
    const oldState = window.history.state
    old.dispose()
    const next = navigation.registerBrowserBackLayer({ id: "obsolete-child", canClose: () => true, onClose: nextClose })
    await Promise.resolve()
    next.dispose()
    await Promise.resolve()
    expect(popTo(oldState)).toBe(true)
    expect(navigation.hasPendingBrowserBackLayer()).toBe(true)
    expect(popTo(parentState)).toBe(true)
    expect(navigation.hasPendingBrowserBackLayer()).toBe(false)
    expect(window.history.state).toEqual(parentState)
    expect(window.history.state.logicalPlan).toBe("synthetic-plan")
    expect(outerClose).not.toHaveBeenCalled()
    expect(oldClose).not.toHaveBeenCalled()
    expect(nextClose).not.toHaveBeenCalled()
    outer.dispose()
  })
  it.each(["new-layer", "queued"])("does not let a queued old Back close a newly registered %s", id => {
    const oldClose = vi.fn(), newClose = vi.fn(), push = vi.spyOn(window.history, "pushState")
    const old = navigation.registerBrowserBackLayer({ id: "queued", canClose: () => true, onClose: oldClose })
    old.close()
    const next = navigation.registerBrowserBackLayer({ id, canClose: () => true, onClose: newClose })
    expect(push).toHaveBeenCalledOnce()
    expect(popTo({ parent: "origin" })).toBe(true)
    expect(oldClose).toHaveBeenCalledOnce()
    expect(newClose).not.toHaveBeenCalled()
    expect(push).toHaveBeenCalledTimes(2)
    expect(window.history.state).toEqual({ parent: "origin", trainoracleBackLayer: id })
    next.close()
    expect(newClose).toHaveBeenCalledOnce()
    expect(window.history.back).toHaveBeenCalledTimes(2)
    expect(popTo({ parent: "origin" })).toBe(true)
    expect(popTo(null)).toBe(false)
  })

  it("reserves a queued departure before a synchronous close callback can register another layer", () => {
    const nextClose = vi.fn(), push = vi.spyOn(window.history, "pushState")
    const old = navigation.registerBrowserBackLayer({ id: "callback-old", canClose: () => true, onClose: () => {
      navigation.registerBrowserBackLayer({ id: "callback-new", canClose: () => true, onClose: nextClose })
    } })
    old.close()
    expect(push).toHaveBeenCalledOnce()
    expect(popTo({ parent: "origin" })).toBe(true)
    expect(window.history.state.trainoracleBackLayer).toBe("callback-new")
    expect(nextClose).not.toHaveBeenCalled()
  })

  it("consumes only the top layer, preserves parent markers and then permits ordinary Back", () => {
    const outer = vi.fn(), inner = vi.fn()
    navigation.registerBrowserBackLayer({ id: "outer", canClose: () => true, onClose: outer })
    const outerState = window.history.state
    navigation.registerBrowserBackLayer({ id: "inner", canClose: () => true, onClose: inner })
    expect(window.history.state).toEqual({ parent: "origin", trainoracleBackLayer: "inner" })
    expect(popTo(outerState)).toBe(true)
    expect(inner).toHaveBeenCalledOnce()
    expect(outer).not.toHaveBeenCalled()
    expect(popTo({ parent: "origin" })).toBe(true)
    expect(outer).toHaveBeenCalledOnce()
    expect(popTo(null)).toBe(false)
  })

  it("closes a button/Escape request once and swallows its later POP rather than closing the parent", async () => {
    const close = vi.fn()
    const layer = navigation.registerBrowserBackLayer({ id: "button", canClose: () => true, onClose: close })
    layer.close()
    layer.close()
    layer.dispose()
    await Promise.resolve()
    expect(close).toHaveBeenCalledOnce()
    expect(window.history.back).toHaveBeenCalledOnce()
    expect(popTo({ parent: "origin" })).toBe(true)
    expect(close).toHaveBeenCalledOnce()
    expect(popTo(null)).toBe(false)
  })

  it("keeps a busy save open and restores the existing entry with Forward, not another push", () => {
    let busy = true
    const close = vi.fn(), push = vi.spyOn(window.history, "pushState")
    const layer = navigation.registerBrowserBackLayer({ id: "busy", canClose: () => !busy, onClose: close })
    const busyState = window.history.state
    layer.close()
    expect(window.history.back).not.toHaveBeenCalled()
    expect(popTo({ parent: "origin" })).toBe(true)
    expect(window.history.forward).toHaveBeenCalledOnce()
    expect(close).not.toHaveBeenCalled()
    expect(push).toHaveBeenCalledOnce()
    expect(popTo(busyState)).toBe(true)
    expect(close).not.toHaveBeenCalled()
    busy = false
    expect(popTo({ parent: "origin" })).toBe(true)
    expect(close).toHaveBeenCalledOnce()
  })

  it("consumes a completed dialog entry on unmount and never replays its action on Forward", async () => {
    const close = vi.fn()
    const layer = navigation.registerBrowserBackLayer({ id: "complete", canClose: () => true, onClose: close })
    const completeState = window.history.state
    layer.dispose()
    await Promise.resolve()
    expect(window.history.back).toHaveBeenCalledOnce()
    expect(popTo({ parent: "origin" })).toBe(true)
    expect(popTo(completeState)).toBe(true)
    expect(close).not.toHaveBeenCalled()
    expect(popTo({ parent: "origin" })).toBe(true)
    expect(popTo(null)).toBe(false)
  })

  it("does not create or consume a ghost entry during StrictMode effect replay", async () => {
    const close = vi.fn(), push = vi.spyOn(window.history, "pushState")
    const first = navigation.registerBrowserBackLayer({ id: "strict", canClose: () => true, onClose: close })
    first.dispose()
    const second = navigation.registerBrowserBackLayer({ id: "strict", canClose: () => true, onClose: close })
    await Promise.resolve()
    expect(push).toHaveBeenCalledOnce()
    expect(window.history.back).not.toHaveBeenCalled()
    second.close()
    expect(window.history.back).toHaveBeenCalledOnce()
    expect(close).toHaveBeenCalledOnce()
  })

  it("keeps local close available when history writes are denied without trapping site Back", () => {
    vi.spyOn(window.history, "pushState").mockImplementation(() => { throw Error("synthetic denial") })
    const close = vi.fn()
    const layer = navigation.registerBrowserBackLayer({ id: "denied", canClose: () => true, onClose: close })
    expect(popTo(null)).toBe(false)
    layer.close()
    expect(close).toHaveBeenCalledOnce()
    expect(window.history.back).not.toHaveBeenCalled()
  })

  it("fails closed if the save guard throws and notifies/cancels POP scroll work", () => {
    const close = vi.fn(), listener = vi.fn()
    const unsubscribe = navigation.subscribeBrowserPopNavigation(listener)
    const epoch = navigation.getBrowserNavigationEpoch()
    navigation.registerBrowserBackLayer({ id: "failed-guard", canClose: () => { throw Error("synthetic guard") }, onClose: close })
    expect(popTo({ parent: "origin" })).toBe(true)
    expect(navigation.getBrowserNavigationEpoch()).toBeGreaterThan(epoch)
    expect(navigation.isBrowserPopScrollRestoration()).toBe(true)
    expect(listener).toHaveBeenCalledOnce()
    expect(close).not.toHaveBeenCalled()
    unsubscribe()
  })
})
