import React from "react"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"

const source = vi.hoisted(() => ({ complete: false, planState: null as unknown, planReadKind: "missing" as "missing" | "loaded" | "storage_error" }))
vi.mock("./hooks/useCalendarEntries", () => ({ useCalendarSnapshot: () => ({ status: "READY", entries: [] }) }))
vi.mock("./hooks/usePlanEvidenceHistory", () => ({ usePlanEvidenceHistory: () => ({ journalReadComplete: source.complete, history: { kind: "empty" } }) }))
vi.mock("./domain/plan-beta-store", () => ({
  loadPlanBetaState: () => source.planState,
  readPlanBetaStateFromStorage: () => source.planReadKind === "loaded"
    ? { kind: "loaded", state: source.planState }
    : { kind: source.planReadKind },
}))
vi.mock("./components/AppShellFrame", () => ({ AppShellFrame: ({ children }: { children: React.ReactNode }) => children }))
vi.mock("./screens/Home", () => ({ Home: ({ oraclePreview, oraclePreviewLabel }: { oraclePreview: React.ReactNode; oraclePreviewLabel: string }) => <main><h1>{oraclePreviewLabel}</h1>{oraclePreview}</main> }))
vi.mock("./DeferredMobileScreens", () => ({ DeferredMobileScreens: {
  Trends: () => <h1>기록 상태 확인 화면</h1>, PlanProposalInbox: () => null,
  OracleExplore: ({ topicId, personalResult, personalResultUnavailable }: { topicId: string; personalResult: OraclePersonalResult; personalResultUnavailable: boolean }) =>
    <section aria-label="개인 오라클 상세" data-topic={topicId} data-unavailable={String(personalResultUnavailable)}>
      <h2>{personalResult.headline}</h2>
      {personalResult.rows.map(row => <p key={row.label}>{row.label} · {row.valueLabel}</p>)}
    </section>,
} }))
import { AppShell } from "./AppShell"
import { stateFixture } from "./domain/plan-beta-store.test-fixture"
import { createSelfReportedAthleteRecord, saveAthleteRecord } from "./domain/athlete-records"
import type { OraclePersonalResult } from "./domain/oracle-personal-result"
import { setActiveLocalAccount } from "./domain/account/local-journal-ownership"
import { setAccountAuthState } from "./domain/account/account-auth-state"
import { initializeCanonicalJournalFixture } from "./test/canonical-journal-fixture"

beforeEach(async () => {
  localStorage.clear(); sessionStorage.clear(); setActiveLocalAccount(null); setAccountAuthState("GUEST")
  await initializeCanonicalJournalFixture()
  window.history.replaceState(null, "", "/?app=1"); source.complete = false; source.planState = null; source.planReadKind = "missing"
})
afterEach(() => { cleanup(); setActiveLocalAccount(null); setAccountAuthState("RESOLVING") })

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

it("leaves the saved plan intact without using checklist counts as a personal Oracle result", () => {
  source.complete = true
  source.planState = stateFixture()
  source.planReadKind = "loaded"
  const readEvidence = vi.fn(() => { throw new Error("Home must not load multi-plan evidence") })
  render(<AppShell multiPlanRuntime={{ readMultiAdjustedEvidenceV3: readEvidence }} />)

  expect(readEvidence).not.toHaveBeenCalled()
  expect(document.querySelector('[data-oracle-kind="plan"]')).toBeNull()
  expect(screen.queryByRole("heading", { name: "저장한 훈련 계획" })).toBeNull()
  expect(screen.queryByText("예정 1회 중 완료 표시 0회")).toBeNull()
  expect(screen.queryByText(/완료 표시는 실제 일지와 다른 기록이에요/u)).toBeNull()
  expect(screen.queryByText(/합성 개인 결과|월별 훈련|결과 예시/u)).toBeNull()
  expect(source.planState).toEqual(stateFixture())
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
  const now = new Date("2026-10-12T12:00:00Z")
  for (const [index, achievedOn] of ["2026-10-01", "2026-10-02"].entries()) {
    const record = createSelfReportedAthleteRecord({
      id: `synthetic-home-race-${index}`, purpose: "PERSONAL_BEST", eventDistanceM: 5000,
      performanceSeconds: 1210 - index * 10, achievedOn, seasonId: null,
    }, now)
    expect(record).not.toBeNull()
    expect(saveAthleteRecord(record, now).ok).toBe(true)
  }
  source.planState = stateFixture()
  source.planReadKind = "loaded"
  render(<AppShell />)
  expect(screen.getByRole("heading", { name: "내 기록으로 본 오라클" })).toBeVisible()
  expect(screen.getByRole("region", { name: "오라클 · 내 기록 결과" })).toBeVisible()
  expect(screen.queryByText("오라클 결과 예시 보기")).toBeNull()
  fireEvent.click(screen.getByRole("button", { name: "내 훈련 분석" }))
  const detail = screen.getByRole("region", { name: "개인 오라클 상세" })
  expect(detail).toHaveAttribute("data-topic", "level")
  expect(detail).toHaveAttribute("data-unavailable", "false")
  expect(screen.getByRole("heading", { name: "5000m · 20분 0초" })).toBeVisible()
  expect(detail).toHaveTextContent("2026-10-01 · 20분 10초")
  expect(detail).toHaveTextContent("2026-10-02 · 20분 0초")
  expect(source.complete).toBe(false)
  expect(screen.queryByText("예정 1회 중 완료 표시 0회")).toBeNull()
})
