import React from "react"
import { cleanup, render, screen, within, act } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { OracleConnectedComparison, comparisonExpiry, readComparisonInvitation } from "./OracleConnectedComparison"
import { makeOracleProfileRevision } from "../domain/oracle-profile-snapshot"
import { ORACLE_QUESTIONS } from "../domain/oracle-profile-v2"
import type { ProfileComparisonResult } from "../domain/account/oracle-profile-comparison-api"
const mock = vi.hoisted(() => ({ request: vi.fn() }))
vi.mock("../domain/account/oracle-profile-comparison-api", () => ({ requestProfileComparison: mock.request }))
afterEach(cleanup)
const owner = "a1111111-1111-4111-8111-111111111111", peer = "b2222222-2222-4222-8222-222222222222"
const cid = "d4444444-4444-4444-8444-444444444444", code = "a".repeat(43)
const question = ORACLE_QUESTIONS[0]!
const ownProfile = makeOracleProfileRevision({ revision: 3, answeredAt: "2026-10-04T00:00:00.000Z", answers: { CHALLENGE_1: 1 } })
const props = { ownerId: owner, documentId: "c3333333-3333-4333-8333-333333333333", documentRevision: 7, ownProfile, onBack: vi.fn() }
const expiresAt = "2099-10-05T00:00:00.000Z"
beforeEach(() => { mock.request.mockReset(); mock.request.mockImplementation(async (_owner, request) => {
  if (request.action === "createInvite") return { ok: true, data: { kind: "invitation-created", comparisonId: cid, invitationCode: code, expiresAt: request.expiresAt } }
  if (request.action === "acceptInvite" || request.action === "invitationStatus") return { ok: true, data: { kind: "invitation", comparisonId: cid, accepted: true, peerLabel: null, expiresAt } }
  const kind = ({ consent: "consented", allowExternal: "external-consented", revoke: "revoked", revokeExternal: "external-revoked" } as Record<string, string>)[request.action]
  return kind ? { ok: true, data: { kind, comparisonId: request.comparisonId } } : { ok: false, code: "ACCESS_DENIED" }
}) })
async function start() {
  const user = userEvent.setup(); const view = render(<OracleConnectedComparison {...props} invitationCode={code} />)
  expect(mock.request).not.toHaveBeenCalled()
  await user.click(screen.getByRole("button", { name: "이 계정으로 초대 받기" }))
  await user.click(screen.getByRole("checkbox", { name: question.text }))
  await user.click(screen.getByRole("button", { name: "선택 확인" }))
  await user.click(screen.getByRole("checkbox", { name: "선택한 내 응답을 이 상대와 비교하는 데 동의해요." }))
  return { user, view }
}
it("creates invitation through selected fields and exact-date presets without raw IDs or auto consent", async () => {
  const user = userEvent.setup(); render(<OracleConnectedComparison {...props} />)
  expect(screen.getByRole("button", { name: "비교 초대 만들기" })).toBeEnabled()
  expect(screen.getByRole("button", { name: "초대 받았어요" })).toBeEnabled()
  await user.click(screen.getByRole("button", { name: "비교 초대 만들기" }))
  await user.click(screen.getByRole("checkbox", { name: question.text }))
  await user.click(screen.getByRole("radio", { name: "7일" }))
  expect(screen.getByText(/한국시간/)).toBeInTheDocument()
  await user.click(screen.getByRole("button", { name: "선택 확인" }))
  expect(mock.request).not.toHaveBeenCalled()
  await user.click(screen.getByRole("button", { name: "초대 링크 만들기" }))
  expect(mock.request.mock.calls.map(call => call[1].action)).toEqual(["createInvite"])
  expect(screen.getByRole("button", { name: "초대 링크 복사" })).toBeEnabled()
  expect(document.body.textContent).not.toContain(owner)
  expect(document.body.textContent).not.toContain(cid)
  expect(document.body.textContent).not.toContain(props.documentId)
  expect(screen.queryByLabelText(/계정 ID|비교 ID/)).not.toBeInTheDocument()
})
it("acceptance is not consent; comparison and external sharing require separate review", async () => {
  const { user } = await start()
  expect(mock.request.mock.calls.map(call => call[1].action)).toEqual(["acceptInvite"])
  await user.click(screen.getByRole("button", { name: "비교에 동의하기" }))
  expect(mock.request.mock.calls[1]?.[1]).toMatchObject({ action: "consent", documentRevision: 7, profileRevision: 3, fields: [question.id] })
  expect(mock.request.mock.calls[1]?.[1]).not.toHaveProperty("peerId")
  await user.click(screen.getByText("외부 공유", { selector: "summary" }))
  await user.click(screen.getByRole("button", { name: "공유할 문항 선택" }))
  await user.click(within(screen.getByRole("group", { name: "외부 공유할 문항" })).getByRole("checkbox", { name: question.text }))
  await user.click(screen.getByRole("button", { name: "공유 내용 확인" }))
  expect(screen.getByRole("button", { name: "외부 공유에 동의하기" })).toBeDisabled()
  await user.click(screen.getByRole("checkbox", { name: /외부 공유에 별도로 동의/ }))
  await user.click(screen.getByRole("button", { name: "외부 공유에 동의하기" }))
  expect(mock.request.mock.calls[2]?.[1]).toMatchObject({ action: "allowExternal", fields: [question.id] })
})
it("server denial does not show local success or fabricated comparison", async () => {
  const { user } = await start(); await user.click(screen.getByRole("button", { name: "비교에 동의하기" }))
  await user.click(screen.getByRole("button", { name: "비교 확인" }))
  expect(screen.getByRole("status")).toHaveTextContent("서버에서 권한을 확인하지 못했어요")
  expect(screen.queryByRole("article")).not.toBeInTheDocument()
})
it("late reads cannot repaint facts after withdrawal even when server withdrawal fails", async () => {
  const { user } = await start(); await user.click(screen.getByRole("button", { name: "비교에 동의하기" }))
  let resolve!: (result: ProfileComparisonResult) => void
  mock.request.mockImplementationOnce(() => new Promise(done => { resolve = done }))
  await user.click(screen.getByRole("button", { name: "비교 확인" }))
  mock.request.mockResolvedValueOnce({ ok: false, code: "UNAVAILABLE" })
  await user.click(screen.getByRole("button", { name: "초대·비교 철회" }))
  expect(screen.getByRole("status")).toHaveTextContent("서버 철회는 아직 확인하지 못했어요")
  await act(async () => resolve({ ok: true, data: { kind: "comparison", comparisonId: cid, questionVersion: ownProfile.questionVersion, scoreVersion: ownProfile.scoreVersion,
    sourceProfileRevisions: { self: 3, peer: 1 }, rows: [{ questionId: question.id, label: question.text, same: true }], comparedCount: 1, matchingCount: 1, checkedAt: new Date().toISOString(), validUntil: expiresAt } }))
  expect(screen.queryByRole("article")).not.toBeInTheDocument()
  expect(screen.queryByRole("button", { name: "비교 확인" })).not.toBeInTheDocument()
})
it("owner changes replace ephemeral state and source changes clear pending confirmations", async () => {
  const { view } = await start()
  view.rerender(<OracleConnectedComparison {...props} documentRevision={8} invitationCode={code} />)
  expect(screen.getByRole("checkbox", { name: /선택한 내 응답/ })).not.toBeChecked()
  view.rerender(<OracleConnectedComparison {...props} ownerId={peer} />)
  expect(screen.getByRole("button", { name: "비교 초대 만들기" })).toBeInTheDocument()
})
it("today means KST end of day and seven days preserves the exact duration across host zones", () => {
  const now = Date.parse("2026-10-04T15:30:00.000Z")
  expect(comparisonExpiry("today", now)).toBe("2026-10-05T14:59:59.999Z")
  expect(Date.parse(comparisonExpiry("week", now)) - now).toBe(7 * 86400000)
  expect(readComparisonInvitation("https://example.invalid/#oracle-compare-invite=" + code)).toBe(code)
  expect(readComparisonInvitation(owner)).toBe("")
})
