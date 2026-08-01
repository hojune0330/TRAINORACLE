import type { SupabaseClient } from "@supabase/supabase-js"
import { z } from "zod"
import type { JournalEntry } from "../journal-schema"
import {
  decryptPrivateJournalEntry,
  encryptPrivateJournalEntry,
} from "./private-note-sync"

const TABLE = "encrypted_private_notes"
const privateNoteRowsSchema = z.array(z.object({
  entry_id: z.string(),
  encrypted_payload: z.unknown(),
}))

export type PrivateNotePull = {
  readonly ok: boolean
  readonly message: string
  readonly entries: readonly JournalEntry[]
  readonly remoteEntryIds: readonly string[]
}

export async function pullPrivateJournalEntries(
  client: SupabaseClient,
  userId: string,
  recoveryCode: string | null,
): Promise<PrivateNotePull> {
  if (recoveryCode === null) return { ok: true, message: "", entries: [], remoteEntryIds: [] }
  const { data, error } = await client
    .from(TABLE)
    .select("entry_id, encrypted_payload")
    .eq("user_id", userId)
  if (error) return { ok: false, message: "암호화된 나만의 메모를 가져오지 못했어요.", entries: [], remoteEntryIds: [] }

  const parsedRows = privateNoteRowsSchema.safeParse(data ?? [])
  if (!parsedRows.success) return { ok: false, message: "암호화된 메모 형식을 확인하지 못했어요.", entries: [], remoteEntryIds: [] }

  const entries: JournalEntry[] = []
  try {
    for (const row of parsedRows.data) {
      const entry = await decryptPrivateJournalEntry(row.encrypted_payload, recoveryCode)
      if (entry === null || entry.id !== row.entry_id) {
        return { ok: false, message: "암호화된 메모가 일지와 맞지 않아요.", entries: [], remoteEntryIds: [] }
      }
      entries.push(entry)
    }
  } catch (error) {
    if (error instanceof Error) {
      return { ok: false, message: "복구 코드가 맞지 않아 나만의 메모를 열지 못했어요.", entries: [], remoteEntryIds: [] }
    }
    throw error
  }
  return {
    ok: true,
    message: "",
    entries,
    remoteEntryIds: parsedRows.data.map((row) => row.entry_id),
  }
}

export async function pushPrivateJournalEntries(
  client: SupabaseClient,
  userId: string,
  entries: readonly JournalEntry[],
  recoveryCode: string | null,
  remoteEntryIds: readonly string[],
  deletedIds: ReadonlySet<string>,
): Promise<{ readonly ok: boolean; readonly message: string }> {
  if (recoveryCode === null) return { ok: true, message: "" }

  const rows: Record<string, unknown>[] = []
  const activePrivateIds = new Set<string>()
  for (const entry of entries) {
    const encrypted = await encryptPrivateJournalEntry(entry, recoveryCode)
    if (encrypted === null) continue
    activePrivateIds.add(entry.id)
    rows.push({
      user_id: userId,
      entry_id: entry.id,
      encrypted_payload: encrypted,
      saved_at: entry.savedAt,
    })
  }
  if (rows.length > 0) {
    const { error } = await client.from(TABLE).upsert(rows, { onConflict: "user_id,entry_id" })
    if (error) return { ok: false, message: "나만의 메모 암호문을 서버에 저장하지 못했어요." }
  }

  const staleIds = remoteEntryIds.filter((id) => !activePrivateIds.has(id) || deletedIds.has(id))
  if (staleIds.length > 0) {
    const { error } = await client.from(TABLE).delete().eq("user_id", userId).in("entry_id", staleIds)
    if (error) return { ok: false, message: "서버의 오래된 개인 메모 암호문을 지우지 못했어요." }
  }
  return { ok: true, message: "" }
}
