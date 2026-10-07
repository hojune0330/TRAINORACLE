import React from "react"
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import { PlanSupportCoverage } from "./PlanSupportCoverage"
import { planSupportCoverage } from "./plan-support-coverage"
import * as coverage from "./plan-support-coverage"
import * as store from "../../domain/plan-beta-store"
import { ALL_WORKOUT_CATALOG } from "@impl/prescription/all-workout-calculator"

const now = "2026-09-05T03:00:00.000Z"
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.useRealTimers() })

describe("current plan support coverage", () => {
  it("derives only the four current baseline methods with exact events and intents", () => {
    const rows = planSupportCoverage("EXPERIENCED", now)
    expect(rows).toHaveLength(7)
    expect(rows.flatMap(row => row.methods.map(method => [row.event.distanceM, method.ref.templateId, method.trainingFocus]))).toEqual([
      [800, "MD-800-01", "GLY_INTENT"], [1500, "MD-1500-01", "MIXED_INTENT"],
      [3000, "MD-3000-01", "VO2_INTENT"], [5000, "V2-SEED-05", "VO2_INTENT"],
    ])
  })
  it.each(["NEW_TO_RUNNING", "DEVELOPING"] as const)("does not broaden %s into the experienced scope", experience => {
    expect(planSupportCoverage(experience, now).every(row => row.methods.length === 0)).toBe(true)
  })
  it("cannot turn expired or invalid authority into a supported method", () => {
    expect(planSupportCoverage("EXPERIENCED", "2100-01-01T00:00:00.000Z").flatMap(row => row.methods)).toEqual([])
    expect(planSupportCoverage("EXPERIENCED", "not-a-date").flatMap(row => row.methods)).toEqual([])
  })
  it("keeps support collapsed and distinguishes a schedule from a method", async () => {
    const { container } = render(<PlanSupportCoverage experienceBand="EXPERIENCED" evaluatedAt={now} />)
    expect(container.querySelector("details")).not.toHaveAttribute("open")
    fireEvent.click(screen.getByText("종목별 상세 훈련 지원"))
    const table = await screen.findByRole("table", { name: "현재 경험의 훈련 구성과 개인 페이스 지원" })
    expect(within(table).getAllByRole("row")).toHaveLength(8)
    expect(within(table).getByText("5 × 1km @ 5K RP · r150s Jog")).toBeVisible()
    expect(within(table).queryByText("같은 종목 기록의 페이스 계산은 준비 중")).not.toBeInTheDocument()
    expect(within(table).getByText(/기준 종목: .*하프마라톤/)).toBeVisible()
    expect(screen.getByText(/목표는 현재 능력이 아니에요/)).toBeVisible()
    expect(screen.getByText(/기록 저장만으로 계획이 바뀌지는 않아요/)).toBeVisible()
    expect(screen.getByText(/지금 모두 적용할 수 있다는 뜻은 아니에요/)).toBeVisible()
    expect(screen.getByText(/A\/B는 다른 훈련법 두 개가 아니라/u)).toBeVisible()
  })
  it.each(["NEW_TO_RUNNING", "DEVELOPING", "EXPERIENCED"] as const)("derives %s catalog counts separately from record-pace authority", experience => {
    for (const row of planSupportCoverage(experience, now)) {
      expect(row.catalogConfigurations).toEqual(ALL_WORKOUT_CATALOG.filter(entry => entry.family !== "OFF"
        && entry.eventDistances.some(distance => (distance === 21097 ? 21097.5 : distance)
          === (row.event.distanceM === 21097 ? 21097.5 : row.event.distanceM)) && entry.experience.includes(experience)))
      expect(row.catalogConfigurations.length).toBeGreaterThan(0)
    }
  })
  it.each([
    ["NEW_TO_RUNNING", 14, ["RP-HALF-INTRO"]],
    ["DEVELOPING", 39, ["RP-HALF-TIMED"]],
    ["EXPERIENCED", 109, ["RP-HALF-TIMED", "RP-HALF-DISTANCE"]],
  ] as const)("counts canonical half and its actual auto pace capabilities for %s", (experience, count, ids) => {
    const half = planSupportCoverage(experience, now).find(row => row.event.title === "하프마라톤")!
    expect(half.catalogConfigurations).toHaveLength(count)
    expect(half.catalogPaceConfigurations.filter(row => row.referenceEventDistances.includes(21097.5)).map(row => row.catalogId)).toEqual(ids)
    expect(half.catalogPaceConfigurations.some(row => row.referenceEventDistances.includes(5000))).toBe(true)
    expect(half.catalogPaceConfigurations.every(row => !row.referenceEventDistances.includes(10000))).toBe(true)
  })
  it("does not infer sprint or hill pace support from catalog membership", () => {
    for (const row of planSupportCoverage("EXPERIENCED", now)) {
      const nonPaceEntries = row.catalogConfigurations.filter(entry => entry.segments.every(segment =>
        segment.terrain !== "FLAT" || segment.modality !== "RUN" || !["LT", "VO2", "RACE_PACE"].includes(segment.intent)))
      expect(nonPaceEntries.length).toBeGreaterThan(0)
      expect(row.catalogPaceConfigurations.every(entry => !nonPaceEntries.some(nonPace => nonPace.id === entry.catalogId))).toBe(true)
    }
  })
  it("does not use a default experience when the choice is missing", () => {
    const { container } = render(<PlanSupportCoverage experienceBand={undefined} evaluatedAt={now} />)
    expect(container).toBeEmptyDOMElement()
  })

  it("does not calculate coverage or scan history before the support disclosure is opened", () => {
    const calculate = vi.spyOn(coverage, "planSupportCoverage")
    const history = vi.spyOn(store, "loadPlanMethodHistorySnapshot")
    const view = render(<PlanSupportCoverage experienceBand="EXPERIENCED" evaluatedAt={now} />)
    view.rerender(<PlanSupportCoverage experienceBand="EXPERIENCED" evaluatedAt={now} />)
    expect(screen.getByText("종목별 상세 훈련 지원").closest("details")).not.toHaveAttribute("open")
    expect(calculate).not.toHaveBeenCalled()
    expect(history).not.toHaveBeenCalled()
  })

  it("evaluates at the first accessible open and reuses that result on unrelated rerenders and reopen", async () => {
    vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date(now))
    const calculate = vi.spyOn(coverage, "planSupportCoverage")
    const user = userEvent.setup()
    const view = render(<PlanSupportCoverage experienceBand="EXPERIENCED" />)
    const openedAt = "2026-09-05T04:00:00.000Z"
    vi.setSystemTime(new Date(openedAt))
    const summary = screen.getByText("종목별 상세 훈련 지원").closest("summary")!
    await user.click(summary)
    const table = await screen.findByRole("table", { name: "현재 경험의 훈련 구성과 개인 페이스 지원" })
    const contents = table.textContent
    expect(calculate).toHaveBeenCalledExactlyOnceWith("EXPERIENCED", openedAt)
    await user.click(summary)
    expect(summary.closest("details")).not.toHaveAttribute("open")
    vi.setSystemTime(new Date("2026-09-05T05:00:00.000Z"))
    view.rerender(<PlanSupportCoverage experienceBand="EXPERIENCED" />)
    await user.click(summary)
    expect(await screen.findByRole("table", { name: "현재 경험의 훈련 구성과 개인 페이스 지원" })).toHaveTextContent(contents!)
    expect(calculate).toHaveBeenCalledTimes(1)
  })

  it("retains the explicit evaluation-time contract after the disclosure has opened", async () => {
    const calculate = vi.spyOn(coverage, "planSupportCoverage")
    const user = userEvent.setup()
    const view = render(<PlanSupportCoverage experienceBand="EXPERIENCED" evaluatedAt={now} />)
    await user.click(screen.getByText("종목별 상세 훈련 지원").closest("summary")!)
    await screen.findByRole("table", { name: "현재 경험의 훈련 구성과 개인 페이스 지원" })
    expect(calculate).toHaveBeenLastCalledWith("EXPERIENCED", now)
    expect(screen.getByText("5 × 1km @ 5K RP · r150s Jog")).toBeVisible()
    const expired = "2100-01-01T00:00:00.000Z"
    view.rerender(<PlanSupportCoverage experienceBand="EXPERIENCED" evaluatedAt={expired} />)
    expect(calculate).toHaveBeenLastCalledWith("EXPERIENCED", expired)
    expect(screen.queryByText("5 × 1km @ 5K RP · r150s Jog")).not.toBeInTheDocument()
  })
})
