import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { JournalEntry } from "../../domain/journal-schema"
import { LatestJournalDay, type LatestJournalStorage } from "./LatestJournalDay"

const ENTRY = {
  id: "synthetic-day-training", kind: "post-session", date: "2026-10-11", savedAt: "2026-10-11T01:00:00Z",
  syncState: "local", system: "base", title: "비공개 훈련 제목", distanceKm: "3", durationMin: "20",
  avgPace: "", rpe: 3, memo: "비공개 합성 메모", memoPurpose: "PRIVATE_SELF_ONLY",
} satisfies JournalEntry
const EVENING = {
  id: "synthetic-day-evening", kind: "evening", date: ENTRY.date, savedAt: "2026-10-11T12:00:00Z",
  syncState: "local", sleepH: 0, sleepQuality: 0, weightKg: "", restingHr: "", painParts: {},
  mood: 0, note: "비공개 합성 하루 메모", memoPurpose: "PRIVATE_SELF_ONLY",
} satisfies JournalEntry
const TODAY = "2026-10-12"
const context = (overrides: Partial<LatestJournalStorage> = {}): LatestJournalStorage => ({
  readiness: "READY", owner: null, accountStatus: "IDLE", accountStoredVersions: new Map(), currentConfirmedVersions: new Map(), ...overrides,
})

afterEach(cleanup)

