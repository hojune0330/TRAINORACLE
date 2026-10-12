import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { JournalEntry } from "../../domain/journal-store"
import { loadEntries, replaceAllEntries } from "../../domain/journal-store"
import { setActiveLocalAccount } from "../../domain/account/local-journal-ownership"
import { RaceForm } from "./RaceForm"

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  setActiveLocalAccount(null)
  vi.stubEnv("VITE_FEATURE_ACCOUNT_JOURNAL", "false")
  vi.stubEnv("VITE_KILL_ACCOUNT_JOURNAL", "true")
})

afterEach(() => {
  cleanup()
  setActiveLocalAccount(null)
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
  localStorage.clear()
  sessionStorage.clear()
})

describe("race form staged flow", () => {
  it("moves new race details to a review, preserves both stages, and saves only from review", async () => {
    const onDone = vi.fn()
    render(<RaceForm targetDate="2026-09-13" onDone={onDone} />)

    expect(screen.getByRole("heading", { name: "경기 정보를 적어요" })).toBeVisible()
    expect(screen.queryByLabelText("경기 메모")).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "지금 입력 확인" }))
    expect(screen.getByRole("region", { name: "저장 전 입력 확인" })).toHaveTextContent("경기 직전")

    fireEvent.click(screen.getByRole("button", { name: "경기 정보 수정" }))
    fireEvent.click(screen.getByRole("button", { name: "경기 직후" }))
    fireEvent.change(screen.getByRole("textbox", { name: "경기 기록" }), { target: { value: "16:42.18" } })
    fireEvent.change(screen.getByRole("textbox", { name: "경기 순위" }), { target: { value: "2위" } })
    fireEvent.click(screen.getByRole("button", { name: "지금 입력 확인" }))
    expect(screen.getByRole("region", { name: "저장 전 입력 확인" })).toHaveTextContent("기록 16:42.18")
    expect(screen.getByRole("region", { name: "저장 전 입력 확인" })).toHaveTextContent("순위 2위")

    fireEvent.click(screen.getByRole("button", { name: "경기 정보 수정" }))
    fireEvent.click(screen.getByRole("button", { name: "경기 직전" }))
    fireEvent.change(screen.getByRole("spinbutton", { name: "목표 페이스 분" }), { target: { value: "3" } })
    fireEvent.change(screen.getByRole("spinbutton", { name: "목표 페이스 초" }), { target: { value: "45" } })
    fireEvent.click(screen.getByRole("button", { name: "지금 입력 확인" }))
    expect(screen.getByRole("region", { name: "저장 전 입력 확인" })).toHaveTextContent("목표 페이스 3분 45초/km")
    expect(screen.getByRole("region", { name: "저장 전 입력 확인" })).toHaveTextContent("기록 16:42.18")
    expect(onDone).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole("button", { name: /^저장/u }))
    await waitFor(() => expect(onDone).toHaveBeenCalledOnce())
    expect(onDone.mock.calls[0]?.[1]).toMatchObject({
      kind: "race", date: "2026-09-13", stage: "pre", record: "16:42.18", rank: "2위",
      goalPace: { secondsPerKm: 225 },
    })
  })

  it("opens an existing race as a concise summary and edits the same saved entry", async () => {
    const onDone = vi.fn()
    const entry = {
      id: "race-summary-fixture",
      kind: "race",
      date: "2026-09-13",
      savedAt: "2026-09-13T19:00:00.000Z",
      syncState: "local",
      stage: "post",
      record: "16:42.18",
      rank: "2위",
      result: "결승 진출",
      memo: "마지막 300m를 밀었다",
      memoPurpose: "ANALYZABLE_TRAINING_NOTE",
      tension: 5,
      condition: 4,
      mood: 4,
      goalPace: { schemaVersion: 1, unit: "seconds_per_kilometer", secondsPerKm: 225 },
    } satisfies JournalEntry
    expect(replaceAllEntries([entry]).ok).toBe(true)
    render(<RaceForm initialEntry={entry} onDone={onDone} />)

    expect(screen.getByRole("heading", { name: "입력 확인" })).toBeVisible()
    expect(screen.getByRole("region", { name: "저장 전 입력 확인" })).toHaveTextContent("기록 16:42.18")
    expect(screen.queryByLabelText("경기 기록")).toBeNull()
    expect(screen.queryByLabelText("경기 메모")).toBeNull()

    fireEvent.click(screen.getByRole("button", { name: "경기 정보 수정" }))
    expect(screen.getByRole("textbox", { name: "경기 기록" })).toHaveValue("16:42.18")
    fireEvent.change(screen.getByRole("textbox", { name: "경기 순위" }), { target: { value: "1위" } })
    fireEvent.click(screen.getByRole("button", { name: "입력 확인으로" }))
    expect(screen.getByRole("region", { name: "저장 전 입력 확인" })).toHaveTextContent("순위 1위")
    fireEvent.click(screen.getByRole("button", { name: /^수정 저장/u }))

    await waitFor(() => expect(onDone).toHaveBeenCalledOnce())
    expect(loadEntries()).toHaveLength(1)
    expect(loadEntries()[0]).toMatchObject({ id: entry.id, date: entry.date, record: entry.record, rank: "1위" })
  })

  it("routes an invalid pace from review back to the pre-race field and exposes its error", () => {
    const onDone = vi.fn()
    render(<RaceForm targetDate="2026-09-13" onDone={onDone} />)
    fireEvent.click(screen.getByRole("button", { name: "지금 입력 확인" }))
    fireEvent.click(screen.getByRole("button", { name: "경기 정보 수정" }))
    fireEvent.change(screen.getByRole("spinbutton", { name: "목표 페이스 분" }), { target: { value: "3" } })
    fireEvent.change(screen.getByRole("spinbutton", { name: "목표 페이스 초" }), { target: { value: "60" } })
    fireEvent.click(screen.getByRole("button", { name: "지금 입력 확인" }))
    fireEvent.click(screen.getByRole("button", { name: /^저장/u }))

    expect(screen.getByRole("heading", { name: "경기 정보를 적어요" })).toBeVisible()
    expect(screen.getByRole("button", { name: "경기 직전" })).toHaveAttribute("aria-pressed", "true")
    expect(screen.getByRole("alert")).toHaveTextContent("초는 0부터 59까지")
    expect(onDone).not.toHaveBeenCalled()
  })

  it("returns to the memo step when review finds a missing purpose", () => {
    const onDone = vi.fn()
    render(<RaceForm targetDate="2026-09-13" onDone={onDone} />)
    fireEvent.click(screen.getByRole("button", { name: "메모 추가" }))
    fireEvent.change(screen.getByRole("textbox", { name: "경기 메모" }), { target: { value: "회복 메모 fixture" } })
    fireEvent.click(screen.getByRole("button", { name: "입력 확인으로" }))
    fireEvent.click(screen.getByRole("button", { name: /^저장/u }))

    expect(screen.getByRole("heading", { name: "경기 메모" })).toBeVisible()
    expect(screen.getByRole("alert")).toHaveTextContent("메모를 저장할 방법을 선택")
    expect(screen.getByRole("textbox", { name: "경기 메모" })).toHaveValue("회복 메모 fixture")
    expect(onDone).not.toHaveBeenCalled()
  })

  it("keeps private memo recovery setup visible when save starts from review", () => {
    const onDone = vi.fn()
    render(<RaceForm targetDate="2026-09-13" onDone={onDone} />)
    fireEvent.click(screen.getByRole("button", { name: "메모 추가" }))
    fireEvent.click(screen.getByRole("radio", { name: "나만의 메모" }))
    fireEvent.change(screen.getByRole("textbox", { name: "경기 메모" }), { target: { value: "private memo fixture" } })
    fireEvent.click(screen.getByRole("button", { name: "입력 확인으로" }))
    fireEvent.click(screen.getByRole("button", { name: /^저장/u }))

    expect(screen.getByRole("heading", { name: "경기 메모" })).toBeVisible()
    expect(screen.getByRole("alert")).toHaveTextContent("복구 코드를 준비")
    expect(screen.getByRole("button", { name: "나만의 메모 저장 준비" })).toBeVisible()
    expect(onDone).not.toHaveBeenCalled()
  })

  it("keeps memo safety review visible on the save summary", () => {
    render(<RaceForm targetDate="2026-09-13" />)
    fireEvent.click(screen.getByRole("button", { name: "메모 추가" }))
    fireEvent.change(screen.getByRole("textbox", { name: "경기 메모" }), { target: { value: "무릎이 아파" } })
    fireEvent.click(screen.getByRole("radio", { name: "훈련 메모" }))
    fireEvent.click(screen.getByRole("button", { name: "입력 확인으로" }))

    expect(screen.getByRole("region", { name: "저장 전 입력 확인" })).toHaveTextContent("자동 확인을 완료하지 못했어요")
  })
})
