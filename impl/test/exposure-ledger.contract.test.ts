import { describe, expect, it } from "vitest"
import { compileExposureLedger } from "../src/plan-generator/exposure-ledger"
import type { LocalCivilNinePointFiveFormation } from "../src/plan-generator/types"

function canonicalFormation(
  exposures: LocalCivilNinePointFiveFormation["exposures"],
): LocalCivilNinePointFiveFormation {
  const localDays = Array.from({ length: 10 }, (_, offset) => `2026-08-${String(offset + 1).padStart(2, "0")}`)
  const slots = localDays.flatMap((localDayKey, dayOffset) => (
    dayOffset === 9
      ? [{ slotIndex: 18, localDayKey, slot: "AM" as const }]
      : [
          { slotIndex: dayOffset * 2, localDayKey, slot: "AM" as const },
          { slotIndex: dayOffset * 2 + 1, localDayKey, slot: "PM" as const },
        ]
  ))

  return { kind: "LOCAL_CIVIL_9_5", slots, exposures }
}

describe("typed MAIN exposure ledger", () => {
  it("counts a composite parent once while retaining every component", () => {
    const formation = canonicalFormation([
      {
        exposureId: "composite-main",
        classification: "TRAINING_MAIN",
        localDayKey: "2026-08-03",
        component: { kind: "PARENT" },
      },
      {
        exposureId: "warmup-part",
        classification: "NONE",
        localDayKey: "2026-08-03",
        component: { kind: "LEAF", parentExposureId: "composite-main" },
      },
      {
        exposureId: "plyo-part",
        classification: "TRAINING_MAIN",
        localDayKey: "2026-08-03",
        component: { kind: "LEAF", parentExposureId: "composite-main" },
      },
      {
        exposureId: "second-main",
        classification: "TRAINING_MAIN",
        localDayKey: "2026-08-07",
        component: { kind: "STANDALONE" },
      },
    ])

    const compiled = compileExposureLedger(formation)

    expect(compiled).toMatchObject({
      kind: "valid",
      mainExposureCount: 2,
      countedExposureIds: ["composite-main", "second-main"],
    })
    if (compiled.kind === "valid") {
      expect(compiled.entries).toHaveLength(4)
    }
  })

  it("counts every competition day once but returns review for a planned MAIN collision", () => {
    const formation = canonicalFormation([
      {
        exposureId: "heat",
        classification: "COMPETITION",
        localDayKey: "2026-08-05",
        component: { kind: "STANDALONE" },
      },
      {
        exposureId: "final",
        classification: "COMPETITION",
        localDayKey: "2026-08-05",
        component: { kind: "STANDALONE" },
      },
      {
        exposureId: "planned-main",
        classification: "TRAINING_MAIN",
        localDayKey: "2026-08-05",
        component: { kind: "STANDALONE" },
      },
    ])

    const compiled = compileExposureLedger(formation)
    expect(compiled.kind).toBe("needs_review")
    if (compiled.kind === "needs_review") {
      expect(compiled.reasonCodes).toEqual(expect.arrayContaining([
        "COMPETITION_DAY_COLLISION_REQUIRES_COACH_CLARIFICATION",
        "NEEDS_COACH_CLARIFICATION",
      ]))
    }
  })

  it("counts separate competition records on one local day as one MAIN exposure", () => {
    const formation = canonicalFormation([
      {
        exposureId: "heat",
        classification: "COMPETITION",
        localDayKey: "2026-08-05",
        component: { kind: "STANDALONE" },
      },
      {
        exposureId: "final",
        classification: "COMPETITION",
        localDayKey: "2026-08-05",
        component: { kind: "STANDALONE" },
      },
    ])

    expect(compileExposureLedger(formation)).toMatchObject({
      kind: "valid",
      mainExposureCount: 1,
      countedExposureIds: ["heat"],
      competitionDayKeys: ["2026-08-05"],
    })
  })

  it("fails closed for a dangling composite leaf", () => {
    const formation = canonicalFormation([
      {
        exposureId: "orphan",
        classification: "TRAINING_MAIN",
        localDayKey: "2026-08-03",
        component: { kind: "LEAF", parentExposureId: "missing-parent" },
      },
    ])

    expect(compileExposureLedger(formation)).toMatchObject({
      kind: "needs_review",
      reasonCodes: ["INVALID_COMPOSITE_RELATION_REQUIRES_REVIEW"],
    })
  })

  it("does not infer MAIN from omitted or generic QUALITY-like detail", () => {
    const formation = canonicalFormation([])

    expect(compileExposureLedger(formation)).toMatchObject({
      kind: "valid",
      mainExposureCount: 0,
      countedExposureIds: [],
    })
  })
})
