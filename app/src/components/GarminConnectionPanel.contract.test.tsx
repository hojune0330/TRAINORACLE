import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { GarminConnectionPanel, type GarminJournalOpenResult } from "./GarminConnectionPanel"
import { GARMIN_VERSION, type GarminRequest, type GarminResult, type GarminTransport } from "../domain/account/garmin-integration"
import { setActiveLocalAccount } from "../domain/account/local-journal-ownership"
import { rememberStorageConsentRevision } from "../domain/account/storage-consent-revision"
import { syntheticGarminItem as item, syntheticGarminOwner as owner, syntheticGarminStatus as status, syntheticGarminReceipt as receipt } from "./GarminConnectionPanel.test-fixtures"

beforeEach(() => { sessionStorage.clear(); setActiveLocalAccount(owner); rememberStorageConsentRevision(owner, 2) })
afterEach(() => { cleanup(); setActiveLocalAccount(null); sessionStorage.clear(); vi.restoreAllMocks() })
const success = (data: Extract<GarminResult, { ok: true }>["data"]): GarminResult => ({ ok: true, data })
function exampleTransport(mutate?: (request: GarminRequest) => GarminResult | Promise<GarminResult>): GarminTransport {
  return async (_owner, request) => request.action === "status" ? success(status)
    : request.action === "inbox" ? success({ schemaVersion: GARMIN_VERSION, items: [item], nextCursor: null })
      : mutate ? mutate(request) : success(receipt)
}
const mount = (transport: GarminTransport, props: Partial<React.ComponentProps<typeof GarminConnectionPanel>> = {}) => render(<GarminConnectionPanel ownerId={owner} configured featureEnabled transport={transport} {...props} />)

async function openRecord() {
  fireEvent.click(await screen.findByRole("button", { name: /확인이 필요한 기록 .*개/ }))
  fireEvent.click(await screen.findByRole("button", { name: "기록 확인" }))
}
async function openSettings() {
  fireEvent.click(await screen.findByRole("button", { name: /^(Garmin 설정|연결 설정)$/ }))
}

