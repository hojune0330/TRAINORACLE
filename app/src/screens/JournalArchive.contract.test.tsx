import React from "react"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { JournalEntry } from "../domain/journal-schema"
import type { ArchiveSelection } from "../domain/journal-archive"
import { JournalArchive } from "./JournalArchive"
import { setActiveLocalAccount } from "../domain/account/local-journal-ownership"

const SECRET = "숨겨야 하는 개인 메모 원문"

const ENTRIES: readonly JournalEntry[] = [
  {
    id: "session-visible",
    kind: "post-session",
    date: "2026-07-10",
    savedAt: "2026-07-10T09:00:00.000Z",
    syncState: "local",
    system: "base",
    title: "제목도 요약에 쓰지 않음",
    distanceKm: "6",
    durationMin: "30",
    avgPace: "5:00",
    rpe: 4,
    memo: SECRET,
    memoPurpose: "PRIVATE_SELF_ONLY",
    fieldProvenance: {
      distanceKm: { provenance: "EXPLICIT" },
      durationMin: { provenance: "EXPLICIT" },
      avgPace: { provenance: "EXPLICIT" },
      rpe: { provenance: "EXPLICIT" },
    },
  },
  {
    id: "session-imported",
    kind: "post-session",
    date: "2026-07-11",
    savedAt: "2026-07-11T09:00:00.000Z",
    syncState: "local",
    system: "base",
    title: "가져온 기록",
    distanceKm: "10",
    durationMin: "50",
    avgPace: "",
    rpe: 0,
    memo: "",
    fieldProvenance: {
      distanceKm: {
        provenance: "DERIVED",
        derivedFrom: ["import:activity-file"],
        derivationRuleId: "IMPORT_ACTIVITY_FILE_V1",
      },
      durationMin: {
        provenance: "DERIVED",
        derivedFrom: ["import:activity-file"],
        derivationRuleId: "IMPORT_ACTIVITY_FILE_V1",
      },
      avgPace: { provenance: "MISSING" },
      rpe: { provenance: "MISSING" },
    },
  },
  {
    id: "session-private-only",
    kind: "post-session",
    date: "2026-07-10",
    savedAt: "2026-07-10T10:00:00.000Z",
    syncState: "local",
    system: "base",
    title: "",
    distanceKm: "",
    durationMin: "",
    avgPace: "",
    rpe: 0,
    memo: SECRET.repeat(20),
    memoPurpose: "PRIVATE_SELF_ONLY",
    fieldProvenance: {
      distanceKm: { provenance: "MISSING" },
      durationMin: { provenance: "MISSING" },
      avgPace: { provenance: "MISSING" },
      rpe: { provenance: "MISSING" },
    },
  },
]

beforeEach(() => {
  setActiveLocalAccount("test-reset"); setActiveLocalAccount(null)
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", "") }
})
afterEach(cleanup)

function ArchiveHarness() {
  const [selection, setSelection] = React.useState<ArchiveSelection>({
    selectedMonth: null,
    selectedWeekStart: null,
  })
  return (
    <JournalArchive
      entries={ENTRIES}
      selection={selection}
      onSelectionChange={setSelection}
      onOpenDay={vi.fn()}
      onBack={vi.fn()}
    />
  )
}

