import { evaluateD9ColloquialLayer } from "@impl/d9/evaluator"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { createEmptyDecorationState, loadDecorationState, saveDecorationState } from "../decorations"
import { JOURNAL_STORAGE_KEY } from "../journal-local-storage"
import { loadAnalysisEntries, loadEntries, exportEntriesJSON, saveEntry } from "../journal-store"
import type { PostSessionEntry } from "../journal-schema"
import { generatePlanFromDraft } from "../plan-beta-flow"
import { toUploadPayload } from "../account/sync-local"
import {
  buildRestorePlan,
  readBackupFile,
  restoreBackupFile,
} from "./backup-file"

function post(id: string): PostSessionEntry {
  return {
    id,
    kind: "post-session",
    date: "2026-08-03",
    savedAt: "2026-08-03T09:00:00.000Z",
    syncState: "local",
    system: "lt",
    title: "템포런",
    distanceKm: "8",
    durationMin: "40",
    avgPace: "5:00",
    rpe: 6,
    memo: "",
    fieldProvenance: {
      distanceKm: { provenance: "EXPLICIT" },
      durationMin: { provenance: "EXPLICIT" },
      avgPace: { provenance: "EXPLICIT" },
      rpe: { provenance: "EXPLICIT" },
    },
  }
}

function decoratedState() {
  return {
    ...createEmptyDecorationState(),
    library: {
      favoriteItemIds: ["STICKER_WEATHER_SUN"],
      recentItemIds: ["TAPE_CHECKER", "STICKER_WEATHER_SUN"],
    },
    pagePlacements: [
      { date: "2026-08-03", slot: "TOP_CORNER", itemId: "STICKER_WEATHER_SUN" },
      { date: "2026-08-03", slot: "HEADER_TAPE", itemId: "TAPE_CHECKER" },
    ],
  } as const
}

function storageBytes(): Readonly<Record<string, string>> {
  const entries: Record<string, string> = {}
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index)
    if (key !== null) entries[key] = window.localStorage.getItem(key) ?? ""
  }
  return entries
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date("2026-08-03T12:00:00.000Z"))
  window.localStorage.clear()
  window.sessionStorage.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe("explicit full backup decoration section", () => {
  it("includes V2 decoration state only in the explicit full backup", () => {
    expect(saveDecorationState(decoratedState()).ok).toBe(true)
    saveEntry(post("one"))

    const safe = exportEntriesJSON()
    const full = exportEntriesJSON({ includeRawMemos: true })

    expect(safe).not.toMatch(/"decorations"\s*:/u)
    expect(full).toContain('"format": "trainoracle.journal.full-backup.v2"')
    expect(full).toContain('"decorations": {')
    expect(full).toContain('"version": 2')
    expect(full).toContain('"itemId": "STICKER_WEATHER_SUN"')
  })

  it("previews owned item and placed decoration counts", () => {
    expect(saveDecorationState(decoratedState()).ok).toBe(true)
    saveEntry(post("one"))

    const read = readBackupFile(exportEntriesJSON({ includeRawMemos: true }))

    expect(read.decorationStatus).toBe("included")
    expect(read.decorationItemCount).toBe(5)
    expect(read.decorationPlacementCount).toBe(2)
  })

  it("accepts legacy V1 full backups without replacing current decorations", async () => {
    expect(saveDecorationState(decoratedState()).ok).toBe(true)
    const before = loadDecorationState()
    const legacy = JSON.stringify({
      app: "TRAINORACLE",
      format: "trainoracle.journal.full-backup.v1",
      exportedAt: "2026-08-03T10:00:00.000Z",
      entries: [post("legacy")],
    })
    const read = readBackupFile(legacy)

    expect(read.recognized).toBe(true)
    expect(read.decorationStatus).toBe("not-included")
    await restoreBackupFile(read, buildRestorePlan(read.entries))

    expect(loadEntries().map((entry) => entry.id)).toEqual(["legacy"])
    expect(loadDecorationState()).toEqual(before)
  })

  it("round-trips the exact validated decoration state", async () => {
    expect(saveDecorationState(decoratedState()).ok).toBe(true)
    saveEntry(post("one"))
    const backup = exportEntriesJSON({ includeRawMemos: true })

    window.localStorage.clear()
    const read = readBackupFile(backup)
    const outcome = await restoreBackupFile(read, buildRestorePlan(read.entries))

    expect(outcome.decorationRestore).toBe("RESTORED")
    expect(loadDecorationState()).toEqual(decoratedState())
    expect(loadEntries().map((entry) => entry.id)).toEqual(["one"])
  })

  it("skips invalid decoration state while preserving journal restoration", async () => {
    const invalid = JSON.stringify({
      app: "TRAINORACLE",
      format: "trainoracle.journal.full-backup.v2",
      exportedAt: "2026-08-03T10:00:00.000Z",
      entries: [post("valid-journal")],
      decorations: { ...decoratedState(), version: 99 },
    })
    const read = readBackupFile(invalid)

    expect(read.decorationStatus).toBe("invalid")
    const outcome = await restoreBackupFile(read, buildRestorePlan(read.entries))

    expect(outcome.decorationRestore).toBe("INVALID_SKIPPED")
    expect(loadEntries().map((entry) => entry.id)).toEqual(["valid-journal"])
    expect(loadDecorationState()).toEqual(createEmptyDecorationState())
  })

  it("does not modify journal data when decoration storage fails", async () => {
    saveEntry(post("keep"))
    expect(saveDecorationState(decoratedState()).ok).toBe(true)
    const backup = exportEntriesJSON({ includeRawMemos: true })
    const read = readBackupFile(backup)
    const setItem = window.localStorage.setItem.bind(window.localStorage)
    vi.spyOn(Storage.prototype, "setItem").mockImplementation((key, value) => {
      if (key === "trainoracle.decorations.v2") throw new DOMException("quota")
      setItem(key, value)
    })

    const outcome = await restoreBackupFile(read, buildRestorePlan([post("new")]))

    expect(outcome.decorationRestore).toBe("SAVE_FAILED")
    expect(loadEntries().map((entry) => entry.id)).toEqual(["keep"])
  })

  it("rolls both stores back byte-for-byte when journal storage fails after decorations save", async () => {
    saveEntry(post("keep"))
    expect(saveDecorationState(decoratedState()).ok).toBe(true)
    const before = storageBytes()
    const backup = JSON.stringify({
      app: "TRAINORACLE",
      format: "trainoracle.journal.full-backup.v2",
      exportedAt: "2026-08-03T10:00:00.000Z",
      entries: [post("restored")],
      decorations: createEmptyDecorationState(),
    })
    const read = readBackupFile(backup)
    const setItem = window.localStorage.setItem.bind(window.localStorage)
    vi.spyOn(Storage.prototype, "setItem").mockImplementation((key, value) => {
      if (key === JOURNAL_STORAGE_KEY) throw new DOMException("quota")
      setItem(key, value)
    })

    const outcome = await restoreBackupFile(read, buildRestorePlan(read.entries))

    expect(outcome.commit).toBe("ROLLED_BACK")
    expect(outcome.failureReason).toBe("JOURNAL_SAVE_FAILED")
    expect(outcome.restored).toBe(0)
    expect(storageBytes()).toEqual(before)
    expect(loadEntries().map((entry) => entry.id)).toEqual(["keep"])
    expect(loadDecorationState()).toEqual(decoratedState())
  })

  it("does not roll back an unrelated key changed concurrently with restore", async () => {
    saveEntry(post("keep"))
    expect(saveDecorationState(decoratedState()).ok).toBe(true)
    const backup = JSON.stringify({
      app: "TRAINORACLE",
      format: "trainoracle.journal.full-backup.v2",
      exportedAt: "2026-08-03T10:00:00.000Z",
      entries: [post("restored")],
      decorations: createEmptyDecorationState(),
    })
    const read = readBackupFile(backup)
    const setItem = window.localStorage.setItem.bind(window.localStorage)
    vi.spyOn(Storage.prototype, "setItem").mockImplementation((key, value) => {
      if (key === JOURNAL_STORAGE_KEY) {
        setItem("trainoracle.concurrent-setting", "newer-value")
        throw new DOMException("quota")
      }
      setItem(key, value)
    })

    const outcome = await restoreBackupFile(read, buildRestorePlan(read.entries))

    expect(outcome.commit).toBe("ROLLED_BACK")
    expect(window.localStorage.getItem("trainoracle.concurrent-setting")).toBe("newer-value")
    expect(loadEntries().map((entry) => entry.id)).toEqual(["keep"])
    expect(loadDecorationState()).toEqual(decoratedState())
  })
})

