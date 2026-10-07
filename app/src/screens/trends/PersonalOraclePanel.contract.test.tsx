import { cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { stateFixture } from "../../domain/plan-beta-store.test-fixture"
import { PersonalOraclePanel } from "./PersonalOraclePanel"
import { projectStructuredJournalObservations } from "../../domain/journal-observation"

afterEach(cleanup)

describe("personal oracle panel", () => {
  it("shows a useful empty explanation and keeps the evidence boundary expandable", () => {
    render(<PersonalOraclePanel observations={[]} today="2026-08-28" planState={null} />)

    const region = screen.getByRole("region", { name: "내 훈련 요약" })
    expect(within(region).getByText("분석할 기록 확인 필요")).toBeVisible()
    expect(within(region).getByText("최근 달린 거리")).not.toBeVisible()
    fireEvent.click(screen.getByText("더 알아보려면 어떤 기록이 필요한가요?"))
    expect(within(region).getByText("최근 달린 거리")).toBeVisible()
    expect(within(region).getByText("훈련 목적의 구성")).toBeVisible()
    expect(within(region).getByText("계획과 실행 표시")).toBeVisible()

    const details = within(region).getByText("근거와 해석 범위 보기").closest("details")
    expect(details).not.toHaveAttribute("open")
    fireEvent.click(within(region).getByText("근거와 해석 범위 보기"))
    expect(details).toHaveAttribute("open")
    expect(within(region).getByText(/비밀 메모 원문/u)).toBeVisible()
  })

  it("separates a plan completion mark from an actual journal result", () => {
    render(<PersonalOraclePanel observations={[]} today="2026-08-28" planState={stateFixture()} />)

    expect(screen.getByText(/예정 1회 중 완료 표시 0회/u)).not.toBeVisible()
    fireEvent.click(screen.getByRole("button", { name: "계획과 실행 표시" }))
    expect(screen.getByText(/예정 1회 중 완료 표시 0회/u)).toBeVisible()
    expect(screen.getByText(/완료 표시는 실제 일지와 다른 기록/u)).not.toBeVisible()
    fireEvent.click(screen.getByText("계획과 실행 표시 · 근거 보기"))
    expect(screen.getByText(/완료 표시는 실제 일지와 다른 기록/u)).toBeVisible()
    expect(screen.queryByText(/훈련 효과가/u)).not.toBeInTheDocument()
  })

  it("acknowledges a saved RPE-only journal without calling eligible metrics zero journals", () => {
    const entry = { id: "quick", kind: "post-session" as const, date: "2026-08-28", savedAt: "2026-08-28T08:00:00Z",
      syncState: "local" as const, title: "private title", memo: "private memo", system: "", distanceKm: "", durationMin: "", avgPace: "", rpe: 6,
      fieldProvenance: { rpe: { provenance: "EXPLICIT" as const } } }
    render(<PersonalOraclePanel observations={projectStructuredJournalObservations([entry])} today="2026-08-28"
      planState={stateFixture()} savedSessions={[{ id: entry.id, date: entry.date }]} />)
    expect(screen.getByText("최근 8주 훈련 일지 1건을 남겼어요.")).toBeVisible()
    expect(screen.getByRole("heading", { name: "힘든 정도 6/10" })).toBeVisible()
    expect(screen.queryByText(/훈련 일지 0건/)).not.toBeInTheDocument()
    expect(screen.getByText(/예정 1회 중 완료 표시 0회/)).not.toBeVisible()
    expect(screen.queryByText(/private/)).not.toBeInTheDocument()
  })

  it("counts saved identity once and excludes old and future dates", () => {
    render(<PersonalOraclePanel observations={[]} today="2026-08-28" planState={null} savedSessions={[
      { id: "rest", date: "2026-08-28" }, { id: "rest", date: "2026-08-28" },
      { id: "old", date: "2025-08-28" }, { id: "future", date: "2027-08-28" },
    ]} />)
    expect(screen.getByText("최근 8주 훈련 일지 1건을 남겼어요.")).toBeVisible()
    expect(screen.getByText(/저장한 일지는 그대로 있어요/)).toBeVisible()
    expect(screen.queryByText("분석할 기록 확인 필요")).not.toBeInTheDocument()
  })
})
