import { describe, expect, it } from "vitest"
import type { PostSessionEntry } from "../journal-schema"
import { mergeEntries } from "./sync"

function entry(userIndex: number, recordIndex: number): PostSessionEntry {
  const day = String((recordIndex % 28) + 1).padStart(2, "0")
  return {
    id: `user-${userIndex}-record-${recordIndex}`,
    kind: "post-session",
    date: `2026-07-${day}`,
    savedAt: `2026-07-${day}T10:00:00.000Z`,
    syncState: "local",
    system: "base",
    title: "부하 모의 기록",
    distanceKm: "5",
    durationMin: "30",
    avgPace: "6:00",
    rpe: 5,
    memo: "",
  }
}

describe("200-user beta client workload", () => {
  it("merges 1,000 daily records without loss", () => {
    const records = Array.from({ length: 200 }, (_, userIndex) => (
      Array.from({ length: 5 }, (__, recordIndex) => entry(userIndex, recordIndex))
    )).flat()

    const merged = mergeEntries(records.slice(0, 500), records.slice(500), new Set())

    expect(merged).toHaveLength(1_000)
    expect(new Set(merged.map((item) => item.id))).toHaveLength(1_000)
  })

  it("completes 50 simultaneous client merge requests with stable results", async () => {
    const records = Array.from({ length: 20 }, (_, index) => entry(index, index))
    const results = await Promise.all(Array.from({ length: 50 }, () => (
      Promise.resolve().then(() => mergeEntries(records, records, new Set()))
    )))

    expect(results).toHaveLength(50)
    expect(results.every((result) => result.length === 20)).toBe(true)
  })
})
