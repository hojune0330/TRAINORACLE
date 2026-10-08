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

it("orients the first choice without repeating art or losing focus in the input step", () => {
  const { container } = render(<Harness />)
  expect(screen.getByRole("heading", { name: "어떤 종목의 기록인가요?" })).toHaveFocus()
  expect(screen.getByText("기록으로 거리별 평균 시간을 계산해요.")).toBeVisible()
  expect(screen.getByRole("group", { name: "직접 입력할 종목" })).toBeVisible()
  expect(container.querySelector("img")?.getAttribute("src")).toMatch(/pace-stopwatch-v3.webp$/u)
  fireEvent.click(screen.getByRole("button", { name: "800m" }))
  expect(screen.getByRole("heading", { name: "800m 기록을 입력해 주세요" })).toHaveFocus()
  expect(container.querySelector("img")).toBeNull()
  expect(screen.queryByText("기록으로 거리별 평균 시간을 계산해요.")).toBeNull()
  expect(screen.getByRole("textbox", { name: "초" })).toHaveValue("")
})

it("reuses a saved record from the first screen without entering the same event and time or saving again", () => {
  const before = localStorage.getItem(activeAthleteRecordsStorageKey())
  render(<Harness />)
  fireEvent.click(screen.getByRole("button", { name: "저장한 경기 기록 사용" }))
  fireEvent.click(screen.getByRole("button", { name: /2:01.5/ }))
  expect(screen.getByRole("heading", { name: "내 기록으로 페이스 계산" })).toBeVisible()
  expect(screen.getByText("저장한 경기 기록 · 2026-10-01")).toBeVisible()
  expect(screen.getByText("0:30.4")).toBeVisible()
  expect(localStorage.getItem(activeAthleteRecordsStorageKey())).toBe(before)
  fireEvent.click(screen.getByRole("button", { name: "직접 수정" }))
  fireEvent.change(screen.getByRole("textbox", { name: "초" }), { target: { value: "2" } })
  fireEvent.click(screen.getByRole("button", { name: "페이스 보기" }))
  expect(screen.getByText("이번 계산에만 입력 · 저장되지 않음")).toBeVisible()
  expect(screen.queryByText("저장한 경기 기록 · 2026-10-01")).toBeNull()
  expect(localStorage.getItem(activeAthleteRecordsStorageKey())).toBe(before)
})

it("retains the direct input alternative when no saved records are eligible", () => {
  localStorage.clear()
  render(<Harness />)
  fireEvent.click(screen.getByRole("button", { name: "저장한 경기 기록 사용" }))
  expect(screen.getByText(/저장한 경기 기록이 없어요/)).toBeVisible()
  fireEvent.click(screen.getByRole("button", { name: "다른 기록 직접 입력" }))
  fireEvent.click(screen.getByRole("button", { name: "800m" }))
  expect(screen.getByRole("textbox", { name: "분" })).toHaveValue("")
})

it("labels saved goals separately from achieved performances", () => {
  render(<Harness initial="result" request={{ record: { ...record, purpose: "RACE_GOAL", achievedOn: null } }} />)
  expect(screen.getByText("저장한 목표 · 아직 달성하지 않음 · 미래 목표")).toBeVisible()
  expect(screen.queryByText(/저장한 경기 기록 ·/)).toBeNull()
})

it("uses one event/input action and preserves decimal input across tools", () => {
  render(<Harness />)
  fireEvent.click(screen.getByRole("button", { name: "800m" }))
  fireEvent.change(screen.getByRole("textbox", { name: "분" }), { target: { value: "2" } })
  fireEvent.change(screen.getByRole("textbox", { name: "초" }), { target: { value: "1.5" } })
  fireEvent.click(screen.getByRole("button", { name: "페이스 보기" }))
  expect(screen.getByText("0:30.4")).toBeVisible()
  fireEvent.click(screen.getByRole("button", { name: "구간 시간" }))
  expect(screen.getByRole("table")).toBeVisible()
  fireEvent.click(screen.getByRole("button", { name: "이전 단계" }))
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

it("describes track guidance and its unavailable calculation before entry", () => {
  render(<Harness initial="result" request={{ record }} />)
  expect(screen.getByText("계산 미리보기 · 기록·계획 변경 없음")).toBeVisible()
  const trackAction = screen.getByRole("button", { name: /트랙 안내/u })
  expect(trackAction).toHaveTextContent("레인 계산은 아직 준비 중이에요")
  fireEvent.click(trackAction)
  expect(screen.getByRole("heading", { name: "트랙 안내" })).toBeVisible()
  expect(screen.getByText(/공식 시설 기준 확인 후 제공할 예정/u)).toBeVisible()
})
