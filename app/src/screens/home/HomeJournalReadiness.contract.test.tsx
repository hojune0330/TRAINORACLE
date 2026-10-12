import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { JournalEntry } from "../../domain/journal-schema"
import { assignJournalsToAccount, setActiveLocalAccount } from "../../domain/account/local-journal-ownership"
import { setAccountAuthState } from "../../domain/account/account-auth-state"
import { markCurrentConfirmedAccountJournalProjection, putAccountJournalProjection,
  resetAccountJournalProjection, setAccountJournalProjectionStatus } from "../../domain/account/account-journal-projection"
import { Home } from "../Home"

// Synthetic enabled state only; no credentials, service initialization or remote calls.
vi.mock("../../domain/account/config", async importOriginal => ({
  ...await importOriginal<typeof import("../../domain/account/config")>(),
  accountFeatureEnabled: () => true,
}))

const STORAGE_KEY = "trainoracle.journal.v1"
const OWNER = "synthetic-home-owner"
const TODAY = "2026-10-12"
const ENTRY = {
  id: "synthetic-home-today", kind: "post-session", date: TODAY, savedAt: "2026-10-12T01:00:00Z",
  syncState: "synced", system: "base", title: "", distanceKm: "3", durationMin: "20", avgPace: "", rpe: 3, memo: "",
  fieldProvenance: { distanceKm: { provenance: "EXPLICIT" } },
} satisfies JournalEntry
const dayButton = () => screen.getByRole("button", { name: "2026년 10월 12일 기록 1개 보기 · 훈련 1" })

beforeEach(() => {
  localStorage.clear(); setActiveLocalAccount(null); resetAccountJournalProjection(null); setAccountAuthState("GUEST")
  vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-12T12:00:00Z"))
})
afterEach(() => {
  cleanup(); vi.restoreAllMocks(); vi.useRealTimers()
  setActiveLocalAccount(null); resetAccountJournalProjection(null); setAccountAuthState("RESOLVING"); localStorage.clear()
})

