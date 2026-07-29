import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import type { JournalEntry } from "../domain/journal-store"
import { loadEntries, replaceAllEntries } from "../domain/journal-store"
import { LogEntry } from "./LogEntry"

afterEach(cleanup)

const DATE = "2026-07-20"

describe("past journal revisit forms", () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it("prefills and replaces an evening check-in without changing its identity", async () => {
    // Given
    const user = userEvent.setup()
    const entry = {
      id: "past-evening",
      kind: "evening",
      date: DATE,
      savedAt: "2026-07-20T20:00:00.000Z",
      syncState: "local",
      sleepH: 8,
      sleepQuality: 4,
      weightKg: "61.2",
      restingHr: "48",
      painParts: { calf: 2 },
      mood: 4,
      note: "몸이 가벼웠다",
      memoPurpose: "PRIVATE_SELF_ONLY",
    } satisfies JournalEntry
    expect(replaceAllEntries([entry]).ok).toBe(true)
    render(<LogEntry entryType="evening" initialEntry={entry} />)

    // Then
    expect(screen.getByLabelText("수면 시간")).toHaveValue("8")
    expect(screen.getByLabelText("체중 (kg)")).toHaveValue("61.2")
    expect(screen.getByLabelText("안정시 심박 (bpm)")).toHaveValue("48")
    expect(screen.getByRole("button", { name: "감정 4 좋음" })).toHaveAttribute("aria-pressed", "true")
    expect(screen.getByRole("textbox", { name: "오늘의 메모" })).toHaveValue("몸이 가벼웠다")

    // When
    await user.clear(screen.getByLabelText("체중 (kg)"))
    await user.type(screen.getByLabelText("체중 (kg)"), "61.0")
    await user.click(screen.getByRole("button", { name: /수정 저장/u }))

    // Then
    expect(loadEntries()).toEqual([
      expect.objectContaining({ id: entry.id, date: DATE, savedAt: entry.savedAt, weightKg: "61.0" }),
    ])
  })

  it("reopens a post-race record in its recorded stage and replaces it in place", async () => {
    // Given
    const user = userEvent.setup()
    const entry = {
      id: "past-race",
      kind: "race",
      date: DATE,
      savedAt: "2026-07-20T19:00:00.000Z",
      syncState: "local",
      stage: "post",
      record: "16:42.18",
      rank: "2위",
      result: "결승 진출",
      memo: "마지막 300m를 밀었다",
      memoPurpose: "ANALYZABLE_TRAINING_NOTE",
      tension: 5,
      condition: 4,
      mood: 4,
      goalPace: { schemaVersion: 1, unit: "seconds_per_kilometer", secondsPerKm: 225 },
    } satisfies JournalEntry
    expect(replaceAllEntries([entry]).ok).toBe(true)
    render(<LogEntry entryType="race" initialEntry={entry} />)

    // Then
    expect(screen.getByRole("button", { name: "경기 직후" })).toHaveAttribute("aria-pressed", "true")
    expect(screen.getByRole("textbox", { name: "경기 기록" })).toHaveValue("16:42.18")
    expect(screen.getByRole("textbox", { name: "경기 순위" })).toHaveValue("2위")
    expect(screen.getByRole("textbox", { name: "경기 결과" })).toHaveValue("결승 진출")
    expect(screen.getByRole("textbox", { name: "경기 메모" })).toHaveValue("마지막 300m를 밀었다")

    // When
    await user.clear(screen.getByRole("textbox", { name: "경기 결과" }))
    await user.type(screen.getByRole("textbox", { name: "경기 결과" }), "결승 2위")
    await user.click(screen.getByRole("button", { name: /수정 저장/u }))

    // Then
    expect(loadEntries()).toEqual([
      expect.objectContaining({ id: entry.id, date: DATE, savedAt: entry.savedAt, result: "결승 2위" }),
    ])
  })
})
