import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { ATHLETE_RECORDS_STORAGE_KEY } from "../domain/athlete-records"
import { LogEntry } from "./LogEntry"

afterEach(cleanup)

describe("race entry purpose-scoped notes", () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it("requires an explicit purpose before saving nonempty free text", async () => {
    // Given
    const user = userEvent.setup()
    const onDone = vi.fn()
    render(<LogEntry entryType="race" onDone={onDone} />)
    await user.type(screen.getByRole("textbox", { name: "경기 메모" }), "첫 바퀴는 침착하게")

    // When
    await user.click(screen.getByRole("button", { name: /^저장/u }))

    // Then
    expect(onDone).not.toHaveBeenCalled()
    expect(screen.getByRole("alert")).toHaveTextContent("메모를 저장할 방법을 선택해 주세요")
    expect(window.localStorage.getItem("trainoracle.journal.v1")).toBeNull()
  })

  it("still starts without athlete-record-driven pace wiring on a clean store", () => {
    // Given
    render(<LogEntry entryType="race" />)

    // Then
    expect(screen.queryByRole("button", { name: /기록.*페이스/u })).toBeNull()
    expect(screen.queryByRole("button", { name: /5000m.*18:30/u })).toBeNull()
    expect(window.localStorage.getItem(ATHLETE_RECORDS_STORAGE_KEY)).toBeNull()
  })

  it("does not turn an athlete record into pace fields inside the race journal", () => {
    // Given
    window.localStorage.setItem(
      ATHLETE_RECORDS_STORAGE_KEY,
      JSON.stringify([{
        schemaVersion: 1,
        id: "pb-5000",
        purpose: "PERSONAL_BEST",
        eventDistanceM: 5000,
        performanceSeconds: 1110,
        achievedOn: "2026-07-01",
        seasonId: null,
        enteredBy: "ATHLETE",
        verificationState: "SELF_REPORTED",
        sourceRef: "athlete-record:pb-5000",
        savedAt: "2026-07-01T00:00:00.000Z",
      }]),
    )
    render(<LogEntry entryType="race" />)

    // Then
    expect(screen.queryByText(/5000m.*18:30/u)).toBeNull()
    expect(screen.queryByText(/CURRENT/u)).toBeNull()
    expect(screen.getByRole("spinbutton", { name: /목표 페이스 분/u })).toHaveValue(null)
    expect(screen.getByRole("spinbutton", { name: /목표 페이스 초/u })).toHaveValue(null)
  })

  it("explains that private text is not analyzed", async () => {
    // Given
    const user = userEvent.setup()
    render(<LogEntry entryType="race" />)

    // When
    await user.click(screen.getByRole("radio", { name: "나만의 메모" }))

    // Then
    expect(screen.getByText(/분석하지 않아요/u)).toBeVisible()
  })

  it("persists structured pace, optional self-checks, and training-note context", async () => {
    // Given
    const user = userEvent.setup()
    const onDone = vi.fn()
    render(<LogEntry entryType="race" onDone={onDone} />)
    await user.click(screen.getByRole("button", { name: "긴장도 7" }))
    await user.click(screen.getByRole("button", { name: "컨디션 4" }))
    await user.type(screen.getByRole("spinbutton", { name: "목표 페이스 분" }), "3")
    await user.type(screen.getByRole("spinbutton", { name: "목표 페이스 초" }), "45")
    await user.type(screen.getByRole("textbox", { name: "경기 메모" }), "후반 300m에서 리듬 올리기")
    await user.click(screen.getByRole("radio", { name: "훈련 메모" }))
    await user.click(screen.getByRole("button", { name: "경기 직후" }))
    await user.click(screen.getByRole("button", { name: "감정 5" }))

    // When
    await user.click(screen.getByRole("button", { name: /^저장/u }))

    // Then
    expect(onDone).toHaveBeenCalledWith("race", expect.objectContaining({ kind: "race" }))
    expect(window.localStorage.getItem("trainoracle.journal.v1")).toContain('"tension":7')
    expect(window.localStorage.getItem("trainoracle.journal.v1")).toContain('"condition":4')
    expect(window.localStorage.getItem("trainoracle.journal.v1")).toContain('"mood":5')
    expect(window.localStorage.getItem("trainoracle.journal.v1")).toContain('"goalPace":{"schemaVersion":1,"unit":"seconds_per_kilometer","secondsPerKm":225}')
    expect(window.localStorage.getItem("trainoracle.journal.v1")).toContain('"memoPurpose":"ANALYZABLE_TRAINING_NOTE"')
  })

  it.each([
    ["D9_ACTIVE", "달리다가 가슴이 조이고 숨을 못 쉬겠어", "안전과 관련된 표현이 감지됐어요"],
    ["D9_UNKNOWN", "무릎이 아파", "자동 확인을 완료하지 못했어요"],
  ])("saves and carries %s review attention to the next screen", async (_disposition, text, notice) => {
    // Given
    const user = userEvent.setup()
    const onDone = vi.fn()
    render(<LogEntry entryType="race" onDone={onDone} />)
    await user.type(screen.getByRole("textbox", { name: "경기 메모" }), text)
    await user.click(screen.getByRole("radio", { name: "훈련 메모" }))

    // When
    await user.click(screen.getByRole("button", { name: /^저장/u }))

    // Then
    expect(onDone).toHaveBeenCalledWith(
      "race",
      expect.objectContaining({ kind: "race" }),
      expect.stringContaining(notice),
    )
    expect(window.localStorage.getItem("trainoracle.journal.v1")).toContain(text)
  })
})

