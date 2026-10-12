import React from "react"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, expect, it } from "vitest"
import { PaceCalculator } from "./PaceCalculator"
import { paceClock, type PaceToolStage } from "../domain/pace-tools"
import type { AthleteRecord } from "../domain/athlete-records"

const events = [800, 1500, 3000, 5000, 10000, 21097.5, 42195] as const
const profiles = ["first-runner", "youth-middle", "decimal-track", "returning", "twice-daily", "marathon",
  "half", "unknown-date", "goal", "old-pb", "slow-runner", "fast-runner", "keyboard", "split-lock",
  "table", "long-clock", "partial-lap", "back-first", "back-table", "evidence", "mixed-sessions",
  "recovery-day", "record-only", "mobile"]

function Journey({ record }: { record: AthleteRecord }) {
  const [stages, setStages] = React.useState<PaceToolStage[]>(["result"])
  return <PaceCalculator request={{ record }} stage={stages.at(-1)!}
    onStageChange={stage => setStages(values => [...values, stage])}
    onBack={() => setStages(values => values.length > 1 ? values.slice(0, -1) : values)} />
}
afterEach(cleanup)

// Synthetic UI journeys exercise varied sources and semantic back paths, not human validation.
it.each(profiles.map((name, index) => ({ name, index })))("$name keeps the original calculation across tool/back/edit journeys", ({ index }) => {
  const eventDistanceM = events[index % events.length]!
  const performanceSeconds = eventDistanceM * (0.22 + index * 0.005) + 0.5
  const record: AthleteRecord = { schemaVersion: 1, id: `synthetic-${index}`, eventDistanceM, performanceSeconds,
    ...(index % 3 === 0 ? { purpose: "RACE_GOAL" as const, achievedOn: null }
      : { purpose: "RECENT_RESULT" as const, achievedOn: index % 4 === 0 ? null : "2026-10-01" }),
    seasonId: null, enteredBy: "ATHLETE", verificationState: "SELF_REPORTED", sourceRef: `athlete-record:synthetic-${index}`,
    savedAt: "2026-10-02T03:00:00.000Z" }
  render(<Journey record={record} />)
  const firstDistance = eventDistanceM <= 3000 ? 200 : 400
  const firstTime = paceClock(performanceSeconds * firstDistance / eventDistanceM)
  expect(screen.getAllByText(firstTime).length).toBeGreaterThan(0)
  fireEvent.click(screen.getByRole("button", { name: index % 2 ? "페이스 표" : "구간 시간" }))
  expect(screen.getByRole("table")).toBeVisible()
  fireEvent.click(screen.getByRole("button", { name: "이전 단계" }))
  expect(screen.getAllByText(firstTime).length).toBeGreaterThan(0)
  fireEvent.click(screen.getByRole("button", { name: "계산 근거" }))
  fireEvent.click(screen.getByText("계산식·정밀한 값"))
  expect(screen.getByText("구간 시간 = 경기 기록 초 × 구간 거리 ÷ 경기 거리")).toBeVisible()
  fireEvent.click(screen.getByRole("button", { name: "이전 단계" }))
  fireEvent.click(screen.getByRole("button", { name: "직접 수정" }))
  fireEvent.change(screen.getByRole("textbox", { name: "초" }), { target: { value: "60" } })
  expect(screen.getByRole("button", { name: "페이스 보기" })).toBeDisabled()
  fireEvent.change(screen.getByRole("textbox", { name: "초" }), { target: { value: "30.5" } })
  fireEvent.click(screen.getByRole("button", { name: "페이스 보기" }))
  expect(screen.getByText("이번 계산에만 입력 · 저장되지 않음")).toBeVisible()
})
