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
    expect(replaceAllEntries([imported, {
      id: "local-companion-entry",
      kind: "post-session",
      date: DATE,
      savedAt: "2026-07-20T19:00:00.000Z",
      syncState: "local",
      system: "base",
      title: "Local companion run",
      distanceKm: "3",
      durationMin: "18",
      avgPace: "6:00",
      rpe: 4,
      memo: "",
    }]).ok).toBe(true)
    const onEditEntry = vi.fn()

    // When
    render(<LogDetail date={DATE} onEditEntry={onEditEntry} />)

    // Then
    expect(screen.queryByTestId(`journal-edit-${imported.id}`)).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Imported activity.+가져온 기록.+펼쳐보기/u })).toBeVisible()
    expect(onEditEntry).not.toHaveBeenCalled()
  })

  it("keeps a multi-entry day compact and gives its managed edit actions distinct names", async () => {
    // Given
    const user = userEvent.setup()
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
    expect(screen.getByRole("button", { name: /훈련 · Morning run.+펼쳐보기/u })).toHaveAttribute("aria-expanded", "false")
    expect(screen.getByRole("button", { name: /훈련 · Evening run.+펼쳐보기/u })).toHaveAttribute("aria-expanded", "false")
    expect(screen.getByRole("button", { name: "모두 펼쳐보기" })).toHaveAttribute("aria-pressed", "false")

    const dayEnd = screen.getByTestId("journal-day-end")
    const manageToggle = screen.getByTestId("journal-manage-toggle")
    expect(dayEnd.compareDocumentPosition(manageToggle) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()

    await user.click(screen.getByRole("button", { name: "모두 펼쳐보기" }))
    expect(screen.getByRole("button", { name: /훈련 · Morning run.+접기/u })).toHaveAttribute("aria-expanded", "true")
    expect(screen.getByRole("button", { name: /훈련 · Evening run.+접기/u })).toHaveAttribute("aria-expanded", "true")
    await user.click(screen.getByRole("button", { name: "간단히 보기" }))
    expect(screen.getByRole("button", { name: /훈련 · Morning run.+펼쳐보기/u })).toHaveAttribute("aria-expanded", "false")
    expect(screen.getByRole("button", { name: /훈련 · Evening run.+펼쳐보기/u })).toHaveAttribute("aria-expanded", "false")

    await user.click(manageToggle)
    expect(screen.getByRole("button", { name: "훈련 기록 수정 1/2 · Morning run" })).toBeVisible()
    expect(screen.getByRole("button", { name: "훈련 기록 수정 2/2 · Evening run" })).toBeVisible()
  })

  it("keeps identical compact summaries uniquely named for assistive technology", () => {
    const shared = {
      kind: "post-session" as const,
      date: DATE,
      syncState: "local" as const,
      system: "base",
      title: "Same-looking run",
      distanceKm: "5",
      durationMin: "25",
      avgPace: "5:00",
      rpe: 6,
      memo: "",
    }
    expect(replaceAllEntries([
      { ...shared, id: "same-looking-1", savedAt: "2026-07-20T09:00:00.000Z" },
      { ...shared, id: "same-looking-2", savedAt: "2026-07-20T09:00:00.000Z" },
    ]).ok).toBe(true)

    render(<LogDetail date={DATE} />)

    const summaries = screen.getAllByRole("button", { name: /훈련 · Same-looking run.+펼쳐보기/u })
    expect(summaries).toHaveLength(2)
    expect(summaries[0]).toHaveAccessibleName(/1번째 기록/u)
    expect(summaries[1]).toHaveAccessibleName(/2번째 기록/u)
  })

  it("keeps a strong-pain warning visible in the compact summary and restores the full review on demand", async () => {
    const user = userEvent.setup()
    expect(replaceAllEntries([
      {
        id: "pain-context-session",
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
      },
      {
        id: "painful-evening",
        kind: "evening" as const,
        date: DATE,
        savedAt: "2026-07-20T18:00:00.000Z",
        syncState: "local" as const,
        sleepH: 7,
        sleepQuality: 3,
        weightKg: "",
        restingHr: "",
        painParts: { 무릎: 4 },
        mood: 2,
        note: "회복 점검",
      },
    ].reverse()).ok).toBe(true)

    render(<LogDetail date={DATE} />)

    expect(screen.getByLabelText("훈련 1 · 하루 마무리 1 기록")).toBeVisible()
    const orderedSummaries = screen.getAllByRole("button", { name: /번째 기록/u })
    expect(orderedSummaries[0]).toHaveAccessibleName(/1번째 기록 · 훈련 · Morning run/u)
    expect(orderedSummaries[1]).toHaveAccessibleName(/2번째 기록 · 하루 마무리/u)
    const summary = screen.getByRole("button", { name: /하루 마무리.+기분 무덤덤.+통증 확인.+펼쳐보기/u })
    expect(summary).toBeVisible()
    expect(summary).toHaveAttribute("aria-expanded", "false")
    expect(screen.getByTestId("pain-review-persist")).not.toBeVisible()

    await user.click(summary)
    expect(screen.getByTestId("pain-review-persist")).toBeVisible()
    expect(screen.getByText(/지도자·보호자와 꼭 상의/u)).toBeVisible()
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
    expect(screen.getByRole("button", { name: /훈련 · First duplicate.+펼쳐보기/u })).toBeVisible()
    expect(screen.getByRole("button", { name: /훈련 · Second duplicate.+펼쳐보기/u })).toBeVisible()
    expect(consoleError.mock.calls.flat().join(" ")).not.toContain("Encountered two children with the same key")
  })
})
