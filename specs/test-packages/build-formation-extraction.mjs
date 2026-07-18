import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { parseCsv } from "./formation-csv.mjs";

const root = resolve(import.meta.dirname, "../..");
const evidenceDir = resolve(root, ".omo/evidence/formation-research-v2");
const outputDir = resolve(root, "reports/research/evidence");
const scopes = ["abc", "d", "e", "fg"];

const readRows = (path) => parseCsv(readFileSync(path, "utf8"), path).rows;
const csvCell = (value) => {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};
const toCsv = (headers, rows) =>
  `${headers.join(",")}\n${rows.map((row) => headers.map((key) => csvCell(row[key])).join(",")).join("\n")}\n`;
const normalize = (value) => String(value ?? "").trim().replaceAll(/\s+/g, " ");

const outputPath = resolve(outputDir, "FORMATION_EVIDENCE_EXTRACTION.csv");
const headers = readFileSync(outputPath, "utf8")
  .split(/\r?\n/, 1)[0]
  .replace(/^\uFEFF/, "")
  .split(",");
const evidenceFields = headers.filter(
  (field) => !["source_id", "rq_id", "reviewer_1", "reviewer_2", "adjudication"].includes(field),
);
const sources = readRows(resolve(outputDir, "FORMATION_SOURCE_LEDGER.csv"));
const screening = new Map(
  readRows(resolve(outputDir, "FORMATION_SCREENING_LEDGER.csv")).map((row) => [row.source_id, row]),
);

function collectLane(lane) {
  const rows = scopes.flatMap((scope) =>
    readRows(resolve(evidenceDir, `extraction-${scope}-lane-${lane}.csv`)),
  );
  const map = new Map();
  for (const row of rows) {
    if (map.has(row.source_id)) throw new Error(`Duplicate lane ${lane} source ${row.source_id}`);
    map.set(row.source_id, row);
  }
  return map;
}

const lane1 = collectLane(1);
const lane2 = collectLane(2);
const conflicts = [];
const canonical = sources.map((source) => {
  const left = lane1.get(source.source_id);
  const right = lane2.get(source.source_id);
  const screen = screening.get(source.source_id);
  if (!left || !right || !screen) throw new Error(`Missing extraction input ${source.source_id}`);
  const nonIndependent = [left.reviewer_1, left.reviewer_2, right.reviewer_1, right.reviewer_2]
    .includes("AI_ROOT_GAP_FILL_NOT_INDEPENDENT");
  const row = { source_id: source.source_id, rq_id: screen.primary_rq };
  for (const field of evidenceFields) {
    if (!nonIndependent && normalize(left[field]) === normalize(right[field])) {
      row[field] = left[field];
    } else {
      row[field] = "NOT_VERIFIED";
      conflicts.push({
        source_id: source.source_id,
        rq_id: screen.primary_rq,
        field,
        lane_1_value: left[field],
        lane_2_value: right[field],
        resolution: "NOT_VERIFIED",
        human_confirmation: "PENDING_HUMAN",
      });
    }
  }
  row.reviewer_1 = left.reviewer_1;
  row.reviewer_2 = right.reviewer_2;
  if (nonIndependent) {
    row.adjudication = "NON_INDEPENDENT_GAP_FILL_PENDING_HUMAN_REEXTRACTION";
  } else if (screen.adjudication === "EXCLUDE") {
    row.adjudication = "SCREENING_EXCLUDED_PENDING_HUMAN";
  } else if (screen.adjudication === "DEFER") {
    row.adjudication = "SCREENING_DEFERRED_PENDING_HUMAN";
  } else if (conflicts.some((conflict) => conflict.source_id === source.source_id)) {
    row.adjudication = "PENDING_HUMAN_FIELD_ADJUDICATION";
  } else {
    row.adjudication = "AI_LANES_EXACT_AGREEMENT_PENDING_HUMAN";
  }
  return row;
});

writeFileSync(outputPath, toCsv(headers, canonical));
writeFileSync(
  resolve(outputDir, "FORMATION_EXTRACTION_CONFLICTS.csv"),
  toCsv(
    ["source_id", "rq_id", "field", "lane_1_value", "lane_2_value", "resolution", "human_confirmation"],
    conflicts,
  ),
);
const pending = canonical.filter((row) => row.adjudication.includes("PENDING_HUMAN")).length;
console.log(
  `FORMATION_EXTRACTION_BUILT sources=${canonical.length} conflicts=${conflicts.length} pending_rows=${pending}`,
);
