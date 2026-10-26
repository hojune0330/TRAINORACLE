import React from "react"
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { buildOracleReport } from "../../domain/oracle-report"
import { buildOracleDemoScenario } from "../../domain/oracle-demo-scenario"
import type { JournalEntry } from "../../domain/journal-store"
import { OracleReport, type OracleReportSelection } from "./OracleReport"

vi.mock("./OracleReportShare", () => ({ OracleReportShare: ({ onClose }: { onClose: () => void }) => <div role="dialog" aria-label="한 장으로 남기기"><button type="button" onClick={onClose}>닫기</button></div> }))

const scenario = buildOracleDemoScenario()
const demo = buildOracleReport({ source: "example", months: 6, today: scenario.today, entries: scenario.entries })
afterEach(cleanup)

function Harness({ source = "example", months = 6, selectedMonth, evidenceExpanded, view = "summary", entries = scenario.entries,
  readState = "ready", onOpenDay = vi.fn(), onRetry = vi.fn(), onChange = vi.fn(),
}: { source?: "my" | "example"; months?: 3 | 6; selectedMonth?: string; evidenceExpanded?: boolean; view?: "summary" | "distance" | "mix" | "monthly";
  entries?: readonly JournalEntry[]; readState?: "ready" | "loading" | "error"; onOpenDay?: (date: string, entryId?: string) => void;
  onRetry?: () => void; onChange?: (selection: OracleReportSelection) => void }) {
  const [selection, setSelection] = React.useState<OracleReportSelection>({ source, months, metric: "DISTANCE_KM", selectedMonth, evidenceExpanded })
  const selectedScenario = buildOracleDemoScenario(selection.scenario)
  const report = buildOracleReport({ source: selection.source, months: selection.months, today: scenario.today,
    entries: selection.source === "example" ? selectedScenario.entries : entries })
  return <OracleReport report={report} view={view} selection={selection} readState={readState}
    hasSavedEntries={report.scopedEntryCount > 0} onSelectionChange={next => { setSelection(next); onChange(next) }}
    onOpenDay={onOpenDay} onRetry={onRetry} onWriteLog={vi.fn()} onWriteRecovery={vi.fn()} onOpenImport={vi.fn()} />
}

