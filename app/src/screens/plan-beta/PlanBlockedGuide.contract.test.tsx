import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { createBodyReviewPlanPreview, generatePlanFromDraft } from "../../domain/plan-beta-flow"
import { JOURNAL_STORAGE_KEY } from "../../domain/journal-local-storage"
import { loadPlanBetaState, savePlanBetaState } from "../../domain/plan-beta-store"
import { stateFixture } from "../../domain/plan-beta-store.test-fixture"
import { PlanBlockedGuide } from "./PlanBlockedGuide"

const draft = {
  eventGroup: "MIDDLE_DISTANCE" as const, eventDistanceM: 1500 as const,
  competitionDivision: "OPEN" as const, experienceBand: "DEVELOPING" as const,
  availableDayCount: 3 as const, requestedFrameLength: 9 as const,
  trainingFocus: "LT_INTENT" as const, secondSessionMode: "SINGLE_SESSION_ONLY" as const,
  trainingTimePreference: "VARIES" as const, selectedDetailedTemplateRef: null,
}

beforeEach(() => { window.localStorage.clear(); window.sessionStorage.clear() })
afterEach(cleanup)

describe("body-review plan preview", () => {
  it("explains an unresolved recheck without granting clearance", () => {
    render(<PlanBlockedGuide draft={draft} recheckAttempted onWriteLog={() => {}} onRecheck={() => {}} />)
    expect(screen.getByRole("status")).toHaveTextContent("다시 확인했지만 아직 시작 전 확인이 필요해요")
    expect(screen.getByRole("button", { name: "계획안 만들기" })).toBeDisabled()
    expect(loadPlanBetaState()).toBeNull()
  })
  it("requires an explicit check before showing the calendar and keeps activation unavailable", () => {
    render(<PlanBlockedGuide draft={draft} onWriteLog={() => {}} onRecheck={() => {}} />)
    const create = screen.getByRole("button", { name: "계획안 만들기" })
    expect(create).toBeDisabled()
    fireEvent.click(create)
    expect(screen.queryByRole("heading", { name: "계획안을 만들었어요" })).toBeNull()
    fireEvent.click(screen.getByRole("checkbox", { name: /계획안은 미리보기/u }))
    fireEvent.click(create)
    expect(screen.getByRole("heading", { name: "계획안을 만들었어요" })).toBeVisible()
    expect(screen.getByRole("region", { name: "9일 훈련 일정" })).toBeVisible()
    expect(screen.queryByRole("button", { name: /이 계획으로 시작|이 일정으로 시작|간단히|자세히/u })).toBeNull()
    expect(loadPlanBetaState()).toBeNull()
  })

  it("does not clear the normal generation block or return activation-capable fields", () => {
    expect(createBodyReviewPlanPreview(draft, false)).toEqual({ kind: "unavailable" })
    const preview = createBodyReviewPlanPreview(draft, true)
    expect(preview.kind).toBe("safety_review_preview")
    if (preview.kind !== "safety_review_preview") throw new Error("Expected a preview")
    expect(preview.sessions.length).toBeGreaterThan(0)
    expect(preview.activationAllowed).toBe(false)
    expect(Object.keys(preview).sort()).toEqual(["activationAllowed", "frameLengthDays", "kind", "requiresBodyReview", "sessions", "startDate"].sort())
    expect(preview.sessions.every(session => session.prescription.kind !== "PACE_TARGET")).toBe(true)
    expect(generatePlanFromDraft(draft, "REVIEW_REQUIRED").kind).toBe("blocked")
  })

  it("leaves an existing plan and unreadable journal untouched", () => {
    const previous = stateFixture()
    expect(savePlanBetaState(previous).ok).toBe(true)
    window.localStorage.setItem(JOURNAL_STORAGE_KEY, "{")
    const original = { ...window.localStorage }
    expect(createBodyReviewPlanPreview(draft, true).kind).toBe("safety_review_preview")
    expect({ ...window.localStorage }).toEqual(original)
    expect(loadPlanBetaState()).toEqual(previous)
    expect(generatePlanFromDraft(draft, "NO_KNOWN_RISK").kind).toBe("blocked")
  })

  it("rejects raw memo fields and malformed profiles", () => {
    expect(createBodyReviewPlanPreview({ ...draft, memo: "private" } as typeof draft, true)).toEqual({ kind: "unavailable" })
    expect(createBodyReviewPlanPreview({}, true)).toEqual({ kind: "unavailable" })
  })

  it("restarts acknowledgement on remount rather than preserving a clearance", () => {
    const props = { draft, onWriteLog: () => {}, onRecheck: () => {} }
    const view = render(<PlanBlockedGuide {...props} />)
    fireEvent.click(screen.getByRole("checkbox", { name: /계획안은 미리보기/u }))
    view.unmount()
    render(<PlanBlockedGuide {...props} />)
    expect(screen.getByRole("checkbox", { name: /계획안은 미리보기/u })).not.toBeChecked()
    expect(screen.getByRole("button", { name: "계획안 만들기" })).toBeDisabled()
  })
})
