import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  indexAttestations,
  loadTrustedReviewerKeys,
  requireHumanAttestation,
} from "./formation-attestations.mjs";
import { parseCsv } from "./formation-csv.mjs";

const root = resolve(import.meta.dirname, "../..");
const acceptedMode = process.argv.includes("--accepted");

const readRows = (path) => {
  const absolute = resolve(root, path);
  if (!existsSync(absolute)) return null;
  return parseCsv(readFileSync(absolute, "utf8"), path).rows;
};
const errors = [];
const fail = (message) => errors.push(message);
const trustedReviewerKeys = loadTrustedReviewerKeys(
  process.env.FORMATION_TRUSTED_REVIEWER_KEYS_JSON,
  errors,
);
const sourceRows = readRows("reports/research/evidence/FORMATION_SOURCE_LEDGER.csv") ?? [];
const lane1 = readRows(".omo/evidence/formation-research-v2/screening-lane-1.csv");
const lane2 = readRows(".omo/evidence/formation-research-v2/screening-lane-2.csv");
const finalRows = readRows("reports/research/evidence/FORMATION_SCREENING_LEDGER.csv") ?? [];
const exclusions = readRows("reports/research/evidence/FORMATION_EXCLUSION_LEDGER.csv") ?? [];
const attestations = readRows("reports/research/evidence/FORMATION_HUMAN_REVIEW_ATTESTATIONS.csv") ?? [];
const sourceIds = new Set(sourceRows.map((row) => row.source_id));
const attestationIndex = indexAttestations(attestations, errors, sourceIds);
const decisions = new Set(["INCLUDE", "EXCLUDE", "DEFER"]);
const exclusionReasonCodes = new Set([
  "IRRELEVANT_EXPOSURE_OR_FRAME",
  "WRONG_SOURCE_IDENTITY",
]);

if (!lane1) fail("missing screening lane 1");
if (!lane2) fail("missing screening lane 2");

function validateLane(name, rows) {
  if (!rows) return;
  const ids = new Set();
  for (const row of rows) {
    if (!sourceIds.has(row.source_id)) fail(`${name} unknown source ${row.source_id}`);
    if (ids.has(row.source_id)) fail(`${name} duplicate source ${row.source_id}`);
    ids.add(row.source_id);
    if (!/^RQ-[A-G]$/.test(row.primary_rq)) fail(`${name} invalid primary RQ ${row.source_id}`);
    if (!decisions.has(row.decision) || !row.reason || !row.reviewer_id) fail(`${name} incomplete decision ${row.source_id}`);
  }
  if (ids.size !== sourceIds.size) fail(`${name} coverage ${ids.size}/${sourceIds.size}`);
}
validateLane("lane1", lane1);
validateLane("lane2", lane2);

const lane1ById = new Map((lane1 ?? []).map((row) => [row.source_id, row]));
const lane2ById = new Map((lane2 ?? []).map((row) => [row.source_id, row]));

const finalIds = new Set();
const finalById = new Map();
for (const row of finalRows) {
  if (!sourceIds.has(row.source_id)) fail(`final unknown source ${row.source_id}`);
  if (finalIds.has(row.source_id)) fail(`final duplicate source ${row.source_id}`);
  finalIds.add(row.source_id);
  finalById.set(row.source_id, row);
  if (!decisions.has(row.lane_1_decision) || !decisions.has(row.lane_2_decision) || !decisions.has(row.adjudication)) {
    fail(`final invalid decision ${row.source_id}`);
  }
  if (!row.lane_1_reason || !row.lane_2_reason || !row.adjudication_reason) fail(`final missing reason ${row.source_id}`);
  if (!new Set(["PENDING_HUMAN", "CONFIRMED"]).has(row.human_confirmation)) fail(`final invalid human state ${row.source_id}`);
  if (!new Set(["ELIGIBLE_FULL_TEXT", "ABSTRACT_LIMITED", "METADATA_LIMITED", "EXCLUDED_IDENTITY_OR_CORRECTION"]).has(row.full_text_eligibility)) {
    fail(`final invalid eligibility ${row.source_id}`);
  }
  const left = lane1ById.get(row.source_id);
  const right = lane2ById.get(row.source_id);
  if (left && right) {
    if (row.lane_1_decision !== left.decision || row.lane_1_reason !== left.reason) {
      fail(`final lane 1 reconciliation ${row.source_id}`);
    }
    if (row.lane_2_decision !== right.decision || row.lane_2_reason !== right.reason) {
      fail(`final lane 2 reconciliation ${row.source_id}`);
    }
    const expectedAdjudication = left.decision === right.decision ? left.decision : "DEFER";
    if (row.human_confirmation !== "CONFIRMED" && row.adjudication !== expectedAdjudication) {
      fail(`final adjudication reconciliation ${row.source_id}`);
    }
    if (row.human_confirmation === "CONFIRMED" || acceptedMode) {
      requireHumanAttestation({
        attestationIndex,
        canonicalRecord: row,
        errors,
        rawRecords: [left, right],
        reviewType: "SCREENING",
        sourceId: row.source_id,
        trustedReviewerKeys,
      });
    }
  }
}
if (finalIds.size !== sourceIds.size) fail(`final coverage ${finalIds.size}/${sourceIds.size}`);

const excludedIds = new Set(finalRows.filter((row) => row.adjudication === "EXCLUDE").map((row) => row.source_id));
const exclusionIds = new Set(exclusions.map((row) => row.source_id));
if (exclusionIds.size !== exclusions.length) fail("duplicate exclusion records");
for (const id of excludedIds) if (!exclusionIds.has(id)) fail(`missing exclusion ledger row ${id}`);
for (const row of exclusions) {
  const left = lane1ById.get(row.source_id);
  const right = lane2ById.get(row.source_id);
  const final = finalById.get(row.source_id);
  if (
    !excludedIds.has(row.source_id)
    || row.decision !== "EXCLUDE"
    || !exclusionReasonCodes.has(row.primary_reason_code)
    || !row.reason
    || row.lane_1_reason !== left?.reason
    || row.lane_2_reason !== right?.reason
  ) {
    fail(`invalid exclusion row ${row.source_id}`);
  }
  const expectedHumanState = final?.human_confirmation === "CONFIRMED"
    ? "CONFIRMED"
    : "PENDING_HUMAN";
  const expectedAdjudication = expectedHumanState === "CONFIRMED"
    ? "HUMAN_CONFIRMED"
    : "PENDING_HUMAN_CONFIRMATION";
  if (row.human_confirmation !== expectedHumanState || row.adjudication !== expectedAdjudication) {
    fail(`invalid exclusion review state ${row.source_id}`);
  }
}

const pending = finalRows.filter((row) => row.human_confirmation !== "CONFIRMED").length;
const deferred = finalRows.filter((row) => row.adjudication === "DEFER").length;
if (acceptedMode && (pending > 0 || deferred > 0)) fail(`acceptance blocked pending_human=${pending} deferred=${deferred}`);

if (errors.length > 0) {
  for (const error of errors) console.error(`FORMATION_SCREENING_INVALID ${error}`);
  process.exitCode = 1;
} else {
  console.log(`FORMATION_SCREENING_${acceptedMode ? "ACCEPTED" : "PREPARED"} sources=${sourceIds.size} excluded=${excludedIds.size} deferred=${deferred} pending_human=${pending}`);
}
