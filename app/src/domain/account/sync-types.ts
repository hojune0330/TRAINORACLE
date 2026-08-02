export type SyncFailureCode =
  | "NO_AUTH_SESSION"
  | "SERVER_SCHEMA_OUTDATED"
  | "SESSION_TARGET_MISMATCH"
  | "SYNC_RECOVERY_FAILED"

export type SyncOutcome = {
  readonly ok: boolean
  readonly message: string
  readonly pulled: number
  readonly pushed: number
  readonly deleted: number
  readonly total: number
  readonly failureCode?: SyncFailureCode
}

export type SyncPreviewOutcome = {
  readonly ok: boolean
  readonly message: string
  readonly localCount: number
  readonly remoteJournalCount: number
  readonly remotePrivateCount: number
  readonly failureCode?: SyncFailureCode
}
