import { createHash, verify } from "node:crypto";

const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const authorityPlaceholder = /^(?:NONE|NOT_APPLICABLE|PENDING|PLACEHOLDER|SELF_ATTESTED|TBD|TODO|UNKNOWN|UNVERIFIED)$/iu;

function stableRecord(record) {
  return Object.fromEntries(
    Object.entries(record).toSorted(([left], [right]) => left.localeCompare(right)),
  );
}

export function recordBundleHash(records) {
  return sha256(JSON.stringify(records.map(stableRecord)));
}

function signaturePayload(row) {
  return JSON.stringify({
    review_type: row.review_type,
    source_id: row.source_id,
    reviewer_id: row.reviewer_id,
    qualification_ref: row.qualification_ref,
    decision: row.decision,
    raw_input_sha256: row.raw_input_sha256,
    canonical_record_sha256: row.canonical_record_sha256,
    reviewed_at: row.reviewed_at,
    record_ref: row.record_ref,
    key_id: row.key_id,
    signature_algorithm: row.signature_algorithm,
  });
}

export function loadTrustedReviewerKeys(raw, errors) {
  const keys = new Map();
  if (!raw) return keys;
  try {
    const records = JSON.parse(raw);
    if (!Array.isArray(records)) throw new Error("expected an array");
    for (const record of records) {
      if (
        !record?.key_id
        || !record.reviewer_id
        || !record.qualification_ref
        || !record.public_key_pem
        || keys.has(record.key_id)
      ) throw new Error("invalid or duplicate key record");
      keys.set(record.key_id, {
        qualificationRef: record.qualification_ref,
        publicKeyPem: record.public_key_pem,
        reviewerId: record.reviewer_id,
      });
    }
  } catch (error) {
    errors.push(`invalid FORMATION_TRUSTED_REVIEWER_KEYS_JSON: ${error.message}`);
  }
  return keys;
}

export function indexAttestations(rows, errors, sourceIds) {
  const index = new Map();
  for (const row of rows) {
    const key = `${row.review_type}:${row.source_id}`;
    if (!new Set(["APPRAISAL", "EXTRACTION", "SCREENING"]).has(row.review_type)) {
      errors.push(`invalid attestation review type ${row.review_type}`);
    }
    if (!sourceIds.has(row.source_id)) errors.push(`unknown attestation source ${row.source_id}`);
    if (index.has(key)) errors.push(`duplicate human attestation ${key}`);
    index.set(key, row);
  }
  return index;
}

export function requireHumanAttestation({
  attestationIndex,
  canonicalRecord,
  errors,
  rawRecords,
  reviewType,
  sourceId,
  trustedReviewerKeys,
}) {
  const key = `${reviewType}:${sourceId}`;
  const row = attestationIndex.get(key);
  if (!row) {
    errors.push(`missing human attestation ${key}`);
    return;
  }
  if (
    !row.reviewer_id
    || /^(?:AI(?:_|$)|AGENT(?:_|$)|CHATGPT|CLAUDE|CODEX|COPILOT|FABLE|GEMINI|LLM|NOT_APPLICABLE|OPENAI|UNASSIGNED)/iu
      .test(row.reviewer_id)
  ) {
    errors.push(`invalid human reviewer ${key}`);
  }
  if (
    !row.qualification_ref
    || !row.record_ref
    || authorityPlaceholder.test(row.qualification_ref)
    || authorityPlaceholder.test(row.record_ref)
  ) errors.push(`incomplete human authority ${key}`);
  if (row.decision !== "APPROVE") errors.push(`human decision is not APPROVE ${key}`);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:Z|[+-]\d{2}:\d{2})$/u.test(row.reviewed_at)) {
    errors.push(`invalid human review timestamp ${key}`);
  }
  if (row.raw_input_sha256 !== recordBundleHash(rawRecords)) {
    errors.push(`human attestation raw hash mismatch ${key}`);
  }
  if (row.canonical_record_sha256 !== recordBundleHash([canonicalRecord])) {
    errors.push(`human attestation canonical hash mismatch ${key}`);
  }
  const trustedKey = trustedReviewerKeys.get(row.key_id);
  if (
    !trustedKey
    || trustedKey.reviewerId !== row.reviewer_id
    || trustedKey.qualificationRef !== row.qualification_ref
  ) {
    errors.push(`untrusted reviewer key ${key}`);
    return;
  }
  if (row.signature_algorithm !== "Ed25519" || !row.signature_base64) {
    errors.push(`invalid human signature ${key}`);
    return;
  }
  try {
    const valid = verify(
      null,
      Buffer.from(signaturePayload(row)),
      trustedKey.publicKeyPem,
      Buffer.from(row.signature_base64, "base64"),
    );
    if (!valid) errors.push(`invalid human signature ${key}`);
  } catch {
    errors.push(`invalid human signature ${key}`);
  }
}
