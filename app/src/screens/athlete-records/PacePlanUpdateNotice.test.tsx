import React from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { PacePlanUpdateNotice } from "./PacePlanUpdateNotice"
import { prepareCurrentPaceUpdate, prepareCurrentPaceUndo, applyActivePlanEdit } from "../../domain/active-plan-edit-store"
import type { ActivePlanEditPreparation } from "../../domain/active-plan-edit"
import type { AthleteRecord } from "../../domain/athlete-records"

vi.mock("../../domain/active-plan-edit-store", () => ({ prepareCurrentPaceUpdate: vi.fn(), prepareCurrentPaceUndo: vi.fn(), applyActivePlanEdit: vi.fn() }))
const record: AthleteRecord = { schemaVersion: 1, id: "pace-ui", purpose: "RECENT_RESULT", eventDistanceM: 5000,
  performanceSeconds: 1100, achievedOn: "2026-10-01", seasonId: null, enteredBy: "ATHLETE",
  verificationState: "SELF_REPORTED", sourceRef: "athlete-record:pace-ui", savedAt: "2026-10-02T01:00:00.000Z" }
const ready = { kind: "ready", proposal: { beforeSessions: [], afterSessions: [] }, permittedTargets: [], excluded: [] } as unknown as ActivePlanEditPreparation
beforeEach(() => { vi.clearAllMocks(); vi.mocked(prepareCurrentPaceUpdate).mockResolvedValue(ready) })
afterEach(cleanup)

describe("pace update confirmation", () => {
  it("never offers another mutation after an uncertain write", async () => {
    vi.mocked(applyActivePlanEdit).mockResolvedValue({ kind: "uncertain", message: "저장 상태 확인 중" })
    render(<PacePlanUpdateNotice record={record} onDone={vi.fn()} />)
    const button = await screen.findByRole("button", { name: "남은 훈련에 적용" })
    fireEvent.click(screen.getByRole("checkbox")); fireEvent.click(button)
    expect(await screen.findByText("저장 상태 확인 중")).toBeVisible()
    expect(screen.queryByRole("button", { name: "변경안 다시 확인" })).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "계획으로 돌아가 저장 확인" })).toBeVisible()
    expect(applyActivePlanEdit).toHaveBeenCalledTimes(1)
  })
  it("rechecks protected slots before undo and never reports a rejected undo as saved", async () => {
    vi.mocked(applyActivePlanEdit).mockResolvedValue({ kind: "applied" } as Awaited<ReturnType<typeof applyActivePlanEdit>>)
    vi.mocked(prepareCurrentPaceUndo).mockResolvedValue({ kind: "blocked", reasonCode: "TARGET_UNAVAILABLE", message: "새 일지가 있어 되돌릴 수 없어요.", permittedTargets: [] })
    render(<PacePlanUpdateNotice record={record} onDone={vi.fn()} />)
    const apply = await screen.findByRole("button", { name: "남은 훈련에 적용" })
    fireEvent.click(screen.getByRole("checkbox")); fireEvent.click(apply)
    fireEvent.click(await screen.findByRole("button", { name: "이번 페이스 변경 되돌리기" }))
    expect(await screen.findByText("새 일지가 있어 되돌릴 수 없어요.")).toBeVisible()
    expect(applyActivePlanEdit).toHaveBeenCalledTimes(1)
    expect(screen.queryByText(/변경 전 페이스로 되돌렸어요/)).not.toBeInTheDocument()
  })
  it("previews without applying and requires explicit unstarted confirmation", async () => {
    render(<PacePlanUpdateNotice record={record} onDone={vi.fn()} />)
    const button = await screen.findByRole("button", { name: "남은 훈련에 적용" })
    expect(button).toBeDisabled()
    expect(applyActivePlanEdit).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole("checkbox"))
    expect(button).toBeEnabled()
  })
  it("does not claim save success before the awaited write completes", async () => {
    let finish!: (value: Awaited<ReturnType<typeof applyActivePlanEdit>>) => void
    vi.mocked(applyActivePlanEdit).mockImplementation(() => new Promise(resolve => { finish = resolve }))
    render(<PacePlanUpdateNotice record={record} onDone={vi.fn()} />)
    const button = await screen.findByRole("button", { name: "남은 훈련에 적용" })
    fireEvent.click(screen.getByRole("checkbox")); fireEvent.click(button); fireEvent.click(button)
    expect(applyActivePlanEdit).toHaveBeenCalledTimes(1)
    expect(screen.queryByText(/남은 훈련에 적용했어요/)).not.toBeInTheDocument()
    finish({ kind: "blocked", message: "다른 기기에서 계획이 바뀌었어요." })
    expect(await screen.findByText("다른 기기에서 계획이 바뀌었어요.")).toBeVisible()
    expect(screen.queryByRole("button", { name: "남은 훈련에 적용" })).not.toBeInTheDocument()
  })
  it("labels goals as goals", async () => {
    render(<PacePlanUpdateNotice record={{ ...record, purpose: "RACE_GOAL", achievedOn: null }} onDone={vi.fn()} />)
    expect(await screen.findByText(/목표 페이스는 현재 실력을 뜻하지 않아요/)).toBeVisible()
  })
  it("shows a rejected preview without enabling apply", async () => {
    vi.mocked(prepareCurrentPaceUpdate).mockResolvedValue({ kind: "blocked", reasonCode: "TARGET_UNAVAILABLE", message: "바꿀 훈련이 없어요.", permittedTargets: [] })
    render(<PacePlanUpdateNotice record={record} onDone={vi.fn()} />)
    expect(await screen.findByText("바꿀 훈련이 없어요.")).toBeVisible()
    expect(screen.queryByRole("button", { name: "남은 훈련에 적용" })).not.toBeInTheDocument()
  })
  it("leaves the original plan untouched when dismissed", async () => {
    const onDone = vi.fn()
    render(<PacePlanUpdateNotice record={record} onDone={onDone} />)
    await waitFor(() => expect(screen.getByRole("button", { name: "계획은 그대로 두기" })).toBeEnabled())
    fireEvent.click(screen.getByRole("button", { name: "계획은 그대로 두기" }))
    expect(onDone).toHaveBeenCalledTimes(1)
    expect(applyActivePlanEdit).not.toHaveBeenCalled()
  })
})
