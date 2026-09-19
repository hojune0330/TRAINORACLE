import { decryptAccountJournalDocument } from './account-journal-crypto.mjs';
import { accountPlanCollectionDocumentId, accountPlanCollectionMetadata, MAX_PART_BYTES } from './account-plan-collection-handler.mjs';
import { validateAccountPlanCollectionIndex, validateAccountPlanCollectionPart,
  accountPlanCollectionPartHash, accountPlanFingerprint } from './account-plan-collection-validator.mjs';
import { resolveComparisonOriginalFromPlanCollection } from './account-journal-record-validator.mjs';

const keys = (v, names) => v && typeof v === 'object' && !Array.isArray(v)
  && Object.keys(v).length === names.length && names.every(k => Object.hasOwn(v, k));
const invalid = () => { throw new Error('INVALID_COMPARISON_STORED_DATA'); };

/** Uses the caller-JWT repository, physical addresses, AAD and row/hash checks
 * from account-plan-collection readIndex/readPart. Staged parts are not originals. */
export async function readAccountJournalComparisonCollection(ownerId, repo, material, reference) {
  if (!repo) return null;
  const gate = async () => { if (await repo.enabled(ownerId) !== true) invalid(); };
  await gate();
  const ready = await repo.attestationStatus();
  if (!keys(ready, ['kind']) || ready.kind !== 'ready') invalid();
  const decode = async (payload, kind, id) => {
    const key = material.get(payload?.keyId);
    if (!key) invalid();
    const value = JSON.parse(await decryptAccountJournalDocument(payload,
      { ownerId, documentId: await accountPlanCollectionDocumentId(ownerId, kind, id) }, key));
    if (new TextEncoder().encode(JSON.stringify(value)).byteLength > MAX_PART_BYTES) invalid();
    return value;
  };
  const row = await repo.readIndex();
  if (row === null) { await gate(); return null; }
  if (!keys(row, ['revision', 'index_fingerprint', 'index_document', 'payload'])
    || !Number.isSafeInteger(row.revision) || row.revision < 1 || row.revision > Number.MAX_SAFE_INTEGER - 1) invalid();
  const index = await decode(row.payload, 'PLAN_COLLECTION', 'index');
  if (!validateAccountPlanCollectionIndex(index) || row.index_fingerprint !== accountPlanFingerprint(index)
    || accountPlanFingerprint(row.index_document) !== accountPlanFingerprint(index)) invalid();
  const ref = index.plans.find(value => value.planId === reference.planFingerprint);
  if (!ref) { await gate(); return null; }
  const readPart = async (kind, id) => {
    const row = await repo.readPart(kind, id);
    if (row === null) return null;
    if (!keys(row, ['part_kind', 'part_id', 'plan_id', 'content_hash', 'payload', 'metadata'])
      || row.part_kind !== kind || row.part_id !== id) invalid();
    const part = await decode(row.payload, kind, id);
    if (!validateAccountPlanCollectionPart(part) || part.kind !== kind || part.id !== id
      || row.plan_id !== part.planId || row.content_hash !== accountPlanCollectionPartHash(part)
      || accountPlanFingerprint(row.metadata) !== accountPlanFingerprint(accountPlanCollectionMetadata(part))) invalid();
    return part;
  };
  const snapshot = await readPart('PLAN_SNAPSHOT', ref.snapshotId);
  const progress = await readPart('PLAN_PROGRESS', ref.progressId);
  await gate();
  if (!snapshot || !progress) return null;
  return resolveComparisonOriginalFromPlanCollection(index, snapshot, progress, reference);
}
