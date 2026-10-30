import React from "react"
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { SelfHostedCoachingPanel } from "./SelfHostedCoachingPanel"
import { exampleCoachingExplanation, exampleCoachingStatus, exampleGarminId, exampleRecordId } from "./SelfHostedCoachingPanel.test-fixtures"
import { COACHING_PURPOSE_VERSION, type CoachingResult, type CoachingTransport } from "../domain/coaching-self-hosted"

const props = { ownerId: "owner-a", onReviewJournal: vi.fn(), onReviewPlan: vi.fn() }
beforeEach(() => { vi.stubEnv("VITE_FEATURE_SELF_HOSTED_COACHING", "true") })
afterEach(() => { cleanup(); vi.unstubAllEnvs() })
const response = (data: Extract<CoachingResult, { ok: true }>['data']): CoachingResult => ({ ok: true, data })
function transport() {
  let revision = 0
  return vi.fn<CoachingTransport>(async (_owner, request) => request.action === "status" ? response(exampleCoachingStatus)
    : request.action === "infer" ? response(exampleCoachingExplanation)
      : response({ consent: { revision: ++revision, active: request.action === "consent", purposeVersion: COACHING_PURPOSE_VERSION } }))
}
async function selectAndConsent() {
  const user = userEvent.setup()
  await user.click(await screen.findByRole("checkbox", { name: /2026-10-28/u }))
  await user.click(screen.getByRole("checkbox", { name: /선택한 1개 기록/u }))
  return user
}

