import React from "react"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { PlanMethodPicker } from "./PlanMethodPicker"
import { resolveDetailedPlanTemplateOptions } from "./plan-template-options"
import type { RepeatPreference } from "@impl/prescription/method-recommendation"

const options = resolveDetailedPlanTemplateOptions({ eventDistanceM: 5000, trainingFocus: "VO2_INTENT", experienceBand: "EXPERIENCED" }, "2026-09-02T03:00:00.000Z")
afterEach(cleanup)

describe("candidate method picker", () => {
  it("does not label a storage read failure as zero completions", () => {
    render(<PlanMethodPicker options={options.map(option => ({ ...option, historyCoverage: null }))} selected={null} onChange={vi.fn()} />)
    fireEvent.click(screen.getByText("훈련 방법 선택"))
    expect(screen.getByRole("status")).toHaveTextContent("이력을 읽지 못해")
    expect(screen.queryByText(/자기보고 완료 0회/u)).toBeNull()
  })
  it("keeps archive coverage behind a disclosure and distinguishes it from actual training dates", () => {
    render(<PlanMethodPicker options={options} selected={null} onChange={vi.fn()} />)
    fireEvent.click(screen.getByText("훈련 방법 선택"))
    const summary = screen.getByText("추천에 참고한 이력")
    expect(summary.closest("details")).not.toHaveAttribute("open")
    fireEvent.click(summary)
    expect(screen.getByText(/전체 종목을 합쳐 최근 18개 계획/u)).toBeVisible()
    expect(screen.getByText(/실제 훈련 날짜와 연속 관찰 기간/u)).toBeVisible()
    expect(screen.queryByText(/계획 보관 날짜/u)).toBeNull()
  })
  it("starts compact and tells the truth about the one detailed method", () => {
    const { container } = render(<PlanMethodPicker options={options} selected={null} onChange={vi.fn()} />)
    expect(container.querySelector("details")).not.toHaveAttribute("open")
    fireEvent.click(screen.getByText("훈련 방법 선택"))
    expect(screen.getByText(/상세 방법은 현재 1개/u)).toBeVisible()
    expect(screen.getAllByRole("radio")).toHaveLength(2)
    expect(screen.getByRole("radio", { name: /시간·RPE 기준으로 받기/u })).toBeChecked()
    expect(screen.queryByRole("group", { name: "추천 선호 (선택)" })).toBeNull()
    expect(screen.getByText(/자기보고 완료 0회/u)).toBeVisible()
    expect(screen.getByText(/진행 중인 계획의 이력은 포함되지 않아요/u)).toBeVisible()
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

  it("changes only preference and preserves a selected non-default after reordered recommendations", () => {
    const first = options[0]!
    const other = { ...first, ref: { ...first.ref, templateId: "UI-ONLY" }, method: { familyId: "ui-only-family", configurationId: "UI-ONLY", version: "1" }, mainSummary: "다른 방법 예시" }
    const onChange = vi.fn()
    function Harness() {
      const [preference, setPreference] = React.useState<RepeatPreference>("NEUTRAL")
      return <PlanMethodPicker options={preference === "NEUTRAL" ? [first, other] : [{ ...other, recommended: true }, { ...first, recommended: false }]}
        selected={first.ref} onChange={onChange} repeatPreference={preference} onRepeatPreferenceChange={setPreference} />
    }
    render(<Harness />)
    fireEvent.click(screen.getByText("훈련 방법 선택"))
    expect(screen.getByRole("radio", { name: "선호 없음" })).toBeChecked()
    for (const name of ["덜 해본 방법 선호", "해본 방법 선호", "선호 없음"]) {
      fireEvent.click(screen.getByRole("radio", { name }))
      expect(screen.getByRole("radio", { name })).toBeChecked()
      expect(screen.getByRole("radio", { name: /1000m 5회/u })).toBeChecked()
      expect(onChange).not.toHaveBeenCalled()
    }
  })

  it("does not count same-family configurations or unmapped refs as additional eligible families", () => {
    const first = options[0]!
    const sameFamily = { ...first, ref: { ...first.ref, templateId: "UI-CONFIG" } }
    const unmapped = { ...first, method: undefined, ref: { ...first.ref, templateId: "UI-UNKNOWN" } }
    render(<PlanMethodPicker options={[first, sameFamily, unmapped]} selected={null} onChange={vi.fn()} onRepeatPreferenceChange={vi.fn()} />)
    fireEvent.click(screen.getByText("훈련 방법 선택"))
    expect(screen.queryByRole("group", { name: "추천 선호 (선택)" })).toBeNull()
  })
})
