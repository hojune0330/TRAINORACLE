import React from "react"
import { act, cleanup, render, renderHook, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { usePlanEvidenceHistory } from "./usePlanEvidenceHistory"
import { ACCOUNT_PLAN_EVENT, type AccountPlanService } from "../domain/account/account-plan-service"
import { accountPlanEntry, emptyAccountPlanDocument, materializeAccountPlan } from "../domain/account/account-plan-document-schema"
import { setActiveLocalAccount } from "../domain/account/local-journal-ownership"
import { replacedReplanFixture } from "../domain/execution-replan-lineage.test-fixture"
import { readArchivedOriginalPlans } from "../domain/plan-beta-store"
import { collectSessionExplanationEvidence } from "../domain/session-explanation-evidence"
import { PlanAdaptationFlow } from "../screens/plan-beta/PlanAdaptationFlow"
import { SessionExplanationEntry } from "../screens/plan-beta/SessionExplanation"
import { PlanEvidenceHistoryNotice } from "../components/PlanEvidenceHistoryNotice"
import { resetAccountJournalProjection, setAccountJournalProjectionStatus } from "../domain/account/account-journal-projection"
import { planHistorySnapshotContent } from "../domain/plan-history-snapshot-content"

const runtime = vi.hoisted(() => ({ enabled: true, service: null as AccountPlanService | null }))
vi.mock("../domain/account/account-plan-service", async original => ({
  ...await original<typeof import("../domain/account/account-plan-service")>(),
  accountPlansEnabled: () => runtime.enabled, accountPlanService: () => runtime.service,
}))
const announce = () => window.dispatchEvent(new Event(ACCOUNT_PLAN_EVENT))
const savedDialog = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "showModal")
const savedScroll = Object.getOwnPropertyDescriptor(Element.prototype, "scrollTo")
beforeEach(() => {
  runtime.enabled = true; localStorage.clear(); sessionStorage.clear(); setActiveLocalAccount("synthetic-a")
  resetAccountJournalProjection("synthetic-a"); setAccountJournalProjectionStatus("synthetic-a", "READY")
  vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-10-01T03:00:00Z"))
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true, value: function (this: HTMLDialogElement) { this.setAttribute("open", "") } })
  Object.defineProperty(Element.prototype, "scrollTo", { configurable: true, value: vi.fn(function (this: Element, o: ScrollToOptions) { this.scrollTop = o.top ?? this.scrollTop }) })
  vi.stubGlobal("fetch", vi.fn(() => { throw Error("Synthetic test forbids network") }))
})
afterEach(() => {
  cleanup(); runtime.service = null; setActiveLocalAccount(null); resetAccountJournalProjection(null); vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks()
  for (const [p, k, d] of [[HTMLDialogElement.prototype, "showModal", savedDialog], [Element.prototype, "scrollTo", savedScroll]] as const) {
    if (d) Object.defineProperty(p, k, d); else Reflect.deleteProperty(p, k)
  }
})

function fixture() {
  const f = replacedReplanFixture(), document = emptyAccountPlanDocument()
  const current = accountPlanEntry({ state: f.state, evidence: null })
  document.data.currentPlanId = current.planId
  document.data.plans = [...f.archivedPlans.map(state => ({ ...accountPlanEntry({ state, evidence: null }), archivedAt: new Date().toISOString() })), current]
  const projection = { ...document, data: { ...document.data, plans: [current] } }
  const view = { status: "READY", confirmedDocument: projection as typeof document | null,
    currentPlan: { kind: "read_only", planId: current.planId, packet: materializeAccountPlan(current) },
    historyLoaded: false, historyStatus: "IDLE", totalPlans: document.data.plans.length }
  let finish!: (ready: boolean) => void
  const loadHistory = vi.fn(() => {
    view.historyStatus = "LOADING"; announce()
    return new Promise<boolean>(resolve => { finish = ready => {
      if (ready) { view.confirmedDocument = document; view.historyLoaded = true }
      view.historyStatus = ready ? "READY" : "FAILED"; announce(); resolve(ready)
    } })
  })
  const service = { snapshot: () => structuredClone(view), loadHistory } as unknown as AccountPlanService
  runtime.service = service
  const entries = [{ ...f.entries[0]!, rpe: 3, activityOutcome: "COMPLETED" as const, planExecutionRelation: "AS_PLANNED" as const,
    fieldProvenance: { rpe: { provenance: "EXPLICIT" as const } } }]
  return { ...f, entries, service, view, loadHistory, complete: (ready = true) => finish(ready) }
}

it("does not fetch account history from an inactive/example view", () => {
  const f = fixture(), { result } = renderHook(() => usePlanEvidenceHistory(false))
  expect(result.current.history.kind).toBe("unavailable")
  expect(f.loadHistory).not.toHaveBeenCalled()
})

