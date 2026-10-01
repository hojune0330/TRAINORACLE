import { describe, expect, it } from "vitest"
import { READING_EVENTS, parseReadingTime, readPersonalRecord, readTogetherRecords, readingTime, validReadingDate, type ReadingRecord } from "./record-reading-oracle"

const own: ReadingRecord = { eventId: "5000", seconds: 1230, achievedOn: null }
const friend: ReadingRecord = { eventId: "5000", seconds: 1300, achievedOn: "2025-03-04" }

describe("record reading Oracle", () => {
  it.each([["20:30", 1230], ["2:02.5", 122.5], ["1:45:30", 6330], [" 0:59.99 ", 59.99], ["120:00", 7200]])("parses explicit clock input %s", (value, seconds) => {
    expect(parseReadingTime(value as string)).toBe(seconds)
  })
  it.each(["", "20", "2:2", "0:00", "-2:00", "1:60", "1:60:00", "1e3:00", "Infinity", "20분", "3:00.123", "<script>1:00</script>"])("rejects ambiguous or malformed input %s", value => {
    expect(parseReadingTime(value)).toBeNull()
  })
  it("carries rounding across minute and hour boundaries", () => {
    expect(readingTime(59.999)).toBe("1분 0초")
    expect(readingTime(3599.999)).toBe("1시간 0분 0초")
    expect(readingTime(34.25)).toBe("34.25초")
    expect(readingTime(Number.NaN)).toBe("확인 필요")
  })
  it("keeps decimal precision in the arithmetic and labels unentered dates", () => {
    const result = readPersonalRecord({ eventId: "800", seconds: 122.5, achievedOn: null })!
    expect(result.paceSeconds).toBe(153.125)
    expect(result.lapSeconds).toBe(61.25)
    expect(result.dateLabel).toBe("달성일 미입력")
    expect(result.laps).toBe(2)
  })
  it("uses the exact half marathon distance without truncating half a meter", () => {
    const result = readPersonalRecord({ eventId: "half", seconds: 6330, achievedOn: null })!
    expect(result.event.meters).toBe(21097.5)
    expect(result.distanceKm).toBe(21.0975)
    expect(result.paceSeconds).toBe(6330 * 1000 / 21097.5)
  })
  it("requires comparison consent at the calculation boundary", () => {
    expect(readTogetherRecords(own, friend, false)).toBeNull()
    expect(readTogetherRecords(own, friend, true)?.gapSeconds).toBe(70)
    expect(readTogetherRecords(own, friend, true)?.paceGapSeconds).toBe(14)
  })
  it("does not convert or compare different events", () => {
    const result = readTogetherRecords(own, { ...friend, eventId: "10000" }, true)!
    expect(result.sameEvent).toBe(false)
    expect(result.gapSeconds).toBeNull()
    expect(result.paceGapSeconds).toBeNull()
    expect(result.story).toContain("환산하지 않았어요")
    expect(result.ways).toHaveLength(3)
  })
  it("keeps equality as record equality, not readiness or compatibility", () => {
    const result = readTogetherRecords(own, { ...own }, true)!
    expect(result.gapSeconds).toBe(0)
    expect(result.story).toContain("오늘의 몸 상태까지 같은 것은 아니에요")
    expect(result).not.toHaveProperty("score")
    expect(result).not.toHaveProperty("prescription")
  })
  it("recalculates from changed values and never copies extra private input", () => {
    const polluted = { ...own, memo: "PRIVATE_SENTINEL", email: "PRIVATE_ADDRESS" }
    expect(JSON.stringify(readPersonalRecord(polluted))).not.toMatch(/PRIVATE_SENTINEL|PRIVATE_ADDRESS/u)
    expect(readPersonalRecord({ ...own, seconds: 1500 })?.paceSeconds).toBe(300)
    expect(readPersonalRecord(own)).toEqual(readPersonalRecord(own))
  })
  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])("rejects invalid seconds %s", seconds => {
    expect(readPersonalRecord({ ...own, seconds })).toBeNull()
    expect(readTogetherRecords(own, { ...friend, seconds }, true)).toBeNull()
  })
  it("validates real calendar dates and keeps historical records available", () => {
    expect(validReadingDate("", "2026-10-01")).toBe(true)
    expect(validReadingDate("2015-01-01", "2026-10-01")).toBe(true)
    expect(validReadingDate("2024-02-29", "2026-10-01")).toBe(true)
    expect(validReadingDate("2025-02-29", "2026-10-01")).toBe(false)
    expect(validReadingDate("2026-10-02", "2026-10-01")).toBe(false)
  })
  it("keeps arithmetic deterministic across 140 generated inputs", () => {
    for (const event of READING_EVENTS) for (let i = 1; i <= 20; i++) {
      const record = { eventId: event.id, seconds: 120 + i * 67.13, achievedOn: null }
      const result = readPersonalRecord(record)!
      expect(result.paceSeconds * event.meters / 1000).toBeCloseTo(record.seconds, 8)
      expect(result.lapSeconds * event.meters / 400).toBeCloseTo(record.seconds, 8)
      expect(readPersonalRecord(record)).toEqual(result)
    }
  })
})
