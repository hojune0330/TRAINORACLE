import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
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
    expect(onDone).toHaveBeenCalledWith("race")
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
    expect(onDone).toHaveBeenCalledWith("race", expect.stringContaining(notice))
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
    expect(onDone).toHaveBeenCalledWith("post-session")
    expect(window.localStorage.getItem("trainoracle.journal.v1")).toContain('"kind":"post-session"')
  })
})
