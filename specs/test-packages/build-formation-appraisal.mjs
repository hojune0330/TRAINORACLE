import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { parseCsv } from "./formation-csv.mjs";

const root = resolve(import.meta.dirname, "../..");
const rawDir = resolve(root, ".omo/evidence/formation-research-v2");
const outputDir = resolve(root, "reports/research/evidence");

const readRows = (path) => parseCsv(readFileSync(path, "utf8"), path).rows;
const csvCell = (value) => {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};
const toCsv = (headers, rows) =>
  `${headers.join(",")}\n${rows.map((row) => headers.map((key) => csvCell(row[key])).join(",")).join("\n")}\n`;
const lane1 = new Map(
  readRows(resolve(rawDir, "appraisal-lane-1.csv")).map((row) => [row.source_id, row]),
);
const lane2 = new Map(
  readRows(resolve(rawDir, "appraisal-lane-2.csv")).map((row) => [row.source_id, row]),
);
const sources = readRows(resolve(outputDir, "FORMATION_SOURCE_LEDGER.csv"));
const outputPath = resolve(outputDir, "FORMATION_APPRAISAL_LEDGER.csv");
const headers = readFileSync(outputPath, "utf8").split(/\r?\n/, 1)[0].split(",");
const conflicts = [];
const overallOrder = ["LOW_CONCERN", "SOME_CONCERNS", "HIGH_CONCERN", "NOT_ASSESSABLE"];
const directnessOrder = ["DIRECT", "PARTIAL", "INDIRECT"];

function conservative(sourceId, field, left, right, order) {
  if (left === right) return left;
  const value = order[Math.max(order.indexOf(left), order.indexOf(right))] ?? "NOT_VERIFIED";
  conflicts.push({
    source_id: sourceId,
    field,
    lane_1_value: left,
    lane_2_value: right,
    conservative_value: value,
    human_confirmation: "PENDING_HUMAN",
  });
  return value;
}

function mergeDirectness(sourceId, field, left, right) {
  if (left === right) return left;
  if (left === "NOT_APPLICABLE" || right === "NOT_APPLICABLE") {
    conflicts.push({
      source_id: sourceId,
      field,
      lane_1_value: left,
      lane_2_value: right,
      conservative_value: "NOT_VERIFIED",
      human_confirmation: "PENDING_HUMAN",
    });
    return "NOT_VERIFIED";
  }
  return conservative(sourceId, field, left, right, directnessOrder);
}

const canonical = sources.map((source) => {
  const left = lane1.get(source.source_id);
  const right = lane2.get(source.source_id);
  if (!left || !right) throw new Error(`Missing appraisal ${source.source_id}`);
  const nonIndependentInput = /independence_state=NON_INDEPENDENT_EXTRACTION_INPUT/u.test(
    `${left.notes} ${right.notes}`,
  );
  const row = {
    source_id: source.source_id,
    rq_id: left.rq_id === right.rq_id ? left.rq_id : "NOT_VERIFIED",
    design: left.design === right.design ? left.design : "NOT_VERIFIED",
    appraisal_tool: left.appraisal_tool === right.appraisal_tool ? left.appraisal_tool : "NOT_VERIFIED",
    domain_judgments: `LANE_1[${left.domain_judgments}] | LANE_2[${right.domain_judgments}]`,
    overall_judgment: conservative(
      source.source_id,
      "overall_judgment",
      left.overall_judgment,
      right.overall_judgment,
      overallOrder,
    ),
    youth_directness: mergeDirectness(
      source.source_id,
      "youth_directness",
      left.youth_directness,
      right.youth_directness,
    ),
    architecture_directness: mergeDirectness(
      source.source_id,
      "architecture_directness",
      left.architecture_directness,
      right.architecture_directness,
    ),
    outcome_compatibility:
      left.outcome_compatibility === right.outcome_compatibility
        ? left.outcome_compatibility
        : "NOT_VERIFIED",
    time_horizon_compatibility:
      left.time_horizon_compatibility === right.time_horizon_compatibility
        ? left.time_horizon_compatibility
        : "NOT_VERIFIED",
    correction_state:
      left.correction_state === right.correction_state ? left.correction_state : "NOT_VERIFIED",
    overlap_group: left.overlap_group === right.overlap_group ? left.overlap_group : "NOT_VERIFIED",
    reviewer_1: left.reviewer_1,
    reviewer_2: right.reviewer_2,
    adjudication: nonIndependentInput
      ? "NON_INDEPENDENT_INPUT_PENDING_HUMAN_REAPPRAISAL"
      : "PENDING_HUMAN_APPRAISAL_ADJUDICATION",
    human_confirmation: "PENDING_HUMAN",
    notes: `LANE_1[${left.notes}] | LANE_2[${right.notes}]`,
  };
  return row;
});

writeFileSync(outputPath, toCsv(headers, canonical));
writeFileSync(
  resolve(outputDir, "FORMATION_APPRAISAL_CONFLICTS.csv"),
  toCsv(
    ["source_id", "field", "lane_1_value", "lane_2_value", "conservative_value", "human_confirmation"],
    conflicts,
  ),
);
console.log(`FORMATION_APPRAISAL_BUILT sources=${canonical.length} conflicts=${conflicts.length} pending_human=${canonical.length}`);
