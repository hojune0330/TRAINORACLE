import React from "react"
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { PlanSupportCoverage } from "./PlanSupportCoverage"
import { planSupportCoverage } from "./plan-support-coverage"

const now = "2026-09-05T03:00:00.000Z"
afterEach(cleanup)

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
  it("keeps support collapsed and distinguishes a schedule from a method", () => {
    const { container } = render(<PlanSupportCoverage experienceBand="EXPERIENCED" evaluatedAt={now} />)
    expect(container.querySelector("details")).not.toHaveAttribute("open")
    fireEvent.click(screen.getByText("종목별 상세 훈련 지원"))
    const table = screen.getByRole("table", { name: "현재 경험에 맞는 기록 기반 상세 훈련" })
    expect(within(table).getAllByRole("row")).toHaveLength(8)
    expect(within(table).getByText("1000m 5회")).toBeVisible()
    expect(within(table).getAllByText("상세 훈련 준비 중")).toHaveLength(3)
    expect(screen.getByText(/A\/B는 다른 훈련법 두 개가 아니라/u)).toBeVisible()
  })
  it("does not use a default experience when the choice is missing", () => {
    const { container } = render(<PlanSupportCoverage experienceBand={undefined} evaluatedAt={now} />)
    expect(container).toBeEmptyDOMElement()
  })
})
