import { cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { TrainingHomeViewModel } from "../../domain/home-view-model"
import { TrainingHome } from "./TrainingHome"
import { HomeOraclePreview } from "./HomeOraclePreview"
import { HOME_INTRODUCTION_KEY, isPlainHomeEntry } from "./HomeIntroduction"

const model: TrainingHomeViewModel = { homeMode: "WELCOME", todayMessage: "", todayRecordCount: 0,
  journalSummary: "", flowSummary: "", planSummary: "", analysisSummary: "", showMinjiPrompt: true, nextTraining: null, briefing: "" }
const artwork = () => document.querySelector('img[src$="training-analysis-plan-v1.webp"]')
beforeEach(() => { localStorage.clear(); sessionStorage.clear() })
afterEach(() => { cleanup(); vi.restoreAllMocks() })

describe("home first impression", () => {
  it("offers plan and explicitly named analysis example before recording and games without creating data", () => {
    const plan = vi.fn(), example = vi.fn(), record = vi.fn()
    render(<TrainingHome model={model} onOpenPlan={plan} onWriteLog={record}
      oraclePreview={<HomeOraclePreview kind="example" question="unused" answer="unused" sourceLabel="unused" onOpen={example} />}
      announcement={<button>러닝 투어</button>} />)
    expect(screen.getByRole("heading", { level: 1, name: "운동을 분석하고 훈련 계획을 세워요" })).toBeVisible()
    expect(artwork()).toHaveAttribute("width", "112")
    const actions = within(screen.getByRole("navigation", { name: "훈련 계획과 운동 분석" })).getAllByRole("button")
    expect(actions.map(action => action.textContent)).toEqual(["훈련 계획 받기", "운동 분석 예시 보기"])
    const recordAction = screen.getByRole("button", { name: "오늘 운동 기록 쓰기" })
    expect(actions[1]!.compareDocumentPosition(recordAction) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0)
    expect(recordAction.compareDocumentPosition(screen.getByRole("button", { name: "러닝 투어" })) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0)
    expect(plan).not.toHaveBeenCalled(); expect(example).not.toHaveBeenCalled(); expect(record).not.toHaveBeenCalled()
    expect(Object.keys(localStorage)).toEqual([HOME_INTRODUCTION_KEY])
    fireEvent.click(actions[0]!); fireEvent.click(actions[1]!); fireEvent.click(recordAction)
    expect(plan).toHaveBeenCalledOnce(); expect(example).toHaveBeenCalledOnce(); expect(record).toHaveBeenCalledWith("quick-session")
    expect(screen.queryByRole("dialog")).toBeNull()
  })

  it("stays stable during the first visit and is compact when returning even without records", () => {
    const { rerender, unmount } = render(<TrainingHome model={model} />)
    expect(artwork()).not.toBeNull()
    rerender(<TrainingHome model={{ ...model }} />)
    expect(artwork()).not.toBeNull()
    unmount()
    render(<TrainingHome model={model} />)
    expect(artwork()).toBeNull()
    expect(screen.getByRole("heading", { name: "운동 분석과 훈련 계획" })).toBeVisible()
    expect(screen.getByRole("button", { name: "훈련 계획 받기" })).toBeVisible()
  })

  it.each(["LOADING", "STALE", "ERROR"] as const)("does not consume an introduction from %s data", journalReadiness => {
    render(<TrainingHome model={model} journalReadiness={journalReadiness} />)
    expect(artwork()).toBeNull()
    expect(localStorage.getItem(HOME_INTRODUCTION_KEY)).toBeNull()
  })

  it("waits for plan and record readiness and does not consume a hidden or direct-entry home", () => {
    const { rerender } = render(<TrainingHome model={model} introductionReady={false} />)
    expect(artwork()).toBeNull(); expect(localStorage.length).toBe(0)
    rerender(<TrainingHome model={model} introductionAllowed={false} />)
    expect(artwork()).toBeNull(); expect(localStorage.length).toBe(0)
    rerender(<TrainingHome model={model} introductionAllowed introductionReady />)
    expect(artwork()).not.toBeNull()
  })

  it.each(["TRAINING", "JOURNAL"] as const)("keeps %s tasks above optional introduction art", homeMode => {
    render(<TrainingHome model={{ ...model, homeMode }} />)
    expect(artwork()).toBeNull()
    expect(screen.getByText("운동 분석 · 훈련 계획")).toBeVisible()
    expect(screen.getByRole("button", { name: "오늘 운동 기록 쓰기" })).toBeVisible()
  })

  it("keeps purpose and both actions available when the image fails", () => {
    const plan = vi.fn()
    render(<TrainingHome model={model} onOpenPlan={plan} />)
    fireEvent.error(artwork()!)
    expect(artwork()).toBeNull()
    expect(screen.getByRole("heading", { name: "운동을 분석하고 훈련 계획을 세워요" })).toBeVisible()
    fireEvent.click(screen.getByRole("button", { name: "훈련 계획 받기" }))
    expect(plan).toHaveBeenCalledOnce()
  })

  it("does not block navigation when both preference stores reject writes", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("storage denied") })
    const open = vi.fn()
    render(<TrainingHome model={model} onOpenPlan={open} />)
    fireEvent.click(screen.getByRole("button", { name: "훈련 계획 받기" }))
    expect(open).toHaveBeenCalledOnce()
  })

  it.each(["?oracleV2=1", "?account=1", "?restore=1", "?code=synthetic", "?tab=plan"])("does not reinterpret %s as a plain home visit", search => {
    expect(isPlainHomeEntry({ search, hash: "" })).toBe(false)
  })
  it("allows normal app and campaign entries but not a hash destination", () => {
    expect(isPlainHomeEntry({ search: "?app=1&utm_source=club", hash: "" })).toBe(true)
    expect(isPlainHomeEntry({ search: "", hash: "#oracle-compare-invite=synthetic" })).toBe(false)
  })
})
