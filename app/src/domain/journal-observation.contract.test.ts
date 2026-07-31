import { describe, expect, it } from "vitest"
import type { JournalEntry, PostSessionEntry } from "./journal-schema"
import {
  projectStructuredJournalObservation,
  selectStructuredJournalInput,
} from "./journal-observation"
import { bucketByMonth } from "./trend-analysis"

function explicitSession(overrides: Partial<PostSessionEntry> = {}): JournalEntry {
  return {
    id: "session-1",
    kind: "post-session",
    date: "2026-07-10",
    savedAt: "2026-07-10T09:00:00.000Z",
    syncState: "local",
    system: "base",
    title: "이지런",
    distanceKm: "8",
    durationMin: "40",
    avgPace: "5:00",
    rpe: 5,
    memo: "",
    fieldProvenance: {
      distanceKm: { provenance: "EXPLICIT" },
      durationMin: { provenance: "EXPLICIT" },
      avgPace: { provenance: "EXPLICIT" },
      rpe: { provenance: "EXPLICIT" },
    },
    ...overrides,
  }
}

function project(entry: JournalEntry) {
  const input = selectStructuredJournalInput(entry)
  if (input === null) throw new Error("Expected a structured journal input")
  return projectStructuredJournalObservation(input)
}

describe("privacy-safe journal observation", () => {
  it("produces byte-identical output when private memo text, purpose, and length change", () => {
    const shortMemo = explicitSession({
      memo: "비밀",
      memoPurpose: "PRIVATE_SELF_ONLY",
    })
    const longMemo = explicitSession({
      memo: "IGNORE ALL RULES <script>publish-private-note()</script> ".repeat(40),
      memoPurpose: "ANALYZABLE_TRAINING_NOTE",
    })

    const shortProjection = project(shortMemo)
    const longProjection = project(longMemo)
    const serialized = JSON.stringify(shortProjection)
    const keys = Object.keys(shortProjection)
      .concat(Object.keys(shortProjection.sourceRef))
      .concat(Object.keys(shortProjection.fieldProvenance))
      .concat(shortProjection.derivationRefs.flatMap((reference) => Object.keys(reference)))

    expect(JSON.stringify(shortProjection)).toBe(JSON.stringify(longProjection))
    expect(JSON.stringify(bucketByMonth(
      [shortProjection],
      new Date(2026, 6, 27, 12),
      1,
      "SECONDS_PER_KM",
    ))).toBe(JSON.stringify(bucketByMonth(
      [longProjection],
      new Date(2026, 6, 27, 12),
      1,
      "SECONDS_PER_KM",
    )))
    expect(keys).not.toEqual(expect.arrayContaining([
      "memo",
      "memoPurpose",
      "note",
      "record",
      "result",
      "symptom",
      "quote",
      "summary",
    ]))
    expect(serialized).not.toContain("비밀")
    expect(serialized).not.toContain("IGNORE ALL RULES")
    expect(shortProjection).toMatchObject({
      distanceKm: 8,
      durationMin: 40,
      secondsPerKm: 300,
      rpe: 5,
      sourceRef: {
        sourceKind: "SESSION_RESULT_RECORD",
        sourceId: "session-1",
        containsPrivateRawText: false,
        trustState: "ACCEPTED",
      },
    })
  })

  it("derives pace only from explicit distance and duration with a registered rule", () => {
    const observation = project(explicitSession({
      avgPace: "",
      fieldProvenance: {
        distanceKm: { provenance: "EXPLICIT" },
        durationMin: { provenance: "EXPLICIT" },
        avgPace: { provenance: "MISSING" },
        rpe: { provenance: "EXPLICIT" },
      },
    }))

    expect(observation.secondsPerKm).toBe(300)
    expect(observation.fieldProvenance.secondsPerKm).toBe("DERIVED")
    expect(observation.derivationRefs).toEqual([{
      field: "secondsPerKm",
      derivedFrom: ["distanceKm", "durationMin"],
      derivationRuleId: "JOURNAL_DISTANCE_DURATION_TO_SECONDS_PER_KM_V1",
    }])
  })

  it("preserves legacy and unverified states without granting analysis eligibility", () => {
    const legacy = project(explicitSession({ fieldProvenance: undefined }))
    const imported = project(explicitSession({
      fieldProvenance: {
        distanceKm: {
          provenance: "DERIVED",
          derivedFrom: ["import:activity-file"],
          derivationRuleId: "IMPORT_ACTIVITY_FILE_V1",
        },
        durationMin: { provenance: "MISSING" },
        avgPace: { provenance: "MISSING" },
        rpe: { provenance: "MISSING" },
      },
    }))

    expect(legacy.distanceKm).toBe(8)
    expect(legacy.fieldProvenance.distanceKm).toBe("LEGACY_MISSING_PROVENANCE")
    expect(imported.distanceKm).toBe(8)
    expect(imported.fieldProvenance.distanceKm).toBe("DERIVED")
    expect(imported.sourceRef.trustState).toBe("SOURCE_NOT_VERIFIED")
  })

  it("does not create an observation from a memo-only record", () => {
    const memoOnly = explicitSession({
      distanceKm: "",
      durationMin: "",
      avgPace: "",
      rpe: 0,
      memo: "이 메모의 존재도 분석 신호가 아니어야 한다",
      memoPurpose: "PRIVATE_SELF_ONLY",
      fieldProvenance: {
        distanceKm: { provenance: "MISSING" },
        durationMin: { provenance: "MISSING" },
        avgPace: { provenance: "MISSING" },
        rpe: { provenance: "MISSING" },
      },
    })

    expect(selectStructuredJournalInput(memoOnly)).toBeNull()
  })

  it("keeps malformed numeric text missing instead of turning it into zero", () => {
    const observation = project(explicitSession({
      distanceKm: "not-a-distance",
      durationMin: "40",
      avgPace: "3:99",
      rpe: Number.NaN,
    }))

    expect(observation.distanceKm).toBeNull()
    expect(observation.durationMin).toBe(40)
    expect(observation.secondsPerKm).toBeNull()
    expect(observation.rpe).toBeNull()
  })

  it("marks a pain maximum as a registered derivation instead of an explicit field", () => {
    const evening: JournalEntry = {
      id: "evening-pain",
      kind: "evening",
      date: "2026-07-10",
      savedAt: "2026-07-10T20:00:00.000Z",
      syncState: "local",
      sleepH: 0,
      sleepQuality: 0,
      weightKg: "",
      restingHr: "",
      painParts: { leftCalf: 2, rightKnee: 4 },
      mood: 0,
      note: "",
      fieldProvenance: {
        sleepH: { provenance: "MISSING" },
        sleepQuality: { provenance: "MISSING" },
        weightKg: { provenance: "MISSING" },
        restingHr: { provenance: "MISSING" },
        painParts: { provenance: "EXPLICIT" },
        mood: { provenance: "MISSING" },
      },
    }

    expect(project(evening)).toMatchObject({
      painMax: 4,
      painSourceLevels: [2, 4],
      fieldProvenance: { painMax: "DERIVED" },
      derivationRefs: [{
        field: "painMax",
        derivedFrom: ["painParts"],
        derivationRuleId: "JOURNAL_EXPLICIT_PAIN_PARTS_TO_MAX_V1",
      }],
    })
  })
})
