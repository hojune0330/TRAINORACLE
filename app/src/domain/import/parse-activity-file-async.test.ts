import { afterEach, describe, expect, it, vi } from "vitest"
import { parseActivityFile } from "./activity-file"
import { ActivityParseCancelled, parseActivityFileAsync } from "./parse-activity-file-async"

const input = JSON.stringify([{ date: "2026-10-16", distanceKm: "5.000125", durationMin: "25.0125" }]) + " ".repeat(70_000)
const options = { observations: { json: true } }
const signal = () => new AbortController().signal
function fakeWorker() {
  const worker = {
    onmessage: null as Worker["onmessage"], onerror: null as Worker["onerror"], onmessageerror: null as Worker["onmessageerror"],
    terminate: vi.fn(), postMessage: vi.fn(),
  }
  return worker
}
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers() })
describe("device file worker boundary", () => {
  it("returns exactly the existing parser result including observation gates", async () => {
    vi.stubGlobal("Worker", class {})
    const worker = fakeWorker()
    const promise = parseActivityFileAsync(input, "Asia/Seoul", options, signal(), () => worker)
    const sent = worker.postMessage.mock.calls[0]![0]
    expect(sent).toEqual({ text: input, timeZone: "Asia/Seoul", options })
    const result = parseActivityFile(sent.text, sent.timeZone, sent.options)
    worker.onmessage!.call(worker as unknown as Worker, new MessageEvent("message", { data: { ok: true, result } }))
    expect(await promise).toEqual(parseActivityFile(input, "Asia/Seoul", options))
    expect(worker.terminate).toHaveBeenCalledTimes(1)
  })
  it("does not start work after cancellation", async () => {
    const controller = new AbortController(); controller.abort()
    const factory = vi.fn()
    await expect(parseActivityFileAsync(input, "UTC", {}, controller.signal, factory)).rejects.toBeInstanceOf(ActivityParseCancelled)
    expect(factory).not.toHaveBeenCalled()
  })
  it("terminates a running job and ignores its late result", async () => {
    vi.stubGlobal("Worker", class {})
    const worker = fakeWorker(); const controller = new AbortController()
    const promise = parseActivityFileAsync(input, "UTC", {}, controller.signal, () => worker)
    const late = worker.onmessage!
    controller.abort()
    late.call(worker as unknown as Worker, new MessageEvent("message", { data: { ok: true, result: { activities: [] } } }))
    await expect(promise).rejects.toBeInstanceOf(ActivityParseCancelled)
    expect(worker.terminate).toHaveBeenCalledTimes(1)
    expect(worker.onmessage).toBeNull()
  })
  it("fails visibly without reparsing after a worker crash or timeout", async () => {
    vi.useFakeTimers(); vi.stubGlobal("Worker", class {})
    const worker = fakeWorker()
    const promise = parseActivityFileAsync(input, "UTC", {}, signal(), () => worker)
    const assertion = expect(promise).rejects.toThrow("timed out")
    await vi.advanceTimersByTimeAsync(30_000); await assertion
    expect(worker.terminate).toHaveBeenCalledTimes(1)
  })
  it("uses the existing parser on unsupported browsers and small or XML inputs", async () => {
    vi.stubGlobal("Worker", undefined)
    const factory = vi.fn()
    expect(await parseActivityFileAsync(input, "UTC", {}, signal(), factory)).toEqual(parseActivityFile(input, "UTC"))
    vi.stubGlobal("Worker", class {})
    for (const text of ["[]", "<gpx/>" + " ".repeat(70_000)]) {
      expect(await parseActivityFileAsync(text, "UTC", {}, signal(), factory)).toEqual(parseActivityFile(text, "UTC"))
    }
    expect(factory).not.toHaveBeenCalled()
  })
  it("cleans up on worker errors, message errors and postMessage failure", async () => {
    vi.stubGlobal("Worker", class {})
    for (const mode of ["error", "messageerror", "post"] as const) {
      const worker = fakeWorker()
      if (mode === "post") worker.postMessage.mockImplementation(() => { throw Error("blocked") })
      const promise = parseActivityFileAsync(input, "UTC", {}, signal(), () => worker)
      if (mode === "error") worker.onerror!.call(worker as unknown as Worker, new ErrorEvent("error", { cancelable: true }))
      if (mode === "messageerror") worker.onmessageerror!.call(worker as unknown as Worker, new MessageEvent("messageerror"))
      await expect(promise).rejects.toThrow(/unavailable/)
      expect(worker.terminate).toHaveBeenCalledTimes(1)
    }
  })
})
