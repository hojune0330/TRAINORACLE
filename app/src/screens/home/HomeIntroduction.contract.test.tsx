import { cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { TrainingHomeViewModel } from "../../domain/home-view-model"
import { TrainingHome } from "./TrainingHome"
import { HomeOraclePreview } from "./HomeOraclePreview"
import { HOME_INTRODUCTION_KEY, isPlainHomeEntry } from "./HomeIntroduction"

const model: TrainingHomeViewModel = { homeMode: "WELCOME", todayMessage: "", todayRecordCount: 0,
  journalSummary: "", flowSummary: "", planSummary: "", analysisSummary: "", showMinjiPrompt: true, nextTraining: null, briefing: "" }
const artwork = () => document.querySelector('img[src$="training-analysis-plan-v1.webp"]')
const introduction = () => screen.queryByRole("region", { name: "앱 소개" })
beforeEach(() => { localStorage.clear(); sessionStorage.clear() })
afterEach(() => { cleanup(); vi.restoreAllMocks() })

describe("home introduction v2", () => {
  it("keeps one purpose heading and plan/example/record actions before the optional introduction without creating data", () => {
    const plan = vi.fn(), example = vi.fn(), record = vi.fn()
    render(<TrainingHome model={model} onOpenPlan={plan} onWriteLog={record}
      oraclePreview={<HomeOraclePreview kind="example" question="unused" answer="unused" sourceLabel="unused" onOpen={example} />}
      announcement={<button>러닝 투어</button>} />)
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1)
    expect(screen.getByRole("heading", { level: 1, name: "운동 분석과 훈련 계획" })).toBeVisible()
    expect(document.querySelector(".home-hub__purpose")).toBeNull()
    expect(artwork()).toHaveAttribute("width", "48")
    const actions = within(screen.getByRole("navigation", { name: "훈련 계획과 운동 분석" })).getAllByRole("button")
    expect(actions.map(action => action.textContent)).toEqual(["훈련 계획 받기", "운동 분석 예시 보기"])
    const recordAction = screen.getByRole("button", { name: "오늘 운동 기록 쓰기" })
    expect(actions[1]!.compareDocumentPosition(recordAction) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0)
    expect(recordAction.compareDocumentPosition(introduction()!) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0)
    expect(recordAction.compareDocumentPosition(screen.getByRole("button", { name: "러닝 투어" })) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0)
    expect(plan).not.toHaveBeenCalled(); expect(example).not.toHaveBeenCalled(); expect(record).not.toHaveBeenCalled()
    expect(localStorage.length).toBe(0)
    fireEvent.click(actions[0]!); fireEvent.click(actions[1]!); fireEvent.click(recordAction)
    expect(plan).toHaveBeenCalledOnce(); expect(example).toHaveBeenCalledOnce(); expect(record).toHaveBeenCalledWith("quick-session")
    expect(screen.queryByRole("dialog")).toBeNull()
  })

  it.each(["TRAINING", "JOURNAL"] as const)("shows the new introduction for an existing %s athlete despite v1 seen", homeMode => {
    localStorage.setItem("trainoracle.home-introduction.v1", "seen")
    render(<TrainingHome model={{ ...model, homeMode, showMinjiPrompt: false }} />)
    expect(introduction()).toBeVisible()
    expect(artwork()).toHaveAttribute("width", "48")
    expect(screen.getByText("운동 분석 · 훈련 계획")).toBeVisible()
    expect(screen.queryByRole("button", { name: "훈련 계획 받기" })).toBeNull()
    expect(screen.getByRole("button", { name: "오늘 운동 기록 쓰기" })).toBeVisible()
    expect(localStorage.getItem("trainoracle.home-introduction.v1")).toBe("seen")
    expect(localStorage.getItem(HOME_INTRODUCTION_KEY)).toBeNull()
  })

  it("does not mark an unacknowledged below-fold introduction as read, even after remounting", () => {
    const first = render(<TrainingHome model={model} />)
    expect(introduction()).toBeVisible()
    first.unmount()
    render(<TrainingHome model={model} />)
    expect(introduction()).toBeVisible()
    expect(localStorage.length).toBe(0)
  })

  it("records only an explicit v2 dismissal, restores the nearby today action, and retains a compact symbol on return", () => {
    localStorage.setItem("synthetic-unrelated-ui", "preserved")
    const first = render(<TrainingHome model={model} />)
    fireEvent.click(screen.getByRole("button", { name: "앱 소개 닫기" }))
    expect(introduction()).toBeNull()
    expect(screen.getByRole("button", { name: "오늘 운동 기록 쓰기" })).toHaveFocus()
    expect(localStorage.getItem(HOME_INTRODUCTION_KEY)).toBe("seen")
    expect(localStorage.getItem("synthetic-unrelated-ui")).toBe("preserved")
    expect(Object.keys(localStorage).sort()).toEqual(["synthetic-unrelated-ui", HOME_INTRODUCTION_KEY].sort())
    first.unmount()
    render(<TrainingHome model={model} />)
    expect(introduction()).toBeNull()
    expect(artwork()).toHaveAttribute("width", "48")
  })

  it.each(["LOADING", "STALE", "ERROR"] as const)("keeps a neutral symbol but no introduction or seen write for %s", journalReadiness => {
    render(<TrainingHome model={model} journalReadiness={journalReadiness} />)
    expect(artwork()).toHaveAttribute("width", "48")
    expect(introduction()).toBeNull()
    expect(localStorage.getItem(HOME_INTRODUCTION_KEY)).toBeNull()
  })

  it("waits for readable sources and never consumes a hidden or direct-entry home", () => {
    const { rerender } = render(<TrainingHome model={model} introductionReady={false} />)
    expect(introduction()).toBeNull(); expect(localStorage.length).toBe(0)
    rerender(<TrainingHome model={model} introductionAllowed={false} />)
    expect(introduction()).toBeNull(); expect(localStorage.length).toBe(0)
    rerender(<TrainingHome model={model} introductionAllowed introductionReady />)
    expect(introduction()).toBeVisible(); expect(localStorage.length).toBe(0)
  })

  it("keeps the existing next training and today action ahead of the introduction", () => {
    const nextTraining: NonNullable<TrainingHomeViewModel["nextTraining"]> = {
      date: "2026-10-15", laterSameDaySession: null,
      session: { day: 1, slot: "AM", role: "QUALITY", plannedEnergyIntent: "LT_INTENT",
        prescription: { kind: "RPE_TIME_RANGE", rpe: { minimum: 5, maximum: 6 }, durationMinutes: { minimum: 25, maximum: 40 } } },
    }
    render(<TrainingHome model={{ ...model, homeMode: "TRAINING", nextTraining }} />)
    const next = screen.getByRole("region", { name: "다음 훈련" })
    const today = screen.getByRole("button", { name: "오늘 운동 기록 쓰기" })
    expect(next.compareDocumentPosition(today) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0)
    expect(today.compareDocumentPosition(introduction()!) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0)
  })

  it("keeps purpose, dismissal and actions available when the symbol fails", () => {
    const plan = vi.fn()
    render(<TrainingHome model={model} onOpenPlan={plan} />)
    fireEvent.error(artwork()!)
    expect(artwork()).toBeNull()
    expect(screen.getByRole("heading", { name: "운동 분석과 훈련 계획" })).toBeVisible()
    fireEvent.click(screen.getByRole("button", { name: "훈련 계획 받기" }))
    fireEvent.click(screen.getByRole("button", { name: "앱 소개 닫기" }))
    expect(plan).toHaveBeenCalledOnce(); expect(introduction()).toBeNull()
  })

  it("can dismiss and navigate when both preference stores reject writes", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("storage denied") })
    const open = vi.fn()
    render(<TrainingHome model={model} onOpenPlan={open} />)
    fireEvent.click(screen.getByRole("button", { name: "앱 소개 닫기" }))
    expect(introduction()).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "훈련 계획 받기" }))
    expect(open).toHaveBeenCalledOnce()
  })

  it.each(["?oracleV2=1", "?account=1", "?restore=1", "?code=synthetic", "?tab=plan", "?treadmill-arena=synthetic"])("does not reinterpret %s as a plain home visit", search => {
    expect(isPlainHomeEntry({ search, hash: "" })).toBe(false)
  })
  it("allows normal app and campaign entries but not a hash destination", () => {
    expect(isPlainHomeEntry({ search: "?app=1&utm_source=club", hash: "" })).toBe(true)
    expect(isPlainHomeEntry({ search: "", hash: "#oracle-compare-invite=synthetic" })).toBe(false)
  })
})
