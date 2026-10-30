import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import { ImportedActivityFacts } from "./ImportedActivityFacts"
import { FileObservationReview } from "./FileObservationReview"
import { ReviewStage, SavedStage } from "./ImportStages"
import { buildImportDrafts } from "../../domain/import/import-draft"
import { buildFileObservation, type FileObservationInput } from "../../domain/import/file-observation"
import type { ImportedActivity } from "../../domain/import/activity-file"

afterEach(cleanup)
function activity(overrides: Partial<FileObservationInput> = {}): ImportedActivity {
  const facts: FileObservationInput = { format: "tcx", sourceProfile: "TCX_ACTIVITY_V1", parserVersion: "v1",
    sourceActivityId: "synthetic", date: "2026-10-06", startedAt: null, timeZone: null, sport: "RUNNING",
    distanceMeters: 5000, durationSeconds: 1800, durationMeaning: "TIMER", confirmation: null, laps: [], ...overrides }
  facts.laps = [{ sourceIndex: 0, distanceMeters: facts.distanceMeters, durationSeconds: facts.durationSeconds,
    durationMeaning: facts.durationMeaning, kind: "UNKNOWN" }]
  return { date: facts.date, name: "달리기", sport: "Running", distanceKm: "5", durationMin: "30", avgPace: "6:00",
    observation: buildFileObservation(facts) }
}

it.each([["TIMER", "타이머 시간"], ["MOVING", "이동 시간"], ["ELAPSED", "전체 경과 시간"]] as const)("labels %s without treating every duration as moving time", (meaning, label) => {
  render(<ImportedActivityFacts activity={activity({ durationMeaning: meaning })} />)
  expect(screen.getByText(label)).toBeVisible()
  expect(screen.getByText(`${label} 기준 페이스`)).toBeVisible()
  expect(screen.getByText("6:00/km")).toBeVisible()
})

it("keeps missing values missing and withholds pace for unconfirmed time, even if a compatibility field contains a pace", () => {
  render(<ImportedActivityFacts activity={activity({ durationMeaning: "UNKNOWN", distanceMeters: null })} />)
  expect(screen.getByText("파일에 없음")).toBeVisible()
  expect(screen.getByText("파일의 시간 · 종류 미확인")).toBeVisible()
  expect(screen.queryByText("6:00/km")).toBeNull()
  expect(screen.queryByText("0km")).toBeNull()
})

it("uses confirmed time meaning without rewriting source facts and never generates pace for zero time", () => {
  const item = activity({ durationMeaning: "SOURCE_DEFINED", confirmation: { sport: null, durationMeaning: "TIMER" } })
  const original = JSON.stringify(item.observation)
  const view = render(<ImportedActivityFacts activity={item} />)
  expect(screen.getByText("타이머 시간 기준 페이스")).toBeVisible()
  expect(screen.getByText(/원본 시간 · 파일의 시간 · 종류 미확인/)).toHaveTextContent("내가 확인한 기준 · 타이머 시간")
  expect(JSON.stringify(item.observation)).toBe(original)
  view.rerender(<ImportedActivityFacts activity={activity({ durationSeconds: 0 })} />)
  expect(screen.queryByText(/\/km/u)).toBeNull()
  expect(screen.getByText("0분")).toBeVisible()
})

it("does not select the viewer timezone when the source has only an offset", () => {
  const change = vi.fn()
  render(<FileObservationReview activity={activity({ startedAt: "2026-10-06T23:30:00-04:00" })} disabled={false} onChange={change} />)
  fireEvent.click(screen.getByText("시간과 날짜 확인"))
  expect(screen.getByRole("combobox", { name: /운동 날짜 기준/ })).toHaveValue("")
  expect(change).not.toHaveBeenCalled()
})

it("opens only receipt-identified entries and never invents row successes from aggregate counts", () => {
  const open = vi.fn()
  const outcome = { account: 1, pending: 1, saved: 1, failed: 0, total: 2 }
  const view = render(<SavedStage outcome={outcome} onOpenEntry={open} onRestart={vi.fn()} />)
  expect(screen.queryByRole("list", { name: "계정 저장이 확인된 일지" })).toBeNull()
  view.rerender(<SavedStage outcome={{ ...outcome, confirmedEntries: [{ date: "2026-10-06", id: "record-b" }] }} onOpenEntry={open} onRestart={vi.fn()} />)
  fireEvent.click(screen.getByRole("button", { name: /저장한 일지 열기/ }))
  expect(open).toHaveBeenCalledWith("2026-10-06", "record-b")
})

it("distinguishes same-day same-name selections and save controls with actual facts and row order", () => {
  const items = [activity(), activity({ sourceActivityId: "second", distanceMeters: 6000, durationSeconds: 2100 })]
  const toggle = vi.fn()
  render(<ReviewStage drafts={buildImportDrafts(items, [])} result={{ format: "tcx", activities: items, skipped: 0 }}
    selected={new Set([0, 1])} intents={new Map()} onIntent={vi.fn()} onToggle={toggle} onSave={vi.fn()} onRestart={vi.fn()} />)
  const first = screen.getByRole("checkbox", { name: /운동 1, .*거리 5km, 타이머 시간 30분 가져오기/u })
  const second = screen.getByRole("checkbox", { name: /운동 2, .*거리 6km, 타이머 시간 35분 가져오기/u })
  expect(first).toBeChecked()
  expect(screen.getByRole("combobox", { name: /운동 2, .*6km.*35분 저장 방식/u })).toBeVisible()
  fireEvent.click(second)
  expect(toggle).toHaveBeenCalledWith(1)
})
