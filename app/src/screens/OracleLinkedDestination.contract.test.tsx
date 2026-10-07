import React from "react"
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { OracleLinkedDestination, canEmbedOracleDestination } from "./OracleLinkedDestination"
import { OracleProfileReader } from "./OracleProfileExperience"
import { ORACLE_CONTENT_CATALOG } from "../domain/oracle-content-catalog"
import { activeLocalAccount, setActiveLocalAccount } from "../domain/account/local-journal-ownership"
import { loadAthleteRecords, loadAthleteRecordsForAccount, parseAthleteRecord } from "../domain/athlete-records"
import { saveEntry, loadEntries } from "../domain/journal-store"
import { accountPlanPacketFixture } from "../domain/account/account-plan.test-fixtures"
import { accountPlanEntry, emptyAccountPlanDocument } from "../domain/account/account-plan-document-schema"
import { splitAccountPlanCollection } from "../domain/account/account-plan-collection-schema"
import { createAccountPlanCollectionClient, type AccountPlanCollectionClient } from "../domain/account/account-plan-collection-api"
import { accountPlansEnabled } from "../domain/account/account-plan-service"
import { PLAN_BETA_STORAGE_KEY } from "../domain/plan-beta-store"
import {
  accountAthleteRecordsEnabled, loadAccountAthleteRecords, readAccountAthleteRecordsState, addAccountAthleteRecord,
  type AccountAthleteRecordsState, type AddAccountAthleteRecordResult,
} from "../domain/account/account-athlete-record-service"

vi.mock("../domain/account/account-athlete-record-service", async importOriginal => ({
  ...await importOriginal<typeof import("../domain/account/account-athlete-record-service")>(),
  accountAthleteRecordsEnabled: vi.fn(), loadAccountAthleteRecords: vi.fn(), readAccountAthleteRecordsState: vi.fn(), addAccountAthleteRecord: vi.fn(),
}))
const calendar = vi.hoisted(() => ({ override: null as ReturnType<typeof import("../hooks/useCalendarEntries").useCalendarSnapshot> | null }))
vi.mock("../hooks/useCalendarEntries", async importOriginal => {
  const actual = await importOriginal<typeof import("../hooks/useCalendarEntries")>()
  return { ...actual, useCalendarSnapshot: () => { const value = actual.useCalendarSnapshot(); return calendar.override ?? value } }
})
vi.mock("../domain/account/account-plan-service", async importOriginal => ({
  ...await importOriginal<typeof import("../domain/account/account-plan-service")>(),
  accountPlansEnabled: vi.fn(() => false), accountPlanService: () => null,
}))
vi.mock("../domain/account/account-plan-collection-api", () => ({ createAccountPlanCollectionClient: vi.fn() }))

const OWNER_A = "a1111111-1111-4111-8111-111111111111"
const OWNER_B = "b2222222-2222-4222-8222-222222222222"
const today = "2026-10-04"
function accountState(patch: Partial<AccountAthleteRecordsState> = {}): AccountAthleteRecordsState {
  return { status: "EMPTY", ownerId: activeLocalAccount(), documentId: null, serverRevision: 0, records: [], confirmed: true, ...patch }
}
beforeEach(() => {
  vi.clearAllMocks()
  calendar.override = null
  vi.mocked(accountPlansEnabled).mockReturnValue(false)
  window.localStorage.clear(); window.sessionStorage.clear(); setActiveLocalAccount(null)
  vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-10-04T03:00:00.000Z"))
  vi.mocked(accountAthleteRecordsEnabled).mockReturnValue(false)
  vi.mocked(loadAccountAthleteRecords).mockImplementation(async () => accountState())
  vi.mocked(readAccountAthleteRecordsState).mockImplementation(() => accountState())
  vi.mocked(addAccountAthleteRecord).mockResolvedValue({ ok: false, code: "WRITE_FAILED" })
  vi.spyOn(HTMLDialogElement.prototype, "showModal").mockImplementation(function (this: HTMLDialogElement) { this.setAttribute("open", "") })
  vi.spyOn(HTMLDialogElement.prototype, "close").mockImplementation(function (this: HTMLDialogElement) { this.removeAttribute("open") })
  vi.stubGlobal("fetch", vi.fn(async () => { throw Error("Linked destination tests must not access the network") }))
})
afterEach(() => { cleanup(); setActiveLocalAccount(null); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals() })
function enterRecord() {
  expect(screen.getByRole("combobox", { name: "종목 거리" })).toHaveValue("5000")
  expect(screen.queryByRole("textbox", { name: "기록 분" })).toBeNull()
  expect(screen.queryByRole("button", { name: "기록 저장" })).toBeNull()
  fireEvent.click(screen.getByRole("button", { name: "시간 입력" }))
  fireEvent.change(screen.getByRole("textbox", { name: "기록 분" }), { target: { value: "18" } })
  fireEvent.change(screen.getByRole("textbox", { name: "기록 초" }), { target: { value: "30" } })
  fireEvent.click(screen.getByRole("button", { name: "날짜 확인" }))
  expect(screen.getByRole("textbox", { name: "달성일" })).toHaveValue("")
  expect(addAccountAthleteRecord).not.toHaveBeenCalled()
  expect(loadAthleteRecords()).toEqual([])
  fireEvent.click(screen.getByRole("button", { name: "기록 저장" }))
}

