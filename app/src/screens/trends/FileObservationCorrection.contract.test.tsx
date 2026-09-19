import React from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { FileObservationCorrection } from "./FileObservationCorrection"
import { buildFileObservation, toFileObservationSummary } from "../../domain/import/file-observation"
import { toImportedEntry } from "../../domain/import/import-draft"
import { parseActivityFile } from "../../domain/import/activity-file"

const api = vi.hoisted(() => ({ read: vi.fn(), correct: vi.fn(), retry: vi.fn(), scope: null as (() => void) | null, owner: "A" }))
vi.mock("../../domain/account/account-journal-record-service", () => ({ readAccountJournalWriteBase: api.read,
  correctAccountJournalFileObservation: api.correct, retryAccountJournalFileObservation: api.retry }))
vi.mock("../../domain/account/local-journal-ownership", () => ({ activeLocalAccount: () => api.owner,
  onLocalJournalScopeChange: (listener: () => void) => { api.scope = listener; return () => { api.scope = null } } }))

const observation = buildFileObservation({ format: "tcx", sourceProfile: "TCX_ACTIVITY_V1", parserVersion: "v1", sourceActivityId: "source-1",
  date: "2026-09-19", startedAt: null, timeZone: null, sport: "RUNNING", distanceMeters: 1000, durationSeconds: 300.25,
  durationMeaning: "SOURCE_DEFINED", laps: [{ sourceIndex: 0, distanceMeters: 1000, durationSeconds: 300.25, durationMeaning: "SOURCE_DEFINED", kind: "UNKNOWN" }],
  confirmation: { durationMeaning: null, sport: null } })
