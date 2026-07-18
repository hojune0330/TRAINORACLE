import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import test from "node:test";

import {
  indexAttestations,
  loadTrustedReviewerKeys,
  recordBundleHash,
  requireHumanAttestation,
} from "./formation-attestations.mjs";

const rawRecords = [{ source_id: "SRC-1", decision: "INCLUDE" }];
const canonicalRecord = { source_id: "SRC-1", adjudication: "INCLUDE" };
const reviewerId = "KIM_MINJI_SPORTS_SCIENTIST";
const qualificationRef = "https://credential.example/reviewer/kim-minji";
const { privateKey, publicKey } = generateKeyPairSync("ed25519");
const publicKeyPem = publicKey.export({ format: "pem", type: "spki" });

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

function signedAttestation(overrides = {}) {
  const row = {
    review_type: "SCREENING",
    source_id: "SRC-1",
    reviewer_id: reviewerId,
    qualification_ref: qualificationRef,
    decision: "APPROVE",
    raw_input_sha256: recordBundleHash(rawRecords),
    canonical_record_sha256: recordBundleHash([canonicalRecord]),
    reviewed_at: "2026-07-17T21:00:00+09:00",
    record_ref: "https://review.example/formation/1",
    key_id: "SPORTS-SCIENCE-KEY-1",
    signature_algorithm: "Ed25519",
    signature_base64: "",
    ...overrides,
  };
  row.signature_base64 = sign(null, Buffer.from(signaturePayload(row)), privateKey).toString("base64");
  return row;
}

function trustedKeys() {
  const errors = [];
  const keys = loadTrustedReviewerKeys(JSON.stringify([{
    key_id: "SPORTS-SCIENCE-KEY-1",
    reviewer_id: reviewerId,
    qualification_ref: qualificationRef,
    public_key_pem: publicKeyPem,
  }]), errors);
  assert.deepEqual(errors, []);
  return keys;
}

function validate(row, keys = trustedKeys()) {
  const errors = [];
  requireHumanAttestation({
    attestationIndex: new Map([["SCREENING:SRC-1", row]]),
    canonicalRecord,
    errors,
    rawRecords,
    reviewType: "SCREENING",
    sourceId: "SRC-1",
    trustedReviewerKeys: keys,
  });
  return errors;
}

test("human attestation rejects known AI agent identities", () => {
  for (const identity of ["CODEX", "FABLE", "CHATGPT", "AI_REVIEWER", "AGENT_7"]) {
    assert.match(validate(signedAttestation({ reviewer_id: identity })).join("\n"), /invalid human reviewer/u);
  }
});

test("human attestation accepts a signed trusted reviewer identity", () => {
  assert.deepEqual(validate(signedAttestation()), []);
});

test("human attestation rejects placeholder authority references", () => {
  assert.match(
    validate(signedAttestation({ qualification_ref: "TBD" })).join("\n"),
    /incomplete human authority/u,
  );
  assert.match(
    validate(signedAttestation({ record_ref: "UNVERIFIED" })).join("\n"),
    /incomplete human authority/u,
  );
});

test("human attestation rejects a self-signed untrusted reviewer", () => {
  assert.match(validate(signedAttestation(), new Map()).join("\n"), /untrusted reviewer key/u);
});

test("human attestation rejects signed-field tampering", () => {
  const row = signedAttestation();
  row.record_ref = "https://attacker.example/forged-review";
  assert.match(validate(row).join("\n"), /invalid human signature/u);
});

test("attestation index rejects unknown sources and review types", () => {
  const errors = [];
  indexAttestations([
    signedAttestation({ source_id: "SRC-UNKNOWN" }),
    signedAttestation({ review_type: "RUNTIME_APPROVAL" }),
  ], errors, new Set(["SRC-1"]));
  assert.match(errors.join("\n"), /unknown attestation source SRC-UNKNOWN/u);
  assert.match(errors.join("\n"), /invalid attestation review type RUNTIME_APPROVAL/u);
});
