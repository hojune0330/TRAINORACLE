export const ACCOUNT_WRITE_REJECTIONS = [
  "PLANNED_SESSION_ALREADY_RECORDED", "INSUFFICIENT_POINTS", "OPERATION_REPLAY_UNAVAILABLE",
] as const
export type AccountJournalWriteRejection = (typeof ACCOUNT_WRITE_REJECTIONS)[number]
export function isAccountJournalWriteRejection(value: unknown): value is AccountJournalWriteRejection {
  return ACCOUNT_WRITE_REJECTIONS.some(reason => reason === value)
}
