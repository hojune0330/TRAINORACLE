import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { buildTrainingHomeViewModel, type HomePlan } from "../../domain/home-view-model"
import { loadEntries, saveEntry } from "../../domain/journal-store"
import { initializeCanonicalJournalFixture } from "../../test/canonical-journal-fixture"
import { EveningCheckin } from "../log-entry/EveningCheckin"
import { TrainingHome } from "./TrainingHome"
import { Home } from "../Home"
import { localJournalScopeGeneration, setActiveLocalAccount } from "../../domain/account/local-journal-ownership"
import { resetAccountJournalProjection, setAccountJournalProjectionStatus } from "../../domain/account/account-journal-projection"
import { runDraftSafeNavigation } from "../../domain/unsaved-draft-navigation"

const rest = { day: 1, slot: "AM", role: "REST", plannedEnergyIntent: "RECOVERY_INTENT", prescription: { kind: "REST" } } as const
const work = { day: 1, slot: "PM", role: "EASY", plannedEnergyIntent: "BASE_INTENT", prescription: { kind: "RPE_TIME_RANGE", rpe: { minimum: 3, maximum: 4 }, durationMinutes: { minimum: 20, maximum: 30 } } } as const
const plan: HomePlan = { intake: { startDate: "2026-10-27" }, activePlan: { sessions: [work, rest, { ...work, day: 2 }] }, progress: [{ sessionDay: 1, sessionSlot: "PM", state: "COMPLETED" }] }
beforeEach(async () => { localStorage.clear(); setActiveLocalAccount(null); await initializeCanonicalJournalFixture() })
afterEach(() => { cleanup(); setActiveLocalAccount(null); vi.restoreAllMocks(); vi.useRealTimers() })

it("shows both dates, all AM/PM slots, rest and recorded progress without clicks", () => {
  const model = buildTrainingHomeViewModel([], [], plan, "2026-10-27")
  render(<TrainingHome model={model} />)
  const today = screen.getByRole("article", { name: "오늘 훈련" })
  const tomorrow = screen.getByRole("article", { name: "내일 훈련" })
  expect(today).toHaveTextContent(/오전.*휴식.*오후.*완료/s)
  expect(today).toHaveTextContent("전체 20–30분")
  expect(tomorrow).toHaveTextContent("전체 20–30분")
  expect(model.trainingDays?.[0]?.sessions).toHaveLength(2)
  expect(model.nextTraining?.date).toBe("2026-10-28")
})

it("opens the selected dated session while leaving its MAIN visible and unchanged", () => {
  const open = vi.fn()
  const model = buildTrainingHomeViewModel([], [], plan, "2026-10-27")
  const original = JSON.stringify(model)
  render(<TrainingHome model={model} onOpenTrainingSession={open} />)
  fireEvent.click(screen.getByRole("button", { name: "2026-10-28 오후 훈련 상세" }))
  expect(open).toHaveBeenCalledWith(plan.activePlan.sessions[2])
  expect(within(screen.getByRole("article", { name: "내일 훈련" })).getByText(/전체 20–30분/)).toBeVisible()
  expect(JSON.stringify(model)).toBe(original)
})

it("distinguishes missing dated sessions, no plan and evidence-required plans", () => {
  const model = buildTrainingHomeViewModel([], [], { ...plan, activePlan: { sessions: [rest] } }, "2026-10-27")
  const view = render(<TrainingHome model={model} />)
  expect(within(screen.getByRole("article", { name: "내일 훈련" })).getByText("예정된 훈련이 없어요.")).toBeVisible()
  view.rerender(<TrainingHome model={buildTrainingHomeViewModel([], [], null, "2026-10-27")} />)
  expect(screen.queryByRole("article", { name: "오늘 훈련" })).toBeNull()
  expect(screen.getByRole("button", { name: "훈련 계획 만들기" })).toBeVisible()
  view.rerender(<TrainingHome model={model} planReadiness="EVIDENCE_REQUIRED" />)
  expect(screen.queryByText("전체 20–30분")).toBeNull()
  expect(screen.queryByRole("article")).toBeNull()
  expect(screen.getByRole("status")).toHaveTextContent("출처 확인이 필요")
})