it("explicitly limits embedding to supported screens instead of treating other destinations as empty data", () => {
  for (const destination of new Set(ORACLE_CONTENT_CATALOG.map(topic => topic.destination))) {
    expect(canEmbedOracleDestination(destination)).toBe(["METHODS", "RECORDS", "JOURNAL", "CALENDAR", "PLAN_REVIEW"].includes(destination))
  }
})

it("reuses the existing method reader and its local bookmark without closing or navigating the parent", () => {
  const onBack = vi.fn(), history = vi.spyOn(window.history, "pushState")
  render(<OracleLinkedDestination destination="METHODS" onBack={onBack} today={today} />)
  expect(screen.getByRole("heading", { name: "어떤 훈련이 궁금한가요?" })).toBeVisible()
  fireEvent.click(screen.getByRole("button", { name: /크루즈 인터벌은 지속주와/ }))
  expect(screen.getByRole("heading", { name: "따라 하기 전에" })).toBeVisible()
  fireEvent.click(screen.getByRole("button", { name: "나중에 읽기" }))
  expect(screen.getByRole("button", { name: "저장됨" })).toHaveAttribute("aria-pressed", "true")
  expect(onBack).not.toHaveBeenCalled()
  expect(screen.queryByRole("dialog")).toBeNull()
  fireEvent.click(screen.getByRole("button", { name: "이전 화면" }))
  expect(screen.getByRole("heading", { name: "어떤 훈련이 궁금한가요?" })).toBeVisible()
  expect(onBack).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole("button", { name: "이전 화면" }))
  expect(onBack).toHaveBeenCalledTimes(1)
  expect(history).not.toHaveBeenCalled()
})

it("keeps a guest record save inside the existing screen until explicit return", async () => {
  const onBack = vi.fn()
  render(<OracleLinkedDestination destination="RECORDS" onBack={onBack} today={today} />)
  enterRecord()
  await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("이 기기에 경기 기록을 저장했어요"))
  expect(loadAthleteRecords()).toEqual([expect.objectContaining({ eventDistanceM: 5000, performanceSeconds: 1110, achievedOn: null })])
  expect(within(screen.getByRole("region", { name: "저장한 경기 기록" })).getByText(/5000m · 18분 30초/)).toBeVisible()
  expect(onBack).not.toHaveBeenCalled()
  expect(addAccountAthleteRecord).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole("button", { name: "풀이로 돌아가기" }))
  expect(onBack).toHaveBeenCalledTimes(1)
})

it("preserves existing field validation rather than calling a save through the wrapper", () => {
  const onBack = vi.fn()
  render(<OracleLinkedDestination destination="RECORDS" onBack={onBack} today={today} />)
  fireEvent.click(screen.getByRole("button", { name: "시간 입력" }))
  fireEvent.click(screen.getByRole("button", { name: "날짜 확인" }))
  expect(screen.getByRole("textbox", { name: "기록 분" })).toHaveAttribute("aria-invalid", "true")
  expect(screen.getByRole("textbox", { name: "기록 분" })).toHaveFocus()
  expect(screen.queryByRole("button", { name: "기록 저장" })).toBeNull()
  expect(loadAthleteRecords()).toEqual([])
  expect(addAccountAthleteRecord).not.toHaveBeenCalled()
  expect(onBack).not.toHaveBeenCalled()
})

it("does not fall back to a guest/local save when account capability is disabled", async () => {
  setActiveLocalAccount(OWNER_A)
  const onBack = vi.fn()
  render(<OracleLinkedDestination destination="RECORDS" onBack={onBack} today={today} />)
  enterRecord()
  await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("계정 저장에 연결되지 않았어요"))
  expect(loadAthleteRecordsForAccount(null)).toEqual([])
  expect(loadAthleteRecordsForAccount(OWNER_A)).toEqual([])
  expect(addAccountAthleteRecord).not.toHaveBeenCalled()
  expect(onBack).not.toHaveBeenCalled()
})

