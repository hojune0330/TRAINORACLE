import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { JournalEntry } from "../domain/journal-schema"
import { CalendarJournalBadge, CalendarJournalDetails, calendarJournalDescription } from "./CalendarJournalDetails"

afterEach(cleanup)
const date = "2026-09-27"
const session: JournalEntry = {
  id: "synthetic-session", kind: "post-session", date, savedAt: date + "T02:00:00Z", syncState: "local",
  system: "base", title: "PRIVATE TITLE", memo: "PRIVATE MEMO", memoPurpose: "PRIVATE_SELF_ONLY",
  distanceKm: "8", durationMin: "40", avgPace: "", rpe: 0,
  fieldProvenance: { distanceKm: { provenance: "EXPLICIT" }, durationMin: { provenance: "EXPLICIT" }, rpe: { provenance: "MISSING" } },
}
const evening: JournalEntry = {
  id: "synthetic-evening", kind: "evening", date, savedAt: date + "T13:00:00Z", syncState: "local",
  sleepH: 7.5, sleepQuality: 0, weightKg: "61.2", restingHr: "", painParts: { rKnee: 2 },
  mood: 0, note: "PRIVATE NOTE", memoPurpose: "PRIVATE_SELF_ONLY",
  fieldProvenance: { sleepH: { provenance: "EXPLICIT" }, weightKg: { provenance: "EXPLICIT" },
    painParts: { provenance: "EXPLICIT" }, mood: { provenance: "MISSING" } },
}