it("keeps memo and optional workout entry in one region and excludes every example promotion", () => {
  const write = vi.fn(), example = vi.fn()
  render(<TrainingHome model={buildTrainingHomeViewModel([], [], null, "2026-10-27")} onWriteLog={write} onOpenGuide={example}
    oraclePreview={<p>오라클 결과 예시 보기</p>} inlineMemo={<EveningCheckin presentation="home-inline" targetDate="2026-10-27" />} />)
  const region = screen.getByRole("region", { name: "오늘의 기록" })
  expect(within(region).getByRole("textbox", { name: "오늘의 메모" })).toBeVisible()
  fireEvent.click(within(region).getByRole("button", { name: "운동 내용도 기록하기" }))
  expect(write).toHaveBeenCalledWith("quick-session")
  expect(screen.queryByText(/예시/)).toBeNull()
  expect(screen.queryByRole("button", { name: "컨디션·메모" })).toBeNull()
  expect(loadEntries()).toHaveLength(0)
})

it.each([ ["PENDING", "계정 저장을 기다리고"], ["CONFLICT", "수정과 겹쳤어요"], ["AUTH_REQUIRED", "다시 로그인"], ["INVALID", "계획을 확인할 수 없어요"], ["REJECTED", "계획을 저장하지 못했어요"] ] as const)("keeps %s plan state explicit and hides executable guidance", (status, message) => {
  render(<TrainingHome model={buildTrainingHomeViewModel([], [], plan, "2026-10-27")} planReadiness={status} />)
  expect(screen.getByText(new RegExp(message))).toBeVisible()
  expect(screen.queryByRole("article")).toBeNull()
  expect(screen.queryByText(/확인하고 있어요/)).toBeNull()
})

it("saves an explicit memo inline through canonical evening storage with missing measurements", async () => {
  const done = vi.fn()
  render(<EveningCheckin presentation="home-inline" targetDate="2026-10-27" onDone={done} />)
  fireEvent.change(screen.getByRole("textbox", { name: "오늘의 메모" }), { target: { value: "합성 홈 메모" } })
  fireEvent.click(screen.getByRole("button", { name: "저장" }))
  expect(screen.getByRole("alert")).toHaveTextContent("저장할 방법")
  expect(done).not.toHaveBeenCalled()
  expect(loadEntries()).toHaveLength(0)
  fireEvent.click(screen.getByRole("radio", { name: "훈련 메모" }))
  fireEvent.click(screen.getByRole("button", { name: "저장" }))
  await waitFor(() => expect(done).toHaveBeenCalledOnce())
  expect(loadEntries()).toHaveLength(1)
  expect(loadEntries()[0]).toMatchObject({ kind: "evening", date: "2026-10-27", note: "합성 홈 메모", memoPurpose: "ANALYZABLE_TRAINING_NOTE",
    fieldProvenance: { sleepH: { provenance: "MISSING" }, painParts: { provenance: "MISSING" }, mood: { provenance: "MISSING" } } })
})

it("keeps inline input after storage failure without a success callback", async () => {
  const done = vi.fn()
  render(<EveningCheckin presentation="home-inline" targetDate="2026-10-27" onDone={done} />)
  fireEvent.change(screen.getByRole("textbox", { name: "오늘의 메모" }), { target: { value: "합성 실패 메모" } })
  fireEvent.click(screen.getByRole("radio", { name: "훈련 메모" }))
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw Error("synthetic unavailable storage") })
  fireEvent.click(screen.getByRole("button", { name: "저장" }))
  await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("저장하지 못했어요"))
  expect(screen.getByRole("textbox", { name: "오늘의 메모" })).toHaveValue("합성 실패 메모")
  expect(done).not.toHaveBeenCalled()
})

it("keeps one save after memo purpose and optional condition inputs", () => {
  render(<EveningCheckin presentation="home-inline" targetDate="2026-10-27" />)
  const text = screen.getByRole("textbox", { name: "오늘의 메모" })
  const purpose = screen.getByRole("group", { name: "메모 용도" })
  const save = screen.getByRole("button", { name: "저장" })
  const conditions = screen.getByText("컨디션 추가")
  expect(text.compareDocumentPosition(purpose) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0)
  expect(purpose.compareDocumentPosition(save) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0)
  expect(conditions.compareDocumentPosition(save) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0)
  expect(screen.getAllByRole("button", { name: "저장" })).toHaveLength(1)
  const storageGuide = screen.getByText("메모 보관 안내").closest("details")!
  expect(storageGuide.open).toBe(false)
  expect(text.getAttribute("aria-describedby")).toBe("home-evening-note-purpose-explanation")
  expect(storageGuide.querySelector("#home-evening-note-purpose-explanation")).toBeNull()
  expect(screen.getByText("공유·분석에 쓰지 않아요")).toBeVisible()
  expect(screen.getByText("저장 전 내용을 자동 확인해요")).toBeVisible()
  expect(screen.queryByText("보관 방식 자세히")).toBeNull()
  expect(save.compareDocumentPosition(screen.getByText("새로고침 전 저장해 주세요.")) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0)
  expect(screen.getByRole("radio", { name: "나만의 메모" })).not.toBeChecked()
  expect(screen.getByRole("radio", { name: "훈련 메모" })).not.toBeChecked()
  fireEvent.click(screen.getByRole("radio", { name: "훈련 메모" }))
  expect(screen.getByText("이 기기에서 확인하며, 훈련 계획의 근거로 쓰지 않아요.")).toBeVisible()
  expect(storageGuide.open).toBe(false)
})

