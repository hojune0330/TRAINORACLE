import { afterEach, describe, expect, it, vi } from "vitest"
import { renderOracleSharePng } from "./oracle-report-share-render"
import { projectOracleShare } from "../../domain/oracle-report-share"
import { buildOracleReport } from "../../domain/oracle-report"
import { buildOracleDemoScenario } from "../../domain/oracle-demo-scenario"
afterEach(() => vi.restoreAllMocks())
describe("Oracle local raster rendering", () => {
  it("renders 1080×1350 PNG from allowlisted text, including source and limitations", async () => {
    const text = vi.fn(), rect = vi.fn()
    const ctx = { fillText: text, fillRect: rect, measureText: (value: string) => ({ width: value.length * 18 }), font: "", fillStyle: "", textBaseline: "" }
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(ctx as unknown as CanvasRenderingContext2D)
    let dimensions: number[] = []
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(function (this: HTMLCanvasElement, callback, type) { dimensions = [this.width, this.height]; expect(type).toBe("image/png"); callback(new Blob(["png"], { type: "image/png" })) })
    vi.spyOn(window, "getComputedStyle").mockReturnValue({ getPropertyValue: (name: string) => name === "--sans" ? "Pretendard Variable" : "rgb(0, 0, 0)" } as CSSStyleDeclaration)
    const report = buildOracleReport({ source: "example", months: 6, today: "2026-09-30", entries: buildOracleDemoScenario().entries })
    const snapshot = projectOracleShare(report, "summary")!
    const blob = await renderOracleSharePng(snapshot)
    expect(blob.type).toBe("image/png"); expect(dimensions).toEqual([1080, 1350])
    const output = text.mock.calls.map(call => call[0]).join("")
    expect(output).toContain(snapshot.headline); expect(output).toContain("예시"); expect(output).toContain("집계 제외")
    expect(output).toContain("미기록은 0으로 채우지 않음")
    expect(text.mock.calls.every(call => call[2] < 1350)).toBe(true)
    const metricLabels = snapshot.metrics.map(metric => text.mock.calls.find(call => call[0] === metric.label)!)
    expect(new Set(metricLabels.map(call => call[2])).size).toBe(1)
    expect(new Set(metricLabels.map(call => call[1])).size).toBe(snapshot.metrics.length)
    const bars = rect.mock.calls.filter(call => call[1] > 700 && call[3] > 0)
    const distances = snapshot.months.flatMap(month => month.km !== null && month.km > 0 ? [month.km] : [])
    expect(bars).toHaveLength(distances.length)
    bars.forEach((bar, index) => expect(bar[3] / 280).toBeCloseTo(distances[index]! / Math.max(...distances)))
  })
  it("fails closed if canvas is unavailable", async () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null)
    await expect(renderOracleSharePng(projectOracleShare(buildOracleReport({ source: "my", months: 3, today: "2026-09-30", entries: [] }), "summary")!)).rejects.toThrow()
  })
})
