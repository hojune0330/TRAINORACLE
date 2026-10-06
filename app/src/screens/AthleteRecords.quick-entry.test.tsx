import { cleanup, render, screen, fireEvent } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { AthleteRecords } from "./AthleteRecords"
import { loadAthleteRecords } from "../domain/athlete-records"

beforeEach(() => { localStorage.clear(); sessionStorage.clear() })
afterEach(() => { cleanup(); vi.restoreAllMocks() })

it("highest-record entry defaults to PB and stores exact decimal seconds with no invented date", async () => {
  render(<AthleteRecords onBack={() => undefined} initialPurpose="PERSONAL_BEST" />)
  expect(screen.getByRole("combobox", { name: "기록 역할" })).toHaveValue("PERSONAL_BEST")
  fireEvent.change(screen.getByRole("combobox", { name: "종목 거리" }), { target: { value: "800" } })
  fireEvent.change(screen.getByLabelText("기록 분"), { target: { value: "2" } })
  fireEvent.change(screen.getByLabelText("기록 초"), { target: { value: "1.5" } })
  expect(screen.getByLabelText("저장할 기록 미리보기")).toHaveTextContent("800m · 2:01.5")
  fireEvent.click(screen.getByRole("button", { name: "기록 저장" }))
  expect(await screen.findByRole("status")).toHaveTextContent("저장했어요")
  expect(loadAthleteRecords()[0]).toMatchObject({ purpose: "PERSONAL_BEST", eventDistanceM: 800, performanceSeconds: 121.5, achievedOn: null })
})

it("rejects Number-coercion formats and does not lose unsaved input when back is cancelled", () => {
  const back = vi.fn()
  render(<AthleteRecords onBack={back} />)
  fireEvent.change(screen.getByLabelText("기록 분"), { target: { value: "0x10" } })
  fireEvent.change(screen.getByLabelText("기록 초"), { target: { value: "0" } })
  fireEvent.click(screen.getByRole("button", { name: "기록 저장" }))
  expect(screen.getByRole("alert")).toHaveTextContent("분과 초")
  expect(loadAthleteRecords()).toEqual([])
  vi.spyOn(window, "confirm").mockReturnValue(false)
  fireEvent.click(screen.getByRole("button", { name: "계획으로" }))
  expect(back).not.toHaveBeenCalled()
  expect(screen.getByLabelText("기록 분")).toHaveValue("0x10")
})

it("provides a date picker without replacing unknown dates with today", () => {
  render(<AthleteRecords onBack={() => undefined} />)
  fireEvent.click(screen.getByRole("button", { name: "달력으로 날짜 선택" }))
  expect(screen.getByLabelText("달성일 달력")).toHaveValue("")
  fireEvent.change(screen.getByLabelText("달성일 달력"), { target: { value: "2025-10-02" } })
  expect(screen.getByLabelText("달성일")).toHaveValue("2025-10-02")
})

it("clears a saved custom-distance draft so returning does not ask to discard a saved record", async () => {
  const back = vi.fn()
  const confirm = vi.spyOn(window, "confirm").mockReturnValue(false)
  render(<AthleteRecords onBack={back} initialPurpose="PERSONAL_BEST" />)
  expect(screen.getByLabelText("기록 분")).toHaveAttribute("placeholder", "예: 20")
  fireEvent.change(screen.getByRole("combobox", { name: "종목 거리" }), { target: { value: "CUSTOM" } })
  fireEvent.change(screen.getByLabelText("직접 입력 거리 (m)"), { target: { value: "400" } })
  fireEvent.change(screen.getByLabelText("기록 초"), { target: { value: "55" } })
  expect(screen.getByLabelText("저장할 기록 미리보기")).toHaveTextContent("400m")
  fireEvent.click(screen.getByRole("button", { name: "기록 저장" }))
  await screen.findByRole("status")
  fireEvent.click(screen.getByRole("button", { name: "계획으로" }))
  expect(confirm).not.toHaveBeenCalled()
  expect(back).toHaveBeenCalledOnce()
})
