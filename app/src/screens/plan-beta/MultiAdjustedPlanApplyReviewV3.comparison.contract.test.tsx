import { cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { initializeCanonicalJournalFixture } from "../../test/canonical-journal-fixture"
import { multiAdjustedCycleMaterial } from "../../domain/adjusted-cycle-successor.test-fixtures"
import { adjustedPlanSelectionV3Fixture } from "../../domain/adjusted-plan-selection-v3.test-fixtures"
import { prepareMultiAdjustedPlanCandidateV3 } from "../../domain/adjusted-plan-multi-candidate-v3"
import { buildWorkoutMemo } from "../../domain/workout-memo"
import { MultiAdjustedPlanApplyReviewV3 } from "./MultiAdjustedPlanApplyReviewV3"

beforeEach(async () => { await initializeCanonicalJournalFixture() })
afterEach(() => { cleanup(); vi.restoreAllMocks() })

it("shows each actual MAIN before and after instead of substituting the adjustment offer baseline", () => {
  const material = multiAdjustedCycleMaterial()
  const original = JSON.stringify(material.request)
  const prepared = prepareMultiAdjustedPlanCandidateV3(material.request.preparations, material.readReview().rpeBindings)
  if (prepared.kind !== "prepared") throw Error(prepared.code)
  const onSaved = vi.fn()
  render(<MultiAdjustedPlanApplyReviewV3 seed={material.request} readReview={material.readReview}
    isCurrentDraft={() => true} onSaved={onSaved} onCancel={vi.fn()} />)
  const comparisons = screen.getAllByRole("region", { name: "훈련 내용 변경" })
  expect(comparisons).toHaveLength(prepared.candidate.changedSlots.length)
  expect(comparisons.length).toBeGreaterThan(1)
  comparisons.forEach((region, index) => {
    const address = prepared.candidate.changedSlots[index]!
    const before = material.request.preparations[0]!.candidate.sessions.find(s => s.day === address.day && s.slot === address.slot)!
    const after = prepared.candidate.sessions.find(s => s.day === address.day && s.slot === address.slot)!
    const summary = within(region.querySelector('dl[aria-label="본운동 변경 전후"]')! as HTMLElement)
    const labels = summary.getAllByRole("term").map(node => node.textContent)
    expect(labels).toEqual(["현재", "변경안"])
    const [current, proposed] = summary.getAllByRole("definition")
    for (const line of buildWorkoutMemo(before)!.lines.filter(line => !["준비", "정리"].includes(line.label))) {
      expect(current).toHaveTextContent(line.text)
    }
    for (const line of buildWorkoutMemo(after)!.lines.filter(line => !["준비", "정리"].includes(line.label))) {
      expect(proposed).toHaveTextContent(line.text)
    }
    if (before.prescription.kind === "RPE_TIME_RANGE" && !before.prescription.catalogWorkout) {
      expect(current).toHaveTextContent("전체 운동")
      expect(current).not.toHaveTextContent("반복 사이")
      expect(within(region).getByText(/정해지지 않은 반복·회복은 비교하지 않았어요/u)).toBeVisible()
    } else {
      expect(current).toHaveTextContent("본운동")
      expect(within(region).queryByText(/정해지지 않은 반복·회복은 비교하지 않았어요/u)).toBeNull()
    }
    expect(region.querySelector("details")).not.toHaveAttribute("open")
  })
  expect(screen.getByRole("button", { name: "이 구성으로 계획 저장" })).toBeEnabled()
  expect(onSaved).not.toHaveBeenCalled()
  expect(JSON.stringify(material.request)).toBe(original)
})

it("keeps exact distance, target and recovery in an anchored MAIN comparison before opening full methods", () => {
  const { request: single } = adjustedPlanSelectionV3Fixture()
  const { preparation, ...common } = single
  const prepared = prepareMultiAdjustedPlanCandidateV3([preparation])
  if (prepared.kind !== "prepared") throw Error(prepared.code)
  const seed = { ...common, preparations: [preparation], expectedCandidateFingerprint: prepared.candidate.contentFingerprint }
  const onSaved = vi.fn()
  render(<MultiAdjustedPlanApplyReviewV3 seed={seed}
    readReview={() => ({ preparations: [preparation], rpeBindings: [], policies: [], retained: [] })}
    isCurrentDraft={() => true} onSaved={onSaved} onCancel={vi.fn()} />)
  const region = screen.getByRole("region", { name: "훈련 내용 변경" })
  const [current, changed] = within(region.querySelector('dl[aria-label="본운동 변경 전후"]')! as HTMLElement).getAllByRole("definition")
  expect(current).toHaveTextContent("목표")
  expect(current).toHaveTextContent("1000m")
  expect(current).toHaveTextContent("반복 사이")
  expect(changed).toHaveTextContent("2 세트 × (3 × 200m")
  expect(changed).toHaveTextContent("44.4초/200m")
  expect(changed).toHaveTextContent("100m 걷기 + 17초 서서 쉬기")
  expect(changed).toHaveTextContent("종료 뒤 31초 서서 쉬기")
  expect(current!.textContent).not.toEqual(changed!.textContent)
  expect(within(region).getByRole("region", { name: "현재 구성" })).not.toBeVisible()
  fireEvent.click(within(region).getByText("전체 방법 비교"))
  expect(within(region).getByRole("region", { name: "현재 구성" })).toBeVisible()
  expect(within(region).getByRole("region", { name: "변경 후 구성" })).toBeVisible()
  expect(screen.queryByRole("button", { name: "이미지 저장" })).toBeNull()
  expect(onSaved).not.toHaveBeenCalled()
})

it("does not offer save when the prepared source cannot be verified", () => {
  const material = multiAdjustedCycleMaterial()
  const seed = { ...material.request, preparations: material.request.preparations.map((preparation, index) =>
    index === 0 ? { ...preparation, rawSnapshot: "{}" } : preparation) }
  render(<MultiAdjustedPlanApplyReviewV3 seed={seed} readReview={material.readReview}
    isCurrentDraft={() => true} onSaved={vi.fn()} onCancel={vi.fn()} />)
  expect(screen.getByRole("alert")).toHaveTextContent("구성과 설명의 연결을 확인하지 못했어요")
  expect(screen.getByRole("button", { name: "이 구성으로 계획 저장" })).toBeDisabled()
  expect(screen.queryByRole("region", { name: "훈련 내용 변경" })).toBeNull()
})
