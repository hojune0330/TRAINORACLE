import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { TrendBucket } from "../../domain/trend-analysis"
import type { StructuredJournalObservation } from "../../domain/journal-observation"
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
vi.mock("../../navigation/browserNavigation", () => ({
  registerBrowserBackLayer: vi.fn(({ onClose }: { onClose: () => void }) => ({ close: onClose, dispose: vi.fn() })),
}))

import { bucketByMonth, summarizeMetricCoverage } from "../../domain/trend-analysis"
import { registerBrowserBackLayer } from "../../navigation/browserNavigation"

afterEach(cleanup)
beforeEach(() => vi.clearAllMocks())

function chooseMetric(label: string): void {
  fireEvent.click(screen.getByRole("button", { name: /^지표 선택:/u }))
  fireEvent.click(screen.getByRole("button", { name: label }))
}

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

    expect(screen.getByText("일지에 남긴 거리 값으로 최근 4개월의 변화를 볼 수 있어요.")).toBeVisible()
    expect(screen.queryByTestId("monthly-trend-bars")).not.toBeInTheDocument()
    expect(screen.queryByText("월별 수치와 집계 범위 보기")).not.toBeInTheDocument()
    expect(screen.queryByText(/집계 가능한 기록이 없어요/u)).not.toBeInTheDocument()
    expect(screen.queryByText(/집계 사용 0건/u)).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "지표 선택: 거리" })).toBeVisible()
    fireEvent.click(screen.getByRole("button", { name: "운동 기록하기" }))
    expect(onWriteLog).toHaveBeenCalledOnce()
    chooseMetric("페이스")
    fireEvent.click(screen.getByRole("button", { name: "운동 기록하기" }))
    expect(onWriteLog).toHaveBeenCalledTimes(2)
    for (const metric of ["기분", "통증"]) {
      chooseMetric(metric)
      expect(screen.queryByRole("button", { name: "운동 기록하기" })).not.toBeInTheDocument()
      fireEvent.click(screen.getByRole("button", { name: "몸 상태 기록하기" }))
    }
    expect(onWriteRecovery).toHaveBeenCalledTimes(2)
    expect(onWriteLog).toHaveBeenCalledTimes(2)
    rerender(<MonthlyTrendSection observations={[]} today="2026-09-21" onWriteLog={onWriteLog} />)
    expect(screen.queryByRole("button", { name: /기록하기/u })).not.toBeInTheDocument()
    rerender(<MonthlyTrendSection observations={[]} today="2026-09-21" onWriteRecovery={onWriteRecovery} />)
    chooseMetric("페이스")
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
    render(<MonthlyTrendSection observations={[]} today="2026-09-21" initialMetric="SECONDS_PER_KM" />)

    expect(screen.queryByTestId("monthly-trend-bars")).not.toBeInTheDocument()
    chooseMetric("통증")
    expect(screen.getByRole("button", { name: "지표 선택: 통증" })).toHaveAttribute("aria-expanded", "false")
    expect(screen.getByTestId("monthly-trend-bars")).toBeVisible()
    fireEvent.click(screen.getByRole("button", { name: "월별 수치와 집계 범위 보기" }))
    expect(screen.getByText("8월 중앙 통증 0/5")).toBeVisible()
    chooseMetric("페이스")
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

    expect(screen.getByRole("button", { name: "지표 선택: 거리" })).toHaveAttribute("aria-expanded", "false")
    fireEvent.click(screen.getByRole("button", { name: "지표 선택: 거리" }))
    expect(screen.getByRole("button", { name: "거리" })).toHaveAttribute("aria-pressed", "true")
    expect(screen.getByRole("button", { name: "페이스" })).toHaveAttribute("aria-pressed", "false")
  })

  it.each([
    [["DISTANCE_KM", "SECONDS_PER_KM"], "거리"],
    [["SECONDS_PER_KM", "MOOD"], "페이스"],
    [["MOOD", "PAIN_MAX"], "기분"],
    [["PAIN_MAX"], "통증"],
    [[], "거리"],
  ] as const)("starts with the first available metric in %j", (available, label) => {
    vi.mocked(bucketByMonth).mockImplementation((_observations, _today, _count, metric) => (
      available.some(item => item === metric) ? buckets : missingBuckets
    ))
    vi.mocked(summarizeMetricCoverage).mockReturnValue({ included: 0, excluded: 0 })
    render(<MonthlyTrendSection observations={[]} today="2026-09-21" initialMetric="invalid" />)

    expect(screen.getByRole("button", { name: `지표 선택: ${label}` })).toBeVisible()
  })

  it("keeps a user's missing metric through data updates and synchronizes a new explicit context", () => {
    vi.mocked(bucketByMonth).mockImplementation((_observations, _today, _count, metric) => metric === "DISTANCE_KM" ? buckets : missingBuckets)
    vi.mocked(summarizeMetricCoverage).mockReturnValue({ included: 0, excluded: 0 })
    const onMetricChange = vi.fn()
    const { rerender } = render(<MonthlyTrendSection observations={[]} today="2026-09-21" onMetricChange={metric => onMetricChange(metric)} />)

    expect(onMetricChange).toHaveBeenCalledExactlyOnceWith("DISTANCE_KM")
    chooseMetric("기분")
    expect(onMetricChange).toHaveBeenLastCalledWith("MOOD")
    rerender(<MonthlyTrendSection observations={[]} today="2026-09-22" onMetricChange={metric => onMetricChange(metric)} />)
    expect(screen.getByRole("button", { name: "지표 선택: 기분" })).toBeVisible()
    expect(onMetricChange).toHaveBeenCalledTimes(2)

    rerender(<MonthlyTrendSection observations={[]} today="2026-09-22" initialMetric="SECONDS_PER_KM" onMetricChange={metric => onMetricChange(metric)} />)
    expect(screen.getByRole("button", { name: "지표 선택: 페이스" })).toBeVisible()
    expect(onMetricChange).toHaveBeenLastCalledWith("SECONDS_PER_KM")
    expect(onMetricChange).toHaveBeenCalledTimes(3)
  })

  it("focuses the selected button and lets arrow keys wrap focus without selecting or closing", async () => {
    const user = userEvent.setup()
    vi.mocked(bucketByMonth).mockReturnValue(missingBuckets)
    vi.mocked(summarizeMetricCoverage).mockReturnValue({ included: 0, excluded: 0 })
    const onMetricChange = vi.fn()
    render(<MonthlyTrendSection observations={[]} today="2026-09-21" initialMetric="MOOD" onMetricChange={onMetricChange} />)
    onMetricChange.mockClear()
    const trigger = screen.getByRole("button", { name: "지표 선택: 기분" })
    await user.click(trigger)
    const sheet = screen.getByRole("dialog", { name: "볼 지표 선택" })
    expect(trigger).toHaveAttribute("aria-expanded", "true")
    expect(within(sheet).getByRole("button", { name: "기분" })).toHaveFocus()
    expect(within(sheet).getAllByRole("button", { pressed: false })).toHaveLength(3)
    expect(within(sheet).queryByRole("radio")).not.toBeInTheDocument()
    expect(within(sheet).queryByRole("button", { name: "적용" })).not.toBeInTheDocument()
    expect(registerBrowserBackLayer).toHaveBeenCalledWith(expect.objectContaining({ canClose: expect.any(Function), onClose: expect.any(Function) }))

    for (const label of ["통증", "거리", "페이스", "기분"]) {
      await user.keyboard("{ArrowDown}")
      expect(within(sheet).getByRole("button", { name: label })).toHaveFocus()
    }
    for (const label of ["페이스", "거리", "통증", "기분"]) {
      await user.keyboard("{ArrowUp}")
      expect(within(sheet).getByRole("button", { name: label })).toHaveFocus()
    }
    expect(within(sheet).getByRole("button", { name: "기분" })).toHaveAttribute("aria-pressed", "true")
    expect(onMetricChange).not.toHaveBeenCalled()
    expect(sheet).toBeVisible()
    expect(trigger).toHaveAttribute("aria-expanded", "true")
  })

  it("keeps every metric button and the close control in the Tab and Shift+Tab loop", async () => {
    const user = userEvent.setup()
    vi.mocked(bucketByMonth).mockReturnValue(missingBuckets)
    vi.mocked(summarizeMetricCoverage).mockReturnValue({ included: 0, excluded: 0 })
    const onMetricChange = vi.fn()
    render(<MonthlyTrendSection observations={[]} today="2026-09-21" onMetricChange={onMetricChange} />)
    onMetricChange.mockClear()
    await user.click(screen.getByRole("button", { name: "지표 선택: 거리" }))
    const sheet = screen.getByRole("dialog", { name: "볼 지표 선택" })
    for (const label of ["페이스", "기분", "통증", "지표 선택 닫기", "거리"]) {
      await user.tab()
      expect(within(sheet).getByRole("button", { name: label })).toHaveFocus()
    }
    for (const label of ["지표 선택 닫기", "통증", "기분", "페이스", "거리"]) {
      await user.tab({ shift: true })
      expect(within(sheet).getByRole("button", { name: label })).toHaveFocus()
    }
    expect(onMetricChange).not.toHaveBeenCalled()
    expect(sheet).toBeVisible()
  })

  it.each(["{Enter}", " "])("applies the focused metric with %j and immediately closes with trigger focus", async key => {
    const user = userEvent.setup()
    vi.mocked(bucketByMonth).mockReturnValue(missingBuckets)
    vi.mocked(summarizeMetricCoverage).mockReturnValue({ included: 0, excluded: 0 })
    const onMetricChange = vi.fn()
    render(<MonthlyTrendSection observations={[]} today="2026-09-21" onMetricChange={onMetricChange} />)
    onMetricChange.mockClear()
    const trigger = screen.getByRole("button", { name: "지표 선택: 거리" })
    await user.click(trigger)
    await user.keyboard("{ArrowDown}")
    expect(screen.getByRole("button", { name: "페이스" })).toHaveFocus()
    await user.keyboard(key)
    expect(onMetricChange).toHaveBeenCalledExactlyOnceWith("SECONDS_PER_KM")
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
    expect(trigger).toHaveAccessibleName("지표 선택: 페이스")
    expect(trigger).toHaveAttribute("aria-expanded", "false")
    await user.click(trigger)
    expect(screen.getByRole("button", { name: "페이스" })).toHaveFocus()
    expect(screen.getByRole("button", { name: "페이스" })).toHaveAttribute("aria-pressed", "true")
  })

  it("applies a clicked metric and closes even when clicking the already selected metric", async () => {
    const user = userEvent.setup()
    vi.mocked(bucketByMonth).mockReturnValue(missingBuckets)
    vi.mocked(summarizeMetricCoverage).mockReturnValue({ included: 0, excluded: 0 })
    const onMetricChange = vi.fn()
    render(<MonthlyTrendSection observations={[]} today="2026-09-21" onMetricChange={onMetricChange} />)
    onMetricChange.mockClear()
    const trigger = screen.getByRole("button", { name: "지표 선택: 거리" })
    await user.click(trigger)
    await user.click(screen.getByRole("button", { name: "통증" }))
    expect(onMetricChange).toHaveBeenCalledExactlyOnceWith("PAIN_MAX")
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
    expect(trigger).toHaveAccessibleName("지표 선택: 통증")
    await user.click(trigger)
    await user.click(screen.getByRole("button", { name: "통증" }))
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
    expect(onMetricChange).toHaveBeenCalledTimes(1)
  })

  it.each(["close", "Escape", "cancel", "Back", "backdrop"])("cancels with %s while preserving the selected metric and restoring focus", async method => {
    const user = userEvent.setup()
    vi.mocked(bucketByMonth).mockReturnValue(missingBuckets)
    vi.mocked(summarizeMetricCoverage).mockReturnValue({ included: 0, excluded: 0 })
    const onMetricChange = vi.fn()
    render(<MonthlyTrendSection observations={[]} today="2026-09-21" initialMetric="MOOD" onMetricChange={onMetricChange} />)
    onMetricChange.mockClear()
    const trigger = screen.getByRole("button", { name: "지표 선택: 기분" })
    await user.click(trigger)
    const sheet = screen.getByRole("dialog", { name: "볼 지표 선택" })
    await user.keyboard("{ArrowUp}")
    expect(within(sheet).getByRole("button", { name: "페이스" })).toHaveFocus()
    if (method === "close") await user.click(within(sheet).getByRole("button", { name: "지표 선택 닫기" }))
    else if (method === "Escape") await user.keyboard("{Escape}")
    else if (method === "cancel") fireEvent(sheet, new Event("cancel", { cancelable: true }))
    else if (method === "Back") act(() => { vi.mocked(registerBrowserBackLayer).mock.lastCall?.[0].onClose() })
    else fireEvent.click(sheet)
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
    expect(trigger).toHaveAccessibleName("지표 선택: 기분")
    expect(trigger).toHaveAttribute("aria-expanded", "false")
    expect(onMetricChange).not.toHaveBeenCalled()
    await user.click(trigger)
    expect(screen.getByRole("button", { name: "기분" })).toHaveFocus()
    expect(screen.getByRole("button", { name: "기분" })).toHaveAttribute("aria-pressed", "true")
  })

  it("keeps distance examples explicit and offers metric-appropriate recording and import actions", () => {
    vi.mocked(bucketByMonth).mockReturnValue(missingBuckets)
    vi.mocked(summarizeMetricCoverage).mockReturnValue({ included: 0, excluded: 0 })
    const onShowExample = vi.fn(), onOpenImport = vi.fn(), onWriteRecovery = vi.fn()
    render(<MonthlyTrendSection observations={[]} today="2026-09-21" initialMetric="SECONDS_PER_KM"
      onShowExample={onShowExample} onOpenImport={onOpenImport} onWriteRecovery={onWriteRecovery} />)
    fireEvent.click(screen.getByRole("button", { name: "거리 예시 보기" }))
    expect(onShowExample).toHaveBeenCalledOnce()
    expect(screen.queryByRole("button", { name: "페이스 예시 보기" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "운동 파일 가져오기" })).not.toBeInTheDocument()
    chooseMetric("거리")
    fireEvent.click(screen.getByRole("button", { name: "운동 파일 가져오기" }))
    expect(onOpenImport).toHaveBeenCalledOnce()
    chooseMetric("페이스")
    expect(screen.queryByRole("button", { name: "운동 파일 가져오기" })).not.toBeInTheDocument()
    for (const label of ["기분", "통증"]) {
      chooseMetric(label)
      expect(screen.getByRole("button", { name: "거리 예시 보기" })).toBeVisible()
      expect(screen.queryByRole("button", { name: "운동 파일 가져오기" })).not.toBeInTheDocument()
      fireEvent.click(screen.getByRole("button", { name: "몸 상태 기록하기" }))
    }
    expect(onWriteRecovery).toHaveBeenCalledTimes(2)
    expect(onOpenImport).toHaveBeenCalledOnce()
  })

  it("shows a file-pace exclusion only when a file pace value was actually excluded", () => {
    vi.mocked(bucketByMonth).mockReturnValue(missingBuckets)
    vi.mocked(summarizeMetricCoverage).mockReturnValue({ included: 0, excluded: 2 })
    const observation: StructuredJournalObservation = {
      sourceRef, loggedOn: "2026-08-20", distanceKm: 8, durationMin: 40, secondsPerKm: 300,
      rpe: null, mood: null, painMax: null, painSourceLevels: [], derivationRefs: [],
      fieldProvenance: { distanceKm: "MISSING", durationMin: "MISSING", secondsPerKm: "LEGACY_MISSING_PROVENANCE", rpe: "MISSING", mood: "MISSING", painMax: "MISSING" },
    }
    const { rerender } = render(<MonthlyTrendSection observations={[observation]} today="2026-09-21" initialMetric="SECONDS_PER_KM" />)
    expect(screen.queryByText(/파일 페이스 제외/u)).not.toBeInTheDocument()
    rerender(<MonthlyTrendSection observations={[{ ...observation, fieldProvenance: { ...observation.fieldProvenance, secondsPerKm: "FILE" } }]}
      today="2026-09-21" initialMetric="SECONDS_PER_KM" />)
    expect(screen.getByText("직접 기록 기준 · 파일 페이스 제외")).toBeVisible()
    chooseMetric("거리")
    expect(screen.queryByText(/파일 페이스 제외/u)).not.toBeInTheDocument()
  })

  it("names the distance statistic and presents dated sources while retaining identifiers", () => {
    vi.mocked(bucketByMonth).mockReturnValue(buckets)
    vi.mocked(summarizeMetricCoverage).mockReturnValue({ included: 3, excluded: 0 })
    render(<MonthlyTrendSection observations={[]} today="2026-09-21" initialMetric="DISTANCE_KM" />)
    expect(screen.getByRole("heading", { name: "한 번에 달린 거리" })).toBeVisible()
    expect(screen.getByText("월별 중앙값")).toBeVisible()
    fireEvent.click(screen.getByText("출처 기록 보기"))
    expect(screen.getAllByText("2026년 8월 20일 · 운동 기록 · 출처 확인")[0]).toBeVisible()
    expect(screen.getAllByText("기록 ID: monthly-section-source")[0]).not.toBeVisible()
    fireEvent.click(screen.getAllByText("원본 식별 정보")[0]!)
    expect(screen.getAllByText("기록 ID: monthly-section-source")[0]).toBeVisible()
  })
})