describe("Garmin connection and reviewed inbox", () => {
  it("leaves default configuration unavailable without making a connection request", () => {
    const transport = vi.fn(exampleTransport())
    mount(transport, { configured: false })
    expect(screen.getByText(/Garmin 자동 연결을 준비/)).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Garmin 연결" })).not.toBeInTheDocument()
    expect(transport).not.toHaveBeenCalled()
  })
  it("distinguishes account connection, no receipt and unsaved records, preserving zero/null/time meaning", async () => {
    mount(exampleTransport())
    await openSettings()
    expect(screen.getByText("연결됨")).toBeInTheDocument()
    expect(screen.getByText("아직 받은 기록 없음")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "받은 기록 검토" }))
    fireEvent.click(await screen.findByRole("button", { name: "기록 확인" }))
    expect(screen.getByText("받은 기록 · 저장 전")).toBeInTheDocument()
    expect(screen.getAllByText("0 m").length).toBeGreaterThan(0)
    expect(screen.getAllByText("미기록").length).toBeGreaterThan(0)
    expect(screen.getByText(/2026-11-05 · 기기 설정 시차 32400초/)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "일지에 저장" })).toBeDisabled()
    expect(screen.queryByText("계정 저장 확인됨")).not.toBeInTheDocument()
  })
  it("saves only after review and opens the exact server-confirmed journal date/id", async () => {
    const transport = vi.fn(exampleTransport()), open = vi.fn(async () => "OPENED" as const)
    mount(transport, { onOpenJournalRecord: open })
    await openRecord()
    fireEvent.click(await screen.findByRole("checkbox", { name: "이 운동의 시작 시각과 수치를 확인했어요" }))
    fireEvent.click(screen.getByRole("button", { name: "일지에 저장" }))
    fireEvent.click(await screen.findByRole("button", { name: "저장한 일지 열기" }))
    expect(open).toHaveBeenCalledWith("2026-11-05", "garmin-synthetic-entry", expect.any(Function))
    const request = transport.mock.calls.find(call => call[1].action === "confirm")![1]
    expect(Object.keys(request).sort()).toEqual(["action", "expectedRevision", "inboxId", "operationId"])
    expect(screen.getByText("계정 저장 확인됨")).toBeInTheDocument()
    expect(screen.queryByText("일지에 저장되지 않은 기록")).toBeNull()
  })
  it("keeps the save receipt and retries only journal reading after a failed open", async () => {
    const transport = vi.fn(exampleTransport())
    const open = vi.fn<NonNullable<React.ComponentProps<typeof GarminConnectionPanel>["onOpenJournalRecord"]>>()
      .mockRejectedValueOnce(new Error("Synthetic read unavailable")).mockResolvedValue("OPENED")
    mount(transport, { onOpenJournalRecord: open })
    await openRecord()
    fireEvent.click(await screen.findByRole("checkbox", { name: "이 운동의 시작 시각과 수치를 확인했어요" }))
    fireEvent.click(screen.getByRole("button", { name: "일지에 저장" }))
    fireEvent.click(await screen.findByRole("button", { name: "저장한 일지 열기" }))
    await screen.findByText("저장된 일지를 아직 열지 못했어요")
    expect(screen.getByText("계정 저장 확인됨")).toBeVisible()
    fireEvent.click(screen.getByRole("button", { name: "저장한 일지 다시 열기" }))
    await waitFor(() => expect(screen.queryByText("저장된 일지를 아직 열지 못했어요")).toBeNull())
    expect(open).toHaveBeenCalledTimes(2)
    expect(transport.mock.calls.filter(call => call[1].action === "confirm")).toHaveLength(1)
  })
  it("invalidates a pending journal open on account change and ignores its late result", async () => {
    let resolve!: (result: GarminJournalOpenResult) => void
    let current!: () => boolean
    const open = vi.fn<NonNullable<React.ComponentProps<typeof GarminConnectionPanel>["onOpenJournalRecord"]>>()
      .mockImplementation(async (_date, _id, guard) => { current = guard; return new Promise(done => { resolve = done }) })
    const transport = exampleTransport(), view = mount(transport, { onOpenJournalRecord: open })
    await openRecord()
    fireEvent.click(await screen.findByRole("checkbox", { name: "이 운동의 시작 시각과 수치를 확인했어요" }))
    fireEvent.click(screen.getByRole("button", { name: "일지에 저장" }))
    fireEvent.click(await screen.findByRole("button", { name: "저장한 일지 열기" }))
    expect(screen.getByRole("button", { name: "일지 확인 중…" })).toBeDisabled()
    expect(current()).toBe(true)
    view.rerender(<GarminConnectionPanel ownerId={null} configured featureEnabled transport={transport} onOpenJournalRecord={open} />)
    expect(current()).toBe(false)
    await act(async () => resolve("UNAVAILABLE"))
    expect(screen.getByText("계정에서 연결을 관리해요")).toBeVisible()
    expect(screen.queryByText("저장된 일지를 아직 열지 못했어요")).toBeNull()
  })
  it("keeps an unknown save pending across reload and retries the exact operation", async () => {
    const attempts: GarminRequest[] = []
    const transport = vi.fn(exampleTransport(request => { attempts.push(request); return attempts.length === 1 ? { ok: false, code: "UNAVAILABLE" } : success({ ...receipt, kind: "already_confirmed" }) }))
    const first = mount(transport)
    await openRecord()
    fireEvent.click(await screen.findByRole("checkbox", { name: "이 운동의 시작 시각과 수치를 확인했어요" }))
    fireEvent.click(screen.getByRole("button", { name: "일지에 저장" }))
    await screen.findByRole("button", { name: "같은 저장 요청 결과 확인" }); first.unmount()
    mount(transport)
    await openRecord()
    fireEvent.click(await screen.findByRole("button", { name: "같은 저장 요청 결과 확인" }))
    await screen.findByText(/이미 저장된 일지의 결과를 확인/)
    expect(attempts).toHaveLength(2); expect(attempts[1]).toEqual(attempts[0])
  })
  it("resets review on revised-source reload and requires explicit reconsideration", async () => {
    let revision = 1
    const transport: GarminTransport = async (_owner, request) => request.action === "status" ? success(status)
      : request.action === "inbox" ? success({ schemaVersion: GARMIN_VERSION, items: [{ ...item, revision }], nextCursor: null }) : { ok: false, code: "SOURCE_CHANGED" }
    mount(transport)
    await openRecord()
    fireEvent.click(await screen.findByRole("checkbox", { name: "이 운동의 시작 시각과 수치를 확인했어요" }))
    fireEvent.click(screen.getByRole("button", { name: "일지에 저장" }))
    await screen.findByText(/원본 기록이 바뀌었어요/)
    revision = 2; fireEvent.click(screen.getByRole("button", { name: "상태 새로고침" }))
    await waitFor(() => expect(screen.getByRole("checkbox", { name: "이 운동의 시작 시각과 수치를 확인했어요" })).not.toBeChecked())
    expect(screen.getByRole("button", { name: "일지에 저장" })).toBeDisabled()
  })
  it("clears old-owner records immediately and ignores a late save ACK", async () => {
    let resolve!: (result: GarminResult) => void
    const transport = exampleTransport(() => new Promise(done => { resolve = done }))
    const view = mount(transport)
    await openRecord()
    fireEvent.click(await screen.findByRole("checkbox", { name: "이 운동의 시작 시각과 수치를 확인했어요" }))
    fireEvent.click(screen.getByRole("button", { name: "일지에 저장" }))
    view.rerender(<GarminConnectionPanel ownerId={null} configured featureEnabled transport={transport} />)
    resolve(success(receipt))
    await screen.findByText("계정에서 연결을 관리해요")
    expect(screen.queryByText("달리기")).not.toBeInTheDocument()
    expect(screen.queryByText("계정 저장 확인됨")).not.toBeInTheDocument()
  })
  it("keeps disconnect reachable with the feature off and labels unconfirmed remote revocation", async () => {
    const transport = vi.fn(exampleTransport(() => success({ schemaVersion: GARMIN_VERSION, connection: { state: "DISCONNECTED", epoch: null, lastSyncAt: null }, remoteRevocationPending: true })))
    mount(transport, { featureEnabled: false })
    await openSettings()
    fireEvent.click(screen.getByText("연결 해제", { selector: "summary" }))
    fireEvent.click(screen.getByRole("checkbox", { name: "Garmin 연결을 해제할게요" }))
    fireEvent.click(screen.getByRole("button", { name: "연결 해제 확인" }))
    await screen.findByText(/Garmin 권한 해제는 확인되지 않아 다시 시도/)
    expect(transport.mock.calls.some(call => call[1].action === "inbox")).toBe(false)
    expect(screen.getByText("연결 안 됨")).toBeInTheDocument()
  })
})

