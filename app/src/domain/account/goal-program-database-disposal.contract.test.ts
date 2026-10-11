import { describe, expect, it, vi } from "vitest"
import { ACCOUNT_GOAL_PROGRAM_BUFFER } from "./account-goal-program-schema"
import { disposeGoalProgramDatabase } from "./goal-program-database-disposal"

function makeRequest(): IDBOpenDBRequest {
  return {
    onsuccess: null,
    onerror: null,
    onblocked: null,
  } as unknown as IDBOpenDBRequest
}

function makeFactory(request: IDBOpenDBRequest): IDBFactory {
  return { deleteDatabase: vi.fn(() => request) } as unknown as IDBFactory
}

describe("disposeGoalProgramDatabase", () => {
  it("targets only the account goal-program database and waits for confirmed success", async () => {
    const request = makeRequest()
    const factory = makeFactory(request)
    const result = disposeGoalProgramDatabase(factory)

    expect(factory.deleteDatabase).toHaveBeenCalledOnce()
    expect(factory.deleteDatabase).toHaveBeenCalledWith(ACCOUNT_GOAL_PROGRAM_BUFFER)

    request.onsuccess?.(new Event("success"))
    await expect(result).resolves.toEqual({ ok: true, failed: [] })
  })

  it("reports a blocked deletion as incomplete even if the request later succeeds", async () => {
    const request = makeRequest()
    const result = disposeGoalProgramDatabase(makeFactory(request))

    request.onblocked?.(new Event("blocked") as IDBVersionChangeEvent)
    await expect(result).resolves.toEqual({ ok: false, failed: [ACCOUNT_GOAL_PROGRAM_BUFFER] })

    // A late success must not turn the already surfaced blocked result into success.
    request.onsuccess?.(new Event("success"))
  })

  it("reports unavailable, synchronous-throw, and request-error cases as incomplete", async () => {
    await expect(disposeGoalProgramDatabase(null)).resolves.toEqual({
      ok: false,
      failed: [ACCOUNT_GOAL_PROGRAM_BUFFER],
    })

    const throwingFactory = { deleteDatabase: vi.fn(() => { throw new Error("denied") }) } as unknown as IDBFactory
    await expect(disposeGoalProgramDatabase(throwingFactory)).resolves.toEqual({
      ok: false,
      failed: [ACCOUNT_GOAL_PROGRAM_BUFFER],
    })

    const request = makeRequest()
    const result = disposeGoalProgramDatabase(makeFactory(request))
    request.onerror?.(new Event("error"))
    await expect(result).resolves.toEqual({ ok: false, failed: [ACCOUNT_GOAL_PROGRAM_BUFFER] })
  })
})
