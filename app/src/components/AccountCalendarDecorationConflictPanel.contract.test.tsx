import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { createEmptyCalendarDecorationState } from "../domain/calendar-decoration-schema"
import { setActiveLocalAccount } from "../domain/account/local-journal-ownership"
import { AccountCalendarDecorationConflictPanel } from "./AccountCalendarDecorationConflictPanel"

const api = vi.hoisted(() => ({ status: vi.fn(), load: vi.fn(), resolve: vi.fn() }))
vi.mock("../domain/account/account-calendar-decoration-service", () => ({
  accountCalendarDecorationStatus: api.status,
  loadAccountCalendarDecorationConflict: api.load,
  resolveAccountCalendarDecorationConflict: api.resolve,
  ACCOUNT_CALENDAR_DECORATION_EVENT: "trainoracle:account-calendar-decorations-changed",
}))

const deferred = <T,>() => {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(done => { resolve = done })
  return { promise, resolve }
}

beforeEach(() => {
  setActiveLocalAccount("A")
  api.status.mockReturnValue("CONFLICT")
  api.load.mockResolvedValue({ ownerId: "A", localSequence: 2, remoteRevision: 5,
    local: createEmptyCalendarDecorationState(), remote: createEmptyCalendarDecorationState() })
  api.resolve.mockResolvedValue(true)
})
afterEach(() => { cleanup(); setActiveLocalAccount(null); vi.resetAllMocks() })

describe("AccountCalendarDecorationConflictPanel", () => {
  it("shows whole-theme choices and waits for the parent's dirty-exit decision before resolving", async () => {
    const onBeforeResolve = vi.fn((action: () => void) => undefined)
    const onResolved = vi.fn()
    render(<AccountCalendarDecorationConflictPanel onBeforeResolve={onBeforeResolve} onResolved={onResolved} />)
    fireEvent.click(screen.getByRole("button", { name: "달력 꾸밈 두 버전 비교하기" }))
    await waitFor(() => expect(screen.getByText(/기기 수정본 2 · 계정 수정본 5/u)).toBeTruthy())

    expect(screen.getByRole("button", { name: "기기 꾸밈 다시 적용" })).toBeTruthy()
    expect(screen.getByRole("button", { name: "계정 꾸밈 사용" })).toBeTruthy()
    expect(screen.getByText(/전역 달력 테마와 여백 장식 전체/u)).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "기기 꾸밈 다시 적용" }))
    expect(onBeforeResolve).toHaveBeenCalledOnce()
    expect(api.resolve).not.toHaveBeenCalled()
    onBeforeResolve.mock.calls[0]![0]()
    await waitFor(() => expect(api.resolve).toHaveBeenCalledOnce())
    expect(api.resolve.mock.calls[0]?.[1]).toBe("LOCAL")
    expect(onResolved).toHaveBeenCalledOnce()
  })

  it("ignores a late review result after the active account changes", async () => {
    const work = deferred<Awaited<ReturnType<typeof api.load>>>()
    api.load.mockReturnValueOnce(work.promise)
    render(<AccountCalendarDecorationConflictPanel />)
    fireEvent.click(screen.getByRole("button", { name: "달력 꾸밈 두 버전 비교하기" }))
    setActiveLocalAccount("B")
    work.resolve({ ownerId: "A", localSequence: 3, remoteRevision: 7,
      local: createEmptyCalendarDecorationState(), remote: createEmptyCalendarDecorationState() })
    await waitFor(() => expect(screen.queryByText(/기기 수정본/u)).toBeNull())
    expect(api.resolve).not.toHaveBeenCalled()
  })
})
