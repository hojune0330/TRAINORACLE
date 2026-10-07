import { cleanup, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { PlanBeta } from "./PlanBeta"
import * as recordSave from "../domain/account/instant-plan-record-save"

beforeEach(() => {
  window.localStorage.clear()
  window.sessionStorage.clear()
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe("plan beta goal choice", () => {
  it("shows the seven initial target events without a generic unbound goal", async () => {
    const user = userEvent.setup()
    const prepare = vi.spyOn(recordSave, "prepareAccountInstantPlanEntry").mockResolvedValue({ kind: "pending" })
    render(<PlanBeta />)

    const choices = within(screen.getByRole("group", { name: "어떤 종목을 준비하세요?" }))
    const buttons = choices.getAllByRole("button")
    const events = [
      ["800m", 800], ["1500m", 1500], ["3000m", 3000], ["5km", 5000],
      ["10km", 10000], ["하프 마라톤", 21097], ["마라톤", 42195],
    ] as const
    expect(buttons).toHaveLength(events.length)
    buttons.forEach((button, index) => {
      expect(button).toHaveAccessibleName(events[index]![0])
      expect(button).toHaveAttribute("aria-pressed", "false")
    })
    expect(choices.queryByRole("button", { name: /기초 지구력/u })).toBeNull()
    for (const [label, eventDistanceM] of events) {
      await user.click(screen.getByRole("button", { name: label }))
      await user.click(screen.getByRole("button", { name: "기록 없이" }))
      expect(prepare).toHaveBeenLastCalledWith({ kind: "NO_RECORD", eventDistanceM })
      await user.click(screen.getByRole("button", { name: "종목 다시 선택" }))
    }
    expect(prepare).toHaveBeenCalledTimes(events.length)
  })
})
