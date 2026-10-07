import React from "react"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"

const source = vi.hoisted(() => ({ complete: false, personal: false, planState: null as unknown, planReadKind: "missing" as "missing" | "loaded" | "storage_error" }))
vi.mock("./hooks/useCalendarEntries", () => ({ useCalendarSnapshot: () => ({ status: "READY", entries: [] }) }))
vi.mock("./hooks/useAthleteRecordsSnapshot", () => ({ useAthleteRecordsSnapshot: () => ({ status: "READY", records: [] }) }))
vi.mock("./hooks/usePlanEvidenceHistory", () => ({ usePlanEvidenceHistory: () => ({ journalReadComplete: source.complete, history: { kind: "empty" } }) }))
vi.mock("./domain/plan-beta-store", () => ({
  loadPlanBetaState: () => source.planState,
  readPlanBetaStateFromStorage: () => source.planReadKind === "loaded"
    ? { kind: "loaded", state: source.planState }
    : { kind: source.planReadKind },
}))
vi.mock("./domain/oracle-personal-result", () => ({ buildOraclePersonalResult: () => ({
  status: source.personal ? "ready" : "missing", headline: "합성 개인 결과", source: "합성 기록",
  rows: source.personal ? [{ label: "5000m", value: "20:00" }] : [],
}) }))
vi.mock("./components/AppShellFrame", () => ({ AppShellFrame: ({ children }: { children: React.ReactNode }) => children }))
vi.mock("./screens/Home", () => ({ Home: ({ oraclePreview, oraclePreviewLabel }: { oraclePreview: React.ReactNode; oraclePreviewLabel: string }) => <main><h1>{oraclePreviewLabel}</h1>{oraclePreview}</main> }))
vi.mock("./DeferredMobileScreens", () => ({ DeferredMobileScreens: {
  Trends: () => <h1>기록 상태 확인 화면</h1>, PlanProposalInbox: () => null,
} }))
import { AppShell } from "./AppShell"
import { stateFixture } from "./domain/plan-beta-store.test-fixture"

beforeEach(() => { localStorage.clear(); sessionStorage.clear(); window.history.replaceState(null, "", "/?app=1"); source.complete = false; source.personal = false; source.planState = null; source.planReadKind = "missing" })
afterEach(cleanup)

it("waits for the journal read before offering an example and routes incomplete reads to the records status", () => {
  source.planState = stateFixture()
  source.planReadKind = "loaded"
  render(<AppShell />)
  expect(screen.getByRole("heading", { name: "오라클 기록 상태" })).toBeVisible()
  expect(screen.queryByText("오라클 결과 예시 보기")).toBeNull()
  fireEvent.click(screen.getByRole("button", { name: "기록 상태 확인" }))
  expect(screen.getByRole("heading", { name: "기록 상태 확인 화면" })).toBeVisible()
})

it("offers an explicitly labelled example only after all sources are confirmed empty", () => {
  source.complete = true
  render(<AppShell />)
  expect(screen.getByRole("heading", { name: "오라클 결과 예시 보기" })).toBeVisible()
})

it("uses the existing plan-progress summary when no personal Oracle candidate has rows", () => {
  source.complete = true
  source.planState = stateFixture()
  source.planReadKind = "loaded"
  render(<AppShell />)

  expect(screen.getByRole("heading", { name: "내 계획 진행" })).toBeVisible()
  expect(document.querySelector('[data-oracle-kind="plan"]')).toBeInTheDocument()
  expect(screen.getByRole("heading", { name: "저장한 훈련 계획" })).toBeVisible()
  expect(screen.getByText("예정 1회 중 완료 표시 0회")).toBeVisible()
  expect(screen.getByText(/완료 표시는 실제 일지와 다른 기록이에요/u)).toBeVisible()
  expect(screen.queryByText(/합성 개인 결과|월별 훈련|결과 예시/u)).toBeNull()
  fireEvent.click(screen.getByRole("button", { name: "이 결과 자세히 보기" }))
  expect(screen.getByRole("heading", { name: "기록 상태 확인 화면" })).toBeVisible()
})

it("does not offer an example when the active plan read fails", () => {
  source.complete = true
  source.planReadKind = "storage_error"
  render(<AppShell />)

  expect(screen.getByRole("heading", { name: "오라클 기록 상태" })).toBeVisible()
  expect(screen.getByText("저장한 훈련 계획을 확인하지 못했어요.")).toBeVisible()
  expect(screen.queryByText("오라클 결과 예시 보기")).toBeNull()
})

it("still uses an eligible race record while the independent journal read is incomplete", () => {
  source.personal = true
  source.planState = stateFixture()
  source.planReadKind = "loaded"
  render(<AppShell />)
  expect(screen.getByRole("heading", { name: "내 기록으로 본 오라클" })).toBeVisible()
  expect(screen.getByText("합성 개인 결과")).toBeVisible()
  expect(screen.queryByText("예정 1회 중 완료 표시 0회")).toBeNull()
})
