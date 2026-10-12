import { act, cleanup, render, screen, fireEvent } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { RecoveryRecordPanel } from "./RecoveryRecordPanel"
import { projectStructuredJournalObservations } from "../../domain/journal-observation"
import { saveDailyContext } from "../../domain/daily-context"
import { setActiveLocalAccount } from "../../domain/account/local-journal-ownership"
import type { JournalEntry } from "../../domain/journal-schema"

beforeEach(() => localStorage.clear())
afterEach(() => { cleanup(); setActiveLocalAccount(null); vi.restoreAllMocks() })

it("keeps every prior daily-context date readable without another input", () => {
  saveDailyContext({ date: "2026-10-07", mood: "GOOD", body: "LIGHT", weather: "SUNNY" })
  saveDailyContext({ date: "2026-10-06", mood: "LOW", body: null, weather: "RAINY" })
  const write = vi.fn()
  render(<RecoveryRecordPanel today="2026-10-07" entries={[]} observations={[]} experimentalFatigue onWriteRecovery={write} />)
  expect(screen.getByText("이전에 남긴 상태")).toBeVisible()
  expect(screen.queryByText("2026-10-07")).not.toBeVisible()
  expect(screen.queryByRole("button", { name: "몸 상태 가벼움" })).not.toBeInTheDocument()
  expect(screen.queryByRole("heading", { name: "몸 상태·회복" })).not.toBeInTheDocument()
  expect(screen.getByLabelText("신경계 피로")).not.toBeVisible()
  expect(screen.queryByText(/최근 운동 · 힘든 정도/)).not.toBeInTheDocument()
  fireEvent.click(screen.getByText("이전에 남긴 상태"))
  expect(screen.getByText("2026-10-07")).toBeVisible()
  expect(screen.getByText("기분 좋음 · 몸 상태 가벼움 · 날씨 맑음")).toBeVisible()
  expect(screen.getByText("2026-10-06")).toBeVisible()
  expect(screen.getByText("기분 낮음 · 날씨 비")).toBeVisible()
  fireEvent.click(screen.getByRole("button", { name: "컨디션 기록" }))
  expect(write).toHaveBeenCalledOnce()
  fireEvent.click(screen.getByRole("button", { name: /피로도 항목별 기록 · 실험/ }))
  expect(screen.getByLabelText("신경계 피로")).toBeVisible()
  expect(screen.getByLabelText("신경계 피로")).toHaveValue("")
})

it("does not show an empty prior-state box", () => {
  render(<RecoveryRecordPanel today="2026-10-07" entries={[]} observations={[]} experimentalFatigue={false} />)
  expect(screen.queryByText(/이전에 남긴 상태/)).not.toBeInTheDocument()
})

it("shows a retry after a storage read error and restores saved dates when storage recovers", () => {
  const key = "trainoracle.daily-context.v1"
  saveDailyContext({ date: "2026-10-07", mood: "GOOD", body: "LIGHT", weather: "SUNNY" })
  const original = Storage.prototype.getItem
  const stored = original.call(localStorage, key)
  const getItem = vi.spyOn(Storage.prototype, "getItem").mockImplementation(function (this: Storage, requestedKey: string) {
    if (requestedKey === key) throw new Error("storage unavailable")
    return original.call(this, requestedKey)
  })

  render(<RecoveryRecordPanel today="2026-10-07" entries={[]} observations={[]} experimentalFatigue={false} />)
  expect(screen.getByText("이전 상태를 불러오지 못했어요")).toBeVisible()
  getItem.mockRestore()
  fireEvent.click(screen.getByRole("button", { name: "다시 불러오기" }))

  expect(screen.getByText("이전에 남긴 상태")).toBeVisible()
  fireEvent.click(screen.getByText("이전에 남긴 상태"))
  expect(screen.getByText("2026-10-07")).toBeVisible()
  expect(original.call(localStorage, key)).toBe(stored)
})

it("offers retry for an invalid map, then reads repaired existing data without writing", () => {
  const key = "trainoracle.daily-context.v1"
  const invalid = "{\"2026-10-07\":{\"mood\":\"PERFECT\"}}"
  const valid = JSON.stringify({ "2026-10-07": { date: "2026-10-07", mood: "GOOD", body: null, weather: null } })
  localStorage.setItem(key, invalid)
  render(<RecoveryRecordPanel today="2026-10-07" entries={[]} observations={[]} experimentalFatigue={false} />)

  expect(screen.getByText("이전 상태를 불러오지 못했어요")).toBeVisible()
  localStorage.setItem(key, valid)
  fireEvent.click(screen.getByRole("button", { name: "다시 불러오기" }))

  expect(screen.getByText("이전에 남긴 상태")).toBeVisible()
  fireEvent.click(screen.getByText("이전에 남긴 상태"))
  expect(screen.getByText("기분 좋음")).toBeVisible()
  expect(localStorage.getItem(key)).toBe(valid)
})

it("hides prior dates immediately after the active account scope changes", () => {
  saveDailyContext({ date: "2026-10-07", mood: "GOOD", body: "LIGHT", weather: "SUNNY" })
  render(<RecoveryRecordPanel today="2026-10-07" entries={[]} observations={[]} experimentalFatigue={false} />)
  expect(screen.getByText("이전에 남긴 상태")).toBeVisible()
  act(() => setActiveLocalAccount("account-b"))
  expect(screen.queryByText("이전에 남긴 상태")).not.toBeInTheDocument()
})

it("shows individual reported exercise exertion with AM/PM, not body state or an inferred average", () => {
  const entry: JournalEntry = { id: "pm", kind: "post-session", date: "2026-10-07", savedAt: "2026-10-07T15:00:00Z",
    syncState: "local", activitySlot: "PM", title: "운동", system: "base", distanceKm: "", durationMin: "", avgPace: "", rpe: 7, memo: "",
    fieldProvenance: { rpe: { provenance: "EXPLICIT" } } }
  const open = vi.fn()
  render(<RecoveryRecordPanel today="2026-10-07" entries={[entry]} observations={projectStructuredJournalObservations([entry])} experimentalFatigue={false} onOpenDay={open} />)
  expect(screen.getByText("최근 운동 · 힘든 정도 7/10")).toBeVisible()
  expect(screen.getByText(/오후/)).toBeVisible()
  fireEvent.click(screen.getByRole("button", { name: "이 기록 보기" }))
  expect(open).toHaveBeenCalledWith("2026-10-07", "pm")
  expect(screen.queryByText(/회복 완료|위험 점수/)).not.toBeInTheDocument()
})
