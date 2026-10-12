import { cleanup, fireEvent, render, screen } from "@testing-library/react"
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

const missingBuckets: readonly TrendBucket[] = ["2026-06", "2026-07", "2026-08", "2026-09"].map(label => ({
  kind: "MISSING", label, sourceRefs: [], confidence: null,
  uncertaintyState: "INSUFFICIENT_SOURCE", displayStatus: "MISSING", nonSensitiveReasonCodes: ["NO_ELIGIBLE_SOURCE"],
}))

describe("monthly trend section presentation", () => {
  it("offers a recording action without repeating four empty months or showing an empty chart", () => {
    vi.mocked(bucketByMonth).mockReturnValue(missingBuckets)
    vi.mocked(summarizeMetricCoverage).mockReturnValue({ included: 0, excluded: 0 })
    const onWriteLog = vi.fn()
    const onWriteRecovery = vi.fn()
    const { rerender } = render(<MonthlyTrendSection observations={[]} today="2026-09-21" onWriteLog={onWriteLog} onWriteRecovery={onWriteRecovery} />)

    expect(screen.getByText("일지에 남긴 페이스 값으로 최근 4개월의 변화를 볼 수 있어요.")).toBeVisible()
    expect(screen.queryByTestId("monthly-trend-bars")).not.toBeInTheDocument()
    expect(screen.queryByText("월별 수치와 집계 범위 보기")).not.toBeInTheDocument()
    expect(screen.queryByText(/집계 가능한 기록이 없어요/u)).not.toBeInTheDocument()
    expect(screen.queryByText(/집계 사용 0건/u)).not.toBeInTheDocument()
    expect(screen.getByRole("group", { name: "추이 항목" })).toBeVisible()
    fireEvent.click(screen.getByRole("button", { name: "운동 기록하기" }))
    expect(onWriteLog).toHaveBeenCalledOnce()
    fireEvent.click(screen.getByRole("button", { name: "거리" }))
    fireEvent.click(screen.getByRole("button", { name: "운동 기록하기" }))
    expect(onWriteLog).toHaveBeenCalledTimes(2)
    for (const metric of ["기분", "통증"]) {
      fireEvent.click(screen.getByRole("button", { name: metric }))
      expect(screen.queryByRole("button", { name: "운동 기록하기" })).not.toBeInTheDocument()
      fireEvent.click(screen.getByRole("button", { name: "몸 상태 기록하기" }))
    }
    expect(onWriteRecovery).toHaveBeenCalledTimes(2)
    expect(onWriteLog).toHaveBeenCalledTimes(2)
    rerender(<MonthlyTrendSection observations={[]} today="2026-09-21" onWriteLog={onWriteLog} />)
    expect(screen.queryByRole("button", { name: /기록하기/u })).not.toBeInTheDocument()
    rerender(<MonthlyTrendSection observations={[]} today="2026-09-21" onWriteRecovery={onWriteRecovery} />)
    fireEvent.click(screen.getByRole("button", { name: "페이스" }))
    expect(screen.queryByRole("button", { name: /기록하기/u })).not.toBeInTheDocument()
  })

  it("keeps excluded source counts when no monthly value is eligible", () => {
    vi.mocked(bucketByMonth).mockReturnValue(missingBuckets)
    vi.mocked(summarizeMetricCoverage).mockReturnValue({ included: 0, excluded: 2 })
    render(<MonthlyTrendSection observations={[]} today="2026-09-21" />)

    expect(screen.getByText(/최근 4개월의 기록은 있지만/u)).toBeVisible()
    expect(screen.getByText("집계 사용 0건 · 집계 제외 2건")).toBeVisible()
    expect(screen.queryByRole("button", { name: "운동 기록하기" })).not.toBeInTheDocument()
    expect(screen.queryByText("월별 수치와 집계 범위 보기")).not.toBeInTheDocument()
  })

  it("preserves an observed zero and restores its chart when switching away from a missing metric", () => {
    const observedZero: TrendBucket = {
      kind: "DATA", label: "2026-08", n: 1, median: 0, min: 0, max: 0, unit: "PAIN_5",
      sourceRefs: [sourceRef], confidence: null, uncertaintyState: "NONE", displayStatus: "OBSERVED",
      nonSensitiveReasonCodes: ["STRUCTURED_OBSERVATION"],
    }
    vi.mocked(bucketByMonth).mockImplementation((_observations, _today, _count, metric) => metric === "PAIN_MAX" ? [observedZero] : missingBuckets)
    vi.mocked(summarizeMetricCoverage).mockImplementation((_observations, metric) => ({ included: metric === "PAIN_MAX" ? 1 : 0, excluded: 0 }))
    render(<MonthlyTrendSection observations={[]} today="2026-09-21" />)

    expect(screen.queryByTestId("monthly-trend-bars")).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "통증" }))
    expect(screen.getByRole("button", { name: "통증" })).toHaveAttribute("aria-pressed", "true")
    expect(screen.getByTestId("monthly-trend-bars")).toBeVisible()
    fireEvent.click(screen.getByRole("button", { name: "월별 수치와 집계 범위 보기" }))
    expect(screen.getByText("8월 중앙 통증 0/5")).toBeVisible()
    fireEvent.click(screen.getByRole("button", { name: "페이스" }))
    expect(screen.queryByTestId("monthly-trend-bars")).not.toBeInTheDocument()
  })

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
