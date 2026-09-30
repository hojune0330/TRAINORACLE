import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { RecommendationCalendar } from "./instant-plan/RecommendationCalendar"
import { DatedPlanPanel } from "../screens/plan-beta/DatedPlanPanel"
import { PlanSchedulePreview } from "../screens/plan-beta/PlanSchedulePreview"
import { JournalMonthCalendar } from "../screens/JournalMonthCalendar"
import { projectJournalArchive } from "../domain/journal-archive"
import type { JournalEntry } from "../domain/journal-schema"
import type { PlanSession } from "@impl/plan-generator/types"

afterEach(() => cleanup())
const sessions: readonly PlanSession[] = [
  { day: 1, slot: "AM", role: "QUALITY", plannedEnergyIntent: "ATP_PC_INTENT",
    prescription: { kind: "RPE_TIME_RANGE", rpe: { minimum: 7, maximum: 8 }, durationMinutes: { minimum: 20, maximum: 30 } } },
  { day: 1, slot: "PM", role: "EASY", plannedEnergyIntent: "RECOVERY_INTENT",
    prescription: { kind: "RPE_TIME_RANGE", rpe: { minimum: 1, maximum: 2 }, durationMinutes: { minimum: 20, maximum: 20 } } },
]

function colors(container: HTMLElement, date = "2026-09-30") {
  return [...container.querySelectorAll(`button[data-date='${date}'] .calendar-training-mark`)].map(node => node.getAttribute("data-tone"))
}

describe("calendar colors are shared by every real plan and journal adapter", () => {
  it("preserves separate morning main and afternoon recovery in the full plan", () => {
    const before = JSON.stringify(sessions)
    const view = render(<PlanSchedulePreview startDate="2026-09-30" sessions={sessions} detailsExpanded={false} />)
    expect(colors(view.container)).toEqual(["main", "recovery"])
    const day = view.container.querySelector("button[data-date='2026-09-30']")!
    expect(day).toHaveAccessibleName(/오전 주요 훈련 ATP.*오후 회복 운동/)
    expect(day.textContent).toContain("오전주요")
    expect(day.textContent).toContain("오후회복")
    expect(JSON.stringify(sessions)).toBe(before)
  })

  it("does not mislabel adjusted-plan recovery as basic exercise", () => {
    const view = render(<DatedPlanPanel start="2026-09-30" sessions={sessions} day={1} onDayChange={vi.fn()}><p>상세</p></DatedPlanPanel>)
    expect(colors(view.container)).toEqual(["main", "recovery"])
  })

  it("maps quick-candidate REC to recovery and opens details with one click", () => {
    const view = render(<RecommendationCalendar days={[{ date: "2026-09-30", dayLabel: "첫날", sessions: [
      { id: "am", slotLabel: "오전", title: "주요 훈련", role: "MAIN" },
      { id: "pm", slotLabel: "오후", title: "회복 운동", role: "REC" },
    ] }]} />)
    expect(colors(view.container)).toEqual(["main", "recovery"])
    fireEvent.click(view.container.querySelector("button[data-date='2026-09-30']")!)
    expect(screen.getByRole("dialog")).toBeVisible()
    expect(screen.getByText("아직 선택 전인 계획 후보예요.")).toBeVisible()
  })

  it("shows race and mixed plyometric records but not a legacy BASE inference", () => {
    const entries: JournalEntry[] = [
      { id: "r", kind: "race", date: "2026-09-30", savedAt: "2026-09-30T12:00:00Z", syncState: "local", stage: "pre", record: "", rank: "", result: "", memo: "" },
      { id: "p", kind: "post-session", date: "2026-09-30", savedAt: "2026-09-30T12:00:00Z", syncState: "local", system: "base", title: "", distanceKm: "", durationMin: "", avgPace: "", rpe: 0, memo: "",
        activitySlot: "PM", exerciseLog: { version: 1, source: "SELF_REPORTED", components: [{ id: "jump", kind: "PLYOMETRIC", name: "", rows: [] }] } },
      { id: "l", kind: "post-session", date: "2026-09-30", savedAt: "2026-09-30T12:00:00Z", syncState: "local", system: "base", title: "", distanceKm: "", durationMin: "", avgPace: "", rpe: 0, memo: "" },
    ]
    const view = render(<JournalMonthCalendar month={projectJournalArchive(entries).months[0]!} entries={entries} onMonthChange={vi.fn()} onOpenDay={vi.fn()} />)
    expect(colors(view.container)).toEqual(["race", "neural", "unknown"])
    expect(view.container.querySelector("button[data-date='2026-09-29'] .calendar-training-mark")).toBeNull()
    expect(view.container.querySelector("button[data-date='2026-09-30']")).toHaveAccessibleName(/경기 전.*오후 플라이오.*훈련/)
  })

  it("renders one mixed actual entry once in both journal and plan calendars", () => {
    const entry: JournalEntry = { id: "mixed", kind: "post-session", date: "2026-09-30", savedAt: "2026-09-30T12:00:00Z",
      syncState: "local", system: "base", title: "", distanceKm: "", durationMin: "", avgPace: "", rpe: 0, memo: "",
      activitySlot: "PM", fieldProvenance: { system: { provenance: "EXPLICIT" } },
      exerciseLog: { version: 1, source: "SELF_REPORTED", components: [
        { id: "p", kind: "PLYOMETRIC", name: "", rows: [] }, { id: "r", kind: "RUNNING", name: "", rows: [] },
      ] } }
    const view = render(<JournalMonthCalendar month={projectJournalArchive([entry]).months[0]!} entries={[entry]} onMonthChange={vi.fn()} onOpenDay={vi.fn()} />)
    expect(colors(view.container)).toEqual(["base"])
    expect(view.container.querySelector('.calendar-training-mark')).toHaveTextContent("오후기본플라이오 포함")
    view.rerender(<PlanSchedulePreview startDate="2026-09-30" sessions={sessions} detailsExpanded={false} journalEntries={[entry]} />)
    expect(colors(view.container)).toEqual(["main", "recovery", "base"])
    const actual = view.container.querySelector('button[data-date="2026-09-30"] [data-tone="base"]')!
    expect(actual).toHaveTextContent("일지 · 오후기본플라이오 포함")
    expect(view.container.querySelector('button[data-date="2026-09-30"]')).toHaveAccessibleName(/일지 1개.*오후 기본 플라이오 포함/)
  })
})
