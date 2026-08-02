// 휴지통 화면 + 안전 백업 누락 안내 계약 테스트.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { TrashBin } from "./TrashBin"
import { SafeJournalExport } from "./DeviceJournal"
import { MEMO_PURPOSE } from "../../domain/journal-schema"
import type { JournalEntry } from "../../domain/journal-schema"
import { deleteEntry, loadEntries, saveEntry } from "../../domain/journal-store"
import { TRASH_RETENTION_DAYS, loadTrash, moveToTrash } from "../../domain/journal-trash"

function session(id: string, overrides: Partial<JournalEntry> = {}): JournalEntry {
  return {
    id,
    kind: "post-session",
    date: "2026-07-20",
    savedAt: "2026-07-20T09:00:00.000Z",
    syncState: "local",
    system: "base",
    title: "가벼운 조깅",
    distanceKm: "8",
    durationMin: "45",
    avgPace: "5:30",
    rpe: 4,
    memo: "종아리가 뻐근",
    memoPurpose: MEMO_PURPOSE.analyzableTrainingNote,
    ...overrides,
  } as JournalEntry
}

/** 수치 없이 메모만 — 안전 백업에서 빠지는 종류 */
function memoOnly(id: string): JournalEntry {
  return session(id, {
    title: "", distanceKm: "", durationMin: "", avgPace: "", rpe: 0,
    memo: "마음이 무거웠다",
  } as Partial<JournalEntry>)
}

function store(entry: JournalEntry): void {
  const saved = saveEntry(entry)
  if (!saved.ok) throw new Error(`fixture rejected by schema: ${entry.id}`)
}

beforeEach(() => {
  window.localStorage.clear()
})

afterEach(() => {
  cleanup()
  window.localStorage.clear()
})

describe("휴지통 화면", () => {
  it("휴지통이 비어 있으면 아무것도 렌더하지 않는다", () => {
    render(<TrashBin />)
    expect(screen.queryByTestId("trash-bin")).toBeNull()
  })

  it("지운 일지가 있으면 목록을 보여준다", () => {
    store(session("a"))
    deleteEntry("a")
    render(<TrashBin />)
    expect(screen.getByTestId("trash-bin")).toBeInTheDocument()
    expect(screen.getAllByTestId("trash-item")).toHaveLength(1)
    expect(screen.getByText(/가벼운 조깅/u)).toBeInTheDocument()
  })

  it("보관 기간을 사실대로 안내한다", () => {
    store(session("a"))
    deleteEntry("a")
    render(<TrashBin />)
    // "30일" 문자열은 설명문과 남은일수 배지 두 곳에 나온다 — 설명문을 특정한다
    expect(screen.getByText(new RegExp(`지운 일지는 ${TRASH_RETENTION_DAYS}일 동안`, "u"))).toBeInTheDocument()
  })

  it("남은 일수를 숫자로 보여준다", () => {
    moveToTrash(session("a"), new Date().toISOString())
    render(<TrashBin />)
    expect(screen.getByTestId("trash-days-left").textContent).toContain(`${TRASH_RETENTION_DAYS}일 남음`)
  })

  it("메모 원문은 휴지통 목록에 표시하지 않는다", () => {
    store(session("a", { memo: "아주사적인메모내용" } as Partial<JournalEntry>))
    deleteEntry("a")
    render(<TrashBin />)
    expect(screen.queryByText(/아주사적인메모내용/u)).toBeNull()
  })

  it("되돌리기를 누르면 일지가 돌아오고 목록에서 사라진다", async () => {
    const user = userEvent.setup()
    store(session("a"))
    deleteEntry("a")
    expect(loadEntries()).toHaveLength(0)

    render(<TrashBin />)
    await user.click(screen.getByTestId("trash-restore"))

    expect(loadEntries()).toHaveLength(1)
    expect(loadTrash()).toHaveLength(0)
    expect(screen.queryByTestId("trash-bin")).toBeNull()
  })

  it("완전히 지우기는 확인을 한 번 더 받는다", async () => {
    const user = userEvent.setup()
    store(session("a"))
    deleteEntry("a")

    render(<TrashBin />)
    await user.click(screen.getByTestId("trash-purge"))
    // 확인 단계가 떠야 한다 — 한 번 누르고 바로 사라지면 안 된다
    expect(screen.getByTestId("trash-purge-confirm")).toBeInTheDocument()
    expect(screen.getByTestId("trash-purge-confirm")).toHaveFocus()
    expect(loadTrash()).toHaveLength(1)

    await user.click(screen.getByTestId("trash-purge-confirm"))
    expect(loadTrash()).toHaveLength(0)
  })

  it("완전 삭제 확인을 취소하면 아무것도 지워지지 않는다", async () => {
    const user = userEvent.setup()
    store(session("a"))
    deleteEntry("a")

    render(<TrashBin />)
    await user.click(screen.getByTestId("trash-purge"))
    await user.click(screen.getByTestId("trash-purge-cancel"))
    expect(loadTrash()).toHaveLength(1)
    expect(screen.queryByTestId("trash-purge-confirm")).toBeNull()
    await waitFor(() => expect(screen.getByTestId("trash-purge")).toHaveFocus())
  })

  it("완전히 지우면 되돌릴 수 없다고 말한다", async () => {
    const user = userEvent.setup()
    store(session("a"))
    deleteEntry("a")
    render(<TrashBin />)
    await user.click(screen.getByTestId("trash-purge"))
    expect(screen.getByText(/되돌릴 수 없어요/u)).toBeInTheDocument()
  })
})

