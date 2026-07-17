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
const scopes = ["abc", "d", "e", "fg"];
const errors = [];
const trustedReviewerKeys = loadTrustedReviewerKeys(
  process.env.FORMATION_TRUSTED_REVIEWER_KEYS_JSON,
  errors,
);

function readCsv(relativePath) {
  const absolute = resolve(root, relativePath);
  if (!existsSync(absolute)) return null;
  return parseCsv(readFileSync(absolute, "utf8"), relativePath);
}

function indexUnique(rows, label, expectedSize) {
  const index = new Map();
  for (const row of rows) {
    if (index.has(row.source_id)) errors.push(`${label} duplicate ${row.source_id}`);
    index.set(row.source_id, row);
  }
  if (index.size !== expectedSize) errors.push(`${label} coverage ${index.size}/${expectedSize}`);
  return index;
}

const sourceRows = readCsv("reports/research/evidence/FORMATION_SOURCE_LEDGER.csv")?.rows ?? [];
const sourceIds = new Set(sourceRows.map((row) => row.source_id));
const screening = new Map(
  (readCsv("reports/research/evidence/FORMATION_SCREENING_LEDGER.csv")?.rows ?? [])
    .map((row) => [row.source_id, row]),
);
const attestations = readCsv(
  "reports/research/evidence/FORMATION_HUMAN_REVIEW_ATTESTATIONS.csv",
)?.rows ?? [];
const attestationIndex = indexAttestations(attestations, errors, sourceIds);
const laneMaps = new Map();

for (const lane of [1, 2]) {
  const rows = [];
  for (const scope of scopes) {
    const relativePath = `.omo/evidence/formation-research-v2/extraction-${scope}-lane-${lane}.csv`;
    const file = readCsv(relativePath);
    if (!file) {
      errors.push(`missing ${scope} lane ${lane}`);
      continue;
    }
    rows.push(...file.rows);
  }
  const index = indexUnique(rows, `lane ${lane}`, sourceIds.size);
  laneMaps.set(lane, index);
  for (const row of rows) {
    if (!sourceIds.has(row.source_id)) errors.push(`lane ${lane} unknown ${row.source_id}`);
    if (!/^RQ-[A-G]$/u.test(row.rq_id)) errors.push(`lane ${lane} invalid RQ ${row.source_id}`);
    for (const [field, value] of Object.entries(row)) {
      if (!value) errors.push(`lane ${lane} empty field ${row.source_id}:${field}`);
    }
  }
}

const canonicalFile = readCsv("reports/research/evidence/FORMATION_EVIDENCE_EXTRACTION.csv");
const canonical = canonicalFile?.rows ?? [];
const canonicalById = indexUnique(canonical, "canonical", sourceIds.size);
const evidenceFields = (canonicalFile?.headers ?? []).filter(
  (field) => !["source_id", "rq_id", "reviewer_1", "reviewer_2", "adjudication"].includes(field),
);
const conflictRows = readCsv("reports/research/evidence/FORMATION_EXTRACTION_CONFLICTS.csv")?.rows ?? [];
const conflictsByKey = new Map();
for (const row of conflictRows) {
  const key = `${row.source_id}:${row.field}`;
  if (conflictsByKey.has(key)) errors.push(`duplicate conflict ${key}`);
  conflictsByKey.set(key, row);
  if (!sourceIds.has(row.source_id)) errors.push(`unknown conflict ${key}`);
  if (!evidenceFields.includes(row.field)) errors.push(`invalid conflict field ${key}`);
  if (!new Set(["PENDING_HUMAN", "CONFIRMED"]).has(row.human_confirmation)) {
    errors.push(`invalid conflict human state ${key}`);
  }
}

