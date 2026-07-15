import { createHash, verify } from "node:crypto";

const orders = ["010", "011", "012", "013", "014", "015"];
const orderIds = orders.map((order) => `CODEX_WORK_ORDER_${order}`);
const decisions = Object.fromEntries(
  orders.map((order) => [
    `CODEX_WORK_ORDER_${order}`,
    `ACCEPT_ORDER_${order}_FOR_WO016`,
  ]),
);
const requiredRoles = {
  CODEX_WORK_ORDER_010: ["TOTAL_RESPONSIBILITY_HOLDER", "FABLE_INDEPENDENT_REVIEW"],
  CODEX_WORK_ORDER_011: ["TOTAL_RESPONSIBILITY_HOLDER", "QUALIFIED_PRIVACY_REVIEWER"],
  CODEX_WORK_ORDER_012: ["TOTAL_RESPONSIBILITY_HOLDER", "COACH_OWNER"],
  CODEX_WORK_ORDER_013: ["TOTAL_RESPONSIBILITY_HOLDER", "FABLE_INDEPENDENT_REVIEW"],
  CODEX_WORK_ORDER_014: [
    "TOTAL_RESPONSIBILITY_HOLDER",
    "COACH_OWNER",
    "ATHLETE_REVIEW_PARTICIPANT",
    "FABLE_INDEPENDENT_REVIEW",
  ],
  CODEX_WORK_ORDER_015: [
    "TOTAL_RESPONSIBILITY_HOLDER",
    "COACH_OWNER",
    "ATHLETE_REVIEW_PARTICIPANT",
    "ACCESSIBILITY_REVIEWER",
    "QUALIFIED_PRIVACY_REVIEWER",
  ],
};
const allowedRoles = new Set(Object.values(requiredRoles).flat());
const blockerIds = new Set([
  "OI-FA-COACH-RULESET-001",
  "OI-FA-LOAD-COMPONENT-001",
  "OI-FA-MINIMUM-EVIDENCE-001",
  "OI-FA-PLAN-VERSION-BINDING-001",
  "OI-FA-PILOT-PROTOCOL-001",
  "OI-FA-CALENDAR-SCHEMA-BINDING-001",
  "OI-FA-UPSTREAM-SAFETY-PRIVACY-BINDING-001",
  "OI-FA-RULE-CLASSIFIER-EXPOSURE-BINDING-001",
  "OI-FA-PRODUCT-PROJECTION-001",
  "OI-FA-RECORD-GOVERNANCE-001",
]);
const bundleFields = ["records"];
const contextFields = [
  "blockerClosures",
  "expectedSourceCommitByOrder",
  "trustedKeys",
  "ownerActivation",
];
const recordFields = [
  "recordSchemaVersion",
  "repository",
  "branch",
  "orderId",
  "decision",
  "acceptedAt",
  "sourceCommitSha",
  "evidenceManifestSha256",
  "signedPayloadSha256",
  "contractVersions",
  "remainingRisks",
  "approvals",
];
const approvalFields = [
  "approverId",
  "role",
  "approvedAt",
  "keyId",
  "signatureAlgorithm",
  "signatureBase64",
];
const blockerFields = [
  "id",
  "acceptedDecisionArtifact",
  "approvedTargetPatchPlan",
  "soleMissingEvidence",
];
const hex40 = /^[0-9a-f]{40}$/;
const hex64 = /^[0-9a-f]{64}$/;
const utc = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;

