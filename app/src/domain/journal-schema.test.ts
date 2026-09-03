import { describe, expect, it } from "vitest"
import { memoPurposeOf, parseJournalEntry, parseJournalEntryForWrite, parseTargetPaceInput } from "./journal-schema"

describe("parseTargetPaceInput", () => {
  it("returns a seconds-per-kilometer value when minutes and seconds are valid", () => {
    // Given
    const minutes = "3"
    const seconds = "45"

    // When
    const pace = parseTargetPaceInput(minutes, seconds)

    // Then
    expect(pace).toEqual({
      schemaVersion: 1,
      unit: "seconds_per_kilometer",
      secondsPerKm: 225,
    })
  })

  it("accepts a colon-delimited pace in the minutes field", () => {
    // Given
    const paceInput = "3:45"

    // When
    const pace = parseTargetPaceInput(paceInput, "")

    // Then
    expect(pace?.secondsPerKm).toBe(225)
  })

  it.each([
    ["", "", "blank"],
    ["-1", "30", "negative minutes"],
    ["3", "60", "seconds at sixty"],
    ["3", "1.5", "fractional seconds"],
    ["0", "0", "zero total"],
  ])("rejects %s:%s as %s", (minutes, seconds) => {
    // Given / When
    const pace = parseTargetPaceInput(minutes, seconds)

    // Then
    expect(pace).toBeNull()
  })
})

describe("memoPurposeOf", () => {
  it("treats legacy unlabeled text as private self-only", () => {
    // Given
    const legacyEntry = {}

    // When
    const purpose = memoPurposeOf(legacyEntry)

    // Then
    expect(purpose).toBe("PRIVATE_SELF_ONLY")
  })

  it("preserves an explicitly analyzable training-note purpose", () => {
    // Given
    const trainingNote = { memoPurpose: "ANALYZABLE_TRAINING_NOTE" }

    // When
    const purpose = memoPurposeOf(trainingNote)

    // Then
    expect(purpose).toBe("ANALYZABLE_TRAINING_NOTE")
  })
})

describe("post-session intensity assessment persistence", () => {
  it("preserves planned RPE and an interval component when the payload is valid", () => {
    // Given
    const entry = {
      id: "session-intensity-1",
      kind: "post-session",
      date: "2026-07-18",
      savedAt: "2026-07-18T01:00:00.000Z",
      syncState: "local",
      system: "vo2",
      title: "6 x 400m",
      distanceKm: "6",
      durationMin: "45",
      avgPace: "3:40",
      rpe: 8,
      memo: "",
      intensityAssessment: {
        schemaVersion: 1,
        plannedRpe: 7,
        objectiveComponents: [{
          componentId: "component-1",
          kind: "INTERVALS",
          repetitions: 6,
          workSeconds: 72,
          recoverySeconds: 90,
          actualPaceSecondsPerKm: 180,
          referencePaceSecondsPerKm: 190,
        }],
      },
    }

    // When
    const parsed = parseJournalEntry(entry)

    // Then
    expect(parsed?.kind).toBe("post-session")
    if (parsed?.kind !== "post-session") throw new TypeError("Expected a post-session entry")
    expect(parsed.intensityAssessment).toEqual(entry.intensityAssessment)
  })
})

