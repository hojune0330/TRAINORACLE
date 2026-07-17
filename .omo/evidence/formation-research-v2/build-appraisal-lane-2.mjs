import fs from "node:fs";
import path from "node:path";

import { parseCsv } from "../../../specs/test-packages/formation-csv.mjs";

const root = path.resolve(import.meta.dirname, "../../..");
const evidenceDir = path.join(root, ".omo/evidence/formation-research-v2");

function readRecords(file) {
  return parseCsv(fs.readFileSync(file, "utf8"), file).rows;
}

function csvCell(value) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

function appraisalTool(design) {
  if (/SYSTEMATIC_REVIEW|META_ANALYSIS/.test(design)) return "AMSTAR_2";
  if (/SCOPING_REVIEW/.test(design)) return "JBI_SCOPING_REVIEW";
  if (/CLUSTER_RANDOMIZED|RANDOMIZED_(CONTROLLED|CROSSOVER|TRAINING|SUPPLEMENT|REPEATED)|PRIMARY_RANDOMIZED/.test(design)) {
    return "ROB_2";
  }
  if (/RANDOMIZED_OR_COMPARATIVE_PRIMARY/.test(design)) {
    return "DESIGN_MATCH_PENDING_FULL_TEXT";
  }
  if (/CONTROLLED_TRAINING|MATCHED_CONTROLLED|PAIR_MATCHED_CONTROLLED/.test(design)) return "ROBINS_I";
  if (/PROSPECTIVE_COHORT|OBSERVATIONAL_COHORT|OBSERVATIONAL_PRIMARY|DESCRIPTIVE_EPIDEMIOLOGY/.test(design)) {
    return "JBI_COHORT";
  }
  if (/CROSS_SECTIONAL.*SURVEY/.test(design)) return "JBI_ANALYTICAL_CROSS_SECTIONAL";
  if (/CASE_OR_SINGLE_CASE/.test(design)) return "ROBINT_PLUS_SCRIBE_PENDING_SCED_CONFIRMATION";
  if (/CASE_STUDY|CASE_REPORT|CLINICAL_REPORT/.test(design)) return "JBI_CASE_REPORT";
  if (/DEVICE_VALIDATION|INSTRUMENT_VALIDATION|COMPARATIVE_VALIDATION|LONGITUDINAL_VALIDATION/.test(design)) {
    return "COSMIN_MEASUREMENT_PROPERTIES";
  }
  if (/QUALITATIVE/.test(design)) return "JBI_QUALITATIVE";
  if (/MIXED_METHOD/.test(design)) return "JBI_MIXED_METHODS";
  if (/CONSENSUS|DELPHI|GUIDELINE|GUIDANCE|STANDARD|REPORTING_GUIDELINE/.test(design)) {
    return "CONSENSUS_GUIDANCE_FRAMEWORK";
  }
  if (/METHOD|STATISTICAL|CONCEPTUAL|SIMULATION|FRAMEWORK|TUTORIAL/.test(design)) {
    return "METHODS_VALIDITY_AND_TRANSPARENCY";
  }
  if (/NARRATIVE_REVIEW|CLINICAL_REVIEW|SPORTS_MEASUREMENT_REVIEW|REVIEW$/.test(design)) {
    return "SANRA_NARRATIVE_REVIEW";
  }
  if (/INTERVIEW|JOURNALISTIC|COACH|COMMENTARY|EDITORIAL/.test(design)) return "JBI_TEXT_AND_OPINION";
  if (/PRIMARY_ACUTE|PRIMARY_CROSSOVER|PRIMARY_REPEATED_BOUT|COMPARATIVE_STUDY/.test(design)) {
    return "JBI_QUASI_EXPERIMENTAL";
  }
  if (/PRIMARY_OR_OFFICIAL_SOURCE/.test(design)) return "DESIGN_MATCH_PENDING_METADATA_NORMALIZATION";
  return "DESIGN_MATCH_PENDING_METADATA_NORMALIZATION";
}

function isMethodsOrPolicy(design) {
  return /METHOD|STATISTICAL|CONCEPTUAL|SIMULATION|GUIDANCE|GUIDELINE|STANDARD|REPORTING|ETHICS/.test(design);
}

