import { cleanup, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { clearSessionRecoveryCode } from "../../domain/account/private-note-sync"
import { loadEntries } from "../../domain/journal-store"
import type { PostSessionEntry } from "../../domain/journal-schema"
import { PostSessionForm } from "./PostSessionForm"

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  clearSessionRecoveryCode()
})
afterEach(() => {
  cleanup()
  localStorage.clear()
  sessionStorage.clear()
  clearSessionRecoveryCode()
})

function existingEntry(memoPurpose?: PostSessionEntry["memoPurpose"]): PostSessionEntry {
  return {
    id: "synthetic-post-session-review",
    kind: "post-session",
    date: "2026-10-08",
    savedAt: "2026-10-08T08:00:00.000Z",
    syncState: "local",
    captureDepth: "DETAILED",
    activityOutcome: "COMPLETED",
    activitySlot: "AM",
    system: "",
    title: "synthetic run",
    distanceKm: "",
    durationMin: "",
    avgPace: "",
    rpe: 0,
    memo: "synthetic memo that must be preserved",
    ...(memoPurpose === undefined ? {} : { memoPurpose }),
  }
}

describe("PostSession review validation routing", () => {
  it("keeps answered values in the review and groups unanswered fields under compact add-item actions", async () => {
    const user = userEvent.setup()
    const original = existingEntry("ANALYZABLE_TRAINING_NOTE")
    const { container } = render(<PostSessionForm initialEntry={original} />)

    expect(screen.getByText("입력한 내용만 저장해요.")).toBeVisible()
    const answers = container.querySelector(".post-session-review__answers")
    expect(answers).not.toBeNull()
    expect(within(answers as HTMLElement).getByText("운동 결과")).toBeVisible()
    expect(within(answers as HTMLElement).getByText("운동 시간대")).toBeVisible()
    expect(within(answers as HTMLElement).getByText("실제로 한 운동")).toBeVisible()
    expect(within(answers as HTMLElement).getByText("synthetic run")).toBeVisible()
    expect(answers).not.toHaveTextContent("아직 선택하지 않았어요")
    expect(within(answers as HTMLElement).getByText("메모")).toBeVisible()
    expect(within(answers as HTMLElement).queryByText("운동 강도")).toBeNull()
    expect(within(answers as HTMLElement).queryByText("운동 후 몸 상태")).toBeNull()
    expect(within(answers as HTMLElement).queryByText("거리와 시간")).toBeNull()

    const additions = screen.getByRole("group", { name: "추가할 항목" })
    for (const label of ["거리와 시간", "운동 강도", "운동 후 몸 상태"]) {
      const button = within(additions).getByRole("button", { name: `${label} 수정` })
      expect(button).toHaveTextContent(new RegExp(`^${label}$`, "u"))
      expect(button).toBeVisible()
    }

    await user.click(within(additions).getByRole("button", { name: "운동 후 몸 상태 수정" }))
    expect(screen.getByRole("heading", { level: 2, name: "운동 후 몸 상태" })).toBeVisible()
    expect(screen.getByRole("button", { name: "불편한 곳 없음" })).toBeVisible()
  })

  it("returns a new form to review after editing only the selected group", async () => {
    const user = userEvent.setup()
    render(<PostSessionForm targetDate="2026-10-08" />)

    await user.click(screen.getByRole("button", { name: "결과는 생략하고 계속" }))
    await user.click(screen.getByRole("button", { name: "지금 입력 확인" }))
    await user.click(screen.getByRole("button", { name: "운동 강도 수정" }))
    expect(screen.getByRole("heading", { level: 2, name: "몸에 느껴진 강도" })).toBeVisible()

    await user.click(screen.getByRole("button", { name: "입력 확인으로" }))
    expect(screen.getByRole("heading", { level: 2, name: "입력 확인" })).toBeVisible()
    expect(screen.queryByRole("button", { name: "불편한 곳 없음" })).toBeNull()
    expect(screen.getByRole("button", { name: /^저장/ })).toBeVisible()

    await user.click(screen.getByRole("button", { name: "← 뒤로" }))
    expect(screen.getByRole("heading", { level: 2, name: "오늘 남길 메모" })).toBeVisible()
  })

  it("reopens only the memo editor when an existing entry has no memo purpose", async () => {
    const user = userEvent.setup()
    const original = existingEntry()
    render(<PostSessionForm initialEntry={original} />)

    expect(screen.getByRole("heading", { level: 2, name: "입력 확인" })).toBeVisible()
    expect(screen.getByText(/synthetic memo that must be preserved/u)).toBeVisible()
    await user.click(screen.getByRole("button", { name: /^수정 저장/ }))

    await waitFor(() => expect(screen.getByRole("heading", { level: 2, name: "오늘 남길 메모" })).toBeVisible())
    expect(screen.getByRole("alert")).toHaveTextContent("메모를 저장할 방법을 선택해 주세요.")
    expect(screen.getByRole("textbox", { name: "훈련 메모 내용" })).toHaveValue(original.memo)
    expect(screen.getByRole("radio", { name: "나만의 메모" })).not.toBeChecked()
    expect(screen.getByRole("radio", { name: "훈련 메모" })).not.toBeChecked()
    expect(loadEntries()).toHaveLength(0)
  })

  it("opens private-memo recovery setup instead of hiding the save error in a new draft", async () => {
    const user = userEvent.setup()
    render(<PostSessionForm targetDate="2026-10-08" />)

    await user.click(screen.getByRole("button", { name: "결과는 생략하고 계속" }))
    await user.click(screen.getByRole("button", { name: "지금 입력 확인" }))
    await user.click(screen.getByRole("button", { name: "메모 수정" }))
    await user.type(screen.getByRole("textbox", { name: "훈련 메모 내용" }), "synthetic private draft")
    await user.click(screen.getByRole("radio", { name: "나만의 메모" }))
    await user.click(screen.getByRole("button", { name: "입력 확인으로" }))
    await user.click(screen.getByRole("button", { name: /^저장/ }))

    await waitFor(() => expect(screen.getByRole("heading", { level: 2, name: "오늘 남길 메모" })).toBeVisible())
    expect(screen.getByRole("alert")).toHaveTextContent("복구 코드를 준비해 주세요")
    expect(screen.getByRole("button", { name: "나만의 메모 저장 준비" })).toBeVisible()
    expect(screen.getByRole("textbox", { name: "훈련 메모 내용" })).toHaveValue("synthetic private draft")
    expect(loadEntries()).toHaveLength(0)
  })

  it("returns a reported-but-unlocated body condition to its editor without flattening the review", async () => {
    const user = userEvent.setup()
    const original: PostSessionEntry = {
      ...existingEntry("ANALYZABLE_TRAINING_NOTE"),
      painCheckStatus: "SIGNAL_REPORTED",
      painParts: {},
    }
    render(<PostSessionForm initialEntry={original} />)

    await user.click(screen.getByRole("button", { name: /^수정 저장/ }))

    await waitFor(() => expect(screen.getByRole("heading", { level: 2, name: "운동 후 몸 상태" })).toBeVisible())
    expect(screen.getByRole("button", { name: "불편한 곳 있음" })).toHaveAttribute("aria-pressed", "true")
    expect(screen.queryByRole("button", { name: "운동 내용 수정" })).toBeNull()
    expect(loadEntries()).toHaveLength(0)
  })
})