describe("common calendar-month Oracle report", () => {
  it("unmounts an open personal share immediately when reading fails or account scope changes", () => {
    const props = { report: demo, view: "summary" as const, selection: { source: "my" as const, months: 6 as const, metric: "DISTANCE_KM" as const }, onSelectionChange: vi.fn(), hasSavedEntries: true }
    const { rerender } = render(<OracleReport {...props} accountScopeKey="one" readState="ready" />)
    fireEvent.click(screen.getByRole("button", { name: "한 장으로 남기기" }))
    expect(screen.getByRole("dialog")).toBeVisible()
    rerender(<OracleReport {...props} accountScopeKey="one" readState="error" />)
    expect(screen.queryByRole("dialog")).toBeNull()
    rerender(<OracleReport {...props} accountScopeKey="one" readState="ready" />)
    expect(screen.queryByRole("dialog")).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "한 장으로 남기기" }))
    rerender(<OracleReport {...props} accountScopeKey="two" readState="ready" />)
    expect(screen.queryByRole("dialog")).toBeNull()
  })

  it("clears deleted day evidence rather than selecting a neighboring record", () => {
    const changed = vi.fn()
    render(<OracleReport report={demo} view="distance" selection={{ source: "example", months: 6, metric: "DISTANCE_KM", selectedMonth: "2026-09", selectedDay: "2026-09-31" }}
      onSelectionChange={changed} hasSavedEntries readState="ready" />)
    expect(changed).toHaveBeenCalledWith(expect.objectContaining({ selectedMonth: "2026-09", selectedDay: undefined }))
    expect(screen.queryByText("2026-09-31")).not.toBeInTheDocument()
  })
  it("keeps the period and metric but clears individual evidence when switching example scenarios", () => {
    const changed = vi.fn()
    render(<Harness selectedMonth="2026-08" evidenceExpanded onChange={changed} />)
    expect(screen.getByRole("button", { name: "10km 준비" })).toHaveAttribute("aria-pressed", "true")
    fireEvent.click(screen.getByRole("button", { name: "트랙 훈련 1500m" }))
    expect(changed).toHaveBeenLastCalledWith(expect.objectContaining({ scenario: "track-1500", months: 6, metric: "DISTANCE_KM", selectedMonth: undefined, evidenceExpanded: false }))
    expect(screen.getByRole("button", { name: "트랙 훈련 1500m" })).toHaveAttribute("aria-pressed", "true")
  })

  it("keeps examples available while personal reading has failed", () => {
    render(<Harness source="my" readState="error" />)
    fireEvent.click(screen.getByRole("button", { name: "예시" }))
    expect(screen.getByRole("img")).toBeVisible()
    expect(screen.queryByText("기록을 아직 모두 확인하지 못했어요")).not.toBeInTheDocument()
    expect(screen.getByRole("group", { name: "예시 상황" })).toBeVisible()
  })

  it("opens day-level distance and time only after choosing a month", () => {
    render(<Harness view="distance" />)
    expect(screen.queryByRole("region", { name: "7월 날짜별 훈련량" })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "7월 근거 보기" }))
    const days = screen.getByRole("region", { name: "7월 날짜별 훈련량" })
    expect(days.querySelectorAll('details').length).toBeGreaterThan(0)
    expect(days.textContent).toContain('분')
  })
  it("distinguishes the six-month total from the highest month's own distance and names the evidence selector", () => {
    const { container } = render(<Harness />)
    expect(screen.getByRole("heading", { name: demo.insights.hero.headline })).toBeVisible()
    const totalLabel = screen.getByText("누적 거리")
    expect(totalLabel.nextElementSibling).toHaveTextContent(`${demo.distance.totalKm} km`)
    expect(screen.getByText("근거를 볼 월")).toBeVisible()
    expect(screen.getByRole("group", { name: "근거를 볼 월 선택" })).toHaveAccessibleDescription("근거를 볼 월")
    expect(container.querySelector(".oracle-report__interpretation")).toHaveTextContent(`거리 기록 ${demo.distance.includedSourceCount}건을 합산했어요.`)
    expect(container.querySelector(".oracle-report__interpretation")).not.toHaveTextContent("가장 많아요")
  })

  it("qualifies a highest completed-month observation when the current partial month is excluded", () => {
    const entries: readonly JournalEntry[] = [
      { id: "complete-month", kind: "post-session", date: "2026-08-20", savedAt: "2026-08-20T08:00:00Z", syncState: "local",
        system: "base", title: "", memo: "", distanceKm: "8", durationMin: "40", avgPace: "5:00", rpe: 4,
        fieldProvenance: { distanceKm: { provenance: "EXPLICIT" } } },
      { id: "partial-month", kind: "post-session", date: "2026-09-10", savedAt: "2026-09-10T08:00:00Z", syncState: "local",
        system: "base", title: "", memo: "", distanceKm: "12", durationMin: "60", avgPace: "5:00", rpe: 4,
        fieldProvenance: { distanceKm: { provenance: "EXPLICIT" } } },
    ]
    const report = buildOracleReport({ source: "my", months: 3, today: "2026-09-15", entries })
    render(<OracleReport report={report} view="summary" selection={{ source: "my", months: 3, metric: "DISTANCE_KM" }}
      onSelectionChange={vi.fn()} readState="ready" hasSavedEntries />)
    expect(screen.getByRole("heading", { level: 2, name: report.insights.hero.headline })).toBeVisible()
    expect(screen.getByText("누적 거리").nextElementSibling).toHaveTextContent("20 km")
  })

  it("keeps the selected month and expanded evidence unchanged when reselecting the active source", () => {
    const changed = vi.fn()
    const { container } = render(<Harness selectedMonth="2026-04" evidenceExpanded onChange={changed} />)
    fireEvent.click(screen.getByRole("button", { name: "예시" }))
    expect(changed).not.toHaveBeenCalled()
    expect(screen.getByRole("button", { name: "4월 근거 보기" })).toHaveAttribute("aria-pressed", "true")
    expect(container.querySelector(".oracle-report__all-evidence")).toHaveAttribute("open")
  })

  it("names the training type in mix evidence so each row explains the counted category", () => {
    render(<Harness view="mix" />)
    const evidence = screen.getByRole("region", { name: "리포트 근거" })
    const first = evidence.querySelector(".oracle-report__evidence-list li small")
    expect(first).toHaveTextContent("기초 지구력")
    expect(first).not.toHaveTextContent("5 km")
  })

  it("uses one deterministic data set for both periods and keeps view and period when switching source", () => {
    const changed = vi.fn()
    render(<Harness view="monthly" onChange={changed} />)
    expect(screen.getByText("2026.04.01 – 2026.09.30")).toBeVisible()
    expect(screen.getByRole("button", { name: "6개월" })).toHaveAttribute("aria-pressed", "true")
    fireEvent.click(screen.getByRole("button", { name: "4월 근거 보기" }))
    fireEvent.click(screen.getByRole("button", { name: "내 기록" }))
    expect(changed).toHaveBeenLastCalledWith(expect.objectContaining({ source: "my", months: 6, metric: "DISTANCE_KM", selectedMonth: undefined }))
    expect(screen.getByRole("heading", { name: "거리의 월별 변화" })).toBeVisible()
  })

  it("clears an out-of-window month on 6 to 3 and retains a visible month", () => {
    const changed = vi.fn()
    const { unmount } = render(<Harness selectedMonth="2026-04" onChange={changed} />)
    fireEvent.click(screen.getByRole("button", { name: "3개월" }))
    expect(changed).toHaveBeenLastCalledWith(expect.objectContaining({ months: 3, selectedMonth: undefined }))
    expect(screen.getByText("2026.07.01 – 2026.09.30")).toBeVisible()
    unmount()
    render(<Harness selectedMonth="2026-08" onChange={changed} />)
    fireEvent.click(screen.getByRole("button", { name: "3개월" }))
    expect(changed).toHaveBeenLastCalledWith(expect.objectContaining({ months: 3, selectedMonth: "2026-08" }))
  })

  it("makes months real controls, highlights the selected row, scopes evidence and offers a table", () => {
    const { container } = render(<Harness view="distance" />)
    const img = screen.getByRole("img")
    expect(img).toHaveAccessibleName(/월별 누적 거리/u)
    fireEvent.click(screen.getByRole("button", { name: "7월 근거 보기" }))
    expect(screen.getByRole("button", { name: "7월 근거 보기" })).toHaveAttribute("aria-pressed", "true")
    expect(container.querySelectorAll('.oracle-report__bar-row[data-selected="true"]')).toHaveLength(1)
    expect(screen.getByRole("heading", { name: "7월 근거" })).toBeVisible()
    const evidence = screen.getByRole("region", { name: "리포트 근거" })
    for (const button of within(evidence).getAllByRole("button", { name: /예시 기록 보기/u })) expect(button.getAttribute("aria-label")).toContain("2026-07")
    fireEvent.click(screen.getByText("표로 보기"))
    expect(screen.getByRole("table")).toBeVisible()
  })

  it("distinguishes monthly totals from per-session medians and does not invent data for a gap", () => {
    render(<Harness source="my" view="monthly" entries={scenario.entries.filter(entry => !entry.date.startsWith("2026-06"))} />)
    expect(screen.getByText("운동 1회 거리 · 월 합계와 달라요")).toBeVisible()
    expect(screen.getByRole("img")).toHaveAccessibleName(/6월 미기록/u)
    expect(screen.getByRole("img").getAttribute("aria-label")).not.toContain("6월 0")
    expect(screen.getByRole("heading", { name: "거리 · 월별 중앙값" })).toBeVisible()
  })

  it("shows only three recent evidence rows before the explicit full-list disclosure", () => {
    render(<Harness />)
    const list = screen.getByRole("region", { name: "리포트 근거" })
    expect(list.querySelectorAll(":scope > ul > li")).toHaveLength(3)
    expect(list.querySelector(".oracle-report__all-evidence")).not.toHaveAttribute("open")
    fireEvent.click(screen.getByText(/반영 기록 \d+개 모두 보기/u))
    expect(list.querySelector(".oracle-report__all-evidence")).toHaveAttribute("open")
    expect(list.querySelectorAll(".oracle-report__all-evidence li").length).toBeGreaterThan(0)
  })

  it.each(["loading", "error"] as const)("does not call an unresolved %s read empty or show real metrics", readState => {
    const retry = vi.fn()
    render(<Harness source="my" readState={readState} entries={[]} onRetry={retry} />)
    expect(screen.queryByRole("img")).toBeNull()
    expect(screen.queryByText("아직 이 기간에 남긴 기록이 없어요")).toBeNull()
    expect(screen.queryByRole("button", { name: "예시 결과 보기" })).toBeNull()
    if (readState === "error") { fireEvent.click(screen.getByRole("button", { name: "다시 확인" })); expect(retry).toHaveBeenCalledOnce() }
    else expect(screen.getByRole("heading", { name: "기록을 확인하고 있어요" })).toBeVisible()
  })

  it("renders confirmed empty and metric-specific missing states with useful actions", () => {
    const { unmount } = render(<Harness source="my" entries={[]} />)
    expect(screen.getByText("아직 이 기간에 남긴 기록이 없어요")).toBeVisible()
    expect(screen.getByRole("button", { name: "예시 결과 보기" })).toBeVisible()
    unmount()
    render(<Harness source="my" view="monthly" entries={scenario.entries.filter(entry => entry.kind === "evening")} />)
    expect(screen.getByText("이 기간에는 거리 값이 없어요")).toBeVisible()
    fireEvent.click(screen.getByRole("button", { name: "지표 선택: 거리" }))
    fireEvent.click(screen.getByRole("button", { name: "기분" }))
    expect(screen.getByRole("heading", { name: "기분의 월별 변화" })).toBeVisible()
    expect(screen.getByRole("img")).toBeVisible()
  })

  it("keeps demo exploration read-only and actual evidence opens the exact existing journal", () => {
    const open = vi.fn()
    const { unmount } = render(<Harness onOpenDay={open} />)
    const write = vi.spyOn(Storage.prototype, "setItem")
    fireEvent.click(screen.getAllByRole("button", { name: /예시 기록 보기/u })[0]!)
    fireEvent.click(screen.getByRole("button", { name: "3개월" }))
    expect(open).not.toHaveBeenCalled()
    expect(write).not.toHaveBeenCalled()
    write.mockRestore(); unmount()
    render(<Harness source="my" view="distance" onOpenDay={open} />)
    const first = demo.evidence.find(item => item.distanceIncluded)!
    fireEvent.click(screen.getByRole("button", { name: `${first.date} 운동 일지 보기` }))
    expect(open).toHaveBeenCalledWith(first.date, first.id)
  })
})
