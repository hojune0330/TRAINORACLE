import { cleanup, render, screen, fireEvent } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { RecoveryRecordPanel } from "./RecoveryRecordPanel"
import { projectStructuredJournalObservations } from "../../domain/journal-observation"
import type { JournalEntry } from "../../domain/journal-schema"

beforeEach(() => localStorage.clear())
afterEach(cleanup)

it("keeps the experiment accessible but not in the first view and opens existing recovery recording", () => {
  const write = vi.fn()
  render(<RecoveryRecordPanel today="2026-10-07" entries={[]} observations={[]} experimentalFatigue onWriteRecovery={write} />)
  expect(screen.getByLabelText("신경계 피로")).not.toBeVisible()
  expect(screen.queryByText(/최근 운동 · 힘든 정도/)).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole("button", { name: "수면·통증·기분 남기기" }))
  expect(write).toHaveBeenCalledOnce()
  fireEvent.click(screen.getByRole("button", { name: /피로도 항목별 기록 · 실험/ }))
  expect(screen.getByLabelText("신경계 피로")).toBeVisible()
  expect(screen.getByLabelText("신경계 피로")).toHaveValue("")
  fireEvent.click(screen.getByRole("button", { name: /오늘 몸 상태 남기기/ }))
  expect(screen.getByRole("button", { name: "몸 상태 가벼움" })).toBeVisible()
})

it("shows individual reported exercise exertion with AM/PM, not body state or an inferred average", () => {
  const entry: JournalEntry = { id: "pm", kind: "post-session", date: "2026-10-07", savedAt: "2026-10-07T15:00:00Z",
    syncState: "local", activitySlot: "PM", title: "운동", system: "base", distanceKm: "", durationMin: "", avgPace: "", rpe: 7, memo: "",
    fieldProvenance: { rpe: { provenance: "EXPLICIT" } } }
  const open = vi.fn()
  render(<RecoveryRecordPanel today="2026-10-07" entries={[entry]} observations={projectStructuredJournalObservations([entry])} experimentalFatigue={false} onOpenDay={open} />)
  expect(screen.getByText("최근 운동 · 힘든 정도 7/10")).toBeVisible()
  expect(screen.getByText(/오후/)).toBeVisible()
  fireEvent.click(screen.getByRole("button", { name: "이 기록 보기" }))
  expect(open).toHaveBeenCalledWith("2026-10-07", "pm")
  expect(screen.queryByText(/회복 완료|위험 점수/)).not.toBeInTheDocument()
})
