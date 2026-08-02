import type { NewFeedback } from "./feedback-types"

const PENDING_KEY = "trainoracle.feedback.pending.v1"
const PENDING_COMMENT_KEY = "trainoracle.feedback.comment.pending.v1"

async function signature(input: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(input))
  const digest = await crypto.subtle.digest("SHA-256", bytes)
  return Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, "0")).join("")
}

function storedPending(key: string): { readonly id: string; readonly signature: string } | null {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(key) ?? "null")
    if (typeof parsed !== "object" || parsed === null || !("id" in parsed) || !("signature" in parsed)) return null
    if (typeof parsed.id !== "string" || typeof parsed.signature !== "string") return null
    return { id: parsed.id, signature: parsed.signature }
  } catch {
    return null
  }
}

export async function feedbackRequestId(input: NewFeedback): Promise<string> {
  const inputSignature = await signature(input)
  const pending = storedPending(PENDING_KEY)
  if (pending !== null && pending.signature === inputSignature) return pending.id
  const id = crypto.randomUUID()
  try {
    window.localStorage.setItem(PENDING_KEY, JSON.stringify({ id, signature: inputSignature }))
  } catch {
  }
  return id
}

export function completeFeedbackRequest(id: string): void {
  completePending(PENDING_KEY, id)
}

export async function feedbackCommentId(threadId: string, body: string): Promise<string> {
  const inputSignature = await signature({ threadId, body })
  const pending = storedPending(PENDING_COMMENT_KEY)
  if (pending !== null && pending.signature === inputSignature) return pending.id
  const id = crypto.randomUUID()
  try {
    window.localStorage.setItem(PENDING_COMMENT_KEY, JSON.stringify({ id, signature: inputSignature }))
  } catch {
  }
  return id
}

export function completeFeedbackComment(id: string): void {
  completePending(PENDING_COMMENT_KEY, id)
}

function completePending(key: string, id: string): void {
  const pending = storedPending(key)
  if (pending?.id === id) {
    try {
      window.localStorage.removeItem(key)
    } catch {
    }
  }
}