const normalize = (value) => String(value ?? "").trim().replaceAll(/\s+/gu, " ");
const expectedConflictKeys = new Set();
for (const sourceId of sourceIds) {
  const left = laneMaps.get(1)?.get(sourceId);
  const right = laneMaps.get(2)?.get(sourceId);
  const row = canonicalById.get(sourceId);
  const screen = screening.get(sourceId);
  if (!left || !right || !row || !screen) {
    errors.push(`missing reconciliation input ${sourceId}`);
    continue;
  }
  const humanConfirmed = row.adjudication === "HUMAN_CONFIRMED";
  if (acceptedMode || humanConfirmed) {
    requireHumanAttestation({
      attestationIndex,
      canonicalRecord: row,
      errors,
      rawRecords: [left, right],
      reviewType: "EXTRACTION",
      sourceId,
      trustedReviewerKeys,
    });
  }
  const nonIndependent = [left.reviewer_1, left.reviewer_2, right.reviewer_1, right.reviewer_2]
    .includes("AI_ROOT_GAP_FILL_NOT_INDEPENDENT");
  const sourceHasConflict = evidenceFields.some(
    (field) => nonIndependent || normalize(left[field]) !== normalize(right[field]),
  );
  const expectedAdjudication = nonIndependent
    ? "NON_INDEPENDENT_GAP_FILL_PENDING_HUMAN_REEXTRACTION"
    : screen.adjudication === "EXCLUDE"
      ? "SCREENING_EXCLUDED_PENDING_HUMAN"
      : screen.adjudication === "DEFER"
        ? "SCREENING_DEFERRED_PENDING_HUMAN"
        : sourceHasConflict
          ? "PENDING_HUMAN_FIELD_ADJUDICATION"
          : "AI_LANES_EXACT_AGREEMENT_PENDING_HUMAN";
  if (!humanConfirmed) {
    if (row.rq_id !== screen.primary_rq) errors.push(`canonical RQ reconciliation ${sourceId}`);
    if (row.reviewer_1 !== left.reviewer_1 || row.reviewer_2 !== right.reviewer_2) {
      errors.push(`canonical reviewer reconciliation ${sourceId}`);
    }
    if (row.adjudication !== expectedAdjudication) {
      errors.push(`canonical adjudication reconciliation ${sourceId}`);
    }
  }

  for (const field of evidenceFields) {
    const differs = nonIndependent || normalize(left[field]) !== normalize(right[field]);
    const key = `${sourceId}:${field}`;
    if (!differs) {
      if (!humanConfirmed && row[field] !== left[field]) {
        errors.push(`canonical exact-value reconciliation ${key}`);
      }
      continue;
    }
    expectedConflictKeys.add(key);
    if (!humanConfirmed && row[field] !== "NOT_VERIFIED") {
      errors.push(`canonical conflict suppression ${key}`);
    }
    const conflict = conflictsByKey.get(key);
    if (
      !conflict
      || conflict.rq_id !== screen.primary_rq
      || conflict.lane_1_value !== left[field]
      || conflict.lane_2_value !== right[field]
    ) {
      errors.push(`conflict reconciliation ${key}`);
      continue;
    }
    if (!humanConfirmed) {
      if (conflict.resolution !== "NOT_VERIFIED" || conflict.human_confirmation !== "PENDING_HUMAN") {
        errors.push(`pending conflict state ${key}`);
      }
    } else if (conflict.resolution === "NOT_VERIFIED" || conflict.human_confirmation !== "CONFIRMED") {
      errors.push(`confirmed conflict state ${key}`);
    }
  }
}
for (const key of conflictsByKey.keys()) {
  if (!expectedConflictKeys.has(key)) errors.push(`unexpected conflict ${key}`);
}

const pendingRows = canonical.filter((row) => row.adjudication !== "HUMAN_CONFIRMED").length;
const pendingConflicts = conflictRows.filter((row) => row.human_confirmation !== "CONFIRMED").length;
if (acceptedMode && (pendingRows > 0 || pendingConflicts > 0)) {
  errors.push(
    `acceptance blocked pending_rows=${pendingRows} pending_conflicts=${pendingConflicts}`,
  );
}
if (errors.length > 0) {
  for (const error of errors) console.error(`FORMATION_EXTRACTION_INVALID ${error}`);
  process.exitCode = 1;
} else {
  console.log(
    `FORMATION_EXTRACTION_${acceptedMode ? "ACCEPTED" : "PREPARED"} sources=${sourceIds.size} conflicts=${conflictRows.length} pending_rows=${pendingRows}`,
  );
}
