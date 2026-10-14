import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { initializeCanonicalJournalFixture } from "../../test/canonical-journal-fixture"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { EveningCheckin } from "./EveningCheckin"
import { EntryChooser } from "./EntryChooser"
import { loadEntries } from "../../domain/journal-store"

beforeEach(() => localStorage.clear())
afterEach(cleanup)

it("names both multi-exercise and memo choices without adding another required choice", () => {
  const pick = vi.fn()
  render(<EntryChooser onPick={pick} />)
  expect(screen.getByRole("button", { name: /자세히 기록.*운동별로 자세히/ })).toBeVisible()
  fireEvent.click(screen.getByRole("button", { name: /컨디션·메모.*수면·몸 상태·기분·메모/ }))
  expect(pick).toHaveBeenCalledWith("evening")
})

it("allows a memo-only route without inventing recovery measurements", () => {
  render(<EveningCheckin />)
  expect(screen.getByRole("heading", { level: 2, name: "무엇을 남길까요?" })).toBeVisible()
  expect(screen.queryByRole("slider", { name: "수면 시간" })).toBeNull()
  expect(screen.queryByRole("textbox", { name: "오늘의 메모" })).toBeNull()
  fireEvent.click(screen.getByRole("button", { name: "수면" }))
  const sleep = screen.getByRole("textbox", { name: "수면 시간" })
  fireEvent.change(sleep, { target: { value: "0" } })
  fireEvent.click(screen.getByRole("button", { name: "입력 확인으로" }))
  expect(screen.getByRole("alert")).toHaveTextContent(/1시간 미만.*최대 24시간/u)
  expect(screen.getByRole("heading", { level: 2, name: "어젯밤 수면" })).toBeVisible()
  fireEvent.change(sleep, { target: { value: "" } })
  fireEvent.click(screen.getByRole("button", { name: "입력 확인으로" }))
  expect(screen.getByRole("heading", { level: 2, name: "입력 확인" })).toBeVisible()
  fireEvent.click(screen.getByRole("button", { name: "메모 입력" }))
  const note = screen.getByRole("textbox", { name: "오늘의 메모" })
  fireEvent.click(screen.getByRole("radio", { name: "훈련 메모" }))
  fireEvent.change(note, { target: { value: "합성 하루 메모" } })
  fireEvent.click(screen.getByRole("button", { name: "입력 확인으로" }))
  expect(screen.getByRole("heading", { level: 2, name: "입력 확인" })).toBeVisible()
  expect(screen.queryByRole("textbox", { name: "오늘의 메모" })).toBeNull()
  fireEvent.click(screen.getByRole("button", { name: /^저장/u }))
  expect(loadEntries()).toHaveLength(1)
  expect(loadEntries()[0]).toMatchObject({ kind: "evening", note: "합성 하루 메모",
    sleepH: 0,
    fieldProvenance: { sleepH: { provenance: "MISSING" }, mood: { provenance: "MISSING" },
      painParts: { provenance: "MISSING" } } })
})

it("accepts a positive fractional sleep value within the existing schema", () => {
  render(<EveningCheckin />)
  fireEvent.click(screen.getByRole("button", { name: "수면" }))
  fireEvent.change(screen.getByRole("textbox", { name: "수면 시간" }), { target: { value: "0.25" } })
  fireEvent.click(screen.getByRole("button", { name: "입력 확인으로" }))
  expect(screen.getByRole("heading", { level: 2, name: "입력 확인" })).toBeVisible()
  fireEvent.click(screen.getByRole("button", { name: /^저장/u }))

  expect(loadEntries()[0]).toMatchObject({ sleepH: 0.25,
    fieldProvenance: { sleepH: { provenance: "EXPLICIT" } } })
})

it("blocks out-of-range sleep hours until the input is repaired", () => {
  render(<EveningCheckin />)
  fireEvent.click(screen.getByRole("button", { name: "수면" }))
  const sleep = screen.getByRole("textbox", { name: "수면 시간" })
  fireEvent.change(sleep, { target: { value: "25" } })
  fireEvent.click(screen.getByRole("button", { name: "입력 확인으로" }))

  expect(sleep).toHaveAttribute("aria-invalid", "true")
  expect(screen.getByRole("alert")).toHaveTextContent(/1시간 미만.*최대 24시간/u)
  expect(screen.queryByRole("heading", { level: 2, name: "입력 확인" })).toBeNull()
  expect(loadEntries()).toEqual([])

  fireEvent.change(sleep, { target: { value: "24" } })
  fireEvent.click(screen.getByRole("button", { name: "입력 확인으로" }))
  fireEvent.click(screen.getByRole("button", { name: /^저장/u }))
  expect(loadEntries()[0]).toMatchObject({ sleepH: 24,
    fieldProvenance: { sleepH: { provenance: "EXPLICIT" } } })
})

