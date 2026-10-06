import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { EveningCheckin } from "./EveningCheckin"
import { EntryChooser } from "./EntryChooser"
import { loadEntries } from "../../domain/journal-store"

beforeEach(() => localStorage.clear())
afterEach(cleanup)

it("names both multi-exercise and memo choices without adding another required choice", () => {
  const pick = vi.fn()
  render(<EntryChooser onPick={pick} />)
  expect(screen.getByRole("button", { name: /훈련 후.*달리기·근력 등 여러 운동을 함께/ })).toBeVisible()
  fireEvent.click(screen.getByRole("button", { name: /회복 · 하루 마무리.*메모·수면·기분·몸 상태/ }))
  expect(pick).toHaveBeenCalledWith("evening")
})

it("starts with the note and can save it alone without inventing recovery measurements", () => {
  render(<EveningCheckin />)
  const note = screen.getByRole("textbox", { name: "오늘의 메모" })
  const sleep = screen.getByRole("slider", { name: "수면 시간" })
  expect(note.compareDocumentPosition(sleep) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  fireEvent.click(screen.getByRole("radio", { name: "훈련 메모" }))
  fireEvent.change(note, { target: { value: "합성 하루 메모" } })
  fireEvent.click(screen.getByRole("button", { name: /^저장/ }))
  expect(loadEntries()).toHaveLength(1)
  expect(loadEntries()[0]).toMatchObject({ kind: "evening", note: "합성 하루 메모",
    fieldProvenance: { sleepH: { provenance: "MISSING" }, mood: { provenance: "MISSING" },
      painParts: { provenance: "MISSING" } } })
})
