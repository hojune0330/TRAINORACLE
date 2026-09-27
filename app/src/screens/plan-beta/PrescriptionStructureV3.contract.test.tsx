import React from "react"
import { cleanup, render, screen, within } from "@testing-library/react"
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
