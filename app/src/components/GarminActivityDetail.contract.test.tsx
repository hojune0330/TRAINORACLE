import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { GarminActivityDetail } from "./GarminActivityDetail"
import { ImportedActivityRoute } from "./ImportedActivityRoute"
import { garminChartSamples, garminSamplesDigest, loadGarminActivitySamples } from "../domain/account/garmin-activity-detail"
import { GARMIN_VERSION, garminItemSchema, type GarminItem, type GarminSample, type GarminTransport } from "../domain/account/garmin-integration"
import { syntheticGarminOwner as owner, syntheticGarminItem as item, syntheticGarminReceipt as receipt } from "./GarminConnectionPanel.test-fixtures"
import { setActiveLocalAccount } from "../domain/account/local-journal-ownership"
import type { ActivityDetailSample } from "../domain/import/file-activity-detail"

const samples: GarminSample[] = [
  { offsetSeconds: 0, heartRateBpm: 0, cadenceSpm: 170, latitude: 0, longitude: 0, clockSeconds: 0, timerSeconds: 0, movingSeconds: 0, totalDistanceMeters: 0, bikeCadenceRpm: 0, swimCadenceSpm: 0, airTemperatureCelsius: -2.5 },
  { offsetSeconds: 1, heartRateBpm: 120, cadenceSpm: 171, latitude: 0, longitude: 0.001 },
  { offsetSeconds: 7, heartRateBpm: null, latitude: null, longitude: null },
  { offsetSeconds: 10, heartRateBpm: 125, latitude: 0.001, longitude: 0.002 },
]
async function example() {
  const hash = await garminSamplesDigest(samples)
  const record: GarminItem = { ...item, state: "CONFIRMED", documentId: receipt.documentId, source: { manual: true, parent: { isParent: true, parentSummaryId: null }, summaryId: "synthetic-summary", lapStartOffsetsSeconds: [0, 10] }, detailManifest: [{ partIndex: 0, sha256: hash, sampleCount: samples.length }] }
  const transport: GarminTransport = async (_owner, request) => ({ ok: true, data: request.action === "read" ? { schemaVersion: GARMIN_VERSION, item: record }
    : { schemaVersion: GARMIN_VERSION, inboxId: record.inboxId, revision: record.revision, partIndex: 0, sha256: hash, sampleCount: samples.length, samples } })
  return { record, transport }
}
beforeEach(() => { setActiveLocalAccount(owner) })
afterEach(() => { cleanup(); setActiveLocalAccount(null); vi.restoreAllMocks() })
describe("server-stored Garmin details and local route", () => {
  it("displays retained vendor summary units and precision, distinguishes absent/null/zero, and rejects unknown fields", async () => {
    const { record } = await example()
    record.source!.summary = { deviceName: "Synthetic Fenix", averageHeartRateInBeatsPerMinute: null, steps: 0,
      averagePaceInMinutesPerKilometer: 0.5975272352046997, averageRunCadenceInStepsPerMinute: 177.5, totalElevationGainInMeters: 12.75 }
    expect(garminItemSchema.safeParse(record).success).toBe(true)
    expect(garminItemSchema.safeParse({ ...record, source: { ...record.source, summary: { ...record.source!.summary, activityName: "private title" } } }).success).toBe(false)
    render(<GarminActivityDetail ownerId={owner} item={record} />)
    expect(screen.getByText("Synthetic Fenix")).toBeInTheDocument()
    fireEvent.click(screen.getByText("기록 정보와 원본 수치", { selector: "summary" }))
    const table = screen.getByRole("table", { name: "Garmin 원본 요약 수치 · 보관 여부 포함" })
    expect(within(table).getByRole("row", { name: /평균 심박수/ })).toHaveTextContent("원본 빈값(null)")
    expect(within(table).getByRole("row", { name: /^스텝 수/ })).toHaveTextContent("0steps")
    expect(within(table).getByRole("row", { name: /평균 페이스/ })).toHaveTextContent("0.5975272352046997min/km")
    expect(within(table).getByRole("row", { name: /평균 달리기 스텝/ })).toHaveTextContent("177.5steps/min")
    expect(within(table).getByRole("row", { name: /활동 칼로리/ })).toHaveTextContent("보관된 값 없음")
  })
  it("reads the exact confirmed document and verified detail chunks without file provenance or inferred units", async () => {
    const { transport } = await example(), call = vi.fn(transport), before = JSON.stringify(samples)
    render(<GarminActivityDetail ownerId={owner} documentId={receipt.documentId} transport={call} />)
    expect(call.mock.calls.map(value => value[1].action)).toEqual(["read"])
    await screen.findByText("계정 일지에 반영된 원본")
    await waitFor(() => expect(screen.queryByText("운동 자료 확인 중…")).not.toBeInTheDocument())
    fireEvent.click(screen.getByRole("tab", { name: "그래프" }))
    expect(screen.getByRole("img", { name: /심박수 차트/ })).toHaveAccessibleName(/측정값 3개/)
    expect(screen.getByTestId("activity-sensor-path").getAttribute("d")!.match(/M/g)).toHaveLength(2)
    fireEvent.click(screen.getByRole("tab", { name: "개요" }))
    expect(screen.getByTestId("activity-route-path").getAttribute("d")!.match(/M/g)).toHaveLength(2)
    expect(screen.getAllByTestId("activity-source-marker")).toHaveLength(2)
    expect(screen.getByRole("option", { name: "원본 자전거 케이던스 · rpm" })).toBeInTheDocument()
    expect(screen.getByRole("option", { name: "원본 수영 케이던스 · spm" })).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText("표시할 지표"), { target: { value: "airTemperatureCelsius" } })
    expect(screen.getByRole("img", { name: /원본 기온 차트/ })).toHaveAccessibleName(/-2.5/)
    fireEvent.change(screen.getByLabelText("표시할 지표"), { target: { value: "cadenceSpm" } })
    expect(screen.getByRole("img", { name: /원본 스텝 케이던스 차트/ })).toHaveAccessibleName(/170/)
    expect(screen.queryByText(/파일에서 가져옴/)).not.toBeInTheDocument()
    expect(call.mock.calls.map(value => value[1].action)).toEqual(["read", "detail"])
    expect(JSON.stringify(samples)).toBe(before)
  })
  it("does not display partial, wrong-digest, changed-revision or unordered chunks", async () => {
    const { record, transport } = await example(), controller = new AbortController()
    const bad: GarminTransport = async (...args) => {
      const result = await transport(...args)
      return result.ok && "samples" in result.data ? { ok: true, data: { ...result.data, samples: [{ ...samples[0]!, heartRateBpm: 999 }, ...samples.slice(1)] } } : result
    }
    expect(await loadGarminActivitySamples(owner, record, controller.signal, () => true, bad)).toEqual({ ok: false, code: "INVALID_RESPONSE" })
    expect(await loadGarminActivitySamples(owner, { ...record, detailManifest: [{ ...record.detailManifest[0]!, partIndex: 1 }] }, controller.signal, () => true, transport)).toEqual({ ok: false, code: "INVALID_RESPONSE" })
    render(<GarminActivityDetail ownerId={owner} item={record} transport={bad} />)
    await screen.findByText("원본 확인을 완료하지 못했어요")
    fireEvent.click(screen.getByRole("tab", { name: "그래프" }))
    expect(screen.queryByRole("img")).not.toBeInTheDocument()
  })
  it("does not substitute a changed source for the original already stored journal", async () => {
    const { record } = await example()
    const transport: GarminTransport = async () => ({ ok: true, data: { schemaVersion: GARMIN_VERSION, item: { ...record, state: "CONFLICT" } } })
    render(<GarminActivityDetail ownerId={owner} documentId={receipt.documentId} transport={transport} />)
    await screen.findByText(/원본 기록이 바뀌었어요/)
    expect(screen.queryByRole("tab")).not.toBeInTheDocument()
  })
  it("breaks missing-clock, missing-position, segment and date-line gaps; 0/0 and stationary points stay visible", () => {
    const base = garminChartSamples(item, samples)
    const points: ActivityDetailSample[] = [base[0]!, base[1]!, { ...base[2]!, position: { latitudeDegrees: 0, longitudeDegrees: 0 }, timestamp: null }, { ...base[3]!, segmentIndex: 1 }]
    const view = render(<ImportedActivityRoute samples={points} />)
    expect(screen.getByTestId("activity-route-path").getAttribute("d")!.match(/M/g)).toHaveLength(3)
    expect(screen.getAllByText(/위도 0 ° · 경도 0 °/).length).toBeGreaterThan(0)
    view.rerender(<ImportedActivityRoute samples={[base[0]!, { ...base[0]!, sourceIndex: 1, timestamp: "2026-11-04T23:30:01Z" }]} />)
    expect(screen.getByRole("img")).toHaveAccessibleName(/모든 좌표가 같은 위치/)
    expect(screen.getByTestId("activity-route-path").getAttribute("d")).toContain("l0.01,0")
    view.rerender(<ImportedActivityRoute samples={[{ ...base[0]!, position: { latitudeDegrees: 10, longitudeDegrees: 179 } }, { ...base[1]!, position: { latitudeDegrees: 10, longitudeDegrees: -179 } }]} />)
    expect(screen.getByTestId("activity-route-path").getAttribute("d")!.match(/M/g)).toHaveLength(2)
  })
  it("keeps coordinate table pagination and every original point without network calls", () => {
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher)
    const all = Array.from({ length: 42 }, (_, i) => ({ sourceIndex: i, timestamp: new Date(Date.parse("2026-11-04T00:00:00Z") + i * 1000).toISOString(), segmentIndex: 0, lapIndex: null, metrics: {}, position: { latitudeDegrees: 0, longitudeDegrees: i / 10000 } }))
    const before = JSON.stringify(all)
    render(<ImportedActivityRoute samples={all} />)
    fireEvent.click(screen.getByText("표로 보기", { exact: false }))
    expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(20)
    fireEvent.click(screen.getByRole("button", { name: "다음 좌표 표" }))
    expect(screen.getByText(/표본 21 ·/)).toBeInTheDocument()
    expect(fetcher).not.toHaveBeenCalled(); expect(JSON.stringify(all)).toBe(before); vi.unstubAllGlobals()
  })
})
