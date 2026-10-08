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
  expect(screen.getByRole("button", { name: /훈련 후.*운동별로 자세히/ })).toBeVisible()
  fireEvent.click(screen.getByRole("button", { name: /회복 · 하루 마무리.*메모·수면·기분·몸 상태/ }))
  expect(pick).toHaveBeenCalledWith("evening")
})

it("allows a memo-only route without inventing recovery measurements", () => {
  render(<EveningCheckin />)
  expect(screen.getByRole("heading", { level: 2, name: "어젯밤 수면" })).toBeVisible()
  expect(screen.getByRole("slider", { name: "수면 시간" })).toBeVisible()
  expect(screen.queryByRole("textbox", { name: "오늘의 메모" })).toBeNull()
  fireEvent.click(screen.getByRole("button", { name: "메모만 남기기" }))
  const note = screen.getByRole("textbox", { name: "오늘의 메모" })
  fireEvent.click(screen.getByRole("radio", { name: "훈련 메모" }))
  fireEvent.change(note, { target: { value: "합성 하루 메모" } })
  fireEvent.click(screen.getByRole("button", { name: "입력 확인으로" }))
  expect(screen.getByRole("heading", { level: 2, name: "입력 확인" })).toBeVisible()
  expect(screen.queryByRole("textbox", { name: "오늘의 메모" })).toBeNull()
  fireEvent.click(screen.getByRole("button", { name: /^저장/u }))
  expect(loadEntries()).toHaveLength(1)
  expect(loadEntries()[0]).toMatchObject({ kind: "evening", note: "합성 하루 메모",
    fieldProvenance: { sleepH: { provenance: "MISSING" }, mood: { provenance: "MISSING" },
      painParts: { provenance: "MISSING" } } })
})

it("keeps each selected answer in a concise review instead of rendering the full form", () => {
  render(<EveningCheckin />)
  fireEvent.click(screen.getByRole("button", { name: "다음 질문" }))
  expect(screen.getByRole("heading", { level: 2, name: "오늘 몸 상태와 기분" })).toBeVisible()
  fireEvent.click(screen.getByRole("button", { name: "감정 4 좋음" }))
  fireEvent.click(screen.getByRole("button", { name: "지금 입력 확인" }))

  expect(screen.getByRole("heading", { level: 2, name: "입력 확인" })).toBeVisible()
  expect(screen.getByText("기분 좋음")).toBeVisible()
  expect(screen.queryByRole("slider", { name: "수면 시간" })).toBeNull()
  expect(screen.queryByRole("button", { name: "감정 4 좋음" })).toBeNull()
  fireEvent.click(screen.getByRole("button", { name: "메모 입력" }))
  expect(screen.getByRole("textbox", { name: "오늘의 메모" })).toBeVisible()
  fireEvent.click(screen.getByRole("button", { name: "입력 확인으로" }))
  expect(screen.getByRole("heading", { level: 2, name: "입력 확인" })).toBeVisible()
  expect(screen.queryByRole("textbox", { name: "오늘의 메모" })).toBeNull()
  fireEvent.click(screen.getByRole("button", { name: /^저장/u }))
  expect(loadEntries()).toHaveLength(1)
  expect(loadEntries()[0]).toMatchObject({ kind: "evening", mood: 4,
    fieldProvenance: { mood: { provenance: "EXPLICIT" }, painParts: { provenance: "MISSING" } } })
})

it("opens only the selected edit group when an existing check-in starts in review", () => {
  render(<EveningCheckin initialEntry={{ id: "synthetic-evening", kind: "evening", date: "2026-10-08",
    savedAt: "2026-10-08T00:00:00.000Z", syncState: "local", sleepH: 8, sleepQuality: 4,
    weightKg: "", restingHr: "", mood: 0, painParts: {}, note: "합성 저장 메모", memoPurpose: "ANALYZABLE_TRAINING_NOTE" }} />)
  expect(screen.getByRole("heading", { level: 2, name: "입력 확인" })).toBeVisible()
  expect(screen.getByText("합성 저장 메모")).toBeVisible()
  expect(screen.queryByRole("slider", { name: "수면 시간" })).toBeNull()
  expect(screen.queryByRole("textbox", { name: "오늘의 메모" })).toBeNull()

  fireEvent.click(screen.getByRole("button", { name: "체중 · 안정시 심박 입력" }))
  expect(screen.getByRole("heading", { level: 2, name: "체중 · 안정시 심박" })).toBeVisible()
  expect(screen.getByRole("textbox", { name: "체중 (kg)" })).toBeVisible()
  expect(screen.getByRole("textbox", { name: "안정시 심박 (bpm)" })).toBeVisible()
  expect(screen.queryByRole("slider", { name: "수면 시간" })).toBeNull()
  fireEvent.click(screen.getByRole("button", { name: "입력 확인으로" }))
  expect(screen.getByRole("heading", { level: 2, name: "입력 확인" })).toBeVisible()
  expect(screen.queryByRole("textbox", { name: "체중 (kg)" })).toBeNull()
})

it("reveals a missing memo purpose when saving from an existing review", () => {
  render(<EveningCheckin initialEntry={{ id: "synthetic-memo-needs-purpose", kind: "evening", date: "2026-10-08",
    savedAt: "2026-10-08T00:00:00.000Z", syncState: "local", sleepH: 0, sleepQuality: 0,
    weightKg: "", restingHr: "", mood: 0, painParts: {}, note: "합성 용도 미선택 메모" }} />)
  fireEvent.click(screen.getByRole("button", { name: /^수정 저장/u }))
  expect(screen.getByRole("heading", { level: 2, name: "오늘 남길 메모" })).toBeVisible()
  expect(screen.getByRole("textbox", { name: "오늘의 메모" })).toHaveValue("합성 용도 미선택 메모")
  expect(screen.getByRole("alert")).toHaveTextContent("메모를 저장할 방법을 선택해 주세요.")
})
