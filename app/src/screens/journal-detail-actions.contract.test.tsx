import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { JournalEntry } from "../domain/journal-schema"
import { JournalDetailActions } from "./journal-detail-actions"

afterEach(cleanup)
const date = "2026-10-17"
const entry: JournalEntry = {
  id: "synthetic-compact-actions", kind: "post-session", date,
  savedAt: `${date}T02:00:00Z`, syncState: "local", system: "base",
  title: "Morning run", distanceKm: "3", durationMin: "20", avgPace: "", rpe: 3, memo: "",
}

describe("compact journal actions", () => {
  it("uses one label, reveals explicit actions, and retains the selected date and entry", () => {
    const add = vi.fn()
    const edit = vi.fn()
    render(<JournalDetailActions date={date} entries={[entry]} onAddEntry={add} onEditEntry={edit} />)
    const toggle = screen.getByRole("button", { name: "추가·수정" })
    expect(toggle).toHaveAttribute("aria-expanded", "false")
    expect(toggle.querySelector("small")).toBeNull()
    expect(screen.queryByRole("button", { name: "훈련 기록 수정" })).not.toBeInTheDocument()
    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute("aria-expanded", "true")
    fireEvent.click(screen.getByRole("button", { name: "이 날짜에 일지 더 쓰기" }))
    expect(add).toHaveBeenCalledExactlyOnceWith(date)
    fireEvent.click(screen.getByRole("button", { name: "훈련 기록 수정" }))
    expect(edit).toHaveBeenCalledExactlyOnceWith(entry)
    fireEvent.click(toggle)
    expect(screen.queryByRole("button", { name: "훈련 기록 수정" })).not.toBeInTheDocument()
  })

  it("does not promise unavailable edit or add actions", () => {
    const { rerender } = render(<JournalDetailActions date={date} entries={[entry]} onAddEntry={vi.fn()} />)
    expect(screen.getByRole("button", { name: "일지 더 쓰기" })).toBeVisible()
    rerender(<JournalDetailActions date={date} entries={[entry]} onEditEntry={vi.fn()} />)
    expect(screen.getByRole("button", { name: "일지 수정" })).toBeVisible()
    rerender(<JournalDetailActions date={date} entries={[{ ...entry, syncState: "synced" }]} onAddEntry={vi.fn()} onEditEntry={vi.fn()} />)
    expect(screen.getByRole("button", { name: "일지 더 쓰기" })).toBeVisible()
    rerender(<JournalDetailActions date={date} entries={[entry, entry]} onEditEntry={vi.fn()} />)
    expect(screen.queryByRole("button")).not.toBeInTheDocument()
  })
})
