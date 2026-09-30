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

it("shows main work first while preserving support, recoveries and the complete total behind a disclosure", () => {
  const part = (id: string, seconds: number): SequenceNodeV3 => ({
    kind: "segment", id, label: null, role: id === "main" ? "WORK" : "PREPARATION", repeatCount: 2,
    work: { kind: "duration", durationSeconds: seconds, distanceM: null },
    target: { kind: "EFFORT_GUIDANCE", cue: "합성 시험" },
    recoveryBetweenRepeats: [{ mode: "WALK", seconds: 30 }], recoveryAfter: [],
  })
  const sequence: PrescriptionSequenceV3 = { kind: "PRESCRIPTION_SEQUENCE", version: 3, id: "SYNTHETIC", label: null,
    warmup: [part("warm", 60)], main: [part("main", 120)], cooldown: [part("cool", 90)] }
  render(<PrescriptionStructureV3 sequence={sequence} compact collapseSupport />)
  expect(screen.getByText("2 × 2min @ 합성 시험 · r30s Walk")).toBeVisible()
  expect(screen.getAllByLabelText("계획된 전체 시간")[0]).toHaveTextContent("총 10분 30초")
  const support = screen.getByText("자세히 보기 · 준비부터 정리까지").closest("details")!
  expect(support).not.toHaveAttribute("open")
  expect(within(support).getByText(/1분 · 합성 시험/)).not.toBeVisible()
  fireEvent.click(within(support).getByText("자세히 보기 · 준비부터 정리까지"))
  expect(within(support).getByText(/1분 · 합성 시험/)).toBeVisible()
  expect(within(support).getByText(/1분 30초 · 합성 시험/)).toBeVisible()
  expect(within(support).getAllByText(/걷기 · 30초/)).toHaveLength(3)
})
