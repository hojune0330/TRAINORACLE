import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { isoShift } from "../../domain/dates"
import { saveEntry, todayISO, type PostSessionEntry } from "../../domain/journal-store"
import { JournalThenNow } from "./JournalThenNow"

function entry(id: string, date: string, title: string, slot: "AM" | "PM" = "PM"): PostSessionEntry {
  return {
    id,
    kind: "post-session",
    date,
    savedAt: `${date}T${slot === "AM" ? "07" : "18"}:00:00.000Z`,
    syncState: "local",
    captureDepth: "QUICK",
    activityOutcome: "COMPLETED",
    activitySlot: slot,
    objectiveDataState: "WAITING",
    planExecutionRelation: "NOT_APPLICABLE",
    painCheckStatus: "NO_SIGNAL_REPORTED",
    system: "base",
    title,
    distanceKm: "5",
    durationMin: "30",
    avgPace: "6:00",
    rpe: 6,
    memo: "",
    fieldProvenance: {
      activityOutcome: { provenance: "EXPLICIT" },
      activitySlot: { provenance: "EXPLICIT" },
      plannedSessionLink: { provenance: "MISSING" },
      planExecutionRelation: {
        provenance: "DERIVED",
        derivedFrom: ["activityOutcome", "plannedSessionLink"],
        derivationRuleId: "QUICK_PLAN_EXECUTION_RELATION_V2",
      },
      painCheckStatus: { provenance: "EXPLICIT" },
      painParts: { provenance: "MISSING" },
      distanceKm: { provenance: "EXPLICIT" },
      durationMin: { provenance: "EXPLICIT" },
      avgPace: { provenance: "EXPLICIT" },
      rpe: { provenance: "EXPLICIT" },
    },
  }
}

describe("journal then-now comparison", () => {
  beforeEach(() => window.localStorage.clear())
  afterEach(cleanup)

  it("shows both dated records together without exposing memo text", () => {
    const today = todayISO()
    const previous = isoShift(today, -2)
    expect(saveEntry(entry("previous", previous, "지난 운동")).ok).toBe(true)
    expect(saveEntry(entry("today", today, "오늘 운동")).ok).toBe(true)
    const onOpenDay = vi.fn()
    render(<JournalThenNow onOpenDay={onOpenDay} />)

    expect(screen.getByRole("button", { name: /지난 운동/ })).toBeVisible()
    expect(screen.getByRole("button", { name: /오늘 운동/ })).toHaveTextContent("RPE 6")
    expect(screen.queryByText("비공개 원문")).toBeNull()
    expect(screen.queryByRole("button", { name: "지난 기록 보기" })).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: /지난 운동/ }))
    expect(onOpenDay).toHaveBeenCalledWith(previous)
  })

  it("labels two same-day entries as morning and afternoon instead of calling one previous", () => {
    const today = todayISO()
    expect(saveEntry(entry("morning", today, "오전 조깅", "AM")).ok).toBe(true)
    expect(saveEntry(entry("afternoon", today, "오후 훈련", "PM")).ok).toBe(true)
    render(<JournalThenNow />)

    expect(screen.getByRole("heading", { name: "오늘 두 운동 비교" })).toBeVisible()
    expect(screen.getByRole("button", { name: /오늘 오전/ })).toBeVisible()
    expect(screen.getByRole("button", { name: /오늘 오후/ })).toBeVisible()
  })

  it("prefers the morning-afternoon pair even when an older comparable record exists", () => {
    const today = todayISO()
    expect(saveEntry(entry("older", isoShift(today, -3), "사흘 전 운동", "PM")).ok).toBe(true)
    expect(saveEntry(entry("morning", today, "오늘 오전 운동", "AM")).ok).toBe(true)
    expect(saveEntry(entry("afternoon", today, "오늘 오후 운동", "PM")).ok).toBe(true)

    render(<JournalThenNow />)

    expect(screen.getByRole("heading", { name: "오늘 두 운동 비교" })).toBeVisible()
    expect(screen.getByRole("button", { name: /오늘 오전 운동/ })).toBeVisible()
    expect(screen.getByRole("button", { name: /오늘 오후 운동/ })).toBeVisible()
    expect(screen.queryByText("사흘 전 운동")).toBeNull()
  })
})
