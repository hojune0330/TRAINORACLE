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
    expect(screen.getByText(/지금 선택할 수 있는 상세 방법은 1개/u)).toBeVisible()
    expect(screen.getAllByRole("radio")).toHaveLength(2)
    expect(screen.getByRole("radio", { name: /시간과 체감 강도로 안내받기/u })).toBeChecked()
    expect(screen.queryByRole("group", { name: "추천 선호 (선택)" })).toBeNull()
    expect(screen.getByText(/자기보고 완료 0회/u)).not.toBeVisible()
    fireEvent.click(screen.getByText("추천에 참고한 이력"))
    expect(screen.getByText(/진행 중인 계획의 이력은 포함되지 않아요/u)).toBeVisible()
  })
  it("sends the exact reference and does not treat RPE as another detailed method", () => {
    const onChange = vi.fn()
    render(<PlanMethodPicker options={options} selected={null} onChange={onChange} />)
    fireEvent.click(screen.getByText("훈련 방법 선택"))
    fireEvent.click(screen.getByRole("radio", { name: /1000m 5회/u }))
    expect(onChange).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole("button", { name: "이 훈련으로 변경" }))
    expect(onChange).toHaveBeenCalledWith(options[0]!.ref)
    expect(screen.getByText(/다른 방법은 준비 중이에요/u)).toBeVisible()
  })
  it("lets the athlete return to RPE without a restart of intake", () => {
    const onChange = vi.fn()
    render(<PlanMethodPicker options={options} selected={options[0]!.ref} onChange={onChange} />)
    fireEvent.click(screen.getByText("훈련 방법 선택"))
    fireEvent.click(screen.getByRole("radio", { name: /시간과 체감 강도로 안내받기/u }))
    expect(onChange).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole("button", { name: "이 훈련으로 변경" }))
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
    const sequence = structuredClone(options[0]!.sequence!)
    const group = sequence.main[0]!
    if (group.kind !== "group" || group.children[0]?.kind !== "segment") throw Error("FIXTURE_SHAPE_CHANGED")
    const alternate = { ...options[0]!, sequence: { ...sequence, main: [{ ...group, children: [{ ...group.children[0], work: { kind: "duration" as const, durationSeconds: 120, distanceM: null } }] }] }, ref: { ...options[0]!.ref, templateId: "UI-FIXTURE-ONLY" }, mainSummary: "시간형 구간", recoverySummary: "거리형 회복" }
    const onChange = vi.fn()
    render(<PlanMethodPicker options={[options[0]!, alternate]} selected={options[0]!.ref} onChange={onChange} />)
    fireEvent.click(screen.getByText("훈련 방법 선택"))
    expect(screen.getAllByRole("radio")).toHaveLength(3)
    fireEvent.click(screen.getByRole("button", { name: "다른 훈련" }))
    expect(screen.queryByRole("button", { name: "다른 훈련" })).toBeNull()
    expect(screen.getByText(/선택 가능한 방법을 모두 봤어요/)).toBeVisible()
    expect(screen.getByRole("button", { name: "본 방법 다시 보기" })).toBeVisible()
    fireEvent.click(screen.getByRole("radio", { name: /시간형 구간/u }))
    expect(onChange).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole("button", { name: "이 훈련으로 변경" }))
    expect(onChange).toHaveBeenCalledWith(alternate.ref)
    expect(screen.queryByText(/상세 방법은 1개/u)).toBeNull()
  })
  it("keeps additional choices accessible and preserves a selected non-default method", () => {
    const extra = { ...options[0]!, recommended: false, ref: { ...options[0]!.ref, templateId: "UI-EXTRA-ONLY" }, mainSummary: "추가 방법 예시" }
    const props = { options: [...options, extra], onChange: vi.fn() }
    const view = render(<PlanMethodPicker {...props} selected={options[0]!.ref} />)
    fireEvent.click(screen.getByText("훈련 방법 선택"))
    expect(screen.queryByRole("radio", { name: /추가 방법 예시/u })).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "다른 훈련 보기 (1)" }))
    fireEvent.click(screen.getByRole("radio", { name: /추가 방법 예시/u }))
    expect(props.onChange).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole("button", { name: "이 훈련으로 변경" }))
    expect(props.onChange).toHaveBeenCalledWith(extra.ref)
    view.rerender(<PlanMethodPicker {...props} selected={extra.ref} />)
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
    expect(screen.queryByRole("button", { name: "다른 훈련" })).toBeNull()
  })

  it("does not offer a one-repeat reduction with no between-rest as another method", () => {
    const first = options[0]!, sequence = structuredClone(first.sequence!)
    const root = sequence.main[0]!
    const single = { ...first, sequence: { ...sequence, main: [{ ...root, repeatCount: 1,
      recoveryBetweenRepeats: { mode: "NOT_APPLICABLE" as const, seconds: null } }] },
      ref: { ...first.ref, templateId: "0-COUNT-ONLY" }, mainSummary: "반복 축소 시험" }
    render(<PlanMethodPicker options={[single, first]} selected={first.ref} onChange={vi.fn()} />)
    fireEvent.click(screen.getByText("훈련 방법 선택"))
    expect(screen.queryByRole("button", { name: "다른 훈련" })).toBeNull()
  })

  it("preview, undo, redo and cancel do not call the parent; repeated apply is one request", () => {
    const onChange = vi.fn(), onPendingChange = vi.fn()
    render(<PlanMethodPicker options={options} selected={null} onChange={onChange} onPendingChange={onPendingChange} />)
    fireEvent.click(screen.getByText("훈련 방법 선택"))
    fireEvent.click(screen.getByRole("radio", { name: /1000m 5회/ }))
    expect(onPendingChange).toHaveBeenLastCalledWith(true)
    fireEvent.click(screen.getByRole("button", { name: "되돌리기" }))
    expect(onPendingChange).toHaveBeenLastCalledWith(false)
    fireEvent.click(screen.getByRole("button", { name: "다시 하기" }))
    expect(onChange).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole("button", { name: "이 훈련으로 변경" }))
    fireEvent.click(screen.getByRole("button", { name: "이 훈련으로 변경" }))
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it("keeps two explicit set-rest methods when a single-set variant sorts first by ID", () => {
    const first = options[0]!, sequence = first.sequence!
    const set = (id: string, count: number, rest: number) => ({ ...first,
      ref: { ...first.ref, templateId: id }, mainSummary: id,
      sequence: { ...sequence, main: [{ kind: "group" as const, id: `${id}-set`, label: null,
        repeatCount: count, recoveryBetweenRepeats: count > 1
          ? { mode: "WALK" as const, seconds: rest } : { mode: "NOT_APPLICABLE" as const, seconds: null },
        recoveryAfter: { mode: "NOT_APPLICABLE" as const, seconds: null }, children: sequence.main,
      }] },
    })
    const a = set("A-REST60", 2, 60), b = set("B-REST120", 2, 120)
    render(<PlanMethodPicker options={[set("0-SINGLE", 1, 0), a, b]} selected={a.ref} onChange={vi.fn()} />)
    fireEvent.click(screen.getByText("훈련 방법 선택"))
    fireEvent.click(screen.getByRole("button", { name: "다른 훈련" }))
    expect(screen.getByRole("radio", { name: /B-REST120/ })).toBeChecked()
    expect(screen.getByRole("button", { name: "본 방법 다시 보기" })).toBeVisible()
  })

  it("invalidates a pending preview when the record content or plan context changes", () => {
    const onChange = vi.fn(), onPendingChange = vi.fn()
    const view = render(<PlanMethodPicker options={options} selected={null} contextKey="PB:1110" onChange={onChange} onPendingChange={onPendingChange} />)
    fireEvent.click(screen.getByText("훈련 방법 선택"))
    fireEvent.click(screen.getByRole("radio", { name: /1000m 5회/ }))
    expect(onPendingChange).toHaveBeenLastCalledWith(true)
    view.rerender(<PlanMethodPicker options={options} selected={null} contextKey="PB:1111" onChange={onChange} onPendingChange={onPendingChange} />)
    expect(screen.queryByRole("button", { name: "이 훈련으로 변경" })).toBeNull()
    expect(onPendingChange).toHaveBeenLastCalledWith(false)
    expect(onChange).not.toHaveBeenCalled()
  })
})
