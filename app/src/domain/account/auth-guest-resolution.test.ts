import { beforeEach, expect, it, vi } from "vitest"
const mocks = vi.hoisted(() => ({ client: vi.fn(), session: vi.fn(), subscribe: vi.fn() }))
vi.mock("./supabase-client", () => ({ supabase: mocks.client }))
import { currentUser, onAuthChange } from "./auth"

beforeEach(() => {
  vi.clearAllMocks()
  mocks.client.mockResolvedValue({ auth: { getSession: mocks.session, onAuthStateChange: mocks.subscribe } })
  mocks.session.mockResolvedValue({ data: { session: null }, error: null })
  mocks.subscribe.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } })
})

it("returns guest only after a successful session read", async () => {
  expect(await currentUser({ throwOnFailure: true })).toBeNull()
})

it.each(["response", "rejected", "client", "disabled"])("strict reads fail closed on %s failure while old callers remain compatible", async kind => {
  if (kind === "response") mocks.session.mockResolvedValue({ data: { session: null }, error: { message: "private error" } })
  if (kind === "rejected") mocks.session.mockRejectedValue(new Error("private error"))
  if (kind === "client") mocks.client.mockRejectedValue(new Error("private error"))
  if (kind === "disabled") mocks.client.mockResolvedValue(null)
  await expect(currentUser({ throwOnFailure: true })).rejects.toThrow("AUTH_UNAVAILABLE")
  await expect(currentUser()).resolves.toBeNull()
})

it("does not let INITIAL_SESSION null override strict failure; explicit sign-out is accepted", async () => {
  const listener = vi.fn()
  const unsubscribe = onAuthChange(listener, { ignoreInitialSession: true })
  await Promise.resolve()
  const callback = mocks.subscribe.mock.calls[0]![0]
  callback("INITIAL_SESSION", null)
  expect(listener).not.toHaveBeenCalled()
  callback("SIGNED_OUT", null)
  expect(listener).toHaveBeenCalledWith(null)
  unsubscribe()
  callback("SIGNED_OUT", null)
  expect(listener).toHaveBeenCalledTimes(1)
})
