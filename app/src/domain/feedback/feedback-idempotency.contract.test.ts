import { beforeEach, describe, expect, it } from "vitest"
import {
  completeFeedbackComment,
  completeFeedbackRequest,
  feedbackCommentId,
  feedbackRequestId,
} from "./feedback-idempotency"

beforeEach(() => window.localStorage.clear())

describe("feedback retry identity", () => {
  it("reuses one request id for the same explicit text", async () => {
    const input = { category: "BUG" as const, subject: "버튼이 안 보여요", body: "작은 화면에서 가려져요." }
    expect(await feedbackRequestId(input)).toBe(await feedbackRequestId(input))
  })

  it("uses a new request id after delivery completes", async () => {
    const input = { category: "IDEA" as const, subject: "달력이 필요해요", body: "주간 달력도 보고 싶어요." }
    const first = await feedbackRequestId(input)
    completeFeedbackRequest(first)
    expect(await feedbackRequestId(input)).not.toBe(first)
  })

  it("reuses one comment id until that comment is delivered", async () => {
    const first = await feedbackCommentId("a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1", "추가 설명")
    expect(await feedbackCommentId("a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1", "추가 설명")).toBe(first)
    completeFeedbackComment(first)
    expect(await feedbackCommentId("a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1", "추가 설명")).not.toBe(first)
  })
})
