import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { ConnectedDataHome } from "./ConnectedDataHome"
import type { JournalEntry } from "../../domain/journal-schema"
import { setActiveLocalAccount } from "../../domain/account/local-journal-ownership"
beforeEach(() => { setActiveLocalAccount(null); localStorage.clear() })
afterEach(cleanup)
const checkin: JournalEntry = { id: "synthetic-checkin", kind: "evening", date: "2026-11-06", savedAt: "2026-11-06T20:00:00Z", syncState: "local", sleepQuality: 0, weightKg: "", painParts: {}, mood: 0, note: "", sleepH: 0, restingHr: "52", fieldProvenance: { sleepH: { provenance: "EXPLICIT" } } }
it("shows explicit zero sleep and links the original date rather than today", () => {
  const open = vi.fn()
  render(<ConnectedDataHome entries={[checkin]} today="2026-11-07" onOpenDay={open} />)
  fireEvent.click(screen.getByRole("button", { name: /수면 0시간/ }))
  expect(open).toHaveBeenCalledWith("2026-11-06", "synthetic-checkin")
  expect(screen.getByText("어제의 몸 상태")).toBeInTheDocument()
})
it("does not fabricate missing sleep and retains a hidden metric preference", () => {
  const { unmount } = render(<ConnectedDataHome entries={[{ ...checkin, fieldProvenance: {} }]} today="2026-11-07" onOpenDay={vi.fn()} />)
  expect(screen.queryByRole("button", { name: /수면 0시간/ })).toBeNull()
  fireEvent.click(screen.getByText("몸 상태 표시 설정"))
  fireEvent.click(screen.getByRole("checkbox", { name: "안정시 심박" }))
  expect(screen.queryByRole("button", { name: /안정시 심박 52/ })).toBeNull()
  unmount()
  render(<ConnectedDataHome entries={[checkin]} today="2026-11-07" onOpenDay={vi.fn()} />)
  expect(screen.queryByRole("button", { name: /안정시 심박 52/ })).toBeNull()
  expect(screen.getByRole("button", { name: /수면 0시간/ })).toBeInTheDocument()
})