describe("calendar structured actual records", () => {
  it("does not offer a performed journal for a future empty date", () => {
    const write = vi.fn()
    render(<CalendarJournalDetails date="2099-01-01" entries={[]} onWriteDate={write} />)
    expect(screen.queryByRole("button", { name: "이날 일지 쓰기" })).toBeNull()
    expect(write).not.toHaveBeenCalled()
  })
  it("shows actual health and exercise facts separately from the plan, without private text", () => {
    render(<CalendarJournalDetails date={date} entries={[session, evening]} />)
    expect(screen.getByText("61.2 kg")).toBeVisible()
    expect(screen.getByText("7.5시간")).toBeVisible()
    expect(screen.getByText("오른 무릎 2/5")).toBeVisible()
    expect(screen.getByText("8 km")).toBeVisible()
    expect(screen.getByText("시간대 미기록 · 훈련 기록")).toBeVisible()
    expect(screen.queryByText("오전 · 훈련 기록")).not.toBeInTheDocument()
    expect(screen.queryByText("기분")).not.toBeInTheDocument()
    expect(screen.queryByText("체감 강도")).not.toBeInTheDocument()
    expect(document.body.textContent).not.toContain("PRIVATE")
  })

  it("excludes explicit MISSING fields even when stale nonzero values remain", () => {
    render(<CalendarJournalDetails date={date} entries={[{ ...evening, weightKg: "88", sleepH: 9,
      fieldProvenance: { weightKg: { provenance: "MISSING" }, sleepH: { provenance: "MISSING" }, painParts: { provenance: "MISSING" } } }]} />)
    expect(screen.queryByText("체중")).not.toBeInTheDocument()
    expect(screen.queryByText("수면")).not.toBeInTheDocument()
    expect(screen.queryByText("통증 기록")).not.toBeInTheDocument()
  })

  it("distinguishes the recorded pain answer from an unanswered check, never calling it clearance", () => {
    const { rerender } = render(<CalendarJournalDetails date={date} entries={[{ ...session, painCheckStatus: "NO_SIGNAL_REPORTED",
      fieldProvenance: { painCheckStatus: { provenance: "EXPLICIT" } } }]} />)
    expect(screen.getByText("통증을 느끼지 않았다고 기록했어요")).toBeVisible()
    expect(document.body.textContent).not.toContain("안전")
    rerender(<CalendarJournalDetails date={date} entries={[{ ...session, painCheckStatus: "UNANSWERED" }]} />)
    expect(screen.getByText(/통증 질문에 답하지 않았어요/)).toBeVisible()
    expect(screen.queryByText(/통증을 느끼지 않았다고/)).not.toBeInTheDocument()
    rerender(<CalendarJournalDetails date={date} entries={[{ ...session, painCheckStatus: "NO_SIGNAL_REPORTED",
      fieldProvenance: { painCheckStatus: { provenance: "MISSING" } } }]} />)
    expect(screen.queryByText(/통증을 느끼지 않았다고/)).not.toBeInTheDocument()
  })

  it("applies missing-field rules to race results as well as health fields", () => {
    render(<CalendarJournalDetails date={date} entries={[{ id: "r", kind: "race", date, savedAt: date, syncState: "local",
      stage: "post", record: "4:05.5", rank: "3", result: "", memo: "",
      fieldProvenance: { record: { provenance: "MISSING" }, rank: { provenance: "MISSING" } } }]} />)
    expect(screen.queryByText("4:05.5")).not.toBeInTheDocument()
    expect(screen.queryByText("순위")).not.toBeInTheDocument()
  })

  it("never inspects raw memo or title to make a calendar badge or summary", () => {
    const guarded = { ...session }
    Object.defineProperties(guarded, {
      memo: { get() { throw Error("memo must not be read") } },
      title: { get() { throw Error("title must not be read") } },
    })
    expect(calendarJournalDescription([guarded], date)).toBe("일지 1개 · 훈련")
    render(<><CalendarJournalBadge entries={[guarded]} date={date} /><CalendarJournalDetails entries={[guarded]} date={date} /></>)
    expect(screen.getByText("일지")).toBeVisible()
    expect(document.querySelector('.calendar-training-mark')).toHaveAttribute("data-tone", "unknown")
    expect(screen.getByText("8 km")).toBeVisible()
  })

  it("opens the existing original reader only through an explicit action", () => {
    const open = vi.fn()
    render(<CalendarJournalDetails date={date} entries={[session]} onOpenDay={open} />)
    expect(open).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole("button", { name: "일지·메모 원문 열기" }))
    expect(open).toHaveBeenCalledExactlyOnceWith(date)
  })

  it("keeps intervals and weights as components, without inventing distance or total load", () => {
    render(<CalendarJournalDetails date={date} entries={[{ ...session, activitySlot: "PM", exerciseLog: {
      version: 1, source: "SELF_REPORTED", components: [
        { id: "a", kind: "INTERVALS", name: "PRIVATE LABEL", rows: [{ id: "a1", distanceM: 400, repetitions: 6, sets: 2, recovery: { kind: "TIMED", seconds: 60 }, setRecovery: { kind: "TIMED", seconds: 180 } }] },
        { id: "b", kind: "STRENGTH", name: "", rows: [{ id: "b1", loadKg: 30, repetitions: 8, sets: 3 }] },
      ],
    } }]} />)
    expect(screen.getByText("오후 · 훈련 기록")).toBeVisible()
    expect(screen.getByText("400m · 6회 × 2세트 · 반복 사이 60초 · 세트 사이 180초")).toBeVisible()
    expect(screen.getByText("30kg · 8회 × 3세트")).toBeVisible()
    expect(document.body.textContent).not.toContain("PRIVATE")
  })

  it("shows a race on its own date and does not label absence as zero", () => {
    const race: JournalEntry = { id: "r", kind: "race", date, savedAt: date, syncState: "local",
      stage: "post", record: "4:05.5", rank: "3", result: "PRIVATE RESULT", memo: "PRIVATE MEMO", memoPurpose: "PRIVATE_SELF_ONLY" }
    const { rerender } = render(<><CalendarJournalBadge entries={[race]} date={date} /><CalendarJournalDetails entries={[race]} date={date} /></>)
    expect(document.querySelector('.calendar-training-mark')).toHaveTextContent("일지경기 결과")
    expect(document.querySelector('.calendar-training-mark')).toHaveAttribute("data-tone", "race")
    expect(screen.getByText("4:05.5 · 입력 출처 미확인")).toBeVisible()
    expect(document.body.textContent).not.toContain("PRIVATE")
    rerender(<CalendarJournalDetails entries={[race]} date="2026-09-28" />)
    expect(screen.getByText("이날 작성한 일지가 없어요.")).toBeVisible()
    expect(screen.queryByText("0 km")).not.toBeInTheDocument()
  })
})
