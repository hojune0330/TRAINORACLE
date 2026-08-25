import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { eraseAllLocalData, erasableKeys } from "../erase-local-data"
import {
  archiveAndClearActivePlan,
  loadPlanBetaState,
  loadPreviousContinuity,
  loadPreviousIntake,
  savePlanBetaState,
  savePlanProgressWithLock,
} from "../plan-beta-store"
import { stateFixture } from "../plan-beta-store.test-fixture"
import { setActiveLocalAccount } from "./local-journal-ownership"
import {
  accountScopedStorageKey,
  findAccountScopedStorageKeys,
} from "./local-account-scope"

const ACTIVE_KEY = "trainoracle.plan-beta.v1"
const HISTORY_KEY = "trainoracle.plan-beta.history.v1"
const PREVIOUS_INTAKE_KEY = "trainoracle.plan-beta.previous-intake.v1"
let locksDescriptor: PropertyDescriptor | undefined

beforeEach(() => {
  window.localStorage.clear()
  window.sessionStorage.clear()
  setActiveLocalAccount(null)
  locksDescriptor = Object.getOwnPropertyDescriptor(navigator, "locks")
})

afterEach(() => {
  setActiveLocalAccount(null)
  if (locksDescriptor === undefined) Reflect.deleteProperty(navigator, "locks")
  else Object.defineProperty(navigator, "locks", locksDescriptor)
})

describe("account-scoped plan storage", () => {
  it("keeps the legacy key for device-only use and derives an encoded account key", () => {
    expect(accountScopedStorageKey(ACTIVE_KEY)).toBe(ACTIVE_KEY)

    setActiveLocalAccount("account/a@example.com")

    expect(accountScopedStorageKey(ACTIVE_KEY)).toBe(
      `${ACTIVE_KEY}.account.account%2Fa%40example.com`,
    )
  })

  it("keeps anonymous, account A, and account B active plans separate", () => {
    const devicePlan = stateFixture()
    const accountBPlan = {
      ...stateFixture(),
      progress: [{ sessionDay: 1, sessionSlot: "AM" as const, state: "COMPLETED" as const }],
    }
    expect(savePlanBetaState(devicePlan)).toEqual({ ok: true })

    setActiveLocalAccount("account-a")
    expect(loadPlanBetaState()).toBeNull()
    expect(savePlanBetaState(stateFixture())).toEqual({ ok: true })

    setActiveLocalAccount("account-b")
    expect(loadPlanBetaState()).toBeNull()
    expect(savePlanBetaState(accountBPlan)).toEqual({ ok: true })
    expect(loadPlanBetaState()?.progress).toHaveLength(1)

    setActiveLocalAccount("account-a")
    expect(loadPlanBetaState()?.progress).toEqual([])

    setActiveLocalAccount(null)
    expect(loadPlanBetaState()).toEqual(devicePlan)
    expect(window.localStorage.getItem(ACTIVE_KEY)).not.toBeNull()
    expect(window.localStorage.getItem(`${ACTIVE_KEY}.account.account-a`)).not.toBeNull()
    expect(window.localStorage.getItem(`${ACTIVE_KEY}.account.account-b`)).not.toBeNull()
  })

  it("isolates archived history and previous intake with the active account", () => {
    const accountAPlan = stateFixture()
    setActiveLocalAccount("account-a")
    expect(savePlanBetaState(accountAPlan)).toEqual({ ok: true })
    expect(archiveAndClearActivePlan(accountAPlan)).toMatchObject({ ok: true })
    expect(loadPreviousIntake()).toEqual(accountAPlan.intake)
    expect(loadPreviousContinuity()).toBeDefined()

    setActiveLocalAccount("account-b")
    expect(loadPreviousIntake()).toBeNull()
    expect(loadPreviousContinuity()).toBeUndefined()
    expect(window.localStorage.getItem(`${HISTORY_KEY}.account.account-a`)).not.toBeNull()
    expect(window.sessionStorage.getItem(`${PREVIOUS_INTAKE_KEY}.account.account-a`)).not.toBeNull()
  })

  it("fails closed when the account changes while a locked plan update is waiting", async () => {
    const accountAPlan = stateFixture()
    setActiveLocalAccount("account-a")
    expect(savePlanBetaState(accountAPlan)).toEqual({ ok: true })
    Object.defineProperty(navigator, "locks", {
      configurable: true,
      value: {
        request: async (
          _name: string,
          _options: unknown,
          callback: (lock: object) => unknown,
        ) => {
          setActiveLocalAccount("account-b")
          return callback({})
        },
      },
    })

    const result = await savePlanProgressWithLock(
      accountAPlan.activePlan.candidateId,
      { sessionDay: 1, sessionSlot: "AM", state: "COMPLETED" },
    )

    expect(result).toEqual({ kind: "rejected", code: "PLAN_STORAGE_STATE_UNCERTAIN" })
    expect(loadPlanBetaState()).toBeNull()
    setActiveLocalAccount("account-a")
    expect(loadPlanBetaState()?.progress).toEqual([])
  })

  it("discovers and erases every account-scoped plan key on a shared device", () => {
    const localAccountKeys = [
      `${ACTIVE_KEY}.account.account-a`,
      `${ACTIVE_KEY}.account.account-b`,
      `trainoracle.plan-beta.adaptation.v1.account.account-a`,
    ]
    for (const key of localAccountKeys) window.localStorage.setItem(key, "{}")
    const sessionAccountKey = `${PREVIOUS_INTAKE_KEY}.account.account-a`
    window.sessionStorage.setItem(sessionAccountKey, "{}")

    expect(findAccountScopedStorageKeys(window.localStorage, [ACTIVE_KEY])).toEqual(
      expect.arrayContaining(localAccountKeys.slice(0, 2)),
    )
    expect(erasableKeys()).toEqual(expect.arrayContaining([...localAccountKeys, sessionAccountKey]))

    const result = eraseAllLocalData()

    expect(result).toMatchObject({ ok: true, cleared: 4 })
    for (const key of localAccountKeys) expect(window.localStorage.getItem(key)).toBeNull()
    expect(window.sessionStorage.getItem(sessionAccountKey)).toBeNull()
  })
})