it("keeps the single save below every opened condition stage and permits a condition-only record", async () => {
  const done = vi.fn()
  render(<EveningCheckin presentation="home-inline" targetDate="2026-10-27" onDone={done} />)
  fireEvent.click(screen.getByText("컨디션 추가"))
  for (const name of ["몸 상태", "수면", "체중·심박", "기분"]) {
    fireEvent.click(screen.getByRole("button", { name }))
    const save = screen.getByRole("button", { name: "저장" })
    expect(screen.getAllByRole("button", { name: "저장" })).toHaveLength(1)
    const condition = document.querySelector(".home-hub__condition-input")!
    expect(condition.compareDocumentPosition(save) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0)
    if (name !== "기분") {
      fireEvent.click(screen.getByRole("button", { name: "다른 항목" }))
      fireEvent.click(screen.getByText("컨디션 추가"))
    }
  }
  fireEvent.click(screen.getByRole("button", { name: "기분 4 좋음" }))
  fireEvent.click(screen.getByRole("button", { name: "저장" }))
  await waitFor(() => expect(done).toHaveBeenCalledOnce())
  expect(loadEntries()[0]).toMatchObject({ kind: "evening", mood: 4, note: "" })
})

it("requires completion of Korean IME composition before an explicit save", async () => {
  const done = vi.fn()
  render(<EveningCheckin presentation="home-inline" targetDate="2026-10-27" onDone={done} />)
  const text = screen.getByRole("textbox", { name: "오늘의 메모" })
  fireEvent.compositionStart(text)
  fireEvent.change(text, { target: { value: "합성 입력 중" } })
  fireEvent.click(screen.getByRole("radio", { name: "훈련 메모" }))
  fireEvent.click(screen.getByRole("button", { name: "저장" }))
  expect(screen.getByRole("status")).toHaveTextContent("글자 입력을 마친 뒤")
  expect(done).not.toHaveBeenCalled()
  expect(loadEntries()).toHaveLength(0)
  fireEvent.compositionEnd(text)
  fireEvent.click(screen.getByRole("button", { name: "저장" }))
  await waitFor(() => expect(done).toHaveBeenCalledOnce())
})

it("keeps an exact saved-record destination and a fresh blank memo without exposing saved text", async () => {
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(new Date("2026-10-27T12:00:00"))
  const open = vi.fn()
  render(<Home onOpenDay={open} />)
  expect(screen.queryByText("새 메모 · 2026·10·27")).toBeNull()
  fireEvent.change(screen.getByRole("textbox", { name: "오늘의 메모" }), { target: { value: "합성 정확 기록" } })
  fireEvent.click(screen.getByRole("radio", { name: "훈련 메모" }))
  fireEvent.click(screen.getByRole("button", { name: "저장" }))
  await waitFor(() => expect(screen.getByRole("button", { name: "최근 저장한 기록 보기" })).toBeVisible())
  const saved = loadEntries()[0]!
  expect(saved).toMatchObject({ kind: "evening", date: "2026-10-27" })
  expect(document.querySelector(".home-hub__memo-receipt")).not.toHaveTextContent("합성 정확 기록")
  expect(document.querySelector(".home-hub__memo-receipt img")).toHaveAttribute("width", "32")
  fireEvent.click(screen.getByRole("button", { name: "최근 저장한 기록 보기" }))
  expect(open).toHaveBeenCalledWith(saved.date, saved.id)
  expect(screen.getByRole("textbox", { name: "오늘의 메모" })).toHaveValue("")
  expect(screen.getByRole("radio", { name: "훈련 메모" })).not.toBeChecked()
  expect(screen.getByRole("button", { name: "최근 저장한 기록 보기" })).toBeVisible()
  expect(screen.queryByRole("button", { name: "새 메모 쓰기" })).toBeNull()
  expect(loadEntries()).toHaveLength(1)
  fireEvent.change(screen.getByRole("textbox", { name: "오늘의 메모" }), { target: { value: "합성 두 번째 기록" } })
  const confirm = vi.spyOn(window, "confirm").mockReturnValue(false)
  fireEvent.click(screen.getByRole("button", { name: "최근 저장한 기록 보기" }))
  expect(confirm).toHaveBeenCalledOnce()
  expect(open).toHaveBeenCalledTimes(1)
  expect(screen.getByRole("textbox", { name: "오늘의 메모" })).toHaveValue("합성 두 번째 기록")
  fireEvent.click(screen.getByRole("radio", { name: "훈련 메모" }))
  fireEvent.click(screen.getByRole("button", { name: "저장" }))
  await waitFor(() => expect(loadEntries()).toHaveLength(2))
  await waitFor(() => expect(screen.getByRole("textbox", { name: "오늘의 메모" })).toHaveValue(""))
})

