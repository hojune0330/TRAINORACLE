import { describe, expect, it, vi } from "vitest"
import { createDeviceStorageProtection } from "./device-storage-protection"

describe("best-effort device persistence", () => {
  it("requests once even for simultaneous saves", async () => {
    const storage = { persisted: vi.fn(async () => false), persist: vi.fn(async () => true) }
    const protect = createDeviceStorageProtection(storage)
    expect(await Promise.all([protect(), protect(), protect()])).toEqual(["persistent", "persistent", "persistent"])
    expect(storage.persisted).toHaveBeenCalledTimes(1)
    expect(storage.persist).toHaveBeenCalledTimes(1)
  })
  it("does not ask again when already persistent", async () => {
    const storage = { persisted: vi.fn(async () => true), persist: vi.fn(async () => false) }
    expect(await createDeviceStorageProtection(storage)()).toBe("persistent")
    expect(storage.persist).not.toHaveBeenCalled()
  })
  it("does not claim persistence or repeatedly prompt after denial", async () => {
    const storage = { persisted: vi.fn(async () => false), persist: vi.fn(async () => false) }
    const protect = createDeviceStorageProtection(storage)
    expect(await protect()).toBe("best-effort")
    expect(await protect()).toBe("best-effort")
    expect(storage.persist).toHaveBeenCalledTimes(1)
  })
  it("tolerates missing APIs and a rejected storage request without a saved claim", async () => {
    expect(await createDeviceStorageProtection(undefined)()).toBe("unavailable")
    expect(await createDeviceStorageProtection({ persisted: async () => false, persist: async () => { throw Error("denied") } })()).toBe("unavailable")
  })
})
