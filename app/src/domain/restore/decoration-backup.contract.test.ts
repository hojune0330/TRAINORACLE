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
    pages: [
      {
        date: "2026-08-03",
        items: [
          { itemId: "STICKER_WEATHER_SUN", transform: { xPercent: 86, yPercent: 14, scale: 1, rotationDeg: 0 } },
          { itemId: "TAPE_CHECKER", transform: { xPercent: 50, yPercent: 9, scale: 1, rotationDeg: 0 } },
        ],
      },
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
  it("includes V3 decoration state only in the explicit full backup", () => {
    expect(saveDecorationState(decoratedState()).ok).toBe(true)
    saveEntry(post("one"))

    const safe = exportEntriesJSON()
    const full = exportEntriesJSON({ includeRawMemos: true })

    expect(safe).not.toMatch(/"decorations"\s*:/u)
    expect(full).toContain('"format": "trainoracle.journal.full-backup.v3"')
    expect(full).toContain('"decorations": {')
    expect(full).toContain('"version": 3')
    expect(full).toContain('"itemId": "STICKER_WEATHER_SUN"')
  })

  it("previews owned item and placed decoration counts", () => {
    expect(saveDecorationState(decoratedState()).ok).toBe(true)
    saveEntry(post("one"))

    const read = readBackupFile(exportEntriesJSON({ includeRawMemos: true }))

    expect(read.decorationStatus).toBe("included")
    // 카탈로그 확장 계약: 무료 그림 재료 16종 + 이모지 스티커 48종 = 64.
    expect(read.decorationItemCount).toBe(64)
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
    const outcome = await restoreBackupFile(read, buildRestorePlan(read.entries), "keep-existing", "replace")

    expect(outcome.decorationRestore).toBe("RESTORED")
    expect(loadDecorationState()).toEqual(decoratedState())
    expect(loadEntries().map((entry) => entry.id)).toEqual(["one"])
  })

  it("restores a legacy V2 full backup by migrating slot placements to V3 coordinates", async () => {
    // 계약 §5: 이미 내보낸 v2 백업 파일은 계속 복원 가능해야 한다.
    const v2Backup = JSON.stringify({
      app: "TRAINORACLE",
      format: "trainoracle.journal.full-backup.v2",
      exportedAt: "2026-08-03T10:00:00.000Z",
      entries: [post("from-v2")],
      decorations: {
        version: 2,
        spentPoints: 0,
        ownedItemIds: createEmptyDecorationState().ownedItemIds,
        equipped: { themeId: "THEME_TRACK_NOTEBOOK", inkId: "INK_NAVY", avatarId: null },
        library: { favoriteItemIds: [], recentItemIds: [] },
        pagePlacements: [
          { date: "2026-08-03", slot: "TOP_CORNER", itemId: "STICKER_WEATHER_SUN" },
        ],
        pointMeaning: "NON_ECONOMIC_NON_TRANSFERABLE_BETA",
      },
    })
    const read = readBackupFile(v2Backup)

    expect(read.recognized).toBe(true)
    expect(read.decorationStatus).toBe("included")
    expect(read.decorationPlacementCount).toBe(1)

    const outcome = await restoreBackupFile(read, buildRestorePlan(read.entries), "keep-existing", "replace")

    expect(outcome.decorationRestore).toBe("RESTORED")
    const restored = loadDecorationState()
    expect(restored.version).toBe(3)
    expect(restored.pages).toEqual([
      {
        date: "2026-08-03",
        items: [{ itemId: "STICKER_WEATHER_SUN", transform: { xPercent: 86, yPercent: 14, scale: 1, rotationDeg: 0 } }],
      },
    ])
    /* 복원은 .v2-backup 키를 건드리지 않는다 (계약 §5). */
    expect(window.localStorage.getItem("trainoracle.decorations.v2-backup")).toBeNull()
  })

  it("keeps current decorations unless replacement is explicitly selected", async () => {
    const current = decoratedState()
    expect(saveDecorationState(current).ok).toBe(true)
    const backup = {
      ...createEmptyDecorationState(),
      spentPoints: 20,
      ownedItemIds: [...createEmptyDecorationState().ownedItemIds, "STICKER_FINISH_LINE"],
    }
    const read = readBackupFile(JSON.stringify({
      app: "TRAINORACLE",
      format: "trainoracle.journal.full-backup.v3",
      entries: [post("restore")],
      decorations: backup,
    }))

    const outcome = await restoreBackupFile(read, buildRestorePlan(read.entries))

    expect(outcome.decorationRestore).toBe("KEPT_EXISTING")
    expect(loadDecorationState()).toEqual(current)
    expect(loadEntries().map((entry) => entry.id)).toEqual(["restore"])
  })

  it("normalizes unknown decoration ids in a full backup without dropping known items", () => {
    const state = createEmptyDecorationState()
    const read = readBackupFile(JSON.stringify({
      app: "TRAINORACLE",
      format: "trainoracle.journal.full-backup.v3",
      entries: [],
      decorations: {
        ...state,
        ownedItemIds: [...state.ownedItemIds, "UNKNOWN_ITEM"],
        library: { favoriteItemIds: ["UNKNOWN_ITEM"], recentItemIds: ["STICKER_WEATHER_SUN"] },
      },
    }))

    expect(read.decorationStatus).toBe("included")
    expect(read.decorations?.ownedItemIds).toEqual(state.ownedItemIds)
    expect(read.decorations?.library.favoriteItemIds).toEqual([])
  })

  it("skips invalid decoration state while preserving journal restoration", async () => {
    const invalid = JSON.stringify({
      app: "TRAINORACLE",
      format: "trainoracle.journal.full-backup.v3",
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
      if (key === "trainoracle.decorations.v3") throw new DOMException("quota")
      setItem(key, value)
    })

    const outcome = await restoreBackupFile(read, buildRestorePlan([post("new")]), "keep-existing", "replace")

    expect(outcome.decorationRestore).toBe("SAVE_FAILED")
    expect(loadEntries().map((entry) => entry.id)).toEqual(["keep"])
  })

  it("rolls both stores back byte-for-byte when journal storage fails after decorations save", async () => {
    saveEntry(post("keep"))
    expect(saveDecorationState(decoratedState()).ok).toBe(true)
    const before = storageBytes()
    const backup = JSON.stringify({
      app: "TRAINORACLE",
      format: "trainoracle.journal.full-backup.v3",
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

    const outcome = await restoreBackupFile(read, buildRestorePlan(read.entries), "keep-existing", "replace")

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
      format: "trainoracle.journal.full-backup.v3",
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

    const outcome = await restoreBackupFile(read, buildRestorePlan(read.entries), "keep-existing", "replace")

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
      competitionDivision: "OPEN" as const,
      experienceBand: "DEVELOPING" as const,
      availableDayCount: 3 as const,
      requestedFrameLength: 9 as const,
      trainingFocus: "LT_INTENT" as const,
      secondSessionMode: "SINGLE_SESSION_ONLY" as const,
      trainingTimePreference: "VARIES" as const,
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
