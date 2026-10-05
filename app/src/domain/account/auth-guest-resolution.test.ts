import { beforeEach, expect, it, vi } from "vitest"
const mocks = vi.hoisted(() => ({ client: vi.fn(), user: vi.fn(), session: vi.fn(), subscribe: vi.fn() }))
vi.mock("./supabase-client", () => ({ supabase: mocks.client }))
import { currentUser, onAuthChange } from "./auth"

beforeEach(() => {
  vi.resetAllMocks()
  mocks.client.mockResolvedValue({ auth: { getUser: mocks.user, getSession: mocks.session, onAuthStateChange: mocks.subscribe } })
  mocks.user.mockResolvedValue({ data: { user: null }, error: null })
  // A populated local cache must neither identify the user nor rescue a failed server read.
  mocks.session.mockResolvedValue({ data: { session: { user: { id: "cached-unverified-user" } } }, error: null })
  mocks.subscribe.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } })
})

it("returns guest only after a successful server user read with no user", async () => {
  expect(await currentUser({ throwOnFailure: true })).toBeNull()
  expect(mocks.user).toHaveBeenCalledOnce()
  expect(mocks.session).not.toHaveBeenCalled()
})

it("returns the server-verified identity rather than a different cached user", async () => {
  mocks.user.mockResolvedValue({ data: { user: { id: "verified-user", email: "verified@example.invalid", app_metadata: { provider: "email" } } }, error: null })
  await expect(currentUser({ throwOnFailure: true })).resolves.toEqual({ id: "verified-user", email: "verified@example.invalid", phone: null, provider: "email" })
  expect(mocks.user).toHaveBeenCalledOnce()
  expect(mocks.session).not.toHaveBeenCalled()
})

it.each(["response", "rejected", "client", "disabled"])("strict reads fail closed on %s failure while old callers remain compatible", async kind => {
  if (kind === "response") mocks.user.mockResolvedValue({ data: { user: { id: "unverified-user" } }, error: { message: "private error" } })
  if (kind === "rejected") mocks.user.mockRejectedValue(new Error("private error"))
  if (kind === "client") mocks.client.mockRejectedValue(new Error("private error"))
  if (kind === "disabled") mocks.client.mockResolvedValue(null)
  await expect(currentUser({ throwOnFailure: true })).rejects.toThrow("AUTH_UNAVAILABLE")
  await expect(currentUser()).resolves.toBeNull()
  expect(mocks.user).toHaveBeenCalledTimes(kind === "response" || kind === "rejected" ? 2 : 0)
  expect(mocks.session).not.toHaveBeenCalled()
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