it("loads exact originals on demand without writing plans or browser storage", async () => {
  const f = fixture(), before = Object.entries(localStorage), current = structuredClone(f.view.currentPlan)
  const { result } = renderHook(() => usePlanEvidenceHistory(true))
  await waitFor(() => expect(f.loadHistory).toHaveBeenCalledOnce())
  expect(result.current.status).toBe("loading")
  expect(result.current.history.kind).toBe("unavailable")
  await act(async () => f.complete())
  expect(result.current.status).toBe("ready")
  expect(result.current.history).toMatchObject({ kind: "loaded", plans: f.archivedPlans })
  expect(f.view.currentPlan).toEqual(current)
  expect(Object.entries(localStorage)).toEqual(before)
})

it("waits for account hydration and never labels a current-only projection as empty", async () => {
  const f = fixture(), projection = f.view.confirmedDocument
  f.view.confirmedDocument = null; f.view.status = "LOADING"
  const { result } = renderHook(() => usePlanEvidenceHistory(true))
  expect(f.loadHistory).not.toHaveBeenCalled()
  expect(result.current.status).toBe("loading")
  await act(async () => { f.view.confirmedDocument = projection; f.view.status = "READY"; announce() })
  await waitFor(() => expect(f.loadHistory).toHaveBeenCalledOnce())
  await act(async () => f.complete())
  expect(result.current.history.kind).toBe("loaded")
})

it("keeps failures unavailable and retries only when requested", async () => {
  const f = fixture(), { result, rerender } = renderHook(() => usePlanEvidenceHistory(true))
  await act(async () => f.complete(false))
  expect(result.current.status).toBe("unavailable")
  rerender(); await act(async () => announce())
  expect(f.loadHistory).toHaveBeenCalledOnce()
  await act(async () => result.current.retry())
  expect(f.loadHistory).toHaveBeenCalledTimes(2)
  await act(async () => f.complete())
  expect(result.current.status).toBe("ready")
})

it("does not restart a cancelled shared request automatically", async () => {
  const f = fixture(), { result } = renderHook(() => usePlanEvidenceHistory(true))
  await act(async () => { f.complete(false); f.view.historyStatus = "IDLE"; announce() })
  expect(f.loadHistory).toHaveBeenCalledOnce()
  expect(result.current.status).toBe("unavailable")
})

it.each([false, true])("discards a late response after service replacement (account also changed: %s)", async changeAccount => {
  const a = fixture(), { result } = renderHook(() => usePlanEvidenceHistory(true))
  const b = fixture()
  await act(async () => { if (changeAccount) setActiveLocalAccount("synthetic-b"); announce() })
  await waitFor(() => expect(b.loadHistory).toHaveBeenCalledOnce())
  await act(async () => a.complete())
  expect(result.current.history.kind).toBe("unavailable")
  expect(result.current.status).toBe("loading")
  await act(async () => b.complete())
  expect(result.current.status).toBe("ready")
})

it("closing a view does not cancel a shared load or reopen the view", async () => {
  const f = fixture(), { result, rerender } = renderHook(({ active }) => usePlanEvidenceHistory(active), { initialProps: { active: true } })
  rerender({ active: false })
  await act(async () => f.complete())
  expect(result.current.status).toBe("ready")
  rerender({ active: true })
  expect(f.loadHistory).toHaveBeenCalledOnce()
})

it("rereads a guest archive after explicit retry without using the account service", async () => {
  fixture(); runtime.enabled = false; setActiveLocalAccount(null)
  let broken = true
  const read = () => { if (broken) throw Error("synthetic storage denied"); return { kind: "loaded" as const, plans: [] } }
  const { result } = renderHook(() => usePlanEvidenceHistory(true, read))
  expect(result.current.status).toBe("unavailable")
  broken = false
  await act(async () => result.current.retry())
  expect(result.current.history).toEqual({ kind: "loaded", plans: [] })
})

it("the real cycle view recovers archived evidence with one open, no invented next candidate", async () => {
  const f = fixture(), user = userEvent.setup()
  render(<PlanAdaptationFlow state={f.state} onLoadEntries={() => f.entries} onLoadPending={async () => null} />)
  await waitFor(() => expect(screen.getByRole("button", { name: "이번 주기 기록 확인" })).toBeEnabled())
  expect(f.loadHistory).not.toHaveBeenCalled()
  await user.click(screen.getByRole("button", { name: "이번 주기 기록 확인" }))
  expect(await screen.findByText("이전 계획과 연결된 기록을 확인하고 있어요.")).toBeVisible()
  await act(async () => f.complete())
  expect(screen.getByText("현재 계획에 연결된 훈련 1건")).toBeVisible()
  expect(screen.getByRole("heading", { name: "이번 주기 기록 요약" })).toBeVisible()
  expect(screen.queryByRole("button", { name: "이 다음 계획 선택하기" })).toBeNull()
})

