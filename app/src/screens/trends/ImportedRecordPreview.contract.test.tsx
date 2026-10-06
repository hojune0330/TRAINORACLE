import { cleanup, render, screen, fireEvent } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import { ImportedRecordPreview } from "./ImportedRecordPreview"
import { buildFileObservation, type FileObservationInput } from "../../domain/import/file-observation"
import type { PostSessionEntry } from "../../domain/journal-schema"

afterEach(cleanup)

function entry(overrides: Partial<FileObservationInput> = {}): PostSessionEntry {
  const date = "2026-10-06"
  const facts: FileObservationInput = { format: "tcx", sourceProfile: "TCX_ACTIVITY_V1", parserVersion: "v1",
    sourceActivityId: "sample", date, startedAt: null, timeZone: null, sport: "RUNNING", distanceMeters: 5000,
    durationSeconds: 1800, durationMeaning: "TIMER", confirmation: { sport: null, durationMeaning: null }, laps: [], ...overrides }
  facts.laps = [{ sourceIndex: 0, distanceMeters: facts.distanceMeters, durationSeconds: facts.durationSeconds,
    durationMeaning: facts.durationMeaning, kind: "UNKNOWN" }]
  return { id: "imported-1", kind: "post-session", date, savedAt: `${date}T10:00:00Z`, syncState: "local",
    title: "운동", system: "base", distanceKm: "", durationMin: "", avgPace: "", rpe: 0, memo: "",
    fileObservation: buildFileObservation(facts) }
}

it("shows imported facts before analysis and opens the original entry without inferring a pace or effort", () => {
  const open = vi.fn()
  render(<ImportedRecordPreview entries={[entry()]} today="2026-10-07" onOpenDay={open} />)
  expect(screen.getByText("5km")).toBeVisible()
  expect(screen.getByText("30:00")).toBeVisible()
  expect(screen.getByText("타이머 시간")).toBeVisible()
  expect(screen.queryByText(/6:00\/km|RPE|힘든 정도/)).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole("button", { name: "가져온 일지 보기" }))
  expect(open).toHaveBeenCalledWith("2026-10-06", "imported-1")
})

it("does not turn missing distance and unknown time meaning into zero or moving time", () => {
  render(<ImportedRecordPreview entries={[entry({ distanceMeters: null, durationMeaning: "UNKNOWN" })]} today="2026-10-07" />)
  expect(screen.getByText("파일에 없음")).toBeVisible()
  expect(screen.getByText("파일의 시간 · 종류 미확인")).toBeVisible()
  expect(screen.queryByText("0km")).not.toBeInTheDocument()
  expect(screen.queryByText("이동 시간")).not.toBeInTheDocument()
})
