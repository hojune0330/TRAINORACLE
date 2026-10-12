import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { CanonicalJournalBoundary } from "./CanonicalJournalBoundary"
import { JOURNAL_STORAGE_KEY, LEGACY_JOURNAL_STORAGE_KEYS, PRIVATE_NOTE_RECOVERY_STORAGE_KEY } from "../domain/journal-storage-keys"
import { canonicalJournalLegacySnapshots } from "../domain/canonical-journal-storage"

beforeEach(() => { localStorage.clear(); sessionStorage.clear() })
afterEach(cleanup)

describe("canonical journal startup and interrupted input", () => {
  it("mounts the app only after the empty device has a confirmed store", async () => {
    render(<CanonicalJournalBoundary><label>작성 중<input defaultValue="초안" /></label></CanonicalJournalBoundary>)
    expect(screen.queryByRole("textbox")).toBeNull()
    expect(await screen.findByRole("textbox")).toHaveValue("초안")
    expect(localStorage.getItem("to-local-journal.migration.v1")).toContain('"phase":"ready"')
  })

  it("keeps the mounted draft, blocks Escape, and explicitly preserves a legacy divergence", async () => {
    render(<CanonicalJournalBoundary><label>작성 중<input defaultValue="" /></label></CanonicalJournalBoundary>)
    const input = await screen.findByRole("textbox")
    fireEvent.change(input, { target: { value: "SYNTHETIC_UNSAVED_DRAFT" } })
    input.focus()
    sessionStorage.removeItem("to-local-journal.session-migration.v1")
    sessionStorage.setItem(LEGACY_JOURNAL_STORAGE_KEYS.privateNoteRecovery, "SYNTHETIC_RECOVERY_NOT_REAL")
    localStorage.setItem(LEGACY_JOURNAL_STORAGE_KEYS.journal, "[]")
    fireEvent(window, new StorageEvent("storage", { key: LEGACY_JOURNAL_STORAGE_KEYS.journal }))
    const dialog = await screen.findByRole("dialog", { name: "이전 앱에서 기록이 바뀌었어요" })
    expect(input).toHaveValue("SYNTHETIC_UNSAVED_DRAFT")
    expect(fireEvent(dialog, new Event("cancel", { bubbles: false, cancelable: true }))).toBe(false)
    expect(dialog).toHaveAttribute("open")
    fireEvent.click(screen.getByRole("button", { name: "현재 기록으로 계속" }))
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
    expect(screen.getByRole("textbox")).toBe(input)
    expect(input).toHaveValue("SYNTHETIC_UNSAVED_DRAFT")
    expect(input).toHaveFocus()
    expect(sessionStorage.getItem(PRIVATE_NOTE_RECOVERY_STORAGE_KEY)).toBe("SYNTHETIC_RECOVERY_NOT_REAL")
    expect(sessionStorage.getItem("to-local-journal.session-migration.v1")).toContain('"completed":true')
    // Continuing neither merges nor clears the old writer's bytes.
    expect(localStorage.getItem(JOURNAL_STORAGE_KEY)).toBeNull()
    expect(localStorage.getItem(LEGACY_JOURNAL_STORAGE_KEYS.journal)).toBe("[]")
    expect(canonicalJournalLegacySnapshots(localStorage).some(snapshot => snapshot.values.some(([key, raw]) => key === LEGACY_JOURNAL_STORAGE_KEYS.journal && raw === "[]"))).toBe(true)
  })

  it("does not mount a journal or offer keep-current for unreadable legacy data", async () => {
    localStorage.setItem(LEGACY_JOURNAL_STORAGE_KEYS.journal, "{broken synthetic}")
    render(<CanonicalJournalBoundary><input aria-label="不应出现" /></CanonicalJournalBoundary>)
    await screen.findByRole("heading", { name: "기록을 확인하지 못했어요" })
    expect(screen.queryByRole("textbox")).toBeNull()
    expect(screen.queryByRole("button", { name: "현재 기록으로 계속" })).toBeNull()
    expect(localStorage.getItem(LEGACY_JOURNAL_STORAGE_KEYS.journal)).toBe("{broken synthetic}")
    expect(localStorage.getItem(JOURNAL_STORAGE_KEY)).toBeNull()
  })
})