describe("decoration state has no analysis, plan, D9, or coach authority", () => {
  it("produces byte-identical non-backup payloads before and after decoration changes", () => {
    saveEntry(post("source"))
    const consent = { enabled: true, shareTrainingNotes: true }
    const planDraft = {
      eventGroup: "MIDDLE_DISTANCE" as const,
      experienceBand: "DEVELOPING" as const,
      availableDayCount: 3 as const,
      requestedFrameLength: 9 as const,
      trainingFocus: "LT_INTENT" as const,
      secondSessionMode: "SINGLE_SESSION_ONLY" as const,
      startDate: "2026-08-03",
      paceEvidence: { kind: "RPE_ONLY" as const },
    }
    const payloadsBefore = [
      exportEntriesJSON(),
      JSON.stringify(loadAnalysisEntries()),
      JSON.stringify(generatePlanFromDraft(planDraft, "NO_KNOWN_RISK")),
      JSON.stringify(evaluateD9ColloquialLayer("통증은 없고 몸 상태는 평소와 같아요")),
      JSON.stringify(toUploadPayload(post("coach"), consent)),
    ]

    expect(saveDecorationState(decoratedState()).ok).toBe(true)
    const payloadsAfter = [
      exportEntriesJSON(),
      JSON.stringify(loadAnalysisEntries()),
      JSON.stringify(generatePlanFromDraft(planDraft, "NO_KNOWN_RISK")),
      JSON.stringify(evaluateD9ColloquialLayer("통증은 없고 몸 상태는 평소와 같아요")),
      JSON.stringify(toUploadPayload(post("coach"), consent)),
    ]

    expect(payloadsAfter).toEqual(payloadsBefore)
    for (const payload of payloadsAfter) {
      expect(payload).not.toMatch(/decorat|STICKER_|TAPE_|THEME_|INK_|AVATAR_/iu)
    }
  })
})
