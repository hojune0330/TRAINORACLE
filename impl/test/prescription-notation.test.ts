import { describe, expect, it } from "vitest"
import {
  formatPrescriptionNotation,
  parsePrescriptionNotation,
} from "../src/prescription/notation"
import { derivePrescriptionTotals } from "../src/prescription/totals"

const ownerNotation = "2×(10×400m) @5000m RP · r60″ STAND · R3′ STAND"

function parsedOwnerNotation() {
  const result = parsePrescriptionNotation(ownerNotation)
  if (result.kind !== "parsed") {
    throw new Error(`Expected parsed notation, received ${result.code}`)
  }
  return result.notation
}

describe("prescription notation", () => {
  it.each([
    "5×1000m @5000m RP · r150″",
    "2×(10×400m) @5000m RP · r60″ STAND · R3′",
  ])("rejects timed recovery without an explicit mode: %s", (notation) => {
    expect(notation).toMatch(/[rR]\d/u)
    expect(parsePrescriptionNotation(notation)).toEqual({
      kind: "rejected",
      code: "MALFORMED_NOTATION",
    })
  })

  it("parses the owner fixture into its exact structured work and recovery fields", () => {
    // Given
    const notation = ownerNotation

    // When
    const result = parsePrescriptionNotation(notation)

    // Then
    expect(result).toEqual({
      kind: "parsed",
      notation: {
        kind: "UNBOUND_PRESCRIPTION_NOTATION",
        setCount: 2,
        repetitionsPerSet: 10,
        repetitionDistanceM: 400,
        repetitionDurationSeconds: null,
        paceTargetKind: "RACE_PACE",
        paceTargetEventDistanceM: 5000,
        repetitionRecoverySeconds: 60,
        repetitionRecoveryMode: "STAND",
        setRecoverySeconds: 180,
        setRecoveryMode: "STAND",
      },
    })
  })

  it("formats parsed notation canonically without changing its meaning", () => {
    // Given
    const notation = parsedOwnerNotation()

    // When
    const formatted = formatPrescriptionNotation(notation)
    const reparsed = parsePrescriptionNotation(formatted)

    // Then
    expect(reparsed).toEqual({ kind: "parsed", notation })
  })

  it.each(["WALK", "JOG", "STAND"] as const)(
    "preserves the explicitly written repetition recovery mode %s",
    (mode) => {
      const result = parsePrescriptionNotation(`5×1000m @5000m RP · r150″ ${mode}`)
      expect(result).toMatchObject({
        kind: "parsed",
        notation: { repetitionRecoveryMode: mode },
      })
    },
  )

  it("rejects an unknown recovery mode", () => {
    const notation = "5×1000m @5000m RP · r150″ FLOAT"
    expect(notation).toContain("FLOAT")
    expect(parsePrescriptionNotation(notation)).toEqual({
      kind: "rejected",
      code: "MALFORMED_NOTATION",
    })
  })

  it("counts repetitions, work distance, and both recovery layers without double counting", () => {
    // Given
    const notation = parsedOwnerNotation()

    // When
    const totals = derivePrescriptionTotals(notation)

    // Then
    expect(totals).toEqual({
      totalRepetitions: 20,
      qualityDistanceM: 8000,
      qualityDurationSeconds: null,
      repetitionRecoveryOccurrences: 18,
      repetitionRecoveryTotalSeconds: 1080,
      setRecoveryOccurrences: 1,
      setRecoveryTotalSeconds: 180,
      plannedRecoverySeconds: 1260,
      mainSessionTotalExcludingWarmupCooldown: null,
      uncomputableReasonCodes: ["WORK_DURATION_UNAVAILABLE"],
    })
  })

  it.each([
    "0×(10×400m) @5000m RP · r60″ · R3′",
    "2×(10×0m) @5000m RP · r60″ · R3′",
    "2×(10×400m) @5000m RP · r60 · R3′",
    "2×(10×400m) @5000m RP · R60″ · r3′",
    "2×(10×400m @5000m RP · r60″ · R3′",
    "2×(10×400m) @5000m RP · r60″",
  ])("rejects malformed or structurally inconsistent notation: %s", (notation) => {
    // Given
    const input = notation

    // When
    const result = parsePrescriptionNotation(input)

    // Then
    expect(result.kind).toBe("rejected")
  })
  // 입력 관용 — 사람이 실제로 칠 수 있는 글자를 받는다.
  // `×`(U+00D7)는 일반 키보드에 없고, 모바일 자동 교정은 `"`/`'`를 둥근 따옴표로 바꾼다.
  // 이걸 거부하면 표기를 정확히 옮겨 적은 사용자가 자기 입력이 틀렸다고 생각한다.
  it.each([
    ["곱셈 x", "2x(10x400m) @5000m RP · r60\u2033 STAND · R3\u2032 STAND"],
    ["곱셈 X", "2X(10X400m) @5000m RP · r60\u2033 STAND · R3\u2032 STAND"],
    ["곱셈 *", "2*(10*400m) @5000m RP · r60\u2033 STAND · R3\u2032 STAND"],
    ["ASCII 따옴표", "2\u00d7(10\u00d7400m) @5000m RP · r60\" STAND · R3' STAND"],
    ["자동 교정 둥근 따옴표", "2\u00d7(10\u00d7400m) @5000m RP · r60\u201d STAND · R3\u2019 STAND"],
  ])("accepts a keyboard-typable alias and yields the owner fixture exactly: %s", (_label, input) => {
    // Given
    const expected = parsedOwnerNotation()

    // When
    const result = parsePrescriptionNotation(input)

    // Then — 관용은 글자에만 적용되고 숫자는 절대 달라지지 않는다.
    if (result.kind !== "parsed") {
      throw new Error(`Expected parsed notation, received ${result.code}`)
    }
    expect(result.notation).toStrictEqual(expected)
  })

  it("does not let alias normalization invent a structure that was never typed", () => {
    // Given — 곱셈 기호만 있고 반복/거리 숫자가 없는 입력
    const input = "x(x400m) @5000m RP · r60\u2033 STAND · R3\u2032 STAND"

    // When
    const result = parsePrescriptionNotation(input)

    // Then — 별칭 치환이 빈 자리를 메워서 통과시키면 안 된다.
    expect(result.kind).toBe("rejected")
  })
})