it.each(["ACCOUNT", "PENDING"] as const)("keeps the existing account %s receipt visible without auto-return", async storage => {
  setActiveLocalAccount(OWNER_A)
  vi.mocked(accountAthleteRecordsEnabled).mockReturnValue(true)
  vi.mocked(addAccountAthleteRecord).mockImplementation(async input => {
    const record = parseAthleteRecord(input, new Date())
    if (!record) throw Error("Expected a validated synthetic athlete record")
    return { ok: true, storage, snapshot: null,
      state: accountState({ status: storage === "ACCOUNT" ? "READY" : "PENDING", serverRevision: 1, records: [record], confirmed: storage === "ACCOUNT" }) }
  })
  const onBack = vi.fn()
  render(<OracleLinkedDestination destination="RECORDS" onBack={onBack} today={today} />)
  enterRecord()
  await waitFor(() => expect(screen.getByRole("status", { name: "" })).toHaveTextContent(storage === "ACCOUNT" ? "계정에 경기 기록을 저장했어요" : "아직 계정에 저장됐다고 확인되지는 않았어요"))
  expect(addAccountAthleteRecord).toHaveBeenCalledWith(expect.objectContaining({ performanceSeconds: 1110 }), 0)
  expect(onBack).not.toHaveBeenCalled()
  expect(loadAthleteRecordsForAccount(null)).toEqual([])
  expect(loadAthleteRecordsForAccount(OWNER_A)).toHaveLength(storage === "ACCOUNT" ? 1 : 0)
  if (storage === "PENDING") expect(screen.getByRole("button", { name: "계정 저장 다시 확인" })).toBeEnabled()
})

it("remounts the record form on owner change and ignores a late save from the previous owner", async () => {
  setActiveLocalAccount(OWNER_A)
  vi.mocked(accountAthleteRecordsEnabled).mockReturnValue(true)
  let release!: (result: AddAccountAthleteRecordResult) => void
  vi.mocked(addAccountAthleteRecord).mockImplementation(() => new Promise(resolve => { release = resolve }))
  const onBack = vi.fn()
  render(<OracleLinkedDestination destination="RECORDS" onBack={onBack} today={today} />)
  enterRecord()
  await waitFor(() => expect(addAccountAthleteRecord).toHaveBeenCalledTimes(1))
  const record = parseAthleteRecord(vi.mocked(addAccountAthleteRecord).mock.calls[0]![0], new Date())
  if (!record) throw Error("Expected a validated synthetic athlete record")
  act(() => setActiveLocalAccount(OWNER_B))
  expect(screen.getByRole("combobox", { name: "종목 거리" })).toBeVisible()
  expect(screen.queryByRole("textbox", { name: "기록 분" })).toBeNull()
  expect(screen.queryByRole("button", { name: "기록 저장" })).toBeNull()
  fireEvent.click(screen.getByRole("button", { name: "시간 입력" }))
  expect(screen.getByRole("textbox", { name: "기록 분" })).toHaveValue("")
  expect(screen.getByRole("textbox", { name: "기록 초" })).toHaveValue("")
  await act(async () => release({ ok: true, storage: "ACCOUNT", snapshot: null,
    state: accountState({ ownerId: OWNER_A, status: "READY", records: [record], serverRevision: 1 }) }))
  expect(screen.queryByText("계정에 경기 기록을 저장했어요.")).toBeNull()
  expect(loadAthleteRecordsForAccount(OWNER_A)).toEqual([])
  expect(loadAthleteRecordsForAccount(OWNER_B)).toEqual([])
  expect(onBack).not.toHaveBeenCalled()
})

it.each(["JOURNAL", "CALENDAR", "PLAN_REVIEW"] as const)("embeds official read-only %s without mounting writable screens", async destination => {
  const onBack = vi.fn()
  render(<OracleLinkedDestination destination={destination} onBack={onBack} today={today} />)
  await waitFor(() => expect(screen.queryByText("계획을 불러오고 있어요.")).toBeNull())
  expect(screen.queryByText("이 내용은 현재 풀이 안에서 열 수 없어요.")).toBeNull()
  expect(loadAccountAthleteRecords).not.toHaveBeenCalled()
  expect(screen.queryByRole("dialog")).toBeNull()
  expect(screen.queryByRole("button", { name: /삭제|저장|계획 생성/ })).toBeNull()
  fireEvent.click(screen.getByRole("button", { name: "풀이로 돌아가기" }))
  expect(onBack).toHaveBeenCalledTimes(1)
})

