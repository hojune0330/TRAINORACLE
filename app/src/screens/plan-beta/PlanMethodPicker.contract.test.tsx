import React from "react"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { PlanMethodPicker } from "./PlanMethodPicker"
import { resolveDetailedPlanTemplateOptions } from "./plan-template-options"

const options = resolveDetailedPlanTemplateOptions({ eventDistanceM: 5000, trainingFocus: "VO2_INTENT", experienceBand: "EXPERIENCED" }, "2026-09-02T03:00:00.000Z")
afterEach(cleanup)

describe("candidate method picker", () => {
  it("starts compact and tells the truth about the one detailed method", () => {
    const { container } = render(<PlanMethodPicker options={options} selected={null} onChange={vi.fn()} />)
    expect(container.querySelector("details")).not.toHaveAttribute("open")
    fireEvent.click(screen.getByText("훈련 방법 선택"))
    expect(screen.getByText(/상세 방법은 현재 1개/u)).toBeVisible()
    expect(screen.getAllByRole("radio")).toHaveLength(2)
    expect(screen.getByRole("radio", { name: /시간·RPE 기준으로 받기/u })).toBeChecked()
  })
  it("sends the exact reference and does not treat RPE as another detailed method", () => {
    const onChange = vi.fn()
    render(<PlanMethodPicker options={options} selected={null} onChange={onChange} />)
    fireEvent.click(screen.getByText("훈련 방법 선택"))
    fireEvent.click(screen.getByRole("radio", { name: /1000m 5회/u }))
    expect(onChange).toHaveBeenCalledWith(options[0]!.ref)
    expect(screen.getByText(/시간·RPE 기준은 다른 상세 방법으로 세지 않아요/u)).toBeVisible()
  })
  it("lets the athlete return to RPE without a restart of intake", () => {
    const onChange = vi.fn()
    render(<PlanMethodPicker options={options} selected={options[0]!.ref} onChange={onChange} />)
    fireEvent.click(screen.getByText("훈련 방법 선택"))
    fireEvent.click(screen.getByRole("radio", { name: /시간·RPE 기준으로 받기/u }))
    expect(onChange).toHaveBeenCalledWith(null)
  })
  it("does not fill a missing method with a fake alternative", () => {
    render(<PlanMethodPicker options={[]} selected={null} onChange={vi.fn()} />)
    fireEvent.click(screen.getByText("훈련 방법 선택"))
    expect(screen.getAllByRole("radio")).toHaveLength(1)
    expect(screen.getByText(/선택할 수 있는 상세 방법은 아직 없어요/u)).toBeVisible()
  })
  it("renders independent reviewed options as separate choices without inventing numbers", () => {
    // UI-only synthetic shape. Not inserted into any runtime approval manifest.
    const alternate = { ...options[0]!, ref: { ...options[0]!.ref, templateId: "UI-FIXTURE-ONLY" }, mainSummary: "시간형 구간", recoverySummary: "거리형 회복" }
    const onChange = vi.fn()
    render(<PlanMethodPicker options={[options[0]!, alternate]} selected={options[0]!.ref} onChange={onChange} />)
    fireEvent.click(screen.getByText("훈련 방법 선택"))
    expect(screen.getAllByRole("radio")).toHaveLength(3)
    fireEvent.click(screen.getByRole("radio", { name: /시간형 구간/u }))
    expect(onChange).toHaveBeenCalledWith(alternate.ref)
    expect(screen.queryByText(/현재 1개/u)).toBeNull()
  })
  it("keeps additional choices accessible and preserves a selected non-default method", () => {
    const extra = { ...options[0]!, recommended: false, ref: { ...options[0]!.ref, templateId: "UI-EXTRA-ONLY" }, mainSummary: "추가 방법 예시" }
    const props = { options: [...options, extra], onChange: vi.fn() }
    const view = render(<PlanMethodPicker {...props} selected={options[0]!.ref} />)
    fireEvent.click(screen.getByText("훈련 방법 선택"))
    expect(screen.queryByRole("radio", { name: /추가 방법 예시/u })).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "다른 훈련 보기 (1)" }))
    fireEvent.click(screen.getByRole("radio", { name: /추가 방법 예시/u }))
    expect(props.onChange).toHaveBeenCalledWith(extra.ref)
    view.rerender(<PlanMethodPicker {...props} selected={extra.ref} />)
    fireEvent.click(screen.getByRole("button", { name: "추천 훈련만 보기" }))
    expect(screen.getByRole("radio", { name: /추가 방법 예시/u })).toBeChecked()
  })
})