describe("안전 백업 누락 안내 (F-3)", () => {
  it("빠지는 일지가 없으면 안내를 띄우지 않는다", () => {
    store(session("a"))
    render(<SafeJournalExport />)
    expect(screen.queryByTestId("safe-export-skipped")).toBeNull()
  })

  it("메모만 있는 일지가 있으면 개수를 알려준다", () => {
    store(session("a"))
    store(memoOnly("m1"))
    store(memoOnly("m2"))
    render(<SafeJournalExport />)
    const notice = screen.getByTestId("safe-export-skipped")
    expect(notice.textContent).toContain("2개")
    expect(notice.textContent).toContain("들어가지 않아요")
  })

  it("전부 남기는 방법(메모 포함 파일)을 같은 자리에서 안내한다", () => {
    store(memoOnly("m1"))
    render(<SafeJournalExport />)
    expect(screen.getByTestId("safe-export-skipped").textContent).toContain("메모 포함 파일 내보내기")
  })

  it("포함/전체 개수를 함께 보여준다 — 숫자가 실제와 맞는다", () => {
    store(session("a"))
    store(session("b"))
    store(memoOnly("m1"))
    render(<SafeJournalExport />)
    const text = screen.getByTestId("safe-export-skipped").textContent ?? ""
    expect(text).toContain("2개 포함")
    expect(text).toContain("전체 3개")
  })

  it("일지가 하나도 없으면 안내를 띄우지 않는다", () => {
    render(<SafeJournalExport />)
    expect(screen.queryByTestId("safe-export-skipped")).toBeNull()
  })
})

describe("휴지통 실패 처리", () => {
  it("되돌리기가 실패하면 성공한 척하지 않는다", async () => {
    const user = userEvent.setup()
    store(session("a"))
    deleteEntry("a")

    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => undefined)
    // 일지 저장을 실패시킨다 — 되돌린 척하고 사라지면 최악이다.
    //
    // **주의**: `vi.spyOn(window.localStorage, "setItem")`은 jsdom에서 걸리지
    // 않는다(직접 확인함 — 예외가 던져지지 않아 테스트가 조용히 무의미해진다).
    // localStorage는 프로토타입 메서드로 호출되므로 Storage.prototype을 대상으로
    // 해야 한다.
    const real = Storage.prototype.setItem
    const setItem = vi.spyOn(Storage.prototype, "setItem")
      .mockImplementation(function (this: Storage, key: string, value: string) {
        if (key === "trainoracle.journal.v1") throw new Error("quota")
        real.call(this, key, value)
      })

    render(<TrashBin />)
    await user.click(screen.getByTestId("trash-restore"))
    setItem.mockRestore()

    expect(alertSpy).toHaveBeenCalled()
    // 되돌리기가 실패했으면 일지는 여전히 없고, 휴지통에 되돌아와 있어야 한다.
    // 여기가 빠지면 "실패했다고 말했지만 실제로는 데이터가 사라진" 상태를 놓친다.
    expect(loadEntries()).toHaveLength(0)
    expect(loadTrash()).toHaveLength(1)

    alertSpy.mockRestore()
  })
})
