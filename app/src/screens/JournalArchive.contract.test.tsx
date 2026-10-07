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
  it.each(["LOADING", "ERROR", "STALE"] as const)("does not render an empty calendar or example before %s resolves", (readiness) => {
    const retry = vi.fn()
    const back = vi.fn()
    render(<JournalArchive entries={[]} readiness={readiness} onRetry={retry}
      selection={{ selectedMonth: null, selectedWeekStart: null }} onSelectionChange={vi.fn()}
      onOpenDay={vi.fn()} onBack={back} />)
    expect(screen.getByRole(readiness === "ERROR" ? "alert" : "status")).toHaveTextContent(/확인하지 못|불러오지 못|불러오고 있어요/)
    expect(screen.queryByRole("grid")).toBeNull()
    expect(screen.queryByRole("button", { name: "기록 묶음" })).toBeNull()
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

  it("only shows the empty example after a successful read and removes it during a failed refresh", () => {
    const props = { entries: [], selection: { selectedMonth: null, selectedWeekStart: null },
      onSelectionChange: vi.fn(), onOpenDay: vi.fn(), onBack: vi.fn() }
    const view = render(<JournalArchive {...props} readiness="LOADING" />)
    view.rerender(<JournalArchive {...props} readiness="READY" />)
    expect(screen.getByRole("button", { name: "내 달력" })).toBeVisible()
    fireEvent.click(screen.getByRole("button", { name: "내 달력" }))
    expect(screen.getByRole("grid")).toBeVisible()
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
    fireEvent.click(screen.getByRole("button", { name: "예시 둘러보기" }))
    view.rerender(<JournalArchive {...props} readiness="ERROR" />)
    expect(screen.getByRole("alert")).toHaveTextContent("일지를 불러오지 못했어요")
    expect(screen.getByText("예시 · 내 기록에 저장되지 않아요")).toBeVisible()
    expect(screen.getByRole("heading", { name: "일지가 쌓인 달력" })).toBeVisible()
    fireEvent.click(screen.getByRole("button", { name: "기록 묶음" }))
    expect(screen.queryByRole("grid")).toBeNull()
    expect(screen.queryByText(/0개 기록/)).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "월간 달력으로" }))
    expect(screen.getByRole("heading", { name: "일지가 쌓인 달력" })).toBeVisible()
    fireEvent.click(screen.getByRole("button", { name: "내 달력" }))
    expect(screen.queryByRole("grid")).toBeNull()
  })

  it("offers a separate example before the empty real calendar", async () => {
    const user = userEvent.setup()
    const onSelectionChange = vi.fn()
    const onOpenDay = vi.fn()
    const now = new Date()
    render(<JournalArchive entries={[]} selection={{ selectedMonth: null, selectedWeekStart: null }}
      onSelectionChange={onSelectionChange} onOpenDay={onOpenDay} onBack={vi.fn()} />)
    expect(screen.queryByRole("grid")).toBeNull()
    await user.click(screen.getByRole("button", { name: "내 달력" }))
    expect(screen.getByRole("grid", { name: `${now.getFullYear()}년 ${now.getMonth() + 1}월 달력` })).toBeVisible()
    await user.click(screen.getByRole("button", { name: "오늘" }))
    expect(onOpenDay).not.toHaveBeenCalled()
    expect(screen.getByRole("status")).toHaveTextContent("이날 작성한 일지가 없어요")
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
    await user.click(screen.getByText("월별 기록 모아보기"))
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
    expect(screen.getByText("날짜별 일지")).toBeVisible()
    const day = screen.getByRole("button", { name: /2026년 7월 10일.*훈련 후 2건/u })
    expect(day).not.toHaveAccessibleName(expect.stringContaining(SECRET))
    await user.click(day)
    expect(screen.getByRole("dialog")).toBeVisible()
    expect(document.body.textContent).not.toContain(SECRET)
    expect(onOpenDay).not.toHaveBeenCalled()
    await user.click(screen.getByRole("button", { name: "일지·메모 원문 열기" }))
    expect(onOpenDay).toHaveBeenCalledWith("2026-07-10")
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

    await user.click(screen.getByRole("button", { name: "기록 묶음" }))
    await user.click(screen.getByText("주기 시작일과 표시 기준"))
    fireEvent.change(screen.getByLabelText("주기 시작일"), { target: { value: "2026-07-10" } })

    expect(screen.getAllByText(/10일 구간/u)).toHaveLength(1)
    expect(screen.getByRole("button", { name: /2026년 7월 10일/u })).toBeVisible()
    expect(document.body.textContent).not.toContain(SECRET)
    expect(screen.getByText(/계획을 자동으로 바꾸지 않아요/u)).toBeVisible()
    expect(screen.getByText(/처방이나 정답 주기가 아니에요/u)).toBeVisible()
    expect(screen.getByRole("button", { name: "월간 달력으로" })).toBeVisible()
    await user.click(screen.getByRole("button", { name: "다음 달" }))
    expect(screen.getByText(/이 달 0일 · 0개 기록/)).toBeVisible()
    await user.click(screen.getByRole("button", { name: "선택한 주기로 이동" }))
    expect(screen.getByRole("grid", { name: "2026년 7월 달력" })).toBeVisible()
  })

  it("offers date-specific writing on an empty past day without silently selecting today", async () => {
    const user = userEvent.setup()
    const write = vi.fn()
    render(<JournalArchive entries={[]} selection={{ selectedMonth: "2025-07", selectedWeekStart: null }}
      onSelectionChange={vi.fn()} onOpenDay={vi.fn()} onBack={vi.fn()} onWriteDate={write} />)
    await user.click(screen.getByRole("button", { name: "내 달력" }))
    await user.click(screen.getByRole("button", { name: /2025년 7월 10일 목요일/ }))
    expect(write).not.toHaveBeenCalled()
    await user.click(screen.getByRole("button", { name: "이날 일지 쓰기" }))
    expect(write).toHaveBeenCalledExactlyOnceWith("2025-07-10")
  })
})
