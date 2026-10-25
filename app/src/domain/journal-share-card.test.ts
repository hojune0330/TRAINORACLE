import { describe, expect, it } from "vitest"
import { DEFAULT_JOURNAL_SHARE_STYLE, journalShareCard, journalShareText } from "./journal-share-card"
import type { PostSessionEntry } from "./journal-schema"

const entry: PostSessionEntry = { id: "private-id", kind: "post-session", date: "2026-10-26", savedAt: "2026-10-26T09:00:00Z", syncState: "local", title: "PRIVATE_TITLE", system: "base", distanceKm: "4.6", durationMin: "30", avgPace: "6:31", rpe: 8, memo: "PRIVATE_MEMO", memoPurpose: "PRIVATE_SELF_ONLY", painParts: { knee: 3 } }

describe("journal share projection", () => {
  it("copies only visible numeric facts, without private text, health or identifiers", () => {
    const card = journalShareCard(entry)!
    expect(card).toEqual({ example: false, date: "2026-10-26", title: "나의 운동 기록", source: "저장된 운동 기록", metrics: [{ label: "거리", value: "4.6 km" }, { label: "시간", value: "30분" }, { label: "평균 페이스", value: "6:31 /km" }] })
    const text = journalShareText(card, DEFAULT_JOURNAL_SHARE_STYLE)
    expect(text).not.toMatch(/PRIVATE|private-id|2026|8|knee/u)
    expect(journalShareCard({ ...entry, memo: "OTHER_SECRET", title: "OTHER_TITLE", rpe: 1, painParts: {} })).toEqual(card)
    expect(journalShareText(card, { ...DEFAULT_JOURNAL_SHARE_STYLE, showDate: true })).toContain("2026-10-26")
  })
  it("does not turn missing or arbitrary text fields into numbers or leak them", () => {
    expect(journalShareCard({ ...entry, distanceKm: "", durationMin: " ", avgPace: "" })).toBeNull()
    expect(journalShareCard({ ...entry, distanceKm: "4 km PRIVATE", durationMin: "NaN", avgPace: "6:90" })).toBeNull()
    expect(journalShareCard({ ...entry, date: "2026-02-30" })).toBeNull()
    expect(journalShareCard({ ...entry, distanceKm: "0", durationMin: "0", avgPace: "" })?.metrics[0]?.value).toBe("0 km")
  })
  it("retains the example label in export and does not derive pace from two values", () => {
    const card = journalShareCard({ ...entry, avgPace: "" })!
    expect(card.metrics).toHaveLength(2)
    expect(journalShareText({ ...card, example: true }, DEFAULT_JOURNAL_SHARE_STYLE)).toContain("예시 · 가상 기록")
  })
})
