import { cleanup, render, screen, within } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { isoShift } from "../../domain/dates"
import { todayISO, type JournalEntry } from "../../domain/journal-store"
import { JOURNAL_STORAGE_KEY } from "../../domain/journal-storage-keys"
import { stateFixture } from "../../domain/plan-beta-store.test-fixture"
import { initializeCanonicalJournalFixture } from "../../test/canonical-journal-fixture"
import { Trends } from "../Trends"

const runtime = vi.hoisted(() => ({ plan: null as ReturnType<typeof stateFixture> | null }))
vi.mock("../../domain/plan-beta-store", async original => ({
  ...await original<typeof import("../../domain/plan-beta-store")>(), loadPlanBetaState: () => runtime.plan,
  readPlanBetaStateFromStorage: () => runtime.plan ? { kind: "loaded", state: runtime.plan } : { kind: "missing" },
}))
vi.mock("../home/HomeCoachingSummary", () => ({ HomeCoachingSummary: () => null }))

type Session = Extract<JournalEntry, { kind: "post-session" }>
function session(patch: Partial<Session> = {}): Session {
  const date = todayISO()
  return { id: "summary-session", kind: "post-session", date, savedAt: `${date}T08:00:00Z`, syncState: "local",
    title: "", memo: "", system: "", distanceKm: "", durationMin: "", avgPace: "", rpe: 0, ...patch }
}

beforeEach(async () => {
  localStorage.clear(); sessionStorage.clear(); await initializeCanonicalJournalFixture(); runtime.plan = null
})
afterEach(cleanup)

it.each(["empty", "date-only", "plan-only", "ineligible RPE"])("offers the common example explicitly when %s supplies no displayed analysis fact", kind => {
  const entries = kind === "empty" || kind === "plan-only" ? [] : [session(kind === "ineligible RPE" ? { rpe: 6 }
    : kind === "old RPE" ? { date: isoShift(todayISO(), -56), rpe: 6, fieldProvenance: { rpe: { provenance: "EXPLICIT" } } } : {})]
  localStorage.setItem(JOURNAL_STORAGE_KEY, JSON.stringify(entries))
  if (kind === "plan-only") runtime.plan = stateFixture()
  render(<Trends onOpenOracle={vi.fn()} onOpenPlan={vi.fn()} />)
  const report = screen.getByRole("region", { name: "기간별 훈련 리포트" })
  expect(report).toHaveAttribute("data-source", "my")
  expect(within(report).queryByRole("img")).toBeNull()
  expect(within(report).getByRole("button", { name: "예시 결과 보기" })).toBeVisible()
  expect(screen.queryByRole("heading", { name: /힘든 정도/u })).toBeNull()
})

it.each(["RPE-only", "rich", "old RPE"])("shows the actual %s facts in the common calendar-month report", kind => {
  localStorage.setItem(JOURNAL_STORAGE_KEY, JSON.stringify([session(kind === "RPE-only"
    || kind === "old RPE" ? { date: kind === "old RPE" ? isoShift(todayISO(), -56) : todayISO(), rpe: 6, fieldProvenance: { rpe: { provenance: "EXPLICIT" } } }
    : { distanceKm: "8", system: "base", fieldProvenance: { distanceKm: { provenance: "EXPLICIT" }, system: { provenance: "EXPLICIT" } } })]))
  render(<Trends onOpenOracle={vi.fn()} />)
  const result = screen.getByRole("region", { name: "기간별 훈련 리포트" })
  if (kind === "RPE-only" || kind === "old RPE") expect(within(result).getByRole("region", { name: "리포트 근거" })).toHaveTextContent("힘든 정도 6/10")
  else expect(within(result).getByLabelText("기간 핵심 수치")).toHaveTextContent("누적 거리8 km")
  expect(result).toHaveAttribute("data-source", "my")
  expect(screen.getByRole("button", { name: "예시" })).toHaveAttribute("aria-pressed", "false")
})

it("never renders an example or actual summary while the parent journal read is incomplete", () => {
  localStorage.setItem(JOURNAL_STORAGE_KEY, JSON.stringify([session({ rpe: 6, fieldProvenance: { rpe: { provenance: "EXPLICIT" } } })]))
  render(<Trends journalReadComplete={false} onOpenOracle={vi.fn()} />)
  expect(screen.getByText(/기록을 아직 모두 확인하지 못했어요/u)).toBeVisible()
  expect(screen.queryByRole("region", { name: "오라클 예시" })).toBeNull()
  expect(screen.queryByRole("region", { name: "내 훈련 요약" })).toBeNull()
})
