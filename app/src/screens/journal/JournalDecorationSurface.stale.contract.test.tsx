import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import React from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { setActiveLocalAccount } from "../../domain/account/local-journal-ownership"
import * as accountDecorations from "../../domain/account/account-decoration-service"
import * as accountCalendars from "../../domain/account/account-calendar-decoration-service"
import { CALENDAR_DECORATION_EVENT, CALENDAR_DECORATION_STORAGE_KEY } from "../../domain/calendar-decoration-store"
import { createEmptyCalendarDecorationState } from "../../domain/calendar-decoration-schema"
import { createEmptyDecorationState } from "../../domain/decorations"
import { JournalDecorationSurface } from "./JournalDecorationSurface"

const DATE = "2026-10-02"

beforeEach(() => {
  localStorage.clear()
  setActiveLocalAccount(null)
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  localStorage.clear()
  setActiveLocalAccount(null)
})

function renderOpenStudio(strict = false) {
  const surface = <JournalDecorationSurface date={DATE} previewMonth="2026-10" initiallyOpen hasEntries>
    <article>일지 본문</article>
  </JournalDecorationSurface>
  return render(strict ? <React.StrictMode>{surface}</React.StrictMode> : surface)
}

async function makeCalendarDraft() {
  fireEvent.click(screen.getByRole("button", { name: /^달력$/u }))
  fireEvent.click(await screen.findByRole("button", { name: "재료 서랍 열기" }))
  fireEvent.click(screen.getByRole("button", { name: /^테마$/u }))
  fireEvent.click(await screen.findByRole("button", { name: /모눈 연습장 적용하기/u }))
}

function replaceExternalCalendar(paperThemeId: string | null) {
  localStorage.setItem(CALENDAR_DECORATION_STORAGE_KEY, JSON.stringify({ version: 1, paperThemeId, items: [] }))
  window.dispatchEvent(new Event(CALENDAR_DECORATION_EVENT))
}

