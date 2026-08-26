import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import type { PostSessionEntry } from "../../domain/journal-schema"
import { loadEntriesOwnedBy, saveEntry } from "../../domain/journal-store"
import { setActiveLocalAccount } from "../../domain/account/local-journal-ownership"
import { DeviceJournalOwnershipPanel } from "./DeviceJournalOwnershipPanel"

function post(id: string): PostSessionEntry {
  return {
    id, kind: "post-session", date: "2026-08-25",
    savedAt: "2026-08-25T10:00:00.000Z", syncState: "local",
    system: "base", title: "이지런", distanceKm: "8",
    durationMin: "45", avgPace: "5:30", rpe: 4, memo: "",
  }
}

beforeEach(() => {
  window.localStorage.clear()
  setActiveLocalAccount(null)
})

afterEach(() => cleanup())

describe("DeviceJournalOwnershipPanel", () => {
  it("requires a second explicit tap before assigning device journals", async () => {
    expect(saveEntry(post("device")).ok).toBe(true)
    setActiveLocalAccount("account-a")
    render(<DeviceJournalOwnershipPanel userId="account-a" />)

    await userEvent.click(screen.getByTestId("connect-device-journals-start"))
    expect(loadEntriesOwnedBy("account-a")).toEqual([])

    await userEvent.click(screen.getByTestId("connect-device-journals-confirm"))
    expect(loadEntriesOwnedBy("account-a").map((entry) => entry.id)).toEqual(["device"])
    expect(screen.getByTestId("device-journal-ownership-result").textContent).toContain("1개")
  })

  it("does not render when there is no unbound device journal", () => {
    setActiveLocalAccount("account-a")
    render(<DeviceJournalOwnershipPanel userId="account-a" />)
    expect(screen.queryByTestId("device-journal-ownership")).toBeNull()
  })
})
