import React from "react"
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest"
import { AppShell } from "./AppShell"
import { setActiveLocalAccount } from "./domain/account/local-journal-ownership"
import { hasPendingBrowserBackLayer } from "./navigation/browserNavigation"
import type { JournalEntry } from "./domain/journal-schema"

const date = "2026-10-08"
const entries: JournalEntry[] = ["AM", "PM"].map((slot, index) => ({
  id: `calendar-return-${slot}`, kind: "post-session", date, savedAt: `2026-10-08T0${index + 1}:00:00.000Z`,
  syncState: "local", system: "base", title: `${slot} 합성 훈련`, memo: "", rpe: 4,
  activitySlot: slot as "AM" | "PM", distanceKm: "3", durationMin: "20", avgPace: "",
}))
beforeAll(async () => {
  await Promise.all([import("./screens/JournalArchive"), import("./screens/JournalDayReader"), import("./screens/LogDetail")])
}, 60000)
beforeEach(() => {
  setActiveLocalAccount("reset-calendar-return"); setActiveLocalAccount(null)
  localStorage.clear(); sessionStorage.clear()
  localStorage.setItem("trainoracle.journal.v1", JSON.stringify(entries))
})
afterEach(async () => {
  cleanup()
  await waitFor(() => expect(hasPendingBrowserBackLayer()).toBe(false), { timeout: 5000 })
})

describe("original journal return through the shell", { timeout: 15000 }, () => {
  it.each(["in-app", "browser"])("restores the selected record and live focus after %s Back", async mode => {
    render(<AppShell />)
    fireEvent.click(screen.getByRole("button", { name: "일지" }))
    const day = await screen.findByRole("button", { name: /2026년 10월 8일.*일지 열기/ })
    fireEvent.click(day)
    let dialog = await screen.findByRole("dialog")
    const pm = dialog.querySelector<HTMLButtonElement>('button[data-journal-entry-id="calendar-return-PM"]')!
    fireEvent.click(pm)
    const body = dialog.querySelector<HTMLElement>(".plan-day-reader__body")!
    body.scrollTop = 220
    fireEvent.click(within(dialog).getByRole("button", { name: "일지·메모 원문 열기" }))
    expect(await screen.findByRole("heading", { level: 1, name: /2026년 10월 8일.*일지/ })).toBeVisible()
    if (mode === "browser") act(() => window.history.back())
    else fireEvent.click(screen.getByRole("button", { name: "일지 목록으로 돌아가기" }))
    dialog = await screen.findByRole("dialog")
    const restored = dialog.querySelector<HTMLButtonElement>('button[data-journal-entry-id="calendar-return-PM"]')!
    await waitFor(() => expect(restored).toHaveFocus())
    expect(restored).toHaveAttribute("aria-pressed", "true")
    expect(dialog.querySelector<HTMLElement>(".plan-day-reader__body")!.scrollTop).toBe(220)
    fireEvent.click(within(dialog).getByRole("button", { name: "달력으로 돌아가기" }))
    await waitFor(() => expect(screen.getByRole("button", { name: /2026년 10월 8일.*일지 열기/ })).toHaveFocus())
    expect(screen.queryByRole("dialog")).toBeNull()
    expect(JSON.parse(localStorage.getItem("trainoracle.journal.v1")!)).toEqual(entries)
    fireEvent.click(screen.getByRole("button", { name: "홈" }))
    fireEvent.click(screen.getByRole("button", { name: "일지" }))
    await screen.findByRole("grid", { name: "2026년 10월 달력" })
    expect(screen.queryByRole("dialog")).toBeNull()
  })
})