it.each(["METHODS", "RECORDS", "JOURNAL", "CALENDAR", "PLAN_REVIEW"] as const)("returns from an embedded %s Reader without replacing the originating Oracle topic or scroll", async destination => {
  if (destination === "JOURNAL" || destination === "CALENDAR") seedJournal()
  const onOriginClose = vi.fn()
  function Origin() {
    const [linked, setLinked] = React.useState(false)
    return <>
      <OracleProfileReader title="내가 읽던 풀이" onClose={onOriginClose}>
        <h1>기록에서 확인한 내용</h1>
        <button type="button" onClick={() => setLinked(true)}>연결 내용 열기</button>
      </OracleProfileReader>
      {linked && <OracleProfileReader title="연결 내용" onClose={() => setLinked(false)} closeLabel={null}>
        {close => <OracleLinkedDestination destination={destination} onBack={close} today={today} />}
      </OracleProfileReader>}
    </>
  }
  render(<Origin />)
  const origin = screen.getByRole("dialog", { name: "내가 읽던 풀이" })
  const body = origin.querySelector<HTMLDivElement>(".oracle-v2__reader-body")!
  body.scrollTop = 173
  const originHistory = window.history.state
  fireEvent.click(within(origin).getByRole("button", { name: "연결 내용 열기" }))
  const linked = screen.getByRole("dialog", { name: "연결 내용" })
  if (destination === "METHODS") {
    fireEvent.click(within(linked).getByRole("button", { name: /크루즈 인터벌은 지속주와/ }))
    fireEvent.click(within(linked).getByRole("button", { name: "이전 화면" }))
    expect(screen.getByRole("dialog", { name: "연결 내용" })).toBe(linked)
    fireEvent.click(within(linked).getByRole("button", { name: "이전 화면" }))
  } else if (destination === "RECORDS") {
    enterRecord()
    await waitFor(() => expect(within(linked).getByRole("status")).toHaveTextContent("이 기기에 경기 기록을 저장했어요"))
    expect(screen.getByRole("dialog", { name: "연결 내용" })).toBe(linked)
    fireEvent.click(within(linked).getByRole("button", { name: "풀이로 돌아가기" }))
  } else {
    if (destination === "JOURNAL" || destination === "CALENDAR") {
      fireEvent.click(within(linked).getByRole("button", { name: "일지·메모 원문 열기" }))
      expect(within(linked).getByTestId("pain-review-persist")).toBeVisible()
      fireEvent.click(within(linked).getByRole("button", { name: /뒤로/ }))
      expect(within(linked).getByRole("button", { name: "일지·메모 원문 열기" })).toBeVisible()
    }
    fireEvent.click(within(linked).getByRole("button", { name: "풀이로 돌아가기" }))
  }
  await waitFor(() => expect(screen.queryByRole("dialog", { name: "연결 내용" })).toBeNull())
  expect(screen.getByRole("dialog", { name: "내가 읽던 풀이" })).toBe(origin)
  expect(within(origin).getByRole("heading", { name: "기록에서 확인한 내용" })).toBeVisible()
  expect(body.scrollTop).toBe(173)
  expect(window.history.state).toEqual(originHistory)
  expect(onOriginClose).not.toHaveBeenCalled()
})

function seedJournal(date = today) {
  expect(saveEntry({ id: "oracle-linked-evening", kind: "evening", date, savedAt: `${date}T01:00:00.000Z`,
    syncState: "local", sleepH: 7, sleepQuality: 3, weightKg: "", restingHr: "", mood: 3, painParts: { knee: 4 },
    memoPurpose: "ANALYZABLE_TRAINING_NOTE", note: "Synthetic saved original" }).ok).toBe(true)
}
it.each(["JOURNAL", "CALENDAR"] as const)("%s preserves real facts, saved original and pain warning without mutation controls", destination => {
  seedJournal()
  const before = loadEntries(), onBack = vi.fn()
  render(<OracleLinkedDestination destination={destination} onBack={onBack} today={today} />)
  expect(screen.getByText("7시간 · 입력 출처 미확인")).toBeVisible()
  fireEvent.click(screen.getByRole("button", { name: "일지·메모 원문 열기" }))
  expect(screen.getByText("Synthetic saved original")).toBeVisible()
  expect(screen.getByTestId("pain-review-persist")).toBeVisible()
  expect(screen.queryByRole("button", { name: /지우기|삭제|꾸미기|수정|복원|되돌리기|추가/ })).toBeNull()
  expect(loadEntries()).toEqual(before)
  expect(onBack).not.toHaveBeenCalled()
})

