import { afterEach, describe, expect, it } from "vitest"
import { getPlanMutationLockManager } from "./plan-mutation-lock"

let locksDescriptor: PropertyDescriptor | undefined

afterEach(() => {
  if (locksDescriptor === undefined) Reflect.deleteProperty(navigator, "locks")
  else Object.defineProperty(navigator, "locks", locksDescriptor)
  locksDescriptor = undefined
})

describe("plan mutation lock discovery", () => {
  it("returns null when the navigator locks getter throws", () => {
    locksDescriptor = Object.getOwnPropertyDescriptor(navigator, "locks")
    Object.defineProperty(navigator, "locks", {
      configurable: true,
      get: () => { throw new Error("SecurityError") },
    })

    expect(getPlanMutationLockManager()).toBeNull()
  })

  it("returns null when the request getter throws", () => {
    locksDescriptor = Object.getOwnPropertyDescriptor(navigator, "locks")
    const locks = {}
    Object.defineProperty(locks, "request", {
      get: () => { throw new Error("SecurityError") },
    })
    Object.defineProperty(navigator, "locks", {
      configurable: true,
      value: locks,
    })

    expect(getPlanMutationLockManager()).toBeNull()
  })

  it("binds the verified request function to its lock object", async () => {
    locksDescriptor = Object.getOwnPropertyDescriptor(navigator, "locks")
    const locks = {
      marker: "bound",
      request(this: { marker: string }, _name: string, _options: unknown, callback: (lock: object) => unknown) {
        expect(this.marker).toBe("bound")
        return Promise.resolve(callback({}))
      },
    }
    Object.defineProperty(navigator, "locks", {
      configurable: true,
      value: locks,
    })

    const manager = getPlanMutationLockManager()
    expect(manager).not.toBeNull()
    await expect(manager?.request("test", { mode: "exclusive", ifAvailable: true }, () => "ok"))
      .resolves.toBe("ok")
  })
})