const autoExperience = { saveMode: "AUTO" as const, preferenceRevision: 1, lastSavedAt: null, reviewRequiredCount: 0, reconnectRequired: false }
it("asks once before connecting and defaults to automatic saving without sending a connect request", async () => {
  const transport = vi.fn<GarminTransport>(async () => success({ ...status, connection: { ...status.connection, state: "DISCONNECTED" } }))
  mount(transport)
  await openSettings()
  fireEvent.click(await screen.findByRole("button", { name: "Garmin 연결" }))
  expect(screen.getByRole("radio", { name: "새 운동을 일지에 자동 저장 · 권장" })).toBeChecked()
  expect(screen.getByRole("button", { name: "동의하고 Garmin 연결" })).toBeEnabled()
  expect(transport.mock.calls.some(call => call[1].action === "connect")).toBe(false)
})
it("does not simulate review clicks for automatic saving; surfaces only flagged review records", async () => {
  const transport: GarminTransport = async (_owner, request) => request.action === "status" ? success({ ...status, experience: autoExperience }) : success({ schemaVersion: GARMIN_VERSION, items: [item], nextCursor: null })
  mount(transport)
  await openSettings()
  await screen.findByText("새 운동을 자동으로 일지에 저장해요.")
  expect(screen.queryByRole("button", { name: "일지에 저장" })).toBeNull()
})
it("reopens an automatically saved journal after reload using server receipt identity", async () => {
  const open = vi.fn(async () => "OPENED" as const)
  const transport: GarminTransport = async (_owner, request) => request.action === "status" ? success({ ...status, experience: autoExperience }) : success({ schemaVersion: GARMIN_VERSION, items: [{ ...item, state: "CONFIRMED", documentId: receipt.documentId, journalEntryId: receipt.journalEntryId, journalDate: receipt.date, savedAutomatically: true }], nextCursor: null })
  mount(transport, { onOpenJournalRecord: open })
  await openSettings()
  fireEvent.click(screen.getByRole("button", { name: "저장된 운동 보기" }))
  fireEvent.click(await screen.findByRole("button", { name: "저장한 일지 열기" }))
  expect(open).toHaveBeenCalledWith(receipt.date, receipt.journalEntryId, expect.any(Function))
  expect(screen.getByText("일지에 자동 저장됨")).toBeVisible()
})
it("changes storage mode only after server acknowledgement and pins the preference revision", async () => {
  const transport = vi.fn<GarminTransport>(async (_owner, request) => request.action === "status" ? success({ ...status, experience: autoExperience }) : request.action === "preferences" ? success({ schemaVersion: GARMIN_VERSION, experience: { ...autoExperience, saveMode: "REVIEW", preferenceRevision: 2 } }) : success({ schemaVersion: GARMIN_VERSION, items: [], nextCursor: null }))
  mount(transport)
  await openSettings()
  fireEvent.click(await screen.findByText("저장 방식 변경"))
  fireEvent.click(screen.getByRole("button", { name: "확인 후 저장으로 변경" }))
  await screen.findByText("앞으로 받은 운동은 확인 후 저장해요.")
  expect(transport.mock.calls.find(call => call[1].action === "preferences")?.[1]).toMatchObject({ expectedPreferenceRevision: 1, epoch: status.connection.epoch, saveMode: "REVIEW" })
})

it("keeps received workouts out of settings and requires entering review before saving", async () => {
  const transport = vi.fn(exampleTransport())
  mount(transport)
  await screen.findByRole("button", { name: /확인이 필요한 기록 .*개/ })
  expect(screen.queryByText("0 m")).toBeNull()
  expect(screen.queryByRole("checkbox")).toBeNull()
  await openRecord()
  expect(screen.getByRole("button", { name: "일지에 저장" })).toBeDisabled()
  expect(transport.mock.calls.some(call => call[1].action === "confirm")).toBe(false)
})
it("does not report unknown connection as disconnected after a status failure", async () => {
  mount(async () => ({ ok: false, code: "UNAVAILABLE" }))
  await screen.findByText("상태 확인이 필요해요")
  expect(screen.queryByText("연결 안 됨")).toBeNull()
  await openSettings()
  expect(screen.getByRole("button", { name: "상태 새로고침" })).toBeEnabled()
})