it("creates a new memo instead of selecting or overwriting today's existing evening record", async () => {
  saveEntry({ id: "synthetic-existing-evening", kind: "evening", date: "2026-10-27", savedAt: "2026-10-27T01:00:00Z", syncState: "local",
    sleepH: 7, sleepQuality: 0, weightKg: "", restingHr: "", painParts: {}, mood: 0, note: "합성 기존 메모", memoPurpose: "ANALYZABLE_TRAINING_NOTE" })
  const done = vi.fn()
  render(<EveningCheckin presentation="home-inline" targetDate="2026-10-27" onDone={done} />)
  expect(screen.getByRole("textbox", { name: "오늘의 메모" })).toHaveValue("")
  fireEvent.change(screen.getByRole("textbox", { name: "오늘의 메모" }), { target: { value: "합성 새 메모" } })
  fireEvent.click(screen.getByRole("radio", { name: "훈련 메모" }))
  fireEvent.click(screen.getByRole("button", { name: "저장" }))
  await waitFor(() => expect(done).toHaveBeenCalledOnce())
  expect(loadEntries()).toHaveLength(2)
  expect(loadEntries().find(entry => entry.id === "synthetic-existing-evening")).toMatchObject({ note: "합성 기존 메모", sleepH: 7 })
  expect(loadEntries().find(entry => entry.id !== "synthetic-existing-evening")).toMatchObject({ kind: "evening", note: "합성 새 메모", sleepH: 0 })
})

it("registers actual Home memo with the existing denied-navigation guard", () => {
  const confirm = vi.spyOn(window, "confirm").mockReturnValue(false)
  const leave = vi.fn()
  render(<Home />)
  fireEvent.change(screen.getByRole("textbox", { name: "오늘의 메모" }), { target: { value: "합성 미저장 메모" } })
  expect(runDraftSafeNavigation(leave)).toBe(false)
  expect(confirm).toHaveBeenCalledOnce()
  expect(leave).not.toHaveBeenCalled()
  expect(screen.getByRole("textbox", { name: "오늘의 메모" })).toHaveValue("합성 미저장 메모")
  expect(loadEntries()).toHaveLength(0)
})

it("keeps the composing date across midnight and does not transfer input across accounts", () => {
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(new Date("2026-10-27T12:00:00"))
  const confirm = vi.spyOn(window, "confirm").mockReturnValue(false)
  render(<Home />)
  fireEvent.change(screen.getByRole("textbox", { name: "오늘의 메모" }), { target: { value: "합성 전날 초안" } })
  vi.setSystemTime(new Date("2026-10-28T12:00:00"))
  act(() => window.dispatchEvent(new Event("focus")))
  expect(screen.getByText(/2026·10·27에 쓰기 시작한 기록/)).toBeVisible()
  fireEvent.click(screen.getByRole("button", { name: "오늘 날짜로 새로 쓰기" }))
  expect(confirm).toHaveBeenCalledOnce()
  expect(screen.getByRole("textbox", { name: "오늘의 메모" })).toHaveValue("합성 전날 초안")
  act(() => setActiveLocalAccount("synthetic-other-home-owner"))
  expect(screen.getByRole("textbox", { name: "오늘의 메모" })).toHaveValue("")
  expect(loadEntries()).toHaveLength(0)
})

