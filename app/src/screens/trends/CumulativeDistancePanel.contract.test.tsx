import { cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { StructuredJournalObservation } from "../../domain/journal-observation"
import { buildFileObservation } from "../../domain/import/file-observation"
import { projectFileObservation } from "../../domain/import/file-analysis"
import { CumulativeDistancePanel } from "./CumulativeDistancePanel"

function observation(sourceId: string, loggedOn: string, distanceKm: number): StructuredJournalObservation {
  return {
    sourceRef: {
      sourceKind: "SESSION_RESULT_RECORD",
      sourceId,
      sourceVersion: null,
      observedAt: `${loggedOn}T12:00:00.000Z`,
      trustState: "ACCEPTED",
      containsPrivateRawText: false,
    },
    loggedOn,
    distanceKm,
    durationMin: null,
    secondsPerKm: null,
    rpe: null,
    mood: null,
    painMax: null,
    painSourceLevels: [],
    fieldProvenance: {
      distanceKm: "EXPLICIT",
      durationMin: "MISSING",
      secondsPerKm: "MISSING",
      rpe: "MISSING",
      mood: "MISSING",
      painMax: "MISSING",
    },
    derivationRefs: [],
  }
}

afterEach(cleanup)

describe("cumulative distance panel", () => {
  const observations = [
    observation("older", "2026-08-02", 10),
    observation("current", "2026-08-27", 5.5),
  ]

  it("shows the same to-date totals in compact Home and full Analysis modes", () => {
    const home = render(
      <CumulativeDistancePanel observations={observations} today="2026-08-28" mode="compact" />,
    )
    const homeMonth = within(home.container).getByText("이번 달").parentElement
    expect(homeMonth).toHaveTextContent("15.5 km")
    expect(homeMonth?.querySelector("strong")).toHaveClass("app-metric__value")
    expect(homeMonth?.querySelector("strong small")).toHaveClass("app-metric__unit")
    expect(screen.getByRole("heading", { name: "달린 거리" })).toHaveClass("app-heading--section")
    home.unmount()

    const analysis = render(
      <CumulativeDistancePanel observations={observations} today="2026-08-28" mode="full" />,
    )
    const analysisMonth = within(analysis.container).getByText("이번 달").parentElement
    expect(analysisMonth).toHaveTextContent("15.5 km")
    expect(analysisMonth).toHaveAccessibleName(/이번 달.*15.5킬로미터.*2건/u)
    expect(screen.getByRole("heading", { name: "누적 거리와 변화" })).toHaveClass("app-heading--screen", "app-heading--accent")
    expect(analysis.container.querySelectorAll(".app-heading--accent")).toHaveLength(1)
  })

  it("switches to 12-week and 12-month comparisons without changing the source rules", () => {
    render(<CumulativeDistancePanel observations={observations} today="2026-08-28" mode="full" />)

    fireEvent.click(screen.getByRole("button", { name: "12주" }))
    fireEvent.click(screen.getByRole("button", { name: "12개월" }))

    expect(screen.getByRole("button", { name: "12주" })).toHaveAttribute("aria-pressed", "true")
    expect(screen.getByRole("button", { name: "12개월" })).toHaveAttribute("aria-pressed", "true")
    expect(screen.getByRole("img", { name: /주간 거리/u }).getAttribute("aria-label")).toContain("5.5킬로미터")
  })

  it("shows missing days as missing and gives the heatmap a numerical alternative", () => {
    render(<CumulativeDistancePanel observations={observations} today="2026-08-28" mode="full" />)

    expect(screen.getByRole("listitem", { name: "1일, 집계 가능한 거리 기록 없음" })).toBeVisible()
    expect(screen.getByRole("listitem", { name: "27일, 5.5킬로미터, 기록 1건" })).toBeVisible()
    expect(screen.getAllByText("표로 보기")).toHaveLength(2)
  })

  it.each(["compact", "full"] as const)("offers one recording action without empty charts or emphasized missing totals in %s mode", mode => {
    const write = vi.fn()
    const { container } = render(<CumulativeDistancePanel observations={[]} today="2026-08-28" mode={mode} onWriteLog={write} />)
    expect(container.querySelectorAll(".app-metric__value")).toHaveLength(0)
    expect(screen.queryByRole("img")).toBeNull()
    expect(screen.queryByText("표로 보기")).toBeNull()
    expect(screen.queryByRole("list", { name: /날짜별 거리/u })).toBeNull()
    expect(screen.queryByText("0 km")).toBeNull()
    expect(container.querySelector("details")).toBeNull()
    expect(screen.queryByText(/기록이 없어요/)).toBeNull()
    expect(screen.getByRole("button", { name: "운동 기록하기" })).toBeVisible()
    fireEvent.click(screen.getByRole("button", { name: "운동 기록하기" }))
    expect(write).toHaveBeenCalledOnce()
    if (mode === "full") {
      expect(screen.getByRole("button", { name: "4주" })).toHaveAttribute("aria-pressed", "true")
      expect(screen.getByRole("button", { name: "12주" })).toBeVisible()
      expect(screen.getByRole("button", { name: "6개월" })).toHaveAttribute("aria-pressed", "true")
      expect(screen.getByRole("button", { name: "12개월" })).toBeVisible()
    }
  })

  it.each([
    { date: "2026-06-15", series: "주간 거리", period: "12주" },
    { date: "2025-12-15", series: "월간 거리", period: "12개월" },
  ])("reveals older $series data after widening an initially empty period", ({ date, series, period }) => {
    render(<CumulativeDistancePanel observations={[observation("older-period", date, 7)]} today="2026-08-28" mode="full" />)
    expect(screen.queryByRole("img", { name: new RegExp(series) })).toBeNull()
    expect(screen.queryByRole("list", { name: /날짜별 거리/u })).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: period }))
    expect(screen.getByRole("img", { name: new RegExp(series) })).toHaveAccessibleName(/7킬로미터/u)
    expect(screen.getByRole("table", { name: series })).toBeInTheDocument()
  })

  it("retains exclusion counts and evidence when every distance is excluded", () => {
    const rejected = { ...observation("unverified", "2026-08-27", 9), sourceRef: { ...observation("unverified", "2026-08-27", 9).sourceRef, trustState: "STALE" as const } }
    const { container } = render(<CumulativeDistancePanel observations={[rejected]} today="2026-08-28" mode="full" />)
    expect(container.querySelectorAll(".app-metric__value")).toHaveLength(0)
    expect(screen.queryByRole("img")).toBeNull()
    expect(screen.getAllByText("집계 기준에 맞지 않아 제외한 기록 1건")).toHaveLength(2)
    fireEvent.click(screen.getByText("집계 기준과 제외된 기록 보기"))
    expect(screen.getByText(/올해: 2026-01-01~2026-08-28 · 반영 0건 · 제외 1건/u)).toBeVisible()
  })

  it("keeps a confirmed file distance of zero as data in totals, charts and daily cells", () => {
    const projection = projectFileObservation({ id: "confirmed-zero", kind: "post-session", date: "2026-08-27", fileObservation: buildFileObservation({
      format: "tcx", sourceProfile: "TCX_ACTIVITY_V1", parserVersion: "v1", sourceActivityId: "zero-activity",
      date: "2026-08-27", startedAt: null, timeZone: null, sport: "RUNNING", distanceMeters: 0, durationSeconds: 0,
      durationMeaning: "TIMER", confirmation: { sport: null, durationMeaning: null },
      laps: [{ sourceIndex: 0, distanceMeters: 0, durationSeconds: 0, durationMeaning: "TIMER", kind: "UNKNOWN" }],
    }) }, { formats: ["tcx"], sourceContext: "ACCOUNT_CONFIRMED" })
    if (projection.status !== "ACCEPTED") throw new Error("Confirmed zero fixture must be accepted")
    const zero: StructuredJournalObservation = { ...observation("confirmed-zero", "2026-08-27", 0),
      sourceRef: { ...observation("confirmed-zero", "2026-08-27", 0).sourceRef, sourceVersion: projection.observation.contentRevisionFingerprint },
      fieldProvenance: { ...observation("confirmed-zero", "2026-08-27", 0).fieldProvenance, distanceKm: "FILE" },
      acceptedFileObservation: projection.observation, acceptedFileFields: ["distanceKm"],
    }
    const { container } = render(<CumulativeDistancePanel observations={[zero]} today="2026-08-28" mode="full" />)
    expect(container.querySelectorAll(".app-metric__value")).toHaveLength(3)
    expect(screen.getByRole("img", { name: /주간 거리/u })).toHaveAccessibleName(/0킬로미터, 기록 1건/u)
    expect(screen.getByRole("listitem", { name: "27일, 0킬로미터, 기록 1건" })).toHaveAttribute("data-has-distance", "true")
    expect(screen.queryByRole("button", { name: "운동 기록하기" })).toBeNull()
  })
})
