import { cleanup, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { ATHLETE_RECORDS_STORAGE_KEY, loadAthleteRecords } from "../domain/athlete-records"
import { PlanBeta } from "./PlanBeta"
import { AthleteRecords } from "./AthleteRecords"

beforeEach(() => {
  window.localStorage.clear()
  window.sessionStorage.clear()
})

afterEach(cleanup)

async function fillTime(minutes: string, seconds: string): Promise<void> {
  const user = userEvent.setup()
  await user.clear(screen.getByRole("textbox", { name: "기록 분" }))
  await user.type(screen.getByRole("textbox", { name: "기록 분" }), minutes)
  await user.clear(screen.getByRole("textbox", { name: "기록 초" }))
  await user.type(screen.getByRole("textbox", { name: "기록 초" }), seconds)
}

describe("athlete record entry surface", () => {
  it("opens from the plan flow without creating a record", async () => {
    const onManageRecords = vi.fn()
    render(<PlanBeta onManageRecords={onManageRecords} />)

    await userEvent.setup().click(screen.getByRole("button", {
      name: "내 경기 기록 관리",
    }))

    expect(onManageRecords).toHaveBeenCalledTimes(1)
    expect(window.localStorage.getItem(ATHLETE_RECORDS_STORAGE_KEY)).toBeNull()
  })

  it("keeps a 5000m PB distinct from a 5000m race goal", async () => {
    const user = userEvent.setup()
    render(<AthleteRecords onBack={() => undefined} />)

    await user.selectOptions(screen.getByRole("combobox", { name: "기록 역할" }), "PERSONAL_BEST")
    await user.selectOptions(screen.getByRole("combobox", { name: "종목 거리" }), "5000")
    await fillTime("18", "30")
    await user.type(screen.getByRole("textbox", { name: "달성일" }), "2024-03-10")
    await user.click(screen.getByRole("button", { name: "기록 저장" }))

    await user.selectOptions(screen.getByRole("combobox", { name: "기록 역할" }), "RACE_GOAL")
    await fillTime("17", "30")
    await user.click(screen.getByRole("button", { name: "기록 저장" }))

    const list = screen.getByRole("region", { name: "저장한 경기 기록" })
    expect(within(list).getByText("5000m · 18분 30초 · 개인 최고")).toBeVisible()
    expect(within(list).getByText(/2024-03-10.*직접 입력한 기록/u)).toBeVisible()
    expect(within(list).getByText("5000m · 17분 30초 · 경기 목표")).toBeVisible()
    expect(within(list).getByText(
      "직접 입력한 목표 · 현재 경기력 기록이 아님",
    )).toBeVisible()

    const stored = loadAthleteRecords(new Date())
    expect(stored.map((record) => record.purpose)).toEqual([
      "PERSONAL_BEST",
      "RACE_GOAL",
    ])
    expect(JSON.stringify(stored)).not.toMatch(/COACH|VERIFIED_IMPORT|"VERIFIED"/u)
    expect(screen.queryByRole("combobox", { name: "입력 경로" })).toBeNull()
    expect(screen.queryByRole("combobox", { name: "검증 상태" })).toBeNull()
    expect(screen.queryByRole("textbox", { name: "sourceRef" })).toBeNull()
    expect(screen.queryByText(/기준 기록으로 선택/u)).toBeNull()
    expect(screen.queryByText(/\/km/u)).toBeNull()
  })

  it("shows exact errors for a 59m event and a future achieved date", async () => {
    const user = userEvent.setup()
    render(<AthleteRecords onBack={() => undefined} />)

    await user.selectOptions(screen.getByRole("combobox", { name: "종목 거리" }), "CUSTOM")
    await user.type(screen.getByRole("textbox", { name: "직접 입력 거리 (m)" }), "59")
    await fillTime("1", "0")
    await user.type(screen.getByRole("textbox", { name: "달성일" }), "2024-03-10")
    await user.click(screen.getByRole("button", { name: "기록 저장" }))
    expect(screen.getByRole("alert")).toHaveTextContent("종목 거리는 60m 이상")

    await user.clear(screen.getByRole("textbox", { name: "직접 입력 거리 (m)" }))
    await user.type(screen.getByRole("textbox", { name: "직접 입력 거리 (m)" }), "400")
    await user.clear(screen.getByRole("textbox", { name: "달성일" }))
    await user.type(screen.getByRole("textbox", { name: "달성일" }), "2099-01-01")
    await user.click(screen.getByRole("button", { name: "기록 저장" }))
    expect(screen.getByRole("alert")).toHaveTextContent("미래 달성일")
    expect(loadAthleteRecords(new Date())).toEqual([])
  })

  it("does not migrate a legacy race journal or goal pace into athlete records", () => {
    window.localStorage.setItem("trainoracle.journal.v1", JSON.stringify([{
      id: "legacy-race",
      kind: "race",
      record: "18:30",
      goalPace: {
        schemaVersion: 1,
        unit: "seconds_per_kilometer",
        secondsPerKm: 210,
      },
    }]))

    render(<AthleteRecords onBack={() => undefined} />)

    expect(screen.getByText("저장한 기록이 아직 없어요.")).toBeVisible()
    expect(loadAthleteRecords(new Date())).toEqual([])
  })
})
