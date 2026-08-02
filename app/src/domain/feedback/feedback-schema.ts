import { z } from "zod"

const feedbackCommentSchema = z.object({
  id: z.string().uuid(),
  author: z.enum(["USER", "OPERATOR"]),
  body: z.string().min(1).max(2000),
  createdAt: z.string(),
})

export const feedbackThreadListSchema = z.array(z.object({
  id: z.string().uuid(),
  category: z.enum(["BUG", "IDEA", "QUESTION"]),
  subject: z.string().min(4).max(120),
  status: z.enum(["OPEN", "ANSWERED", "RESOLVED"]),
  createdAt: z.string(),
  lastActivityAt: z.string(),
  comments: z.array(feedbackCommentSchema),
}))