it("keeps each selected answer in a concise review instead of rendering the full form", () => {
  render(<EveningCheckin />)
  fireEvent.click(screen.getByRole("button", { name: "기분" }))
  expect(screen.getByRole("heading", { level: 2, name: "오늘 기분" })).toBeVisible()
  fireEvent.click(screen.getByRole("button", { name: "기분 4 좋음" }))
  fireEvent.click(screen.getByRole("button", { name: "입력 확인으로" }))

  expect(screen.getByRole("heading", { level: 2, name: "입력 확인" })).toBeVisible()
  expect(screen.getByText("기분 좋음")).toBeVisible()
  expect(screen.queryByRole("slider", { name: "수면 시간" })).toBeNull()
  expect(screen.queryByRole("button", { name: "기분 4 좋음" })).toBeNull()
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

it("opens body and mood independently without requiring either answer", () => {
  render(<EveningCheckin />)
  fireEvent.click(screen.getByRole("button", { name: "몸 상태" }))
  expect(screen.getByRole("heading", { level: 2, name: "오늘 몸 상태" })).toHaveFocus()
  expect(screen.queryByRole("group", { name: "오늘 기분" })).toBeNull()
  expect(screen.queryByRole("button", { name: "기분 4 좋음" })).toBeNull()

  fireEvent.click(screen.getByRole("button", { name: "입력 확인" }))
  expect(screen.getByRole("button", { name: "몸 상태 입력" })).toBeVisible()
  fireEvent.click(screen.getByRole("button", { name: "기분 입력" }))
  expect(screen.getByRole("heading", { level: 2, name: "오늘 기분" })).toHaveFocus()
  expect(screen.queryByRole("button", { name: /몸 부위 기록 이력 보기/u })).toBeNull()
  fireEvent.click(screen.getByRole("button", { name: "이전 질문" }))
  expect(screen.getByRole("heading", { level: 2, name: "입력 확인" })).toHaveFocus()
  expect(loadEntries()).toEqual([])
})

it("keeps the selected date in a compact body question without changing other steps or saving an empty answer", () => {
  render(<EveningCheckin targetDate="2026-07-20" />)
  expect(screen.getByText("2026·07·20").closest("time")).toBeNull()
  fireEvent.click(screen.getByRole("button", { name: "몸 상태" }))
  expect(screen.getByText("2026·07·20").closest("time")).toHaveAttribute("datetime", "2026-07-20")
  expect(screen.getByRole("heading", { name: "오늘 몸 상태" })).toHaveFocus()
  expect(screen.getByRole("button", { name: "이전 질문" })).toBeVisible()
  expect(screen.queryByRole("button", { name: "입력 확인으로" })).toBeNull()
  expect(screen.queryByRole("button", { name: /^저장/u })).toBeNull()

  fireEvent.click(screen.getByRole("button", { name: "입력 확인" }))
  expect(screen.getByRole("heading", { name: "입력 확인" })).toHaveFocus()
  expect(screen.getByRole("button", { name: "몸 상태 입력" })).toBeVisible()
  expect(screen.getByText("2026·07·20").closest("time")).toBeNull()
  expect(loadEntries()).toEqual([])

  fireEvent.click(screen.getByRole("button", { name: "기분 입력" }))
  expect(screen.getByRole("button", { name: "입력 확인으로" })).toBeVisible()
  expect(screen.getByText("2026·07·20").closest("time")).toBeNull()
  fireEvent.click(screen.getByRole("button", { name: "이전 질문" }))
  expect(screen.getByRole("heading", { name: "입력 확인" })).toHaveFocus()
  expect(loadEntries()).toEqual([])
})

it("retains existing body answers when editing mood and returning through review", () => {
  render(<EveningCheckin initialEntry={{ id: "synthetic-body-mood", kind: "evening", date: "2026-10-08",
    savedAt: "2026-10-08T00:00:00.000Z", syncState: "local", sleepH: 0, sleepQuality: 0,
    weightKg: "", restingHr: "", mood: 4, painParts: { rKnee: 4 }, note: "" }} />)
  expect(screen.getByText("불편한 곳 1곳 표시")).toBeVisible()
  expect(screen.getByText("기분 좋음")).toBeVisible()
  expect(screen.getByText(/높은 통증은 사람이 꼭 확인/u)).toBeVisible()

  fireEvent.click(screen.getByRole("button", { name: "기분 수정" }))
  expect(screen.getByRole("button", { name: "기분 4 좋음" })).toHaveAttribute("aria-pressed", "true")
  fireEvent.click(screen.getByRole("button", { name: "기분 입력 안 함" }))
  fireEvent.click(screen.getByRole("button", { name: "입력 확인으로" }))
  expect(screen.getByRole("button", { name: "기분 입력" })).toBeVisible()
  expect(screen.getByText("불편한 곳 1곳 표시")).toBeVisible()
  expect(screen.getByText(/높은 통증은 사람이 꼭 확인/u)).toBeVisible()

  fireEvent.click(screen.getByRole("button", { name: "몸 상태 수정" }))
  expect(screen.getByRole("heading", { level: 2, name: "오늘 몸 상태" })).toBeVisible()
  expect(screen.queryByRole("group", { name: "오늘 기분" })).toBeNull()
  fireEvent.click(screen.getByRole("button", { name: "이전 질문" }))
  expect(screen.getByRole("heading", { level: 2, name: "입력 확인" })).toHaveFocus()
  expect(screen.getByText("불편한 곳 1곳 표시")).toBeVisible()
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


beforeEach(async () => {
  await initializeCanonicalJournalFixture()
})
