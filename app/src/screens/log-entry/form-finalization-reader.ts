import { createAccountDocumentBuffer, type AccountJournalDraftView } from "../../domain/account/account-journal-draft-buffer"
import { accountJournalRecordSchema, type AccountJournalRecord } from "../../domain/account/account-journal-record-schema"
import { accountJournalDocumentId } from "../../domain/account/account-journal-record-service"
import { activeLocalAccount } from "../../domain/account/local-journal-ownership"

// Read-only bridge to the finalized service's existing durable operation. Only
// that service may queue, acknowledge, resolve or replace the operation.
export async function readFormFinalization(owner: string | null, entryId: string): Promise<AccountJournalDraftView<AccountJournalRecord> | null> {
  if (!owner) return null
  const buffer = createAccountDocumentBuffer(accountJournalRecordSchema, "trainoracle-account-journal-records-v1")
  try {
    const documentId = await accountJournalDocumentId(owner, entryId)
    if (activeLocalAccount() !== owner) throw new Error("Form scope changed")
    const view = await buffer.read(owner, documentId)
    if (activeLocalAccount() !== owner || view && view.draft.entry.id !== entryId) throw new Error("Form scope changed")
    return view
  } finally { buffer.close() }
}
