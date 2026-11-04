import { cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { buildFileObservation, type FileObservationInput } from "../domain/import/file-observation"
import { toImportedEntry } from "../domain/import/import-draft"
import { setActiveLocalAccount } from "../domain/account/local-journal-ownership"
import { resetAccountJournalProjection } from "../domain/account/account-journal-projection"
import { LogDetail } from "../screens/LogDetail"
import { ImportedActivityDetail } from "./ImportedActivityDetail"
import { parseActivityFile } from "../domain/import/activity-file"

function observation(patch: Partial<FileObservationInput> = {}) {
  return buildFileObservation({
    format: "tcx", sourceProfile: "TCX_ACTIVITY_V1", parserVersion: "synthetic-v1", sourceActivityId: "synthetic-running",
    date: "2026-10-31", startedAt: "2026-10-30T23:15:30.125-04:00", timeZone: "Asia/Seoul", sport: "RUNNING",
    distanceMeters: 5000, durationSeconds: 1500, durationMeaning: "SOURCE_DEFINED",
    laps: [{ sourceIndex: 0, distanceMeters: 5000, durationSeconds: 1500, durationMeaning: "SOURCE_DEFINED", kind: "UNKNOWN" }],
    confirmation: { durationMeaning: null, sport: null }, ...patch,
  })
}

afterEach(() => { cleanup(); vi.restoreAllMocks(); setActiveLocalAccount(null); resetAccountJournalProjection(null) })
const openView = (name: string) => fireEvent.click(screen.getByRole("tab", { name }))

describe("stored imported activity detail", () => {
  it("separates declared origins from file delivery without implying provider authentication", () => {
    const source = observation({ dataLineage: {
      schemaVersion: "PROVIDER_DATA_LINEAGE_V1",
      sources: [
        { sourceId: "declared-garmin", originProvider: "GARMIN", transport: "FILE_UPLOAD", assurance: "USER_DECLARED" },
        { sourceId: "declared-coros", originProvider: "COROS", transport: "FILE_UPLOAD", assurance: "USER_DECLARED" },
      ],
      fieldSources: { distanceMeters: ["declared-garmin"], durationSeconds: ["declared-coros"] },
    } })
    const before = JSON.stringify(source)
    const view = render(<ImportedActivityDetail observation={source} />)
    expect(screen.getByText("파일에서 가져옴 · TCX")).toBeVisible()
    expect(screen.getByText("표기된 원천").nextElementSibling).toHaveTextContent("Garmin · COROS")
    expect(screen.getByText("원천은 기록에 저장된 표기이며, 제공자 인증 여부를 뜻하지 않아요.")).toBeVisible()
    expect(screen.queryByText(/인증된 기기|자동 연동|AI 허용/u)).toBeNull()
    expect(JSON.stringify(source)).toBe(before)
    view.rerender(<ImportedActivityDetail observation={observation()} />)
    expect(screen.getByText("표기된 원천").nextElementSibling).toHaveTextContent("원천 미확인")
    expect(screen.queryByText("Garmin · COROS")).toBeNull()
  })

  it("keeps the file clock and offset separate from journal date, zone, and athlete confirmations without writing", () => {
    const source = observation({ sport: "UNKNOWN", confirmation: { durationMeaning: "TIMER", sport: "RUNNING" } })
    const before = JSON.stringify(source)
    const write = vi.spyOn(Storage.prototype, "setItem")
    render(<ImportedActivityDetail observation={source} />)
    const panel = screen.getByRole("region", { name: "파일 기록 상세" })
    const clock = within(panel).getByText("2026-10-30 23:15:30.125 UTC-04:00")
    expect(clock).toHaveAttribute("datetime", source.startedAt)
    expect(within(panel).getByText("2026-10-31")).toHaveAttribute("datetime", "2026-10-31")
    expect(within(panel).getByText("Asia/Seoul")).toBeVisible()
    expect(within(panel).getByText("원본 시간", { selector: "dt" }).nextElementSibling).toHaveTextContent("파일 시간 · 종류 미지정")
    expect(within(panel).getByText("내가 확인한 시간").nextElementSibling).toHaveTextContent("타이머 시간 · 일시정지 제외")
    expect(within(panel).getByText("파일의 운동 종류").nextElementSibling).toHaveTextContent("종류 미확인")
    expect(within(panel).getByText("내가 확인한 운동").nextElementSibling).toHaveTextContent("달리기")
    expect(write).not.toHaveBeenCalled()
    expect(JSON.stringify(source)).toBe(before)
  })

  it("renders original lap order, missing values and genuine zeros without replacing lap meanings or calculating pace", () => {
    const source = observation({ distanceMeters: null, durationSeconds: null, confirmation: { durationMeaning: "TIMER", sport: null },
      laps: [
        { sourceIndex: 0, distanceMeters: 0, durationSeconds: 0, durationMeaning: "TIMER", kind: "RECOVERY" },
        { sourceIndex: 1, distanceMeters: 50, durationSeconds: null, durationMeaning: "SOURCE_DEFINED", kind: "UNKNOWN" },
        { sourceIndex: 2, distanceMeters: null, durationSeconds: 65.125, durationMeaning: "MOVING", kind: "WORK" },
      ],
    })
    render(<ImportedActivityDetail observation={source} />)
    openView("구간")
    const rows = within(screen.getByRole("table", { name: "파일의 구간 기록 · 원본 순서" })).getAllByRole("row").slice(1)
    expect(rows).toHaveLength(3)
    expect(within(rows[0]!).getByRole("rowheader")).toHaveTextContent("1회복")
    expect(rows[0]).toHaveTextContent("0m")
    expect(rows[0]).toHaveTextContent("0초타이머 시간")
    expect(rows[1]).toHaveTextContent("2종류 미지정50m미기록종류 미지정")
    expect(rows[2]).toHaveTextContent("3운동미기록1분 5.125초이동 시간")
    expect(screen.getByText(/거리 미기록 1개 · 시간 미기록 1개/u)).toBeVisible()
    expect(screen.getByText(/전체 시간에 고른 기준과 구간 원본/u)).toBeVisible()
    expect(screen.queryByText(/\/km/u)).toBeNull()
  })

  it("shows unconfirmed time and absent start/zone without inventing a clock, pace or segments", () => {
    const source = observation({ format: "csv", sourceProfile: "CSV_COLUMNS_V1", startedAt: null, timeZone: null, laps: [],
      confirmation: { durationMeaning: null, sport: null } })
    render(<ImportedActivityDetail observation={source} />)
    expect(screen.getByText("정확한 시작 시각 미기록")).toBeVisible()
    expect(screen.getByText("지역 시간대 미확인 · 파일 날짜 유지")).toBeVisible()
    expect(screen.getByText("시간 종류가 미확정이라 시간 비교와 페이스 계산은 보류해요.")).toBeVisible()
    openView("구간")
    expect(screen.getByRole("heading", { name: "구간 기록이 없어요" })).toBeVisible()
    expect(screen.queryByRole("table")).toBeNull()
    expect(screen.queryByText("내가 확인한 시간")).toBeNull()
    expect(screen.queryByText("내가 확인한 운동")).toBeNull()
  })

  it("keeps an explicit UTC offset instead of the viewer's timezone", () => {
    render(<ImportedActivityDetail observation={observation({ startedAt: "2026-10-31T00:15:00Z", timeZone: "UTC" })} />)
    expect(screen.getByText("2026-10-31 00:15:00 UTC+00:00")).toBeVisible()
    expect(screen.getByText("UTC", { exact: true })).toBeVisible()
  })

  it("renders at most twenty new laps per action and resets pagination for another source", () => {
    const laps = Array.from({ length: 1000 }, (_, sourceIndex) => ({
      sourceIndex, distanceMeters: 50, durationSeconds: 10, durationMeaning: "SOURCE_DEFINED" as const, kind: "UNKNOWN" as const,
    }))
    const source = observation({ laps, distanceMeters: 50000, durationSeconds: 10000 })
    const view = render(<ImportedActivityDetail observation={source} />)
    openView("구간")
    expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(21)
    expect(screen.getByText("전체 1000개 중 20개 표시")).toBeVisible()
    fireEvent.click(screen.getByRole("button", { name: "구간 20개 더 보기" }))
    expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(41)
    expect(screen.getByText("전체 1000개 중 40개 표시")).toBeVisible()
    view.rerender(<ImportedActivityDetail observation={observation({ sourceActivityId: "synthetic-other", laps, distanceMeters: 50000, durationSeconds: 10000 })} />)
    expect(screen.getByRole("tab", { name: "요약" })).toHaveAttribute("aria-selected", "true")
    openView("구간")
    expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(21)
    expect(source.laps).toHaveLength(1000)
  })

  it("shows the remaining lap count and removes the completed pagination action", () => {
    const laps = Array.from({ length: 21 }, (_, sourceIndex) => ({
      sourceIndex, distanceMeters: 0, durationSeconds: 0, durationMeaning: "UNKNOWN" as const, kind: "UNKNOWN" as const,
    }))
    render(<ImportedActivityDetail observation={observation({ laps, distanceMeters: 0, durationSeconds: 0 })} />)
    openView("구간")
    fireEvent.click(screen.getByRole("button", { name: "구간 1개 더 보기" }))
    expect(screen.getByText("전체 21개 중 21개 표시")).toBeVisible()
    expect(screen.queryByRole("button")).toBeNull()
  })

  it("is reachable in the actual exact journal detail without changing its stored observation or existing metrics", () => {
    const source = observation()
    const entry = { ...toImportedEntry({ date: source.date, name: "Synthetic", sport: "Running", distanceKm: "5", durationMin: "25", avgPace: "", observation: source }, "tcx", { includeFileObservation: true }),
      id: "synthetic-detail-entry", savedAt: "2026-10-31T12:00:00Z" }
    const before = JSON.stringify(entry)
    const write = vi.spyOn(Storage.prototype, "setItem")
    render(<LogDetail date={source.date} entries={[entry]} readComplete readOnly initialEntryId={entry.id} />)
    const detail = screen.getByRole("region", { name: "파일 기록 상세" })
    expect(within(detail).getByText("2026-10-30 23:15:30.125 UTC-04:00")).toBeVisible()
    expect(within(detail).queryByText(/12:00/u)).toBeNull()
    expect(screen.getByText("파일 시간 · 종류 미확인", { exact: true })).toBeVisible()
    openView("구간")
    expect(screen.getByRole("table")).toBeVisible()
    expect(screen.queryByRole("button", { name: /저장|정정|삭제/u })).toBeNull()
    expect(write).not.toHaveBeenCalled()
    expect(JSON.stringify(entry)).toBe(before)
  })

  it("consumes actual TCX sensor output with timestamp spacing, null and track gaps and exact original values", () => {
    const result = parseActivityFile(`<TrainingCenterDatabase><Activities><Activity Sport="Running">
      <Id>2026-11-04T00:00:00Z</Id><Creator><Name>Garmin Synthetic</Name></Creator>
      <Lap StartTime="2026-11-04T00:00:00Z"><TotalTimeSeconds>20</TotalTimeSeconds><DistanceMeters>50</DistanceMeters>
        <AverageHeartRateBpm><Value>120</Value></AverageHeartRateBpm><TriggerMethod>Manual</TriggerMethod>
        <Track>
          <Trackpoint><Time>2026-11-04T00:00:00Z</Time><HeartRateBpm><Value>100</Value></HeartRateBpm></Trackpoint>
          <Trackpoint><Time>2026-11-04T00:00:01Z</Time><HeartRateBpm><Value>0</Value></HeartRateBpm></Trackpoint>
          <Trackpoint><Time>2026-11-04T00:00:09Z</Time></Trackpoint>
          <Trackpoint><Time>2026-11-04T00:00:10Z</Time><HeartRateBpm><Value>140</Value></HeartRateBpm></Trackpoint>
        </Track><Track>
          <Trackpoint><Time>2026-11-04T00:00:20Z</Time><HeartRateBpm><Value>150</Value></HeartRateBpm></Trackpoint>
          <Trackpoint><HeartRateBpm><Value>160</Value></HeartRateBpm></Trackpoint>
        </Track>
      </Lap></Activity></Activities></TrainingCenterDatabase>`, "UTC")
    const source = result.activities[0]!.observation!
    expect(source.detail?.samples).toHaveLength(6)
    const before = JSON.stringify(source)
    const write = vi.spyOn(Storage.prototype, "setItem")
    render(<ImportedActivityDetail observation={source} />)
    expect(screen.getByText("표기된 원천").nextElementSibling).toHaveTextContent("Garmin")
    openView("차트")
    const path = screen.getByTestId("activity-sensor-path").getAttribute("d")!
    expect(path.match(/M/g)).toHaveLength(3)
    expect(path).toContain("L59.000,190.000") // One second is 1/20 of the actual domain, not one array step.
    expect(screen.getByRole("img")).toHaveAccessibleName(/측정값 4개.*최고 150 bpm.*2개는/u)
    fireEvent.click(screen.getByText("표로 보기"))
    const table = screen.getByRole("table", { name: "심박수 원본 표본" })
    expect(table).toHaveTextContent("0 bpm")
    expect(table).toHaveTextContent("미기록")
    expect(table).toHaveTextContent("시각 미기록160 bpm")
    fireEvent.click(screen.getByRole("button", { name: "다음 표본" }))
    expect(screen.getByLabelText("센서 표본 선택")).toHaveValue("1")
    openView("요약"); openView("차트")
    expect(screen.getByLabelText("센서 표본 선택")).toHaveValue("1")
    openView("구간")
    expect(screen.queryByRole("button", { name: "구간 1 차트 보기" })).toBeNull() // TCX has no explicit lap end.
    fireEvent.click(screen.getByText("표시 중인 구간의 추가 수치"))
    expect(screen.getByRole("table", { name: "구간 1 원본 수치" })).toHaveTextContent("심박수 · 평균")
    expect(write).not.toHaveBeenCalled()
    expect(JSON.stringify(source)).toBe(before)
  })

  it("links only evidenced lap boundaries, retains missing-clock breaks and resets activity-specific view state", () => {
    const source = observation({ detail: {
      schemaVersion: 1, source: { originProvider: "UNKNOWN", evidence: "FILE_METADATA", manufacturer: null, product: null, namespace: null },
      summary: [{ metric: "temperatureCelsius", statistic: "MINIMUM", value: -2.125, sourceField: "session.min_temperature" },
        { metric: "powerWatts", statistic: "AVERAGE", value: 0, sourceField: "session.avg_power" }],
      laps: [{ sourceIndex: 0, startTime: "2026-11-04T00:00:00Z", endTime: "2026-11-04T00:00:20Z", trigger: null, summary: [] }],
      samples: [
        { sourceIndex: 0, timestamp: "2026-11-04T00:00:00Z", segmentIndex: 0, lapIndex: 0, metrics: { heartRateBpm: 110 }, position: null },
        { sourceIndex: 1, timestamp: null, segmentIndex: 0, lapIndex: 0, metrics: { heartRateBpm: 120 }, position: null },
        { sourceIndex: 2, timestamp: "2026-11-04T00:00:20Z", segmentIndex: 0, lapIndex: 0, metrics: { heartRateBpm: 130 }, position: null },
      ], events: [],
    } })
    const view = render(<ImportedActivityDetail observation={source} />)
    fireEvent.keyDown(screen.getByRole("tab", { name: "요약" }), { key: "ArrowRight" })
    expect(screen.getByRole("tab", { name: "전체 수치" })).toHaveFocus()
    expect(screen.getByRole("table", { name: "파일이 제공한 요약 수치" })).toHaveTextContent("-2.125 °C")
    expect(screen.getByRole("table", { name: "파일이 제공한 요약 수치" })).toHaveTextContent("0 W")
    openView("구간")
    fireEvent.click(screen.getByRole("button", { name: "구간 1 차트 보기" }))
    expect(screen.getByRole("tab", { name: "차트" })).toHaveFocus()
    expect(screen.getByText("구간 1의 원본 시작·종료 시각 범위")).toBeVisible()
    expect(screen.getByTestId("activity-sensor-path").getAttribute("d")!.match(/M/g)).toHaveLength(2)
    fireEvent.click(screen.getByRole("button", { name: "전체 범위 보기" }))
    expect(screen.getByLabelText("센서 표본 선택")).toHaveAttribute("max", "2")
    view.rerender(<ImportedActivityDetail observation={observation({ sourceActivityId: "another-source" })} />)
    expect(screen.getByRole("tab", { name: "요약" })).toHaveAttribute("aria-selected", "true")
    openView("차트")
    expect(screen.getByRole("heading", { name: "센서 표본이 없어요" })).toBeVisible()
    expect(screen.queryByRole("img")).toBeNull()
  })

  it("reduces only the drawing while preserving extrema, gaps and paged original samples", () => {
    const samples = Array.from({ length: 6000 }, (_, sourceIndex) => ({
      sourceIndex, timestamp: new Date(Date.UTC(2026, 10, 4) + sourceIndex * 10).toISOString(), segmentIndex: 0, lapIndex: 0,
      metrics: { heartRateBpm: sourceIndex === 3000 ? null : sourceIndex === 3 ? 999 : 100 + sourceIndex % 7 }, position: null,
    }))
    const source = observation({ detail: { schemaVersion: 1,
      source: { originProvider: "UNKNOWN", evidence: "FILE_METADATA", manufacturer: null, product: null, namespace: null },
      summary: [], samples, laps: [{ sourceIndex: 0, startTime: null, endTime: null, trigger: null, summary: [] }], events: [],
    } })
    const before = JSON.stringify(source)
    render(<ImportedActivityDetail observation={source} />)
    openView("차트")
    expect(screen.getByText(/표시용 요약/u)).toBeVisible()
    expect(screen.getByRole("img")).toHaveAccessibleName(/측정값 5999개.*최고 999 bpm/u)
    const path = screen.getByTestId("activity-sensor-path").getAttribute("d")!
    expect(path.match(/M/g)).toHaveLength(2)
    expect(path).toMatch(/,10\.000/u)
    fireEvent.click(screen.getByText("표로 보기"))
    expect(within(screen.getByRole("table", { name: "심박수 원본 표본" })).getAllByRole("row")).toHaveLength(20)
    expect(screen.getByRole("table", { name: "심박수 원본 표본" })).toHaveTextContent("999 bpm")
    fireEvent.click(screen.getByRole("button", { name: "다음 표본 표" }))
    expect(screen.getByRole("table", { name: "심박수 원본 표본" })).toHaveTextContent("표본 21")
    expect(screen.getByText("전체 6000개 중 21–40개 표시")).toBeVisible()
    expect(JSON.stringify(source)).toBe(before)
  })
})
