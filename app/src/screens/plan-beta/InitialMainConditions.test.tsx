import React from "react"
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { InitialMainConditions } from "./InitialMainConditions"
import { generatePlanFromDraft } from "../../domain/plan-beta-flow"
import { applyInitialMainConditions, applyInitialMainManual, reviewInitialMainConditions } from "../../domain/initial-main-conditions"
import type { InitialMainInput } from "../../domain/initial-main-conditions"
import { setActiveLocalAccount } from "../../domain/account/local-journal-ownership"

beforeEach(() => { localStorage.clear(); sessionStorage.clear(); setActiveLocalAccount(null) })
afterEach(() => { cleanup(); setActiveLocalAccount(null) })
function fixture(trainingFocus = "ATP_PC_INTENT" as "ATP_PC_INTENT" | "GLY_INTENT", experienceBand = "NEW_TO_RUNNING" as "NEW_TO_RUNNING" | "DEVELOPING" | "EXPERIENCED"): InitialMainInput {
  const source = generatePlanFromDraft({ eventGroup: "FIVE_K", eventDistanceM: 5000, competitionDivision: "OPEN", experienceBand,
    availableDayCount: "EVERY_DAY", requestedFrameLength: 9, trainingFocus, selectedDetailedTemplateRef: null,
    secondSessionMode: "SINGLE_SESSION_ONLY", trainingTimePreference: "EVENING" }, "NO_KNOWN_RISK")
  if (source.kind !== "generated") throw Error(source.kind)
  return { generated: source.generated, intake: source.intake, gate: source.gate,
    context: { mode: "newplan", startDate: "2026-10-02", accountScope: null, revision: 1 } }
}
const applyName = "이 훈련으로 적용"

