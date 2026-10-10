import { afterEach, expect, it } from "vitest"
import { captureCalendarReaderPosition, captureReaderPosition, restoreReaderPosition, validJournalCalendarReturn } from "./readerPosition"
import { setActiveLocalAccount } from "../domain/account/local-journal-ownership"

afterEach(() => { document.body.replaceChildren(); setActiveLocalAccount(null) })

function reader() {
  const region = document.createElement("section")
  const heading = document.createElement("h1")
  heading.textContent = "더보기"
  const button = document.createElement("button")
  button.textContent = "훈련법 읽기"
  region.append(heading, button)
  document.body.append(region)
  return { region, heading, button }
}

it("restores the originating button and reading scroll without persisting input", () => {
  const { region, button } = reader()
  region.scrollTop = 280
  // Touch browsers need not focus a clicked button before its handler runs.
  const position = captureReaderPosition(region, button)
  region.scrollTop = 0; button.blur()
  restoreReaderPosition(region, position)
  expect(region.scrollTop).toBe(280)
  expect(button).toHaveFocus()
})

it("falls back to the heading when the original control no longer exists", () => {
  const { region, heading, button } = reader()
  button.focus()
  const position = captureReaderPosition(region)
  button.remove()
  restoreReaderPosition(region, position)
  expect(heading).toHaveFocus()
})

it("never captures free-text answers as a return target", () => {
  const { region } = reader()
  const input = document.createElement("input")
  input.value = "synthetic private answer"
  input.setAttribute("aria-label", "synthetic answer")
  region.append(input); input.focus()
  const position = captureReaderPosition(region)
  expect(position.focusId).toBeNull()
  expect(position.focusLabel).toBeNull()
  expect(position.focusText).toBeNull()
})

it("does not revive the old reading position after an A to B to A account switch", () => {
  setActiveLocalAccount("reader-test-a")
  const { region, button } = reader()
  region.scrollTop = 280; button.focus()
  const position = captureReaderPosition(region)
  setActiveLocalAccount("reader-test-b"); setActiveLocalAccount("reader-test-a")
  region.scrollTop = 0; button.blur()
  restoreReaderPosition(region, position)
  expect(region.scrollTop).toBe(0)
  expect(button).not.toHaveFocus()
})

it("restores a stable calendar date after the portaled original opener was removed", () => {
  const { region } = reader()
  const day = document.createElement("button")
  day.dataset.date = "2026-10-02"
  day.textContent = "2"
  region.append(day)
  const position = { ...captureReaderPosition(region), focusDate: "2026-10-02" }
  restoreReaderPosition(region, position)
  expect(day).toHaveFocus()
})

it("captures a calendar return without reading a date button's health description or text", () => {
  const { region } = reader()
  region.scrollTop = 180
  const date = "2026-10-02"
  const day = document.createElement("button")
  day.dataset.date = date
  day.setAttribute("aria-label", "synthetic private health description")
  day.textContent = "synthetic private health description"
  region.append(day)
  const position = captureCalendarReaderPosition(region, date)
  expect(position).toMatchObject({ scroll: 180, focusDate: date, focusId: null, focusLabel: null, focusText: null })
  expect(JSON.stringify(position)).not.toContain("synthetic private")
  restoreReaderPosition(region, position)
  expect(day).toHaveFocus()
})

it("validates live calendar record identity without reading or carrying record content", () => {
  const date = "2026-10-02", entryId = "synthetic-return-entry"
  const entry = { id: entryId, date }
  Object.defineProperties(entry, {
    memo: { get() { throw Error("memo must not be read") } },
    painParts: { get() { throw Error("health must not be read") } },
  })
  const position = { scope: captureCalendarReaderPosition(null, date).scope, date, entryId, scroll: 80,
    memo: "synthetic private extra field" }
  const returned = validJournalCalendarReturn(position, [entry])
  expect(returned).toEqual({ scope: position.scope, date, entryId, scroll: 80 })
  expect(Object.keys(returned!)).toEqual(["scope", "date", "entryId", "scroll"])
  expect(validJournalCalendarReturn(position, [])).toBeNull()
  expect(validJournalCalendarReturn(position, [{ id: entryId, date: "2026-10-03" }])).toBeNull()
  expect(validJournalCalendarReturn({ ...position, scroll: Infinity }, [entry])).toBeNull()
  expect(validJournalCalendarReturn({ ...position, date: "2026-02-30" }, [entry])).toBeNull()
  setActiveLocalAccount("synthetic-return-a"); setActiveLocalAccount(null)
  expect(validJournalCalendarReturn(position, [entry])).toBeNull()
})
