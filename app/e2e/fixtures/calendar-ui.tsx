import React, { useState } from "react"
import { createRoot } from "react-dom/client"
import { JournalMonthCalendar } from "../../src/screens/JournalMonthCalendar"
import { MonthCalendar } from "../../src/components/MonthCalendar"
import { CalendarTrainingMark } from "../../src/components/CalendarTrainingMark"
import { PlanSchedulePreview } from "../../src/screens/plan-beta/PlanSchedulePreview"
import type { PlanSession } from "@impl/plan-generator/types"
import "../../src/styles/plan-beta.css"
import { projectJournalArchive } from "../../src/domain/journal-archive"
import type { JournalEntry } from "../../src/domain/journal-schema"
import "../../../colors_and_type.css"
import "../../../colors_and_type_journal.css"
import "../../src/styles/app.css"
import "../../src/styles/journal-calendar.css"
import "../../src/styles/category-cards.css"
import "../../src/styles/date-controls.css"

const entries: JournalEntry[] = [{ id: "synthetic", kind: "post-session", date: "2026-08-30", savedAt: "2026-08-30T12:00:00Z", syncState: "local", system: "base", title: "합성 훈련", distanceKm: "3", durationMin: "20", avgPace: "", rpe: 3, memo: "PRIVATE_FIXTURE_MEMO" }]
function Fixture() {
  const [month, setMonth] = useState("2026-08")
  const [date, setDate] = useState("2026-08-30")
  const [mode, setMode] = useState("journal")
  const summary = projectJournalArchive(entries).months.find(item => item.month === month) ?? { month, entryCount: 0, kindCounts: { postSession: 0, evening: 0, race: 0 }, metrics: { distanceKm: null, durationMin: null, moodAverage: null, painMax: null }, excludedRecordCount: 0, weeks: [] }
  return <main style={{ maxWidth: 520, margin: "0 auto", padding: 12, boxSizing: "border-box" }}>
    <button onClick={() => setMode(mode === "journal" ? "training" : "journal")}>화면 전환</button>
    <button onClick={() => setMode("prescription")}>처방 달력 확인</button>
    <h1>{mode === "journal" ? "일지" : "훈련"}</h1>
    {mode === "prescription" ? <PlanSchedulePreview startDate="2026-08-24" sessions={planSessions} presentation="prescription-calendar" detailsExpanded={false} /> : mode === "journal" ? <JournalMonthCalendar month={summary} entries={entries} onOpenDay={() => undefined} onMonthChange={setMonth} selectedDate={date} onSelectedDateChange={setDate} />
      : <MonthCalendar month={month} today="2026-08-29" selectedDate={date} onMonthChange={setMonth} onSelectDate={setDate} trainingColors
        dayDescription={value => value === "2026-08-30" ? "오전 주요 훈련 · 오후 회복 운동" : ""}
        renderDay={value => value === "2026-08-30" ? <><CalendarTrainingMark tone="main" slot="오전" label="주요" /><CalendarTrainingMark tone="recovery" slot="오후" label="회복" /></> : null} />}
    <label>시작 날짜<input type="date" defaultValue="2026-08-30" min="2026-08-01" max="2026-12-31" /></label>
  </main>
}
const planSessions: readonly PlanSession[] = [
  { day: 1, slot: "AM", role: "QUALITY", plannedEnergyIntent: "ATP_PC_INTENT", prescription: { kind: "RPE_TIME_RANGE", rpe: { minimum: 7, maximum: 8 }, durationMinutes: { minimum: 20, maximum: 30 } } },
  { day: 1, slot: "PM", role: "EASY", plannedEnergyIntent: "RECOVERY_INTENT", prescription: { kind: "RPE_TIME_RANGE", rpe: { minimum: 1, maximum: 2 }, durationMinutes: { minimum: 20, maximum: 20 } } },
  { day: 2, slot: "PM", role: "REST", plannedEnergyIntent: "RECOVERY_INTENT", prescription: { kind: "REST" } },
  { day: 3, slot: "AM", role: "EASY", plannedEnergyIntent: "BASE_INTENT", prescription: { kind: "RPE_TIME_RANGE", rpe: { minimum: 3, maximum: 4 }, durationMinutes: { minimum: 30, maximum: 30 } } },
]
createRoot(document.getElementById("root")!).render(<Fixture />)