it("the saved-session reader refreshes evidence without changing tab or scroll", async () => {
  const f = fixture(), user = userEvent.setup(), session = f.state.activePlan.sessions[0]!
  render(<SessionExplanationEntry session={session} initialTab="주기·기록"
    context={{ kind: "SAVED", plan: f.state.activePlan, generatedAt: f.state.generatedAt }}
    loadEvidence={() => collectSessionExplanationEvidence(f.entries, f.state, session, readArchivedOriginalPlans())} />)
  await user.click(screen.getByRole("button", { name: "훈련 방법과 이유" }))
  const panel = screen.getByRole("tabpanel")
  panel.scrollTop = 113
  await act(async () => f.complete())
  expect(screen.getByRole("tab", { name: "주기·기록" })).toHaveAttribute("aria-selected", "true")
  expect(panel.scrollTop).toBe(113)
  expect(screen.getByText("직접 기록한 RPE 3")).toBeVisible()
  expect(screen.queryByRole("button", { name: "이전 계획 다시 불러오기" })).toBeNull()
})

it("closes a saved-session reader immediately on account change", async () => {
  const f = fixture(), user = userEvent.setup(), session = f.state.activePlan.sessions[0]!
  render(<SessionExplanationEntry session={session} initialTab="주기·기록"
    context={{ kind: "SAVED", plan: f.state.activePlan, generatedAt: f.state.generatedAt }} />)
  await user.click(screen.getByRole("button", { name: "훈련 방법과 이유" }))
  await act(async () => setActiveLocalAccount("synthetic-b"))
  expect(screen.queryByRole("dialog")).toBeNull()
  await act(async () => f.complete())
  expect(screen.queryByRole("dialog")).toBeNull()
})

it("an eventless guest retry refreshes the real reader evidence and preserves scroll", async () => {
  const f = fixture(), user = userEvent.setup(), session = f.state.activePlan.sessions[0]!
  runtime.enabled = false; setActiveLocalAccount(null); resetAccountJournalProjection(null)
  const key = "trainoracle.plan-beta.history.v1"
  localStorage.setItem(key, "broken")
  render(<SessionExplanationEntry session={session} initialTab="주기·기록"
    context={{ kind: "SAVED", plan: f.state.activePlan, generatedAt: f.state.generatedAt }}
    loadEvidence={() => collectSessionExplanationEvidence(f.entries, f.state, session, readArchivedOriginalPlans())} />)
  await user.click(screen.getByRole("button", { name: "훈련 방법과 이유" }))
  expect(screen.queryByText("직접 기록한 RPE 3")).toBeNull()
  const panel = screen.getByRole("tabpanel"); panel.scrollTop = 91
  localStorage.setItem(key, JSON.stringify(f.archivedPlans.map(p => planHistorySnapshotContent(p, new Date().toISOString(), "MANUAL"))))
  await user.click(screen.getByRole("button", { name: "이전 계획 다시 불러오기" }))
  expect(screen.getByText("직접 기록한 RPE 3")).toBeVisible()
  expect(panel.scrollTop).toBe(91)
})

it("late account journals update the open cycle without a second click and never claim an empty completed read", async () => {
  const f = fixture(), user = userEvent.setup()
  let entries = [] as typeof f.entries
  const loadEntries = () => entries
  setAccountJournalProjectionStatus("synthetic-a", "LOADING")
  render(<PlanAdaptationFlow state={f.state} onLoadEntries={loadEntries} onLoadPending={async () => null} />)
  await waitFor(() => expect(screen.getByRole("button", { name: "이번 주기 기록 확인" })).toBeEnabled())
  await user.click(screen.getByRole("button", { name: "이번 주기 기록 확인" }))
  await act(async () => f.complete())
  expect(screen.getByText("일지를 아직 모두 불러오지 못했어요. 조회가 끝나면 비교가 나타나요.")).toBeVisible()
  expect(screen.queryByText("현재 계획과 연결해 비교할 일지가 없어요")).toBeNull()
  await act(async () => { entries = f.entries; setAccountJournalProjectionStatus("synthetic-a", "READY") })
  expect(screen.getByText("현재 계획에 연결된 훈련 1건")).toBeVisible()
  expect(f.loadHistory).toHaveBeenCalledOnce()
})

it("initial account-read failure gives honest recovery guidance instead of a nonfunctional history retry", () => {
  const f = fixture(); f.view.confirmedDocument = null; f.view.status = "FAILED"
  function View() {
    const history = usePlanEvidenceHistory(true)
    return <PlanEvidenceHistoryNotice status={history.status} onRetry={history.retry} />
  }
  render(<View />)
  expect(screen.getByText(/계정의 계획을 불러오지 못했어요/u)).toBeVisible()
  expect(screen.queryByRole("button", { name: "이전 계획 다시 불러오기" })).toBeNull()
  expect(f.loadHistory).not.toHaveBeenCalled()
})
