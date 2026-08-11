import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { loadTombstones } from "../domain/account/tombstone"
import { entriesForDate, replaceAllEntries, saveEntry } from "../domain/journal-store"
import { toImportedEntry } from "../domain/import/import-draft"
import { LogDetail } from "./LogDetail"

const DATE = "2026-07-20"
const ENTRY_ID = "past-local-entry"

afterEach(cleanup)

describe("past journal preservation before revisit work", () => {
  beforeEach(() => {
    window.localStorage.clear()
    window.history.replaceState({}, "", "/?app=1")
  })

  afterEach(() => vi.restoreAllMocks())

  it("keeps the current app confirmation, trash, and tombstone behavior", async () => {
    // Given
    const user = userEvent.setup()
    const nativeConfirm = vi.spyOn(window, "confirm")
    const seeded = saveEntry({
      id: ENTRY_ID,
      kind: "post-session",
      date: DATE,
      savedAt: "2026-07-20T09:00:00.000Z",
      syncState: "local",
      system: "base",
      title: "Past local session",
      distanceKm: "5",
      durationMin: "25",
      avgPace: "5:00",
      rpe: 6,
      memo: "",
    })
    expect(seeded.ok).toBe(true)
    render(<LogDetail date={DATE} />)
    const deleteButton = document.getElementById(`journal-delete-${ENTRY_ID}`)
    if (!(deleteButton instanceof HTMLButtonElement)) {
      throw new TypeError("Expected the current journal delete button")
    }

    // When
    await user.click(deleteButton)

    // Then
    expect(screen.getByTestId("journal-delete-dialog")).toHaveAttribute("role", "alertdialog")
    expect(nativeConfirm).not.toHaveBeenCalled()

    // When
    await user.click(screen.getByTestId("journal-delete-cancel"))

    // Then
    expect(entriesForDate(DATE)).toHaveLength(1)

    // When
    await user.click(deleteButton)
    await user.click(screen.getByTestId("journal-delete-confirm"))

    // Then
    expect(entriesForDate(DATE)).toEqual([])
    expect(loadTombstones()).toEqual([expect.objectContaining({ id: ENTRY_ID })])

    // When
    await user.click(screen.getByTestId("delete-undo-button"))

    // Then
    const restored = entriesForDate(DATE)
    expect(restored).toHaveLength(1)
    expect(restored[0]).toMatchObject({ title: "Past local session" })
    expect(restored[0]?.id).not.toBe(ENTRY_ID)
    expect(loadTombstones()).toEqual([expect.objectContaining({ id: ENTRY_ID })])
  })

  it("does not offer an edit path for an imported activity", () => {
    // Given
    const imported = toImportedEntry({
      date: DATE,
      name: "Imported activity",
      sport: "running",
      distanceKm: "5",
      durationMin: "25",
      avgPace: "5:00",
    }, "tcx")
    expect(replaceAllEntries([imported]).ok).toBe(true)
    const onEditEntry = vi.fn()

    // When
    render(<LogDetail date={DATE} onEditEntry={onEditEntry} />)

    // Then
    expect(screen.queryByTestId(`journal-edit-${imported.id}`)).not.toBeInTheDocument()
    expect(onEditEntry).not.toHaveBeenCalled()
  })

  it("gives same-kind edit actions distinct names", () => {
    // Given
    const first = {
      id: "morning-session",
      kind: "post-session" as const,
      date: DATE,
      savedAt: "2026-07-20T09:00:00.000Z",
      syncState: "local" as const,
      system: "base",
      title: "Morning run",
      distanceKm: "5",
      durationMin: "25",
      avgPace: "5:00",
      rpe: 6,
      memo: "",
    }
    const second = {
      ...first,
      id: "evening-session",
      savedAt: "2026-07-20T18:00:00.000Z",
      title: "Evening run",
    }
    expect(replaceAllEntries([first, second]).ok).toBe(true)

    // When
    render(<LogDetail date={DATE} onEditEntry={vi.fn()} />)

    // Then
    expect(screen.getByRole("button", { name: "훈련 기록 수정 1/2 · Morning run" })).toBeVisible()
    expect(screen.getByRole("button", { name: "훈련 기록 수정 2/2 · Evening run" })).toBeVisible()
  })

  it("hides ambiguous edit actions when stored entries share an id", () => {
    // Given
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined)
    const first = {
      id: "duplicate-entry",
      kind: "post-session" as const,
      date: DATE,
      savedAt: "2026-07-20T09:00:00.000Z",
      syncState: "local" as const,
      system: "base",
      title: "First duplicate",
      distanceKm: "5",
      durationMin: "25",
      avgPace: "5:00",
      rpe: 6,
      memo: "",
    }
    expect(replaceAllEntries([first, { ...first, title: "Second duplicate" }]).ok).toBe(true)

    // When
    render(<LogDetail date={DATE} onEditEntry={vi.fn()} />)

    // Then
    expect(screen.queryByTestId("journal-edit-duplicate-entry")).not.toBeInTheDocument()
    expect(screen.getByText("First duplicate")).toBeVisible()
    expect(screen.getByText("Second duplicate")).toBeVisible()
    expect(consoleError.mock.calls.flat().join(" ")).not.toContain("Encountered two children with the same key")
  })
})