function exactFields(value, fields) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const actual = Object.keys(value).sort();
  const expected = [...fields].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function canonicalValue(value) {
  if (typeof value === "string") return value.normalize("NFC");
  if (typeof value === "number") {
    if (!Number.isFinite(value) || Object.is(value, -0)) throw new Error("INVALID_NUMBER");
    return value;
  }
  if (value === null || typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (!value || typeof value !== "object") throw new Error("INVALID_JSON_VALUE");
  return Object.fromEntries(
    Object.keys(value).sort().map((key) => [key.normalize("NFC"), canonicalValue(value[key])]),
  );
}

export function canonicalizeRecord(record) {
  const preimage = structuredClone(record);
  delete preimage.signedPayloadSha256;
  for (const approval of preimage.approvals ?? []) delete approval.signatureBase64;
  const bytes = Buffer.from(JSON.stringify(canonicalValue(preimage)), "utf8");
  return { bytes, digest: createHash("sha256").update(bytes).digest("hex") };
}

function result(code) {
  return { eligible: false, code };
}

function validateApprovalSet(record, trustedKeys) {
  const roles = new Set();
  const people = new Set();
  const keyIds = new Set();
  for (const approval of record.approvals) {
    if (!exactFields(approval, approvalFields)) return result("UNKNOWN_APPROVAL_FIELD");
    if (!approval.approverId || !approval.keyId || !utc.test(approval.approvedAt)) return result("APPROVAL_MALFORMED");
    if (!allowedRoles.has(approval.role) || approval.signatureAlgorithm !== "ED25519") return result("APPROVAL_MALFORMED");
    if (roles.has(approval.role) || people.has(approval.approverId) || keyIds.has(approval.keyId)) return result("APPROVAL_DUPLICATE");
    roles.add(approval.role);
    people.add(approval.approverId);
    keyIds.add(approval.keyId);
    const trustedIdentity = trustedKeys[approval.keyId];
    if (!trustedIdentity || !exactFields(trustedIdentity, ["publicKeyPem", "approverId", "allowedRoles"]) || trustedIdentity.approverId !== approval.approverId || !Array.isArray(trustedIdentity.allowedRoles) || !trustedIdentity.allowedRoles.includes(approval.role)) return result("KEY_IDENTITY_ROLE_MISMATCH");
  }
  if (!requiredRoles[record.orderId].every((role) => roles.has(role))) return result("APPROVAL_ROLE_MISSING");
  const canonical = canonicalizeRecord(record);
  if (record.signedPayloadSha256 !== canonical.digest) return result("PAYLOAD_HASH_MISMATCH");
  const digestBytes = Buffer.from(canonical.digest, "hex");
  for (const approval of record.approvals) {
    const key = trustedKeys[approval.keyId]?.publicKeyPem;
    const signature = Buffer.from(approval.signatureBase64, "base64");
    if (!key || signature.length !== 64 || !verify(null, digestBytes, key, signature)) {
      return result("SIGNATURE_INVALID");
    }
  }
  return null;
}

export function evaluateGate(bundle, trustedContext) {
  if (!exactFields(bundle, bundleFields)) return result("UNKNOWN_BUNDLE_FIELD");
  if (!exactFields(trustedContext, contextFields)) return result("TRUST_CONTEXT_INVALID");
  const expectedShaIds = Object.keys(trustedContext.expectedSourceCommitByOrder ?? {}).sort();
  if (expectedShaIds.length !== 6 || expectedShaIds.some((id, index) => id !== [...orderIds].sort()[index])) return result("TRUST_CONTEXT_INVALID");
  if (!trustedContext.trustedKeys || typeof trustedContext.trustedKeys !== "object" || Array.isArray(trustedContext.trustedKeys)) return result("TRUST_CONTEXT_INVALID");
  if (!Array.isArray(bundle.records) || bundle.records.length !== 6) return result("ORDER_SET_MISMATCH");
  const recordIds = bundle.records.map((record) => record?.orderId).sort();
  if (recordIds.some((id, index) => id !== [...orderIds].sort()[index])) return result("ORDER_SET_MISMATCH");
  const repository = bundle.records[0]?.repository;
  const branch = bundle.records[0]?.branch;
  for (const record of bundle.records) {
    if (!exactFields(record, recordFields)) return result("UNKNOWN_RECORD_FIELD");
    if (record.recordSchemaVersion !== "TRAINORACLE_WO016_ACCEPTANCE_RECORD_V1") return result("RECORD_SCHEMA_MISMATCH");
    if (record.repository !== "TRAINORACLE" || record.repository !== repository || !record.branch || record.branch !== branch) return result("RECORD_SCOPE_MISMATCH");
    if (record.decision !== decisions[record.orderId] || !utc.test(record.acceptedAt)) return result("DECISION_NOT_ACCEPTED");
    if (!hex40.test(record.sourceCommitSha) || !hex64.test(record.evidenceManifestSha256)) return result("RECORD_HASH_MALFORMED");
    if (trustedContext.expectedSourceCommitByOrder[record.orderId] !== record.sourceCommitSha) return result("SOURCE_SHA_MISMATCH");
    if (!record.contractVersions || !Object.keys(record.contractVersions).length || Object.values(record.contractVersions).some((value) => typeof value !== "string" || !value) || !Array.isArray(record.remainingRisks) || !record.remainingRisks.length || record.remainingRisks.some((risk) => typeof risk !== "string" || !risk) || !Array.isArray(record.approvals)) return result("RECORD_CONTENT_MISSING");
    const approvalError = validateApprovalSet(record, trustedContext.trustedKeys);
    if (approvalError) return approvalError;
  }
  if (!Array.isArray(trustedContext.blockerClosures) || trustedContext.blockerClosures.length !== 10) return result("BLOCKER_SET_MISMATCH");
  const seen = new Set();
  for (const blocker of trustedContext.blockerClosures) {
    if (!exactFields(blocker, blockerFields) || !blockerIds.has(blocker.id) || seen.has(blocker.id)) return result("BLOCKER_SET_MISMATCH");
    seen.add(blocker.id);
    if (blocker.soleMissingEvidence !== null && blocker.soleMissingEvidence !== "WO016_RUNTIME_EVIDENCE") return result("BLOCKER_NOT_CLOSED");
    if (!blocker.acceptedDecisionArtifact || !blocker.approvedTargetPatchPlan) return result("BLOCKER_NOT_CLOSED");
  }
  if (trustedContext.ownerActivation !== true) return result("OWNER_ACTIVATION_ABSENT");
  return { eligible: true, code: "GATE_ELIGIBLE" };
}

export function evaluateGateJson(text, trustedContext) {
  try {
    return evaluateGate(JSON.parse(text), trustedContext);
  } catch {
    return result("MALFORMED_JSON");
  }
}
