import React from "react"
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import { afterEach, expect, it } from "vitest"
import type { PrescriptionSequenceV3, SequenceNodeV3 } from "@impl/prescription/sequence-v3"
import { PrescriptionStructureV3 } from "./PrescriptionStructureV3"

afterEach(cleanup)
it("keeps preparation, its repeat recovery, main and cooldown visible in compact mode", () => {
  const part = (id: string, role: "WORK" | "PREPARATION", seconds: number, repeatCount = 1): SequenceNodeV3 => ({
    kind: "segment", id, label: null, role, repeatCount,
    work: { kind: "duration", durationSeconds: seconds, distanceM: null },
    target: { kind: "EFFORT_GUIDANCE", cue: "합성 시험" },
    recoveryBetweenRepeats: repeatCount > 1 ? [{ mode: "WALK", seconds: 30 }] : [], recoveryAfter: [],
  })
  const sequence: PrescriptionSequenceV3 = { kind: "PRESCRIPTION_SEQUENCE", version: 3, id: "SYNTHETIC", label: null,
    warmup: [part("warm", "PREPARATION", 60, 2)], main: [part("main", "WORK", 120)],
    cooldown: [part("cool", "PREPARATION", 90)] }
  render(<PrescriptionStructureV3 sequence={sequence} compact />)
  const warmup = within(screen.getByRole("region", { name: "준비운동" }))
  expect(warmup.getByText("1분 × 2회")).toBeVisible()
  expect(warmup.getByText(/걷기 · 30초/)).toBeVisible()
  expect(screen.getByText("2분")).toBeVisible()
  expect(within(screen.getByRole("region", { name: "정리운동" })).getByText("1분 30초")).toBeVisible()
  expect(screen.getByLabelText("계획된 전체 시간")).toHaveTextContent("총 6분")
})

it("keeps executable support and recovery visible when secondary detail is collapsed", () => {
  const part = (id: string, seconds: number): SequenceNodeV3 => ({
    kind: "segment", id, label: null, role: id === "main" ? "WORK" : "PREPARATION", repeatCount: 2,
    work: { kind: "duration", durationSeconds: seconds, distanceM: null },
    target: { kind: "EFFORT_GUIDANCE", cue: "합성 시험" },
    recoveryBetweenRepeats: [{ mode: "WALK", seconds: 30 }], recoveryAfter: [],
  })
  const sequence: PrescriptionSequenceV3 = { kind: "PRESCRIPTION_SEQUENCE", version: 3, id: "SYNTHETIC", label: null,
    warmup: [part("warm", 60)], main: [part("main", 120)], cooldown: [part("cool", 90)] }
  const original = JSON.stringify(sequence)
  render(<PrescriptionStructureV3 sequence={sequence} compact collapseSupport />)
  const warmup = screen.getByRole("region", { name: "준비운동" })
  const main = screen.getAllByRole("region", { name: "본운동" }).find(node => !node.closest("details"))!
  const cooldown = screen.getByRole("region", { name: "정리운동" })
  expect(within(warmup).getByText("1분 × 2회")).toBeVisible()
  expect(within(main).getByText("2분 × 2회")).toBeVisible()
  expect(within(cooldown).getByText("1분 30초 × 2회")).toBeVisible()
  for (const phase of [warmup, main, cooldown]) {
    expect(within(phase).getByText(/걷기 · 30초/)).toBeVisible()
    expect(within(phase).getByText("반복 사이 · 1번")).toBeVisible()
    expect(phase.closest("details")).toBeNull()
  }
  expect(warmup.compareDocumentPosition(main) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(main.compareDocumentPosition(cooldown) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(screen.getByLabelText("계획된 전체 시간")).toHaveTextContent("총 10분 30초 · 준비·회복·정리 포함")
  const detail = screen.getByText("수행 표기·구간 상세").closest("details")!
  expect(detail).not.toHaveAttribute("open")
  fireEvent.click(within(detail).getByText("수행 표기·구간 상세"))
  expect(within(detail).getByText(/1분 · 합성 시험/)).toBeVisible()
  expect(within(detail).getAllByText(/걷기 · 30초/)).toHaveLength(3)
  expect(JSON.stringify(sequence)).toBe(original)
})

it("preserves labelled nested sets, ordered recoveries and unknown distance time in the basic view", () => {
  // Synthetic display structure, not a runtime-adopted prescription.
  const sequence: PrescriptionSequenceV3 = { kind: "PRESCRIPTION_SEQUENCE", version: 3, id: "SYNTHETIC", label: null,
    warmup: [], cooldown: [], main: [{ kind: "group", id: "sets", label: "합성 세트", repeatUnit: "SET", repeatCount: 2,
      recoveryBetweenRepeats: [{ mode: "STAND", seconds: 120 }], recoveryAfter: [{ mode: "WALK", seconds: 45 }],
      children: [{ kind: "segment", id: "work", label: "합성 운동 동작", role: "WORK", repeatCount: 3,
        work: { kind: "distance", distanceM: 400, durationSeconds: null },
        target: { kind: "RACE_PACE", eventDistanceM: 5000, anchorRef: null },
        recoveryBetweenRepeats: [{ mode: "JOG", distanceM: 100, seconds: null }],
        recoveryAfter: [{ mode: "STAND", seconds: 30 }] }],
    }] }
  const original = JSON.stringify(sequence)
  render(<PrescriptionStructureV3 sequence={sequence} compact collapseSupport />)
  const main = within(screen.getAllByRole("region", { name: "본운동" }).find(node => !node.closest("details"))!)
  expect(main.getByText("합성 세트")).toBeVisible()
  expect(main.getByText("합성 운동 동작")).toBeVisible()
  expect(main.getByText("2세트")).toBeVisible()
  expect(main.getByText("400m × 3회")).toBeVisible()
  expect(main.getByText("반복 사이 · 2번")).toBeVisible()
  expect(main.getByText("세트 사이 · 1번")).toBeVisible()
  expect(main.getByText("가벼운 조깅 · 100m")).toBeVisible()
  expect(main.getByText("서서 쉬기 · 2분")).toBeVisible()
  expect(main.getByText("서서 쉬기 · 30초")).toBeVisible()
  expect(main.getByText("걷기 · 45초")).toBeVisible()
  expect(main.getAllByText("위 구성을 모두 마친 뒤 한 번")).toHaveLength(2)
  expect(screen.getByLabelText("계획된 전체 시간")).toHaveTextContent("전체 시간은 아직 계산할 수 없어요.")
  expect(main.queryByText(/100초|400초/)).not.toBeInTheDocument()
  expect(JSON.stringify(sequence)).toBe(original)
})
