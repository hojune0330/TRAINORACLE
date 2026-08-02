import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { exportEntriesJSON, savePrivateEntry, type JournalEntry } from "./journal-store"
import { createRecoveryCode } from "./account/private-note-crypto"
import { saveSessionRecoveryCode } from "./account/private-note-sync"

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

  it("keeps the default export byte-invariant when only private memo text changes", async () => {
    expect(saveSessionRecoveryCode(createRecoveryCode())).toBe(true)
    await expect(savePrivateEntry(privateEntry("PRIVATE_EXPORT_A"))).resolves.toEqual({ ok: true, total: 1 })
    const first = exportEntriesJSON()
    window.localStorage.clear()
    await expect(savePrivateEntry(privateEntry("PRIVATE_EXPORT_B"))).resolves.toEqual({ ok: true, total: 1 })
    const second = exportEntriesJSON()

    expect(first).toBe(second)
    expect(first).not.toContain("PRIVATE_EXPORT_A")
    expect(second).not.toContain("PRIVATE_EXPORT_B")
  })

  it("includes raw memo text and purpose only in an explicitly requested full backup", async () => {
    expect(saveSessionRecoveryCode(createRecoveryCode())).toBe(true)
    await expect(savePrivateEntry(privateEntry("OWNER_EXPORT_ONLY_SECRET"))).resolves.toEqual({ ok: true, total: 1 })

    const safeExport = exportEntriesJSON()
    const fullBackup = exportEntriesJSON({ includeRawMemos: true })

    expect(safeExport).not.toContain("OWNER_EXPORT_ONLY_SECRET")
    expect(fullBackup).toContain("OWNER_EXPORT_ONLY_SECRET")
    expect(fullBackup).toContain("PRIVATE_SELF_ONLY")
    expect(fullBackup).toContain('"exportMode": "OWNER_FULL_BACKUP"')
  })
})
