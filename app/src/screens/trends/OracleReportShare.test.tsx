import React from "react"
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { OracleReportShare } from "./OracleReportShare"
import { buildOracleReport } from "../../domain/oracle-report"
import { renderOracleSharePng } from "./oracle-report-share-render"
import { buildOracleDemoScenario } from "../../domain/oracle-demo-scenario"
vi.mock("./oracle-report-share-render", () => ({ renderOracleSharePng: vi.fn() }))
const report = () => buildOracleReport({ source: "my", months: 3, today: "2026-09-30", entries: buildOracleDemoScenario().entries })
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", "") }; HTMLDialogElement.prototype.close = function () { this.removeAttribute("open") }
  URL.createObjectURL = vi.fn(() => "blob:preview"); URL.revokeObjectURL = vi.fn()
  vi.mocked(renderOracleSharePng).mockResolvedValue(new Blob(["png"], { type: "image/png" }))
})
afterEach(() => { cleanup(); vi.restoreAllMocks() })
describe("Oracle image workarea lifecycle", () => {
  it("invalidates exact selected workout on accepted-source deletion or reorder without silently rebinding", async () => {
    const source = buildOracleReport({ source: "example", months: 3, today: "2026-09-30", entries: buildOracleDemoScenario().entries })
    const view = render(<OracleReportShare report={source} onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole("button", { name: "기억할 운동" }))
    const select = screen.getByRole("combobox")
    const first = select.querySelectorAll("option")[1]!.value
    fireEvent.change(select, { target: { value: first } })
    await waitFor(() => expect(screen.getByRole("button", { name: "이미지 저장" })).toBeEnabled())
    view.rerender(<OracleReportShare report={{ ...source, evidence: [...source.evidence].reverse() }} onClose={vi.fn()} />)
    expect(screen.getByRole("combobox")).toHaveValue("")
    expect(screen.getByRole("button", { name: "이미지 저장" })).toBeDisabled()
    fireEvent.change(screen.getByRole("combobox"), { target: { value: first } })
    await waitFor(() => expect(screen.getByRole("button", { name: "이미지 저장" })).toBeEnabled())
    view.rerender(<OracleReportShare report={{ ...source, evidence: source.evidence.slice(1) }} onClose={vi.fn()} />)
    expect(screen.getByRole("combobox")).toHaveValue("")
    expect(screen.getByRole("button", { name: "이미지 저장" })).toBeDisabled()
  })
  it("prepares before enabling actions; discards stale render and revokes URLs on scope change/unmount", async () => {
    let resolve!: (blob: Blob) => void
    vi.mocked(renderOracleSharePng).mockImplementationOnce(() => new Promise(done => { resolve = done }))
    const source = report(), close = vi.fn()
    const view = render(<OracleReportShare report={source} accountScopeKey="a" onClose={close} />)
    expect(screen.getByRole("button", { name: "이미지 저장" })).toBeDisabled()
    view.rerender(<OracleReportShare report={source} accountScopeKey="b" onClose={close} />)
    await waitFor(() => expect(screen.getByRole("button", { name: "이미지 저장" })).toBeEnabled())
    await act(async () => resolve(new Blob(["old"])))
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1)
    view.unmount(); expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:preview")
  })
  it("reports render failure without export and restores opener focus", async () => {
    vi.mocked(renderOracleSharePng).mockRejectedValue(new Error("canvas"))
    const opener = document.createElement("button"); document.body.append(opener); opener.focus()
    const view = render(<OracleReportShare report={report()} onClose={vi.fn()} />)
    await screen.findByText(/이미지를 만들지 못했어요/)
    expect(screen.getByRole("button", { name: "기기 공유" })).toBeDisabled()
    view.unmount(); expect(document.activeElement).toBe(opener); opener.remove()
  })
  it("guards duplicate native sharing and reports cancellation accurately", async () => {
    let reject!: (error: Error) => void
    const share = vi.fn(() => new Promise<void>((_done, fail) => { reject = fail }))
    Object.defineProperty(navigator, "canShare", { configurable: true, value: () => true })
    Object.defineProperty(navigator, "share", { configurable: true, value: share })
    render(<OracleReportShare report={report()} onClose={vi.fn()} />)
    await waitFor(() => expect(screen.getByRole("button", { name: "기기 공유" })).toBeEnabled())
    fireEvent.click(screen.getByRole("button", { name: "기기 공유" })); fireEvent.click(screen.getByRole("button", { name: "기기 공유" }))
    expect(share).toHaveBeenCalledTimes(1)
    await act(async () => reject(new DOMException("cancel", "AbortError")))
    expect(screen.getByRole("status")).toHaveTextContent("공유를 취소했어요.")
  })
  it("uses explicit download fallback when native file sharing is unsupported", async () => {
    Object.defineProperty(navigator, "canShare", { configurable: true, value: () => false })
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {})
    render(<OracleReportShare report={report()} onClose={vi.fn()} />)
    await waitFor(() => expect(screen.getByRole("button", { name: "기기 공유" })).toBeEnabled())
    expect(click).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole("button", { name: "기기 공유" }))
    expect(click).toHaveBeenCalledTimes(1)
    expect(screen.getByRole("status")).toHaveTextContent("이미지 다운로드를 시작했어요.")
  })
})
