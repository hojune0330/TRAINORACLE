import { cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { stateFixture } from "../../domain/plan-beta-store.test-fixture"
import { PersonalOraclePanel } from "./PersonalOraclePanel"
import { projectStructuredJournalObservations } from "../../domain/journal-observation"

afterEach(cleanup)

describe("personal oracle panel", () => {
  it("leaves first-record actions to the parent instead of creating an empty result", () => {
    const { container } = render(<PersonalOraclePanel observations={[]} today="2026-08-28" planState={null} />)
    expect(container).toBeEmptyDOMElement()
  })

  it("separates a plan completion mark from an actual journal result", () => {
    const onOpenPlan = vi.fn()
    const onWriteLog = vi.fn()
    render(<PersonalOraclePanel observations={[]} today="2026-08-28" planState={stateFixture()} onOpenPlan={onOpenPlan} onWriteLog={onWriteLog} />)

    expect(screen.getByText(/예정 1회 중 완료 표시 0회/u)).toBeVisible()
    expect(screen.getByText("일정에 직접 체크한 횟수예요. 실제 운동 기록과는 달라요.")).toBeVisible()
    expect(screen.queryByText(/기록을 기다리고|기록을 모으는|어떤 기록이 필요한가요/)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "훈련 일정 보기" }))
    expect(onOpenPlan).toHaveBeenCalledOnce()
    fireEvent.click(screen.getByRole("button", { name: "운동 기록 남기기" }))
    expect(onWriteLog).toHaveBeenCalledOnce()

    const region = screen.getByRole("region", { name: "내 훈련 요약" })
    expect(within(region).getByRole("heading", { level: 2, name: "내 훈련 요약" })).toHaveClass("app-heading--screen", "app-heading--accent")
    expect(region.querySelectorAll("details")).toHaveLength(1)
    expect(region.querySelector(".lucide-circle-help")).toBeNull()
    expect(screen.getByText(/완료 표시는 실제 일지와 다른 기록/u)).not.toBeVisible()
    fireEvent.click(screen.getByText("집계 기준"))
    expect(screen.getByText(/완료 표시는 실제 일지와 다른 기록/u)).toBeVisible()
    expect(screen.getByText(/비밀 메모 원문/u)).toBeVisible()
    expect(screen.getByText(/계획·안전 판단은 자동으로 바꾸지/)).toBeVisible()
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
    expect(screen.getByText(/예정 1회 중 완료 표시 0회/)).toBeVisible()
    expect(screen.queryByText(/private/)).not.toBeInTheDocument()
  })

  it("counts saved identity once and excludes old and future dates", () => {
    const onOpenDay = vi.fn()
    render(<PersonalOraclePanel observations={[]} today="2026-08-28" planState={null} onOpenDay={onOpenDay} savedSessions={[
      { id: "rest", date: "2026-08-28" }, { id: "rest", date: "2026-08-28" },
      { id: "old", date: "2025-08-28" }, { id: "future", date: "2027-08-28" },
    ]} />)
    expect(screen.getByText("최근 8주 훈련 일지 1건을 남겼어요.")).toBeVisible()
    expect(screen.getByRole("heading", { name: "2026-08-28" })).toBeVisible()
    fireEvent.click(screen.getByRole("button", { name: "최근 일지 읽기" }))
    expect(onOpenDay).toHaveBeenCalledExactlyOnceWith("2026-08-28")
    expect(screen.queryByText("집계 기준")).not.toBeInTheDocument()
    expect(screen.queryByText("분석할 기록 확인 필요")).not.toBeInTheDocument()
  })

  it("can open an older journal without counting it as recent or selecting a future one", () => {
    const onOpenDay = vi.fn()
    render(<PersonalOraclePanel observations={[]} today="2026-08-28" planState={null} onOpenDay={onOpenDay} savedSessions={[
      { id: "old", date: "2025-08-28" }, { id: "future", date: "2027-08-28" },
    ]} />)
    expect(screen.queryByText(/최근 8주 훈련 일지/)).not.toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "2025-08-28" })).toBeVisible()
    fireEvent.click(screen.getByRole("button", { name: "최근 일지 읽기" }))
    expect(onOpenDay).toHaveBeenCalledExactlyOnceWith("2025-08-28")
    expect(screen.queryByText("집계 기준")).not.toBeInTheDocument()
  })
})
