import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { TrendBucket } from "../../domain/trend-analysis"
import { MonthlyTrendSection } from "./MonthlyTrendSection"

vi.mock("./MonthlyTrendBars", () => ({
  MonthlyTrendBars: () => <div data-testid="monthly-trend-bars" />,
}))

vi.mock("../../domain/dates", () => ({ isoToDate: () => new Date("2026-09-21T00:00:00.000Z") }))
vi.mock("../../domain/analysis-field-eligibility", () => ({ acceptsFileDistance: () => false }))
vi.mock("../../domain/trend-analysis", () => ({
  bucketByMonth: vi.fn(),
  summarizeMetricCoverage: vi.fn(),
}))

import { bucketByMonth, summarizeMetricCoverage } from "../../domain/trend-analysis"

afterEach(cleanup)

const sourceRef = {
  sourceKind: "SESSION_RESULT_RECORD",
  sourceId: "monthly-section-source",
  sourceVersion: null,
  observedAt: "2026-08-20T08:00:00.000Z",
  trustState: "ACCEPTED",
  containsPrivateRawText: false,
} as const

const buckets = [
  {
    kind: "DATA", label: "2026-08", n: 2, median: 300, min: 240, max: 360, unit: "SECONDS_PER_KM",
    sourceRefs: [sourceRef], confidence: null, uncertaintyState: "NONE", displayStatus: "OBSERVED",
    nonSensitiveReasonCodes: ["STRUCTURED_OBSERVATION"],
  },
  {
    kind: "DATA", label: "2026-09", n: 1, median: 320, min: 320, max: 320, unit: "SECONDS_PER_KM",
    sourceRefs: [sourceRef], confidence: null, uncertaintyState: "STALE_SOURCE", displayStatus: "STALE",
    nonSensitiveReasonCodes: ["STRUCTURED_OBSERVATION"],
  },
  {
    kind: "MISSING", label: "2026-07", sourceRefs: [], confidence: null,
    uncertaintyState: "INSUFFICIENT_SOURCE", displayStatus: "MISSING", nonSensitiveReasonCodes: ["NO_ELIGIBLE_SOURCE"],
  },
] satisfies readonly TrendBucket[]

describe("monthly trend section presentation", () => {
  it("keeps action-needed coverage and source notices visible while closing repeated month values", () => {
    vi.mocked(bucketByMonth).mockReturnValue(buckets)
    vi.mocked(summarizeMetricCoverage).mockReturnValue({ included: 3, excluded: 1 })

    render(<MonthlyTrendSection observations={[]} today="2026-09-21" />)

    const disclosure = screen.getByText("월별 수치와 집계 범위 보기").closest("details")
    expect(disclosure).not.toBeNull()
    expect(disclosure).not.toHaveAttribute("open")
    expect(screen.getByText("집계 사용 3건 · 집계 제외 1건")).toBeVisible()
    expect(screen.getByText(/오래된 출처가 포함된 달/)).toBeVisible()
    expect(screen.getByText(/기록이 없는 달은 계산하지 않았어요/)).toBeVisible()
    expect(screen.queryByText(/8월 중앙/)).not.toBeVisible()
  })

  it("accepts a valid initial metric for linked analysis context", () => {
    vi.mocked(bucketByMonth).mockReturnValue(buckets)
    vi.mocked(summarizeMetricCoverage).mockReturnValue({ included: 3, excluded: 1 })

    render(<MonthlyTrendSection observations={[]} today="2026-09-21" initialMetric="DISTANCE_KM" />)

    expect(screen.getByRole("button", { name: "거리" })).toHaveAttribute("aria-pressed", "true")
    expect(screen.getByRole("button", { name: "페이스" })).toHaveAttribute("aria-pressed", "false")
  })
})
