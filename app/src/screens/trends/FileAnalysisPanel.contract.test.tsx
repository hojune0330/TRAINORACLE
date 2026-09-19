import React from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import { FileAnalysisPanel } from "./FileAnalysisPanel"
import { buildFileObservation, type FileObservationInput } from "../../domain/import/file-observation"
import { fileAnalysisFormats } from "../../domain/import/file-analysis-policy"

const date = "2026-09-19"
function entry(id: string, meters: number | null, seconds: number | null, meaning: FileObservationInput["durationMeaning"] = "TIMER", hasLaps = true) {
  return { id, kind: "post-session", date, fileObservation: buildFileObservation({
    format: hasLaps ? "tcx" : "csv", sourceProfile: hasLaps ? "TCX_ACTIVITY_V1" : "CSV_COLUMNS_V1", parserVersion: "v1", sourceActivityId: id,
    date, startedAt: null, timeZone: null, sport: "RUNNING", distanceMeters: meters, durationSeconds: seconds,
    durationMeaning: meaning, confirmation: { durationMeaning: null, sport: null },
    laps: hasLaps ? [{ sourceIndex: 0, distanceMeters: meters, durationSeconds: seconds, durationMeaning: meaning, kind: "UNKNOWN" }] : [],
  }) }
}
beforeEach(() => {
  for (const format of ["TCX", "CSV", "JSON", "GPX"]) {
    vi.stubEnv(`VITE_FEATURE_FILE_ANALYSIS_${format}`, format === "TCX" ? "true" : "false")
    vi.stubEnv(`VITE_KILL_FILE_ANALYSIS_${format}`, "false")
  }
})
afterEach(() => { cleanup(); vi.unstubAllEnvs() })

