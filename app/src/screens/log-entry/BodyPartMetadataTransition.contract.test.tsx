import { initializeCanonicalJournalFixture } from "../../test/canonical-journal-fixture"
import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { loadEntries } from "../../domain/journal-store"
import { hasPendingBrowserBackLayer } from "../../navigation/browserNavigation"
import { PostSessionForm } from "./PostSessionForm"
import { QuickSessionForm } from "./QuickSessionForm"

beforeEach(async () => {
  localStorage.clear()
  sessionStorage.clear()
  await initializeCanonicalJournalFixture()
})

afterEach(async () => {
  cleanup()
  await act(async () => { await Promise.resolve() })
  await waitFor(() => expect(hasPendingBrowserBackLayer()).toBe(false))
  localStorage.clear()
  sessionStorage.clear()
})

async function addCustomOnlyPart(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await user.click(screen.getByRole("button", { name: "기타 부위 추가" }))
  const dialog = await screen.findByRole("dialog", { name: "기타 부위 통증 정도" })
  await user.type(within(dialog).getByRole("textbox", { name: "부위 이름" }), "발바닥")
  await user.click(within(dialog).getByRole("button", { name: "발바닥 통증 3단계" }))
  expect(await screen.findByRole("button", { name: "발바닥, 통증 3/5" })).toBeVisible()
}

describe("custom-only body metadata transitions in journal forms", () => {
  it("stores an explicit empty companion when PostSession changes custom-only discomfort to none", async () => {
    const user = userEvent.setup()
    render(<PostSessionForm targetDate="2026-10-12" />)

    await user.click(screen.getByRole("button", { name: "완료" }))
    await user.click(screen.getByRole("button", { name: "오전" }))
    await user.click(screen.getByRole("button", { name: "다음 질문" }))
    await user.click(screen.getByRole("button", { name: "다음 질문" }))
    await user.click(screen.getByRole("button", { name: "다음 질문" }))
    await user.click(screen.getByRole("button", { name: "불편한 곳 있음" }))
    await addCustomOnlyPart(user)

    await user.click(screen.getByRole("button", { name: "불편한 곳 없음" }))
    expect(screen.getByRole("button", { name: "불편한 곳 없음" })).toHaveAttribute("aria-pressed", "true")
    await user.click(screen.getByRole("button", { name: "지금 입력 확인" }))
    await user.click(screen.getByRole("button", { name: /^저장/ }))

    await waitFor(() => expect(loadEntries()).toHaveLength(1))
    const [entry] = loadEntries()
    expect(entry).toMatchObject({ kind: "post-session", painCheckStatus: "NO_SIGNAL_REPORTED" })
    if (entry?.kind !== "post-session") throw new Error("Expected a post-session entry")
    expect(entry.painParts ?? {}).toEqual({})
    expect(entry.bodyPartMetadata).toEqual({ schemaVersion: 1, observations: [] })
    expect(entry.fieldProvenance?.painParts?.provenance).toBe("EXPLICIT")
  })

  it("drops all body signals and retains only empty companion metadata when QuickSession changes custom-only pain to rested", async () => {
    const user = userEvent.setup()
    render(<QuickSessionForm targetDate="2026-10-12" />)

    await user.click(screen.getByRole("button", { name: "운동을 마쳤어요" }))
    await user.click(screen.getByRole("button", { name: "오전" }))
    await user.click(screen.getByRole("button", { name: /힘든 정도 6\/10,/ }))
    await user.click(screen.getByRole("button", { name: "있어요" }))
    await addCustomOnlyPart(user)
    await user.click(screen.getByRole("button", { name: "이 상태로 기록" }))

    await user.click(screen.getByRole("button", { name: /완료$/ }))
    await user.click(screen.getByRole("button", { name: "오늘은 쉬었어요" }))
    await user.click(screen.getByRole("button", { name: "이대로 저장" }))

    await waitFor(() => expect(loadEntries()).toHaveLength(1))
    const [entry] = loadEntries()
    expect(entry).toMatchObject({ kind: "post-session", activityOutcome: "RESTED", objectiveDataState: "NONE" })
    if (entry?.kind !== "post-session") throw new Error("Expected a post-session entry")
    expect(entry.painCheckStatus).toBeUndefined()
    expect(entry.painParts).toBeUndefined()
    expect(entry.bodyPartMetadata).toEqual({ schemaVersion: 1, observations: [] })
    expect(entry.fieldProvenance?.painParts?.provenance).toBe("EXPLICIT")
  })
})
