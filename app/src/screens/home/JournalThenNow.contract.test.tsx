import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { saveEntry, todayISO, type PostSessionEntry } from "../../domain/journal-store"
import { JournalThenNow } from "./JournalThenNow"

function entry(id: string, date: string, title: string): PostSessionEntry {
  return {
    id,
    kind: "post-session",
    date,
    savedAt: `${date}T09:00:00.000Z`,
    syncState: "local",
    captureDepth: "QUICK",
    activityOutcome: "COMPLETED",
    activitySlot: "SINGLE",
    rpeBand: "RPE_5_6",
    objectiveDataState: "WAITING",
    system: "",
    title,
    distanceKm: "",
    durationMin: "",
    avgPace: "",
    rpe: 0,
    memo: "비공개 원문",
    memoPurpose: "PRIVATE_SELF_ONLY",
    fieldProvenance: {
      activityOutcome: { provenance: "EXPLICIT" },
      rpeBand: { provenance: "EXPLICIT" },
      rpe: { provenance: "MISSING" },
    },
  }
}

describe("journal then-now comparison", () => {
  beforeEach(() => window.localStorage.clear())
  afterEach(cleanup)

  it("shows only structured facts and moves between today and the prior record", () => {
    const today = todayISO()
    const previous = "2026-08-31"
    expect(saveEntry({ ...entry("previous", previous, "지난 운동"), memo: "", memoPurpose: undefined }).ok).toBe(true)
    expect(saveEntry({ ...entry("today", today, "오늘 운동"), memo: "", memoPurpose: undefined }).ok).toBe(true)
    const onOpenDay = vi.fn()
    render(<JournalThenNow onOpenDay={onOpenDay} />)

    expect(screen.getByRole("button", { name: /오늘 운동/ })).toHaveTextContent("RPE 5~6")
    expect(screen.queryByText("비공개 원문")).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "지난 기록 보기" }))
    expect(screen.getByRole("button", { name: /지난 운동/ })).toBeVisible()
    fireEvent.click(screen.getByRole("button", { name: /지난 운동/ }))
    expect(onOpenDay).toHaveBeenCalledWith(previous)
  })
})