it.each(["LOADING", "ERROR", "STALE"] as const)("does not manufacture an empty calendar while journal source is %s", status => {
  calendar.override = { entries: [], owner: OWNER_A, status, revision: 0 }
  render(<OracleLinkedDestination destination="JOURNAL" onBack={() => {}} today={today} />)
  expect(screen.queryByText("이날 작성한 일지가 없어요.")).toBeNull()
  expect(screen.queryByRole("grid")).toBeNull()
  expect(screen.getByRole("status")).not.toHaveTextContent("계정 일지 조회")
})

it("drops an open guest journal original when account ownership changes", () => {
  seedJournal()
  render(<OracleLinkedDestination destination="JOURNAL" onBack={() => {}} today={today} />)
  fireEvent.click(screen.getByRole("button", { name: "일지·메모 원문 열기" }))
  act(() => setActiveLocalAccount(OWNER_B))
  expect(screen.queryByText("Synthetic saved original")).toBeNull()
})

it("reads a real stored guest plan without changing its original bytes", async () => {
  const packet = accountPlanPacketFixture(3), raw = JSON.stringify(packet.state)
  localStorage.setItem(PLAN_BETA_STORAGE_KEY, raw)
  const write = vi.spyOn(Storage.prototype, "setItem")
  render(<OracleLinkedDestination destination="PLAN_REVIEW" onBack={() => {}} today={today} />)
  await screen.findByRole("heading", { name: "보관한 훈련 일정" })
  expect(screen.getByText(/현재 안전 상태 확인이나 훈련 실행 승인이 아니에요/)).toBeVisible()
  expect(localStorage.getItem(PLAN_BETA_STORAGE_KEY)).toBe(raw)
  expect(write).not.toHaveBeenCalled()
  expect(createAccountPlanCollectionClient).not.toHaveBeenCalled()
})

function planClient(version: 3 | 4 = 3) {
  const document = emptyAccountPlanDocument(), entry = accountPlanEntry(accountPlanPacketFixture(version))
  document.data.plans.push(entry); document.data.currentPlanId = entry.planId
  const parts = splitAccountPlanCollection(document)
  const client: AccountPlanCollectionClient = {
    readIndex: vi.fn(async () => ({ revision: 1, index: parts.index })),
    readPart: vi.fn(async (_owner, kind) => kind === "PLAN_SNAPSHOT" ? parts.snapshots[0]! : parts.progress[0]!),
    readLegacy: vi.fn(async () => null), stage: vi.fn(), commit: vi.fn(), receipt: vi.fn(),
  }
  setActiveLocalAccount(OWNER_A)
  vi.mocked(accountPlansEnabled).mockReturnValue(true)
  vi.mocked(createAccountPlanCollectionClient).mockReturnValue(client)
  return client
}
it.each([3, 4] as const)("reads authenticated V%s plan parts without hydration, staging, commits or fabricated evidence", async version => {
  const client = planClient(version)
  render(<OracleLinkedDestination destination="PLAN_REVIEW" onBack={() => {}} today={today} />)
  await screen.findByRole("heading", { name: "보관한 훈련 일정" })
  if (version === 4) expect(screen.getByText(/출처 검증 대기/)).toBeVisible()
  expect(client.readPart).toHaveBeenCalledTimes(2)
  expect(client.stage).not.toHaveBeenCalled(); expect(client.commit).not.toHaveBeenCalled(); expect(client.receipt).not.toHaveBeenCalled()
})

it("rejects mismatched plan parts rather than presenting empty or invented sessions", async () => {
  const client = planClient()
  vi.mocked(client.readPart).mockResolvedValue(null)
  render(<OracleLinkedDestination destination="PLAN_REVIEW" onBack={() => {}} today={today} />)
  await screen.findByText("계획 형식 확인 필요")
  expect(screen.queryByRole("heading", { name: "보관한 훈련 일정" })).toBeNull()
  expect(screen.queryByText("현재 선택된 계획이 없어요.")).toBeNull()
})

