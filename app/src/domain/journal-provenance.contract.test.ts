import { beforeEach, describe, expect, it } from "vitest"
import { FIELD_PROVENANCE } from "./field-provenance"
import { lifetimeStats, thisWeekStats } from "./aggregates"
import {
  exportEntriesJSON,
  loadAnalysisEntries,
  loadEntries,
  saveEntry,
  savePrivateEntry,
  type JournalEntry,
  type PostSessionEntry,
} from "./journal-store"
import { createRecoveryCode } from "./account/private-note-crypto"
import { saveSessionRecoveryCode } from "./account/private-note-sync"

const STORAGE_KEY = "trainoracle.journal.v1"

function legacyPostSession(id: string): PostSessionEntry {
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
        system: "",
        title: "",
        distanceKm: "8",
        durationMin: "",
        avgPace: "",
        rpe: 0,
      }),
    ])
  })

  it("does not let unprovenanced context or a raw title piggyback on an eligible RPE", () => {
    const rawTitle = "오늘 몸이 무거워서 계획을 바꿨어요"
    const entry = {
      ...legacyPostSession("structured-context-boundary"),
      captureDepth: "QUICK",
      activityOutcome: "COMPLETED",
      activitySlot: "PM",
      objectiveDataState: "WAITING",
      planExecutionRelation: "NOT_APPLICABLE",
      painCheckStatus: "NO_SIGNAL_REPORTED",
      title: rawTitle,
      rpe: 6,
      fieldProvenance: {
        system: { provenance: FIELD_PROVENANCE.missing },
        activityOutcome: { provenance: FIELD_PROVENANCE.missing },
        activitySlot: { provenance: FIELD_PROVENANCE.missing },
        painCheckStatus: { provenance: FIELD_PROVENANCE.missing },
        plannedSessionLink: { provenance: FIELD_PROVENANCE.missing },
        planExecutionRelation: {
          provenance: FIELD_PROVENANCE.derived,
          derivedFrom: ["activityOutcome", "plannedSessionLink"],
          derivationRuleId: "QUICK_PLAN_EXECUTION_RELATION_V2",
        },
        distanceKm: { provenance: FIELD_PROVENANCE.missing },
        durationMin: { provenance: FIELD_PROVENANCE.missing },
        avgPace: { provenance: FIELD_PROVENANCE.missing },
        rpe: { provenance: FIELD_PROVENANCE.explicit },
      },
    } satisfies JournalEntry

    expect(saveEntry(entry).ok).toBe(true)
    const [projected] = loadAnalysisEntries()
    expect(projected).toMatchObject({
      id: "structured-context-boundary",
      system: "",
      title: "",
      rpe: 6,
    })
    expect(projected).not.toHaveProperty("activityOutcome")
    expect(projected).not.toHaveProperty("activitySlot")
    expect(projected).not.toHaveProperty("painCheckStatus")
    expect(projected).not.toHaveProperty("planExecutionRelation")
    expect(projected).not.toHaveProperty("plannedSessionLink")
    expect(JSON.stringify(projected)).not.toContain(rawTitle)
  })

  it("keeps explicitly answered structured context while excluding derived plan relation", () => {
    const entry = {
      ...legacyPostSession("explicit-structured-context"),
      captureDepth: "QUICK",
      activityOutcome: "COMPLETED",
      activitySlot: "AM",
      objectiveDataState: "WAITING",
      planExecutionRelation: "NOT_APPLICABLE",
      painCheckStatus: "NO_SIGNAL_REPORTED",
      rpe: 5,
      fieldProvenance: {
        system: { provenance: FIELD_PROVENANCE.explicit },
        activityOutcome: { provenance: FIELD_PROVENANCE.explicit },
        activitySlot: { provenance: FIELD_PROVENANCE.explicit },
        painCheckStatus: { provenance: FIELD_PROVENANCE.explicit },
        painParts: { provenance: FIELD_PROVENANCE.missing },
        plannedSessionLink: { provenance: FIELD_PROVENANCE.missing },
        planExecutionRelation: {
          provenance: FIELD_PROVENANCE.derived,
          derivedFrom: ["activityOutcome", "plannedSessionLink"],
          derivationRuleId: "QUICK_PLAN_EXECUTION_RELATION_V2",
        },
        distanceKm: { provenance: FIELD_PROVENANCE.missing },
        durationMin: { provenance: FIELD_PROVENANCE.missing },
        avgPace: { provenance: FIELD_PROVENANCE.missing },
        rpe: { provenance: FIELD_PROVENANCE.explicit },
      },
    } satisfies JournalEntry

    expect(saveEntry(entry).ok).toBe(true)
    const [projected] = loadAnalysisEntries()
    expect(projected).toMatchObject({
      system: "lt",
      activityOutcome: "COMPLETED",
      activitySlot: "AM",
      painCheckStatus: "NO_SIGNAL_REPORTED",
      rpe: 5,
    })
    expect(projected).not.toHaveProperty("planExecutionRelation")
  })

  it("keeps an explicit rest day in analysis without counting it as a training session", () => {
    const entry = {
      ...legacyPostSession("explicit-rest-day"),
      captureDepth: "QUICK",
      activityOutcome: "RESTED",
      objectiveDataState: "NONE",
      planExecutionRelation: "NOT_APPLICABLE",
      system: "",
      title: "휴식",
      distanceKm: "",
      durationMin: "",
      avgPace: "",
      rpe: 0,
      fieldProvenance: {
        activityOutcome: { provenance: FIELD_PROVENANCE.explicit },
        system: { provenance: FIELD_PROVENANCE.missing },
        distanceKm: { provenance: FIELD_PROVENANCE.missing },
        durationMin: { provenance: FIELD_PROVENANCE.missing },
        avgPace: { provenance: FIELD_PROVENANCE.missing },
        rpe: { provenance: FIELD_PROVENANCE.missing },
        plannedSessionLink: { provenance: FIELD_PROVENANCE.missing },
        planExecutionRelation: {
          provenance: FIELD_PROVENANCE.derived,
          derivedFrom: ["activityOutcome", "plannedSessionLink"],
          derivationRuleId: "QUICK_PLAN_EXECUTION_RELATION_V2",
        },
      },
    } satisfies JournalEntry

    expect(saveEntry(entry).ok).toBe(true)
    expect(loadAnalysisEntries()).toEqual([
      expect.objectContaining({
        id: "explicit-rest-day",
        activityOutcome: "RESTED",
        title: "",
        distanceKm: "",
        rpe: 0,
      }),
    ])
    expect(thisWeekStats(loadAnalysisEntries(), "2026-07-14")).toEqual({
      sessions: 0,
      distanceKm: 0,
      avgRpe: null,
      daysLogged: 1,
    })
  })

  it("projects explicit intensity evidence without exposing a private memo", async () => {
    const secret = "PRIVATE_INTENSITY_NOTE"
    const intensityAssessment = {
      schemaVersion: 1,
      plannedRpe: 7,
      objectiveComponents: [{
        componentId: "interval-analysis",
        kind: "INTERVALS",
        repetitions: 6,
        workSeconds: 60,
        recoverySeconds: 90,
      }],
    } as const
    const entry = {
      ...legacyPostSession("explicit-intensity"),
      memo: secret,
      memoPurpose: "PRIVATE_SELF_ONLY",
      intensityAssessment,
      fieldProvenance: {
        distanceKm: { provenance: FIELD_PROVENANCE.missing },
        durationMin: { provenance: FIELD_PROVENANCE.missing },
        avgPace: { provenance: FIELD_PROVENANCE.missing },
        rpe: { provenance: FIELD_PROVENANCE.missing },
        plannedRpe: { provenance: FIELD_PROVENANCE.explicit },
        objectiveComponents: { provenance: FIELD_PROVENANCE.explicit },
      },
    } satisfies JournalEntry

    expect(saveSessionRecoveryCode(createRecoveryCode())).toBe(true)
    await expect(savePrivateEntry(entry)).resolves.toEqual({ ok: true, total: 1 })
    expect(loadAnalysisEntries()).toEqual([
      expect.objectContaining({ id: "explicit-intensity", intensityAssessment }),
    ])
    expect(JSON.stringify(loadAnalysisEntries())).not.toContain(secret)
    expect(exportEntriesJSON()).toContain('"plannedRpe": 7')
    expect(exportEntriesJSON()).not.toContain(secret)
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

  it("removes persisted provenance text that is not a field or approved import token", () => {
    const secret = "PRIVATE_MEMO_TEXT_SHOULD_NOT_SURVIVE"
    const persisted = {
      ...legacyPostSession("invalid-derived-source"),
      fieldProvenance: {
        distanceKm: {
          provenance: FIELD_PROVENANCE.derived,
          derivedFrom: [secret],
          derivationRuleId: "UNREGISTERED",
        },
      },
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([persisted]))

    expect(loadEntries()[0]).toEqual(expect.objectContaining({
      id: "invalid-derived-source",
      fieldProvenance: {},
    }))
    expect(exportEntriesJSON()).not.toContain(secret)
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
