import { feedbackClient } from "./feedback-client"
import { feedbackThreadListSchema } from "./feedback-schema"
import { feedbackReceiptToken } from "./feedback-token"
import {
  completeFeedbackComment,
  completeFeedbackRequest,
  feedbackCommentId,
  feedbackRequestId,
} from "./feedback-idempotency"
import type { FeedbackGateway, NewFeedback } from "./feedback-types"

async function readyClient() {
  const client = await feedbackClient()
  if (client === null) throw new Error("FEEDBACK_BOARD_UNAVAILABLE")
  return client
}

async function list() {
  const client = await readyClient()
  const { data, error } = await client.rpc("list_my_feedback_threads", {
    client_token_input: feedbackReceiptToken(),
  })
  if (error !== null) throw error
  return feedbackThreadListSchema.parse(data)
}

async function submit(input: NewFeedback): Promise<void> {
  const client = await readyClient()
  const requestId = await feedbackRequestId(input)
  const { error } = await client.rpc("submit_feedback_thread", {
    client_token_input: feedbackReceiptToken(),
    client_request_id_input: requestId,
    category_input: input.category,
    subject_input: input.subject,
    body_input: input.body,
  })
  if (error !== null) throw error
  completeFeedbackRequest(requestId)
}

async function append(threadId: string, body: string): Promise<void> {
  const client = await readyClient()
  const commentId = await feedbackCommentId(threadId, body)
  const { error } = await client.rpc("append_feedback_comment", {
    client_token_input: feedbackReceiptToken(),
    thread_id_input: threadId,
    client_comment_id_input: commentId,
    body_input: body,
  })
  if (error !== null) throw error
  completeFeedbackComment(commentId)
}

async function remove(threadId: string): Promise<void> {
  const client = await readyClient()
  const { data, error } = await client.rpc("delete_my_feedback_thread", {
    client_token_input: feedbackReceiptToken(),
    thread_id_input: threadId,
  })
  if (error !== null) throw error
  if (data !== true) throw new Error("FEEDBACK_THREAD_DELETE_REJECTED")
}

export const feedbackGateway: FeedbackGateway = { list, submit, append, remove }