it("rolls only an untouched empty composer to the current date", () => {
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(new Date("2026-10-27T12:00:00"))
  render(<Home />)
  fireEvent.focus(screen.getByRole("textbox", { name: "오늘의 메모" }))
  fireEvent.click(screen.getByRole("textbox", { name: "오늘의 메모" }))
  vi.setSystemTime(new Date("2026-10-28T12:00:00"))
  act(() => window.dispatchEvent(new Event("focus")))
  expect(screen.queryByText(/에 쓰기 시작한 기록/)).toBeNull()
  fireEvent.change(screen.getByRole("textbox", { name: "오늘의 메모" }), { target: { value: "입력 후 지움" } })
  fireEvent.change(screen.getByRole("textbox", { name: "오늘의 메모" }), { target: { value: "" } })
  vi.setSystemTime(new Date("2026-10-29T12:00:00"))
  act(() => window.dispatchEvent(new Event("focus")))
  expect(screen.getByText(/2026·10·28에 쓰기 시작한 기록/)).toBeVisible()
})

it("blocks navigation during composition even before a character is accepted", () => {
  const leave = vi.fn()
  render(<Home />)
  fireEvent.compositionStart(screen.getByRole("textbox", { name: "오늘의 메모" }))
  expect(runDraftSafeNavigation(leave)).toBe(false)
  expect(leave).not.toHaveBeenCalled()
  fireEvent.compositionEnd(screen.getByRole("textbox", { name: "오늘의 메모" }))
  expect(runDraftSafeNavigation(leave)).toBe(true)
})

it.each([undefined, "UNKNOWN"] as const)("keeps storage visible and avoids a success claim for %s receipt metadata", storageStatus => {
  render(<Home memoReceipt={{ scopeGeneration: localJournalScopeGeneration(), id: "synthetic-receipt", kind: "evening", date: "2026-10-27", savedAt: "2026-10-27T01:23:00Z", storage: "합성 보관 상태 확인 필요", ...(storageStatus ? { storageStatus } : {}) }} />)
  const receipt = document.querySelector(".home-hub__memo-receipt")!
  expect(receipt).toHaveTextContent("저장 상태 확인 필요")
  expect(within(receipt as HTMLElement).getByText("합성 보관 상태 확인 필요")).toBeVisible()
  expect(receipt.querySelector("details")).toBeNull()
  expect(receipt.querySelector("img")).toBeNull()
  expect(receipt).not.toHaveTextContent("저장됨")
})

it.each(["PENDING", "CONFLICT", "FAILED"] as const)("does not hide %s storage behind a normal account receipt", status => {
  setActiveLocalAccount("synthetic-receipt-owner")
  resetAccountJournalProjection("synthetic-receipt-owner")
  setAccountJournalProjectionStatus("synthetic-receipt-owner", status)
  render(<Home memoReceipt={{ scopeGeneration: localJournalScopeGeneration(), id: "synthetic-account-receipt", kind: "evening", date: "2026-10-27", savedAt: "2026-10-27T01:23:00Z", storage: "합성 보관 상태 확인 필요", storageStatus: "ACCOUNT" }} />)
  const receipt = document.querySelector(".home-hub__memo-receipt")!
  expect(receipt).toHaveTextContent("저장 상태 확인 필요")
  expect(within(receipt as HTMLElement).getByText("합성 보관 상태 확인 필요")).toBeVisible()
  expect(receipt.querySelector("details")).toBeNull()
  expect(receipt.querySelector("img")).toBeNull()
})

it("does not replay a saved character when a confirmed receipt mounts or rerenders", () => {
  const receipt = { scopeGeneration: localJournalScopeGeneration(), id: "synthetic-confirmed-receipt", kind: "evening" as const, date: "2026-10-27", savedAt: "2026-10-27T01:23:00Z", storage: "합성 확인된 기기 보관", storageStatus: "LOCAL" as const }
  const view = render(<Home memoReceipt={receipt} />)
  expect(document.querySelector(".home-hub__memo-receipt")).toHaveTextContent(/저장됨 · \d{2}:\d{2}/)
  expect(screen.getByText("보관 상태").closest("details")).not.toHaveAttribute("open")
  expect(document.querySelector(".home-hub__save-character img")).toBeNull()
  view.rerender(<Home memoReceipt={{ ...receipt }} />)
  expect(document.querySelector(".home-hub__save-character img")).toBeNull()
})