describe("grouped initial MAIN environment confirmation", () => {
  it("shows all actual dates and complete reviewed work before one unchecked space question", () => {
    const input = fixture(), onApply = vi.fn(), onPendingChange = vi.fn(), snapshot = JSON.stringify(input)
    render(<InitialMainConditions input={input} onApply={onApply} onPendingChange={onPendingChange} />)
    const review = reviewInitialMainConditions(input)!
    const checkbox = screen.getByRole("checkbox")
    expect(checkbox).not.toBeChecked()
    expect(screen.getAllByRole("checkbox")).toHaveLength(1)
    for (const offer of review.offers) {
      expect(screen.getByRole("heading", { name: `${offer.date} ${offer.slot === "AM" ? "오전" : "오후"} · ${offer.name}` })).toBeVisible()
      expect(checkbox.closest("label")).toHaveTextContent(offer.date)
    }
    expect(within(screen.getByRole("list", { name: "확인할 주요 훈련" })).getAllByText(/준비·회복·정리 포함 약/u)).toHaveLength(review.offers.length)
    expect(screen.getByText("상세 훈련 미리보기").closest("details")).not.toHaveAttribute("open")
    expect(screen.queryByRole("spinbutton")).toBeNull()
    expect(screen.getByRole("button", { name: applyName })).toBeDisabled()
    fireEvent.click(checkbox)
    expect(onPendingChange).toHaveBeenLastCalledWith(true)
    expect(onApply).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole("button", { name: applyName }))
    expect(onApply).toHaveBeenCalledWith(review.key, ["ACCELERATION_AND_DECELERATION_SPACE"])
    expect(applyInitialMainConditions(input, ...onApply.mock.calls[0] as [string, readonly string[]])).not.toBeNull()
    expect(JSON.stringify(input)).toBe(snapshot)
    expect(localStorage.getItem("trainoracle.plan-beta.v1")).toBeNull()
  })
  it.each(["date", "revision", "account"] as const)("revokes %s answers permanently, including return to the previous context", field => {
    const input = fixture(), onApply = vi.fn(), view = render(<InitialMainConditions input={input} onApply={onApply} />)
    fireEvent.click(screen.getByRole("checkbox"))
    if (field === "account") setActiveLocalAccount("another")
    const changed = { ...input, context: { ...input.context, ...field === "date" ? { startDate: "2026-11-02" }
      : field === "revision" ? { revision: 2 } : { accountScope: "another" } } }
    view.rerender(<InitialMainConditions input={changed} onApply={onApply} />)
    expect(screen.getByRole("checkbox")).not.toBeChecked()
    if (field === "account") setActiveLocalAccount(null)
    view.rerender(<InitialMainConditions input={input} onApply={onApply} />)
    expect(screen.getByRole("checkbox")).not.toBeChecked()
    expect(screen.getByRole("button", { name: applyName })).toBeDisabled()
    expect(onApply).not.toHaveBeenCalled()
  })
  it("rejects an account change at click time even before rerender", () => {
    const input = fixture(), onApply = vi.fn()
    render(<InitialMainConditions input={input} onApply={onApply} />)
    fireEvent.click(screen.getByRole("checkbox"))
    setActiveLocalAccount("another")
    fireEvent.click(screen.getByRole("button", { name: applyName }))
    expect(onApply).not.toHaveBeenCalled()
  })
  it("unchecking and explicit cancellation leave no pending confirmation", () => {
    const input = fixture(), onApply = vi.fn(), onPendingChange = vi.fn()
    render(<InitialMainConditions input={input} onApply={onApply} onPendingChange={onPendingChange} />)
    fireEvent.click(screen.getByRole("checkbox"))
    fireEvent.click(screen.getByRole("checkbox"))
    expect(screen.getByRole("button", { name: applyName })).toBeDisabled()
    expect(onPendingChange).toHaveBeenLastCalledWith(false)
    fireEvent.click(screen.getByRole("checkbox"))
    fireEvent.click(screen.getByRole("button", { name: "변경 취소" }))
    expect(screen.getByRole("checkbox")).not.toBeChecked()
    expect(onPendingChange).toHaveBeenLastCalledWith(false)
    expect(onApply).not.toHaveBeenCalled()
  })
  it("beginner GLY states the policy gap and only requests an explicit eligible purpose change", () => {
    const input = fixture("GLY_INTENT"), onApply = vi.fn(), onChooseAlternative = vi.fn(), snapshot = JSON.stringify(input)
    render(<InitialMainConditions input={input} onApply={onApply} onChooseAlternative={onChooseAlternative} />)
    expect(screen.getByRole("status")).toHaveTextContent("처음 시작하는 분께 맞는 해당계 세부 훈련은 아직 준비 중이에요")
    expect(screen.queryByRole("checkbox")).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "심폐 반복 목적으로 새 계획 보기" }))
    expect(onChooseAlternative).toHaveBeenCalledWith(expect.objectContaining({ trainingFocus: "VO2_INTENT" }))
    expect(onApply).not.toHaveBeenCalled()
    expect(JSON.stringify(input)).toBe(snapshot)
  })
  it("developing GLY has an empty explicit target input and blocks other dates until apply or cancel", () => {
    const input = fixture("GLY_INTENT", "DEVELOPING"), onApply = vi.fn(), onApplyManual = vi.fn(), onPendingChange = vi.fn()
    render(<InitialMainConditions input={input} onApply={onApply} onApplyManual={onApplyManual} onPendingChange={onPendingChange} />)
    fireEvent.click(screen.getByText(/· 구간 시간 정하기$/u))
    expect(screen.getByText(/지금 바로 바꿀 수 있는 다른 구성이 없어요/u)).toBeVisible()
    const seconds = screen.getByRole("spinbutton", { name: /200m 운동 구간/u })
    expect(seconds).toHaveValue(null)
    expect(screen.getByRole("button", { name: "이 구성으로 바꾸기" })).toBeDisabled()
    fireEvent.change(seconds, { target: { value: "45" } })
    expect(screen.getByRole("combobox", { name: "시간을 정할 일정" })).toBeDisabled()
    expect(onPendingChange).toHaveBeenLastCalledWith(true)
    expect(onApplyManual).not.toHaveBeenCalled()
    expect(screen.getByRole("button", { name: "이 구성으로 바꾸기" })).toBeDisabled()
    fireEvent.click(screen.getByRole("checkbox", { name: /준비·회복·정리까지 최대/u }))
    fireEvent.click(screen.getByRole("button", { name: "이 구성으로 바꾸기" }))
    expect(onApplyManual).toHaveBeenCalledOnce()
    const args = onApplyManual.mock.calls[0]! as Parameters<typeof applyInitialMainManual> extends [unknown, ...infer Rest] ? Rest : never
    expect(applyInitialMainManual(input, ...args)).not.toBeNull()
    expect(onApply).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole("button", { name: "변경 취소" }))
    expect(screen.getByRole("spinbutton", { name: /200m 운동 구간/u })).toHaveValue(null)
    expect(onPendingChange).toHaveBeenLastCalledWith(false)
    expect(screen.getByRole("combobox", { name: "시간을 정할 일정" })).toBeEnabled()
  })
  it("does not show a condition prompt for stored plans or already eligible GLY; disables while parent is busy", () => {
    const input = fixture(), onApply = vi.fn(), view = render(<InitialMainConditions input={input} onApply={onApply} disabled />)
    expect(screen.getByRole("checkbox")).toBeDisabled()
    expect(screen.getByRole("button", { name: applyName })).toBeDisabled()
    view.rerender(<InitialMainConditions input={{ ...input, context: { ...input.context, mode: "saved-plan" } }} onApply={onApply} />)
    expect(screen.queryByRole("region", { name: "첫 주요 훈련 조건" })).toBeNull()
    view.rerender(<InitialMainConditions input={fixture("GLY_INTENT", "EXPERIENCED")} onApply={onApply} />)
    expect(screen.queryByRole("region", { name: "첫 주요 훈련 조건" })).toBeNull()
  })
})
