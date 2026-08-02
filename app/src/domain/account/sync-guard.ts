import { loadEntries } from "../journal-store"
import { supabase } from "./supabase-client"
import type { SyncFailureCode, SyncOutcome } from "./sync-types"

const REQUIRED_SYNC_SCHEMA_VERSION = 17

type SyncClient = NonNullable<Awaited<ReturnType<typeof supabase>>>

export async function sessionFailureCode(
  client: SyncClient,
  userId: string,
): Promise<SyncFailureCode | null> {
  const { data, error } = await client.auth.getSession()
  if (error !== null || data.session === null) return "NO_AUTH_SESSION"
  return userId === "" || data.session.user.id !== userId ? "SESSION_TARGET_MISMATCH" : null
}

export async function hasSupportedSyncSchema(client: SyncClient): Promise<boolean> {
  const { data, error } = await client.rpc("get_sync_schema_version")
  return error === null
    && typeof data === "number"
    && Number.isInteger(data)
    && data >= REQUIRED_SYNC_SCHEMA_VERSION
}

export function failed(message: string, failureCode?: SyncFailureCode): SyncOutcome {
  return {
    ok: false,
    message,
    pulled: 0,
    pushed: 0,
    deleted: 0,
    total: loadEntries().length,
    failureCode,
  }
}
