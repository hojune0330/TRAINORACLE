import { z } from "zod"
import { createAccountDocumentBuffer, type AccountJournalConflictBuffer, type AccountJournalDraftView } from "../../domain/account/account-journal-draft-buffer"
import { decodeFormDraft, formDraftEnvelopeSchema } from "./form-input-draft"

export const formRecoverySchema = z.object({
  version: z.literal(1), state: z.enum(["OPEN", "ARCHIVED"]),
  originDocumentId: z.uuid(), reason: z.enum(["LOCAL_CAS", "BEFORE_REPLACEMENT", "CONFLICT_ARCHIVE"]),
  createdAt: z.iso.datetime(), snapshot: formDraftEnvelopeSchema,
}).strict()
export type FormRecovery = z.infer<typeof formRecoverySchema>
export type FormRecoveryItem = AccountJournalDraftView<FormRecovery>
export type FormEnvelope = z.infer<typeof formDraftEnvelopeSchema>

export function createFormRecoveryBuffer() {
  return createAccountDocumentBuffer(formRecoverySchema, "trainoracle-form-input-recovery-v1")
}

/** Local recovery copies never enter the transport outbox or journal projections. */
export function createFormRecoveryCoordinator(primary: AccountJournalConflictBuffer<FormEnvelope>,
  owner: string, doc: string, context: string, current: () => boolean,
  storage: AccountJournalConflictBuffer<FormRecovery> = createFormRecoveryBuffer()) {
  const guard = () => { if (!current()) throw new Error("Form recovery scope changed") }
  const validate = (snapshot: FormEnvelope) => {
    guard()
    if (decodeFormDraft(snapshot).context !== context) throw new Error("Form recovery context mismatch")
  }
  async function preserve(snapshot: FormEnvelope, reason: FormRecovery["reason"], state: FormRecovery["state"] = "OPEN",
    previous?: FormRecoveryItem): Promise<FormRecoveryItem> {
    validate(snapshot)
    if (previous && previous.draft.originDocumentId !== doc) throw new Error("Form recovery document mismatch")
    const id = previous?.documentId ?? crypto.randomUUID()
    await storage.saveDraft(owner, id, { version: 1, state, originDocumentId: doc, reason,
      createdAt: previous?.draft.createdAt ?? new Date().toISOString(), snapshot }, previous?.localSequence ?? 0)
    guard()
    const item = await storage.read(owner, id)
    if (!item) throw new Error("Form recovery unavailable")
    return item
  }
  return {
    preserve,
    async list() {
      const items = await storage.list(owner)
      guard()
      return items.filter(item => item.draft.originDocumentId === doc
        && decodeFormDraft(item.draft.snapshot).context === context)
    },
    async choose(item: FormRecoveryItem, expectedPrimarySequence: number, choice: "RECOVERY" | "CURRENT") {
      guard()
      const source = await storage.read(owner, item.documentId)
      const target = await primary.read(owner, doc)
      guard()
      if (!source || source.draft.originDocumentId !== doc || source.localSequence !== item.localSequence || (target?.localSequence ?? 0) !== expectedPrimarySequence) {
        throw new Error("Form recovery changed; review again")
      }
      validate(source.draft.snapshot)
      if (choice === "RECOVERY") {
        if (target?.resolvedDeletion) throw new Error("Deleted form cannot be overwritten")
        // Preserve the other side before replacing it. A later CAS failure leaves
        // both originals intact; no transaction spans two encrypted databases.
        if (target) await preserve(target.draft, "BEFORE_REPLACEMENT", "ARCHIVED")
        guard()
        await primary.saveDraft(owner, doc, source.draft.snapshot, expectedPrimarySequence)
      }
      guard()
      await storage.saveDraft(owner, source.documentId, { ...source.draft, state: "ARCHIVED" }, source.localSequence)
      guard()
      return primary.read(owner, doc)
    },
    logout() { storage.logout(owner) },
    close() { storage.close() },
  }
}
