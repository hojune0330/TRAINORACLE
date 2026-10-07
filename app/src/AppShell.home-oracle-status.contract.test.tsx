import React from "react"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"

const source = vi.hoisted(() => ({ complete: false, personal: false }))
vi.mock("./hooks/useCalendarEntries", () => ({ useCalendarSnapshot: () => ({ status: "READY", entries: [] }) }))
vi.mock("./hooks/useAthleteRecordsSnapshot", () => ({ useAthleteRecordsSnapshot: () => ({ status: "READY", records: [] }) }))
vi.mock("./hooks/usePlanEvidenceHistory", () => ({ usePlanEvidenceHistory: () => ({ journalReadComplete: source.complete, history: { kind: "empty" } }) }))
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

beforeEach(() => { localStorage.clear(); sessionStorage.clear(); window.history.replaceState(null, "", "/?app=1"); source.complete = false; source.personal = false })
afterEach(cleanup)

it("waits for the journal read before offering an example and routes incomplete reads to the records status", () => {
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

it("still uses an eligible race record while the independent journal read is incomplete", () => {
  source.personal = true
  render(<AppShell />)
  expect(screen.getByRole("heading", { name: "내 기록으로 본 오라클" })).toBeVisible()
  expect(screen.getByText("합성 개인 결과")).toBeVisible()
})