describe("JournalDecorationSurface stale calendar review", () => {
  it("loads an ownership-rejected draft and requires explicit review after its durable projection changes", async () => {
    vi.spyOn(accountDecorations, "accountDecorationsEnabled").mockReturnValue(true)
    vi.spyOn(accountDecorations, "accountDecorationStatus").mockReturnValue("READY")
    vi.spyOn(accountDecorations, "readAccountDecorationState").mockReturnValue(createEmptyDecorationState())
    vi.spyOn(accountDecorations, "hydrateAccountDecorations").mockResolvedValue(true)
    const status = vi.spyOn(accountCalendars, "accountCalendarDecorationStatus").mockReturnValue("LOADING")
    const read = vi.spyOn(accountCalendars, "readAccountCalendarDecorationState").mockReturnValue(null)
    vi.spyOn(accountCalendars, "hydrateAccountCalendarDecorations").mockResolvedValue(true)
    const persist = vi.spyOn(accountCalendars, "persistAccountCalendarDecorations")
      .mockResolvedValue({ ok: false, code: "STALE_STATE" })

    renderOpenStudio()
    fireEvent.click(screen.getByRole("button", { name: /^달력$/u }))
    expect(await screen.findByRole("button", { name: "모든 달에 적용" })).toBeDisabled()

    const rejected = { ...createEmptyCalendarDecorationState(), paperThemeId: "THEME_TRACK_NOTEBOOK" as const }
    status.mockReturnValue("OWNERSHIP_STATE_CHANGED")
    read.mockReturnValue(rejected)
    window.dispatchEvent(new Event("trainoracle:account-calendar-decorations-changed"))
    await waitFor(() => expect(screen.getByRole("button", { name: "모든 달에 적용" })).toBeEnabled())
    await makeCalendarDraft()

    const corrected = { ...rejected, paperThemeId: "THEME_GRID_FIELD" as const }
    read.mockReturnValue(corrected)
    window.dispatchEvent(new Event("trainoracle:account-calendar-decorations-changed"))
    fireEvent.click(screen.getByRole("button", { name: "모든 달에 적용" }))

    expect(await screen.findByRole("region", { name: "달력 변경 확인" })).toBeVisible()
    expect(persist).toHaveBeenCalledWith(expect.objectContaining({ paperThemeId: "THEME_GRID_FIELD" }), JSON.stringify(rejected))
    expect(screen.queryByText("계정에 저장됨")).toBeNull()
  })

  it("keeps an initially open studio open under StrictMode", () => {
    renderOpenStudio(true)
    expect(screen.getByRole("dialog", { name: "일지 꾸미기" })).toBeVisible()
    expect(screen.getByRole("button", { name: /^일지$/u })).toHaveAttribute("aria-pressed", "true")
  })

  it("lets the user discard a dirty draft and load the confirmed saved calendar after a stale write", async () => {
    renderOpenStudio()
    await makeCalendarDraft()
    replaceExternalCalendar("THEME_TRACK_NOTEBOOK")

    fireEvent.click(screen.getByRole("button", { name: "모든 달에 적용" }))
    expect(await screen.findByRole("region", { name: "달력 변경 확인" })).toBeVisible()
    expect(screen.getByText(/저장된 꾸밈: 트랙 노트/u)).toBeVisible()
    expect(screen.getByText(/내 변경: 모눈 연습장/u)).toBeVisible()

    fireEvent.click(screen.getByRole("button", { name: "저장된 꾸밈 불러오기" }))
    await waitFor(() => expect(screen.queryByRole("region", { name: "달력 변경 확인" })).toBeNull())
    expect(screen.getByText("저장된 달력 꾸밈을 불러왔어요.")).toBeVisible()
    expect(JSON.parse(localStorage.getItem(CALENDAR_DECORATION_STORAGE_KEY) ?? "{}").paperThemeId).toBe("THEME_TRACK_NOTEBOOK")
    expect(screen.getByRole("button", { name: "모든 달에 적용" })).toBeDisabled()
  })

  it("requires refreshed review after another external calendar change before explicit reapply", async () => {
    renderOpenStudio()
    await makeCalendarDraft()
    replaceExternalCalendar("THEME_TRACK_NOTEBOOK")
    fireEvent.click(screen.getByRole("button", { name: "모든 달에 적용" }))
    expect(await screen.findByRole("region", { name: "달력 변경 확인" })).toBeVisible()

    replaceExternalCalendar(null)
    fireEvent.click(screen.getByRole("button", { name: "내 변경으로 바꾸기" }))
    expect(await screen.findByText("저장된 내용이 다시 바뀌었어요. 새 내용을 확인하고 선택해 주세요.")).toBeVisible()
    expect(screen.getByRole("region", { name: "달력 변경 확인" })).toBeVisible()
    expect(JSON.parse(localStorage.getItem(CALENDAR_DECORATION_STORAGE_KEY) ?? "{}").paperThemeId).toBeNull()

    fireEvent.click(screen.getByRole("button", { name: "내 변경으로 바꾸기" }))
    await waitFor(() => expect(JSON.parse(localStorage.getItem(CALENDAR_DECORATION_STORAGE_KEY) ?? "{}").paperThemeId).toBe("THEME_GRID_FIELD"))
    expect(screen.queryByRole("region", { name: "달력 변경 확인" })).toBeNull()
  })

  it("preserves unsupported data and can explicitly reload a newly readable calendar", async () => {
    const unsupported = JSON.stringify({ version: 99, paperThemeId: null, items: [] })
    localStorage.setItem(CALENDAR_DECORATION_STORAGE_KEY, unsupported)
    renderOpenStudio()
    fireEvent.click(screen.getByRole("button", { name: /^달력$/u }))
    expect(await screen.findByRole("button", { name: "모든 달에 적용" })).toBeDisabled()
    fireEvent.click(screen.getByRole("button", { name: "달력 다시 확인" }))
    await waitFor(() => expect(screen.getByRole("button", { name: "달력 다시 확인" })).toBeEnabled())
    expect(localStorage.getItem(CALENDAR_DECORATION_STORAGE_KEY)).toBe(unsupported)

    localStorage.setItem(CALENDAR_DECORATION_STORAGE_KEY, JSON.stringify({ version: 1, paperThemeId: "THEME_TRACK_NOTEBOOK", items: [] }))
    fireEvent.click(screen.getByRole("button", { name: "달력 다시 확인" }))
    expect(await screen.findByText("저장된 달력 꾸밈을 확인했어요.")).toBeVisible()
    expect(screen.queryByRole("button", { name: "달력 다시 확인" })).toBeNull()
    expect(screen.getByRole("button", { name: "모든 달에 적용" })).toBeDisabled()
  })

  it("keeps a dirty draft and its old comparison base when rechecking after a failed read", async () => {
    renderOpenStudio()
    await makeCalendarDraft()
    const unsupported = JSON.stringify({ version: 99, paperThemeId: null, items: [] })
    localStorage.setItem(CALENDAR_DECORATION_STORAGE_KEY, unsupported)
    window.dispatchEvent(new Event(CALENDAR_DECORATION_EVENT))
    expect(await screen.findByRole("button", { name: "달력 다시 확인" })).toBeVisible()
    expect(screen.getByRole("button", { name: "모든 달에 적용" })).toBeDisabled()

    localStorage.setItem(CALENDAR_DECORATION_STORAGE_KEY, JSON.stringify({ version: 1, paperThemeId: "THEME_TRACK_NOTEBOOK", items: [] }))
    fireEvent.click(screen.getByRole("button", { name: "달력 다시 확인" }))
    expect(await screen.findByText("저장 상태를 확인했어요. 내 변경은 그대로 남아 있어요.")).toBeVisible()
    fireEvent.click(screen.getByRole("button", { name: "모든 달에 적용" }))
    expect(await screen.findByRole("region", { name: "달력 변경 확인" })).toBeVisible()
    expect(screen.getByText(/내 변경: 모눈 연습장/u)).toBeVisible()
    expect(JSON.parse(localStorage.getItem(CALENDAR_DECORATION_STORAGE_KEY) ?? "{}").paperThemeId).toBe("THEME_TRACK_NOTEBOOK")
  })
})
