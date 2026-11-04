import { parseActivityFile } from "../domain/import/activity-file"
import { toImportedEntry } from "../domain/import/import-draft"
import { accountJournalRecordSchema } from "../domain/account/account-journal-record-schema"
/** Synthetic only. No user's activity, location, provider account, or permission. */
export function largeFileJournalFixture(points = 3600) {
  const start = Date.parse("2026-11-04T00:00:00Z")
  const track = Array.from({ length: points }, (_, i) => `<Trackpoint><Time>${new Date(start + i * 1000).toISOString()}</Time><Position><LatitudeDegrees>${(37 + i * 0.0000015).toFixed(7)}</LatitudeDegrees><LongitudeDegrees>${(127 + i * 0.0000014).toFixed(7)}</LongitudeDegrees></Position><DistanceMeters>${(i * 3.2).toFixed(1)}</DistanceMeters><HeartRateBpm><Value>${140 + i % 15}</Value></HeartRateBpm><Extensions><ae:TPX><ae:Watts>${220 + i % 30}</ae:Watts></ae:TPX></Extensions></Trackpoint>`).join("")
  const xml = `<TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2" xmlns:ae="http://www.garmin.com/xmlschemas/ActivityExtension/v2"><Activities><Activity Sport="Running"><Id>2026-11-04T00:00:00Z</Id><Creator><Name>Synthetic measurement</Name></Creator><Lap StartTime="2026-11-04T00:00:00Z"><TotalTimeSeconds>${points}</TotalTimeSeconds><DistanceMeters>${points * 3.2}</DistanceMeters><Track>${track}</Track></Lap></Activity></Activities></TrainingCenterDatabase>`
  const activity = parseActivityFile(xml, "UTC").activities[0]
  if (!activity) throw new Error("SYNTHETIC_PARSE_FAILED")
  return accountJournalRecordSchema.parse({ version: 5, state: "FINALIZED", kind: "JOURNAL",
    entry: { ...toImportedEntry(activity, "tcx"), id: `synthetic-large-${points}`, savedAt: "2026-11-04T01:00:00.000Z" } })
}