describe("existing journal entry regression", () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it("still saves a post-session entry", async () => {
    // Given
    const user = userEvent.setup()
    const onDone = vi.fn()
    render(<LogEntry entryType="post-session" onDone={onDone} />)

    // When
    await user.click(screen.getByRole("button", { name: /^저장/u }))

    // Then
    expect(onDone).toHaveBeenCalledWith(
      "post-session",
      expect.objectContaining({ kind: "post-session" }),
    )
    expect(window.localStorage.getItem("trainoracle.journal.v1")).toContain('"kind":"post-session"')
  })

  it("captures a planned subjective intensity before saving", async () => {
    // Given
    const user = userEvent.setup()
    const onDone = vi.fn()
    render(<LogEntry entryType="post-session" onDone={onDone} />)

    // When
    await user.click(screen.getByRole("button", { name: "예상 강도 7" }))
    await user.click(screen.getByRole("button", { name: /^저장/u }))

    // Then
    expect(onDone).toHaveBeenCalledWith(
      "post-session",
      expect.objectContaining({ kind: "post-session" }),
    )
    expect(window.localStorage.getItem("trainoracle.journal.v1")).toContain('"plannedRpe":7')
  })

  it("saves an interval component beside subjective intensity", async () => {
    const user = userEvent.setup()
    render(<LogEntry entryType="post-session" />)

    await user.click(screen.getByRole("button", { name: "예상 강도 7" }))
    // 객관 기록 구획은 닫힌 상태로 시작한다 (작업지시서 UX1 §2-2).
    // 필수 입력이 아니고 아무것도 안 넣어도 393px 를 먹기 때문이다.
    // 실제 사용자도 이 한 번을 누르고 들어간다.
    await user.click(screen.getByRole("button", { name: /객관 기록 · \d+개/u }))
    await user.selectOptions(screen.getByRole("combobox", { name: "객관 기록 종류" }), "INTERVALS")
    await user.type(screen.getByRole("spinbutton", { name: "반복 횟수" }), "6")
    await user.type(screen.getByRole("spinbutton", { name: "운동 시간 (초)" }), "60")
    await user.type(screen.getByRole("spinbutton", { name: "회복 시간 (초)" }), "90")
    await user.click(screen.getByRole("button", { name: "객관 구성 추가" }))
    await user.click(screen.getByRole("button", { name: /^저장/u }))

    const saved = window.localStorage.getItem("trainoracle.journal.v1")
    expect(saved).toContain('"plannedRpe":7')
    expect(saved).toContain('"kind":"INTERVALS"')
    expect(saved).toContain('"repetitions":6')
    expect(saved).toContain('"recoverySeconds":90')
  })

  it("does not silently drop malformed optional objective inputs", async () => {
    const user = userEvent.setup()
    render(<LogEntry entryType="post-session" />)

    // 객관 기록 구획을 먼저 펼친다 (작업지시서 UX1 §2-2).
    await user.click(screen.getByRole("button", { name: /객관 기록 · \d+개/u }))
    await user.type(screen.getByRole("spinbutton", { name: "반복 횟수" }), "6")
    await user.type(screen.getByRole("spinbutton", { name: "운동 시간 (초)" }), "60")
    await user.type(screen.getByRole("spinbutton", { name: "회복 시간 (초)" }), "90")
    await user.type(screen.getByRole("textbox", { name: "반복 페이스 · 선택" }), "3:99")
    await user.click(screen.getByRole("button", { name: "객관 구성 추가" }))
    expect(screen.getByRole("alert")).toHaveTextContent("반복 페이스 · 선택")
    expect(screen.getByRole("textbox", { name: "반복 페이스 · 선택" })).toHaveAttribute("aria-invalid", "true")

    await user.selectOptions(screen.getByRole("combobox", { name: "객관 기록 종류" }), "STRENGTH")
    await user.type(screen.getByRole("textbox", { name: "운동 종류" }), "스쿼트")
    await user.type(screen.getByRole("spinbutton", { name: "세트" }), "4")
    await user.type(screen.getByRole("spinbutton", { name: "세트당 반복" }), "5")
    await user.type(screen.getByRole("spinbutton", { name: "강도 (%1RM) · 선택" }), "-1")
    await user.click(screen.getByRole("button", { name: "객관 구성 추가" }))
    expect(screen.getByRole("alert")).toHaveTextContent("강도 (%1RM) · 선택")
    expect(screen.getByRole("spinbutton", { name: "강도 (%1RM) · 선택" })).toHaveAttribute("aria-invalid", "true")
    expect(screen.queryByRole("button", { name: /구성 삭제/u })).not.toBeInTheDocument()
  })
})
