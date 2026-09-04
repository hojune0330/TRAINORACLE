import { describe, expect, it } from "vitest"
import { deriveSequenceTotals } from "./sequence"
import {
  projectPacePrescriptionSequence,
  type PaceSequenceSource,
} from "./pace-sequence"

const operationalComponents = {
  warmup: {
    componentRef: "WU-MD-01",
    componentVersion: "1.0.0",
    authority: "OWNER_OPERATIONAL_ADAPTATION",
    easyDurationMinutes: 15,
    rpeMin: 2,
    rpeMax: 3,
    strides: {
      repetitions: 4,
      durationSeconds: 20,
      recoverySeconds: 40,
      recoveryMode: "WALK_OR_JOG",
      progression: "PROGRESSIVE",
    },
  },
  cooldown: {
    componentRef: "CD-MD-01",
    componentVersion: "1.0.0",
    authority: "OWNER_OPERATIONAL_ADAPTATION",
    easyDurationMinutes: 10,
    rpeMin: 1,
    rpeMax: 2,
  },
  fallback: {
    componentRef: "RPE-ONLY-CONTROLLED-01",
    componentVersion: "1.0.0",
    code: "RPE_ONLY_CONTROLLED",
    behavior: "DELEGATE_TO_EXISTING_RPE_CANDIDATE",
    numericRepetitionVariant: null,
  },
  stopConditions: {
    componentRef: "STOP-MD-01",
    componentVersion: "1.0.0",
    authority: "OWNER_PRECAUTIONARY_OPERATIONAL_RULE",
    diagnosticClaim: false,
    codes: [
      "STOP_NEW_OR_WORSENING_PAIN",
      "STOP_DIZZINESS_OR_FAINTNESS",
      "STOP_CHEST_PAIN_OR_UNUSUAL_BREATHING",
      "STOP_LOSS_OF_CONTROLLED_FORM",
    ],
  },
} as const

function fixture(input: {
  readonly templateId: string
  readonly targetEventDistanceM: number
  readonly repetitionsPerSet: number
  readonly repetitionDistanceM: number
  readonly repetitionRecoverySeconds: number | null
  readonly repetitionRecoveryMode: "WALK" | "JOG" | "STAND" | "NOT_APPLICABLE"
  readonly setCount?: number
  readonly setRecoverySeconds?: number | null
  readonly setRecoveryMode?: "WALK" | "JOG" | "STAND" | "NOT_APPLICABLE"
}): PaceSequenceSource {
  return {
    templateId: input.templateId,
    templateVersion: "1.0.0",
    operationalComponents,
    setCount: input.setCount ?? 1,
    repetitionsPerSet: input.repetitionsPerSet,
    repetitionDistanceM: input.repetitionDistanceM,
    targetEventDistanceM: input.targetEventDistanceM,
    selectedAnchor: {
      anchorId: "record-1",
      kind: "RECENT_RESULT",
      purpose: "CURRENT_CAPABILITY",
      eventDistanceM: input.targetEventDistanceM,
      performanceSeconds: 1000,
      achievedAt: "2026-08-17",
      enteredBy: "ATHLETE",
      verificationState: "SELF_REPORTED",
      freshnessState: "CURRENT",
      seasonId: null,
      sourceRef: "athlete-record:record-1",
      elapsedLabel: "0개월 전",
    },
    repetitionRecoverySeconds: input.repetitionRecoverySeconds,
    repetitionRecoveryMode: input.repetitionRecoveryMode,
    setRecoverySeconds: input.setRecoverySeconds ?? null,
    setRecoveryMode: input.setRecoveryMode ?? "NOT_APPLICABLE",
  }
}

const approvedTemplates = [
  fixture({
    templateId: "MD-800-01",
    targetEventDistanceM: 800,
    repetitionsPerSet: 10,
    repetitionDistanceM: 200,
    repetitionRecoverySeconds: 60,
    repetitionRecoveryMode: "STAND",
  }),
  fixture({
    templateId: "MD-1500-01",
    targetEventDistanceM: 1500,
    repetitionsPerSet: 3,
    repetitionDistanceM: 500,
    repetitionRecoverySeconds: 180,
    repetitionRecoveryMode: "STAND",
  }),
  fixture({
    templateId: "MD-3000-01",
    targetEventDistanceM: 3000,
    repetitionsPerSet: 4,
    repetitionDistanceM: 800,
    repetitionRecoverySeconds: 180,
    repetitionRecoveryMode: "WALK",
  }),
  fixture({
    templateId: "V2-SEED-05",
    targetEventDistanceM: 5000,
    repetitionsPerSet: 5,
    repetitionDistanceM: 1000,
    repetitionRecoverySeconds: 150,
    repetitionRecoveryMode: "JOG",
  }),
] as const

