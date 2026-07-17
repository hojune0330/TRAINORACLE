import fs from "node:fs";

import { parseCsv } from "../../../specs/test-packages/formation-csv.mjs";
import {
  appraisalNote,
  appraisalTool,
  architectureDirectness,
  domainJudgments,
  outcomeCompatibility,
  overallJudgment,
  timeHorizonCompatibility,
  youthDirectness,
} from "./appraisal-lane-1-rules.mjs";

const SOURCE_PATH = "reports/research/evidence/FORMATION_SOURCE_LEDGER.csv";
const SCREENING_PATH = "reports/research/evidence/FORMATION_SCREENING_LEDGER.csv";
const OUTPUT_PATH = ".omo/evidence/formation-research-v2/appraisal-lane-1.csv";

const HEADER = [
  "source_id", "rq_id", "design", "appraisal_tool", "domain_judgments",
  "overall_judgment", "youth_directness", "architecture_directness",
  "outcome_compatibility", "time_horizon_compatibility", "correction_state",
  "overlap_group", "reviewer_1", "reviewer_2", "adjudication",
  "human_confirmation", "notes",
];

function readObjects(path) {
  return parseCsv(fs.readFileSync(path, "utf8"), path).rows;
}

function quote(value) {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

const sources = readObjects(SOURCE_PATH);
const screening = new Map(readObjects(SCREENING_PATH).map((row) => [row.source_id, row]));
if (sources.length === 0 || new Set(sources.map((row) => row.source_id)).size !== sources.length) {
  throw new Error(`Expected a nonempty unique source ledger; found ${sources.length}`);
}

const outputRows = sources.map((source) => {
  const screen = screening.get(source.source_id);
  if (!screen) throw new Error(`Missing screening row for ${source.source_id}`);
  const rqId = screen.primary_rq;
  const tool = appraisalTool(source);
  const overall = overallJudgment(source);
  return [
    source.source_id, rqId, source.source_type, tool,
    domainJudgments(source, tool, overall), overall, youthDirectness(source),
    architectureDirectness(source), outcomeCompatibility(source, rqId),
    timeHorizonCompatibility(source, rqId), source.correction_state,
    source.overlap_group || "NONE_IDENTIFIED", "AI_APPRAISAL_LANE_1",
    "NOT_APPLICABLE", "PENDING_INDEPENDENT_APPRAISAL", "PENDING_HUMAN",
    appraisalNote(source, overall),
  ];
});

fs.writeFileSync(
  OUTPUT_PATH,
  `${[HEADER, ...outputRows].map((row) => row.map(quote).join(",")).join("\n")}\n`,
  "utf8",
);

const counts = outputRows.reduce((summary, row) => {
  summary[row[5]] = (summary[row[5]] ?? 0) + 1;
  return summary;
}, {});
console.log(`FORMATION_APPRAISAL_LANE_1_BUILT sources=${outputRows.length} judgments=${JSON.stringify(counts)}`);
