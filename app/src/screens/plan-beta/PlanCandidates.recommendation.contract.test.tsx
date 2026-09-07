import React from "react"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { generatePlanFromDraft } from "../../domain/plan-beta-flow"
import { PlanCandidates } from "./PlanCandidates"
import * as templateOptions from "./plan-template-options"

beforeEach(() => { localStorage.clear(); sessionStorage.clear() })
afterEach(cleanup)

function setup() {
  const result = generatePlanFromDraft({
    eventGroup: "FIVE_K", eventDistanceM: 5000, competitionDivision: "HIGH_SCHOOL",
    experienceBand: "EXPERIENCED", availableDayCount: 3, requestedFrameLength: 9,
    trainingFocus: "VO2_INTENT", secondSessionMode: "SINGLE_SESSION_ONLY", trainingTimePreference: "EVENING",
    selectedDetailedTemplateRef: null,
  }, "NO_KNOWN_RISK")
  if (result.kind !== "generated") throw new Error("Expected generated fixture")
  const first = templateOptions.resolveDetailedPlanTemplateOptions(result.intake, "2026-09-05T00:00:00.000Z", [])[0]!
  const other = { ...first, ref: { ...first.ref, templateId: "UI-ONLY" },
    method: { familyId: "ui-only-family", configurationId: "UI-ONLY", version: "1" }, mainSummary: "다른 방법 예시" }
  const resolver = vi.spyOn(templateOptions, "resolveDetailedPlanTemplateOptions").mockImplementation((_draft, _now, _history, preference) => (
    preference === "PREFER_VARIETY" ? [other, { ...first, recommended: false }] : [first, other]
  ))
  const props: React.ComponentProps<typeof PlanCandidates> = {
    generated: result.generated, intake: { ...result.intake, selectedDetailedTemplateRef: first.ref },
    athleteEvidence: result.athleteEvidence, prescriptionBinding: result.prescriptionBinding,
    athleteRecords: [], selectedRecordId: null, comparisonRecordId: null,
    recordConfirmationPending: false, onSelectRecord: vi.fn(), onCompareRecord: vi.fn(), onConfirmRecord: vi.fn(),
    onChangeMethod: vi.fn(), onBack: vi.fn(), onSelect: vi.fn(), onSelectionDetailsChange: vi.fn(),
  }
  return { props, resolver }
}

describe("candidate-owned optional recommendation preference", () => {
  it("starts neutral and changes ranking without changing the selected method or confirmation", () => {
    const { props, resolver } = setup()
    render(<PlanCandidates {...props} />)
    fireEvent.click(screen.getByText("훈련 방법 선택"))
    expect(screen.getByRole("radio", { name: "선호 없음" })).toBeChecked()
    expect(resolver.mock.lastCall?.[3]).toBe("NEUTRAL")
    fireEvent.click(screen.getByRole("radio", { name: "덜 해본 방법 선호" }))
    expect(resolver.mock.lastCall?.[3]).toBe("PREFER_VARIETY")
    expect(screen.getByRole("radio", { name: /1000m 5회/u })).toBeChecked()
    expect(props.onChangeMethod).not.toHaveBeenCalled()
    expect(props.onSelectionDetailsChange).not.toHaveBeenCalled()
    expect(props.onConfirmRecord).not.toHaveBeenCalled()
  })

  it.each([
    { eventDistanceM: 3000 }, { eventGroup: "MIDDLE_DISTANCE" }, { trainingFocus: "LT_INTENT" }, { experienceBand: "DEVELOPING" },
  ] as const)("resets preference to neutral when intake context changes %j", (change) => {
    const { props, resolver } = setup()
    const view = render(<PlanCandidates {...props} />)
    fireEvent.click(screen.getByText("훈련 방법 선택"))
    fireEvent.click(screen.getByRole("radio", { name: "해본 방법 선호" }))
    expect(resolver.mock.lastCall?.[3]).toBe("PREFER_REPEAT")
    view.rerender(<PlanCandidates {...props} intake={{ ...props.intake, ...change }} />)
    expect(resolver.mock.lastCall?.[3]).toBe("NEUTRAL")
    expect(screen.getByRole("radio", { name: "선호 없음" })).toBeChecked()
    expect(props.onChangeMethod).not.toHaveBeenCalled()
  })

  it("keeps preference on an unrelated start-date rerender", () => {
    const { props } = setup()
    const view = render(<PlanCandidates {...props} />)
    fireEvent.click(screen.getByText("훈련 방법 선택"))
    fireEvent.click(screen.getByRole("radio", { name: "해본 방법 선호" }))
    view.rerender(<PlanCandidates {...props} startDateValue="2026-09-12" />)
    expect(screen.getByRole("radio", { name: "해본 방법 선호" })).toBeChecked()
  })
})
