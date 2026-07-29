/// <reference types="vite/client" />

import catalog from "../../specs/reconstruct/ENERGY_SYSTEM_SESSION_TEMPLATE_CATALOG.md?raw"
import { describe, expect, it } from "vitest"
import { parsePrescriptionNotation } from "../src/prescription/notation"

function entryFor(templateId: string): string {
  const entry = catalog.match(new RegExp(`^- templateId: ${templateId}\\r?\\n[\\s\\S]*?(?=^- templateId: |^\\[DRAFT_COMPLETE\\]$)`, "mu"))?.[0]
  if (entry === undefined) {
    throw new Error(`Missing catalog entry: ${templateId}`)
  }
  return entry
}

describe("catalog machine notation", () => {
  it("preserves V2-SEED-05 work and recovery semantics when its parser-ready notation is parsed", () => {
    // Given
    const entry = entryFor("V2-SEED-05")
    const notation = entry.match(/^  machineNotation: "([^"]+)"$/mu)?.[1]
    if (notation === undefined) {
      throw new Error("V2-SEED-05 must provide parser-ready machineNotation")
    }

    // When
    const parsed = parsePrescriptionNotation(notation)

    // Then
    expect(parsed).toEqual({
      kind: "parsed",
      notation: {
        kind: "UNBOUND_PRESCRIPTION_NOTATION",
        setCount: 1,
        repetitionsPerSet: 5,
        repetitionDistanceM: 1000,
        repetitionDurationSeconds: null,
        paceTargetKind: "RACE_PACE",
        paceTargetEventDistanceM: 5000,
        repetitionRecoverySeconds: 150,
        repetitionRecoveryMode: "STAND",
        setRecoverySeconds: null,
        setRecoveryMode: "NOT_APPLICABLE",
      },
    })
  })
})
