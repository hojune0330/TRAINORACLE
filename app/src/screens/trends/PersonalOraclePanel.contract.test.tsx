import { cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { stateFixture } from "../../domain/plan-beta-store.test-fixture"
import { PersonalOraclePanel } from "./PersonalOraclePanel"

afterEach(cleanup)

describe("personal oracle panel", () => {
  it("shows a useful empty explanation and keeps the evidence boundary expandable", () => {
    render(<PersonalOraclePanel observations={[]} today="2026-08-28" planState={null} />)

    const region = screen.getByRole("region", { name: "지금까지 기록으로 알 수 있는 것" })
    expect(within(region).getByText("기록을 기다리는 중")).toBeVisible()
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

    expect(screen.getByText(/예정 1회 중 완료 표시 0회/u)).toBeVisible()
    expect(screen.getByText(/완료 표시는 실제 일지와 다른 기록/u)).toBeVisible()
    expect(screen.queryByText(/훈련 효과가/u)).not.toBeInTheDocument()
  })
})
