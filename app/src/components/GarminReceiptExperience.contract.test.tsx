import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { GarminConnectionPanel } from "./GarminConnectionPanel"
import { GarminJournalPreview } from "./GarminActivityDetail"
import { GARMIN_VERSION, type GarminItem, type GarminTransport, type GarminResult } from "../domain/account/garmin-integration"
import { syntheticGarminOwner as owner, syntheticGarminItem as item, syntheticGarminStatus as status, syntheticGarminReceipt as receipt } from "./GarminConnectionPanel.test-fixtures"
import { setActiveLocalAccount } from "../domain/account/local-journal-ownership"
import { rememberStorageConsentRevision } from "../domain/account/storage-consent-revision"

beforeEach(() => { sessionStorage.clear(); setActiveLocalAccount(owner); rememberStorageConsentRevision(owner, 2) })
afterEach(() => { cleanup(); setActiveLocalAccount(null); vi.restoreAllMocks() })
const success = (data: Extract<GarminResult, { ok: true }>["data"]): GarminResult => ({ ok: true, data })
const experience = { saveMode: "AUTO" as const, preferenceRevision: 1, lastSavedAt: null, reviewRequiredCount: 0, reconnectRequired: false }
const saved: GarminItem = { ...item, state: "CONFIRMED", documentId: receipt.documentId, journalEntryId: receipt.journalEntryId, journalDate: receipt.date, savedAutomatically: true }

it("shows the first saved workout automatically and opens its exact journal", async () => {
  let rows: GarminItem[] = []
  const open = vi.fn(async () => "OPENED" as const)
  const transport: GarminTransport = async (_owner, request) => request.action === "status" ? success({ ...status, experience })
    : success({ schemaVersion: GARMIN_VERSION, items: rows, nextCursor: null })
  render(<GarminConnectionPanel ownerId={owner} configured featureEnabled transport={transport} onOpenJournalRecord={open} />)
  await screen.findByText("아직 받은 운동이 없어요")
  expect(screen.getByRole("link", { name: /Garmin Connect에서 확인/ })).toHaveAttribute("href", "https://connect.garmin.com/modern/activities")
  rows = [saved]
  await act(async () => window.dispatchEvent(new Event("focus")))
  fireEvent.click(await screen.findByRole("button", { name: "저장한 일지 열기" }))
  expect(open).toHaveBeenCalledWith(receipt.date, receipt.journalEntryId, expect.any(Function))
  expect(screen.queryByRole("button", { name: "새 기록 확인" })).toBeNull()
})

it("does not replace a review opened while a passive inbox request is in flight", async () => {
  let resolve!: (result: GarminResult) => void
  let inboxCalls = 0
  const transport: GarminTransport = async (_owner, request) => request.action === "status" ? success(status)
    : ++inboxCalls === 1 ? success({ schemaVersion: GARMIN_VERSION, items: [item], nextCursor: null }) : new Promise(done => { resolve = done })
  render(<GarminConnectionPanel ownerId={owner} configured featureEnabled transport={transport} />)
  await screen.findByRole("button", { name: "기록 확인" })
  await act(async () => window.dispatchEvent(new Event("focus")))
  await waitFor(() => expect(resolve).toBeTypeOf("function"))
  fireEvent.click(screen.getByRole("button", { name: "기록 확인" }))
  fireEvent.click(screen.getByRole("checkbox", { name: "이 운동의 시작 시각과 수치를 확인했어요" }))
  await act(async () => resolve(success({ schemaVersion: GARMIN_VERSION, items: [{ ...item, revision: 2 }], nextCursor: null })))
  expect(screen.getByRole("checkbox", { name: "이 운동의 시작 시각과 수치를 확인했어요" })).toBeChecked()
  expect(screen.getByRole("button", { name: "새 기록 확인" })).toBeVisible()
})

it("does not mistake a TrainOracle login failure for Garmin revocation", async () => {
  const login = vi.fn()
  render(<GarminConnectionPanel ownerId={owner} configured featureEnabled transport={async () => ({ ok: false, code: "AUTH_REQUIRED" })} onOpenAccount={login} />)
  fireEvent.click(await screen.findByRole("button", { name: "TrainOracle 로그인 확인" }))
  expect(login).toHaveBeenCalledOnce()
  expect(screen.queryByRole("button", { name: "Garmin 다시 연결" })).toBeNull()
})

it.each([null, 3600])("explains an UNKNOWN duration only after a verified non-null auto-save source (%s)", async seconds => {
  const record = { ...saved, observation: { ...item.observation!, durationSeconds: seconds } }
  const transport = vi.fn<GarminTransport>(async () => success({ schemaVersion: GARMIN_VERSION, item: record }))
  render(<GarminJournalPreview ownerId={owner} documentId={receipt.documentId} durationMissing transport={transport} />)
  await screen.findByText("운동 상세", { selector: "summary" })
  expect(transport).toHaveBeenCalledTimes(1)
  if (seconds === null) expect(screen.queryByText("시간 기준 확인 필요")).toBeNull()
  else {
    expect(screen.getByText("시간 기준 확인 필요")).toBeVisible()
    fireEvent.click(screen.getByRole("button", { name: "Garmin 원본 시간 보기" }))
    expect(await screen.findByRole("heading", { name: "운동 상세" })).toBeVisible()
    expect(screen.getByText("1시간 0분 0초", { selector: "dd" })).toBeVisible()
  }
})

it("does not explain a missing journal time from an unverified or revised source", async () => {
  render(<GarminJournalPreview ownerId={owner} documentId={receipt.documentId} durationMissing transport={async () => success({ schemaVersion: GARMIN_VERSION, item: { ...saved, state: "CONFLICT" } })} />)
  await screen.findByText("원본 확인을 완료하지 못했어요")
  expect(screen.queryByText("시간 기준 확인 필요")).toBeNull()
})

it("restores the app scroll region when returning from a workout review", async () => {
  render(<div className="app-scroll-region"><GarminConnectionPanel ownerId={owner} configured featureEnabled transport={async (_owner, request) => request.action === "status" ? success(status) : success({ schemaVersion: GARMIN_VERSION, items: [item], nextCursor: null })} /></div>)
  const region = document.querySelector(".app-scroll-region")!
  await screen.findByRole("button", { name: "기록 확인" })
  region.scrollTop = 280
  fireEvent.click(screen.getByRole("button", { name: "기록 확인" }))
  region.scrollTop = 20
  await act(async () => { window.history.back(); await new Promise(resolve => setTimeout(resolve, 40)) })
  await waitFor(() => expect(region.scrollTop).toBe(280))
})
