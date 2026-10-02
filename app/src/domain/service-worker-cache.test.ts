import { readFileSync } from "node:fs"
import { runInNewContext } from "node:vm"
import { describe, expect, it, vi } from "vitest"

const source = readFileSync("public/sw.js", "utf8")

function harness(response: Response) {
  const handlers: Record<string, (event: Record<string, unknown>) => void> = {}
  const put = vi.fn().mockResolvedValue(undefined), remove = vi.fn()
  const cached = new Response("<html>prior shell</html>", { headers: { "content-type": "text/html" } })
  const cache = { put, addAll: vi.fn(), match: vi.fn().mockResolvedValue(cached) }
  const caches = { open: vi.fn().mockResolvedValue(cache), match: vi.fn().mockResolvedValue(undefined), delete: remove }
  const fetch = vi.fn().mockResolvedValue(response)
  const claim = vi.fn().mockResolvedValue(undefined)
  runInNewContext(source, { URL, Response, fetch, caches,
    self: { registration: { scope: "https://example.test/app/" }, location: { origin: "https://example.test" },
      clients: { claim }, addEventListener: (type: string, fn: typeof handlers[string]) => { handlers[type] = fn } },
  })
  const pending: Promise<unknown>[] = []
  let result: Promise<Response> | undefined
  const event = (url: string, mode = "navigate") => ({ request: { url, mode, method: "GET" },
    waitUntil: (promise: Promise<unknown>) => pending.push(promise),
    respondWith: (promise: Promise<Response>) => { result = promise },
  })
  return { handlers, put, remove, fetch, claim, event, pending, result: () => result }
}

describe("service worker cache integrity", () => {
  it.each([500, 404])("does not replace a valid shell with HTTP %s", async status => {
    const h = harness(new Response("error", { status, headers: { "content-type": "text/html" } }))
    h.handlers.fetch!(h.event("https://example.test/app/"))
    expect((await h.result())?.status).toBe(status)
    expect(h.put).not.toHaveBeenCalled()
  })
  it("does not cache non-HTML navigation responses", async () => {
    const h = harness(new Response("{}", { headers: { "content-type": "application/json" } }))
    h.handlers.fetch!(h.event("https://example.test/app/"))
    await h.result()
    expect(h.put).not.toHaveBeenCalled()
  })
  it("caches a successful shell and contains cache-write failure", async () => {
    const h = harness(new Response("<html>new</html>", { headers: { "content-type": "text/html" } }))
    h.put.mockRejectedValue(new Error("quota"))
    h.handlers.fetch!(h.event("https://example.test/app/"))
    expect((await h.result())?.ok).toBe(true)
    await Promise.all(h.pending)
    expect(h.put).toHaveBeenCalledOnce()
  })
  it("never serves an offline shell for a recovery probe", () => {
    const h = harness(new Response("ok"))
    h.handlers.fetch!(h.event("https://example.test/app/?screen-recovery-check=1", "cors"))
    expect(h.result()).toBeUndefined()
    expect(h.fetch).not.toHaveBeenCalled()
  })
  it("preserves old assets and unrelated origin caches on activation", async () => {
    const h = harness(new Response("ok"))
    h.handlers.activate!({ waitUntil: (promise: Promise<unknown>) => h.pending.push(promise) })
    await Promise.all(h.pending)
    expect(h.claim).toHaveBeenCalledOnce()
    expect(h.remove).not.toHaveBeenCalled()
  })
})