describe("Home uses the existing owner-scoped calendar readiness", () => {
  it("keeps confirmed empty record-start distinct from unreadable local data in the actual Home", () => {
    const write = vi.fn(), archive = vi.fn()
    render(<Home onWriteLog={write} onOpenArchive={archive} onOpenImport={vi.fn()} />)
    expect(document.querySelector(".record-start")).not.toBeNull()
    localStorage.setItem(STORAGE_KEY, "{")
    act(() => { window.dispatchEvent(new Event("storage")) })
    const notice = screen.getByText("기록을 읽지 못했어요. 기록이 없는 상태와는 달라요.")
    expect(notice.closest('[role="alert"]')).not.toBeNull()
    expect(notice.closest("details")).toBeNull()
    expect(document.querySelector(".record-start")).toBeNull()
    expect(screen.queryByText("처음 기록하기")).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "일지에서 확인" }))
    expect(archive).toHaveBeenCalledOnce()
    fireEvent.click(screen.getByRole("button", { name: "오늘 운동 기록 쓰기" }))
    expect(write).toHaveBeenCalledWith("quick-session")
    expect(localStorage.getItem(STORAGE_KEY)).toBe("{")
  })

  it("does not turn unresolved authentication and no visible entries into first-record proof", () => {
    setAccountAuthState("RESOLVING")
    render(<Home onWriteLog={vi.fn()} onOpenImport={vi.fn()} />)
    expect(screen.getByText("기록을 확인하고 있어요. 아직 기록 유무를 확인하지 못했어요.")).toBeVisible()
    expect(document.querySelector(".record-start")).toBeNull()
    expect(screen.queryByText("처음 기록하기")).toBeNull()
    expect(document.querySelector(".home-hub__today-complete")).toBeNull()
  })

  it("shows account LOADING outside disclosure with a direct storage action", () => {
    setActiveLocalAccount(OWNER); resetAccountJournalProjection(OWNER)
    const account = vi.fn()
    render(<Home onOpenAccount={account} onWriteLog={vi.fn()} onOpenImport={vi.fn()} />)
    const notice = screen.getByText("계정 기록을 확인하고 있어요. 아직 최신 확인이 끝나지 않았어요.")
    expect(notice.closest('[role="status"]')).not.toBeNull()
    expect(notice.closest("details")).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "계정 저장 상태 확인" }))
    expect(account).toHaveBeenCalledOnce()
    expect(document.querySelector(".record-start")).toBeNull()
  })

  it("does not hide an unreadable local snapshot behind account LOADING", () => {
    setActiveLocalAccount(OWNER); resetAccountJournalProjection(OWNER)
    localStorage.setItem(STORAGE_KEY, "{")
    render(<Home onWriteLog={vi.fn()} onOpenImport={vi.fn()} />)
    expect(screen.getByText("계정 기록을 확인하고 있어요. 아직 최신 확인이 끝나지 않았어요.")).toBeVisible()
    const notice = screen.getByText("기록을 읽지 못했어요. 기록이 없는 상태와는 달라요.")
    expect(notice).toBeVisible()
    expect(notice.closest('[role="alert"]')).not.toBeNull()
    expect(notice.closest("details")).toBeNull()
    expect(document.querySelector(".record-start")).toBeNull()
  })

  it("passes STALE cache through the actual Home without today's completion or analysis until current READY", () => {
    setActiveLocalAccount(OWNER); resetAccountJournalProjection(OWNER)
    putAccountJournalProjection(OWNER, ENTRY)
    const openDay = vi.fn()
    render(<Home onWriteLog={vi.fn()} onOpenDay={openDay} onOpenTrends={vi.fn()} />)
    expect(dayButton()).toHaveAccessibleDescription("마지막 확인 기록 1개 · 계정 확인 중")
    expect(document.querySelector(".home-hub__today-complete")).toBeNull()
    expect(screen.getByRole("button", { name: "훈련량·변화 보기" })).toHaveAccessibleDescription("")
    fireEvent.click(dayButton())
    expect(openDay).toHaveBeenCalledWith(TODAY)
    act(() => {
      markCurrentConfirmedAccountJournalProjection(OWNER, ENTRY, 1)
      setAccountJournalProjectionStatus(OWNER, "READY")
    })
    expect(dayButton()).toHaveAccessibleDescription("계정 보관")
    expect(document.querySelector(".home-hub__today-complete")).not.toBeNull()
    expect(screen.getByRole("button", { name: "훈련량·변화 보기" })).not.toHaveAccessibleDescription("")
  })

  it("keeps a failed latest account check separate from its retained acknowledged day", () => {
    setActiveLocalAccount(OWNER); resetAccountJournalProjection(OWNER)
    putAccountJournalProjection(OWNER, ENTRY); markCurrentConfirmedAccountJournalProjection(OWNER, ENTRY, 1)
    setAccountJournalProjectionStatus(OWNER, "READY")
    const account = vi.fn()
    render(<Home onOpenAccount={account} onWriteLog={vi.fn()} />)
    expect(dayButton()).toHaveAccessibleDescription("계정 보관")
    act(() => { setAccountJournalProjectionStatus(OWNER, "FAILED") })
    expect(dayButton()).toHaveAccessibleDescription("마지막 확인 기록 1개 · 최신 확인 실패")
    expect(dayButton()).not.toHaveTextContent("계정 보관")
    const notice = screen.getByText("계정 기록의 최신 상태를 확인하지 못했어요. 보관된 기록의 저장 상태를 확인해 주세요.")
    expect(notice.closest('[role="alert"]')).not.toBeNull()
    expect(notice.closest("details")).toBeNull()
    expect(document.querySelector(".home-hub__today-complete")).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "계정 저장 상태 확인" }))
    expect(account).toHaveBeenCalledOnce()
  })

  it("does not let a guest legacy synced copy claim a current account receipt", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([ENTRY]))
    render(<Home />)
    expect(dayButton()).toHaveAccessibleDescription("보관된 기록 · 계정 저장 미확인")
    expect(dayButton()).not.toHaveTextContent("계정 보관")
  })

  it("removes another owner's dated destination on a scope change and keeps the new unread state", () => {
    setActiveLocalAccount(OWNER); resetAccountJournalProjection(OWNER)
    localStorage.setItem(STORAGE_KEY, JSON.stringify([{ ...ENTRY, syncState: "local" }]))
    expect(assignJournalsToAccount([ENTRY.id], OWNER)).toBe(true)
    setAccountJournalProjectionStatus(OWNER, "READY")
    render(<Home />)
    expect(dayButton()).toBeVisible()
    act(() => {
      setActiveLocalAccount("synthetic-home-other-owner")
      resetAccountJournalProjection("synthetic-home-other-owner")
    })
    expect(screen.queryByRole("button", { name: /2026년 10월 12일 기록 1개 보기/ })).toBeNull()
    expect(screen.getByText("계정 기록을 확인하고 있어요. 아직 최신 확인이 끝나지 않았어요.")).toBeVisible()
  })
})
