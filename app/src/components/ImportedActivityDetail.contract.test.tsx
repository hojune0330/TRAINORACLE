import { cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { buildFileObservation, type FileObservationInput } from "../domain/import/file-observation"
import { toImportedEntry } from "../domain/import/import-draft"
import { setActiveLocalAccount } from "../domain/account/local-journal-ownership"
import { resetAccountJournalProjection } from "../domain/account/account-journal-projection"
import { LogDetail } from "../screens/LogDetail"
import { ImportedActivityDetail } from "./ImportedActivityDetail"

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
    expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(21)
    expect(screen.getByText("전체 1000개 중 20개 표시")).toBeVisible()
    fireEvent.click(screen.getByRole("button", { name: "구간 20개 더 보기" }))
    expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(41)
    expect(screen.getByText("전체 1000개 중 40개 표시")).toBeVisible()
    view.rerender(<ImportedActivityDetail observation={observation({ sourceActivityId: "synthetic-other", laps, distanceMeters: 50000, durationSeconds: 10000 })} />)
    expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(21)
    expect(source.laps).toHaveLength(1000)
  })

  it("shows the remaining lap count and removes the completed pagination action", () => {
    const laps = Array.from({ length: 21 }, (_, sourceIndex) => ({
      sourceIndex, distanceMeters: 0, durationSeconds: 0, durationMeaning: "UNKNOWN" as const, kind: "UNKNOWN" as const,
    }))
    render(<ImportedActivityDetail observation={observation({ laps, distanceMeters: 0, durationSeconds: 0 })} />)
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
    expect(screen.getByRole("table")).toBeVisible()
    expect(screen.queryByRole("button", { name: /저장|정정|삭제/u })).toBeNull()
    expect(write).not.toHaveBeenCalled()
    expect(JSON.stringify(entry)).toBe(before)
  })
})
