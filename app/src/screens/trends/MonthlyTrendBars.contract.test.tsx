import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import type { TrendBucket } from "../../domain/trend-analysis"
import { MonthlyTrendBars } from "./MonthlyTrendBars"

afterEach(cleanup)

const sourceRef = {
  sourceKind: "SESSION_RESULT_RECORD",
  sourceId: "monthly-trend-source",
  sourceVersion: null,
  observedAt: "2026-08-20T08:00:00.000Z",
  trustState: "ACCEPTED",
  containsPrivateRawText: false,
} as const

const buckets = [
  {
    kind: "DATA",
    label: "2026-05",
    n: 2,
    median: 100,
    min: 90,
    max: 110,
    unit: "KILOMETERS",
    sourceRefs: [sourceRef],
    confidence: null,
    uncertaintyState: "NONE",
    displayStatus: "OBSERVED",
    nonSensitiveReasonCodes: ["STRUCTURED_OBSERVATION"],
  },
  {
    kind: "DATA",
    label: "2026-06",
    n: 1,
    median: 5,
    min: 5,
    max: 5,
    unit: "KILOMETERS",
    sourceRefs: [sourceRef],
    confidence: null,
    uncertaintyState: "NONE",
    displayStatus: "OBSERVED",
    nonSensitiveReasonCodes: ["STRUCTURED_OBSERVATION"],
  },
  {
    kind: "DATA",
    label: "2026-07",
    n: 1,
    median: 0,
    min: 0,
    max: 0,
    unit: "KILOMETERS",
    sourceRefs: [sourceRef],
    confidence: null,
    uncertaintyState: "NONE",
    displayStatus: "OBSERVED",
    nonSensitiveReasonCodes: ["STRUCTURED_OBSERVATION"],
  },
  {
    kind: "MISSING",
    label: "2026-08",
    sourceRefs: [],
    confidence: null,
    uncertaintyState: "INSUFFICIENT_SOURCE",
    displayStatus: "MISSING",
    nonSensitiveReasonCodes: ["NO_ELIGIBLE_SOURCE"],
  },
] satisfies readonly TrendBucket[]

describe("monthly trend bar presentation", () => {
  it("keeps bar lengths exactly proportional while showing values and missing state", () => {
    const { container } = render(
      <MonthlyTrendBars buckets={buckets} metric="DISTANCE_KM" metricLabel="거리" />,
    )

    const bars = container.querySelectorAll<HTMLElement>(".monthly-trend-bars__bar")
    expect(bars).toHaveLength(3)
    expect(bars[0]).toHaveStyle({ height: "54px" })
    expect(bars[1]).toHaveStyle({ height: "2.7px" })
    expect(bars[2]).toHaveStyle({ height: "0px" })
    expect(screen.getByText("100 km")).toBeVisible()
    expect(screen.getByText("5 km")).toBeVisible()
    expect(screen.getByText("없음")).toBeVisible()
    expect(screen.getByRole("img", { name: /8월 기록 없음/u })).toBeVisible()
  })

  it("reflows long values instead of clipping them when the chart narrows or zooms", () => {
    const longValueBuckets = buckets.map((bucket, index) => (
      index === 0 && bucket.kind === "DATA"
        ? { ...bucket, median: 123456.8, min: 123456.8, max: 123456.8 }
        : bucket
    )) satisfies readonly TrendBucket[]
    const { container } = render(
      <MonthlyTrendBars buckets={longValueBuckets} metric="DISTANCE_KM" metricLabel="거리" />,
    )

    const chart = container.querySelector<HTMLElement>(".monthly-trend-bars")
    const value = screen.getByText("123456.8 km")
    const item = value.closest<HTMLElement>(".monthly-trend-bars__item")

    expect(chart?.style.gridTemplateColumns).toBe("repeat(auto-fit, minmax(min(100%, 64px), 1fr))")
    expect(item?.style.gridTemplateRows).toBe("minmax(40px, auto) 54px minmax(20px, auto)")
    expect(value.style.overflow).toBe("")
    expect(value.style.overflowWrap).toBe("anywhere")
    expect(value.style.whiteSpace).toBe("normal")
  })
})
