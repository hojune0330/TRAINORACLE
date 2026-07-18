import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { parseCsv } from "./formation-csv.mjs";

const root = resolve(import.meta.dirname, "../..");
const evidenceDir = resolve(root, ".omo/evidence/formation-research-v2");
const outputDir = resolve(root, "reports/research/evidence");

const csvCell = (value) => {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};
const toCsv = (headers, rows) => `${headers.join(",")}\n${rows.map((row) => headers.map((key) => csvCell(row[key])).join(",")).join("\n")}\n`;
const readRows = (path) => parseCsv(readFileSync(resolve(root, path), "utf8"), path).rows;
const firstHeader = (path) => readFileSync(resolve(root, path), "utf8").split(/\r?\n/, 1)[0].replace(/^\uFEFF/, "").split(",");

const sources = readRows("reports/research/evidence/FORMATION_SOURCE_LEDGER.csv");
const lane1 = readRows(".omo/evidence/formation-research-v2/screening-lane-1.csv");
const lane2 = readRows(".omo/evidence/formation-research-v2/screening-lane-2.csv");
const lane1ById = new Map(lane1.map((row) => [row.source_id, row]));
const lane2ById = new Map(lane2.map((row) => [row.source_id, row]));

function adjudicate(left, right) {
  if (left === right) return left;
  return "DEFER";
}

function fullTextEligibility(state) {
  if (state === "FULL_TEXT_VERIFIED") return "ELIGIBLE_FULL_TEXT";
  if (state === "ABSTRACT_ONLY") return "ABSTRACT_LIMITED";
  if (state === "METADATA_ONLY" || state === "UNRESOLVED") return "METADATA_LIMITED";
  return "EXCLUDED_IDENTITY_OR_CORRECTION";
}

function rqOrder(values) {
  return [...new Set(values.flatMap((value) => String(value ?? "").match(/RQ-[A-G]/g) ?? []))].toSorted();
}

const screeningRows = sources.map((source) => {
  const left = lane1ById.get(source.source_id);
  const right = lane2ById.get(source.source_id);
  if (!left || !right) throw new Error(`Missing lane decision ${source.source_id}`);
  const rqs = rqOrder([left.primary_rq, left.secondary_rqs, right.primary_rq, right.secondary_rqs, source.rq_tags]);
  const primaryRq = left.primary_rq === right.primary_rq ? left.primary_rq : rqs[0];
  const decision = adjudicate(left.decision, right.decision);
  const agreement = left.decision === right.decision && left.primary_rq === right.primary_rq;
  return {
    source_id: source.source_id,
    primary_rq: primaryRq,
    secondary_rqs: rqs.filter((rq) => rq !== primaryRq).join(";"),
    lane_1_decision: left.decision,
    lane_1_reason: left.reason,
    lane_2_decision: right.decision,
    lane_2_reason: right.reason,
    adjudication: decision,
    adjudication_reason: agreement
      ? "AI lanes agree; human-trained confirmation remains required"
      : "AI disagreement or RQ mismatch deferred to human-trained adjudication",
    human_confirmation: "PENDING_HUMAN",
    full_text_eligibility: fullTextEligibility(source.full_text_state),
  };
}).toSorted((left, right) => left.source_id.localeCompare(right.source_id));

function controlledExclusion(left, right) {
  const combined = `${left.reason} ${right.reason}`.toLowerCase();
  if (/wrong source identity|identifier resolves|irrelevant swimming/u.test(combined)) {
    return {
      code: "WRONG_SOURCE_IDENTITY",
      reason: "The identifier resolves to a different and ineligible source.",
    };
  }
  if (/not a recurring|false positive|overload days/u.test(combined)) {
    return {
      code: "IRRELEVANT_EXPOSURE_OR_FRAME",
      reason: "The exposure is not a recurring nonweekly microcycle or 9.5-day prescription frame.",
    };
  }
  throw new Error(`Unmapped controlled exclusion reason ${left.source_id}`);
}

const exclusionRows = screeningRows
  .filter((row) => row.adjudication === "EXCLUDE")
  .map((row, index) => ({
    ...controlledExclusion(lane1ById.get(row.source_id), lane2ById.get(row.source_id)),
    record_id: `FRV2-EX-${String(index + 1).padStart(3, "0")}`,
    source_id: row.source_id,
    screen_stage: "AI_DUAL_SCREEN_PREPARATION",
    primary_rq: row.primary_rq,
    decision: "EXCLUDE",
    primary_reason_code: controlledExclusion(
      lane1ById.get(row.source_id),
      lane2ById.get(row.source_id),
    ).code,
    reason: controlledExclusion(
      lane1ById.get(row.source_id),
      lane2ById.get(row.source_id),
    ).reason,
    lane_1_reason: lane1ById.get(row.source_id).reason,
    lane_2_reason: lane2ById.get(row.source_id).reason,
    human_confirmation: "PENDING_HUMAN",
    reviewer_1: "AI_SCREEN_LANE_1",
    reviewer_2: "AI_SCREEN_LANE_2",
    adjudication: "PENDING_HUMAN_CONFIRMATION",
    decision_date: "2026-07-17",
  }));

writeFileSync(
  resolve(outputDir, "FORMATION_SCREENING_LEDGER.csv"),
  toCsv(firstHeader("reports/research/evidence/FORMATION_SCREENING_LEDGER.csv"), screeningRows),
);
writeFileSync(
  resolve(outputDir, "FORMATION_EXCLUSION_LEDGER.csv"),
  toCsv(
    [
      "record_id",
      "source_id",
      "screen_stage",
      "primary_rq",
      "decision",
      "primary_reason_code",
      "reason",
      "lane_1_reason",
      "lane_2_reason",
      "human_confirmation",
      "reviewer_1",
      "reviewer_2",
      "adjudication",
      "decision_date",
    ],
    exclusionRows,
  ),
);
const counts = Object.groupBy(screeningRows, (row) => row.adjudication);
console.log(`FORMATION_SCREENING_LEDGERS_BUILT sources=${screeningRows.length} include=${counts.INCLUDE?.length ?? 0} exclude=${counts.EXCLUDE?.length ?? 0} defer=${counts.DEFER?.length ?? 0} pending_human=${screeningRows.length}`);