describe("quick progressive journal write invariants", () => {
  const quick = {
    id: "quick-v2",
    kind: "post-session" as const,
    date: "2026-09-02",
    savedAt: "2026-09-02T01:00:00.000Z",
    syncState: "local" as const,
    captureDepth: "QUICK" as const,
    activityOutcome: "COMPLETED" as const,
    activitySlot: "AM" as const,
    objectiveDataState: "WAITING" as const,
    planExecutionRelation: "NOT_APPLICABLE" as const,
    painCheckStatus: "NO_SIGNAL_REPORTED" as const,
    system: "",
    title: "운동 완료",
    distanceKm: "",
    durationMin: "",
    avgPace: "",
    rpe: 6,
    memo: "",
    fieldProvenance: {
      activityOutcome: { provenance: "EXPLICIT" as const },
      activitySlot: { provenance: "EXPLICIT" as const },
      plannedSessionLink: { provenance: "MISSING" as const },
      planExecutionRelation: {
        provenance: "DERIVED" as const,
        derivedFrom: ["activityOutcome", "plannedSessionLink"],
        derivationRuleId: "QUICK_PLAN_EXECUTION_RELATION_V2",
      },
      painCheckStatus: { provenance: "EXPLICIT" as const },
      painParts: { provenance: "MISSING" as const },
      rpe: { provenance: "EXPLICIT" as const },
    },
  }

  it("accepts a performed quick entry with exact RPE and an explicit body check", () => {
    expect(parseJournalEntryForWrite(quick)).not.toBeNull()
  })

  it.each([
    ["exact RPE plus band", { rpeBand: "RPE_5_6" }],
    ["performed without body check", { painCheckStatus: "UNANSWERED" }],
    ["confirmed without objective facts", { objectiveDataState: "CONFIRMED" }],
    ["plan relation without link", { planExecutionRelation: "AS_PLANNED" }],
  ])("rejects %s", (_label, mutation) => {
    expect(parseJournalEntryForWrite({ ...quick, ...mutation })).toBeNull()
  })

  it("accepts rest only when effort, slot, and waiting objective state are absent", () => {
    const rest = {
      ...quick,
      activityOutcome: "RESTED",
      activitySlot: undefined,
      objectiveDataState: "NONE",
      painCheckStatus: undefined,
      rpe: 0,
      fieldProvenance: {
        activityOutcome: { provenance: "EXPLICIT" as const },
        plannedSessionLink: { provenance: "MISSING" as const },
        planExecutionRelation: {
          provenance: "DERIVED" as const,
          derivedFrom: ["activityOutcome", "plannedSessionLink"],
          derivationRuleId: "QUICK_PLAN_EXECUTION_RELATION_V2",
        },
        rpe: { provenance: "MISSING" as const },
      },
    }
    expect(parseJournalEntryForWrite(rest)).not.toBeNull()
    expect(parseJournalEntryForWrite({ ...rest, activitySlot: "PM" })).toBeNull()
    expect(parseJournalEntryForWrite({ ...rest, rpe: 2 })).toBeNull()
    expect(parseJournalEntryForWrite({ ...rest, system: "base" })).toBeNull()
    expect(parseJournalEntryForWrite({ ...rest, distanceKm: "5" })).toBeNull()
    expect(parseJournalEntryForWrite({
      ...rest,
      intensityAssessment: { schemaVersion: 1, plannedRpe: 6, objectiveComponents: [] },
    })).toBeNull()
    expect(parseJournalEntryForWrite({
      ...rest,
      fieldProvenance: {
        ...rest.fieldProvenance,
        activitySlot: { provenance: "EXPLICIT" },
      },
    })).toBeNull()
    expect(parseJournalEntryForWrite({
      ...rest,
      fieldProvenance: {
        ...rest.fieldProvenance,
        system: { provenance: "EXPLICIT" },
      },
    })).toBeNull()
    expect(parseJournalEntryForWrite({
      ...rest,
      fieldProvenance: {
        ...rest.fieldProvenance,
        plannedRpe: { provenance: "MISSING" },
      },
    })).toBeNull()
  })

  it("keeps old band-only quick entries readable without accepting them as new V2 writes", () => {
    const legacy = {
      ...quick,
      activitySlot: "SINGLE",
      painCheckStatus: undefined,
      rpe: 0,
      rpeBand: "RPE_5_6",
    }
    expect(parseJournalEntry(legacy)).not.toBeNull()
    expect(parseJournalEntryForWrite(legacy)).toBeNull()
  })

  it("rejects a relation falsely labelled as directly entered", () => {
    expect(parseJournalEntryForWrite({
      ...quick,
      fieldProvenance: {
        ...quick.fieldProvenance,
        planExecutionRelation: { provenance: "EXPLICIT" },
      },
    })).toBeNull()
  })
})