it("does not leak a late account plan into a new owner's reader", async () => {
  const client = planClient()
  let release!: (value: Awaited<ReturnType<AccountPlanCollectionClient["readIndex"]>>) => void
  const result = await client.readIndex()
  vi.mocked(client.readIndex).mockImplementation(() => new Promise(resolve => { release = resolve }))
  render(<OracleLinkedDestination destination="PLAN_REVIEW" onBack={() => {}} today={today} />)
  vi.mocked(accountPlansEnabled).mockReturnValue(false)
  act(() => setActiveLocalAccount(OWNER_B))
  await act(async () => release(result))
  expect(screen.queryByRole("heading", { name: "보관한 훈련 일정" })).toBeNull()
  expect(client.readPart).not.toHaveBeenCalled()
  expect(screen.getByText("로그인 필요")).toBeVisible()
})

it("does not replace an unavailable account source with a stored guest plan", async () => {
  localStorage.setItem(PLAN_BETA_STORAGE_KEY, JSON.stringify(accountPlanPacketFixture(3).state))
  setActiveLocalAccount(OWNER_A)
  render(<OracleLinkedDestination destination="PLAN_REVIEW" onBack={() => {}} today={today} />)
  await screen.findByText("로그인 필요")
  expect(screen.queryByRole("heading", { name: "보관한 훈련 일정" })).toBeNull()
  expect(createAccountPlanCollectionClient).not.toHaveBeenCalled()
})

it("distinguishes failed account plan reads from an authenticated empty current pointer", async () => {
  const client = planClient()
  vi.mocked(client.readIndex).mockRejectedValue(Error("UNAVAILABLE"))
  render(<OracleLinkedDestination destination="PLAN_REVIEW" onBack={() => {}} today={today} />)
  await screen.findByText("계획 조회·저장 실패")
  expect(screen.queryByText("현재 선택된 계획이 없어요.")).toBeNull()
  expect(client.readLegacy).not.toHaveBeenCalled()
})

it("preserves malformed guest storage and does not label it empty", async () => {
  localStorage.setItem(PLAN_BETA_STORAGE_KEY, "{broken")
  render(<OracleLinkedDestination destination="PLAN_REVIEW" onBack={() => {}} today={today} />)
  await screen.findByRole("alert")
  expect(screen.queryByText("이 기기에 저장된 현재 계획이 없어요.")).toBeNull()
  expect(localStorage.getItem(PLAN_BETA_STORAGE_KEY)).toBe("{broken")
})

it.each(["JOURNAL", "CALENDAR"] as const)("%s anchors to the latest record after the first asynchronous READY snapshot", destination => {
  seedJournal("2026-09-20")
  const entries = loadEntries()
  calendar.override = { owner: OWNER_A, entries: [], status: "LOADING", revision: 0 }
  const props = { destination, today, onBack: vi.fn() }
  const view = render(<OracleLinkedDestination {...props} />)
  expect(screen.queryByRole("grid")).toBeNull()
  calendar.override = { owner: OWNER_A, entries, status: "READY", revision: 1 }
  view.rerender(<OracleLinkedDestination {...props} />)
  expect(screen.getByRole("grid", { name: "2026년 9월 달력" })).toBeVisible()
  expect(view.container.querySelector('td[aria-selected="true"] button')).toHaveAttribute("data-date", "2026-09-20")
  expect(screen.getByRole("button", { name: "일지·메모 원문 열기" })).toBeVisible()
})

it.each(["date", "month"] as const)("does not override manual %s navigation when journal READY arrives later", navigation => {
  seedJournal("2026-09-20")
  const entries = loadEntries()
  calendar.override = { owner: OWNER_A, entries: entries.map(entry => ({ ...entry, date: "2026-11-02" })), status: "STALE", revision: 0 }
  const props = { destination: "CALENDAR" as const, today, onBack: vi.fn() }
  const view = render(<OracleLinkedDestination {...props} />)
  if (navigation === "date") fireEvent.click(view.container.querySelector<HTMLButtonElement>('button[data-date="2026-10-02"]')!)
  else fireEvent.click(screen.getByRole("button", { name: "다음 달" }))
  calendar.override = { owner: OWNER_A, entries, status: "READY", revision: 1 }
  view.rerender(<OracleLinkedDestination {...props} />)
  expect(screen.getByRole("grid", { name: navigation === "date" ? "2026년 10월 달력" : "2026년 11월 달력" })).toBeVisible()
  if (navigation === "date") expect(view.container.querySelector('td[aria-selected="true"] button')).toHaveAttribute("data-date", "2026-10-02")
  expect(screen.queryByRole("grid", { name: "2026년 9월 달력" })).toBeNull()
})
