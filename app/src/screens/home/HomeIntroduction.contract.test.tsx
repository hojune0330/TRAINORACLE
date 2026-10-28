import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { buildTrainingHomeViewModel } from "../../domain/home-view-model"
import { TrainingHome } from "./TrainingHome"
import { HOME_INTRODUCTION_KEY, isPlainHomeEntry } from "./HomeIntroduction"
const model = buildTrainingHomeViewModel([], [], null, "2026-10-27")
const artwork = () => document.querySelector('img[src$="training-analysis-plan-v1.webp"]')
beforeEach(() => { localStorage.clear(); sessionStorage.clear() })
afterEach(() => { cleanup(); vi.restoreAllMocks() })

describe("compact home identity without onboarding promotion", () => {
  it.each(["WELCOME", "TRAINING", "JOURNAL"] as const)("keeps work visible without introducing a welcome panel for %s", homeMode => {
    localStorage.setItem("trainoracle.home-introduction.v1", "seen")
    render(<TrainingHome model={{ ...model, homeMode }} onWriteLog={vi.fn()} onOpenPlan={vi.fn()} />)
    expect(screen.getByRole("heading", { level: 1, name: "훈련과 기록" })).toBeVisible()
    expect(artwork()).toHaveAttribute("width", "48")
    expect(screen.queryByRole("region", { name: "앱 소개" })).toBeNull()
    expect(screen.queryByRole("button", { name: /예시/ })).toBeNull()
    expect(screen.getByRole("button", { name: "운동 내용도 기록하기" })).toBeVisible()
    expect(localStorage.getItem(HOME_INTRODUCTION_KEY)).toBeNull()
    expect(localStorage.getItem("trainoracle.home-introduction.v1")).toBe("seen")
  })
  it.each(["LOADING", "STALE", "ERROR", "READY"] as const)("does not create visit preferences or focus shifts for %s", journalReadiness => {
    const focus = document.activeElement
    render(<TrainingHome model={model} journalReadiness={journalReadiness} />)
    expect(screen.queryByRole("region", { name: "앱 소개" })).toBeNull()
    expect(localStorage.length).toBe(0)
    expect(document.activeElement).toBe(focus)
  })
  it("keeps the plan action when the compact artwork fails", () => {
    const plan = vi.fn()
    render(<TrainingHome model={model} onOpenPlan={plan} />)
    fireEvent.error(artwork()!)
    expect(artwork()).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "훈련 계획 만들기" }))
    expect(plan).toHaveBeenCalledOnce()
    expect(screen.queryByRole("dialog")).toBeNull()
  })
  it.each(["?oracleV2=1", "?account=1", "?restore=1", "?code=synthetic", "?tab=plan", "?treadmill-arena=synthetic"])("does not reinterpret %s as a plain home visit", search => {
    expect(isPlainHomeEntry({ search, hash: "" })).toBe(false)
  })
  it("allows normal app and campaign entries but not a hash destination", () => {
    expect(isPlainHomeEntry({ search: "?app=1&utm_source=club", hash: "" })).toBe(true)
    expect(isPlainHomeEntry({ search: "", hash: "#oracle-compare-invite=synthetic" })).toBe(false)
  })
})
