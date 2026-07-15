import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import { canonicalizeRecord, evaluateGateJson } from "./wo016-gate-verifier.mjs";

const orders = ["010", "011", "012", "013", "014", "015"];
const decisions = Object.fromEntries(
  orders.map((order) => [order, `ACCEPT_ORDER_${order}_FOR_WO016`]),
);
const roles = {
  "010": ["TOTAL_RESPONSIBILITY_HOLDER", "FABLE_INDEPENDENT_REVIEW"],
  "011": ["TOTAL_RESPONSIBILITY_HOLDER", "QUALIFIED_PRIVACY_REVIEWER"],
  "012": ["TOTAL_RESPONSIBILITY_HOLDER", "COACH_OWNER"],
  "013": ["TOTAL_RESPONSIBILITY_HOLDER", "FABLE_INDEPENDENT_REVIEW"],
  "014": [
    "TOTAL_RESPONSIBILITY_HOLDER",
    "COACH_OWNER",
    "ATHLETE_REVIEW_PARTICIPANT",
    "FABLE_INDEPENDENT_REVIEW",
  ],
  "015": [
    "TOTAL_RESPONSIBILITY_HOLDER",
    "COACH_OWNER",
    "ATHLETE_REVIEW_PARTICIPANT",
    "ACCESSIBILITY_REVIEWER",
    "QUALIFIED_PRIVACY_REVIEWER",
  ],
};
const blockers = [
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
];

const keyPairs = new Map();
function keyFor(role) {
  if (!keyPairs.has(role)) keyPairs.set(role, generateKeyPairSync("ed25519"));
  return keyPairs.get(role);
}

function makeBundle() {
  const expectedSourceCommitByOrder = {};
  const trustedKeys = {};
  const records = orders.map((order, orderIndex) => {
    const orderId = `CODEX_WORK_ORDER_${order}`;
    const sourceCommitSha = `${orderIndex + 1}`.repeat(40);
    expectedSourceCommitByOrder[orderId] = sourceCommitSha;
    const approvals = roles[order].map((role, roleIndex) => {
      const keyId = `synthetic-${order}-${roleIndex}`;
      const pair = keyFor(keyId);
      trustedKeys[keyId] = {
        publicKeyPem: pair.publicKey.export({ type: "spki", format: "pem" }),
        approverId: `person-${order}-${roleIndex}`,
        allowedRoles: [role],
      };
      return {
        approverId: `person-${order}-${roleIndex}`,
        role,
        approvedAt: "2026-07-16T00:00:00Z",
        keyId,
        signatureAlgorithm: "ED25519",
        signatureBase64: "",
      };
    });
    const record = {
      recordSchemaVersion: "TRAINORACLE_WO016_ACCEPTANCE_RECORD_V1",
      repository: "TRAINORACLE",
      branch: "codex/synthetic-gate-fixture",
      orderId,
      decision: decisions[order],
      acceptedAt: "2026-07-16T00:00:00Z",
      sourceCommitSha,
      evidenceManifestSha256: `${orderIndex + 1}`.repeat(64),
      signedPayloadSha256: "",
      contractVersions: { formation: "synthetic-v1" },
      remainingRisks: ["synthetic fixture only"],
      approvals,
    };
    const { digest } = canonicalizeRecord(record);
    record.signedPayloadSha256 = digest;
    for (const approval of record.approvals) {
      approval.signatureBase64 = sign(
        null,
        Buffer.from(digest, "hex"),
        keyFor(approval.keyId).privateKey,
      ).toString("base64");
    }
    return record;
  });
  return {
    candidate: { records },
    trustedContext: {
      blockerClosures: blockers.map((id) => ({
        id,
        acceptedDecisionArtifact: true,
        approvedTargetPatchPlan: true,
        soleMissingEvidence: null,
      })),
      expectedSourceCommitByOrder,
      trustedKeys,
      ownerActivation: true,
    },
  };
}

function reject(mutator, code) {
  const fixture = structuredClone(makeBundle());
  mutator(fixture);
  assert.equal(
    evaluateGateJson(JSON.stringify(fixture.candidate), fixture.trustedContext).code,
    code,
  );
}

const valid = makeBundle();
assert.deepEqual(
  evaluateGateJson(JSON.stringify(valid.candidate), valid.trustedContext),
  { eligible: true, code: "GATE_ELIGIBLE" },
);
reject((f) => { f.candidate.extra = true; }, "UNKNOWN_BUNDLE_FIELD");
reject((f) => { f.candidate.records.pop(); }, "ORDER_SET_MISMATCH");
reject((f) => { f.candidate.records[5] = structuredClone(f.candidate.records[4]); }, "ORDER_SET_MISMATCH");
reject((f) => { f.candidate.records[0].sourceCommitSha = "f".repeat(40); }, "SOURCE_SHA_MISMATCH");
reject((f) => { f.candidate.records[0].approvals[0].signatureBase64 = "AA=="; }, "SIGNATURE_INVALID");
reject((f) => { f.candidate.records[0].approvals[1].role = f.candidate.records[0].approvals[0].role; }, "APPROVAL_DUPLICATE");
reject((f) => { f.candidate.records[0].extra = true; }, "UNKNOWN_RECORD_FIELD");
reject((f) => { f.trustedContext.blockerClosures[0].approvedTargetPatchPlan = false; }, "BLOCKER_NOT_CLOSED");
reject((f) => { f.trustedContext.ownerActivation = false; }, "OWNER_ACTIVATION_ABSENT");
reject((f) => { f.candidate.trustedKeys = f.trustedContext.trustedKeys; }, "UNKNOWN_BUNDLE_FIELD");
reject((f) => { f.candidate.expectedSourceCommitByOrder = f.trustedContext.expectedSourceCommitByOrder; }, "UNKNOWN_BUNDLE_FIELD");
reject((f) => { f.candidate.blockerClosures = f.trustedContext.blockerClosures; }, "UNKNOWN_BUNDLE_FIELD");
reject((f) => { f.candidate.ownerActivation = true; }, "UNKNOWN_BUNDLE_FIELD");
reject((f) => {
  const approval = f.candidate.records[0].approvals[0];
  f.trustedContext.trustedKeys[approval.keyId].allowedRoles = ["COACH_OWNER"];
}, "KEY_IDENTITY_ROLE_MISMATCH");
reject((f) => {
  const approvals = f.candidate.records[0].approvals;
  approvals[1].keyId = approvals[0].keyId;
}, "APPROVAL_DUPLICATE");
assert.equal(evaluateGateJson("{", valid.trustedContext).code, "MALFORMED_JSON");

console.log("PASS WO016 synthetic gate verifier RED/GREEN cases=17");
