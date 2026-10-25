import { describe, expect, it } from "vitest"
import { analysisPresentation } from "./analysis-presentation"

describe("analysis presentation is independent from a record-count unlock", () => {
  it.each([
    [false, false, false, "unavailable"],
    [false, true, false, "unavailable"],
    [false, true, true, "unavailable"],
    [true, false, false, "empty"],
    [true, true, false, "records-only"],
    [true, true, true, "facts"],
    [true, false, true, "facts"],
  ] as const)("read=%s records=%s facts=%s => %s", (readComplete, hasRecords, hasFacts, expected) => {
    expect(analysisPresentation({ readComplete, hasRecords, hasFacts })).toBe(expected)
  })
})