function youthDirectness(source, extraction) {
  if (isMethodsOrPolicy(source.source_type)) return "NOT_APPLICABLE";

  const text = [
    source.population,
    source.event,
    source.age_range,
    source.training_status,
    extraction.population,
    extraction.event,
    extraction.age_range,
    extraction.competitive_level,
  ].join(" ").toLowerCase();
  const youth = /youth|adolesc|high[- ]school|junior|u1[579]|14[-_ ]?18|16[-_ ]?18|child|pediatric|paediatric|young trained/.test(text);
  const middleDistance = /middle[-_ ]distance|\b800\b|\b1500\b|track|distance runner|3[_ ]?km/.test(text);
  const running = middleDistance || /run|marathon|cross[-_ ]country|5[_ ]?km|10[_ ]?km/.test(text);

  if (youth && running) return "DIRECT";
  if (youth || running) return "PARTIAL";
  return "INDIRECT";
}

function architectureDirectness(source, screening) {
  const text = `${source.title} ${source.notes}`.toLowerCase();
  if (screening.adjudication === "EXCLUDE" || source.rq_tags === "none") return "NOT_APPLICABLE";
  const practiceSource = /INTERVIEW|JOURNALISTIC|COACH|SYMPOSIUM/.test(source.source_type);
  if (source.rq_tags.includes("RQ-A") && practiceSource && /(9[- ]day|9\.5[- ]day|10[- ]day|nine[- ]day|ten[- ]day)/.test(text)) {
    return "PARTIAL";
  }
  return "INDIRECT";
}

function compatibility(source, extraction, screening) {
  if (screening.adjudication === "EXCLUDE") return "INCOMPATIBLE";
  if (isMethodsOrPolicy(source.source_type)) return "NOT_APPLICABLE";
  const limitations = extraction.limitations.toLowerCase();
  if (/irrelevant|wrong identifier/.test(`${source.notes} ${limitations}`.toLowerCase())) return "INCOMPATIBLE";
  if (/no .*outcome|no efficacy|not .*evidence|cannot|unsupported|indirect/.test(limitations)) return "PARTIAL";
  return "COMPATIBLE";
}

function timeCompatibility(source, extraction, screening) {
  if (screening.adjudication === "EXCLUDE") return "INCOMPATIBLE";
  if (isMethodsOrPolicy(source.source_type)) return "NOT_APPLICABLE";
  const horizon = extraction.time_horizon.toUpperCase();
  if (/NOT_REPORTED|NOT_VERIFIED/.test(horizon)) return "PARTIAL";
  if (/ACUTE|HOUR|DAY|SESSION/.test(horizon)) return source.rq_tags.includes("RQ-B") ? "COMPATIBLE" : "PARTIAL";
  if (/WEEK|MONTH|SEASON|LONG|MULTI/.test(horizon)) return "COMPATIBLE";
  return "PARTIAL";
}

function overallJudgment(source, screening, tool) {
  if (/INCORRECT_ID|irrelevant to running HIIT/i.test(source.notes)) return "HIGH_CONCERN";
  if (screening.adjudication === "EXCLUDE") return "NOT_ASSESSABLE";
  if (source.full_text_state === "ABSTRACT_ONLY") return "NOT_ASSESSABLE";
  if (tool.startsWith("DESIGN_MATCH_PENDING") || tool.includes("PENDING_SCED_CONFIRMATION")) {
    return "NOT_ASSESSABLE";
  }
  return "SOME_CONCERNS";
}

function domainJudgments(source, screening, tool, overall) {
  const parts = [
    `full_text=${source.full_text_state}`,
    `screening=${screening.adjudication}`,
    `tool=${tool}`,
    "numeric_score=NOT_USED",
  ];

  if (overall === "NOT_ASSESSABLE") {
    parts.push("item_level_judgments=NOT_VERIFIED");
  } else if (overall === "HIGH_CONCERN") {
    parts.push("source_identity_or_relevance=HIGH_CONCERN");
  } else {
    parts.push("item_level_judgments=UNRESOLVED_CONSERVATIVE");
  }

  return parts.join(";");
}

function cleanLimitations(value) {
  const compact = value.replaceAll(/\s+/g, " ").trim();
  return compact || "NOT_REPORTED";
}

