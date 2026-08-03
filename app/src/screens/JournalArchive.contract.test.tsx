import React from "react"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { JournalEntry } from "../domain/journal-schema"
import type { ArchiveSelection } from "../domain/journal-archive"
import { JournalArchive } from "./JournalArchive"

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
    expect(screen.getByText("출처를 확인할 수 없어 제외된 기록 1건")).toBeVisible()

    await user.click(screen.getByRole("button", { name: /2026년 7월/u }))
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
    await user.click(screen.getByRole("button", { name: /7월 6일.*7월 12일/u }))
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

    const day = screen.getByRole("button", { name: /2026년 7월 10일.*훈련 후 2건.*6 km.*30분/u })
    expect(day).not.toHaveAccessibleName(expect.stringContaining(SECRET))
    await user.click(day)
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

    await user.click(screen.getByRole("button", { name: "9.5일 주기" }))
    fireEvent.change(screen.getByLabelText("주기 시작일"), { target: { value: "2026-07-10" } })

    expect(screen.getAllByText(/10일 구간/u)).toHaveLength(2)
    expect(screen.getByRole("button", { name: /2026년 7월 10일/u })).toBeVisible()
    expect(document.body.textContent).not.toContain(SECRET)
    expect(screen.getByText(/계획을 자동으로 바꾸지 않아요/u)).toBeVisible()
    expect(screen.getByText(/처방이나 정답 주기가 아니에요/u)).toBeVisible()
  })
})
