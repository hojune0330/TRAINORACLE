export type FeedbackCategory = "BUG" | "IDEA" | "QUESTION"
export type FeedbackAuthor = "USER" | "OPERATOR"
export type FeedbackStatus = "OPEN" | "ANSWERED" | "RESOLVED"

export type FeedbackComment = {
  readonly id: string
  readonly author: FeedbackAuthor
  readonly body: string
  readonly createdAt: string
}

export type FeedbackThread = {
  readonly id: string
  readonly category: FeedbackCategory
  readonly subject: string
  readonly status: FeedbackStatus
  readonly createdAt: string
  readonly lastActivityAt: string
  readonly comments: readonly FeedbackComment[]
}

export type NewFeedback = {
  readonly category: FeedbackCategory
  readonly subject: string
  readonly body: string
}

export type FeedbackGateway = {
  readonly list: () => Promise<readonly FeedbackThread[]>
  readonly submit: (input: NewFeedback) => Promise<void>
  readonly append: (threadId: string, body: string) => Promise<void>
  readonly remove: (threadId: string) => Promise<void>
}