describe("FileAnalysisPanel independent UI contract", () => {
  it("keeps totals and correction available without promising lap comparison for a summary-only file", () => {
    vi.stubEnv("VITE_FEATURE_FILE_ANALYSIS_CSV", "true")
    render(<FileAnalysisPanel entries={[entry("summary-only", 5000, 1500, "TIMER", false)]} />)
    expect(screen.getByText("5km")).toBeVisible()
    fireEvent.click(screen.getByText(`${date} · 달리기 · 0개 구간`))
    expect(screen.getByText(/전체 기록만 있어/u)).toBeVisible()
    expect(screen.queryByRole("button", { name: "계획과 비교" })).toBeNull()
    expect(screen.getByRole("button", { name: /파일 기록 정정/u })).toBeVisible()
  })
  it.each(["tcx", "csv", "json", "gpx"])("keeps the %s feature and kill policy independent and default-off", format => {
    const feature = `VITE_FEATURE_FILE_ANALYSIS_${format.toUpperCase()}`
    const kill = `VITE_KILL_FILE_ANALYSIS_${format.toUpperCase()}`
    expect(fileAnalysisFormats({})).toEqual([])
    expect(fileAnalysisFormats({ [feature]: "true" })).toEqual([format])
    expect(fileAnalysisFormats({ [feature]: "true", [kill]: "true" })).toEqual([])
    expect(fileAnalysisFormats({ [feature]: true })).toEqual([])
    expect(fileAnalysisFormats({ [feature]: "TRUE" })).toEqual([])
    const other = format === "tcx" ? "CSV" : "TCX"
    expect(fileAnalysisFormats({ [feature]: "true", [`VITE_KILL_FILE_ANALYSIS_${other}`]: "true" })).toEqual([format])
  })

  it("keeps cached records out of current totals and explains a failed current confirmation", () => {
    const onOpenPlan = vi.fn()
    render(<FileAnalysisPanel entries={[]} pendingVerificationCount={2} onOpenPlan={onOpenPlan} />)
    expect(screen.getByRole("status")).toHaveTextContent("파일 기록 2개의 최신 상태")
    expect(screen.getByRole("status")).toHaveTextContent("기록은 보관")
    expect(screen.queryByText(/0km|0개 운동/u)).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "다음 훈련 살펴보기" })).not.toBeInTheDocument()
  })
  it("shows paired aggregate pace, safe segment details and the existing next-plan action", () => {
    const onOpenPlan = vi.fn()
    const guarded = { ...entry("one", 1000, 300), get memo(): string { throw Error("raw memo read") }, get title(): string { throw Error("raw title read") } }
    render(<FileAnalysisPanel entries={[guarded, entry("two", 9000, 4500)]} onOpenPlan={onOpenPlan} />)
    const panel = screen.getByRole("region", { name: "가져온 기록 분석" })
    expect(within(panel).getByText("10km")).toBeVisible()
    expect(within(panel).getByText("8분/km")).toBeVisible()
    expect(within(panel).getByText(/거리·시간이 함께 있는 2개/u)).toBeVisible()
    fireEvent.click(within(panel).getByText("계산에 쓴 기록과 빠진 항목"))
    expect(within(panel).getByText(/거리 합계와 시간 합계로 계산/u)).toBeVisible()
    const segment = within(panel).getAllByText(`${date} · 달리기 · 1개 구간`)[0]!
    fireEvent.click(segment)
    expect(within(segment.closest("details")!).getByRole("table")).toHaveTextContent("미지정")
    fireEvent.click(within(panel).getByRole("button", { name: "다음 훈련 살펴보기" }))
    expect(onOpenPlan).toHaveBeenCalledOnce()
    expect(panel.textContent).not.toMatch(/PRIVATE_|GPS_|FILENAME_/u)
  })

  it("does not label unknown time as a total or pace and keeps genuine zero visible", () => {
    render(<FileAnalysisPanel entries={[entry("zero", 0, 0, "SOURCE_DEFINED")]} />)
    expect(screen.getByText("0km")).toBeVisible()
    expect(screen.getByRole("heading", { name: "뜻을 확인하지 않은 파일 시간" })).toBeVisible()
    expect(screen.queryByText(/^시간 합계 ·/u)).not.toBeInTheDocument()
    expect(screen.queryByText(/평균 페이스 ·/u)).not.toBeInTheDocument()
    fireEvent.click(screen.getByText(`${date} · 달리기 · 1개 구간`))
    expect(screen.getByRole("table")).toHaveTextContent("0초")
  })

  it("discloses missing time and zero-denominator exclusions in metric details", () => {
    render(<FileAnalysisPanel entries={[entry("missing-time", 5000, null), entry("zero-distance", 0, 300)]} />)
    fireEvent.click(screen.getByText("계산에 쓴 기록과 빠진 항목"))
    expect(screen.getByText(/시간 없음.*1개/u)).toBeVisible()
    expect(screen.getByText(/거리 0.*1개/u)).toBeVisible()
    expect(screen.getByText(/거리·시간이 함께 있는 0개/u)).toBeVisible()
  })

  it("shows period errors and conflicting source exclusions instead of a winner", () => {
    render(<FileAnalysisPanel entries={[entry("same", 1000, 300), { ...entry("same", 2000, 300), id: "copy" }]} />)
    expect(screen.getByText(/0개 운동.*확인 필요 1개/u)).toBeVisible()
    fireEvent.click(screen.getByText("계산에 쓴 기록과 빠진 항목"))
    expect(screen.getByText(/같은 운동의 서로 다른 기록 확인 필요/u)).toBeVisible()
    fireEvent.click(screen.getByText(/기간 바꾸기/u))
    fireEvent.change(screen.getByLabelText("시작 날짜"), { target: { value: "2026-09-20" } })
    expect(screen.getByRole("alert")).toHaveTextContent("시작 날짜와 마지막 날짜")
  })

  it("honors the kill gate and does not fabricate a report for an empty list", () => {
    const view = render(<FileAnalysisPanel entries={[]} />)
    expect(screen.queryByTestId("file-analysis-panel")).not.toBeInTheDocument()
    vi.stubEnv("VITE_KILL_FILE_ANALYSIS_TCX", "true")
    view.rerender(<FileAnalysisPanel entries={[entry("one", 1000, 300)]} />)
    expect(screen.queryByTestId("file-analysis-panel")).not.toBeInTheDocument()
  })
  it("counts every confirmed activity while progressively rendering large lists", () => {
    render(<FileAnalysisPanel entries={Array.from({ length: 21 }, (_, index) => entry(`source-${index}`, 1000, 300))} />)
    expect(screen.getByText("21km")).toBeVisible()
    expect(screen.getAllByText(`${date} · 달리기 · 1개 구간`)).toHaveLength(20)
    fireEvent.click(screen.getByRole("button", { name: "운동 20개 더 보기" }))
    expect(screen.getAllByText(`${date} · 달리기 · 1개 구간`)).toHaveLength(21)
    expect(screen.queryByRole("button", { name: "운동 20개 더 보기" })).toBeNull()
  })
})
