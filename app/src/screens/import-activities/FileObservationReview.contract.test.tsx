import React from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { FileObservationReview } from "./FileObservationReview"
import { buildFileObservation, parseFileObservation } from "../../domain/import/file-observation"
import type { ImportedActivity } from "../../domain/import/activity-file"

function activity(): ImportedActivity {
  return { date: "2026-09-19", name: "SYNTHETIC_NAME_NOT_ANALYSIS", sport: "Other", distanceKm: "1", durationMin: "5", avgPace: "", observation: buildFileObservation({
    format: "tcx", sourceProfile: "TCX_ACTIVITY_V1", parserVersion: "v1", sourceActivityId: null,
    date: "2026-09-19", startedAt: "2026-09-18T16:00:00Z", timeZone: "Asia/Seoul", sport: "UNKNOWN",
    distanceMeters: 1000, durationSeconds: 300, durationMeaning: "SOURCE_DEFINED", confirmation: null,
    laps: [{ sourceIndex: 0, distanceMeters: 1000, durationSeconds: 300, durationMeaning: "SOURCE_DEFINED", kind: "UNKNOWN" }],
  }) }
}
afterEach(cleanup)
describe("FileObservationReview independent UI contract", () => {
  it("preserves source facts while explicitly confirming meaning and sport", async () => {
    const user = userEvent.setup(), original = activity(), onChange = vi.fn()
    const view = render(<FileObservationReview activity={original} disabled={false} onChange={onChange} />)
    await user.click(screen.getByText("시간과 날짜 확인"))
    expect(screen.getByLabelText("파일의 시간은 어떤 시간인가요?")).toHaveValue("")
    await user.selectOptions(screen.getByLabelText("파일의 시간은 어떤 시간인가요?"), "TIMER")
    const next = onChange.mock.calls[0]![0] as ImportedActivity
    expect(next.observation).toMatchObject({ durationMeaning: "SOURCE_DEFINED", confirmation: { durationMeaning: "TIMER", sport: null }, contentRevisionFingerprint: original.observation!.contentRevisionFingerprint })
    expect(next.avgPace).toBe("5:00")
    expect(original.observation!.confirmation).toBeNull()
    view.rerender(<FileObservationReview activity={next} disabled={false} onChange={onChange} />)
    await user.selectOptions(screen.getByLabelText("운동 종류"), "WALKING")
    expect(onChange.mock.calls.at(-1)![0].observation).toMatchObject({ sport: "UNKNOWN", confirmation: { sport: "WALKING", durationMeaning: "TIMER" } })
    expect(screen.queryByText(original.name)).not.toBeInTheDocument()
  })

  it("rebuilds initial source identity when a pre-save timezone choice changes the date", () => {
    const original = activity(), onChange = vi.fn()
    render(<FileObservationReview activity={original} disabled={false} onChange={onChange} />)
    fireEvent.click(screen.getByText("시간과 날짜 확인"))
    fireEvent.change(screen.getByLabelText(/운동 날짜 기준/u), { target: { value: "UTC" } })
    const next = onChange.mock.calls[0]![0] as ImportedActivity
    expect(next.date).toBe("2026-09-18")
    expect(parseFileObservation(next.observation)).not.toBeNull()
    expect(next.observation!.sourceObservationKey).not.toBe(original.observation!.sourceObservationKey)
    expect(next.observation!.sourceIdentityFingerprint).not.toBe(original.observation!.sourceIdentityFingerprint)
    expect(next.observation!.contentRevisionFingerprint).not.toBe(original.observation!.contentRevisionFingerprint)
  })

  it.each(["TIMER", "MOVING", "ELAPSED"] as const)("does not offer a meaning override for a file-declared %s", meaning => {
    const original = activity(), onChange = vi.fn()
    const { schemaVersion: _schema, source: _source, sourceObservationKey: _key,
      contentRevisionFingerprint: _fingerprint, sourceIdentityFingerprint: _identity,
      completeness: _completeness, ...input } = original.observation!
    const observation = buildFileObservation({ ...input, durationMeaning: meaning })
    render(<FileObservationReview activity={{ ...original, observation }} disabled={false} onChange={onChange} />)
    fireEvent.click(screen.getByText("시간과 날짜 확인"))
    expect(screen.queryByLabelText("파일의 시간은 어떤 시간인가요?")).not.toBeInTheDocument()
    expect(screen.getByText(/^파일에 지정된 시간:/u)).toBeVisible()
    expect(onChange).not.toHaveBeenCalled()
  })

  it("does not expose a date-changing control for already saved evidence", () => {
    const original = activity(), onChange = vi.fn()
    render(<FileObservationReview activity={original} disabled={false} allowDateChange={false} onChange={onChange} />)
    fireEvent.click(screen.getByText("시간과 날짜 확인"))
    expect(screen.queryByLabelText(/운동 날짜 기준/u)).not.toBeInTheDocument()
    expect(screen.getByText(/저장된 날짜: 2026-09-19/u)).toBeVisible()
    expect(screen.getByLabelText("파일의 시간은 어떤 시간인가요?")).toBeEnabled()
    expect(onChange).not.toHaveBeenCalled()
  })

  it("disables changes while saving and supports keyboard focus without hidden confirmation", async () => {
    const user = userEvent.setup(), onChange = vi.fn()
    const view = render(<FileObservationReview activity={activity()} disabled onChange={onChange} />)
    await user.click(screen.getByText("시간과 날짜 확인"))
    for (const select of screen.getAllByRole("combobox")) expect(select).toBeDisabled()
    await user.selectOptions(screen.getByLabelText("운동 종류"), "RUNNING")
    expect(onChange).not.toHaveBeenCalled()
    view.rerender(<FileObservationReview activity={activity()} disabled={false} onChange={onChange} />)
    screen.getByText("시간과 날짜 확인").focus()
    await user.tab()
    expect(screen.getByLabelText("파일의 시간은 어떤 시간인가요?")).toHaveFocus()
    expect(onChange).not.toHaveBeenCalled()
  })
})
