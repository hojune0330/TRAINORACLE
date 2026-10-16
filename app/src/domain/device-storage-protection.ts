export type DeviceStorageProtection = "persistent" | "best-effort" | "unavailable"

/** One request per page lifetime, including denial. Never reads personal data,
 * writes a saved flag, deletes a cache, or treats persistence as a backup.
 */
export function createDeviceStorageProtection(
  storage: Pick<StorageManager, "persisted" | "persist"> | undefined,
): () => Promise<DeviceStorageProtection> {
  let request: Promise<DeviceStorageProtection> | undefined
  return () => {
    request ??= (async (): Promise<DeviceStorageProtection> => {
      try {
        if (!storage || typeof storage.persisted !== "function" || typeof storage.persist !== "function") return "unavailable"
        if (await storage.persisted()) return "persistent"
        return await storage.persist() ? "persistent" : "best-effort"
      } catch { return "unavailable" }
    })()
    return request
  }
}

// Lazy access also tolerates WebViews that throw on storage API access.
let protect: (() => Promise<DeviceStorageProtection>) | undefined
export function protectDeviceStorageAfterWrite(): void {
  try {
    protect ??= createDeviceStorageProtection(globalThis.navigator?.storage)
    void protect()
  } catch { /* A protection failure cannot undo a confirmed write. */ }
}
