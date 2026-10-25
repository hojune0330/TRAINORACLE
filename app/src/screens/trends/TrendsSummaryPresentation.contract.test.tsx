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

it.each(["empty", "date-only", "plan-only", "ineligible RPE", "old RPE"])("keeps the full example when %s supplies no displayed analysis fact", kind => {
  const entries = kind === "empty" || kind === "plan-only" ? [] : [session(kind === "ineligible RPE" ? { rpe: 6 }
    : kind === "old RPE" ? { date: isoShift(todayISO(), -56), rpe: 6, fieldProvenance: { rpe: { provenance: "EXPLICIT" } } } : {})]
  localStorage.setItem(JOURNAL_STORAGE_KEY, JSON.stringify(entries))
  if (kind === "plan-only") runtime.plan = stateFixture()
  render(<Trends onOpenOracle={vi.fn()} onOpenPlan={vi.fn()} />)
  const example = screen.getByRole("region", { name: "오라클 예시" })
  expect(within(example).getByRole("img")).toBeVisible()
  expect(example).not.toHaveClass("oracle-example-preview--compact")
  expect(screen.queryByRole("heading", { name: /힘든 정도/u })).toBeNull()
})

it.each(["RPE-only", "rich"])("keeps the actual %s result first and reduces its example to a row", kind => {
  localStorage.setItem(JOURNAL_STORAGE_KEY, JSON.stringify([session(kind === "RPE-only"
    ? { rpe: 6, fieldProvenance: { rpe: { provenance: "EXPLICIT" } } }
    : { distanceKm: "8", system: "base", fieldProvenance: { distanceKm: { provenance: "EXPLICIT" }, system: { provenance: "EXPLICIT" } } })]))
  render(<Trends onOpenOracle={vi.fn()} />)
  const result = screen.getByRole("region", { name: "내 훈련 요약" })
  if (kind === "RPE-only") expect(within(result).getByRole("heading", { name: "힘든 정도 6/10" })).toBeVisible()
  else expect(within(result).getByText("8 km")).toBeVisible()
  const example = screen.getByRole("region", { name: "오라클 예시" })
  expect(example).toHaveClass("oracle-example-preview--compact")
  expect(within(example).queryByRole("img")).toBeNull()
  expect(within(example).getByRole("button", { name: "예시 결과 보기" })).toHaveAccessibleDescription("예시 · 내 기록 분석이 아니에요")
  expect(result.compareDocumentPosition(example) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
})

it("never renders an example or actual summary while the parent journal read is incomplete", () => {
  localStorage.setItem(JOURNAL_STORAGE_KEY, JSON.stringify([session({ rpe: 6, fieldProvenance: { rpe: { provenance: "EXPLICIT" } } })]))
  render(<Trends journalReadComplete={false} onOpenOracle={vi.fn()} />)
  expect(screen.getByText(/기록을 아직 모두 확인하지 못했어요/u)).toBeVisible()
  expect(screen.queryByRole("region", { name: "오라클 예시" })).toBeNull()
  expect(screen.queryByRole("region", { name: "내 훈련 요약" })).toBeNull()
})
