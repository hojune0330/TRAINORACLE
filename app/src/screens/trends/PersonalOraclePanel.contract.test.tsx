import { cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { stateFixture } from "../../domain/plan-beta-store.test-fixture"
import { PersonalOraclePanel } from "./PersonalOraclePanel"
import { projectStructuredJournalObservations } from "../../domain/journal-observation"
import type { StructuredJournalObservation } from "../../domain/journal-observation"

afterEach(cleanup)

describe("personal oracle panel", () => {
  it("leaves first-record actions to the parent instead of creating an empty result", () => {
    const { container } = render(<PersonalOraclePanel observations={[]} today="2026-08-28" planState={null} onOpenPlan={vi.fn()} />)
    expect(container).toBeEmptyDOMElement()
  })

  it("shows only the plan entry when a plan is the only available information", () => {
    const onOpenPlan = vi.fn()
    const onWriteLog = vi.fn()
    render(<PersonalOraclePanel observations={[]} today="2026-08-28" planState={stateFixture()} onOpenPlan={onOpenPlan} onWriteLog={onWriteLog} />)

    expect(screen.queryByText(/예정 1회 중 완료 표시 0회/u)).not.toBeInTheDocument()
    expect(screen.queryByText("일정에 직접 체크한 횟수예요. 실제 운동 기록과는 달라요.")).not.toBeInTheDocument()
    expect(screen.queryByText(/기록을 기다리고|기록을 모으는|어떤 기록이 필요한가요/)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "훈련표 보기" }))
    expect(onOpenPlan).toHaveBeenCalledOnce()
    expect(screen.queryByRole("region", { name: "내 훈련 요약" })).not.toBeInTheDocument()
    expect(screen.queryByRole("heading", { name: "내 훈련 요약" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "운동 기록 남기기" })).not.toBeInTheDocument()
    expect(onWriteLog).not.toHaveBeenCalled()
    expect(document.querySelector("details")).toBeNull()
  })

  it("keeps source, period and safety context with real analysis while linking to the plan separately", () => {
    const observation: StructuredJournalObservation = {
      sourceRef: { sourceKind: "SESSION_RESULT_RECORD", sourceId: "explicit-lt", sourceVersion: null,
        observedAt: "2026-08-20T08:00:00.000Z", trustState: "ACCEPTED", containsPrivateRawText: false },
      loggedOn: "2026-08-20", energySystem: "LT", distanceKm: 8, durationMin: 40, secondsPerKm: 300, rpe: 6,
      mood: null, painMax: null, painSourceLevels: [],
      fieldProvenance: { system: "EXPLICIT", distanceKm: "EXPLICIT", durationMin: "EXPLICIT", secondsPerKm: "DERIVED", rpe: "EXPLICIT", mood: "MISSING", painMax: "MISSING" },
      derivationRefs: [],
    }
    const onOpenPlan = vi.fn()
    render(<PersonalOraclePanel observations={[observation]} today="2026-08-28" planState={stateFixture()} onOpenPlan={onOpenPlan} />)
    expect(screen.getByText(/최근 8주 1가지 유형을 기록했어요/)).toBeVisible()
    expect(screen.queryByText(/예정 1회 중 완료 표시 0회/u)).not.toBeInTheDocument()
    fireEvent.click(screen.getByText("집계 기준"))
    expect(screen.getByText(/최근 8주 거리·훈련 구성 분석에 사용한 기록 1건/)).toBeVisible()
    expect(screen.getByText(/계획의 예정값, 완료 표시, 실제 일지값을 서로 섞지 않았습니다/)).toBeVisible()
    expect(screen.getByText(/비밀 메모 원문/)).toBeVisible()
    expect(screen.getByText(/계획·안전 판단은 자동으로 바꾸지/)).toBeVisible()
    fireEvent.click(screen.getByRole("button", { name: "훈련표 보기" }))
    expect(onOpenPlan).toHaveBeenCalledOnce()
  })

  it("acknowledges a saved RPE-only journal without calling eligible metrics zero journals", () => {
    const entry = { id: "quick", kind: "post-session" as const, date: "2026-08-28", savedAt: "2026-08-28T08:00:00Z",
      syncState: "local" as const, title: "private title", memo: "private memo", system: "", distanceKm: "", durationMin: "", avgPace: "", rpe: 6,
      fieldProvenance: { rpe: { provenance: "EXPLICIT" as const } } }
    render(<PersonalOraclePanel observations={projectStructuredJournalObservations([entry])} today="2026-08-28"
      planState={stateFixture()} savedSessions={[{ id: entry.id, date: entry.date }]} onOpenPlan={vi.fn()} />)
    expect(screen.getByText("최근 8주 훈련 일지 1건을 남겼어요.")).toBeVisible()
    expect(screen.getByRole("heading", { name: "힘든 정도 6/10" })).toBeVisible()
    expect(screen.queryByText(/훈련 일지 0건/)).not.toBeInTheDocument()
    expect(screen.queryByText(/예정 1회 중 완료 표시 0회/)).not.toBeInTheDocument()
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
