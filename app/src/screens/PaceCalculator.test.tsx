import React from "react"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { PaceCalculator } from "./PaceCalculator"
import type { PaceToolRequest, PaceToolStage } from "../domain/pace-tools"
import type { AthleteRecord } from "../domain/athlete-records"
import { activeAthleteRecordsStorageKey } from "../domain/athlete-records"
import { setActiveLocalAccount } from "../domain/account/local-journal-ownership"

const record: AthleteRecord = { schemaVersion: 1, id: "calculator-800", eventDistanceM: 800, performanceSeconds: 121.5,
  purpose: "RECENT_RESULT", achievedOn: "2026-10-01", seasonId: null, enteredBy: "ATHLETE", verificationState: "SELF_REPORTED",
  sourceRef: "athlete-record:calculator-800", savedAt: "2026-10-02T03:00:00.000Z" }
function Harness({ request = {}, initial = "event" }: { request?: PaceToolRequest; initial?: PaceToolStage }) {
  const [stages, setStages] = React.useState<PaceToolStage[]>([initial])
  return <PaceCalculator request={request} stage={stages.at(-1)!} onStageChange={stage => setStages(values => [...values, stage])}
    onBack={() => setStages(values => values.length > 1 ? values.slice(0, -1) : values)} />
}
beforeEach(() => { localStorage.clear(); setActiveLocalAccount(null); localStorage.setItem(activeAthleteRecordsStorageKey(), JSON.stringify([record])) })
afterEach(() => { cleanup(); localStorage.clear(); setActiveLocalAccount(null) })

it("uses one event/input action and preserves decimal input across tools", () => {
  render(<Harness />)
  fireEvent.click(screen.getByRole("button", { name: "800m" }))
  fireEvent.change(screen.getByRole("textbox", { name: "분" }), { target: { value: "2" } })
  fireEvent.change(screen.getByRole("textbox", { name: "초" }), { target: { value: "1.5" } })
  fireEvent.click(screen.getByRole("button", { name: "페이스 보기" }))
  expect(screen.getByText("0:30.4")).toBeVisible()
  fireEvent.click(screen.getByRole("button", { name: "구간 시간" }))
  expect(screen.getByRole("table")).toBeVisible()
  fireEvent.click(screen.getByRole("button", { name: "이전 화면" }))
  expect(screen.getByText("0:30.4")).toBeVisible()
  fireEvent.click(screen.getByRole("button", { name: "직접 수정" }))
  fireEvent.change(screen.getByRole("textbox", { name: "초" }), { target: { value: "-1" } })
  expect(screen.getByRole("button", { name: "페이스 보기" })).toBeDisabled()
  expect(screen.queryByText("0:30.4")).not.toBeInTheDocument()
})
it("stages an eligible record only, without claiming a plan save", () => {
  const selected = vi.fn()
  render(<Harness initial="result" request={{ record, allowedEvents: [800], onSelectRecord: selected, calculationModel: "RACE_AVERAGE_V1" }} />)
  fireEvent.click(screen.getByRole("button", { name: "이 기준으로 훈련 확인" }))
  expect(selected).toHaveBeenCalledWith(record)
  expect(screen.queryByText(/적용했어요/)).not.toBeInTheDocument()
})
it("keeps the calculator open when its originating training changed", () => {
  const selected = vi.fn(() => false)
  render(<Harness initial="result" request={{ record, allowedEvents: [800], onSelectRecord: selected }} />)
  fireEvent.click(screen.getByRole("button", { name: "이 기준으로 훈련 확인" }))
  expect(selected).toHaveBeenCalledOnce()
  expect(screen.getByRole("status")).toHaveTextContent(/훈련/)
  expect(screen.getByText("0:30.4")).toBeVisible()
})
it("lets a fixed split recover from an impossible total without silently changing it", () => {
  render(<Harness initial="result" request={{ record }} />)
  fireEvent.click(screen.getByRole("button", { name: "구간 시간" }))
  fireEvent.click(screen.getByRole("button", { name: "1구간 시간 고정" }))
  fireEvent.change(screen.getByRole("textbox", { name: "1구간 고정 초" }), { target: { value: "200" } })
  expect(screen.getByRole("alert")).toHaveTextContent("전체 시간에 맞출 수 없어요")
  expect(screen.getByRole("textbox", { name: "1구간 고정 초" })).toHaveValue("200")
  fireEvent.change(screen.getByRole("textbox", { name: "1구간 고정 초" }), { target: { value: "60" } })
  expect(screen.getByRole("table")).toBeVisible()
  expect(screen.queryByRole("alert")).not.toBeInTheDocument()
})
it("blocks a deleted/stale source while preserving the read-only comparison", () => {
  const selected = vi.fn()
  localStorage.clear()
  render(<Harness initial="result" request={{ record, allowedEvents: [800], onSelectRecord: selected }} />)
  expect(screen.getByRole("button", { name: "이 기준으로 훈련 확인" })).toBeDisabled()
  expect(screen.getByText("0:30.4")).toBeVisible()
  expect(selected).not.toHaveBeenCalled()
})
it("updates source-derived tables when a different record is selected", () => {
  const second: AthleteRecord = { ...record, id: "calculator-10k", sourceRef: "athlete-record:calculator-10k", eventDistanceM: 10000, performanceSeconds: 2400 }
  localStorage.setItem(activeAthleteRecordsStorageKey(), JSON.stringify([record, second]))
  render(<Harness initial="result" request={{ record }} />)
  fireEvent.click(screen.getByRole("button", { name: "기준 바꾸기" }))
  fireEvent.click(screen.getByRole("button", { name: /40:00/ }))
  expect(screen.getByText("1:36")).toBeVisible()
  expect(screen.queryByText("0:30.4")).not.toBeInTheDocument()
})