describe("latest journal day concise information and storage proof", () => {
  it("keeps one kind concise with the full accessible date, provenance and original day destination", () => {
    const imported = { ...ENTRY, fieldProvenance: {
      distanceKm: { provenance: "DERIVED", derivedFrom: ["import:activity-file"], derivationRuleId: "import.activity-file.v1" },
    } } satisfies JournalEntry
    const entries = [imported, { ...ENTRY, id: "synthetic-future", date: "2026-10-13" }]
    const before = structuredClone(entries)
    const openDay = vi.fn()
    render(<LatestJournalDay entries={entries} today={TODAY} storage={context()} onOpenDay={openDay} />)
    const day = screen.getByRole("button", { name: "2026년 10월 11일 기록 1개 보기 · 훈련 1" })
    expect(day.querySelector("strong")).toHaveTextContent("10월 11일 · 훈련")
    expect(day).toHaveAccessibleDescription("이 브라우저에 저장됨 · 가져온 기록 포함")
    fireEvent.click(day)
    expect(openDay).toHaveBeenCalledWith("2026-10-11")
    expect(entries).toEqual(before)
    expect(document.body.textContent).not.toMatch(/비공개|10월 13일/)
  })

  it("shows a different year and every kind/count in a single grouped destination", () => {
    const entries = [ENTRY, { ...ENTRY, id: "synthetic-second" }, EVENING].map(entry => ({ ...entry, date: "2025-12-31" }))
    render(<LatestJournalDay entries={entries} today={TODAY} storage={context()} />)
    const day = screen.getByRole("button", { name: "2025년 12월 31일 기록 3개 보기 · 훈련 2 · 컨디션·메모 1" })
    expect(day.querySelector("strong")).toHaveTextContent("2025년 12월 31일 · 기록 3개")
    expect(day).toHaveTextContent("훈련 2 · 컨디션·메모 1")
    expect(day).toHaveAccessibleDescription("이 브라우저에 저장됨")
    expect(screen.getAllByRole("button", { name: /기록 3개 보기/ })).toHaveLength(1)
  })

  it("describes account storage only for the scoped current receipt and retains mixed counts", () => {
    const accountEntry = { ...ENTRY, syncState: "synced" } satisfies JournalEntry
    render(<LatestJournalDay entries={[accountEntry, EVENING]} today={TODAY} storage={context({
      owner: "synthetic-owner", accountStatus: "READY", accountStoredVersions: new Map([[ENTRY.id, ENTRY]]), currentConfirmedVersions: new Map([[ENTRY.id, ENTRY]]),
    })} />)
    const day = screen.getByRole("button", { name: /기록 2개 보기/ })
    expect(day).toHaveAccessibleDescription("계정 보관 1개 · 기기 보관 1개 · 계정 저장 미확인")
    expect(day).not.toHaveTextContent("이 브라우저에 저장됨")
  })

  it("does not promote an acknowledged cache to current account confirmation when READY follows another receipt", () => {
    render(<LatestJournalDay entries={[{ ...ENTRY, syncState: "synced" }]} today={TODAY} storage={context({
      owner: "synthetic-owner", accountStatus: "READY", accountStoredVersions: new Map([[ENTRY.id, ENTRY]]), currentConfirmedVersions: new Map([["synthetic-other-receipt", ENTRY]]),
    })} />)
    const day = screen.getByRole("button", { name: /기록 1개 보기/ })
    expect(day).toHaveAccessibleDescription("마지막 확인 기록 1개 · 현재 계정 확인 미완료")
    expect(day).not.toHaveTextContent("계정 보관")
  })

  it.each([
    ["LOADING", "계정 확인 중"], ["PENDING", "계정 저장 대기"], ["FAILED", "최신 확인 실패"],
    ["REJECTED", "계정 저장 실패"], ["CONFLICT", "수정 충돌"],
  ] as const)("keeps %s visible beside the acknowledged cache and device count", (accountStatus, label) => {
    render(<LatestJournalDay entries={[{ ...ENTRY, syncState: "synced" }, EVENING]} today={TODAY} storage={context({
      readiness: "STALE", owner: "synthetic-owner", accountStatus,
      accountStoredVersions: new Map([[ENTRY.id, ENTRY]]), currentConfirmedVersions: new Map([[ENTRY.id, ENTRY]]),
    })} />)
    const day = screen.getByRole("button", { name: /기록 2개 보기/ })
    expect(day).toHaveAccessibleDescription(`마지막 확인 기록 1개 · 기기 보관 1개 · ${label}`)
    expect(day).not.toHaveTextContent("계정 보관")
    expect(day.closest("details")).toBeNull()
  })

  it.each(["local", "synced"] as const)("does not promote a same-ID newer %s copy to the old account receipt", syncState => {
    render(<LatestJournalDay entries={[{ ...ENTRY, syncState, savedAt: "2026-10-12T02:00:00Z" }]} today={TODAY} storage={context({
      owner: "synthetic-owner", accountStatus: "READY",
      accountStoredVersions: new Map([[ENTRY.id, ENTRY]]), currentConfirmedVersions: new Map([[ENTRY.id, ENTRY]]),
    })} />)
    const day = screen.getByRole("button", { name: /기록 1개 보기/ })
    expect(day).toHaveAccessibleDescription("기기 보관 · 계정 저장 미확인")
    expect(day).not.toHaveTextContent("계정 보관")
    expect(day).not.toHaveTextContent("마지막 확인 기록")
  })

  it("does not infer an account or device-only success from a guest legacy synced flag", () => {
    render(<LatestJournalDay entries={[{ ...ENTRY, syncState: "synced" }]} today={TODAY} storage={context()} />)
    const day = screen.getByRole("button", { name: /기록 1개 보기/ })
    expect(day).toHaveAccessibleDescription("보관된 기록 · 계정 저장 미확인")
    expect(day).not.toHaveTextContent("계정 보관")
    expect(day).not.toHaveTextContent("이 브라우저에 저장됨")
  })

  it("leaves storage unconfirmed without context or with an unreadable guest snapshot", () => {
    const view = render(<LatestJournalDay entries={[ENTRY]} today={TODAY} />)
    expect(screen.getByRole("button", { name: /기록 1개 보기/ })).toHaveAccessibleDescription("저장 범위 확인 필요")
    view.rerender(<LatestJournalDay entries={[ENTRY]} today={TODAY} storage={context({ readiness: "STALE" })} />)
    expect(screen.getByRole("button", { name: /기록 1개 보기/ })).toHaveAccessibleDescription("보관된 기록 · 계정 저장 미확인")
  })
})
