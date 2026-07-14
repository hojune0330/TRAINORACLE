import { beforeEach, describe, expect, it } from "vitest"
import { FIELD_PROVENANCE } from "./field-provenance"
import { lifetimeStats, thisWeekStats } from "./aggregates"
import {
  loadAnalysisEntries,
  loadEntries,
  saveEntry,
  type JournalEntry,
} from "./journal-store"

const STORAGE_KEY = "trainoracle.journal.v1"

function legacyPostSession(id: string): JournalEntry {
  return {
    id,
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
    memo: "",
  }
}

describe("journal provenance rollout boundary", () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it("keeps a legacy entry visible while excluding it from analysis by default", () => {
    const legacy = legacyPostSession("legacy-visible")

    expect(saveEntry(legacy).ok).toBe(true)
    expect(loadEntries()).toEqual([legacy])
    expect(loadAnalysisEntries()).toEqual([])
    expect(thisWeekStats()).toEqual({
      sessions: 0,
      distanceKm: 0,
      avgRpe: null,
      daysLogged: 0,
    })
    expect(lifetimeStats()).toEqual({ total: 0, days: 0, firstDate: null })
  })

  it("keeps only explicitly entered fields in the analysis projection", () => {
    const entry = {
      ...legacyPostSession("mixed-provenance"),
      fieldProvenance: {
        distanceKm: { provenance: FIELD_PROVENANCE.explicit },
        durationMin: { provenance: FIELD_PROVENANCE.missing },
        avgPace: { provenance: FIELD_PROVENANCE.missing },
        rpe: { provenance: FIELD_PROVENANCE.missing },
      },
    } satisfies JournalEntry

    expect(saveEntry(entry).ok).toBe(true)
    expect(loadAnalysisEntries()).toEqual([
      expect.objectContaining({
        id: "mixed-provenance",
        distanceKm: "8",
        durationMin: "",
        avgPace: "",
        rpe: 0,
      }),
    ])
  })

  it("rejects an unregistered derivation from analysis without deleting its journal entry", () => {
    const entry = {
      ...legacyPostSession("unknown-derived"),
      fieldProvenance: {
        distanceKm: {
          provenance: FIELD_PROVENANCE.derived,
          derivedFrom: ["rpe"],
          derivationRuleId: "UNREGISTERED",
        },
        durationMin: { provenance: FIELD_PROVENANCE.missing },
        avgPace: { provenance: FIELD_PROVENANCE.missing },
        rpe: { provenance: FIELD_PROVENANCE.missing },
      },
    } satisfies JournalEntry

    expect(saveEntry(entry).ok).toBe(true)
    expect(loadEntries()).toEqual([entry])
    expect(loadAnalysisEntries()).toEqual([])
  })

  it("keeps a persisted invalid provenance record visible and ineligible", () => {
    const legacy = {
      ...legacyPostSession("invalid-persisted-provenance"),
      fieldProvenance: {
        distanceKm: { provenance: "UNSUPPORTED" },
      },
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([legacy]))

    expect(loadEntries()).toHaveLength(1)
    expect(loadEntries()[0]).toEqual(expect.objectContaining({
      id: "invalid-persisted-provenance",
      fieldProvenance: {},
    }))
    expect(loadAnalysisEntries()).toEqual([])
  })

  it("rejects new provenance metadata that names a field outside its entry", () => {
    const entry = {
      ...legacyPostSession("unknown-provenance-field"),
      fieldProvenance: {
        notAJournalField: { provenance: FIELD_PROVENANCE.explicit },
      },
    }

    expect(saveEntry(entry).ok).toBe(false)
    expect(loadEntries()).toEqual([])
  })

  it("restores a snapshot without changing legacy records or making them eligible", () => {
    const legacy = legacyPostSession("rollback-legacy")
    const snapshot = JSON.stringify([legacy])
    window.localStorage.setItem(STORAGE_KEY, snapshot)

    expect(saveEntry({
      ...legacyPostSession("new-provenance"),
      fieldProvenance: {
        distanceKm: { provenance: FIELD_PROVENANCE.explicit },
        durationMin: { provenance: FIELD_PROVENANCE.explicit },
        avgPace: { provenance: FIELD_PROVENANCE.explicit },
        rpe: { provenance: FIELD_PROVENANCE.explicit },
      },
    }).ok).toBe(true)

    window.localStorage.setItem(STORAGE_KEY, snapshot)

    expect(loadEntries()).toEqual([legacy])
    expect(loadAnalysisEntries()).toEqual([])
  })
})
