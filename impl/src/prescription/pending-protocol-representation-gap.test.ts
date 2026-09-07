import { describe, expect, it } from "vitest"
import { deriveSequenceTotals, deriveSequenceRecoveryDistanceTotals, parsePrescriptionSequence } from "./sequence"
import type { PrescriptionSequence, PrescriptionSequenceNode } from "./sequence"

const none = { mode: "NOT_APPLICABLE" as const, seconds: null }
const segment = (id: string, meters: number): PrescriptionSequenceNode => ({
  kind: "segment", id, label: null, repeatCount: 1,
  work: { kind: "distance", distanceM: meters, durationSeconds: null },
  target: { kind: "EFFORT_GUIDANCE", cue: "REVIEW_FIXTURE_NOT_ACTIVATED" },
  recoveryBetweenRepeats: none, recoveryAfter: none,
})
const sequence = (main: readonly PrescriptionSequenceNode[]): PrescriptionSequence => ({
  kind: "PRESCRIPTION_SEQUENCE", version: 2, id: "pending-gap-fixture", label: null,
  warmup: [], main, cooldown: [], terminalRecovery: none,
})

// These tests document existing representation limits, not acceptance of a lossy compiler.
// A versioned successor must preserve legacy results while adding the missing semantics.
describe("pending proposal to engine representation audit", () => {
  it("rejects a single recovery claiming both 100m and 120 seconds", () => {
    const raw = {
      ...sequence([segment("work", 300)]),
      terminalRecovery: { mode: "ACTIVE_ROLL_ON", distanceM: 100, seconds: 120 },
    }
    expect(parsePrescriptionSequence(raw)).toMatchObject({ kind: "rejected" })
  })

  it("a child's final recoveryAfter cannot encode roll-on before its parent set recovery", () => {
    const work = { ...segment("rep", 300), repeatCount: 2,
      recoveryBetweenRepeats: { mode: "ACTIVE_ROLL_ON" as const, seconds: null, distanceM: 100 },
      recoveryAfter: { mode: "ACTIVE_ROLL_ON" as const, seconds: null, distanceM: 100 } }
    const s: PrescriptionSequence = { ...sequence([{
      kind: "group", id: "sets", label: null, repeatCount: 3, children: [work],
      recoveryBetweenRepeats: { mode: "JOG", seconds: 120 }, recoveryAfter: none,
    }]), terminalRecovery: { mode: "ACTIVE_ROLL_ON", seconds: null, distanceM: 100 } }
    expect(parsePrescriptionSequence(s).kind).toBe("parsed")
    const recovery = deriveSequenceRecoveryDistanceTotals(s)
    expect(recovery.repetitionRecoveryTotalDistanceM).toBe(300)
    expect(recovery.terminalRecoveryDistanceM).toBe(100)
    expect(recovery.transitionRecoveryTotalDistanceM).toBe(0)
    expect(deriveSequenceTotals(s).setRecoveryTotalSeconds).toBe(240)
    // Required 600m roll-on cannot be reconstructed from this accepted but wrong mapping.
    expect(recovery.repetitionRecoveryTotalDistanceM! + recovery.terminalRecoveryDistanceM!).not.toBe(600)
  })

  it("labels do not separate buildup from fast work or preserve four sprint repetitions", () => {
    const s = sequence([{
      kind: "group", id: "flying", label: null, repeatCount: 4,
      recoveryBetweenRepeats: { mode: "STAND", seconds: 240 }, recoveryAfter: none,
      children: [{ ...segment("buildup", 20), label: "도움닫기" }, segment("fast", 10)],
    }])
    expect(parsePrescriptionSequence(s).kind).toBe("parsed")
    const totals = deriveSequenceTotals(s)
    expect(totals.qualityDistanceM).toBe(120)
    expect(totals.totalRepetitions).toBe(8)
    expect(totals.qualityDistanceM).not.toBe(40)
    expect(totals.totalRepetitions).not.toBe(4)
  })

  it("walking-or-standing cannot silently become only standing in the old enum", () => {
    const raw = sequence([{ ...segment("acceleration", 20), repeatCount: 6 }])
    expect(parsePrescriptionSequence({ ...raw, main: [{ ...raw.main[0],
      recoveryBetweenRepeats: { mode: "WALK_OR_STAND", seconds: 120 },
    }] })).toMatchObject({ kind: "rejected" })
  })
})