describe("company self-hosted coaching flow", () => {
  it("stays absent when disabled and does not request account data", () => {
    vi.stubEnv("VITE_FEATURE_SELF_HOSTED_COACHING", "false")
    const send = transport()
    const view = render(<SelfHostedCoachingPanel {...props} transport={send} />)
    expect(view.container).toBeEmptyDOMElement(); expect(send).not.toHaveBeenCalled()
  })
  it("shows real approval pending without fabricating access or allowing selection", async () => {
    const send = vi.fn<CoachingTransport>().mockResolvedValue(response({ ...exampleCoachingStatus, capability: { enabled: false, reason: "PROVIDER_APPROVAL_PENDING" } }))
    render(<SelfHostedCoachingPanel {...props} transport={send} />)
    expect(await screen.findByText(/아직 AI 풀이를 요청할 수 없어요/u)).toBeVisible()
    expect(screen.getByRole("button", { name: "선택한 기록 풀이 보기" })).toBeDisabled()
    expect(screen.getByRole("checkbox", { name: /2026-10-29/u })).toBeDisabled()
    expect(send.mock.calls.map(call => call[1].action)).toEqual(["status"])
  })
  it("selects eligible records only, sends purpose consent then IDs, and displays cited synthetic success", async () => {
    const send = transport()
    render(<SelfHostedCoachingPanel {...props} transport={send} />)
    const user = await selectAndConsent()
    expect(screen.getByRole("checkbox", { name: /2026-10-29/u })).toBeDisabled()
    await user.click(screen.getByRole("button", { name: "선택한 기록 풀이 보기" }))
    expect(await screen.findByText(exampleCoachingExplanation.summary)).toBeVisible()
    expect(screen.getByText("5 km")).toBeVisible()
    expect(screen.getByText("근거: 2026-10-28")).toBeVisible()
    expect(send.mock.calls[1]?.[1]).toEqual({ action: "consent", expectedConsentRevision: 0, purposeVersion: COACHING_PURPOSE_VERSION,
      documentIds: [exampleRecordId], documentRevisions: [{ documentId: exampleRecordId, revision: 2 }] })
    expect(send.mock.calls[2]?.[1]).toEqual({ action: "infer", consentRevision: 1, documentIds: [exampleRecordId] })
    await user.click(screen.getByRole("button", { name: "기존 훈련 계획 확인" }))
    expect(props.onReviewPlan).toHaveBeenCalledOnce()
    expect(screen.getByText(/훈련 계획과 몸 상태 판단은 바뀌지 않았어요/u)).toBeVisible()
  })
  it("opens the source record's actual date and journal identity, not today's journal or account document id", async () => {
    render(<SelfHostedCoachingPanel {...props} transport={transport()} />)
    const user = await selectAndConsent()
    await user.click(screen.getByRole("button", { name: "선택한 기록 풀이 보기" }))
    await user.click(await screen.findByRole("button", { name: "일지에서 확인" }))
    expect(props.onReviewJournal).toHaveBeenCalledExactlyOnceWith({ documentId: exampleRecordId, journalEntryId: "synthetic-journal-entry-28", date: "2026-10-28" })
  })
  it("lets a user choose the exact source when multiple journals support the explanation", async () => {
    const send = transport(); const normal = send.getMockImplementation()!
    const second = { ...exampleCoachingStatus.records[1]!, journalEntryId: "synthetic-journal-entry-29", provider: "직접 입력", eligible: true, reason: "READY" as const }
    send.mockImplementation((owner, request, signal, current) => request.action === "status"
      ? Promise.resolve(response({ ...exampleCoachingStatus, records: [exampleCoachingStatus.records[0]!, second] }))
      : request.action === "infer" ? Promise.resolve(response({ ...exampleCoachingExplanation, sourceDocumentIds: [exampleRecordId, exampleGarminId] }))
        : normal(owner, request, signal, current))
    render(<SelfHostedCoachingPanel {...props} transport={send} />)
    const user = userEvent.setup()
    await user.click(await screen.findByRole("checkbox", { name: /2026-10-28/u }))
    await user.click(screen.getByRole("checkbox", { name: /2026-10-29/u }))
    await user.click(screen.getByRole("checkbox", { name: /선택한 2개 기록/u }))
    await user.click(screen.getByRole("button", { name: "선택한 기록 풀이 보기" }))
    await user.click(await screen.findByRole("button", { name: "일지에서 확인" }))
    expect(props.onReviewJournal).not.toHaveBeenCalled()
    await user.click(screen.getByRole("button", { name: /2026-10-29 .* 일지 열기/u }))
    expect(props.onReviewJournal).toHaveBeenCalledExactlyOnceWith({ documentId: exampleGarminId, journalEntryId: "synthetic-journal-entry-29", date: "2026-10-29" })
  })
  it("requires new explicit consent after changing the record selection", async () => {
    render(<SelfHostedCoachingPanel {...props} transport={transport()} />)
    const user = await selectAndConsent()
    await user.click(screen.getByRole("checkbox", { name: /2026-10-28/u }))
    expect(screen.getByRole("checkbox", { name: /선택한 0개 기록/u })).not.toBeChecked()
    expect(screen.getByRole("button", { name: "선택한 기록 풀이 보기" })).toBeDisabled()
  })
  it("withdraws while inference is pending and discards its late response", async () => {
    let finish!: (value: CoachingResult) => void
    const send = transport()
    const normal = send.getMockImplementation()!
    send.mockImplementation((owner, request, signal, current) => request.action === "infer"
      ? new Promise(resolve => { finish = resolve }) : normal(owner, request, signal, current))
    render(<SelfHostedCoachingPanel {...props} transport={send} />)
    const user = await selectAndConsent()
    await user.click(screen.getByRole("button", { name: "선택한 기록 풀이 보기" }))
    await user.click(await screen.findByRole("button", { name: "AI 풀이 동의 철회" }))
    expect(await screen.findByText(/AI 풀이 동의를 철회했어요/u)).toBeVisible()
    await act(async () => { finish(response(exampleCoachingExplanation)) })
    expect(screen.queryByText(exampleCoachingExplanation.summary)).not.toBeInTheDocument()
    expect(send.mock.calls.find(call => call[1].action === "infer")?.[2].aborted).toBe(true)
    expect(screen.queryByRole("button", { name: "AI 풀이 동의 철회" })).not.toBeInTheDocument()
  })
  it("does not claim failed withdrawal succeeded or permit another inference", async () => {
    const send = transport(); const normal = send.getMockImplementation()!
    send.mockImplementation((owner, request, signal, current) => request.action === "withdraw"
      ? Promise.resolve({ ok: false, code: "UNAVAILABLE" }) : normal(owner, request, signal, current))
    render(<SelfHostedCoachingPanel {...props} transport={send} />)
    const user = await selectAndConsent(); await user.click(screen.getByRole("button", { name: "선택한 기록 풀이 보기" }))
    await screen.findByText(exampleCoachingExplanation.summary)
    await user.click(screen.getByRole("button", { name: "AI 풀이 동의 철회" }))
    expect(await screen.findByText(/철회 완료를 확인하지 못했어요/u)).toBeVisible()
    expect(screen.queryByText(exampleCoachingExplanation.summary)).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "선택한 기록 풀이 보기" })).toBeDisabled()
  })
  it("cancels an inference, ignores its late response, and keeps withdrawal available", async () => {
    let finish!: (value: CoachingResult) => void
    const send = transport(); const normal = send.getMockImplementation()!
    send.mockImplementation((owner, request, signal, current) => request.action === "infer"
      ? new Promise(resolve => { finish = resolve }) : normal(owner, request, signal, current))
    render(<SelfHostedCoachingPanel {...props} transport={send} />)
    const user = await selectAndConsent(); await user.click(screen.getByRole("button", { name: "선택한 기록 풀이 보기" }))
    await user.click(await screen.findByRole("button", { name: "풀이 요청 취소" }))
    await act(async () => { finish(response(exampleCoachingExplanation)) })
    expect(screen.queryByText(exampleCoachingExplanation.summary)).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "AI 풀이 동의 철회" })).toBeEnabled()
  })
  it("clears account A results immediately on account replacement and ignores A late completion", async () => {
    let finish!: (value: CoachingResult) => void
    const send = transport(); const normal = send.getMockImplementation()!
    send.mockImplementation((owner, request, signal, current) => request.action === "infer"
      ? new Promise(resolve => { finish = resolve }) : normal(owner, request, signal, current))
    const view = render(<SelfHostedCoachingPanel {...props} transport={send} />)
    const user = await selectAndConsent(); await user.click(screen.getByRole("button", { name: "선택한 기록 풀이 보기" }))
    await waitFor(() => expect(send.mock.calls.some(call => call[1].action === "infer")).toBe(true))
    view.rerender(<SelfHostedCoachingPanel {...props} ownerId="owner-b" transport={send} />)
    await act(async () => { finish(response(exampleCoachingExplanation)) })
    expect(screen.queryByText(exampleCoachingExplanation.summary)).not.toBeInTheDocument()
    expect(screen.getByRole("checkbox", { name: /선택한 0개 기록/u })).not.toBeChecked()
  })
  it("requires a fresh status after source changes and never shows substitute success", async () => {
    const send = transport(); const normal = send.getMockImplementation()!
    send.mockImplementation((owner, request, signal, current) => request.action === "infer"
      ? Promise.resolve({ ok: false, code: "SOURCE_CHANGED" }) : normal(owner, request, signal, current))
    render(<SelfHostedCoachingPanel {...props} transport={send} />)
    const user = await selectAndConsent(); await user.click(screen.getByRole("button", { name: "선택한 기록 풀이 보기" }))
    expect(await screen.findByText(/선택한 기록이 바뀌었어요/u)).toBeVisible()
    expect(screen.getByRole("button", { name: "선택한 기록 풀이 보기" })).toBeDisabled()
  })
  it("retains consent withdrawal management after the inference feature is disabled", async () => {
    vi.stubEnv("VITE_FEATURE_SELF_HOSTED_COACHING", "false")
    const send = transport(); send.mockResolvedValueOnce(response({ ...exampleCoachingStatus, consent: { revision: 0, active: true, purposeVersion: COACHING_PURPOSE_VERSION } }))
    render(<SelfHostedCoachingPanel {...props} mode="manage" transport={send} />)
    fireEvent.click(await screen.findByRole("button", { name: "AI 풀이 동의 철회" }))
    expect(await screen.findByText(/AI 풀이 동의를 철회했어요/u)).toBeVisible()
    expect(screen.queryByRole("button", { name: "선택한 기록 풀이 보기" })).not.toBeInTheDocument()
  })
})
