import React from "react"
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { JournalEntry } from "../../domain/journal-schema"
import { JournalBodyInput } from "./JournalBodyInput"

const state = vi.hoisted(() => ({
  owner: null as string | null,
  generation: 0,
  snapshot: { owner: null as string | null, entries: [] as JournalEntry[], status: "READY", retry: vi.fn() },
}))
vi.mock("../../hooks/useCalendarEntries", () => ({ useCalendarSnapshot: () => state.snapshot }))
vi.mock("../../domain/account/local-journal-ownership", () => ({
  activeLocalAccount: () => state.owner,
  localJournalScopeGeneration: () => state.generation,
}))
vi.mock("../../domain/account/body-record-scope", () => ({ filterOwnerBodyEntries: (entries: JournalEntry[]) => entries }))
vi.mock("./BodyDiagram", () => ({ BodyDiagram: (props: {
  selected: Readonly<Record<string, number>>; onRequestHistory: () => void;
  recentKnownPartIds: readonly string[]; initialPartId?: string;
}) => <section aria-label="몸 상태 입력">
  <output aria-label="입력 초안">{JSON.stringify(props.selected)}</output>
  <output aria-label="최근 부위">{props.recentKnownPartIds.join(",")}</output>
  <output aria-label="입력할 부위">{props.initialPartId}</output>
  <button type="button" onClick={props.onRequestHistory}>몸 기록 보기</button>
</section> }))
vi.mock("../LogDetail", () => ({ LogDetail: (props: {
  initialEntryId: string; readOnly: boolean; onBack: () => void;
}) => <section aria-label="원본 보기">
  <p>{props.initialEntryId}</p><p>{props.readOnly ? "읽기 전용 원본" : "수정 가능"}</p>
  <button type="button" onClick={props.onBack}>원본에서 뒤로</button>
</section> }))

const entries: JournalEntry[] = [{
  id: "synthetic-knee", kind: "post-session", date: "2026-10-10", savedAt: "2026-10-10T08:00:00.000Z",
  syncState: "local", system: "", title: "synthetic title", distanceKm: "", durationMin: "", avgPace: "", rpe: 0,
  memo: "synthetic private memo", painParts: { rKnee: 2, lCalf: 1 },
}, {
  id: "synthetic-later", kind: "post-session", date: "2026-10-11", savedAt: "2026-10-11T08:00:00.000Z",
  syncState: "local", system: "", title: "synthetic later", distanceKm: "", durationMin: "", avgPace: "", rpe: 0,
  memo: "", painParts: { lFoot: 3, lBack: 1 },
}]

beforeEach(() => {
  state.owner = null
  state.generation += 1
  state.snapshot = { owner: null, entries: [...entries], status: "READY", retry: vi.fn() }
  window.history.replaceState({ syntheticForm: true }, "")
  // Deterministic asynchronous native Back: preserve state shape, not record contents.
  const nativePush = window.history.pushState.bind(window.history)
  const nativeReplace = window.history.replaceState.bind(window.history)
  const stack: unknown[] = [window.history.state]
  let index = 0
  vi.spyOn(window.history, "pushState").mockImplementation((data, unused, url) => {
    stack.splice(index + 1)
    stack.push(data)
    index += 1
    nativePush(data, unused, url)
  })
  vi.spyOn(window.history, "replaceState").mockImplementation((data, unused, url) => {
    stack[index] = data
    nativeReplace(data, unused, url)
  })
  vi.spyOn(window.history, "back").mockImplementation(() => {
    queueMicrotask(() => {
      index = Math.max(0, index - 1)
      nativeReplace(stack[index], "")
      fireEvent(window, new PopStateEvent("popstate", { state: stack[index] }))
    })
  })
})
afterEach(async () => {
  cleanup()
  await act(async () => { await Promise.resolve() })
  vi.restoreAllMocks()
})

function mount() {
  const onChange = vi.fn()
  const onMetadataChange = vi.fn()
  const props = { selected: { rKnee: 4 }, onChange, onMetadataChange }
  return { ...render(<JournalBodyInput {...props} />), props, onChange, onMetadataChange }
}

async function openOriginal() {
  const user = userEvent.setup()
  await user.click(screen.getByRole("button", { name: "몸 기록 보기" }))
  await user.click(await screen.findByRole("button", { name: /오른 무릎, 마지막 기록/ }))
  const source = screen.getByRole("button", { name: "원본 일지 보기" })
  const dialog = screen.getByRole("dialog")
  dialog.scrollTop = 160
  await user.click(source)
  await screen.findByRole("region", { name: "원본 보기" })
  return { user, source, dialog }
}

