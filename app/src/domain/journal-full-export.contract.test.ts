import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { exportEntriesJSON, saveEntry, type JournalEntry } from "./journal-store"

function privateEntry(memo: string): JournalEntry {
  return {
    id: "owner-full-backup",
    kind: "post-session",
    date: "2026-07-14",
    savedAt: "2026-07-14T00:00:00.000Z",
    syncState: "local",
    system: "lt",
    title: "tempo",
    distanceKm: "8",
    durationMin: "40",
    avgPace: "5:00",
    rpe: 6,
    memo,
    memoPurpose: "PRIVATE_SELF_ONLY",
    fieldProvenance: {
      distanceKm: { provenance: "EXPLICIT" },
      durationMin: { provenance: "EXPLICIT" },
      avgPace: { provenance: "EXPLICIT" },
      rpe: { provenance: "EXPLICIT" },
    },
  }
}

describe("owner-selected full journal export", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-07-14T12:00:00.000Z"))
    window.localStorage.clear()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("keeps the default export byte-invariant when only private memo text changes", () => {
    expect(saveEntry(privateEntry("PRIVATE_EXPORT_A")).ok).toBe(true)
    const first = exportEntriesJSON()
    window.localStorage.clear()
    expect(saveEntry(privateEntry("PRIVATE_EXPORT_B")).ok).toBe(true)
    const second = exportEntriesJSON()

    expect(first).toBe(second)
    expect(first).not.toContain("PRIVATE_EXPORT_A")
    expect(second).not.toContain("PRIVATE_EXPORT_B")
  })

  it("includes raw memo text and purpose only in an explicitly requested full backup", () => {
    expect(saveEntry(privateEntry("OWNER_EXPORT_ONLY_SECRET")).ok).toBe(true)

    const safeExport = exportEntriesJSON()
    const fullBackup = exportEntriesJSON({ includeRawMemos: true })

    expect(safeExport).not.toContain("OWNER_EXPORT_ONLY_SECRET")
    expect(fullBackup).toContain("OWNER_EXPORT_ONLY_SECRET")
    expect(fullBackup).toContain("PRIVATE_SELF_ONLY")
    expect(fullBackup).toContain('"exportMode": "OWNER_FULL_BACKUP"')
  })
})