describe("projectPacePrescriptionSequence", () => {
  it.each(approvedTemplates)("projects the approved $templateId structure exactly", (prescription) => {
    const sequence = projectPacePrescriptionSequence(prescription)

    expect(sequence).toEqual(expect.objectContaining({
      kind: "PRESCRIPTION_SEQUENCE",
      version: 2,
      id: `pace-${prescription.templateId}-${prescription.templateVersion}`,
      terminalRecovery: { mode: "NOT_APPLICABLE", seconds: null },
      warmup: [
        expect.objectContaining({
          id: "warmup",
          work: { kind: "duration", distanceM: null, durationSeconds: 900 },
          target: { kind: "EFFORT_GUIDANCE", cue: "RPE 2~3" },
        }),
        expect.objectContaining({
          id: "strides",
          repeatCount: 4,
          work: { kind: "duration", distanceM: null, durationSeconds: 20 },
          recoveryBetweenRepeats: { mode: "WALK_OR_JOG", seconds: 40 },
        }),
      ],
      main: [expect.objectContaining({
        kind: "group",
        id: "sets",
        repeatCount: prescription.setCount,
        children: [expect.objectContaining({
          id: "main",
          repeatCount: prescription.repetitionsPerSet,
          work: {
            kind: "distance",
            distanceM: prescription.repetitionDistanceM,
            durationSeconds: null,
          },
          target: {
            kind: "RACE_PACE",
            eventDistanceM: prescription.targetEventDistanceM,
            anchorRef: prescription.selectedAnchor.sourceRef,
          },
          recoveryBetweenRepeats: {
            mode: prescription.repetitionRecoveryMode,
            seconds: prescription.repetitionRecoverySeconds,
          },
        })],
      })],
      cooldown: [expect.objectContaining({
        id: "cooldown",
        work: { kind: "duration", distanceM: null, durationSeconds: 600 },
        target: { kind: "EFFORT_GUIDANCE", cue: "RPE 1~2" },
      })],
    }))
  })

  it("keeps identity stable across placements and leaves its source untouched", () => {
    const prescription = fixture({
      templateId: "MD-1500-01",
      targetEventDistanceM: 1500,
      repetitionsPerSet: 3,
      repetitionDistanceM: 500,
      repetitionRecoverySeconds: 180,
      repetitionRecoveryMode: "STAND",
    })
    const before = JSON.stringify(prescription)

    const first = projectPacePrescriptionSequence(prescription)
    const second = projectPacePrescriptionSequence({ ...prescription })

    expect(first?.id).toBe("pace-MD-1500-01-1.0.0")
    expect(second?.id).toBe(first?.id)
    expect(JSON.stringify(prescription)).toBe(before)
  })

  it("counts only N-1 within-set recoveries and no terminal recovery", () => {
    const sequence = projectPacePrescriptionSequence(fixture({
      templateId: "unit-two-sets",
      targetEventDistanceM: 3000,
      setCount: 2,
      repetitionsPerSet: 3,
      repetitionDistanceM: 800,
      repetitionRecoverySeconds: 180,
      repetitionRecoveryMode: "WALK",
      setRecoverySeconds: 240,
      setRecoveryMode: "JOG",
    }))
    if (sequence === null) throw new Error("Expected projected sequence")

    const totals = deriveSequenceTotals(sequence)
    expect(totals).toMatchObject({
      repetitionRecoveryOccurrences: 4,
      repetitionRecoveryTotalSeconds: 720,
      setRecoveryOccurrences: 1,
      setRecoveryTotalSeconds: 240,
      terminalRecoveryOccurrences: 0,
      terminalRecoveryTotalSeconds: 0,
      plannedRecoverySeconds: 960,
      qualityDistanceM: 4800,
      qualityDurationSeconds: null,
    })
    expect(sequence.terminalRecovery).toEqual({ mode: "NOT_APPLICABLE", seconds: null })
  })

  it("never converts a distance work block into a target duration", () => {
    const sequence = projectPacePrescriptionSequence(approvedTemplates[3])
    const main = sequence?.main[0]
    if (main === undefined || main.kind !== "group") throw new Error("Expected main set")

    expect(main.children[0]?.kind === "segment" && main.children[0].work).toEqual({
      kind: "distance",
      distanceM: 1000,
      durationSeconds: null,
    })
  })
})
