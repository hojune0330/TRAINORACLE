import { GARMIN_VERSION, type GarminConfirmation, type GarminItem, type GarminStatus } from "../domain/account/garmin-integration"
import { prepareDeviceActivity } from "../domain/import/prepared-device-activity"

export const syntheticGarminOwner = "abcde000-0000-4000-8000-000000000001"
export const syntheticGarminItem: GarminItem = {
  inboxId: "abcde000-0000-4000-8000-000000000002", revision: 1, state: "PENDING", provider: "GARMIN", documentId: null, detailManifest: [],
  observation: prepareDeviceActivity({ provider: "GARMIN", sourceId: "synthetic-garmin-1", sourceVersion: "1", sport: "RUNNING", startedAt: "2026-11-04T23:30:00Z", timeZone: "UTC", distanceMeters: 0, durationSeconds: null, durationMeaning: "UNKNOWN", laps: [{ distanceMeters: 0, durationSeconds: null, durationMeaning: "UNKNOWN" }] })!,
  clock: { basis: "DEVICE_OFFSET", offsetSeconds: 32400, localDate: "2026-11-05" },
}
export const syntheticGarminStatus: GarminStatus = { schemaVersion: GARMIN_VERSION, capability: { enabled: true, reason: "READY" }, connection: { state: "ACTIVE", epoch: "abcde000-0000-4000-8000-000000000003", lastSyncAt: null }, pendingCount: 1 }
export const syntheticGarminReceipt: GarminConfirmation = { schemaVersion: GARMIN_VERSION, kind: "saved", documentId: "abcde000-0000-4000-8000-000000000004", journalEntryId: "garmin-synthetic-entry", revision: 1, date: "2026-11-05" }
