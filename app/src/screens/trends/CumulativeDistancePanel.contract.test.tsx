import { cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import type { StructuredJournalObservation } from "../../domain/journal-observation"
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
    home.unmount()

    const analysis = render(
      <CumulativeDistancePanel observations={observations} today="2026-08-28" mode="full" />,
    )
    const analysisMonth = within(analysis.container).getByText("이번 달").parentElement
    expect(analysisMonth).toHaveTextContent("15.5 km")
    expect(analysisMonth).toHaveAccessibleName(/이번 달.*15.5킬로미터.*2건/u)
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
})