const sources = readRecords(path.join(root, "reports/research/evidence/FORMATION_SOURCE_LEDGER.csv"));
const screening = readRecords(path.join(root, "reports/research/evidence/FORMATION_SCREENING_LEDGER.csv"));
const screeningById = new Map(screening.map((row) => [row.source_id, row]));

const extractionFiles = fs
  .readdirSync(evidenceDir)
  .filter((file) => /^extraction-.*-lane-2\.csv$/.test(file))
  .sort();
const extractions = extractionFiles.flatMap((file) => readRecords(path.join(evidenceDir, file)));
const extractionById = new Map(extractions.map((row) => [row.source_id, row]));
const canonicalExtractions = readRecords(
  path.join(root, "reports/research/evidence/FORMATION_EVIDENCE_EXTRACTION.csv"),
);
const canonicalExtractionById = new Map(
  canonicalExtractions.map((row) => [row.source_id, row]),
);

if (
  sources.length === 0
  || screeningById.size !== sources.length
  || extractionById.size !== sources.length
  || canonicalExtractionById.size !== sources.length
) {
  throw new Error(
    `Canonical coverage mismatch: sources=${sources.length} screening=${screeningById.size} extraction=${extractionById.size} canonical_extraction=${canonicalExtractionById.size}`,
  );
}

const header = [
  "source_id",
  "rq_id",
  "design",
  "appraisal_tool",
  "domain_judgments",
  "overall_judgment",
  "youth_directness",
  "architecture_directness",
  "outcome_compatibility",
  "time_horizon_compatibility",
  "correction_state",
  "overlap_group",
  "reviewer_1",
  "reviewer_2",
  "adjudication",
  "human_confirmation",
  "notes",
];

const rows = sources.map((source) => {
  const screen = screeningById.get(source.source_id);
  const extraction = extractionById.get(source.source_id);
  const canonicalExtraction = canonicalExtractionById.get(source.source_id);
  if (!screen || !extraction || !canonicalExtraction) {
    throw new Error(`Missing joined record for ${source.source_id}`);
  }

  const tool = appraisalTool(source.source_type);
  const overall = overallJudgment(source, screen, tool);
  const independentInput = canonicalExtraction.adjudication
    !== "NON_INDEPENDENT_GAP_FILL_PENDING_HUMAN_REEXTRACTION";
  const notes = [
    independentInput
      ? "independence_state=INDEPENDENT_APPRAISAL_INPUT"
      : "independence_state=NON_INDEPENDENT_EXTRACTION_INPUT",
    `decision_use=${screen.adjudication}`,
    `limitations=${cleanLimitations(extraction.limitations)}`,
    "product_identity=9_5_DAY_FORMATION_SEPARATE_FROM_SCIENTIFIC_CLAIMS",
    "runtime_authority=false",
  ].join("; ");

  return [
    source.source_id,
    extraction.rq_id || screen.primary_rq || source.rq_tags,
    source.source_type,
    tool,
    domainJudgments(source, screen, tool, overall),
    overall,
    youthDirectness(source, extraction),
    architectureDirectness(source, screen),
    compatibility(source, extraction, screen),
    timeCompatibility(source, extraction, screen),
    source.correction_state,
    source.overlap_group || "NONE_IDENTIFIED",
    "NOT_APPLICABLE",
    "AI_APPRAISAL_LANE_2",
    independentInput
      ? "PENDING_INDEPENDENT_APPRAISAL"
      : "NON_INDEPENDENT_INPUT_PENDING_HUMAN_REAPPRAISAL",
    "PENDING_HUMAN",
    notes,
  ];
});

const output = `${header.join(",")}\n${rows.map((row) => row.map(csvCell).join(",")).join("\n")}\n`;
const destination = path.join(evidenceDir, "appraisal-lane-2.csv");
fs.writeFileSync(destination, output, "utf8");

const ids = new Set(rows.map((row) => row[0]));
if (ids.size !== sources.length) {
  throw new Error(`Unique output coverage mismatch: ${ids.size}/${sources.length}`);
}

const counts = rows.reduce((result, row) => {
  result[row[5]] = (result[row[5]] ?? 0) + 1;
  return result;
}, {});
console.log(`FORMATION_APPRAISAL_LANE_2_BUILT rows=${rows.length} unique=${ids.size} judgments=${JSON.stringify(counts)}`);
