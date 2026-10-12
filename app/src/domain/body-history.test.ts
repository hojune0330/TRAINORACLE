import { describe, expect, it } from "vitest"
import type { JournalEntry } from "./journal-schema"
import type { OtherBodyPartId } from "./body-part-metadata"
import { projectBodyHistory, recentCustomBodyParts } from "./body-history"

const OTHER_ID = "other_11111111-1111-4111-8111-111111111111" as OtherBodyPartId

function evening(
  id: string,
  date: string,
  painParts: Readonly<Record<string, number>>,
  savedAt = date + "T09:00:00.000Z",
  extra: Partial<JournalEntry> = {},
): JournalEntry {
  return {
    id, kind: "evening", date, savedAt, syncState: "local",
    sleepH: 0, sleepQuality: 0, weightKg: "", restingHr: "",
    painParts, mood: 0, note: "synthetic private journal note",
    ...extra,
  } as JournalEntry
}

function session(
  id: string,
  date: string,
  painParts: Readonly<Record<string, number>>,
  savedAt = date + "T09:00:00.000Z",
  extra: Partial<JournalEntry> = {},
): JournalEntry {
  return {
    id, kind: "post-session", date, savedAt, syncState: "local",
    system: "", title: "synthetic title", distanceKm: "", durationMin: "",
    avgPace: "", rpe: 0, memo: "synthetic private memo",
    painParts, ...extra,
  } as JournalEntry
}

function customObservation(
  labelSnapshot: string,
  severity: 1 | 2 | 3 | 4 | 5,
  note?: string,
) {
  return {
    schemaVersion: 1 as const,
    observations: [{
      id: OTHER_ID,
      labelSnapshot,
      severity,
      ...(note === undefined ? {} : { note }),
    }],
  }
}

describe("body history projection", () => {
  it("keeps each same-day source separate and never fills absent parts with zero", () => {
    const entries = [
      session("session-knee", "2026-10-10", { rKnee: 2 }, "2026-10-10T08:00:00.000Z"),
      evening("evening-knee", "2026-10-10", { rKnee: 4 }, "2026-10-10T14:00:00.000Z"),
      evening("no-body-answer", "2026-10-11", {}),
    ]

    const result = projectBodyHistory(entries)

    expect(result.parts.map(part => part.id)).toEqual(["rKnee"])
    expect(result.parts[0]?.records.map(record => ({
      entryId: record.entryId,
      source: record.source,
      date: record.date,
      severity: record.severity,
    }))).toEqual([
      { entryId: "evening-knee", source: "evening", date: "2026-10-10", severity: 4 },
      { entryId: "session-knee", source: "post-session", date: "2026-10-10", severity: 2 },
    ])
    expect(JSON.stringify(result)).not.toContain("synthetic private")
  })

  it("accepts a present zero value only as a source row and ignores invalid rows", () => {
    const result = projectBodyHistory([
      evening("explicit-zero-key", "2026-10-10", { rKnee: 0 }),
      evening("bad-level", "2026-10-11", { lKnee: 6 }),
      evening("bad-date", "2026-02-30", { lCalf: 3 }),
    ])

    expect(result.parts).toEqual([
      expect.objectContaining({
        id: "rKnee",
        lastRecordedDate: "2026-10-10",
        records: [expect.objectContaining({ entryId: "explicit-zero-key", severity: 0 })],
      }),
    ])
  })

  it("groups valid custom observations by opaque ID while retaining each name snapshot and note", () => {
    const entries = [
      evening("old-custom", "2026-10-01", {}, "2026-10-01T09:00:00.000Z", {
        bodyPartMetadata: customObservation("발목", 2, "synthetic earlier note"),
      }),
      evening("new-custom", "2026-10-09", {}, "2026-10-09T11:00:00.000Z", {
        bodyPartMetadata: customObservation("왼쪽 발목", 4, "synthetic newest note"),
      }),
      evening("other-custom", "2026-10-08", {}, "2026-10-08T11:00:00.000Z", {
        bodyPartMetadata: {
          schemaVersion: 1,
          observations: [{
            id: "other_22222222-2222-4222-8222-222222222222" as OtherBodyPartId,
            labelSnapshot: "오른쪽 발목",
            severity: 1,
          }],
        },
      }),
    ]

    const result = projectBodyHistory(entries)
    const part = result.parts.find(candidate => candidate.id === OTHER_ID)

    expect(part).toMatchObject({
      id: OTHER_ID,
      kind: "OTHER",
      label: "왼쪽 발목",
      lastRecordedDate: "2026-10-09",
    })
    expect(part?.records.map(record => ({
      entryId: record.entryId,
      labelSnapshot: record.labelSnapshot,
      severity: record.severity,
      note: record.note,
    }))).toEqual([
      { entryId: "new-custom", labelSnapshot: "왼쪽 발목", severity: 4, note: "synthetic newest note" },
      { entryId: "old-custom", labelSnapshot: "발목", severity: 2, note: "synthetic earlier note" },
    ])
    expect(recentCustomBodyParts(entries)).toEqual([
      { id: OTHER_ID, labelSnapshot: "왼쪽 발목" },
      { id: "other_22222222-2222-4222-8222-222222222222" as OtherBodyPartId, labelSnapshot: "오른쪽 발목" },
    ])
  })

  it("keeps unknown legacy identifiers generic and never returns their text", () => {
    const rawKey = "synthetic private location key"
    const result = projectBodyHistory([
      evening("legacy-other", "2026-10-10", { [rawKey]: 3 }),
    ])

    expect(result.parts).toMatchObject([
      {
        id: "legacy-other",
        kind: "LEGACY_OTHER",
        label: "기타 부위",
        records: [expect.objectContaining({ severity: 3 })],
      },
    ])
    expect(JSON.stringify(result)).not.toContain(rawKey)
  })

  it("reflects current edits and deletion without retaining a copied history cache", () => {
    const original = evening("editable", "2026-10-10", { rKnee: 5 })
    const edited = { ...original, painParts: { rKnee: 1 } } as JournalEntry

    expect(projectBodyHistory([original]).parts[0]?.records[0]?.severity).toBe(5)
    expect(projectBodyHistory([edited]).parts[0]?.records[0]?.severity).toBe(1)
    expect(projectBodyHistory([]).parts).toEqual([])
  })
})