const entry = toImportedEntry({ name: "Synthetic", date: observation.date, sport: "Running", observation, ...toFileObservationSummary(observation) }, "tcx", { includeFileObservation: true })
const base = { entry, revision: 4, contentFingerprint: "sha256:" + "a".repeat(64) }
beforeEach(() => { vi.resetAllMocks(); api.owner = "A"; api.read.mockResolvedValue(base); api.correct.mockResolvedValue({ ok: true, storage: "ACCOUNT" }); vi.stubEnv("VITE_FEATURE_FILE_ANALYSIS_TCX", "true") })
afterEach(() => { cleanup(); vi.unstubAllEnvs() })
async function changeTime() {
  render(<FileObservationCorrection entryId={entry.id} />)
  fireEvent.click(screen.getByRole("button", { name: "시간·파일 기록 정정" }))
  await screen.findByText("파일의 시간은 어떤 시간인가요?")
  fireEvent.click(screen.getByText("시간과 날짜 확인"))
  fireEvent.change(screen.getByLabelText("파일의 시간은 어떤 시간인가요?"), { target: { value: "TIMER" } })
}
describe("FileObservationCorrection", () => {
  it("accepts a real parsed replacement without forwarding computed output fields to the builder", async () => {
    const xml = `<TrainingCenterDatabase><Activities><Activity Sport="Running"><Id>2026-09-19T01:00:00Z</Id><Lap StartTime="2026-09-19T01:00:00Z"><TotalTimeSeconds>360.125</TotalTimeSeconds><DistanceMeters>1200.5</DistanceMeters></Lap></Activity></Activities></TrainingCenterDatabase>`
    const previous = parseActivityFile(xml.replace("360.125", "300.25").replace("1200.5", "1000"), "Asia/Seoul").activities[0]!.observation!
    api.read.mockResolvedValue({ ...base, entry: { ...entry, fileObservation: previous } })
    const parsed = parseActivityFile(xml, "Asia/Seoul")
    const replacement = parsed.activities[0]?.observation
    expect(replacement).toBeDefined()
    expect(replacement?.contentRevisionFingerprint).not.toBe(observation.contentRevisionFingerprint)
    render(<FileObservationCorrection entryId={entry.id} />)
    fireEvent.click(screen.getByRole("button", { name: "시간·파일 기록 정정" }))
    await screen.findByText("파일의 시간은 어떤 시간인가요?")
    const file = new File([xml], "synthetic.tcx", { type: "application/xml" })
    Object.defineProperty(file, "text", { value: async () => xml })
    fireEvent.change(screen.getByLabelText("같은 운동의 수정 파일"), { target: { files: [file] } })
    fireEvent.click(await screen.findByRole("button", { name: /이 수정본 선택/u }))
    expect(screen.getByRole("button", { name: "확인한 변경 저장" })).toBeDisabled()
    for (const checkbox of screen.getAllByRole("checkbox")) fireEvent.click(checkbox)
    fireEvent.click(screen.getByRole("button", { name: "확인한 변경 저장" }))
    await screen.findByText(/정정한 기록을 계정에 저장/u)
    const sent = api.correct.mock.calls[0]![1]
    expect(sent.distanceMeters).toBe(1200.5)
    expect(sent.durationSeconds).toBe(360.125)
    expect(sent.sourceIdentityFingerprint).toBe(previous.sourceIdentityFingerprint)
    expect(sent.sourceObservationKey).toBe(previous.sourceObservationKey)
    expect(sent.parserVersion).toBe(previous.parserVersion)
    expect(sent.contentRevisionFingerprint).toBe(replacement?.contentRevisionFingerprint)
  })
  it("requires an explicit changed-field confirmation and preserves the captured CAS base", async () => {
    await changeTime()
    expect(screen.getByRole("button", { name: "확인한 변경 저장" })).toBeDisabled()
    fireEvent.click(screen.getByRole("checkbox", { name: /내가 확인한 시간/u }))
    fireEvent.click(screen.getByRole("button", { name: "확인한 변경 저장" }))
    await screen.findByText(/정정한 기록을 계정에 저장/u)
    expect(api.correct).toHaveBeenCalledWith(entry.id, { ...observation, confirmation: { durationMeaning: "TIMER", sport: null } }, base, ["confirmation"])
  })
  it("keeps unknown time unchanged without inventing an interpretation", async () => {
    render(<FileObservationCorrection entryId={entry.id} />)
    fireEvent.click(screen.getByRole("button", { name: "시간·파일 기록 정정" }))
    await screen.findByText("파일의 시간은 어떤 시간인가요?")
    expect(screen.getByRole("button", { name: "확인한 변경 저장" })).toBeDisabled()
    expect(api.correct).not.toHaveBeenCalled()
  })
  it("reports pending honestly and retries the durable request without a new correction", async () => {
    api.correct.mockResolvedValue({ ok: true, storage: "PENDING" }); api.retry.mockResolvedValue({ ok: true, storage: "ACCOUNT" })
    await changeTime()
    fireEvent.click(screen.getByRole("checkbox", { name: /내가 확인한 시간/u }))
    fireEvent.click(screen.getByRole("button", { name: "확인한 변경 저장" }))
    await screen.findByText(/정정 내용을 기기에 임시 보관/u)
    fireEvent.click(screen.getByRole("button", { name: "정정 닫기" }))
    fireEvent.click(screen.getByRole("button", { name: "시간·파일 기록 정정" }))
    expect(api.read).toHaveBeenCalledOnce()
    expect(screen.getByLabelText("파일의 시간은 어떤 시간인가요?")).toHaveValue("TIMER")
    fireEvent.click(screen.getByRole("button", { name: "같은 정정 다시 전송" }))
    await screen.findByText(/정정한 기록을 계정에 저장/u)
    expect(api.correct).toHaveBeenCalledOnce(); expect(api.retry).toHaveBeenCalledWith(entry.id)
  })
  it("shows a server write stop without reporting success", async () => {
    api.correct.mockResolvedValue({ ok: false, storage: "FAILED", rejection: "FILE_EVIDENCE_DISABLED" })
    await changeTime()
    fireEvent.click(screen.getByRole("checkbox", { name: /내가 확인한 시간/u }))
    fireEvent.click(screen.getByRole("button", { name: "확인한 변경 저장" }))
    await screen.findByText(/새 저장을 잠시 중단/u)
    expect(screen.queryByText(/정정한 기록을 계정에 저장/u)).toBeNull()
    expect(screen.getByRole("button", { name: "확인한 변경 저장" })).toBeEnabled()
  })
  it("does not show a late A response after A-B-A", async () => {
    let resolve!: (value: unknown) => void
    api.read.mockImplementationOnce(() => new Promise(done => { resolve = done }))
    render(<FileObservationCorrection entryId={entry.id} />)
    fireEvent.click(screen.getByRole("button", { name: "시간·파일 기록 정정" }))
    api.owner = "B"; api.scope?.(); api.owner = "A"; api.scope?.()
    resolve(base)
    await waitFor(() => expect(screen.queryByText("파일의 시간은 어떤 시간인가요?")).toBeNull())
    expect(api.correct).not.toHaveBeenCalled()
  })
  it("does not edit when the confirmed record is unavailable", async () => {
    api.read.mockResolvedValue(null)
    render(<FileObservationCorrection entryId={entry.id} />)
    fireEvent.click(screen.getByRole("button", { name: "시간·파일 기록 정정" }))
    await screen.findByText(/계정에 저장된 원본을 확인하지 못/u)
    expect(screen.queryByRole("button", { name: "확인한 변경 저장" })).toBeNull()
  })
  it("clears a previous editor when reopening cannot reload the original", async () => {
    await changeTime()
    fireEvent.click(screen.getByRole("button", { name: "정정 닫기" }))
    api.read.mockRejectedValueOnce(new Error("synthetic offline"))
    fireEvent.click(screen.getByRole("button", { name: "시간·파일 기록 정정" }))
    await screen.findByText(/원본을 불러오지 못했어요/u)
    expect(screen.queryByRole("button", { name: "확인한 변경 저장" })).toBeNull()
    expect(api.correct).not.toHaveBeenCalled()
  })
})
