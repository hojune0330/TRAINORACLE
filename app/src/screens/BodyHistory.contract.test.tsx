import React from "react"
import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { JournalEntry } from "../domain/journal-schema"
import type { OtherBodyPartId } from "../domain/body-part-metadata"
import { setActiveLocalAccount } from "../domain/account/local-journal-ownership"
import { useTaskFlowBack } from "../hooks/useTaskFlowBack"
import { BodyHistory } from "./BodyHistory"

vi.mock("../hooks/useTaskFlowBack", () => ({ useTaskFlowBack: vi.fn() }))

const SECRET = "synthetic private memo must stay in its original journal"
const OTHER_ID = "other_11111111-1111-4111-8111-111111111111" as OtherBodyPartId

const entries: readonly JournalEntry[] = [
  {
    id: "knee-session", kind: "post-session", date: "2026-10-10", savedAt: "2026-10-10T08:00:00.000Z",
    syncState: "local", system: "", title: "synthetic title", distanceKm: "", durationMin: "",
    avgPace: "", rpe: 0, memo: SECRET, painParts: { rKnee: 2 },
  },
  {
    id: "knee-evening", kind: "evening", date: "2026-10-10", savedAt: "2026-10-10T14:00:00.000Z",
    syncState: "local", sleepH: 0, sleepQuality: 0, weightKg: "", restingHr: "",
    painParts: { rKnee: 4, lCalf: 1 }, mood: 0, note: SECRET,
  },
  {
    id: "custom-evening", kind: "evening", date: "2026-10-11", savedAt: "2026-10-11T10:00:00.000Z",
    syncState: "local", sleepH: 0, sleepQuality: 0, weightKg: "", restingHr: "",
    painParts: {}, mood: 0, note: SECRET,
    bodyPartMetadata: {
      schemaVersion: 1,
      observations: [{ id: OTHER_ID, labelSnapshot: "왼쪽 발목", severity: 3, note: "synthetic private body note" }],
    },
  },
]

beforeEach(() => {
  vi.mocked(useTaskFlowBack).mockClear()
  setActiveLocalAccount("body-history-contract")
  setActiveLocalAccount(null)
})
afterEach(cleanup)

function renderBodyHistory(props: Partial<React.ComponentProps<typeof BodyHistory>> = {}) {
  const onOpenEntry = vi.fn()
  const onRecord = vi.fn()
  return {
    onOpenEntry,
    onRecord,
    ...render(<BodyHistory entries={entries} scopeKey="owner-A" onOpenEntry={onOpenEntry}
      onRecord={onRecord} {...props} />),
  }
}

describe("body history screen", () => {
  it("offers one clear action when no body entries exist and draws no empty chart or zero state", () => {
    const onRecord = vi.fn()
    render(<BodyHistory entries={[]} scopeKey="owner-A" onOpenEntry={vi.fn()} onRecord={onRecord} />)

    expect(screen.getByRole("heading", { name: "몸 기록" })).toBeVisible()
    expect(screen.getAllByRole("button")).toHaveLength(1)
    expect(screen.getByRole("button", { name: "오늘 상태 남기기" })).toBeVisible()
    expect(screen.queryByText(/0\/5|그래프|변화 보기/u)).toBeNull()
  })

  it("lists only recorded parts, opens one source row per journal, and keeps source memo private", async () => {
    const user = userEvent.setup()
    const { onOpenEntry } = renderBodyHistory()

    expect(screen.getByRole("region", { name: "기록한 부위" })).toBeVisible()
    expect(screen.getByRole("button", { name: /오른 무릎, 마지막 기록 2026\.10\.10/u })).toBeVisible()
    expect(screen.getByRole("button", { name: /왼 종아리, 마지막 기록 2026\.10\.10/u })).toBeVisible()
    expect(screen.getByRole("button", { name: /왼쪽 발목, 마지막 기록 2026\.10\.11/u })).toBeVisible()
    expect(screen.queryByRole("button", { name: /오른 발/u })).toBeNull()
    expect(document.body.textContent).not.toContain(SECRET)

    await user.click(screen.getByRole("button", { name: /오른 무릎, 마지막 기록/u }))
    expect(screen.getByRole("heading", { name: "오른 무릎" })).toBeVisible()
    expect(screen.getAllByText("정도 4/5")).toHaveLength(1)
    expect(screen.getAllByText("정도 2/5")).toHaveLength(1)
    expect(screen.getAllByRole("button", { name: "원본 일지 보기" })).toHaveLength(2)
    expect(screen.getByText("훈련 일지")).toBeVisible()
    expect(screen.getByText("컨디션·메모")).toBeVisible()
    expect(document.body.textContent).not.toContain(SECRET)

    await user.click(screen.getAllByRole("button", { name: "원본 일지 보기" })[0]!)
    expect(onOpenEntry).toHaveBeenCalledExactlyOnceWith("knee-evening", "2026-10-10")
  })

  it("keeps custom label and note only in self history and starts a fresh entry for that ID", async () => {
    const user = userEvent.setup()
    const { onRecord } = renderBodyHistory()

    await user.click(screen.getByRole("button", { name: /왼쪽 발목, 마지막 기록/u }))
    expect(screen.getByText("synthetic private body note")).toBeVisible()
    expect(screen.getByText("정도 3/5")).toBeVisible()
    await user.click(screen.getByRole("button", { name: "오늘 상태 남기기" }))
    expect(onRecord).toHaveBeenCalledExactlyOnceWith(OTHER_ID)
  })

  it("clears a controlled detail selection as soon as the owner scope changes", () => {
    const onSelectedPartChange = vi.fn()
    const props = {
      entries,
      onOpenEntry: vi.fn(),
      onRecord: vi.fn(),
      selectedPartId: "rKnee",
      onSelectedPartChange,
    }
    const view = render(<BodyHistory {...props} scopeKey="owner-A" />)

    expect(screen.getByRole("heading", { name: "오른 무릎" })).toBeVisible()
    view.rerender(<BodyHistory {...props} scopeKey="owner-B" />)

    expect(screen.getByRole("region", { name: "기록한 부위" })).toBeVisible()
    expect(screen.queryByRole("heading", { name: "오른 무릎" })).toBeNull()
    expect(onSelectedPartChange).toHaveBeenCalledWith(null)
  })

  it("returns to the list from detail without changing the source rows", async () => {
    const user = userEvent.setup()
    renderBodyHistory()

    await user.click(screen.getByRole("button", { name: /오른 무릎, 마지막 기록/u }))
    await user.click(screen.getByRole("button", { name: "부위 목록" }))

    expect(screen.getByRole("region", { name: "기록한 부위" })).toBeVisible()
    expect(screen.getByRole("button", { name: /오른 무릎, 마지막 기록/u })).toBeVisible()
  })

  it("lets embedded native dialogs delegate browser Back while full history owns the detail Back layer", async () => {
    const user = userEvent.setup()
    const view = renderBodyHistory({ manageBrowserBack: false })

    await user.click(screen.getByRole("button", { name: /오른 무릎, 마지막 기록/u }))
    expect(vi.mocked(useTaskFlowBack)).toHaveBeenLastCalledWith(expect.objectContaining({ enabled: false }))

    view.rerender(<BodyHistory entries={entries} scopeKey="owner-A" onOpenEntry={vi.fn()} onRecord={vi.fn()}
      selectedPartId="rKnee" manageBrowserBack />)
    expect(vi.mocked(useTaskFlowBack)).toHaveBeenLastCalledWith(expect.objectContaining({ enabled: true }))
  })
})
