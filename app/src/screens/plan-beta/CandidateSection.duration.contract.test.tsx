import React from "react"
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import type { PlanCandidate, PlanSession } from "@impl/plan-generator/types"
import { bindCatalogSession } from "@impl/prescription/catalog-session-binding"
import { generatePlanFromDraft } from "../../domain/plan-beta-flow"
import { draftFor, RUNTIME_CASES } from "../../domain/prescription-quality-matrix.test-fixtures"
import { CandidateSection } from "./CandidateSection"

afterEach(cleanup)

function syntheticEasySession(minimum: number, maximum: number): PlanSession {
  return {
    day: 1,
    slot: "AM",
    role: "EASY",
    plannedEnergyIntent: "BASE_INTENT",
    prescription: {
      kind: "RPE_TIME_RANGE",
      rpe: { minimum: 3, maximum: 4 },
      durationMinutes: { minimum, maximum },
    },
  }
}

function candidatePair(): { readonly a: PlanCandidate; readonly b: PlanCandidate } {
  const result = generatePlanFromDraft(draftFor(RUNTIME_CASES[3]!), "NO_KNOWN_RISK")
  if (result.kind !== "generated") throw new Error("Expected the existing candidate fixture to generate")
  const a = result.generated.candidates.find(candidate => candidate.kind === "BALANCED")
  const b = result.generated.candidates.find(candidate => candidate.kind === "CONSERVATIVE")
  if (!a || !b) throw new Error("Expected both existing candidate kinds")
  return { a, b }
}

function withSessions(candidate: PlanCandidate, sessions: readonly PlanSession[]): PlanCandidate {
  return { ...candidate, sessions }
}

function renderPair(a: PlanCandidate, b: PlanCandidate, onSelectB = vi.fn()) {
  const onSelectA = vi.fn()
  render(<div>
    <CandidateSection candidate={a} startDate="2026-10-12" canSelect expanded={false}
      recommended onToggleSchedule={vi.fn()} onSelect={onSelectA} />
    <CandidateSection candidate={b} startDate="2026-10-12" canSelect expanded={false}
      onToggleSchedule={vi.fn()} onSelect={onSelectB} />
  </div>)
  const card = (title: string) => {
    const heading = screen.getByRole("heading", { name: title })
    const article = heading.closest("article")
    if (!article) throw new Error(`Expected ${title} candidate card`)
    return { ...within(article), element: article }
  }
  return { a: card("계획 A"), b: card("계획 B"), onSelectA, onSelectB }
}

it("shows each candidate's actual easy-session duration before opening details, without ranking either plan", () => {
  const { a, b } = candidatePair()
  const cards = renderPair(
    withSessions(a, [syntheticEasySession(35, 60)]),
    withSessions(b, [syntheticEasySession(35, 35)]),
  )

  const easyTimesA = cards.a.getByRole("region", { name: "기초·회복 운동 시간" })
  const easyTimesB = cards.b.getByRole("region", { name: "기초·회복 운동 시간" })
  const range = within(easyTimesA).getByText("35분~1시간")
  const fixed = within(easyTimesB).getByText("35분")
  expect(range).toBeVisible()
  expect(fixed).toBeVisible()
  expect(range.closest("details")).toBeNull()
  expect(fixed.closest("details")).toBeNull()
  expect(cards.a.getByRole("heading", { name: "계획 A" })).toBeVisible()
  expect(cards.b.getByRole("heading", { name: "계획 B" })).toBeVisible()
  expect(cards.a.getByText("먼저 보기")).toBeVisible()
  expect(cards.b.queryByText("먼저 보기", { exact: true })).toBeNull()
  expect(cards.a.queryByText("추천", { exact: true })).toBeNull()
  expect(cards.b.queryByText("추천", { exact: true })).toBeNull()
  expect(cards.a.element).not.toHaveAttribute("data-recommended", "true")
  expect(cards.b.element).not.toHaveAttribute("data-recommended", "true")
  expect(cards.a.queryByText(/짧게|가장 짧은/u)).toBeNull()
  expect(cards.b.queryByText(/짧게|가장 짧은/u)).toBeNull()

  fireEvent.click(cards.b.getByRole("button", { name: "계획 B로 시작" }))
  expect(cards.onSelectB).toHaveBeenCalledOnce()
  expect(cards.onSelectA).not.toHaveBeenCalled()
})

it("does not call a conservative candidate shorter when both catalog sessions take the same time", () => {
  const { a, b } = candidatePair()
  const bound = bindCatalogSession(syntheticEasySession(30, 45), "P-BASE-C", {
    eventDistanceM: 5000,
    experience: "DEVELOPING",
    availableSeconds: 45 * 60,
    confirmedRequirements: [],
    fiveK: null,
    segmentPaces: [],
  })
  if (!bound || bound.prescription.kind !== "RPE_TIME_RANGE" || !bound.prescription.catalogWorkout) {
    throw new Error("Expected the existing synthetic catalog binding")
  }

  const cards = renderPair(withSessions(a, [bound]), withSessions(b, [bound]))
  const easyTimesA = cards.a.getByRole("region", { name: "기초·회복 운동 시간" })
  const easyTimesB = cards.b.getByRole("region", { name: "기초·회복 운동 시간" })
  expect(within(easyTimesA).getByText("30분")).toBeVisible()
  expect(within(easyTimesB).getByText("30분")).toBeVisible()
  expect(cards.b.getByRole("heading", { name: "계획 B" })).toBeVisible()
  expect(cards.b.queryByText(/짧게|가장 짧은/u)).toBeNull()
  expect(within(easyTimesB).queryByText(/Easy Run/u)).toBeNull()
})
