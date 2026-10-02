import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { registerAppServiceWorker } from "./pwa-update"

const safety = vi.hoisted(() => ({ blocked: false }))
vi.mock("./screen-recovery", () => ({ isReloadBlocked: () => safety.blocked }))

let swEvents: Record<string, () => void>
let windowEvents: Record<string, () => void>
let worker: { postMessage: ReturnType<typeof vi.fn> }
let registration: { waiting: typeof worker; update: ReturnType<typeof vi.fn>; addEventListener: ReturnType<typeof vi.fn> }
let register: ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.useFakeTimers()
  safety.blocked = false
  swEvents = {}; windowEvents = {}
  worker = { postMessage: vi.fn() }
  registration = { waiting: worker, update: vi.fn().mockResolvedValue(undefined), addEventListener: vi.fn() }
  register = vi.fn().mockResolvedValue(registration)
  vi.stubGlobal("navigator", { serviceWorker: { register, controller: {}, addEventListener: (name: string, fn: () => void) => { swEvents[name] = fn } } })
  vi.spyOn(window, "addEventListener").mockImplementation((name, fn) => { windowEvents[name] = fn as () => void })
  vi.spyOn(document, "addEventListener").mockImplementation(() => {})
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible")
  vi.spyOn(console, "warn").mockImplementation(() => {})
  history.replaceState(null, "", "?pwa-test=1")
})

afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); history.replaceState(null, "", "/") })

it("does not register a worker for an ordinary local preview", () => {
  history.replaceState(null, "", "/")
  registerAppServiceWorker("/")
  expect(register).not.toHaveBeenCalled()
})

it("waits for input to be durable before activating, and rechecks before reload", async () => {
  const reload = vi.fn()
  safety.blocked = true
  registerAppServiceWorker("/", reload)
  await Promise.resolve()
  expect(worker.postMessage).not.toHaveBeenCalled()
  safety.blocked = false
  await vi.advanceTimersByTimeAsync(5_000)
  expect(worker.postMessage).toHaveBeenCalledExactlyOnceWith({ type: "SKIP_WAITING" })
  safety.blocked = true
  swEvents.controllerchange!()
  expect(reload).not.toHaveBeenCalled()
  safety.blocked = false
  await vi.advanceTimersByTimeAsync(5_000)
  expect(reload).toHaveBeenCalledOnce()
  swEvents.controllerchange!()
  expect(reload).toHaveBeenCalledOnce()
})

it("contains update rejection and prevents duplicate concurrent checks", async () => {
  registration.update.mockRejectedValue(new Error("server unavailable"))
  const reload = vi.fn()
  registerAppServiceWorker("/", reload)
  await Promise.resolve()
  windowEvents.focus!(); windowEvents.focus!()
  expect(registration.update).toHaveBeenCalledOnce()
  await vi.advanceTimersByTimeAsync(0)
  expect(console.warn).toHaveBeenCalledWith("[SW] update unavailable; keeping current screen")
  expect(reload).not.toHaveBeenCalled()
  windowEvents.focus!()
  expect(registration.update).toHaveBeenCalledTimes(2)
  await vi.advanceTimersByTimeAsync(0)
})

it("also defers replacement while an unregistered input screen is open", async () => {
  const input = document.createElement("input")
  input.value = "unsaved result"
  document.body.append(input)
  const reload = vi.fn()
  try {
    registerAppServiceWorker("/", reload)
    await Promise.resolve()
    expect(worker.postMessage).not.toHaveBeenCalled()
    input.remove()
    await vi.advanceTimersByTimeAsync(5_000)
    expect(worker.postMessage).toHaveBeenCalledOnce()
  } finally { input.remove() }
})
