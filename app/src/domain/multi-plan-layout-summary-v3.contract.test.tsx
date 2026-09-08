import React from "react"
import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, expect, it } from "vitest"
import type { PlanSession } from "@impl/plan-generator/types"
import { compareMultiPlanLayoutV3, summarizeMultiPlanLayoutV3 } from "./multi-plan-layout-summary-v3"
import { MultiPlanLayoutSummaryV3 } from "../screens/plan-beta/MultiPlanLayoutSummaryV3"

type Session = Pick<PlanSession, "day" | "slot" | "role" | "plannedEnergyIntent">
const sessions: readonly Session[] = [
  { day: 1, slot: "AM", role: "QUALITY", plannedEnergyIntent: "VO2_INTENT" },
  { day: 1, slot: "PM", role: "EASY", plannedEnergyIntent: "RECOVERY_INTENT" },
  { day: 2, slot: "AM", role: "REST", plannedEnergyIntent: "RECOVERY_INTENT" },
  { day: 3, slot: "PM", role: "QUALITY", plannedEnergyIntent: "ATP_PC_INTENT" },
]
afterEach(cleanup)
it("counts planned recovery as training but not rest; includes PM MAIN without implying exposure or elapsed hours", () => {
  const result = summarizeMultiPlanLayoutV3(sessions)
  expect(result.trainingSlots).toBe(3)
  expect(result.twoADayDays).toEqual([1])
  expect(result.mainSlots.map(s => [s.day, s.slot])).toEqual([[1, "AM"], [3, "PM"]])
  expect(compareMultiPlanLayoutV3(sessions, [...sessions].reverse()).placementAndPurposeUnchanged).toBe(true)
  expect(compareMultiPlanLayoutV3(sessions, sessions.map(s => s.day === 3 ? { ...s, day: 4 } : s)).placementAndPurposeUnchanged).toBe(false)
  expect(compareMultiPlanLayoutV3(sessions, sessions.map(s => s.day === 3 ? { ...s, plannedEnergyIntent: "GLY_INTENT" } : s)).placementAndPurposeUnchanged).toBe(false)
  expect(() => summarizeMultiPlanLayoutV3([...sessions, sessions[0]!])).toThrow("INVALID_PLAN_LAYOUT")
})
it("shows dated MAIN slots and distinguishes unchanged frequency from unchanged dose", () => {
  render(<MultiPlanLayoutSummaryV3 before={sessions} after={sessions} startDate="2026-09-08" />)
  expect(screen.getByLabelText("조정 전후 훈련 배치")).toBeTruthy()
  expect(screen.getByText("2026-09-10 오후")).toBeTruthy()
  expect(screen.getByText(/횟수가 같아도 운동량·회복시간·부담은 달라질 수 있어요/)).toBeTruthy()
  expect(screen.getByText(/충분한 회복을 보장하는 간격이 아니에요/)).toBeTruthy()
})
