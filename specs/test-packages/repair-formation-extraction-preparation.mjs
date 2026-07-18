import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { parseCsv } from "./formation-csv.mjs";

const root = resolve(import.meta.dirname, "../..");
const evidence = resolve(root, ".omo/evidence/formation-research-v2");
const screeningPath = resolve(root, "reports/research/evidence/FORMATION_SCREENING_LEDGER.csv");

const csvCell = (value) => {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};
const writeCsv = (path, headers, rows) =>
  writeFileSync(
    path,
    `${headers.join(",")}\n${rows.map((row) => headers.map((key) => csvCell(row[key])).join(",")).join("\n")}\n`,
  );
const read = (name) => parseCsv(readFileSync(resolve(evidence, name), "utf8"), name);
const byId = (rows) => new Map(rows.map((row) => [row.source_id, row]));
const sortRows = (rows) => rows.toSorted((left, right) => left.source_id.localeCompare(right.source_id));

const e1 = read("extraction-e-lane-1.csv");
const e2 = read("extraction-e-lane-2.csv");
const fg1 = read("extraction-fg-lane-1.csv");
const fg2 = read("extraction-fg-lane-2.csv");
const existing1 = read("extraction-existing-lane-1.csv");
const fg1ById = byId(fg1.rows);
const fg2ById = byId(fg2.rows);
const existing1ById = byId(existing1.rows);
const e1ById = byId(e1.rows.filter((row) => row.source_id !== "SRC-PMID-28463642"));
const e2ById = byId(e2.rows);
const rootFillIds = new Set([
  "FRV2-F-015",
  "FRV2-F-016",
  "SRC-DOI-10.1136-BMJ.H1793",
  "SRC-WEB-COCHRANE-HB-CH14",
]);

for (const sourceId of ["SRC-DOI-10.1136-BMJ.H1793", "SRC-WEB-COCHRANE-HB-CH14"]) {
  const source = existing1ById.get(sourceId);
  if (!source) throw new Error(`Missing existing preparation ${sourceId}`);
  e1ById.set(sourceId, { ...source, rq_id: "RQ-E", adjudication: "PENDING_HUMAN_REEXTRACTION" });
  e2ById.set(sourceId, {
    ...source,
    rq_id: "RQ-E",
    reviewer_1: "NOT_APPLICABLE",
    reviewer_2: "AI_ROOT_GAP_FILL_NOT_INDEPENDENT",
    adjudication: "PENDING_HUMAN_REEXTRACTION",
  });
}

for (const sourceId of ["FRV2-F-015", "FRV2-F-016"]) {
  const source = fg2ById.get(sourceId) ?? e2ById.get(sourceId);
  if (!source) throw new Error(`Missing pilot-method preparation ${sourceId}`);
  e1ById.set(sourceId, {
    ...source,
    rq_id: "RQ-E",
    reviewer_1: "AI_ROOT_GAP_FILL_NOT_INDEPENDENT",
    reviewer_2: "NOT_APPLICABLE",
    adjudication: "PENDING_HUMAN_REEXTRACTION",
  });
  e2ById.set(sourceId, { ...source, rq_id: "RQ-E", adjudication: "PENDING_HUMAN_REEXTRACTION" });
}

const fg2ByCanonicalId = byId(fg2.rows.filter((row) => !rootFillIds.has(row.source_id)));
for (const sourceId of ["SRC-PMID-34250468", "SRC-WEB-PRISMA-2020"]) {
  const source = fg1ById.get(sourceId);
  if (!source) throw new Error(`Missing canonical F/G preparation ${sourceId}`);
  fg2ByCanonicalId.set(sourceId, {
    ...source,
    reviewer_1: "NOT_APPLICABLE",
    reviewer_2: "AI_ROOT_GAP_FILL_NOT_INDEPENDENT",
    adjudication: "PENDING_HUMAN_REEXTRACTION",
  });
}

writeCsv(resolve(evidence, "extraction-e-lane-1.csv"), e1.headers, sortRows([...e1ById.values()]));
writeCsv(resolve(evidence, "extraction-e-lane-2.csv"), e2.headers, sortRows([...e2ById.values()]));
writeCsv(resolve(evidence, "extraction-fg-lane-2.csv"), fg2.headers, sortRows([...fg2ByCanonicalId.values()]));

const screening = parseCsv(readFileSync(screeningPath, "utf8"), screeningPath);
const sourceIndex = screening.headers.indexOf("source_id");
const rqIndex = screening.headers.indexOf("primary_rq");
const expected = new Map(screening.rows.map((row) => [row.source_id, row.primary_rq]));
const combined = [
  ...read("extraction-abc-lane-1.csv").rows,
  ...read("extraction-d-lane-1.csv").rows,
  ...e1ById.values(),
  ...fg1.rows,
];
const ids = new Set(combined.map((row) => row.source_id));
if (ids.size !== screening.rows.length || combined.some((row) => expected.get(row.source_id) !== row.rq_id)) {
  throw new Error(`Lane 1 canonical reconciliation failed ${ids.size}/${screening.rows.length}`);
}
console.log(`FORMATION_EXTRACTION_REPAIRED root_gap_fill=6 lane_1=${ids.size} screening_columns=${sourceIndex}:${rqIndex}`);
