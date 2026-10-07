import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { loadDailyContext, saveDailyContext } from "../../domain/daily-context"
import { setActiveLocalAccount } from "../../domain/account/local-journal-ownership"
import { DailyContextTags } from "./DailyContextTags"

beforeEach(() => { localStorage.clear(); setActiveLocalAccount(null) })
afterEach(() => { cleanup(); vi.restoreAllMocks(); setActiveLocalAccount(null) })

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

it("shows the selected tags for the new date after the date prop changes", () => {
  saveDailyContext({ date: "2026-10-07", mood: "GOOD", body: "NORMAL", weather: "SUNNY" })
  saveDailyContext({ date: "2026-10-08", mood: "LOW", body: "TIRED", weather: "RAINY" })
  const view = render(<DailyContextTags date="2026-10-07" />)

  view.rerender(<DailyContextTags date="2026-10-08" />)

  expect(screen.getByRole("button", { name: "기분 낮음" })).toHaveAttribute("aria-pressed", "true")
  expect(screen.getByRole("button", { name: "기분 좋음" })).toHaveAttribute("aria-pressed", "false")
})

it("does not show a saved choice when storage fails", () => {
  render(<DailyContextTags date="2026-10-07" bodyOnly />)
  vi.spyOn(Storage.prototype, "setItem").mockImplementationOnce(() => { throw new DOMException("quota") })
  fireEvent.click(screen.getByRole("button", { name: "몸 상태 가벼움" }))
  expect(screen.getByRole("alert")).toHaveTextContent("저장하지 못했어요")
  expect(screen.getByRole("button", { name: "몸 상태 가벼움" })).toHaveAttribute("aria-pressed", "false")
  expect(loadDailyContext("2026-10-07")).toBeNull()
})

it("reloads tags for the new account instead of showing the previous account choice", () => {
  setActiveLocalAccount("account-b")
  saveDailyContext({ date: "2026-10-07", mood: "LOW", body: "TIRED", weather: "RAINY" })
  setActiveLocalAccount("account-a")
  saveDailyContext({ date: "2026-10-07", mood: "GOOD", body: "NORMAL", weather: "SUNNY" })

  render(<DailyContextTags date="2026-10-07" />)
  expect(screen.getByRole("button", { name: "기분 좋음" })).toHaveAttribute("aria-pressed", "true")

  act(() => setActiveLocalAccount("account-b"))

  expect(screen.getByRole("button", { name: "기분 낮음" })).toHaveAttribute("aria-pressed", "true")
  expect(screen.getByRole("button", { name: "기분 좋음" })).toHaveAttribute("aria-pressed", "false")
})

it("does not save through a stale rendered handler after the account changes", () => {
  setActiveLocalAccount("account-a")
  saveDailyContext({ date: "2026-10-07", mood: "GOOD", body: "NORMAL", weather: "SUNNY" })
  render(<DailyContextTags date="2026-10-07" />)
  const staleButton = screen.getByRole("button", { name: "기분 좋음" })

  act(() => {
    setActiveLocalAccount("account-b")
    staleButton.dispatchEvent(new MouseEvent("click", { bubbles: true }))
  })

  expect(loadDailyContext("2026-10-07")).toBeNull()
  expect(screen.getByRole("button", { name: "기분 좋음" })).toHaveAttribute("aria-pressed", "false")
})

it("shows a read error and preserves malformed storage instead of treating it as empty", () => {
  const original = "{invalid-json"
  localStorage.setItem("trainoracle.daily-context.v1", original)

  render(<DailyContextTags date="2026-10-07" bodyOnly />)

  expect(screen.getByRole("alert")).toHaveTextContent("불러오지 못했어요")
  expect(screen.getByRole("button", { name: "몸 상태 피곤" })).toBeDisabled()
  fireEvent.click(screen.getByRole("button", { name: "몸 상태 피곤" }))
  expect(localStorage.getItem("trainoracle.daily-context.v1")).toBe(original)
})

it("separates a storage read failure from a save failure", () => {
  const originalGetItem = Storage.prototype.getItem
  const getItem = vi.spyOn(Storage.prototype, "getItem").mockImplementation(function (this: Storage, key: string) {
    if (this === localStorage && key === "trainoracle.daily-context.v1") throw new DOMException("blocked")
    return originalGetItem.call(this, key)
  })
  const setItem = vi.spyOn(Storage.prototype, "setItem")

  render(<DailyContextTags date="2026-10-07" bodyOnly />)

  expect(screen.getByRole("alert")).toHaveTextContent("불러오지 못했어요")
  expect(screen.queryByText("저장하지 못했어요. 선택을 다시 눌러 주세요.")).not.toBeInTheDocument()
  expect(screen.getByRole("button", { name: "몸 상태 피곤" })).toBeDisabled()
  fireEvent.click(screen.getByRole("button", { name: "몸 상태 피곤" }))
  expect(setItem).not.toHaveBeenCalled()

  getItem.mockRestore()
  fireEvent.click(screen.getByRole("button", { name: "다시 불러오기" }))
  expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  expect(screen.getByRole("button", { name: "몸 상태 피곤" })).not.toBeDisabled()
})
