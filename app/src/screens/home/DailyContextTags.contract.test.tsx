import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { loadDailyContext, saveDailyContext } from "../../domain/daily-context"
import { DailyContextTags } from "./DailyContextTags"

beforeEach(() => localStorage.clear())
afterEach(() => { cleanup(); vi.restoreAllMocks() })

it("allows a single body choice without inventing a score and preserves other choices", () => {
  const view = render(<DailyContextTags date="2026-10-07" bodyOnly />)
  expect(screen.queryByRole("slider")).not.toBeInTheDocument()
  expect(screen.getByRole("button", { name: "몸 상태 보통" })).toHaveAttribute("aria-pressed", "false")
  saveDailyContext({ date: "2026-10-07", mood: "GOOD", body: null, weather: "HOT" })
  fireEvent.click(screen.getByRole("button", { name: "몸 상태 피곤" }))
  expect(loadDailyContext("2026-10-07")).toEqual({ date: "2026-10-07", mood: "GOOD", body: "TIRED", weather: "HOT" })
  expect(screen.getByRole("status")).toHaveTextContent("이 기기에")
  view.rerender(<DailyContextTags date="2026-10-08" bodyOnly />)
  expect(screen.getByRole("button", { name: "몸 상태 피곤" })).toHaveAttribute("aria-pressed", "false")
  fireEvent.click(screen.getByRole("button", { name: "모르겠어요 · 비워 두기" }))
  expect(loadDailyContext("2026-10-08")?.body).toBeNull()
})

it("does not show a saved choice when storage fails", () => {
  render(<DailyContextTags date="2026-10-07" bodyOnly />)
  vi.spyOn(Storage.prototype, "setItem").mockImplementationOnce(() => { throw new DOMException("quota") })
  fireEvent.click(screen.getByRole("button", { name: "몸 상태 가벼움" }))
  expect(screen.getByRole("alert")).toHaveTextContent("저장하지 못했어요")
  expect(screen.getByRole("button", { name: "몸 상태 가벼움" })).toHaveAttribute("aria-pressed", "false")
  expect(loadDailyContext("2026-10-07")).toBeNull()
})