describe("journal archive surface", () => {
  it("offers the latest date only when the selected date or viewed month differs and focuses its date without opening a reader", () => {
    const onOpenDay = vi.fn()
    const onSelectionChange = vi.fn()
    render(<JournalArchive entries={ENTRIES} selection={{ selectedMonth: null, selectedWeekStart: null }}
      onSelectionChange={onSelectionChange} onOpenDay={onOpenDay} onBack={vi.fn()} />)
    const latestName = "최근 기록 날짜 2026년 7월 11일 토요일로 이동"
    expect(screen.queryByRole("button", { name: latestName })).toBeNull()
    expect(document.querySelector(".calendar-guidance-actions")).toBeNull()

    // Moving the month preserves the selected latest date, but still needs a way back.
    fireEvent.click(screen.getByRole("button", { name: "다음 달" }))
    expect(screen.getByRole("grid", { name: "2026년 8월 달력" })).toBeVisible()
    fireEvent.click(screen.getByRole("button", { name: latestName }))
    const latest = screen.getByRole("button", { name: /2026년 7월 11일.*훈련 후 1건/u })
    expect(latest).toHaveFocus()
    expect(latest).toHaveAttribute("data-selected", "true")
    expect(screen.queryByRole("button", { name: latestName })).toBeNull()
    expect(screen.queryByRole("dialog")).toBeNull()
    expect(onOpenDay).not.toHaveBeenCalled()
    expect(onSelectionChange).not.toHaveBeenCalled()

  })

  it("moves to a nearby or latest date within the same month and restores focus when the shortcut disappears", () => {
    const onOpenDay = vi.fn()
    render(<JournalArchive entries={ENTRIES} selection={{ selectedMonth: "2026-07", selectedWeekStart: null }}
      onSelectionChange={vi.fn()} onOpenDay={onOpenDay} onBack={vi.fn()} />)
    const latestName = "최근 기록 날짜 2026년 7월 11일 토요일로 이동"
    const nearestName = "가까운 기록 날짜 2026년 7월 10일 금요일로 이동"
    expect(screen.getByRole("button", { name: latestName })).toHaveTextContent("최근 날짜 · 07/11")
    fireEvent.click(screen.getByRole("button", { name: nearestName }))
    expect(screen.getByRole("button", { name: /2026년 7월 10일.*훈련 후 2건/u })).toHaveFocus()
    expect(screen.queryByRole("button", { name: nearestName })).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: latestName }))
    expect(screen.getByRole("button", { name: /2026년 7월 11일.*훈련 후 1건/u })).toHaveFocus()
    expect(screen.queryByRole("button", { name: latestName })).toBeNull()
    expect(screen.getByRole("grid", { name: "2026년 7월 달력" })).toBeVisible()
    expect(screen.queryByRole("dialog")).toBeNull()
    expect(onOpenDay).not.toHaveBeenCalled()
  })

  it("keeps future-only records distinct from a latest actual date", () => {
    const future = [{ ...ENTRIES[0]!, id: "future-only", date: "2099-07-10", savedAt: "2099-07-10T09:00:00.000Z" }]
    render(<JournalArchive entries={future} selection={{ selectedMonth: null, selectedWeekStart: null }}
      onSelectionChange={vi.fn()} onOpenDay={vi.fn()} onBack={vi.fn()} />)
    expect(screen.queryByRole("button", { name: /최근 기록 날짜/u })).toBeNull()
    expect(screen.getByText("미래 날짜의 기록이 있어요.")).toBeVisible()
    expect(screen.getByRole("button", { name: /가까운 기록 날짜/u })).toBeVisible()
  })

  it.each(["LOADING", "ERROR", "STALE"] as const)("names the body section refresh truthfully during %s without declaring no records", (readiness) => {
    const retry = vi.fn()
    const props = { selection: { selectedMonth: null, selectedWeekStart: null }, onSelectionChange: vi.fn(),
      onOpenDay: vi.fn(), onBack: vi.fn(), section: "BODY" as const, onSectionChange: vi.fn(), onRetry: retry }
    const view = render(<JournalArchive {...props} entries={[]} readiness={readiness} />)
    const status = screen.getByRole(readiness === "ERROR" ? "alert" : "status")
    expect(status).toHaveTextContent(/기록을/u)
    expect(status).not.toHaveTextContent("일지")
    expect(screen.queryByText("아직 몸 기록이 없어요")).toBeNull()
    expect(screen.queryByRole("grid")).toBeNull()
    if (readiness === "LOADING") expect(screen.queryByRole("button", { name: "몸 기록 다시 불러오기" })).toBeNull()
    else {
      fireEvent.click(screen.getByRole("button", { name: "몸 기록 다시 불러오기" }))
      expect(retry).toHaveBeenCalledOnce()
    }
    expect(screen.queryByRole("button", { name: "일지 다시 불러오기" })).toBeNull()

    view.rerender(<JournalArchive {...props} entries={ENTRIES} readiness={readiness} />)
    expect(screen.getByText(/저장된 기록을 보고 있어요/u)).toBeVisible()
    expect(screen.queryByText(/저장된 일지를 보고 있어요/u)).toBeNull()
  })

  it.each(["LOADING", "ERROR", "STALE"] as const)("does not render an empty calendar or example before %s resolves", (readiness) => {
    const retry = vi.fn()
    const back = vi.fn()
    render(<JournalArchive entries={[]} readiness={readiness} onRetry={retry}
      selection={{ selectedMonth: null, selectedWeekStart: null }} onSelectionChange={vi.fn()}
      onOpenDay={vi.fn()} onBack={back} />)
    expect(screen.getByRole(readiness === "ERROR" ? "alert" : "status")).toHaveTextContent(/확인하지 못|불러오지 못|불러오고 있어요/)
    expect(screen.queryByRole("grid")).toBeNull()
    expect(screen.queryByRole("radio", { name: "기록 묶음" })).toBeNull()
    expect(screen.queryByRole("button", { name: "내 달력" })).toBeNull()
    expect(screen.queryByText(/0개 기록|이날 작성한 일지가 없어요/)).toBeNull()
    if (readiness === "LOADING") expect(screen.queryByRole("button", { name: "일지 다시 불러오기" })).toBeNull()
    else {
      fireEvent.click(screen.getByRole("button", { name: "일지 다시 불러오기" }))
      expect(retry).toHaveBeenCalledOnce()
    }
    fireEvent.click(screen.getByRole("button", { name: "홈으로" }))
    expect(back).toHaveBeenCalledOnce()
  })

  it.each(["LOADING", "ERROR", "STALE"] as const)("retains known records with an explicit refresh state during %s", (readiness) => {
    render(<JournalArchive entries={ENTRIES} readiness={readiness}
      selection={{ selectedMonth: "2026-07", selectedWeekStart: null }} onSelectionChange={vi.fn()}
      onOpenDay={vi.fn()} onBack={vi.fn()} />)
    expect(screen.getByRole("grid", { name: "2026년 7월 달력" })).toBeVisible()
    expect(screen.getByRole("button", { name: /2026년 7월 10일.*훈련 후 2건/ })).toBeVisible()
    expect(screen.getByText(/저장된 일지를 보고 있어요/)).toBeVisible()
    expect(screen.queryByRole("button", { name: "내 달력" })).toBeNull()
  })

  it("opens the confirmed empty calendar first and hides it when refresh fails", () => {
    const props = { entries: [], selection: { selectedMonth: null, selectedWeekStart: null },
      onSelectionChange: vi.fn(), onOpenDay: vi.fn(), onBack: vi.fn() }
    const view = render(<JournalArchive {...props} readiness="LOADING" />)
    view.rerender(<JournalArchive {...props} readiness="READY" />)
    expect(screen.getByRole("grid")).toBeVisible()
    expect(screen.queryByText("예시 · 내 기록에 저장되지 않아요")).toBeNull()
    view.rerender(<JournalArchive {...props} readiness="ERROR" />)
    expect(screen.queryByRole("grid")).toBeNull()
    view.rerender(<JournalArchive {...props} readiness="ERROR" mode="CYCLE" />)
    expect(screen.queryByRole("grid")).toBeNull()
    expect(screen.queryByText(/0개 기록/)).toBeNull()
  })

  it("preserves an explicitly opened and labelled example without claiming it is the user's missing data", () => {
    const props = { entries: [], selection: { selectedMonth: null, selectedWeekStart: null },
      onSelectionChange: vi.fn(), onOpenDay: vi.fn(), onBack: vi.fn() }
    const view = render(<JournalArchive {...props} />)
    fireEvent.click(screen.getByRole("button", { name: "일지가 쌓인 예시 보기" }))
    view.rerender(<JournalArchive {...props} readiness="ERROR" />)
    expect(screen.getByRole("alert")).toHaveTextContent("일지를 불러오지 못했어요")
    expect(screen.getByText("예시 · 내 기록에 저장되지 않아요")).toBeVisible()
    expect(screen.getByRole("heading", { name: "일지가 쌓인 달력" })).toBeVisible()
    fireEvent.click(screen.getByRole("radio", { name: "기록 묶음" }))
    expect(screen.queryByRole("grid")).toBeNull()
    expect(screen.queryByText(/0개 기록/)).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "월간 달력으로" }))
    expect(screen.getByRole("heading", { name: "일지가 쌓인 달력" })).toBeVisible()
    fireEvent.click(screen.getByRole("button", { name: "내 달력" }))
    expect(screen.queryByRole("grid")).toBeNull()
  })

  it("keeps one neutral screen title and shows the example heading only after an explicit request", async () => {
    const user = userEvent.setup()
    const { container } = render(<JournalArchive entries={[]} selection={{ selectedMonth: null, selectedWeekStart: null }}
      onSelectionChange={vi.fn()} onOpenDay={vi.fn()} onBack={vi.fn()} />)
    const title = screen.getByRole("heading", { name: "지난 일지", level: 1 })
    expect(title).toHaveClass("app-heading", "app-heading--screen")
    expect(container.querySelectorAll(".app-heading--accent")).toHaveLength(0)
    expect(screen.queryByRole("heading", { name: "첫 일지를 남겨보세요" })).toBeNull()
    expect(screen.queryByText("예시 · 내 기록에 저장되지 않아요")).toBeNull()

    await user.click(screen.getByRole("button", { name: "일지가 쌓인 예시 보기" }))
    const expandedTitle = screen.getByRole("heading", { name: "일지가 쌓인 달력", level: 2 })
    expect(expandedTitle).toHaveClass("app-heading--section")
    expect(expandedTitle).not.toHaveClass("app-heading--accent")
    expect(container.querySelectorAll(".app-heading--accent")).toHaveLength(0)
  })

  it("separates content selection, the writing entry, and same-screen archive views", async () => {
    const user = userEvent.setup()
    const onWriteLog = vi.fn()
    render(<JournalArchive entries={ENTRIES} selection={{ selectedMonth: null, selectedWeekStart: null }}
      onSelectionChange={vi.fn()} onOpenDay={vi.fn()} onBack={vi.fn()} onWriteLog={onWriteLog} />)

    const contentChoices = screen.getByRole("group", { name: "일지와 몸 기록" })
    expect(contentChoices.querySelectorAll(".category-choice__check")).toHaveLength(0)
    expect(screen.getByRole("button", { name: "일지" })).toHaveAttribute("aria-pressed", "true")
    expect(screen.getByRole("button", { name: "몸 기록" })).toHaveAttribute("aria-pressed", "false")
    expect(screen.getByRole("radiogroup", { name: "일지 보기 방식" })).toBeVisible()
    expect(screen.getByRole("radio", { name: "월간 달력" })).toHaveAttribute("data-state", "checked")
    expect(screen.getByRole("radio", { name: "월간 달력" })).toHaveTextContent("달력")
    expect(screen.getByRole("radio", { name: "월간 달력" })).not.toHaveTextContent("월간")
    expect(screen.getByRole("radio", { name: "기록 묶음" })).toHaveTextContent("묶음")
    expect(screen.getByRole("button", { name: "새 일지 작성" })).toBeVisible()

    await user.click(screen.getByRole("radio", { name: "기록 묶음" }))
    expect(screen.getByRole("radio", { name: "기록 묶음" })).toHaveAttribute("data-state", "checked")
    expect(screen.queryByRole("button", { name: "새 일지 작성" })).toBeNull()
    await user.click(screen.getByRole("button", { name: "월간 달력으로" }))
    await user.click(screen.getByRole("button", { name: "새 일지 작성" }))
    expect(onWriteLog).toHaveBeenCalledOnce()
  })

  it("shows the optional small image only beside the confirmed-empty example action and recovers from image failure", () => {
    const props = { entries: [], selection: { selectedMonth: null, selectedWeekStart: null },
      onSelectionChange: vi.fn(), onOpenDay: vi.fn(), onBack: vi.fn() }
    const view = render(<JournalArchive {...props} readiness="READY" />)
    const illustration = () => view.container.querySelector('img[src$="illustrations/journal-empty-v1.png"]')
    expect(illustration()).toHaveAttribute("alt", "")
    expect(illustration()).toHaveAttribute("width", "64")
    expect(illustration()).toHaveAttribute("height", "64")
    expect(screen.getByRole("button", { name: "일지가 쌓인 예시 보기" })).toBeVisible()

    for (const readiness of ["LOADING", "ERROR", "STALE"] as const) {
      view.rerender(<JournalArchive {...props} readiness={readiness} />)
      expect(illustration()).toBeNull()
    }
    view.rerender(<JournalArchive {...props} entries={ENTRIES} readiness="READY" />)
    expect(illustration()).toBeNull()
    view.rerender(<JournalArchive {...props} readiness="READY" />)
    fireEvent.error(illustration()!)
    expect(illustration()).toBeNull()
    expect(screen.getByRole("grid")).toBeVisible()
    expect(screen.getByRole("button", { name: "일지가 쌓인 예시 보기" })).toBeVisible()
  })

  it("keeps an opened example explicit but removes its empty illustration until emptiness is confirmed", async () => {
    const user = userEvent.setup()
    const props = {
      selection: { selectedMonth: null, selectedWeekStart: null },
      onSelectionChange: vi.fn(),
      onOpenDay: vi.fn(),
      onBack: vi.fn(),
    }
    const { container, rerender } = render(<JournalArchive {...props} entries={[]} readiness="READY" />)
    const illustration = () => container.querySelector('img[src$="journal-empty-illustration.webp"]')

    expect(illustration()).toBeNull()
    expect(screen.queryByText("예시 · 내 기록에 저장되지 않아요")).toBeNull()
    await user.click(screen.getByRole("button", { name: "일지가 쌓인 예시 보기" }))
    expect(illustration()).toHaveAttribute("width", "64")
    expect(illustration()).toHaveAttribute("height", "64")
    expect(screen.getByRole("heading", { name: "일지가 쌓인 달력" })).toBeVisible()

    for (const { readiness, message } of [
      { readiness: "LOADING", message: "일지를 불러오고 있어요." },
      { readiness: "STALE", message: "최신 일지를 아직 확인하지 못했어요. 기록이 없는 상태로 표시하지 않아요." },
      { readiness: "ERROR", message: "일지를 불러오지 못했어요. 기록이 없는 것은 아니에요." },
    ] as const) {
      rerender(<JournalArchive {...props} entries={[]} readiness={readiness} />)
      expect(illustration()).toBeNull()
      expect(screen.getByText(message)).toBeVisible()
      expect(screen.getByText("예시 · 내 기록에 저장되지 않아요")).toBeVisible()
      expect(screen.getByRole("heading", { name: "일지가 쌓인 달력" })).toBeVisible()
      expect(screen.getByRole("grid")).toBeVisible()
    }

    rerender(<JournalArchive {...props} entries={ENTRIES} readiness="READY" />)
    expect(illustration()).toBeNull()
    expect(screen.getByText("내 기록도 도착했어요.")).toBeVisible()
    expect(screen.getByText("예시 · 내 기록에 저장되지 않아요")).toBeVisible()
    expect(screen.getByRole("grid")).toBeVisible()
    expect(props.onOpenDay).not.toHaveBeenCalled()
  })

  it("shows the real calendar first and keeps the fictional example optional", async () => {
    const user = userEvent.setup()
    const onSelectionChange = vi.fn()
    const onOpenDay = vi.fn()
    const now = new Date()
    render(<JournalArchive entries={[]} selection={{ selectedMonth: null, selectedWeekStart: null }}
      onSelectionChange={onSelectionChange} onOpenDay={onOpenDay} onBack={vi.fn()} />)
    expect(screen.getByRole("grid", { name: `${now.getFullYear()}년 ${now.getMonth() + 1}월 달력` })).toBeVisible()
    expect(screen.queryByText("예시 · 내 기록에 저장되지 않아요")).toBeNull()
    await user.click(screen.getByRole("button", { name: "일지가 쌓인 예시 보기" }))
    expect(screen.getByRole("heading", { name: "일지가 쌓인 달력" })).toBeVisible()
    await user.click(screen.getByRole("button", { name: "내 달력" }))
    expect(screen.getByRole("grid", { name: `${now.getFullYear()}년 ${now.getMonth() + 1}월 달력` })).toBeVisible()
    await user.click(screen.getByRole("button", { name: "오늘" }))
    expect(onOpenDay).not.toHaveBeenCalled()
    expect(screen.queryByRole("status")).toBeNull()
    await user.click(screen.getByRole("button", { name: "다음 달" }))
    expect(onSelectionChange).not.toHaveBeenCalled()
  })

  it("drills from month to week to day without exposing private text", async () => {
    const user = userEvent.setup()
    const onOpenDay = vi.fn()
    let selection: ArchiveSelection = {
      selectedMonth: null,
      selectedWeekStart: null,
    }
    const { rerender } = render(
      <JournalArchive
        entries={ENTRIES}
        selection={selection}
        onSelectionChange={(next) => {
          selection = next
        }}
        onOpenDay={onOpenDay}
        onBack={vi.fn()}
      />,
    )

    expect(screen.queryByText(SECRET)).toBeNull()
    expect(document.body.textContent).not.toContain(SECRET)
    expect(screen.getByText("출처를 확인할 수 없어 제외된 기록 1건")).not.toBeVisible()
    await user.click(screen.getByRole("button", { name: "다른 달 찾기" }))
    expect(screen.getByText("출처를 확인할 수 없어 제외된 기록 1건")).toBeVisible()

    await user.click(screen.getByRole("button", { name: /^2026년 7월 훈련 후/u }))
    rerender(
      <JournalArchive
        entries={ENTRIES}
        selection={selection}
        onSelectionChange={(next) => {
          selection = next
        }}
        onOpenDay={onOpenDay}
        onBack={vi.fn()}
      />,
    )

    expect(screen.getByRole("grid", { name: "2026년 7월 달력" })).toBeVisible()
    expect(screen.getByRole("region", { name: "날짜별 일지" })).toBeVisible()
    const day = screen.getByRole("button", { name: /2026년 7월 10일.*훈련 후 2건/u })
    expect(day).not.toHaveAccessibleName(expect.stringContaining(SECRET))
    await user.click(day)
    expect(screen.getByRole("dialog")).toBeVisible()
    expect(document.body.textContent).not.toContain(SECRET)
    expect(onOpenDay).not.toHaveBeenCalled()
    await user.click(screen.getByRole("button", { name: "일지·메모 원문 열기" }))
    expect(onOpenDay).toHaveBeenCalledWith("2026-07-10", "session-visible",
      expect.objectContaining({ date: "2026-07-10", entryId: "session-visible", scroll: expect.any(Number) }))
  })

  it("keeps controlled month and week selection when the archive remounts", () => {
    const { unmount } = render(<ArchiveHarness />)
    unmount()

    render(
      <JournalArchive
        entries={ENTRIES}
        selection={{ selectedMonth: "2026-07", selectedWeekStart: "2026-07-06" }}
        onSelectionChange={vi.fn()}
        onOpenDay={vi.fn()}
        onBack={vi.fn()}
      />,
    )

    expect(screen.getByRole("heading", { name: "7월 6일–12일" })).toBeVisible()
    expect(screen.getByRole("button", { name: /2026년 7월 10일/u })).toBeVisible()
  })

  it("switches to an explicit 9.5-day view without exposing private memo text", async () => {
    const user = userEvent.setup()
    render(
      <JournalArchive
        entries={ENTRIES}
        selection={{ selectedMonth: null, selectedWeekStart: null }}
        onSelectionChange={vi.fn()}
        onOpenDay={vi.fn()}
        onBack={vi.fn()}
      />,
    )

    await user.click(screen.getByRole("radio", { name: "기록 묶음" }))
    await user.click(screen.getByText("주기 시작일과 표시 기준"))
    fireEvent.change(screen.getByLabelText("주기 시작일"), { target: { value: "2026-07-10" } })

    expect(screen.getAllByText(/10일 구간/u)).toHaveLength(1)
    expect(screen.getByRole("button", { name: /2026년 7월 10일/u })).toBeVisible()
    expect(document.body.textContent).not.toContain(SECRET)
    expect(screen.getByText(/계획을 자동으로 바꾸지 않아요/u)).toBeVisible()
    expect(screen.getByText(/처방이나 정답 주기가 아니에요/u)).toBeVisible()
    expect(screen.getByRole("button", { name: "월간 달력으로" })).toBeVisible()
    await user.click(screen.getByRole("button", { name: "다음 달" }))
    expect(screen.queryByText(/0일 · 0개 기록/)).toBeNull()
    await user.click(screen.getByRole("button", { name: "선택한 주기로 이동" }))
    expect(screen.getByRole("grid", { name: "2026년 7월 달력" })).toBeVisible()
  })

  it("keeps cycle-origin record identity without passing a monthly reopen context", async () => {
    const user = userEvent.setup()
    const onOpenDay = vi.fn()
    render(<JournalArchive entries={ENTRIES} mode="CYCLE" cycleAnchor="2026-07-10" cycleIndex={0}
      selection={{ selectedMonth: null, selectedWeekStart: null }}
      onSelectionChange={vi.fn()} onOpenDay={onOpenDay} onBack={vi.fn()} />)

    await user.click(screen.getByRole("button", { name: /2026년 7월 10일/u }))
    const choices = screen.getAllByRole("button", { name: /^시간대 미기록 · 훈련 기록/u })
    expect(choices).toHaveLength(2)
    await user.click(choices[1]!)
    await user.click(screen.getByRole("button", { name: "일지·메모 원문 열기" }))

    expect(onOpenDay).toHaveBeenCalledExactlyOnceWith("2026-07-10", "session-private-only")
  })

  it("offers date-specific writing on an empty past day without silently selecting today", async () => {
    const user = userEvent.setup()
    const write = vi.fn()
    render(<JournalArchive entries={[]} selection={{ selectedMonth: "2025-07", selectedWeekStart: null }}
      onSelectionChange={vi.fn()} onOpenDay={vi.fn()} onBack={vi.fn()} onWriteDate={write} />)
    await user.click(screen.getByRole("button", { name: /2025년 7월 10일 목요일/ }))
    expect(write).not.toHaveBeenCalled()
    expect(screen.queryByText("이날 작성한 일지가 없어요.")).toBeNull()
    expect(screen.queryByRole("heading", { name: "이날 남긴 기록" })).toBeNull()
    await user.click(screen.getByRole("button", { name: "이날 일지 쓰기" }))
    expect(write).toHaveBeenCalledExactlyOnceWith("2025-07-10")
  })
})

it("keeps the month list's accessible label without repeating it as visible copy", async () => {
  const user = userEvent.setup()
  render(<JournalArchive entries={ENTRIES} selection={{ selectedMonth: null, selectedWeekStart: null }}
    onSelectionChange={vi.fn()} onOpenDay={vi.fn()} onBack={vi.fn()} />)
  expect(screen.queryByText("월별 기록")).toBeNull()
  await user.click(screen.getByRole("button", { name: "다른 달 찾기" }))
  expect(screen.getByRole("region", { name: "월별 기록" })).toBeVisible()
})