describe("body history inside an unfinished body input", () => {
  it("shows the read-only original in the same dialog and restores the source position and draft", async () => {
    const view = mount()
    const { user, source, dialog } = await openOriginal()

    expect(screen.getAllByRole("dialog")).toHaveLength(1)
    expect(screen.getByRole("dialog")).toBe(dialog)
    expect(screen.getByText("읽기 전용 원본")).toBeVisible()
    expect(screen.queryByText("synthetic private memo")).toBeNull()
    expect(dialog.scrollTop).toBe(0)
    await user.click(screen.getByRole("button", { name: "원본에서 뒤로" }))
    expect(screen.getByRole("heading", { name: "오른 무릎" })).toBeVisible()
    expect(source).toHaveFocus()
    expect(dialog.scrollTop).toBe(160)
    expect(screen.getByLabelText("입력 초안")).toHaveTextContent('{"rKnee":4}')
    expect(view.onChange).not.toHaveBeenCalled()
    expect(view.onMetadataChange).not.toHaveBeenCalled()
  })

  it("consumes native Back one step at a time: original, part, then body input", async () => {
    mount()
    await openOriginal()
    await act(async () => { window.history.back() })
    expect(screen.getByRole("heading", { name: "오른 무릎" })).toBeVisible()
    expect(screen.getAllByRole("dialog")).toHaveLength(1)
    await act(async () => { window.history.back() })
    expect(screen.getByRole("region", { name: "기록한 부위" })).toBeVisible()
    await act(async () => { window.history.back() })
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
    expect(screen.getByRole("button", { name: "몸 기록 보기" })).toHaveFocus()
    expect(screen.getByLabelText("입력 초안")).toHaveTextContent('{"rKnee":4}')
  })

  it("closes the whole history from its close button without consuming the form route", async () => {
    mount()
    const { user } = await openOriginal()
    await user.click(screen.getByRole("button", { name: "몸 기록 닫기" }))
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
    expect(window.history.state).toEqual({ syntheticForm: true })
    expect(screen.getByRole("button", { name: "몸 기록 보기" })).toHaveFocus()
  })

  it("uses Escape as one-step Back and preserves history until its list is closed", async () => {
    mount()
    const { dialog } = await openOriginal()
    fireEvent(dialog, new Event("cancel", { cancelable: true }))
    expect(screen.getByRole("heading", { name: "오른 무릎" })).toBeVisible()
    fireEvent(dialog, new Event("cancel", { cancelable: true }))
    expect(screen.getByRole("region", { name: "기록한 부위" })).toBeVisible()
  })

  it("passes only the three latest fixed IDs and drops old account history and recent IDs immediately", async () => {
    const view = mount()
    expect(screen.getByLabelText("최근 부위")).toHaveTextContent("lBack,lFoot,rKnee")
    await openOriginal()
    state.owner = "synthetic-owner-B"
    state.generation += 1
    view.rerender(<JournalBodyInput {...view.props} />)
    expect(screen.queryByRole("dialog")).toBeNull()
    expect(screen.getByLabelText("최근 부위")).toBeEmptyDOMElement()
    expect(screen.queryByText("synthetic-knee")).toBeNull()
  })

  it("keeps read failures visible and does not replace a missing source with an unrelated original", async () => {
    const view = mount()
    const { user } = await openOriginal()
    state.snapshot = { ...state.snapshot, status: "ERROR", entries: [] }
    view.rerender(<JournalBodyInput {...view.props} />)
    expect(screen.getByRole("alert")).toHaveTextContent("최신 기록을 확인하지 못했어요.")
    expect(screen.getByText("이 일지를 확인할 수 없어요.")).toBeVisible()
    expect(screen.queryByRole("region", { name: "원본 보기" })).toBeNull()
    await user.click(screen.getByRole("button", { name: "몸 기록으로 돌아가기" }))
    expect(screen.queryByRole("button", { name: "이 일지에 상태 남기기" })).toBeNull()
    await user.click(screen.getByRole("button", { name: "다시 불러오기" }))
    expect(state.snapshot.retry).toHaveBeenCalledOnce()
  })

  it("returns to this journal's input with the selected ID without copying its historical severity", async () => {
    const view = mount()
    const { user } = await openOriginal()
    await user.click(screen.getByRole("button", { name: "원본에서 뒤로" }))
    await user.click(screen.getByRole("button", { name: "이 일지에 상태 남기기" }))
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
    expect(screen.getByLabelText("입력할 부위")).toHaveTextContent("rKnee")
    expect(screen.getByLabelText("입력 초안")).toHaveTextContent('{"rKnee":4}')
    expect(view.onChange).not.toHaveBeenCalled()
  })
})
